#!/usr/bin/env python3
"""Messages between dispatchers and drivers for the new traccar-web UI.

Traccar has no place for chat messages, so this small service keeps them in SQLite. It owns no
users or permissions: every request carries the browser's Traccar session cookie (the service
must be served from the same origin as Traccar, behind a reverse proxy under /chat-api), and
the service asks Traccar who the user is and whether that user can see the vehicle.

A conversation belongs to a vehicle (Traccar device). Everyone who can see the vehicle in
Traccar can read and write it: the company Admin, its users (dispatchers) and the driver.
The service also remembers which driver currently drives which vehicle, one driver per vehicle.

Environment:
    TRACCAR_URL   Traccar base URL, e.g. http://traccar:8082
    DATABASE      SQLite file, default /data/chat.db
    PORT          listening port, default 8090

Only the Python standard library is used.
"""

import json
import os
import re
import sqlite3
import threading
import time
import urllib.error
import urllib.request
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TRACCAR_URL = os.environ.get('TRACCAR_URL', 'http://localhost:8082').rstrip('/')
DATABASE = os.environ.get('DATABASE', '/data/chat.db')
PORT = int(os.environ.get('PORT', '8090'))
CACHE_SECONDS = 60
MAX_TEXT = 2000

SCHEMA = """
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL,
    text TEXT NOT NULL,
    time REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_device ON messages (device_id, id);
CREATE TABLE IF NOT EXISTS reads (
    user_id INTEGER NOT NULL,
    device_id INTEGER NOT NULL,
    last_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, device_id)
);
CREATE TABLE IF NOT EXISTS assignments (
    device_id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    user_name TEXT NOT NULL,
    since REAL NOT NULL
);
"""

db_lock = threading.Lock()
os.makedirs(os.path.dirname(DATABASE) or '.', exist_ok=True)
db = sqlite3.connect(DATABASE, check_same_thread=False)
db.row_factory = sqlite3.Row
db.executescript(SCHEMA)


def query(sql, args=(), one=False):
    with db_lock:
        cursor = db.execute(sql, args)
        rows = cursor.fetchall()
        db.commit()
        return (rows[0] if rows else None) if one else rows


def execute(sql, args=()):
    with db_lock:
        cursor = db.execute(sql, args)
        db.commit()
        return cursor.lastrowid


# ---------------------------------------------------------------- Traccar checks

cache = {}
cache_lock = threading.Lock()


def cached(key, loader):
    now = time.time()
    with cache_lock:
        hit = cache.get(key)
        if hit and hit[0] > now:
            return hit[1]
    value = loader()
    with cache_lock:
        cache[key] = (now + CACHE_SECONDS, value)
        if len(cache) > 10000:
            cache.clear()
    return value


