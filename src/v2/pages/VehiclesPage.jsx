import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { devicesActions } from '../../store';
import PositionValue from '../../common/components/PositionValue';
import usePersistedState from '../../common/util/usePersistedState';
import StatusDot from '../common/StatusDot';
import VehicleFilters from '../common/VehicleFilters';
import useVehicles from '../common/useVehicles';
import { formatRelative, formatSpeedShort, useUnits } from '../common/format';
import useT from '../common/useT';

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
    maxWidth: 480,
  },
  tableContainer: {
    overflowX: 'auto',
  },
  row: {
    cursor: 'pointer',
  },
  name: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  empty: {
    padding: theme.spacing(2),
  },
}));

// Fleet overview as a table; a row opens the vehicle on the live map.
const VehiclesPage = () => {
  const { classes } = useStyles();
  const t = useT();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { speedUnit } = useUnits();

  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = usePersistedState('v2VehicleStatus', 'all');
  const { vehicles, counts } = useVehicles(keyword, status);

  const openOnMap = (deviceId) => {
    dispatch(devicesActions.selectId(deviceId));
    navigate('/map');
  };

  return (
    <div className={classes.root}>
      <div className={classes.filters}>
        <VehicleFilters
          keyword={keyword}
          onKeywordChange={setKeyword}
          status={status}
          onStatusChange={setStatus}
          counts={counts}
        />
      </div>
      <Paper variant="outlined" className={classes.tableContainer}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('vehicleName')}</TableCell>
              <TableCell>{t('vehicleLastUpdate')}</TableCell>
              <TableCell>{t('speed')}</TableCell>
              <TableCell>{t('ignition')}</TableCell>
              <TableCell>{t('fuel')}</TableCell>
              <TableCell>{t('power')}</TableCell>
              <TableCell>{t('vehicleImei')}</TableCell>
              <TableCell>{t('vehicleModel')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {vehicles.map(({ device, position }) => (
              <TableRow
                key={device.id}
                hover
                className={classes.row}
                onClick={() => openOnMap(device.id)}
              >
                <TableCell>
                  <span className={classes.name}>
                    <StatusDot device={device} />
                    {device.name}
                  </span>
                </TableCell>
                <TableCell>{formatRelative(device.lastUpdate) ?? '—'}</TableCell>
                <TableCell>
                  {position ? formatSpeedShort(position.speed, speedUnit, t) : '—'}
                </TableCell>
                <TableCell>
                  {position?.attributes.ignition === undefined
                    ? '—'
                    : t(position.attributes.ignition ? 'ignitionOn' : 'ignitionOff')}
                </TableCell>
                <TableCell>
                  {position ? <PositionValue position={position} attribute="fuel" /> : '—'}
                </TableCell>
                <TableCell>
                  {position ? <PositionValue position={position} attribute="power" /> : '—'}
                </TableCell>
                <TableCell>{device.uniqueId}</TableCell>
                <TableCell>{device.model}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {vehicles.length === 0 && (
          <Typography className={classes.empty} color="textSecondary">
            {t('vehiclesNone')}
          </Typography>
        )}
      </Paper>
    </div>
  );
};

export default VehiclesPage;
