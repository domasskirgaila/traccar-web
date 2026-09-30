import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import SendIcon from '@mui/icons-material/Send';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import usePositionAttributes from '../../../common/attributes/usePositionAttributes';
import PositionValue from '../../../common/components/PositionValue';
import { useCatch } from '../../../reactHelper';
import { isNotConnectedError } from '../../common/commands';
import { formatRelative, formatSpeedShort, useUnits } from '../../common/format';
import useT from '../../common/useT';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  title: {
    flex: 1,
    minWidth: 0,
  },
  checks: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1.5),
  },
  check: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.action.hover,
  },
  io: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    columnGap: theme.spacing(2),
    marginTop: theme.spacing(1),
  },
  ioRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.borderRadius,
    transition: 'background-color 1s',
  },
  ioChanged: {
    backgroundColor: alpha(theme.palette.warning.main, 0.3),
    transition: 'none',
  },
  commandRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    alignItems: 'center',
    marginTop: theme.spacing(1),
  },
  commandInput: {
    flex: 1,
    minWidth: 160,
  },
}));

const refreshInterval = 5000;
const recentFixTime = 5 * 60 * 1000;

// Teltonika SMS/GPRS commands that are handy while installing.
const quickCommands = ['getver', 'getgps', 'getio', 'getinfo', 'getstatus'];

// Inputs, outputs and raw IO elements first, they are what an installer checks.
const ioPattern = /^(in|out|io|adc|din|dout|ain)\d+$/;
const sortAttributes = (a, b) => {
  const aIo = ioPattern.test(a);
  const bIo = ioPattern.test(b);
  if (aIo !== bIo) {
    return aIo ? -1 : 1;
  }
  return a.localeCompare(b, undefined, { numeric: true });
};

const Check = ({ ok, label, value }) => {
  const { classes } = useStyles();
  return (
    <div className={classes.check}>
      {ok ? <CheckCircleIcon color="success" /> : <CancelIcon color="disabled" />}
      <div>
        <Typography variant="caption" color="textSecondary" component="div">
          {label}
        </Typography>
        <Typography variant="body2" fontWeight={600}>
          {value}
        </Typography>
      </div>
    </div>
  );
};

