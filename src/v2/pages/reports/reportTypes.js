import dayjs from 'dayjs';
import { formatNotificationTitle } from '../../../common/util/formatter';
import { formatDistanceShort, formatSpeedShort } from '../../common/format';

const formatDateTime = (value) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '');

const formatDuration = (milliseconds, t) => {
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor((milliseconds % 3600000) / 60000);
  return `${hours} ${t('sharedHourAbbreviation')} ${minutes} ${t('sharedMinuteAbbreviation')}`;
};

const formatAddress = (address, latitude, longitude) =>
  address || (latitude != null ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : '');

const device = {
  key: 'device',
  titleKey: 'vehicleName',
  format: (item, { devices }) => item.deviceName || devices[item.deviceId]?.name || '',
};

// Each column formats a value for both the table and the Excel export.
// ctx = { t, speedUnit, distanceUnit, devices }
const reportTypes = [
  {
    key: 'trips',
    titleKey: 'reportTrips',
    columns: [
      device,
      { key: 'startTime', titleKey: 'reportStartTime', format: (i) => formatDateTime(i.startTime) },
      {
        key: 'startAddress',
        titleKey: 'reportStartAddress',
        format: (i) => formatAddress(i.startAddress, i.startLat, i.startLon),
      },
      { key: 'endTime', titleKey: 'reportEndTime', format: (i) => formatDateTime(i.endTime) },
      {
        key: 'endAddress',
        titleKey: 'reportEndAddress',
        format: (i) => formatAddress(i.endAddress, i.endLat, i.endLon),
      },
      {
        key: 'distance',
        titleKey: 'dashboardDistance',
        format: (i, c) => formatDistanceShort(i.distance, c.distanceUnit, c.t),
      },
      {
        key: 'duration',
        titleKey: 'reportDuration',
        format: (i, c) => formatDuration(i.duration, c.t),
      },
      {
        key: 'maxSpeed',
        titleKey: 'reportMaximumSpeed',
        format: (i, c) => formatSpeedShort(i.maxSpeed, c.speedUnit, c.t),
      },
    ],
  },
  {
    key: 'stops',
    titleKey: 'reportStops',
    columns: [
      device,
      { key: 'startTime', titleKey: 'reportStartTime', format: (i) => formatDateTime(i.startTime) },
      { key: 'endTime', titleKey: 'reportEndTime', format: (i) => formatDateTime(i.endTime) },
      {
        key: 'duration',
        titleKey: 'reportDuration',
        format: (i, c) => formatDuration(i.duration, c.t),
      },
      {
        key: 'address',
        titleKey: 'positionAddress',
        format: (i) => formatAddress(i.address, i.latitude, i.longitude),
      },
    ],
  },
  {
    key: 'summary',
    titleKey: 'reportSummary',
    columns: [
      device,
      {
        key: 'distance',
        titleKey: 'dashboardDistance',
        format: (i, c) => formatDistanceShort(i.distance, c.distanceUnit, c.t),
      },
      {
        key: 'averageSpeed',
        titleKey: 'reportAverageSpeed',
        format: (i, c) => formatSpeedShort(i.averageSpeed, c.speedUnit, c.t),
      },
      {
        key: 'maxSpeed',
        titleKey: 'reportMaximumSpeed',
        format: (i, c) => formatSpeedShort(i.maxSpeed, c.speedUnit, c.t),
      },
      {
        key: 'engineHours',
        titleKey: 'reportEngineHours',
        format: (i, c) => formatDuration(i.engineHours, c.t),
      },
    ],
  },
  {
    key: 'events',
    titleKey: 'reportEvents',
    query: { type: 'allEvents' },
    columns: [
      device,
      { key: 'eventTime', titleKey: 'reportStartTime', format: (i) => formatDateTime(i.eventTime) },
      {
        key: 'type',
        titleKey: 'sharedType',
        format: (i, c) =>
          formatNotificationTitle(c.t, {
            type: i.type,
            attributes: { alarms: i.attributes?.alarm },
          }),
      },
    ],
  },
  {
    key: 'route',
    titleKey: 'reportRoute',
    columns: [
      device,
      { key: 'fixTime', titleKey: 'positionFixTime', format: (i) => formatDateTime(i.fixTime) },
      {
        key: 'speed',
        titleKey: 'speed',
        format: (i, c) => formatSpeedShort(i.speed, c.speedUnit, c.t),
      },
      {
        key: 'position',
        titleKey: 'positionAddress',
        format: (i) => formatAddress(i.address, i.latitude, i.longitude),
      },
    ],
  },
];

export const reportTypeMap = Object.fromEntries(reportTypes.map((type) => [type.key, type]));

export const periods = [
  'today',
  'yesterday',
  'thisWeek',
  'lastWeek',
  'thisMonth',
  'lastMonth',
  'custom',
];

export const periodRange = (period, customFrom, customTo) => {
  const now = dayjs();
  switch (period) {
    case 'yesterday':
      return [now.subtract(1, 'day').startOf('day'), now.subtract(1, 'day').endOf('day')];
    case 'thisWeek':
      return [now.startOf('week'), now];
    case 'lastWeek':
      return [now.subtract(1, 'week').startOf('week'), now.subtract(1, 'week').endOf('week')];
    case 'thisMonth':
      return [now.startOf('month'), now];
    case 'lastMonth':
      return [now.subtract(1, 'month').startOf('month'), now.subtract(1, 'month').endOf('month')];
    case 'custom':
      return [dayjs(customFrom), dayjs(customTo)];
    case 'today':
    default:
      return [now.startOf('day'), now];
  }
};

export default reportTypes;
