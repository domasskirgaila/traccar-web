import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import deviceCategories from '../../../common/util/deviceCategories';
import { prefixString } from '../../../common/util/stringUtils';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import { useCatch } from '../../../reactHelper';
import useT from '../../common/useT';

const useStyles = makeStyles()((theme) => ({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: `${theme.spacing(1)} !important`,
  },
}));

// IMEI stays read-only here: changing it means a different tracker, which is a new installation.
const DeviceEditDialog = ({ device, onClose, onSaved }) => {
  const { classes } = useStyles();
  const t = useT();
  const sharedT = useTranslation();

  const [item, setItem] = useState(device);

  const update = (key) => (e) => setItem({ ...item, [key]: e.target.value });

  const handleSave = useCatch(async () => {
    const response = await fetchOrThrow(`/api/devices/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    onSaved(await response.json());
  });

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('equipmentEdit')}</DialogTitle>
      <DialogContent className={classes.content}>
        <TextField label="IMEI" value={item.uniqueId} disabled />
        <TextField
          required
          label={t('installerVehicleName')}
          value={item.name}
          onChange={update('name')}
        />
        <TextField
          label={t('installerTracker')}
          value={item.model || ''}
          onChange={update('model')}
        />
        <TextField
          select
          label={t('installerCategory')}
          value={item.category || 'default'}
          onChange={update('category')}
        >
          {deviceCategories.map((category) => (
            <MenuItem key={category} value={category}>
              {sharedT(prefixString('category', category))}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label={t('installerPhone')}
          value={item.phone || ''}
          onChange={update('phone')}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel')}</Button>
        <Button variant="contained" disabled={!item.name?.trim()} onClick={handleSave}>
          {t('save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeviceEditDialog;
