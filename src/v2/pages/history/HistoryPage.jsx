import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Autocomplete,
  CircularProgress,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Slider,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import MapView from '../../../map/core/MapView';
import MapRoutePath from '../../../map/MapRoutePath';
import MapRoutePoints from '../../../map/MapRoutePoints';
import MapPositionMarkers from '../../../map/MapPositionMarkers';
import MapCamera from '../../../map/MapCamera';
import MapGeofence from '../../../map/MapGeofence';
import MapScale from '../../../map/MapScale';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import { useAsyncTask } from '../../../reactHelper';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import { formatDistanceShort, formatSpeedShort, useUnits } from '../../common/format';
import useT from '../../common/useT';
import { useMapImagesReady } from '../../common/mapImages';
import { useVisibleDevices } from '../../common/chat';
import { DRIVER, useRole } from '../../common/roles';
import { periodRange } from '../reports/reportTypes';

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    [theme.breakpoints.down('md')]: {
      flexDirection: 'column',
    },
  },
  sidebar: {
    width: 340,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(2),
    overflowY: 'auto',
    borderInlineEnd: `1px solid ${theme.palette.divider}`,
    [theme.breakpoints.down('md')]: {
      width: '100%',
      maxHeight: '45%',
      borderInlineEnd: 'none',
      borderBottom: `1px solid ${theme.palette.divider}`,
    },
  },
  map: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    position: 'relative',
  },
  player: {
    position: 'absolute',
    insetInline: theme.spacing(2),
    bottom: theme.spacing(4),
    zIndex: 2,
    maxWidth: 760,
    marginInline: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(1, 2),
  },
  playerText: {
    minWidth: 150,
    whiteSpace: 'nowrap',
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing(1),
  },
  stat: {
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.action.hover,
  },
}));

const periods = ['today', 'yesterday', 'thisWeek', 'custom'];
const periodTitleKeys = {
  today: 'periodToday',
  yesterday: 'periodYesterday',
  thisWeek: 'periodThisWeek',
  custom: 'periodCustom',
};
const inputFormat = 'YYYY-MM-DDTHH:mm';

