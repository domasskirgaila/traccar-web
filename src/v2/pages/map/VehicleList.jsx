import { useEffect, useReducer } from 'react';
import { List } from 'react-window';
import { ListItemButton, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import KeyIcon from '@mui/icons-material/Key';
import StatusDot from '../../common/StatusDot';
import VehicleFilters from '../../common/VehicleFilters';
import { formatRelative, formatSpeedShort, isMoving, useUnits } from '../../common/format';
import useT from '../../common/useT';

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  filters: {
    padding: theme.spacing(2),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  row: {
    gap: theme.spacing(1.5),
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  empty: {
    padding: theme.spacing(2),
  },
}));

const Row = ({ index, style, vehicles, selectedId, onSelect, speedUnit, t, classes }) => {
  const { device, position } = vehicles[index];
  const moving = isMoving(position);
  const ignition = position?.attributes.ignition;

  let secondary;
  if (!position) {
    secondary = t('vehicleNoData');
  } else if (moving) {
    secondary = formatSpeedShort(position.speed, speedUnit, t);
  } else {
    secondary = `${t('vehicleStopped')} · ${formatRelative(device.lastUpdate) ?? ''}`;
  }

  return (
    <ListItemButton
      style={style}
      className={classes.row}
      selected={device.id === selectedId}
      onClick={() => onSelect(device.id)}
    >
      <StatusDot device={device} />
      <div className={classes.text}>
        <Typography variant="body2" noWrap fontWeight={500}>
          {device.name}
        </Typography>
        <Typography variant="caption" color="textSecondary" noWrap component="div">
          {secondary}
        </Typography>
      </div>
      {ignition !== undefined && (
        <KeyIcon fontSize="small" color={ignition ? 'success' : 'disabled'} />
      )}
    </ListItemButton>
  );
};

const VehicleList = ({
  vehicles,
  counts,
  keyword,
  onKeywordChange,
  status,
  onStatusChange,
  selectedId,
  onSelect,
}) => {
  const { classes } = useStyles();
  const t = useT();
  const { speedUnit } = useUnits();

  // Refreshes the "5 min ago" texts.
  const [, forceUpdate] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    const interval = setInterval(forceUpdate, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={classes.root}>
      <div className={classes.filters}>
        <VehicleFilters
          keyword={keyword}
          onKeywordChange={onKeywordChange}
          status={status}
          onStatusChange={onStatusChange}
          counts={counts}
        />
      </div>
      {vehicles.length === 0 ? (
        <Typography className={classes.empty} color="textSecondary">
          {t('vehiclesNone')}
        </Typography>
      ) : (
        <List
          className={classes.list}
          rowComponent={Row}
          rowCount={vehicles.length}
          rowHeight={60}
          rowProps={{ vehicles, selectedId, onSelect, speedUnit, t, classes }}
          overscanCount={5}
        />
      )}
    </div>
  );
};

export default VehicleList;
