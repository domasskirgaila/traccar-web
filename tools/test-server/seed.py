#!/usr/bin/env python3
"""Keeps the new UI test Traccar server filled with demo data.

Meant to run from cron on the test host every minute:

    * * * * * /usr/bin/python3 ~/traccar-test/seed.py >> ~/traccar-test/seed.log 2>&1

Each run creates whatever demo companies, users, devices and commands are missing, so a
recreated container is refilled within a minute, and then feeds simulated positions for
about a minute through the OsmAnd protocol.

Settings are read from seed.env next to this script (KEY=value lines):

    ADMIN_EMAIL, ADMIN_PASSWORD  administrator used for seeding; created if the server is empty
    DEMO_PASSWORD                password of every demo account
    API_URL                      default http://localhost:18082
    CONTAINER                    default traccar-new-ui-test (used to find the OsmAnd port)
    OSMAND_URL                   default http://<container ip>:5055

Uses only the Python standard library.
"""

import fcntl
import http.cookiejar
import json
import math
import os
import random
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))

COMPANIES = [
    ('acme', 'ACME Transport', 54.6872, 25.2797),
    ('baltic', 'Baltic Logistics', 55.7033, 21.1443),
    ('kaunas', 'Kauno Krovinys', 54.8985, 23.9036),
    ('nemunas', 'Nemuno Statyba', 55.9349, 23.3137),
    ('aukstaitija', 'Aukštaitijos Pervežimai', 55.7348, 24.3575),
]

PEOPLE = [
    'Jonas Petraitis', 'Rūta Kazlauskienė', 'Tomas Jankauskas', 'Eglė Stankevičiūtė',
    'Mantas Vasiliauskas', 'Ieva Žukauskaitė', 'Darius Butkus', 'Greta Paulauskaitė',
    'Lukas Urbonas', 'Agnė Navickaitė', 'Paulius Kavaliauskas', 'Simona Ramanauskaitė',
]

VEHICLES = [
    ('Volvo FH', 'truck'), ('Scania R450', 'truck'), ('MAN TGX', 'truck'),
    ('Mercedes Sprinter', 'van'), ('Ford Transit', 'van'), ('VW Crafter', 'van'),
    ('Toyota Hilux', 'pickup'), ('Škoda Octavia', 'car'),
]

TRACKERS = ['Teltonika FMB920', 'Teltonika FMC130', 'Teltonika FMB140', 'Teltonika FMC650']

# Teltonika style custom commands; Traccar only offers commands the device protocol supports,
# and both Teltonika and the OsmAnd demo devices accept custom ones.
COMMANDS = [
    ('engineStop', 'Variklio blokavimas', 'setdigout 1'),
    ('engineResume', 'Variklio atblokavimas', 'setdigout 0'),
    ('positionSingle', 'Pozicijos užklausa', 'getgps'),
]


def log(message):
    print(f'{time.strftime("%Y-%m-%d %H:%M:%S")} {message}', flush=True)


def load_settings():
    settings = {
        'API_URL': 'http://localhost:18082',
        'CONTAINER': 'traccar-new-ui-test',
    }
    with open(os.path.join(HERE, 'seed.env'), encoding='utf-8') as file:
        for line in file:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                settings[key.strip()] = value.strip()
    for key in ('ADMIN_EMAIL', 'ADMIN_PASSWORD', 'DEMO_PASSWORD'):
        if not settings.get(key):
            raise SystemExit(f'seed.env: {key} is missing')
    return settings


# ---------------------------------------------------------------- demo data model


def build_companies():
    """Deterministic demo data, so every run describes exactly the same objects."""
    companies = []
    people = iter(PEOPLE * 3)
    for index, (slug, name, latitude, longitude) in enumerate(COMPANIES):
        rng = random.Random(slug)
        users = [
            {'name': next(people), 'email': f'user{n}@{slug}.test'}
            for n in range(1, 2 + index % 3 + 1)
        ]
        devices = []
        for n in range(4 + index * 2):
            model, category = VEHICLES[rng.randrange(len(VEHICLES))]
            letters = ''.join(rng.choice('ABCDEFGHJKLMNPRSTUVZ') for _ in range(3))
            devices.append({
                'uniqueId': f'35{index:03d}{n:010d}',
                'name': f'{model} {letters} {rng.randint(100, 999)}',
                'category': category,
                'model': TRACKERS[rng.randrange(len(TRACKERS))],
                'phone': f'+3706{rng.randint(1000000, 9999999)}',
                # Most vehicles drive, some are parked, and one per company never reports.
                'behaviour': 'offline' if n % 6 == 5 else 'parked' if n % 6 == 4 else 'driving',
                'center': (
                    latitude + rng.uniform(-0.03, 0.03),
                    longitude + rng.uniform(-0.05, 0.05),
                ),
                'radius': rng.uniform(2, 8),  # km
                'period': rng.uniform(30, 70) * 60,  # s for one loop
                'phase': rng.random(),
                'power': 24 if category == 'truck' else 12,
                'tank': rng.uniform(0.3, 1.0),
            })
        companies.append({
            'slug': slug,
            'name': name,
            'admin': {'name': name, 'email': f'admin@{slug}.test'},
            'users': users,
            'devices': devices,
        })
    return companies


