import { useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Alert,
  Autocomplete,
  Button,
  Card,
  CardContent,
  IconButton,
  InputAdornment,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import AddIcon from '@mui/icons-material/Add';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import deviceCategories from '../../../common/util/deviceCategories';
import { prefixString } from '../../../common/util/stringUtils';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import { createCompanyDevice } from '../../common/company';
import useT from '../../common/useT';
import { isValidImei } from '../../common/imei';
import ImeiScanner from './ImeiScanner';

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

const InstallationForm = ({ company, onCreated, title }) => {
  const { classes } = useStyles();
  const t = useT();
  const sharedT = useTranslation();
  const userId = useSelector((state) => state.session.user.id);

  const [item, setItem] = useState(emptyDevice);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

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
          {title || t('installerNew')}
        </Typography>
        <form className={classes.form} onSubmit={handleSubmit}>
          <TextField
            required
            label="IMEI"
            value={item.uniqueId}
            onChange={update('uniqueId')}
            helperText={
              item.uniqueId.trim().length === 15 && !isValidImei(item.uniqueId.trim())
                ? t('scanInvalidHint')
                : undefined
            }
            slotProps={{
              htmlInput: { inputMode: 'numeric' },
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      edge="end"
                      title={t('scanTitle')}
                      onClick={() => setScannerOpen(true)}
                    >
                      <QrCodeScannerIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          <ImeiScanner
            open={scannerOpen}
            onClose={() => setScannerOpen(false)}
            onDetected={(imei) => {
              setScannerOpen(false);
              setItem({ ...item, uniqueId: imei });
            }}
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
