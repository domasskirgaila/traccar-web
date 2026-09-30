import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { Card, CardContent, List, ListItemButton, ListItemText, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAsyncTask } from '../../../reactHelper';
import { devicesActions } from '../../../store';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import { formatNotificationTitle } from '../../../common/util/formatter';
import { distanceFromMeters, distanceUnitString } from '../../../common/util/converter';
import StatusDot from '../../common/StatusDot';
import useVehicles from '../../common/useVehicles';
import { formatDistanceShort, formatRelative, isMoving, useUnits } from '../../common/format';
import useT from '../../common/useT';

const useStyles = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(3),
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(2),
    },
  },
  tile: {
    gridColumn: 'span 3',
    [theme.breakpoints.down('md')]: {
      gridColumn: 'span 6',
    },
  },
  wide: {
    gridColumn: 'span 7',
    [theme.breakpoints.down('lg')]: {
      gridColumn: 'span 12',
    },
  },
  narrow: {
    gridColumn: 'span 5',
    [theme.breakpoints.down('lg')]: {
      gridColumn: 'span 12',
    },
  },
  full: {
    gridColumn: 'span 12',
  },
  tileValue: {
    fontSize: '2rem',
    fontWeight: 600,
    lineHeight: 1.2,
  },
  statusBar: {
    display: 'flex',
    gap: 2,
    height: 16,
    marginTop: theme.spacing(2),
  },
  statusSegment: {
    borderRadius: 4,
    minWidth: 4,
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
    marginTop: theme.spacing(1.5),
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  item: {
    gap: theme.spacing(1.5),
  },
}));

const summaryRefresh = 5 * 60 * 1000;
const staleTime = 24 * 60 * 60 * 1000;