// Route history of one vehicle: trips of the period, the route coloured by speed and playback.
const HistoryPage = () => {
  const { classes } = useStyles();
  const t = useT();
  const sharedT = useTranslation();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const mapImagesLoaded = useMapImagesReady();
  const { speedUnit, distanceUnit } = useUnits();

  const [searchParams, setSearchParams] = useSearchParams();
  const role = useRole();
  const allItems = useSelector((state) => state.devices.items);
  const items = useVisibleDevices(allItems, role === DRIVER);
  const devices = useMemo(
    () => Object.values(items).sort((a, b) => a.name.localeCompare(b.name)),
    [items],
  );
  const device = items[Number(searchParams.get('deviceId'))] || null;
  const deviceId = device?.id;

  const [period, setPeriod] = useState('today');
  const [custom, setCustom] = useState(() => ({
    from: dayjs().startOf('day').format(inputFormat),
    to: dayjs().format(inputFormat),
  }));
  const [trips, setTrips] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [positions, setPositions] = useState(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const range = useMemo(() => {
    const [from, to] = periodRange(period, custom.from, custom.to);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [period, custom]);

  useAsyncTask(
    async ({ signal }) => {
      setTrips(null);
      setSelectedTrip(null);
      if (!deviceId) {
        return;
      }
      const query = new URLSearchParams({ deviceId, ...range });
      const response = await fetchOrThrow(`/api/reports/trips?${query.toString()}`, {
        headers: { Accept: 'application/json' },
        signal,
      });
      setTrips(await response.json());
    },
    [deviceId, range],
  );

  useAsyncTask(
    async ({ signal }) => {
      setPositions(null);
      setIndex(0);
      setPlaying(false);
      if (!deviceId) {
        return;
      }
      const query = new URLSearchParams({
        deviceId,
        from: selectedTrip ? selectedTrip.startTime : range.from,
        to: selectedTrip ? selectedTrip.endTime : range.to,
      });
      const response = await fetchOrThrow(`/api/reports/route?${query.toString()}`, {
        headers: { Accept: 'application/json' },
        signal,
      });
      setPositions(await response.json());
    },
    [deviceId, range, selectedTrip],
  );

  useEffect(() => {
    if (!playing || !positions) {
      return undefined;
    }
    const last = positions.length - 1;
    const interval = setInterval(() => setIndex((current) => Math.min(current + 1, last)), 400);
    return () => clearInterval(interval);
  }, [playing, positions]);

  useEffect(() => {
    if (playing && positions && index >= positions.length - 1) {
      setPlaying(false);
    }
  }, [playing, positions, index]);

  const current = positions?.[index];
  const currentMarker = useMemo(() => (current ? [current] : []), [current]);
  const totalDistance = trips?.reduce((sum, trip) => sum + trip.distance, 0) ?? 0;
  const drivingTime = trips?.reduce((sum, trip) => sum + trip.duration, 0) ?? 0;

  return (
    <div className={classes.root}>
      <Paper square elevation={0} className={classes.sidebar}>
        <Autocomplete
          options={devices}
          value={device}
          onChange={(_, value) =>
            setSearchParams(value ? { deviceId: value.id } : {}, { replace: true })
          }
          getOptionLabel={(option) => option.name}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          renderInput={(params) => <TextField {...params} label={t('commandsVehicle')} />}
        />
        <TextField
          select
          label={t('reportsPeriod')}
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          {periods.map((value) => (
            <MenuItem key={value} value={value}>
              {t(periodTitleKeys[value])}
            </MenuItem>
          ))}
        </TextField>
        {period === 'custom' && (
          <>
            <TextField
              type="datetime-local"
              label={t('reportsFrom')}
              value={custom.from}
              onChange={(e) => setCustom({ ...custom, from: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              type="datetime-local"
              label={t('reportsTo')}
              value={custom.to}
              onChange={(e) => setCustom({ ...custom, to: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </>
        )}
        {!device && <Typography color="textSecondary">{t('historySelectVehicle')}</Typography>}
        {device && trips === null && <CircularProgress size={24} />}
        {device && trips && (
          <>
            <div className={classes.stats}>
              <div className={classes.stat}>
                <Typography variant="caption" color="textSecondary">
                  {t('dashboardDistance')}
                </Typography>
                <Typography fontWeight={600}>
                  {formatDistanceShort(totalDistance, distanceUnit, sharedT)}
                </Typography>
              </div>
              <div className={classes.stat}>
                <Typography variant="caption" color="textSecondary">
                  {t('historyDriving')}
                </Typography>
                <Typography fontWeight={600}>
                  {`${Math.floor(drivingTime / 3600000)} ${sharedT('sharedHourAbbreviation')} ${Math.floor((drivingTime % 3600000) / 60000)} ${sharedT('sharedMinuteAbbreviation')}`}
                </Typography>
              </div>
            </div>
            <Typography variant="subtitle2">{`${t('reportTrips')} (${trips.length})`}</Typography>
            <List dense disablePadding>
              <ListItemButton selected={!selectedTrip} onClick={() => setSelectedTrip(null)}>
                <ListItemText primary={t('historyWholePeriod')} />
              </ListItemButton>
              {trips.map((trip) => (
                <ListItemButton
                  key={trip.startTime}
                  selected={selectedTrip?.startTime === trip.startTime}
                  onClick={() => setSelectedTrip(trip)}
                >
                  <ListItemText
                    primary={`${dayjs(trip.startTime).format('HH:mm')} – ${dayjs(trip.endTime).format('HH:mm')}`}
                    secondary={`${formatDistanceShort(trip.distance, distanceUnit, sharedT)} · ${t('reportMaximumSpeed')} ${formatSpeedShort(trip.maxSpeed, speedUnit, sharedT)}`}
                  />
                </ListItemButton>
              ))}
            </List>
          </>
        )}
      </Paper>
      <div className={classes.map}>
        {mapImagesLoaded && (
          <MapView>
            <MapGeofence />
            {positions && positions.length > 0 && (
              <>
                <MapRoutePath positions={positions} />
                <MapRoutePoints positions={positions} showSpeedControl={desktop} />
                <MapPositionMarkers positions={currentMarker} />
              </>
            )}
          </MapView>
        )}
        <MapScale />
        {positions && positions.length > 0 && <MapCamera positions={positions} />}
        {positions && positions.length > 1 && (
          <Paper elevation={6} className={classes.player}>
            <IconButton onClick={() => setPlaying(!playing)}>
              {playing ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
            <Slider
              size="small"
              min={0}
              max={positions.length - 1}
              value={index}
              onChange={(_, value) => {
                setPlaying(false);
                setIndex(value);
              }}
            />
            <Typography variant="body2" className={classes.playerText}>
              {current &&
                `${dayjs(current.fixTime).format('HH:mm:ss')} · ${formatSpeedShort(current.speed, speedUnit, sharedT)}`}
            </Typography>
          </Paper>
        )}
        {positions && positions.length === 0 && (
          <Paper elevation={6} className={classes.player}>
            <Typography color="textSecondary">{t('reportsEmpty')}</Typography>
          </Paper>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
