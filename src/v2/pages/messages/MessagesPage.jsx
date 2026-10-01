import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Button,
  FormControlLabel,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Switch,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChatPanel from '../../common/ChatPanel';
import StatusDot from '../../common/StatusDot';
import { useChatSummary } from '../../common/chat';
import { formatRelative } from '../../common/format';
import useT from '../../common/useT';

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    minHeight: 0,
  },
  list: {
    width: 340,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    borderInlineEnd: `1px solid ${theme.palette.divider}`,
    [theme.breakpoints.down('md')]: {
      width: '100%',
      borderInlineEnd: 'none',
    },
  },
  filter: {
    padding: theme.spacing(1, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  items: {
    flex: 1,
    overflowY: 'auto',
  },
  item: {
    gap: theme.spacing(1.5),
  },
  chat: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 2),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  hint: {
    margin: 'auto',
    padding: theme.spacing(2),
  },
}));

// Dispatcher view: conversations with the drivers of the company vehicles.
const MessagesPage = () => {
  const { classes } = useStyles();
  const t = useT();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const [searchParams, setSearchParams] = useSearchParams();

  const items = useSelector((state) => state.devices.items);
  const deviceIds = useMemo(() => Object.keys(items).map(Number), [items]);
  const summary = useChatSummary(deviceIds, 10000);
  const [onlyDriven, setOnlyDriven] = useState(false);

  const selectedId = Number(searchParams.get('deviceId')) || null;
  const selected = items[selectedId];

  // Unread first, then the latest conversation, then vehicles with a driver, then by name.
  const rows = useMemo(() => {
    const info = (id) => (summary && !summary.unavailable && summary[id]) || {};
    return Object.values(items)
      .filter((device) => !onlyDriven || info(device.id).driver)
      .map((device) => ({ device, ...info(device.id) }))
      .sort(
        (a, b) =>
          (b.unread || 0) - (a.unread || 0) ||
          (b.last?.time || 0) - (a.last?.time || 0) ||
          Number(Boolean(b.driver)) - Number(Boolean(a.driver)) ||
          a.device.name.localeCompare(b.device.name),
      );
  }, [items, summary, onlyDriven]);

  const select = (deviceId) => setSearchParams(deviceId ? { deviceId } : {}, { replace: true });

  const list = (
    <Paper square elevation={0} className={classes.list}>
      <div className={classes.filter}>
        <FormControlLabel
          control={
            <Switch checked={onlyDriven} onChange={(e) => setOnlyDriven(e.target.checked)} />
          }
          label={t('messagesOnlyDriven')}
        />
      </div>
      {summary?.unavailable && (
        <Alert severity="warning" sx={{ m: 2 }}>
          {t('chatUnavailable')}
        </Alert>
      )}
      <List dense className={classes.items}>
        {rows.map(({ device, driver, last, unread }) => (
          <ListItemButton
            key={device.id}
            className={classes.item}
            selected={device.id === selectedId}
            onClick={() => select(device.id)}
          >
            <StatusDot device={device} />
            <ListItemText
              primary={driver ? `${device.name} · ${driver.userName}` : device.name}
              secondary={
                last
                  ? `${last.senderName}: ${last.text}`
                  : driver
                    ? t('messagesNoMessages')
                    : t('messagesNoDriver')
              }
              slotProps={{ secondary: { noWrap: true } }}
            />
            {last && (
              <Typography variant="caption" color="textSecondary" noWrap>
                {formatRelative(last.time * 1000)}
              </Typography>
            )}
            <Badge color="error" badgeContent={unread || 0} sx={{ ml: 1 }} />
          </ListItemButton>
        ))}
      </List>
    </Paper>
  );

  const chat = selected ? (
    <div className={classes.chat}>
      <div className={classes.chatHeader}>
        {!desktop && (
          <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => select(null)}>
            {t('messagesBack')}
          </Button>
        )}
        <StatusDot device={selected} />
        <Typography variant="subtitle1" fontWeight={600} noWrap>
          {selected.name}
        </Typography>
        {summary?.[selected.id]?.driver && (
          <Typography variant="body2" color="textSecondary" noWrap>
            {`· ${summary[selected.id].driver.userName}`}
          </Typography>
        )}
      </div>
      <ChatPanel deviceId={selected.id} />
    </div>
  ) : (
    <Typography color="textSecondary" className={classes.hint}>
      {t('messagesHint')}
    </Typography>
  );

  if (!desktop) {
    return <div className={classes.root}>{selected ? chat : list}</div>;
  }
  return (
    <div className={classes.root}>
      {list}
      {chat}
    </div>
  );
};

export default MessagesPage;
