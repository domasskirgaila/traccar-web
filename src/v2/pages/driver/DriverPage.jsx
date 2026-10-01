import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import HistoryIcon from '@mui/icons-material/History';
import TerminalIcon from '@mui/icons-material/Terminal';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import LogoutIcon from '@mui/icons-material/Logout';
import MapView from '../../../map/core/MapView';
import MapPositionMarkers from '../../../map/MapPositionMarkers';
import MapCamera from '../../../map/MapCamera';
import MapGeofence from '../../../map/MapGeofence';
import MapScale from '../../../map/MapScale';
import { useAsyncTask, useCatch } from '../../../reactHelper';
import PositionValue from '../../../common/components/PositionValue';
import ChatPanel from '../../common/ChatPanel';
import ConfirmDialog from '../../common/ConfirmDialog';
import StatusDot from '../../common/StatusDot';
import {
  ChatError,
  getAssignment,
  releaseVehicle,
  takeVehicle,
  useChatSummary,
} from '../../common/chat';
import { formatRelative, formatSpeedShort, useUnits } from '../../common/format';
import { useMapImagesReady } from '../../common/mapImages';
import useT from '../../common/useT';

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(2),
    minHeight: 0,
  },
  picker: {
    maxWidth: 560,
    width: '100%',
    marginInline: 'auto',
  },
  header: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1.5),
  },
  title: {
    flex: 1,
    minWidth: 160,
  },
  values: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1.5),
  },
  body: {
    flex: 1,
    minHeight: 0,
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'minmax(0, 3fr) minmax(320px, 2fr)',
  },
  mobileBody: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  panel: {
    minHeight: 320,
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  item: {
    gap: theme.spacing(1.5),
  },
}));