const Tile = ({ label, value, hint }) => {
  const { classes } = useStyles();
  return (
    <Card variant="outlined" className={classes.tile}>
      <CardContent>
        <Typography variant="body2" color="textSecondary">
          {label}
        </Typography>
        <Typography className={classes.tileValue}>{value}</Typography>
        {hint && (
          <Typography variant="caption" color="textSecondary">
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

// Company overview for Admins; everything here comes from the live store except today's
// distances, which use the summary report.
const DashboardPage = () => {
  const { classes } = useStyles();
  const t = useT();
  const sharedT = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { distanceUnit } = useUnits();

  const { vehicles, counts } = useVehicles('', 'all');
  const events = useSelector((state) => state.events.items);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Only refetch the report when the set of vehicles changes, not on every position.
  const deviceIdsKey = vehicles.map((vehicle) => vehicle.device.id).join(',');
  const [summary, setSummary] = useState(null);
  const [summaryTick, setSummaryTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setSummaryTick((tick) => tick + 1), summaryRefresh);
    return () => clearInterval(interval);
  }, []);

  useAsyncTask(
    async ({ signal }) => {
      void summaryTick;
      if (!deviceIdsKey) {
        setSummary([]);
        return;
      }
      const query = new URLSearchParams({
        from: dayjs().startOf('day').toISOString(),
        to: dayjs().toISOString(),
      });
      deviceIdsKey.split(',').forEach((id) => query.append('deviceId', id));
      const response = await fetchOrThrow(`/api/reports/summary?${query.toString()}`, {
        headers: { Accept: 'application/json' },
        signal,
      });
      setSummary(await response.json());
    },
    [deviceIdsKey, summaryTick],
  );

  const moving = vehicles.filter((vehicle) => isMoving(vehicle.position)).length;
  const totalDistance = summary?.reduce((sum, item) => sum + (item.distance || 0), 0) ?? null;

  const unitLabel = distanceUnitString(distanceUnit, sharedT);
  const chartData = useMemo(
    () =>
      (summary || [])
        .filter((item) => item.distance > 0)
        .sort((a, b) => b.distance - a.distance)
        .slice(0, 10)
        .map((item) => ({
          name: item.deviceName,
          distance: Math.round(distanceFromMeters(item.distance, distanceUnit)),
        })),
    [summary, distanceUnit],
  );

  const stale = vehicles.filter(
    ({ device }) =>
      device.status !== 'online' &&
      (!device.lastUpdate || now - new Date(device.lastUpdate).getTime() > staleTime),
  );

  const statusSegments = [
    { key: 'online', label: t('statusOnline'), color: theme.palette.success.main },
    { key: 'unknown', label: t('statusUnknown'), color: theme.palette.neutral.main },
    { key: 'offline', label: t('statusOffline'), color: theme.palette.error.main },
  ];

  const openVehicle = (deviceId) => {
    dispatch(devicesActions.selectId(deviceId));
    navigate('/map');
  };

  return (
    <div className={classes.root}>
      <Tile label={t('dashboardVehicles')} value={counts.all} />
      <Tile
        label={t('statusOnline')}
        value={counts.online}
        hint={`${t('statusOffline')}: ${counts.offline + counts.unknown}`}
      />
      <Tile
        label={t('dashboardMoving')}
        value={moving}
        hint={`${t('vehicleStopped')}: ${counts.all - moving}`}
      />
      <Tile
        label={t('dashboardDistanceToday')}
        value={
          totalDistance === null ? '…' : formatDistanceShort(totalDistance, distanceUnit, sharedT)
        }
      />

      <Card variant="outlined" className={classes.wide}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600}>
            {t('dashboardTopDistance')}
          </Typography>
          {chartData.length === 0 ? (
            <Typography color="textSecondary">{t('dashboardNoDistance')}</Typography>
          ) : (
            <ResponsiveContainer width="100%" height={chartData.length * 32 + 40}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid horizontal={false} stroke={theme.palette.divider} />
                <XAxis
                  type="number"
                  tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                  stroke={theme.palette.divider}
                  unit={` ${unitLabel}`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={150}
                  tick={{ fill: theme.palette.text.primary, fontSize: 12 }}
                  stroke={theme.palette.divider}
                />
                <Tooltip
                  cursor={{ fill: theme.palette.action.hover }}
                  formatter={(value) => [`${value} ${unitLabel}`, t('dashboardDistance')]}
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    borderColor: theme.palette.divider,
                    color: theme.palette.text.primary,
                  }}
                />
                <Bar
                  dataKey="distance"
                  fill={theme.palette.primary.main}
                  radius={[0, 4, 4, 0]}
                  barSize={16}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined" className={classes.narrow}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600}>
            {t('dashboardFleetStatus')}
          </Typography>
          <div className={classes.statusBar}>
            {statusSegments
              .filter((segment) => counts[segment.key] > 0)
              .map((segment) => (
                <div
                  key={segment.key}
                  className={classes.statusSegment}
                  style={{ flexGrow: counts[segment.key], backgroundColor: segment.color }}
                  title={`${segment.label}: ${counts[segment.key]}`}
                />
              ))}
          </div>
          <div className={classes.legend}>
            {statusSegments.map((segment) => (
              <span key={segment.key} className={classes.legendItem}>
                <span className={classes.legendSwatch} style={{ backgroundColor: segment.color }} />
                <Typography variant="body2">{`${segment.label} ${counts[segment.key]}`}</Typography>
              </span>
            ))}
          </div>

          <Typography variant="subtitle1" fontWeight={600} sx={{ mt: 3 }}>
            {t('dashboardStale')}
          </Typography>
          {stale.length === 0 ? (
            <Typography color="textSecondary">{t('dashboardStaleNone')}</Typography>
          ) : (
            <List dense disablePadding>
              {stale.map(({ device }) => (
                <ListItemButton
                  key={device.id}
                  className={classes.item}
                  onClick={() => openVehicle(device.id)}
                >
                  <StatusDot device={device} />
                  <ListItemText
                    primary={device.name}
                    secondary={formatRelative(device.lastUpdate) ?? t('installerNever')}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined" className={classes.full}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600}>
            {t('dashboardEvents')}
          </Typography>
          {events.length === 0 ? (
            <Typography color="textSecondary">{t('dashboardEventsNone')}</Typography>
          ) : (
            <List dense disablePadding>
              {events.slice(0, 10).map((event) => (
                <ListItemButton key={event.id} onClick={() => openVehicle(event.deviceId)}>
                  <ListItemText
                    primary={`${vehicles.find((v) => v.device.id === event.deviceId)?.device.name ?? ''} · ${formatNotificationTitle(
                      sharedT,
                      { type: event.type, attributes: { alarms: event.attributes.alarm } },
                    )}`}
                    secondary={formatRelative(event.eventTime)}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;
