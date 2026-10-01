import { useMemo, useReducer, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Autocomplete,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useAsyncTask, useCatch } from '../../../reactHelper';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import { distanceFromMeters, distanceToMeters } from '../../../common/util/converter';
import ConfirmDialog from '../../common/ConfirmDialog';
import StatusDot from '../../common/StatusDot';
import { formatDistanceShort, useUnits } from '../../common/format';
import useT from '../../common/useT';

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
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    flexWrap: 'wrap',
  },
  grow: {
    flex: 1,
    minWidth: 240,
  },
  table: {
    overflowX: 'auto',
  },
  actions: {
    whiteSpace: 'nowrap',
    textAlign: 'end',
  },
  vehicles: {
    padding: theme.spacing(1, 2, 2),
    display: 'grid',
    gap: theme.spacing(1),
  },
  vehicle: {
    display: 'grid',
    gridTemplateColumns: 'auto minmax(120px, 1fr) minmax(120px, 2fr) auto',
    alignItems: 'center',
    gap: theme.spacing(1.5),
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: `${theme.spacing(1)} !important`,
  },
  empty: {
    padding: theme.spacing(2),
  },
}));

// Traccar maintenance types this page offers: the position attribute and how it is measured.
const types = {
  totalDistance: { titleKey: 'maintenanceDistance', unit: 'distance' },
  odometer: { titleKey: 'maintenanceOdometer', unit: 'distance' },
  hours: { titleKey: 'maintenanceHours', unit: 'hours' },
};

const hourMs = 3600000;

