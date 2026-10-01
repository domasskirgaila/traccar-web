import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Autocomplete,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import DeleteIcon from '@mui/icons-material/Delete';
import { devicesActions, eventsActions } from '../../../store';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import { useAsyncTask, useCatch } from '../../../reactHelper';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import { formatNotificationTitle } from '../../../common/util/formatter';
import { prefixString } from '../../../common/util/stringUtils';
import { formatRelative } from '../../common/format';
import useT from '../../common/useT';
import { periodRange } from '../reports/reportTypes';

const useStyles = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(2),
    },
  },
  filters: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
    alignItems: 'center',
  },
  filter: {
    minWidth: 200,
    flex: '1 1 200px',
    maxWidth: 360,
  },
  table: {
    overflowX: 'auto',
  },
  row: {
    cursor: 'pointer',
  },
  nowrap: {
    whiteSpace: 'nowrap',
  },
  empty: {
    padding: theme.spacing(2),
  },
}));

// Alarms first, then events that usually need attention, then informational ones.
const severity = (event) => {
  switch (event.type) {
    case 'alarm':
    case 'deviceOverspeed':
    case 'deviceFuelDrop':
      return 'error';
    case 'geofenceEnter':
    case 'geofenceExit':
    case 'deviceOffline':
    case 'maintenance':
      return 'warning';
    case 'ignitionOn':
    case 'ignitionOff':
    case 'deviceOnline':
      return 'info';
    default:
      return 'default';
  }
};

const periods = ['today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth'];
const periodTitleKeys = {
  today: 'periodToday',
  yesterday: 'periodYesterday',
  thisWeek: 'periodThisWeek',
  lastWeek: 'periodLastWeek',
  thisMonth: 'periodThisMonth',
};

const EventsPage = () => {
  const { classes } = useStyles();
  const t = useT();
  const sharedT = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const items = useSelector((state) => state.devices.items);
  const liveEvents = useSelector((state) => state.events.items);
  const devices = useMemo(
    () => Object.values(items).sort((a, b) => a.name.localeCompare(b.name)),
    [items],
  );

  const [tab, setTab] = useState('live');
  const [types, setTypes] = useState([]);
  const [filterDevices, setFilterDevices] = useState([]);
  const [type, setType] = useState('allEvents');
  const [period, setPeriod] = useState('today');
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);

  useAsyncTask(async ({ signal }) => {
    const response = await fetchOrThrow('/api/notifications/types', { signal });
    setTypes((await response.json()).map((it) => it.type));
  }, []);

  const title = (event) =>
    formatNotificationTitle(sharedT, {
      type: event.type,
      attributes: { alarms: event.attributes?.alarm },
    });

  const loadHistory = useCatch(async () => {
    const [from, to] = periodRange(period);
    const query = new URLSearchParams({ from: from.toISOString(), to: to.toISOString(), type });
    (filterDevices.length ? filterDevices : devices).forEach((device) =>
      query.append('deviceId', device.id),
    );
    setLoading(true);
    try {
      const response = await fetchOrThrow(`/api/reports/events?${query.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      setHistory((await response.json()).reverse());
    } finally {
      setLoading(false);
    }
  });

  const openVehicle = (deviceId) => {
    dispatch(devicesActions.selectId(deviceId));
    navigate('/map');
  };

  const rows = tab === 'live' ? liveEvents : history || [];

  return (
    <div className={classes.root}>
      <Tabs value={tab} onChange={(_, value) => setTab(value)}>
        <Tab value="live" label={`${t('eventsLive')} (${liveEvents.length})`} />
        <Tab value="history" label={t('eventsHistory')} />
      </Tabs>

      {tab === 'live' ? (
        <div className={classes.filters}>
          <Typography color="textSecondary" sx={{ flex: 1 }}>
            {t('eventsLiveHint')}
          </Typography>
          <Button
            startIcon={<DeleteSweepIcon />}
            disabled={liveEvents.length === 0}
            onClick={() => dispatch(eventsActions.deleteAll())}
          >
            {t('eventsClear')}
          </Button>
        </div>
      ) : (
        <div className={classes.filters}>
          <Autocomplete
            multiple
            className={classes.filter}
            options={devices}
            value={filterDevices}
            onChange={(_, value) => setFilterDevices(value)}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('reportsVehicles')}
                placeholder={filterDevices.length ? '' : t('reportsAllVehicles')}
              />
            )}
          />
          <TextField
            select
            className={classes.filter}
            label={t('sharedType')}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <MenuItem value="allEvents">{sharedT('eventAll')}</MenuItem>
            {types.map((value) => (
              <MenuItem key={value} value={value}>
                {sharedT(prefixString('event', value))}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            className={classes.filter}
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
          <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={loadHistory}>
            {t('eventsShow')}
          </Button>
        </div>
      )}

      {loading ? (
        <CircularProgress size={28} />
      ) : (
        <Paper variant="outlined" className={classes.table}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('eventsTime')}</TableCell>
                <TableCell>{t('vehicleName')}</TableCell>
                <TableCell>{t('eventsEvent')}</TableCell>
                {tab === 'live' && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((event) => (
                <TableRow
                  key={event.id}
                  hover
                  className={classes.row}
                  onClick={() => openVehicle(event.deviceId)}
                >
                  <TableCell className={classes.nowrap}>
                    {tab === 'live'
                      ? formatRelative(event.eventTime)
                      : dayjs(event.eventTime).format('YYYY-MM-DD HH:mm')}
                  </TableCell>
                  <TableCell className={classes.nowrap}>
                    {items[event.deviceId]?.name ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={severity(event)} label={title(event)} />
                  </TableCell>
                  {tab === 'live' && (
                    <TableCell align="right">
                      <Tooltip title={t('remove')}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            dispatch(eventsActions.delete(event));
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rows.length === 0 && (
            <Typography className={classes.empty} color="textSecondary">
              {tab === 'live' || history ? t('eventsNone') : t('eventsHistoryHint')}
            </Typography>
          )}
        </Paper>
      )}
    </div>
  );
};

export default EventsPage;
