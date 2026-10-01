import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import { Alert, IconButton, TextField, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import SendIcon from '@mui/icons-material/Send';
import { chatFetch } from './chat';
import { roleTitleKeys } from './roles';
import useT from './useT';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    height: '100%',
  },
  messages: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(2),
  },
  bubble: {
    maxWidth: '80%',
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.shape.borderRadius * 2,
    backgroundColor: theme.palette.action.hover,
    alignSelf: 'flex-start',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: alpha(theme.palette.primary.main, 0.15),
  },
  meta: {
    display: 'block',
    marginBottom: theme.spacing(0.25),
  },
  input: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'flex-end',
    padding: theme.spacing(1, 2, 2),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
  empty: {
    margin: 'auto',
    textAlign: 'center',
  },
}));

const refreshInterval = 5000;

// Polling and sending can return the same message; keep each id once.
const merge = (current, fresh) => {
  const ids = new Set(current.map((message) => message.id));
  return [...current, ...fresh.filter((message) => !ids.has(message.id))].sort(
    (a, b) => a.id - b.id,
  );
};

// Conversation about one vehicle between its driver and the company dispatchers.
const ChatPanel = ({ deviceId }) => {
  const { classes, cx } = useStyles();
  const t = useT();
  const userId = useSelector((state) => state.session.user.id);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const lastIdRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    lastIdRef.current = 0;
    setMessages([]);
    setError(null);

    const load = async () => {
      try {
        const fresh = await chatFetch(`/vehicles/${deviceId}/messages?after=${lastIdRef.current}`, {
          signal: controller.signal,
        });
        setError(null);
        if (fresh.length) {
          lastIdRef.current = Math.max(lastIdRef.current, fresh[fresh.length - 1].id);
          setMessages((current) => merge(current, fresh));
          // Shown on screen, so it counts as read.
          chatFetch(`/vehicles/${deviceId}/read`, {
            method: 'POST',
            body: { lastId: lastIdRef.current },
          }).catch(() => {});
        }
      } catch (loadError) {
        if (loadError.name !== 'AbortError') {
          setError(t('chatUnavailable'));
        }
      }
    };

    load();
    const timer = setInterval(load, refreshInterval);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [deviceId, t]);

  useEffect(() => {
    const list = listRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    const value = text.trim();
    if (!value) {
      return;
    }
    setSending(true);
    try {
      const message = await chatFetch(`/vehicles/${deviceId}/messages`, {
        method: 'POST',
        body: { text: value },
      });
      setText('');
      // Shown right away; lastId only moves with polling so nothing sent meanwhile is skipped.
      setMessages((current) => merge(current, [message]));
    } catch {
      setError(t('chatSendFailed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={classes.root}>
      <div ref={listRef} className={classes.messages}>
        {messages.length === 0 && !error && (
          <Typography color="textSecondary" className={classes.empty}>
            {t('chatEmpty')}
          </Typography>
        )}
        {messages.map((message) => {
          const mine = message.senderId === userId;
          return (
            <div key={message.id} className={cx(classes.bubble, mine && classes.mine)}>
              <Typography variant="caption" color="textSecondary" className={classes.meta}>
                {`${mine ? t('chatYou') : `${message.senderName} · ${t(roleTitleKeys[message.senderRole] || 'roleUser')}`} · ${dayjs(message.time * 1000).format('MM-DD HH:mm')}`}
              </Typography>
              <Typography variant="body2">{message.text}</Typography>
            </div>
          );
        })}
      </div>
      {error && (
        <Alert severity="warning" sx={{ mx: 2, mb: 1 }}>
          {error}
        </Alert>
      )}
      <div className={classes.input}>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          placeholder={t('chatPlaceholder')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <IconButton color="primary" disabled={sending || !text.trim()} onClick={send}>
          <SendIcon />
        </IconButton>
      </div>
    </div>
  );
};

export default ChatPanel;