def traccar_get(path, session):
    request = urllib.request.Request(
        TRACCAR_URL + path,
        headers={'Cookie': f'JSESSIONID={session}', 'Accept': 'application/json'},
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return json.loads(response.read() or 'null')
    except urllib.error.HTTPError:
        return None


def role_of(user):
    if user.get('administrator'):
        return user.get('attributes', {}).get('role') or 'superadmin'
    if (user.get('userLimit') or 0) != 0:
        return 'admin'
    return 'driver' if user.get('attributes', {}).get('role') == 'driver' else 'user'


def current_user(session):
    return cached(('user', session), lambda: traccar_get('/api/session', session))


def can_see(session, device_id):
    return cached(
        ('device', session, device_id),
        lambda: traccar_get(f'/api/devices/{device_id}', session) is not None,
    )


# ---------------------------------------------------------------- HTTP


class HttpError(Exception):
    def __init__(self, status, message, body=None):
        super().__init__(message)
        self.status = status
        self.body = body or {'error': message}


def message_json(row):
    return {
        'id': row['id'],
        'deviceId': row['device_id'],
        'senderId': row['sender_id'],
        'senderName': row['sender_name'],
        'senderRole': row['sender_role'],
        'text': row['text'],
        'time': row['time'],
    }


def assignment_json(row):
    return row and {
        'deviceId': row['device_id'],
        'userId': row['user_id'],
        'userName': row['user_name'],
        'since': row['since'],
    }


class Handler(BaseHTTPRequestHandler):
    server_version = 'traccar-chat'

    def log_message(self, fmt, *args):
        pass  # keep the container log quiet; errors are still reported

    # -- helpers

    def session(self):
        cookie = SimpleCookie(self.headers.get('Cookie', ''))
        morsel = cookie.get('JSESSIONID')
        if not morsel:
            raise HttpError(401, 'not logged in')
        return morsel.value

    def user(self):
        session = self.session()
        user = current_user(session)
        if not user:
            raise HttpError(401, 'not logged in')
        return session, user

    def body(self):
        length = int(self.headers.get('Content-Length') or 0)
        if length > 100_000:
            raise HttpError(413, 'too large')
        return json.loads(self.rfile.read(length) or b'{}')

    def device_ids(self, query_string):
        match = re.search(r'deviceIds=([\d,]*)', query_string)
        ids = [int(value) for value in (match.group(1).split(',') if match else []) if value]
        return ids[:500]

    def send(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def handle_request(self, method):
        path, _, query_string = self.path.partition('?')
        path = path.removeprefix('/chat-api')
        try:
            self.route(method, path, query_string)
        except HttpError as error:
            self.send(error.status, error.body)
        except (ValueError, KeyError, json.JSONDecodeError):
            self.send(400, {'error': 'bad request'})

    def do_GET(self):
        self.handle_request('GET')

    def do_POST(self):
        self.handle_request('POST')

    def do_DELETE(self):
        self.handle_request('DELETE')

    # -- routes

    def route(self, method, path, query_string):
        if path == '/health':
            return self.send(200, {'ok': True})

        session, user = self.user()

        if path == '/summary' and method == 'GET':
            return self.summary(session, user, self.device_ids(query_string))

        if path == '/me/assignment':
            if method == 'GET':
                row = query('SELECT * FROM assignments WHERE user_id = ?', (user['id'],), one=True)
                return self.send(200, assignment_json(row))
            if method == 'POST':
                return self.assign(session, user, self.body())
            if method == 'DELETE':
                execute('DELETE FROM assignments WHERE user_id = ?', (user['id'],))
                return self.send(200, None)

        match = re.fullmatch(r'/vehicles/(\d+)/(messages|read)', path)
        if match:
            device_id = int(match.group(1))
            if not can_see(session, device_id):
                raise HttpError(404, 'vehicle not found')
            if match.group(2) == 'messages' and method == 'GET':
                after = int((re.search(r'after=(\d+)', query_string) or [0, 0])[1])
                rows = query(
                    'SELECT * FROM (SELECT * FROM messages WHERE device_id = ? AND id > ? '
                    'ORDER BY id DESC LIMIT 200) ORDER BY id',
                    (device_id, after),
                )
                return self.send(200, [message_json(row) for row in rows])
            if match.group(2) == 'messages' and method == 'POST':
                text = str(self.body().get('text', '')).strip()[:MAX_TEXT]
                if not text:
                    raise HttpError(400, 'empty message')
                message_id = execute(
                    'INSERT INTO messages (device_id, sender_id, sender_name, sender_role, text, time) '
                    'VALUES (?, ?, ?, ?, ?, ?)',
                    (device_id, user['id'], user.get('name') or user.get('email'), role_of(user),
                     text, time.time()),
                )
                self.mark_read(user['id'], device_id, message_id)
                row = query('SELECT * FROM messages WHERE id = ?', (message_id,), one=True)
                return self.send(200, message_json(row))
            if match.group(2) == 'read' and method == 'POST':
                self.mark_read(user['id'], device_id, int(self.body().get('lastId', 0)))
                return self.send(200, None)

        raise HttpError(404, 'not found')

    def mark_read(self, user_id, device_id, last_id):
        execute(
            'INSERT INTO reads (user_id, device_id, last_id) VALUES (?, ?, ?) '
            'ON CONFLICT (user_id, device_id) DO UPDATE SET last_id = MAX(last_id, excluded.last_id)',
            (user_id, device_id, last_id),
        )

    def summary(self, session, user, device_ids):
        """Driver, last message and unread count for each visible vehicle."""
        result = {}
        for device_id in device_ids:
            if not can_see(session, device_id):
                continue
            last = query(
                'SELECT * FROM messages WHERE device_id = ? ORDER BY id DESC LIMIT 1',
                (device_id,), one=True,
            )
            read = query(
                'SELECT last_id FROM reads WHERE user_id = ? AND device_id = ?',
                (user['id'], device_id), one=True,
            )
            unread = query(
                'SELECT COUNT(*) AS n FROM messages WHERE device_id = ? AND id > ? AND sender_id != ?',
                (device_id, read['last_id'] if read else 0, user['id']), one=True,
            )['n']
            assignment = query('SELECT * FROM assignments WHERE device_id = ?', (device_id,), one=True)
            result[device_id] = {
                'driver': assignment_json(assignment),
                'last': last and message_json(last),
                'unread': unread,
            }
        self.send(200, result)

    def assign(self, session, user, body):
        """A driver takes a vehicle. A vehicle has one driver; taking an occupied one needs force."""
        if role_of(user) != 'driver':
            raise HttpError(403, 'only drivers choose a vehicle')
        device_id = int(body['deviceId'])
        if not can_see(session, device_id):
            raise HttpError(404, 'vehicle not found')
        current = query('SELECT * FROM assignments WHERE device_id = ?', (device_id,), one=True)
        if current and current['user_id'] != user['id'] and not body.get('force'):
            raise HttpError(409, 'vehicle taken', {
                'error': 'vehicle taken',
                'driver': assignment_json(current),
            })
        with db_lock:
            db.execute('DELETE FROM assignments WHERE user_id = ? OR device_id = ?',
                       (user['id'], device_id))
            db.execute(
                'INSERT INTO assignments (device_id, user_id, user_name, since) VALUES (?, ?, ?, ?)',
                (device_id, user['id'], user.get('name') or user.get('email'), time.time()),
            )
            db.commit()
        row = query('SELECT * FROM assignments WHERE user_id = ?', (user['id'],), one=True)
        self.send(200, assignment_json(row))


if __name__ == '__main__':
    print(f'traccar-chat on :{PORT}, Traccar {TRACCAR_URL}, database {DATABASE}', flush=True)
    ThreadingHTTPServer(('', PORT), Handler).serve_forever()
