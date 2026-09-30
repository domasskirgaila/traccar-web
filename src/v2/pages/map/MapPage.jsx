import { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Fab, Paper, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import ListIcon from '@mui/icons-material/List';
import MapIcon from '@mui/icons-material/Map';
import MapView from '../../../map/core/MapView';
import MapGeofence from '../../../map/MapGeofence';
import MapLiveRoutes from '../../../map/main/MapLiveRoutes';
import MapPositionMarkers from '../../../map/MapPositionMarkers';
import MapDefaultCamera from '../../../map/main/MapDefaultCamera';
import MapSelectedDevice from '../../../map/main/MapSelectedDevice';
import MapScale from '../../../map/MapScale';
import MapCurrentLocation from '../../../map/MapCurrentLocation';
import { devicesActions } from '../../../store';
import usePersistedState from '../../../common/util/usePersistedState';
import useVehicles from '../../common/useVehicles';
import useT from '../../common/useT';
import VehicleList from './VehicleList';
import VehiclePanel from './VehiclePanel';

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    position: 'relative',
  },
  sidebar: {
    width: 340,
    flexShrink: 0,
    borderInlineEnd: `1px solid ${theme.palette.divider}`,
    [theme.breakpoints.down('md')]: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      zIndex: 3,
      border: 'none',
    },
  },
  map: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
  },
  panel: {
    position: 'absolute',
    insetInline: theme.spacing(2),
    bottom: theme.spacing(4),
    zIndex: 2,
    maxWidth: 760,
    marginInline: 'auto',
    [theme.breakpoints.down('md')]: {
      insetInline: theme.spacing(1),
      bottom: theme.spacing(1),
    },
  },
  fab: {
    position: 'absolute',
    insetInlineStart: theme.spacing(2),
    top: theme.spacing(2),
    zIndex: 4,
  },
  fabBottom: {
    top: 'auto',
    bottom: theme.spacing(2),
    insetInlineStart: '50%',
    transform: 'translateX(-50%)',
  },
}));

const MapPage = () => {
  const { classes } = useStyles();
  const t = useT();
  const theme = useTheme();
  const dispatch = useDispatch();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = usePersistedState('v2VehicleStatus', 'all');
  const [listOpen, setListOpen] = useState(false);

  const { vehicles, counts, positions } = useVehicles(keyword, status);

  const selectedId = useSelector((state) => state.devices.selectedId);
  const selectedDevice = useSelector((state) => state.devices.items[selectedId]);
  const selectedPosition = useSelector((state) => state.session.positions[selectedId]);

  const select = useCallback(
    (deviceId) => {
      dispatch(devicesActions.selectId(deviceId));
      setListOpen(false);
    },
    [dispatch],
  );

  const onMarkerClick = useCallback((_, deviceId) => select(deviceId), [select]);

  const deviceIds = useMemo(() => vehicles.map((vehicle) => vehicle.device.id), [vehicles]);

  return (
    <div className={classes.root}>
      {(desktop || listOpen) && (
        <Paper square elevation={0} className={classes.sidebar}>
          <VehicleList
            vehicles={vehicles}
            counts={counts}
            keyword={keyword}
            onKeywordChange={setKeyword}
            status={status}
            onStatusChange={setStatus}
            selectedId={selectedId}
            onSelect={select}
          />
        </Paper>
      )}
      <div className={classes.map}>
        <MapView>
          <MapGeofence />
          <MapLiveRoutes deviceIds={deviceIds} />
          <MapPositionMarkers
            positions={positions}
            onMarkerClick={onMarkerClick}
            selectedPosition={selectedPosition}
            showStatus
          />
          <MapDefaultCamera filteredPositions={positions} />
          <MapSelectedDevice />
        </MapView>
        <MapScale />
        <MapCurrentLocation />
        {selectedDevice && (
          <div className={classes.panel}>
            <VehiclePanel
              device={selectedDevice}
              position={selectedPosition}
              onClose={() => dispatch(devicesActions.selectId(null))}
              onCenter={() => dispatch(devicesActions.selectId(selectedId))}
            />
          </div>
        )}
      </div>
      {!desktop && (
        <Fab
          size="medium"
          color="primary"
          variant="extended"
          className={listOpen ? `${classes.fab} ${classes.fabBottom}` : classes.fab}
          onClick={() => setListOpen(!listOpen)}
        >
          {listOpen ? <MapIcon sx={{ mr: 1 }} /> : <ListIcon sx={{ mr: 1 }} />}
          {listOpen ? t('menuMap') : `${t('menuVehicles')} ${vehicles.length}`}
        </Fab>
      )}
    </div>
  );
};

export default MapPage;