# ---------------------------------------------------------------- Traccar API


class Api:
    def __init__(self, url):
        self.url = url.rstrip('/')
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())
        )

    def request(self, method, path, body=None, form=None):
        data = None
        headers = {'Accept': 'application/json'}
        if body is not None:
            data = json.dumps(body).encode()
            headers['Content-Type'] = 'application/json'
        elif form is not None:
            data = urllib.parse.urlencode(form).encode()
            headers['Content-Type'] = 'application/x-www-form-urlencoded'
        request = urllib.request.Request(self.url + path, data, headers, method=method)
        try:
            with self.opener.open(request, timeout=15) as response:
                content = response.read()
        except urllib.error.HTTPError as error:
            detail = error.read().decode(errors='replace')[:200]
            raise RuntimeError(f'{method} {path}: HTTP {error.code} {detail}') from None
        return json.loads(content) if content else None

    def get(self, path):
        return self.request('GET', path)

    def post(self, path, body):
        return self.request('POST', path, body=body)

    def link(self, **permission):
        try:
            self.request('POST', '/api/permissions', body=permission)
        except RuntimeError:
            pass  # already linked

    def unlink(self, **permission):
        try:
            self.request('DELETE', '/api/permissions', body=permission)
        except RuntimeError:
            pass


def login(api, settings):
    server = api.get('/api/server')
    if server.get('newServer'):
        api.post('/api/users', {
            'name': 'SuperAdmin',
            'email': settings['ADMIN_EMAIL'],
            'password': settings['ADMIN_PASSWORD'],
        })
        log(f'created first administrator {settings["ADMIN_EMAIL"]}')
    return api.request('POST', '/api/session', form={
        'email': settings['ADMIN_EMAIL'],
        'password': settings['ADMIN_PASSWORD'],
    })


def ensure_user(api, users_by_email, fields, password):
    user = users_by_email.get(fields['email'])
    if user:
        return user, False
    user = api.post('/api/users', {'password': password, **fields})
    users_by_email[user['email']] = user
    log(f'created user {user["email"]}')
    return user, True


def seed(api, settings, companies):
    """Creates missing demo objects. Only new objects get linked, to keep runs cheap."""
    me = login(api, settings)
    password = settings['DEMO_PASSWORD']
    users_by_email = {user['email']: user for user in api.get('/api/users')}
    devices_by_id = {device['uniqueId']: device for device in api.get('/api/devices?all=true')}
    commands_by_key = {
        command['attributes'].get('demoKey'): command
        for command in api.get('/api/commands?all=true')
    }

    ensure_user(api, users_by_email, {
        'name': 'Demo SuperAdmin',
        'email': 'superadmin@demo.test',
        'administrator': True,
        'attributes': {'role': 'superadmin'},
    }, password)
    ensure_user(api, users_by_email, {
        'name': 'Demo Installer',
        'email': 'installer@demo.test',
        'administrator': True,
        'attributes': {'role': 'installer'},
    }, password)

    for company in companies:
        admin, admin_created = ensure_user(api, users_by_email, {
            **company['admin'],
            'userLimit': 20,
        }, password)

        members = [(admin, admin_created)]
        for fields in company['users']:
            user, created = ensure_user(api, users_by_email, {
                **fields,
                'deviceReadonly': True,
                'limitCommands': True,
            }, password)
            if created or admin_created:
                api.link(userId=admin['id'], managedUserId=user['id'])
            members.append((user, created))

        company_devices = []
        new_devices = set()
        for spec in company['devices']:
            device = devices_by_id.get(spec['uniqueId'])
            created = device is None
            if created:
                device = api.post('/api/devices', {
                    key: spec[key] for key in ('name', 'uniqueId', 'category', 'model', 'phone')
                })
                devices_by_id[device['uniqueId']] = device
                # The seeding administrator is linked automatically; the company owns it.
                api.unlink(userId=me['id'], deviceId=device['id'])
                log(f'created device {device["name"]} for {company["name"]}')
                new_devices.add(device['id'])
            company_devices.append(device)
            for user, user_created in members:
                if created or user_created:
                    api.link(userId=user['id'], deviceId=device['id'])

        company_commands = []
        new_commands = set()
        for suffix, description, data in COMMANDS:
            key = f'{company["slug"]}-{suffix}'
            fields = {
                'description': description,
                'type': 'custom',
                # Traccar 6 cannot cancel queued commands, so the demo ones never queue.
                'attributes': {'demoKey': key, 'data': data, 'noQueue': True},
            }
            command = commands_by_key.get(key)
            created = command is None
            if created:
                command = api.post('/api/commands', fields)
                commands_by_key[key] = command
                api.unlink(userId=me['id'], commandId=command['id'])
                log(f'created command {description} for {company["name"]}')
                new_commands.add(command['id'])
            elif command['type'] != 'custom' or command['attributes'] != fields['attributes']:
                api.request('PUT', f'/api/commands/{command["id"]}', body={**command, **fields})
                log(f'updated command {description} for {company["name"]}')
            company_commands.append(command)
            for user, user_created in members:
                if created or user_created:
                    api.link(userId=user['id'], commandId=command['id'])

        # Traccar only offers a saved command for devices it is linked to as well.
        for device in company_devices:
            for command in company_commands:
                if device['id'] in new_devices or command['id'] in new_commands:
                    api.link(deviceId=device['id'], commandId=command['id'])