// Driver workspace: pick the one company vehicle being driven, then see it on the map, its
// history and commands, and talk to the dispatchers.
const DriverPage = () => {
  const { classes } = useStyles();
  const t = useT();
  const theme = useTheme();
  const navigate = useNavigate();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const mapImagesLoaded = useMapImagesReady();
  const { speedUnit } = useUnits();

  const items = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);
  const devices = useMemo(
    () => Object.values(items).sort((a, b) => a.name.localeCompare(b.name)),
    [items],
  );

  const [assignment, setAssignment] = useState(undefined);
  const [choosing, setChoosing] = useState(false);
  const [takeover, setTakeover] = useState(null);
  const [tab, setTab] = useState('chat');
  const [unavailable, setUnavailable] = useState(false);

  useAsyncTask(async () => {
    try {
      setAssignment(await getAssignment());
    } catch {
      setUnavailable(true);
      setAssignment(null);
    }
  }, []);

  const picking = choosing || !assignment;
  const summary = useChatSummary(picking ? devices.map((device) => device.id) : [], 20000);

  const choose = useCatch(async (device, force = false) => {
    try {
      setAssignment(await takeVehicle(device.id, force));
      setChoosing(false);
      setTakeover(null);
    } catch (error) {
      if (error instanceof ChatError && error.status === 409) {
        setTakeover({ device, driver: error.body.driver });
      } else {
        throw error;
      }
    }
  });

  const release = useCatch(async () => {
    await releaseVehicle();
    setAssignment(null);
  });

  if (assignment === undefined) {
    return <CircularProgress sx={{ m: 3 }} />;
  }

  if (picking) {
    return (
      <div className={classes.root}>
        <Card variant="outlined" className={classes.picker}>
          <CardContent>
            <Typography variant="h6">{t('driverChoose')}</Typography>
            <Typography variant="body2" color="textSecondary">
              {t('driverChooseHint')}
            </Typography>
            {unavailable && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {t('chatUnavailable')}
              </Alert>
            )}
            <List>
              {devices.map((device) => {
                const driver = summary?.[device.id]?.driver;
                const mine = assignment?.deviceId === device.id;
                return (
                  <ListItemButton
                    key={device.id}
                    className={classes.item}
                    selected={mine}
                    onClick={() => choose(device)}
                  >
                    <StatusDot device={device} />
                    <ListItemText
                      primary={device.name}
                      secondary={formatRelative(device.lastUpdate)}
                    />
                    {driver && !mine && (
                      <Chip size="small" variant="outlined" label={driver.userName} />
                    )}
                    {mine && <Chip size="small" color="primary" label={t('driverMine')} />}
                  </ListItemButton>
                );
              })}
            </List>
            {choosing && <Button onClick={() => setChoosing(false)}>{t('cancel')}</Button>}
          </CardContent>
        </Card>
        <ConfirmDialog
          open={Boolean(takeover)}
          title={t('driverTakeoverTitle')}
          confirmLabel={t('driverTakeover')}
          onConfirm={() => choose(takeover.device, true)}
          onCancel={() => setTakeover(null)}
        >
          <Typography>
            {takeover &&
              `${takeover.device.name}: ${t('driverTakenBy')} ${takeover.driver.userName}`}
          </Typography>
        </ConfirmDialog>
      </div>
    );
  }

  const device = items[assignment.deviceId];
  const position = positions[assignment.deviceId];

  if (!device) {
    return (
      <div className={classes.root}>
        <Alert severity="warning">{t('driverVehicleGone')}</Alert>
        <Button onClick={() => setChoosing(true)}>{t('driverChange')}</Button>
      </div>
    );
  }

  const map = (
    <Paper variant="outlined" className={classes.panel}>
      {mapImagesLoaded && (
        <MapView>
          <MapGeofence />
          {position && <MapPositionMarkers positions={[position]} showStatus />}
        </MapView>
      )}
      <MapScale />
      {position && <MapCamera latitude={position.latitude} longitude={position.longitude} />}
    </Paper>
  );

  const chat = (
    <Paper variant="outlined" className={classes.panel}>
      <ChatPanel deviceId={device.id} />
    </Paper>
  );

  return (
    <div className={classes.root}>
      <Card variant="outlined">
        <CardContent>
          <div className={classes.header}>
            <StatusDot device={device} size={12} />
            <div className={classes.title}>
              <Typography variant="h6" noWrap>
                {device.name}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {`${t('vehicleLastUpdate')}: ${formatRelative(device.lastUpdate) ?? '—'}`}
              </Typography>
            </div>
          </div>
          {position && (
            <div className={classes.values}>
              <Chip label={`${t('speed')}: ${formatSpeedShort(position.speed, speedUnit, t)}`} />
              {position.attributes.ignition !== undefined && (
                <Chip
                  label={`${t('ignition')}: ${t(position.attributes.ignition ? 'ignitionOn' : 'ignitionOff')}`}
                />
              )}
              {position.attributes.fuel !== undefined && (
                <Chip
                  label={
                    <>
                      {`${t('fuel')}: `}
                      <PositionValue position={position} attribute="fuel" />
                    </>
                  }
                />
              )}
            </div>
          )}
          <div className={classes.actions}>
            <Button
              size="small"
              startIcon={<HistoryIcon />}
              onClick={() => navigate(`/history?deviceId=${device.id}`)}
            >
              {t('historyAction')}
            </Button>
            <Button
              size="small"
              startIcon={<TerminalIcon />}
              onClick={() => navigate(`/commands?deviceId=${device.id}`)}
            >
              {t('commandsAction')}
            </Button>
            <Button size="small" startIcon={<SwapHorizIcon />} onClick={() => setChoosing(true)}>
              {t('driverChange')}
            </Button>
            <Button size="small" color="error" startIcon={<LogoutIcon />} onClick={release}>
              {t('driverRelease')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {desktop ? (
        <div className={classes.body}>
          {map}
          {chat}
        </div>
      ) : (
        <div className={classes.mobileBody}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="fullWidth">
            <Tab value="chat" label={t('menuMessages')} />
            <Tab value="map" label={t('menuMap')} />
          </Tabs>
          {tab === 'chat' ? chat : map}
        </div>
      )}
    </div>
  );
};

export default DriverPage;
