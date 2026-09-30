import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  distanceFromMeters,
  distanceUnitString,
  speedFromKnots,
  speedUnitString,
} from '../../common/util/converter';
import { useAttributePreference } from '../../common/util/preferences';

dayjs.extend(relativeTime);

// The new UI defaults to metric units when the user or server has not chosen any.
export const useUnits = () => ({
  speedUnit: useAttributePreference('speedUnit', 'kmh'),
  distanceUnit: useAttributePreference('distanceUnit', 'km'),
});

export const formatSpeedShort = (knots, unit, t) =>
  `${Math.round(speedFromKnots(knots, unit))} ${speedUnitString(unit, t)}`;

export const formatDistanceShort = (meters, unit, t) =>
  `${Math.round(distanceFromMeters(meters, unit)).toLocaleString()} ${distanceUnitString(unit, t)}`;

export const formatRelative = (time) => (time ? dayjs(time).fromNow() : null);

// Traccar reports speed in knots; below this a vehicle counts as standing.
export const movingSpeedKnots = 2;

export const isMoving = (position) => Boolean(position) && position.speed > movingSpeedKnots;
