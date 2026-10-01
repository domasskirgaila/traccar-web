import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import SendIcon from '@mui/icons-material/Send';
import TuneIcon from '@mui/icons-material/Tune';
import BaseCommandView from '../../../settings/components/BaseCommandView';
import { useAsyncTask, useCatch } from '../../../reactHelper';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import { prefixString } from '../../../common/util/stringUtils';
import usePersistedState from '../../../common/util/usePersistedState';
import ConfirmDialog from '../../common/ConfirmDialog';
import { isNotConnectedError, withNoQueueDefault } from '../../common/commands';
import { formatRelative } from '../../common/format';
import useT from '../../common/useT';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  buttons: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1.5),
  },
  commandButton: {
    justifyContent: 'flex-start',
    textAlign: 'start',
  },
  dialogContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: `${theme.spacing(1)} !important`,
  },
}));

const historyLimit = 20;

const statusChips = {
  sent: { color: 'success', key: 'commandStatusSent' },
  queued: { color: 'warning', key: 'commandStatusQueued' },
  failed: { color: 'error', key: 'commandStatusFailed' },
};

const SendCommands = ({ device }) => {
  const { classes } = useStyles();
  const t = useT();
  const sharedT = useTranslation();

  const limitCommands = useSelector(
    (state) =>
      !state.session.user.administrator &&
      (state.session.server.limitCommands || state.session.user.limitCommands),
  );
  const userId = useSelector((state) => state.session.user.id);
  const events = useSelector((state) => state.events.items);
  const results = useMemo(
    () => events.filter((event) => event.type === 'commandResult' && event.deviceId === device.id),
    [events, device.id],
  );

  const [saved, setSaved] = useState(null);
  const [pending, setPending] = useState(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customItem, setCustomItem] = useState({});
  const [history, setHistory] = usePersistedState(`v2CommandHistory-${userId}`, []);

  useAsyncTask(
    async ({ signal }) => {
      setSaved(null);
      const response = await fetchOrThrow(`/api/commands/send?deviceId=${device.id}`, { signal });
      setSaved(await response.json());
    },
    [device.id],
  );

  const commandTitle = (command) =>
    command.description || sharedT(prefixString('command', command.type));

  const send = useCatch(async (command) => {
    setPending(null);
    setCustomOpen(false);
    const entry = {
      id: Date.now(),
      deviceId: device.id,
      title: commandTitle(command),
      time: new Date().toISOString(),
    };
    try {
      const response = await fetchOrThrow('/api/commands/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...command, deviceId: device.id }),
      });
      // Traccar answers 202 when the device is offline and the command waits in a queue.
      entry.status = response.status === 202 ? 'queued' : 'sent';
    } catch (error) {
      entry.status = 'failed';
      entry.error = isNotConnectedError(error) ? t('commandsNotConnected') : error.message;
    }
    setHistory((previous) => [entry, ...previous].slice(0, historyLimit));
  });

  const deviceHistory = history.filter((entry) => entry.deviceId === device.id);

  return (
    <div className={classes.root}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600}>
            {t('commandsAvailable')}
          </Typography>
          {device.status !== 'online' && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              {t('commandsDeviceOffline')}
            </Alert>
          )}
          {saved && saved.length === 0 && (
            <Typography color="textSecondary">{t('commandsNoneForVehicle')}</Typography>
          )}
          <div className={classes.buttons}>
            {saved?.map((command) => (
              <Button
                key={command.id}
                variant="outlined"
                className={classes.commandButton}
                startIcon={<SendIcon />}
                onClick={() => setPending(command)}
              >
                {commandTitle(command)}
              </Button>
            ))}
            {!limitCommands && (
              <Button
                variant="text"
                className={classes.commandButton}
                startIcon={<TuneIcon />}
                onClick={() => {
                  setCustomItem({});
                  setCustomOpen(true);
                }}
              >
                {t('commandsCustom')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600}>
            {t('commandsHistory')}
          </Typography>
          {deviceHistory.length === 0 && results.length === 0 && (
            <Typography color="textSecondary">{t('commandsHistoryEmpty')}</Typography>
          )}
          <List dense disablePadding>
            {results.map((event) => (
              <ListItem key={`result-${event.id}`} disableGutters>
                <ListItemText
                  primary={`${t('commandsResponse')}: ${event.attributes.result ?? ''}`}
                  secondary={formatRelative(event.eventTime)}
                />
              </ListItem>
            ))}
            {deviceHistory.map((entry) => (
              <ListItem
                key={entry.id}
                disableGutters
                secondaryAction={
                  <Chip
                    size="small"
                    color={statusChips[entry.status].color}
                    label={t(statusChips[entry.status].key)}
                  />
                }
              >
                <ListItemText
                  primary={entry.title}
                  secondary={entry.error || formatRelative(entry.time)}
                />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(pending)}
        title={t('commandsConfirmTitle')}
        confirmLabel={t('commandsSend')}
        danger
        onConfirm={() => send(pending)}
        onCancel={() => setPending(null)}
      >
        <Typography>{pending && `${commandTitle(pending)} → ${device.name}`}</Typography>
      </ConfirmDialog>

      <Dialog open={customOpen} onClose={() => setCustomOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{`${t('commandsCustom')} → ${device.name}`}</DialogTitle>
        <DialogContent className={classes.dialogContent}>
          <BaseCommandView
            deviceId={device.id}
            item={customItem}
            setItem={withNoQueueDefault(setCustomItem)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomOpen(false)}>{t('cancel')}</Button>
          <Button
            variant="contained"
            color="error"
            disabled={!customItem.type}
            onClick={() => send(customItem)}
          >
            {t('commandsSend')}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default SendCommands;