# ---------------------------------------------------------------- positions


def osmand_url(settings):
    if settings.get('OSMAND_URL'):
        return settings['OSMAND_URL']
    address = subprocess.run(
        ['docker', 'inspect', settings['CONTAINER'], '--format',
         '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    return f'http://{address}:5055'


SIMULATION_START = 1767225600  # 2026-01-01, the odometer counts from here


def simulate(spec, now):
    """Position of a demo vehicle at a given time: driving vehicles loop around an ellipse."""
    center_lat, center_lon = spec['center']
    km_per_lon = 111.32 * math.cos(math.radians(center_lat))
    if spec['behaviour'] == 'parked':
        angle = spec['phase'] * 2 * math.pi
        speed = 0.0
        loops = 0.0
    else:
        loops = (now - SIMULATION_START) / spec['period'] + spec['phase']
        angle = loops * 2 * math.pi
        speed = 2 * math.pi * spec['radius'] / (spec['period'] / 3600)  # km/h
    radius_lat = spec['radius'] * 0.6
    latitude = center_lat + radius_lat * math.sin(angle) / 111.32
    longitude = center_lon + spec['radius'] * math.cos(angle) / km_per_lon
    # Direction of travel on the ellipse, clockwise from north.
    course = math.degrees(math.atan2(-spec['radius'] * math.sin(angle), radius_lat * math.cos(angle)))
    driving = spec['behaviour'] == 'driving'
    wobble = math.sin(now / 37 + spec['phase'] * 10)
    # The tank drains from its level down to 15 % over five loops, then gets refilled.
    fuel = 15 + (100 * spec['tank'] - 15) * (1 - (loops % 5) / 5)
    return {
        'id': spec['uniqueId'],
        'timestamp': int(now),
        'lat': f'{latitude:.6f}',
        'lon': f'{longitude:.6f}',
        'speed': f'{max(0.0, speed * (1 + 0.15 * wobble)) * 0.539957:.1f}' if driving else '0',
        'bearing': f'{course % 360:.0f}',
        'altitude': f'{120 + 20 * wobble:.0f}',
        'accuracy': '5',
        'sat': str(9 + int(3 * wobble)),
        'rssi': str(4 + int(wobble)),
        'ignition': 'true' if driving else 'false',
        'motion': 'true' if driving else 'false',
        'power': f'{spec["power"] + (0.8 if driving else 0.2) + 0.2 * wobble:.2f}',
        'battery': f'{4.0 + 0.1 * wobble:.2f}',
        'fuel': f'{fuel:.1f}',
        'odometer': f'{loops * 2 * math.pi * spec["radius"] * 1000:.0f}',
        'in1': 'true' if driving else 'false',
        'in2': 'true' if wobble > 0.8 else 'false',
        'out1': 'false',
        'temp1': f'{4 + 2 * wobble:.1f}',
    }


def send_positions(url, companies, now):
    failures = 0
    for company in companies:
        for spec in company['devices']:
            if spec['behaviour'] == 'offline':
                continue
            query = urllib.parse.urlencode(simulate(spec, now))
            try:
                urllib.request.urlopen(f'{url}/?{query}', data=b'', timeout=5).read()
            except (urllib.error.URLError, OSError):
                failures += 1
    if failures:
        log(f'{failures} positions failed to send to {url}')


# ---------------------------------------------------------------- main


def trim_log():
    path = os.path.join(HERE, 'seed.log')
    if os.path.exists(path) and os.path.getsize(path) > 1_000_000:
        with open(path, 'r+', encoding='utf-8', errors='replace') as file:
            tail = file.read()[-200_000:]
            file.seek(0)
            file.write(tail)
            file.truncate()


def main():
    lock = open(os.path.join(HERE, '.seed.lock'), 'w')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        return  # the previous run is still going
    trim_log()
    settings = load_settings()
    companies = build_companies()
    try:
        seed(Api(settings['API_URL']), settings, companies)
        url = osmand_url(settings)
    except (RuntimeError, OSError, subprocess.CalledProcessError) as error:
        log(f'seeding failed: {error}')
        return
    if '--seed-only' in sys.argv:
        return
    # Four rounds 15 s apart, so the next cron run takes over.
    for round_index in range(4):
        started = time.time()
        send_positions(url, companies, started)
        if round_index < 3:
            time.sleep(max(0.0, 15 - (time.time() - started)))


if __name__ == '__main__':
    main()