const permission = (method, body) =>
  fetch('/api/permissions', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

// Next service is due at start + k * period, the first such value above the current one.
const nextDue = (maintenance, value) => {
  if (value < maintenance.start) {
    return maintenance.start;
  }
  const done = Math.floor((value - maintenance.start) / maintenance.period) + 1;
  return maintenance.start + done * maintenance.period;
};

const MaintenancePage = () => {
  const { classes } = useStyles();
  const t = useT();
  const sharedT = useTranslation();
  const { distanceUnit } = useUnits();

  const items = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);
  const devices = useMemo(
    () => Object.values(items).sort((a, b) => a.name.localeCompare(b.name)),
    [items],
  );

  const [reloadKey, reload] = useReducer((x) => x + 1, 0);
  const [maintenances, setMaintenances] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);

  useAsyncTask(
    async ({ signal }) => {
      void reloadKey;
      const response = await fetchOrThrow('/api/maintenance', { signal });
      setMaintenances(await response.json());
    },
    [reloadKey],
  );

  const toDisplay = (type, value) =>
    types[type]?.unit === 'hours'
      ? Math.round(value / hourMs)
      : Math.round(distanceFromMeters(value, distanceUnit));

  const fromDisplay = (type, value) =>
    types[type]?.unit === 'hours'
      ? Number(value) * hourMs
      : distanceToMeters(Number(value), distanceUnit);

  const formatValue = (type, value) =>
    types[type]?.unit === 'hours'
      ? `${Math.round(value / hourMs)} ${sharedT('sharedHourAbbreviation')}`
      : formatDistanceShort(value, distanceUnit, sharedT);

  const openEditor = (maintenance) =>
    setEditing(
      maintenance
        ? {
            ...maintenance,
            startInput: toDisplay(maintenance.type, maintenance.start),
            periodInput: toDisplay(maintenance.type, maintenance.period),
            deviceIds: maintenance.attributes.v2DeviceIds || [],
          }
        : {
            name: '',
            type: 'totalDistance',
            startInput: 0,
            periodInput: 15000,
            deviceIds: [],
            attributes: {},
          },
    );

  const handleSave = useCatch(async () => {
    const { startInput, periodInput, deviceIds, ...rest } = editing;
    const previous = editing.id ? editing.attributes.v2DeviceIds || [] : [];
    const body = {
      ...rest,
      start: fromDisplay(editing.type, startInput),
      period: fromDisplay(editing.type, periodInput),
      attributes: { ...editing.attributes, v2DeviceIds: deviceIds },
    };
    const response = await fetchOrThrow(
      editing.id ? `/api/maintenance/${editing.id}` : '/api/maintenance',
      {
        method: editing.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    const saved = await response.json();
    const links = [];
    if (!editing.id) {
      // Company users see the service plan and get its maintenance events.
      const users = await (await fetchOrThrow('/api/users')).json();
      users.forEach((user) =>
        links.push(permission('POST', { userId: user.id, maintenanceId: saved.id })),
      );
    }
    deviceIds
      .filter((id) => !previous.includes(id))
      .forEach((id) => links.push(permission('POST', { deviceId: id, maintenanceId: saved.id })));
    previous
      .filter((id) => !deviceIds.includes(id))
      .forEach((id) => links.push(permission('DELETE', { deviceId: id, maintenanceId: saved.id })));
    await Promise.all(links);
    setEditing(null);
    reload();
  });

  const handleRemove = useCatch(async () => {
    await fetchOrThrow(`/api/maintenance/${removing.id}`, { method: 'DELETE' });
    setRemoving(null);
    reload();
  });

  const vehicleRows = (maintenance) =>
    (maintenance.attributes.v2DeviceIds || [])
      .map((id) => items[id])
      .filter(Boolean)
      .map((device) => {
        const value = positions[device.id]?.attributes[maintenance.type];
        if (value === undefined) {
          return { device };
        }
        const due = nextDue(maintenance, value);
        const remaining = due - value;
        return {
          device,
          remaining,
          progress: Math.min(100, Math.max(0, 100 - (remaining / maintenance.period) * 100)),
        };
      })
      .sort((a, b) => (a.remaining ?? Infinity) - (b.remaining ?? Infinity));

  return (
    <div className={classes.root}>
      <div className={classes.toolbar}>
        <Typography color="textSecondary" className={classes.grow}>
          {t('maintenanceIntro')}
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => openEditor(null)}>
          {t('maintenanceNew')}
        </Button>
      </div>

      <Paper variant="outlined" className={classes.table}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>{t('maintenanceName')}</TableCell>
              <TableCell>{t('maintenanceType')}</TableCell>
              <TableCell>{t('maintenancePeriod')}</TableCell>
              <TableCell>{t('maintenanceSoonest')}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {maintenances?.map((maintenance) => {
              const rows = vehicleRows(maintenance);
              const soonest = rows.find((row) => row.remaining !== undefined);
              const open = expanded === maintenance.id;
              return [
                <TableRow key={maintenance.id} hover>
                  <TableCell padding="checkbox">
                    <IconButton
                      size="small"
                      onClick={() => setExpanded(open ? null : maintenance.id)}
                    >
                      {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </TableCell>
                  <TableCell>{maintenance.name}</TableCell>
                  <TableCell>
                    {types[maintenance.type]
                      ? t(types[maintenance.type].titleKey)
                      : maintenance.type}
                  </TableCell>
                  <TableCell>{formatValue(maintenance.type, maintenance.period)}</TableCell>
                  <TableCell>
                    {soonest ? (
                      <Chip
                        size="small"
                        color={soonest.progress > 90 ? 'warning' : 'default'}
                        label={`${soonest.device.name}: ${formatValue(maintenance.type, soonest.remaining)}`}
                      />
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className={classes.actions}>
                    <Tooltip title={t('maintenanceEdit')}>
                      <IconButton size="small" onClick={() => openEditor(maintenance)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('remove')}>
                      <IconButton size="small" onClick={() => setRemoving(maintenance)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>,
                <TableRow key={`${maintenance.id}-vehicles`}>
                  <TableCell colSpan={6} sx={{ p: 0, borderBottom: open ? undefined : 'none' }}>
                    <Collapse in={open} unmountOnExit>
                      <div className={classes.vehicles}>
                        {rows.length === 0 && (
                          <Typography color="textSecondary">
                            {t('maintenanceNoVehicles')}
                          </Typography>
                        )}
                        {rows.map((row) => (
                          <div key={row.device.id} className={classes.vehicle}>
                            <StatusDot device={row.device} />
                            <Typography variant="body2" noWrap>
                              {row.device.name}
                            </Typography>
                            {row.remaining === undefined ? (
                              <Typography variant="body2" color="textSecondary">
                                {t('maintenanceNoValue')}
                              </Typography>
                            ) : (
                              <LinearProgress
                                variant="determinate"
                                value={row.progress}
                                color={row.progress > 90 ? 'warning' : 'primary'}
                              />
                            )}
                            <Typography variant="body2" noWrap>
                              {row.remaining === undefined
                                ? ''
                                : `${t('maintenanceRemaining')} ${formatValue(maintenance.type, row.remaining)}`}
                            </Typography>
                          </div>
                        ))}
                      </div>
                    </Collapse>
                  </TableCell>
                </TableRow>,
              ];
            })}
          </TableBody>
        </Table>
        {maintenances && maintenances.length === 0 && (
          <Typography className={classes.empty} color="textSecondary">
            {t('maintenanceNone')}
          </Typography>
        )}
      </Paper>

      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{editing?.id ? t('maintenanceEdit') : t('maintenanceNew')}</DialogTitle>
        {editing && (
          <DialogContent className={classes.content}>
            <TextField
              required
              label={t('maintenanceName')}
              placeholder={t('maintenanceNameHint')}
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
            <TextField
              select
              label={t('maintenanceType')}
              value={editing.type}
              onChange={(e) => setEditing({ ...editing, type: e.target.value })}
            >
              {Object.entries(types).map(([key, value]) => (
                <MenuItem key={key} value={key}>
                  {t(value.titleKey)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              type="number"
              label={`${t('maintenancePeriod')} (${
                types[editing.type].unit === 'hours'
                  ? sharedT('sharedHourAbbreviation')
                  : distanceUnit
              })`}
              value={editing.periodInput}
              onChange={(e) => setEditing({ ...editing, periodInput: e.target.value })}
            />
            <TextField
              type="number"
              label={t('maintenanceStart')}
              helperText={t('maintenanceStartHint')}
              value={editing.startInput}
              onChange={(e) => setEditing({ ...editing, startInput: e.target.value })}
            />
            <Autocomplete
              multiple
              options={devices}
              value={devices.filter((device) => editing.deviceIds.includes(device.id))}
              onChange={(_, value) =>
                setEditing({ ...editing, deviceIds: value.map((device) => device.id) })
              }
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => <TextField {...params} label={t('reportsVehicles')} />}
            />
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setEditing(null)}>{t('cancel')}</Button>
          <Button
            variant="contained"
            disabled={!editing?.name?.trim() || !(Number(editing?.periodInput) > 0)}
            onClick={handleSave}
          >
            {t('save')}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(removing)}
        title={t('maintenanceRemoveTitle')}
        confirmLabel={t('remove')}
        danger
        onConfirm={handleRemove}
        onCancel={() => setRemoving(null)}
      >
        <Typography>{removing?.name}</Typography>
      </ConfirmDialog>
    </div>
  );
};

export default MaintenancePage;
