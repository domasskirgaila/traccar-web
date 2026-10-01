import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SensorsIcon from '@mui/icons-material/Sensors';
import CloseIcon from '@mui/icons-material/Close';
import { devicesActions } from '../../../store';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import { useCatch } from '../../../reactHelper';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import { prefixString } from '../../../common/util/stringUtils';
import StatusDot from '../../common/StatusDot';
import VehicleFilters from '../../common/VehicleFilters';
import ConfirmDialog from '../../common/ConfirmDialog';
import useVehicles from '../../common/useVehicles';
import useT from '../../common/useT';
import InstallationForm from '../installer/InstallationForm';
import DeviceTest from '../installer/DeviceTest';
import DeviceEditDialog from './DeviceEditDialog';

const useStyles = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(3),
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'minmax(0, 1fr)',
    alignItems: 'start',
    [theme.breakpoints.up('lg')]: {
      gridTemplateColumns: 'minmax(0, 1fr) 360px',
    },
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(2),
    },
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    minWidth: 0,
  },
  filters: {
    maxWidth: 480,
  },
  table: {
    overflowX: 'auto',
  },
  name: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  actions: {
    whiteSpace: 'nowrap',
    textAlign: 'end',
  },
  dialogTitle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  empty: {
    padding: theme.spacing(2),
  },
}));

// Admin view of the own company's equipment: add, edit, remove and test devices.
const EquipmentPage = () => {
  const { classes } = useStyles();
  const t = useT();
  const sharedT = useTranslation();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.session.user);

  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('all');
  const { vehicles, counts } = useVehicles(keyword, status);

  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [testing, setTesting] = useState(null);

  const handleRemove = useCatch(async () => {
    await fetchOrThrow(`/api/devices/${removing.id}`, { method: 'DELETE' });
    dispatch(devicesActions.remove(removing.id));
    setRemoving(null);
  });

  return (
    <div className={classes.root}>
      <div className={classes.main}>
        <div className={classes.filters}>
          <VehicleFilters
            keyword={keyword}
            onKeywordChange={setKeyword}
            status={status}
            onStatusChange={setStatus}
            counts={counts}
          />
        </div>
        <Paper variant="outlined" className={classes.table}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('vehicleName')}</TableCell>
                <TableCell>{t('vehicleImei')}</TableCell>
                <TableCell>{t('installerTracker')}</TableCell>
                <TableCell>{t('installerCategory')}</TableCell>
                <TableCell>{t('installerPhone')}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {vehicles.map(({ device }) => (
                <TableRow key={device.id} hover>
                  <TableCell>
                    <span className={classes.name}>
                      <StatusDot device={device} />
                      {device.name}
                    </span>
                  </TableCell>
                  <TableCell>{device.uniqueId}</TableCell>
                  <TableCell>{device.model}</TableCell>
                  <TableCell>
                    {device.category && sharedT(prefixString('category', device.category))}
                  </TableCell>
                  <TableCell>{device.phone}</TableCell>
                  <TableCell className={classes.actions}>
                    <Tooltip title={t('equipmentTest')}>
                      <IconButton size="small" onClick={() => setTesting(device)}>
                        <SensorsIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('equipmentEdit')}>
                      <IconButton size="small" onClick={() => setEditing(device)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('remove')}>
                      <IconButton size="small" onClick={() => setRemoving(device)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
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

      <InstallationForm
        company={user}
        title={t('equipmentAdd')}
        onCreated={(device) => {
          dispatch(devicesActions.update([device]));
          setTesting(device);
        }}
      />

      {editing && (
        <DeviceEditDialog
          device={editing}
          onClose={() => setEditing(null)}
          onSaved={(device) => {
            dispatch(devicesActions.update([device]));
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        title={t('equipmentRemoveTitle')}
        confirmLabel={t('remove')}
        danger
        onConfirm={handleRemove}
        onCancel={() => setRemoving(null)}
      >
        <Typography>{removing && `${removing.name} (IMEI ${removing.uniqueId})`}</Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          {t('equipmentRemoveHint')}
        </Typography>
      </ConfirmDialog>

      <Dialog open={Boolean(testing)} onClose={() => setTesting(null)} maxWidth="md" fullWidth>
        <DialogTitle className={classes.dialogTitle}>
          {t('equipmentTest')}
          <IconButton onClick={() => setTesting(null)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>{testing && <DeviceTest deviceId={testing.id} />}</DialogContent>
      </Dialog>
    </div>
  );
};

export default EquipmentPage;
