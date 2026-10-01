import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MapView from '../../../map/core/MapView';
import MapScale from '../../../map/MapScale';
import MapCurrentLocation from '../../../map/MapCurrentLocation';
import { geofencesActions } from '../../../store';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import { useCatch } from '../../../reactHelper';
import ConfirmDialog from '../../common/ConfirmDialog';
import useT from '../../common/useT';
import GeofenceDraw from './GeofenceDraw';

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    [theme.breakpoints.down('md')]: {
      flexDirection: 'column-reverse',
    },
  },
  sidebar: {
    width: 320,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    borderInlineEnd: `1px solid ${theme.palette.divider}`,
    [theme.breakpoints.down('md')]: {
      width: '100%',
      height: '40%',
      borderInlineEnd: 'none',
      borderTop: `1px solid ${theme.palette.divider}`,
    },
  },
  hint: {
    margin: theme.spacing(2),
  },
  list: {
    flex: 1,
    overflowY: 'auto',
  },
  map: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  empty: {
    padding: theme.spacing(2),
  },
}));

const permission = (method, body) =>
  fetch('/api/permissions', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

// Company geofences for Admins. A geofence is linked to all company users and devices, so
// everyone sees it and geofence events work for every vehicle.
const GeofencesPage = () => {
  const { classes } = useStyles();
  const t = useT();
  const dispatch = useDispatch();

  const items = useSelector((state) => state.geofences.items);
  const geofences = useMemo(
    () => Object.values(items).sort((a, b) => a.name.localeCompare(b.name)),
    [items],
  );

  const [selectedId, setSelectedId] = useState(null);
  const [naming, setNaming] = useState(null);
  const [removing, setRemoving] = useState(null);

  const refresh = async () => {
    const response = await fetchOrThrow('/api/geofences');
    dispatch(geofencesActions.refresh(await response.json()));
  };

  const save = (geofence) =>
    fetchOrThrow(geofence.id ? `/api/geofences/${geofence.id}` : '/api/geofences', {
      method: geofence.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geofence),
    }).then((response) => response.json());

  const handleName = useCatch(async () => {
    const saved = await save({ ...naming, name: naming.name.trim() });
    if (!naming.id) {
      const [users, devices] = await Promise.all([
        fetchOrThrow('/api/users').then((response) => response.json()),
        fetchOrThrow('/api/devices').then((response) => response.json()),
      ]);
      await Promise.all([
        ...users.map((user) => permission('POST', { userId: user.id, geofenceId: saved.id })),
        ...devices.map((device) =>
          permission('POST', { deviceId: device.id, geofenceId: saved.id }),
        ),
      ]);
    }
    setNaming(null);
    setSelectedId(saved.id);
    await refresh();
  });

  const handleShapeChange = useCatch(async (id, area) => {
    await save({ ...items[id], area });
    await refresh();
  });

  const handleRemove = useCatch(async () => {
    await fetchOrThrow(`/api/geofences/${removing.id}`, { method: 'DELETE' });
    setRemoving(null);
    await refresh();
  });

  return (
    <div className={classes.root}>
      <Paper square elevation={0} className={classes.sidebar}>
        <Alert severity="info" className={classes.hint}>
          {t('geofencesHint')}
        </Alert>
        {geofences.length === 0 && (
          <Typography className={classes.empty} color="textSecondary">
            {t('geofencesNone')}
          </Typography>
        )}
        <List dense className={classes.list}>
          {geofences.map((geofence) => (
            <ListItemButton
              key={geofence.id}
              selected={geofence.id === selectedId}
              onClick={() => setSelectedId(geofence.id)}
            >
              <ListItemText primary={geofence.name} secondary={geofence.description} />
              <Tooltip title={t('geofencesRename')}>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setNaming(geofence);
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('remove')}>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRemoving(geofence);
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </ListItemButton>
          ))}
        </List>
      </Paper>
      <div className={classes.map}>
        <MapView>
          <GeofenceDraw
            geofences={geofences}
            selectedId={selectedId}
            onCreate={(area) =>
              setNaming({ name: `${t('geofencesDefaultName')} ${geofences.length + 1}`, area })
            }
            onChange={handleShapeChange}
            onDelete={(id) => setRemoving(items[id])}
          />
        </MapView>
        <MapScale />
        <MapCurrentLocation />
      </div>

      <Dialog open={Boolean(naming)} onClose={() => setNaming(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{naming?.id ? t('geofencesRename') : t('geofencesNew')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            sx={{ mt: 1 }}
            label={t('maintenanceName')}
            value={naming?.name || ''}
            onChange={(e) => setNaming({ ...naming, name: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNaming(null)}>{t('cancel')}</Button>
          <Button variant="contained" disabled={!naming?.name?.trim()} onClick={handleName}>
            {t('save')}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(removing)}
        title={t('geofencesRemoveTitle')}
        confirmLabel={t('remove')}
        danger
        onConfirm={handleRemove}
        onCancel={() => {
          setRemoving(null);
          // The draw control already removed the shape; put it back.
          dispatch(geofencesActions.refresh(Object.values(items)));
        }}
      >
        <Typography>{removing?.name}</Typography>
      </ConfirmDialog>
    </div>
  );
};

export default GeofencesPage;