// Live view of one device for installers. Installers do not use the websocket (it would stream
// every device they are linked to), so this polls the single device instead.
const DeviceTest = ({ deviceId }) => {
  const { classes, cx } = useStyles();
  const t = useT();
  const sharedT = useTranslation();
  const positionAttributes = usePositionAttributes(sharedT);
  const { speedUnit } = useUnits();

  const [device, setDevice] = useState(null);
  const [position, setPosition] = useState(null);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  // Attributes that changed in the latest refresh; highlighted until the next one.
  const [changed, setChanged] = useState(() => new Set());
  const [recentFix, setRecentFix] = useState(false);
  const [commandData, setCommandData] = useState('getver');
  const [sent, setSent] = useState([]);

  const previousAttributesRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    previousAttributesRef.current = null;
    startTimeRef.current = new Date(Date.now() - 60 * 60 * 1000);
    setDevice(null);
    setPosition(null);
    setResults([]);
    setChanged(new Set());
    setSent([]);

    const load = async () => {
      try {
        const query = new URLSearchParams({
          deviceId,
          type: 'commandResult',
          from: startTimeRef.current.toISOString(),
          to: new Date().toISOString(),
        });
        const [deviceResponse, positionsResponse, eventsResponse] = await Promise.all([
          fetchOrThrow(`/api/devices/${deviceId}`, { signal }),
          fetchOrThrow(`/api/positions?deviceId=${deviceId}`, { signal }),
          fetchOrThrow(`/api/reports/events?${query.toString()}`, {
            headers: { Accept: 'application/json' },
            signal,
          }),
        ]);
        const latest = (await positionsResponse.json())[0] || null;
        setDevice(await deviceResponse.json());
        setPosition(latest);
        setResults((await eventsResponse.json()).reverse());
        setError(null);

        setRecentFix(
          Boolean(latest) && Date.now() - new Date(latest.fixTime).getTime() < recentFixTime,
        );
        const previous = previousAttributesRef.current;
        const current = latest?.attributes || null;
        setChanged(
          new Set(
            previous && current
              ? Object.keys(current).filter((key) => previous[key] !== current[key])
              : [],
          ),
        );
        previousAttributesRef.current = current;
      } catch (loadError) {
        if (loadError.name !== 'AbortError') {
          setError(loadError.message);
        }
      }
    };

    load();
    const interval = setInterval(load, refreshInterval);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [deviceId]);

  const sendCommand = useCatch(async () => {
    const entry = { id: Date.now(), data: commandData, time: new Date().toISOString() };
    try {
      await fetchOrThrow('/api/commands/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          type: 'custom',
          attributes: { data: commandData, noQueue: true },
        }),
      });
      entry.status = 'sent';
    } catch (sendError) {
      entry.status = 'failed';
      entry.error = isNotConnectedError(sendError) ? t('commandsNotConnected') : sendError.message;
    }
    setSent((current) => [entry, ...current].slice(0, 10));
  });

  if (!device) {
    return error ? <Alert severity="error">{error}</Alert> : <CircularProgress size={24} />;
  }

  const attributes = position?.attributes || {};
  const online = device.status === 'online';

  return (
    <div className={classes.root}>
      {error && <Alert severity="warning">{error}</Alert>}
      <Card variant="outlined">
        <CardContent>
          <div className={classes.header}>
            <div className={classes.title}>
              <Typography variant="h6" noWrap>
                {device.name}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {`IMEI ${device.uniqueId}${device.model ? ` · ${device.model}` : ''}`}
              </Typography>
            </div>
            {!online && <CircularProgress size={18} />}
            <Chip
              size="small"
              color={online ? 'success' : 'default'}
              label={online ? t('statusOnline') : t('installerWaiting')}
            />
          </div>
          <div className={classes.checks}>
            <Check
              ok={online}
              label={t('installerConnection')}
              value={formatRelative(device.lastUpdate) ?? t('installerNever')}
            />
            <Check
              ok={Boolean(position?.valid && recentFix)}
              label="GPS"
              value={
                attributes.sat !== undefined ? `${attributes.sat} ${t('installerSatellites')}` : '—'
              }
            />
            <Check
              ok={attributes.rssi !== undefined}
              label="GSM"
              value={attributes.rssi !== undefined ? `${attributes.rssi} / 5` : '—'}
            />
            <Check
              ok={attributes.ignition !== undefined}
              label={t('ignition')}
              value={
                attributes.ignition === undefined
                  ? '—'
                  : t(attributes.ignition ? 'ignitionOn' : 'ignitionOff')
              }
            />
            <Check
              ok={attributes.power !== undefined}
              label={t('power')}
              value={
                attributes.power !== undefined ? (
                  <PositionValue position={position} attribute="power" />
                ) : (
                  '—'
                )
              }
            />
            <Check
              ok={Boolean(position)}
              label={t('speed')}
              value={position ? formatSpeedShort(position.speed, speedUnit, t) : '—'}
            />
          </div>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600}>
            {t('installerIo')}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            {position
              ? `${t('installerIoHint')} · ${formatRelative(position.fixTime)}`
              : t('vehicleNoData')}
          </Typography>
          {position && (
            <div className={classes.io}>
              {Object.keys(attributes)
                .sort(sortAttributes)
                .map((key) => (
                  <div
                    key={key}
                    className={cx(classes.ioRow, changed.has(key) && classes.ioChanged)}
                  >
                    <Typography variant="body2" color="textSecondary" noWrap>
                      {positionAttributes[key]?.name || key}
                    </Typography>
                    <Typography variant="body2" fontWeight={500} noWrap>
                      <PositionValue position={position} attribute={key} />
                    </Typography>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600}>
            {t('installerTestCommand')}
          </Typography>
          <div className={classes.commandRow}>
            {quickCommands.map((data) => (
              <Chip
                key={data}
                label={data}
                size="small"
                variant={data === commandData ? 'filled' : 'outlined'}
                onClick={() => setCommandData(data)}
              />
            ))}
          </div>
          <div className={classes.commandRow}>
            <TextField
              className={classes.commandInput}
              value={commandData}
              onChange={(e) => setCommandData(e.target.value)}
              label={t('installerCommandText')}
            />
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              disabled={!commandData}
              onClick={sendCommand}
            >
              {t('commandsSend')}
            </Button>
          </div>
          <List dense disablePadding>
            {results.map((event) => (
              <ListItem key={`result-${event.id}`} disableGutters>
                <ListItemText
                  primary={`${t('commandsResponse')}: ${event.attributes.result ?? ''}`}
                  secondary={formatRelative(event.eventTime)}
                />
              </ListItem>
            ))}
            {sent.map((entry) => (
              <ListItem
                key={entry.id}
                disableGutters
                secondaryAction={
                  <Chip
                    size="small"
                    color={entry.status === 'sent' ? 'success' : 'error'}
                    label={t(entry.status === 'sent' ? 'commandStatusSent' : 'commandStatusFailed')}
                  />
                }
              >
                <ListItemText
                  primary={entry.data}
                  secondary={entry.error || formatRelative(entry.time)}
                />
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>
    </div>
  );
};

export default DeviceTest;
