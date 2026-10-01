import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { List, ListItemButton, ListItemText, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAsyncTask } from '../../../reactHelper';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import { formatNotificationTitle } from '../../../common/util/formatter';
import { distanceFromMeters, distanceUnitString } from '../../../common/util/converter';
import PositionValue from '../../../common/components/PositionValue';
import StatusDot from '../../common/StatusDot';
import { formatDistanceShort, formatRelative, isMoving } from '../../common/format';

const useStyles = makeStyles()((theme) => ({
  value: {
    fontSize: '2rem',
    fontWeight: 600,
    lineHeight: 1.2,
  },
  statusBar: {
    display: 'flex',
    gap: 2,
    height: 16,
    marginTop: theme.spacing(1),
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
  scroll: {
    maxHeight: 360,
    overflowY: 'auto',
  },
  ioRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(0.75, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  ioName: {
    flex: 1,
    minWidth: 0,
  },
}));

const staleTime = 24 * 60 * 60 * 1000;

const chartColors = (theme) => ({
  grid: theme.palette.divider,
  tick: { fill: theme.palette.text.secondary, fontSize: 12 },
  tooltip: {
    backgroundColor: theme.palette.background.paper,
    borderColor: theme.palette.divider,
    color: theme.palette.text.primary,
  },
});

const Empty = ({ children }) => <Typography color="textSecondary">{children}</Typography>;

const filterVehicles = (vehicles, deviceIds) =>
  deviceIds?.length
    ? vehicles.filter((vehicle) => deviceIds.includes(vehicle.device.id))
    : vehicles;

// ---------------------------------------------------------------- single numbers

export const statMetrics = ['vehicles', 'online', 'offline', 'moving', 'distanceToday'];

export const statTitleKeys = {
  vehicles: 'dashboardVehicles',
  online: 'statusOnline',
  offline: 'statusOffline',
  moving: 'dashboardMoving',
  distanceToday: 'dashboardDistanceToday',
};

const StatWidget = ({ config, data }) => {
  const { classes } = useStyles();
  const { t, sharedT, counts, vehicles, summary, distanceUnit } = data;
  const moving = vehicles.filter((vehicle) => isMoving(vehicle.position)).length;
  const totalDistance = summary?.reduce((sum, item) => sum + (item.distance || 0), 0);

  let value;
  let hint;
  switch (config.metric) {
    case 'online':
      value = counts.online;
      hint = `${t('statusOffline')}: ${counts.offline + counts.unknown}`;
      break;
    case 'offline':
      value = counts.offline + counts.unknown;
      break;
    case 'moving':
      value = moving;
      hint = `${t('vehicleStopped')}: ${counts.all - moving}`;
      break;
    case 'distanceToday':
      value =
        totalDistance === undefined
          ? '…'
          : formatDistanceShort(totalDistance, distanceUnit, sharedT);
      break;
    case 'vehicles':
    default:
      value = counts.all;
      break;
  }
  return (
    <>
      <Typography className={classes.value}>{value}</Typography>
      {hint && (
        <Typography variant="caption" color="textSecondary">
          {hint}
        </Typography>
      )}
    </>
  );
};

// ---------------------------------------------------------------- charts and lists

const TopDistanceWidget = ({ data }) => {
  const theme = useTheme();
  const { t, sharedT, summary, distanceUnit } = data;
  const colors = chartColors(theme);
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
  if (!chartData.length) {
    return <Empty>{t('dashboardNoDistance')}</Empty>;
  }
  return (
    <ResponsiveContainer width="100%" height={chartData.length * 32 + 40}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24 }}>
        <CartesianGrid horizontal={false} stroke={colors.grid} />
        <XAxis type="number" tick={colors.tick} stroke={colors.grid} unit={` ${unitLabel}`} />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          tick={{ ...colors.tick, fill: theme.palette.text.primary }}
          stroke={colors.grid}
        />
        <Tooltip
          cursor={{ fill: theme.palette.action.hover }}
          formatter={(value) => [`${value} ${unitLabel}`, t('dashboardDistance')]}
          contentStyle={colors.tooltip}
        />
        <Bar
          dataKey="distance"
          fill={theme.palette.primary.main}
          radius={[0, 4, 4, 0]}
          barSize={16}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

// Distance per day; a user defined chart: which vehicles and how many days back.
const DistanceHistoryWidget = ({ config, data }) => {
  const theme = useTheme();
  const { t, sharedT, vehicles, distanceUnit } = data;
  const colors = chartColors(theme);
  const unitLabel = distanceUnitString(distanceUnit, sharedT);
  const days = config.days || 7;

  const deviceIdsKey = filterVehicles(vehicles, config.deviceIds)
    .map((vehicle) => vehicle.device.id)
    .join(',');
  const [rows, setRows] = useState(null);

  useAsyncTask(
    async ({ signal }) => {
      if (!deviceIdsKey) {
        setRows([]);
        return;
      }
      const query = new URLSearchParams({
        from: dayjs()
          .subtract(days - 1, 'day')
          .startOf('day')
          .toISOString(),
        to: dayjs().toISOString(),
        daily: true,
      });
      deviceIdsKey.split(',').forEach((id) => query.append('deviceId', id));
      const response = await fetchOrThrow(`/api/reports/summary?${query.toString()}`, {
        headers: { Accept: 'application/json' },
        signal,
      });
      setRows(await response.json());
    },
    [deviceIdsKey, days],
  );

  const chartData = useMemo(() => {
    const byDay = {};
    for (let i = days - 1; i >= 0; i -= 1) {
      byDay[dayjs().subtract(i, 'day').format('YYYY-MM-DD')] = 0;
    }
    (rows || []).forEach((row) => {
      const day = dayjs(row.startTime).format('YYYY-MM-DD');
      if (day in byDay) {
        byDay[day] += row.distance || 0;
      }
    });
    return Object.entries(byDay).map(([day, distance]) => ({
      day: dayjs(day).format('MM-DD'),
      distance: Math.round(distanceFromMeters(distance, distanceUnit)),
    }));
  }, [rows, days, distanceUnit]);

  if (rows === null) {
    return <Empty>…</Empty>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} margin={{ left: 0, right: 8 }}>
        <CartesianGrid vertical={false} stroke={colors.grid} />
        <XAxis dataKey="day" tick={colors.tick} stroke={colors.grid} />
        <YAxis tick={colors.tick} stroke={colors.grid} unit={` ${unitLabel}`} width={72} />
        <Tooltip
          cursor={{ fill: theme.palette.action.hover }}
          formatter={(value) => [`${value} ${unitLabel}`, t('dashboardDistance')]}
          contentStyle={colors.tooltip}
        />
        <Bar dataKey="distance" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

const FleetStatusWidget = ({ data }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const { t, counts } = data;
  const segments = [
    { key: 'online', label: t('statusOnline'), color: theme.palette.success.main },
    { key: 'unknown', label: t('statusUnknown'), color: theme.palette.neutral.main },
    { key: 'offline', label: t('statusOffline'), color: theme.palette.error.main },
  ];
  return (
    <>
      <div className={classes.statusBar}>
        {segments
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
        {segments.map((segment) => (
          <span key={segment.key} className={classes.legendItem}>
            <span className={classes.legendSwatch} style={{ backgroundColor: segment.color }} />
            <Typography variant="body2">{`${segment.label} ${counts[segment.key]}`}</Typography>
          </span>
        ))}
      </div>
    </>
  );
};

const StaleWidget = ({ data }) => {
  const { classes } = useStyles();
  const { t, vehicles, now, openVehicle } = data;
  const stale = vehicles.filter(
    ({ device }) =>
      device.status !== 'online' &&
      (!device.lastUpdate || now - new Date(device.lastUpdate).getTime() > staleTime),
  );
  if (!stale.length) {
    return <Empty>{t('dashboardStaleNone')}</Empty>;
  }
  return (
    <List dense disablePadding className={classes.scroll}>
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
  );
};

const EventsWidget = ({ data }) => {
  const { classes } = useStyles();
  const { t, sharedT, events, vehicles, openVehicle } = data;
  if (!events.length) {
    return <Empty>{t('dashboardEventsNone')}</Empty>;
  }
  return (
    <List dense disablePadding className={classes.scroll}>
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
  );
};

// Live value of one IO / attribute for the chosen vehicles, e.g. fuel, temperature or a door.
const IoValuesWidget = ({ config, data }) => {
  const { classes } = useStyles();
  const { t, vehicles, openVehicle } = data;
  const rows = filterVehicles(vehicles, config.deviceIds).filter(
    ({ position }) => position?.attributes[config.attribute] !== undefined,
  );
  if (!rows.length) {
    return <Empty>{t('widgetIoNone')}</Empty>;
  }
  return (
    <div className={classes.scroll}>
      {rows.map(({ device, position }) => (
        <div key={device.id} className={classes.ioRow}>
          <StatusDot device={device} />
          <Typography
            variant="body2"
            noWrap
            className={classes.ioName}
            onClick={() => openVehicle(device.id)}
            sx={{ cursor: 'pointer' }}
          >
            {device.name}
          </Typography>
          <Typography variant="body2" fontWeight={600} noWrap>
            <PositionValue position={position} attribute={config.attribute} />
          </Typography>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------- catalog

// options: which settings the widget dialog shows for the type.
export const widgetTypes = {
  stat: { titleKey: 'widgetStat', size: 'small', options: ['metric'], component: StatWidget },
  topDistance: {
    titleKey: 'dashboardTopDistance',
    size: 'medium',
    options: [],
    component: TopDistanceWidget,
  },
  distanceHistory: {
    titleKey: 'widgetDistanceHistory',
    size: 'medium',
    options: ['days', 'deviceIds'],
    component: DistanceHistoryWidget,
  },
  fleetStatus: {
    titleKey: 'dashboardFleetStatus',
    size: 'medium',
    options: [],
    component: FleetStatusWidget,
  },
  stale: { titleKey: 'dashboardStale', size: 'medium', options: [], component: StaleWidget },
  events: { titleKey: 'dashboardEvents', size: 'medium', options: [], component: EventsWidget },
  ioValues: {
    titleKey: 'widgetIoValues',
    size: 'small',
    options: ['attribute', 'deviceIds'],
    component: IoValuesWidget,
  },
};

export const defaultLayout = [
  { id: 'vehicles', type: 'stat', metric: 'vehicles', size: 'small' },
  { id: 'online', type: 'stat', metric: 'online', size: 'small' },
  { id: 'moving', type: 'stat', metric: 'moving', size: 'small' },
  { id: 'distanceToday', type: 'stat', metric: 'distanceToday', size: 'small' },
  { id: 'topDistance', type: 'topDistance', size: 'medium' },
  { id: 'distanceHistory', type: 'distanceHistory', days: 7, size: 'medium' },
  { id: 'fleetStatus', type: 'fleetStatus', size: 'medium' },
  { id: 'stale', type: 'stale', size: 'medium' },
  { id: 'events', type: 'events', size: 'large' },
];

export const widgetTitle = (config, t, positionAttributes) => {
  if (config.title) {
    return config.title;
  }
  if (config.type === 'stat') {
    return t(statTitleKeys[config.metric] || 'widgetStat');
  }
  if (config.type === 'ioValues') {
    return positionAttributes[config.attribute]?.name || config.attribute || t('widgetIoValues');
  }
  return t(widgetTypes[config.type]?.titleKey || 'widgetStat');
};
