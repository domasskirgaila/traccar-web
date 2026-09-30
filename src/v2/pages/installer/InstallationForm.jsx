import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Alert,
  Autocomplete,
  Button,
  Card,
  CardContent,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import AddIcon from '@mui/icons-material/Add';
import deviceCategories from '../../../common/util/deviceCategories';
import { prefixString } from '../../../common/util/stringUtils';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import { createCompanyDevice } from '../../common/company';
import useT from '../../common/useT';

const useStyles = makeStyles()((theme) => ({
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    marginTop: theme.spacing(1.5),
  },
}));

const trackerModels = [
  'Teltonika FMB920',
  'Teltonika FMB120',
  'Teltonika FMB140',
  'Teltonika FMC130',
  'Teltonika FMC650',
  'Teltonika FMM130',
];

const emptyDevice = { uniqueId: '', name: '', model: '', category: 'truck', phone: '' };

const InstallationForm = ({ company, onCreated }) => {
  const { classes } = useStyles();
  const t = useT();
  const sharedT = useTranslation();
  const userId = useSelector((state) => state.session.user.id);

  const [item, setItem] = useState(emptyDevice);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const update = (key) => (e) => setItem({ ...item, [key]: e.target.value });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const device = await createCompanyDevice(
        {
          ...item,
          uniqueId: item.uniqueId.trim(),
          name: item.name.trim(),
        },
        company.id,
        userId,
      );
      setItem(emptyDevice);
      onCreated(device);
    } catch (createError) {
      // The IMEI is unique across the whole server, including other companies.
      setError(
        /duplicate|unique/i.test(createError.message)
          ? t('installerDuplicateImei')
          : createError.message,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600}>
          {t('installerNew')}
        </Typography>
        <form className={classes.form} onSubmit={handleSubmit}>
          <TextField
            required
            label="IMEI"
            value={item.uniqueId}
            onChange={update('uniqueId')}
            slotProps={{ htmlInput: { inputMode: 'numeric' } }}
          />
          <TextField
            required
            label={t('installerVehicleName')}
            helperText={t('installerVehicleNameHint')}
            value={item.name}
            onChange={update('name')}
          />
          <Autocomplete
            freeSolo
            options={trackerModels}
            value={item.model}
            onInputChange={(_, value) => setItem({ ...item, model: value })}
            renderInput={(params) => <TextField {...params} label={t('installerTracker')} />}
          />
          <TextField
            select
            label={t('installerCategory')}
            value={item.category}
            onChange={update('category')}
          >
            {deviceCategories.map((category) => (
              <MenuItem key={category} value={category}>
                {sharedT(prefixString('category', category))}
              </MenuItem>
            ))}
          </TextField>
          <TextField label={t('installerPhone')} value={item.phone} onChange={update('phone')} />
          {error && <Alert severity="error">{error}</Alert>}
          <Button
            type="submit"
            variant="contained"
            startIcon={<AddIcon />}
            disabled={saving || !item.uniqueId.trim() || !item.name.trim()}
          >
            {t('installerAdd')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default InstallationForm;
