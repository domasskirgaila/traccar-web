import { useState } from 'react';
import {
  Alert,
  Autocomplete,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import { useAsyncTask, useCatch } from '../../../reactHelper';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import usePositionAttributes from '../../../common/attributes/usePositionAttributes';
import useT from '../../common/useT';
import { buildExpression, modes, parseExpression, rawKeys } from './ioMapping';

const useStyles = makeStyles()((theme) => ({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: `${theme.spacing(1)} !important`,
  },
  row: {
    display: 'flex',
    gap: theme.spacing(2),
  },
  preview: {
    fontFamily: 'monospace',
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.action.hover,
    overflowX: 'auto',
  },
  test: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
  },
  grow: {
    flex: 1,
  },
}));

const modeTitleKeys = {
  input: 'ioModeInput',
  scale: 'ioModeScale',
  expression: 'ioModeExpression',
};
const types = ['boolean', 'number', 'string'];
const typeTitleKeys = { boolean: 'ioTypeBoolean', number: 'ioTypeNumber', string: 'ioTypeString' };

const MappingDialog = ({ mapping, onClose, onSaved }) => {
  const { classes } = useStyles();
  const t = useT();
  const sharedT = useTranslation();
  const positionAttributes = usePositionAttributes(sharedT);

  const [description, setDescription] = useState(mapping?.description || '');
  const [attribute, setAttribute] = useState(mapping?.attribute || '');
  const [type, setType] = useState(mapping?.type || 'boolean');
  const [form, setForm] = useState(() => ({
    source: 'in1',
    invert: false,
    factor: 1,
    offset: 0,
    expression: '',
    ...parseExpression(mapping?.expression || 'in1'),
  }));
  const [devices, setDevices] = useState([]);
  const [testDevice, setTestDevice] = useState(null);
  const [testResult, setTestResult] = useState(null);

  const expression = buildExpression(form);
  const targetOptions = Object.keys(positionAttributes).filter(
    (key) => !positionAttributes[key].property,
  );

  useAsyncTask(async ({ signal }) => {
    const response = await fetchOrThrow('/api/devices?all=true&excludeAttributes=true', {
      signal,
    });
    setDevices((await response.json()).sort((a, b) => a.name.localeCompare(b.name)));
  }, []);

  const body = () => ({ ...mapping, description, attribute, type, expression });

  const handleTest = useCatch(async () => {
    const response = await fetchOrThrow(`/api/attributes/computed/test?deviceId=${testDevice.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body()),
    });
    setTestResult(await response.text());
  });

  const handleSave = useCatch(async () => {
    const response = await fetchOrThrow(
      mapping?.id ? `/api/attributes/computed/${mapping.id}` : '/api/attributes/computed',
      {
        method: mapping?.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body()),
      },
    );
    onSaved(await response.json());
  });

  const update = (key, value) => setForm({ ...form, [key]: value });

  const setMode = (mode) => {
    if (!mode) return;
    setForm({ ...form, mode, expression: form.expression || expression });
    if (mode === 'input') setType('boolean');
    if (mode === 'scale') setType('number');
  };

  const sourceField = (
    <Autocomplete
      freeSolo
      className={classes.grow}
      options={rawKeys}
      value={form.source}
      onInputChange={(_, value) => update('source', value)}
      renderInput={(params) => <TextField {...params} label={t('ioSource')} />}
    />
  );

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{mapping?.id ? t('ioEdit') : t('ioNew')}</DialogTitle>
      <DialogContent className={classes.content}>
        <TextField
          required
          label={t('ioName')}
          helperText={t('ioNameHint')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Autocomplete
          freeSolo
          options={targetOptions}
          value={attribute}
          onInputChange={(_, value) => setAttribute(value)}
          getOptionLabel={(option) =>
            positionAttributes[option] ? `${positionAttributes[option].name} (${option})` : option
          }
          renderInput={(params) => (
            <TextField {...params} required label={t('ioTarget')} helperText={t('ioTargetHint')} />
          )}
        />
        <ToggleButtonGroup exclusive size="small" value={form.mode} onChange={(_, v) => setMode(v)}>
          {modes.map((mode) => (
            <ToggleButton key={mode} value={mode}>
              {t(modeTitleKeys[mode])}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {form.mode === 'input' && (
          <div className={classes.row}>
            {sourceField}
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.invert}
                  onChange={(e) => update('invert', e.target.checked)}
                />
              }
              label={t('ioInvert')}
            />
          </div>
        )}
        {form.mode === 'scale' && (
          <div className={classes.row}>
            {sourceField}
            <TextField
              type="number"
              label={t('ioFactor')}
              value={form.factor}
              onChange={(e) => update('factor', e.target.value)}
            />
            <TextField
              type="number"
              label={t('ioOffset')}
              value={form.offset}
              onChange={(e) => update('offset', e.target.value)}
            />
          </div>
        )}
        {form.mode === 'expression' ? (
          <TextField
            multiline
            minRows={2}
            label={t('ioExpression')}
            helperText={t('ioExpressionHint')}
            value={form.expression}
            onChange={(e) => update('expression', e.target.value)}
          />
        ) : (
          <div>
            <Typography variant="caption" color="textSecondary">
              {t('ioExpression')}
            </Typography>
            <div className={classes.preview}>{expression}</div>
          </div>
        )}
        <TextField
          select
          label={t('ioType')}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {types.map((value) => (
            <MenuItem key={value} value={value}>
              {t(typeTitleKeys[value])}
            </MenuItem>
          ))}
        </TextField>
        <div className={classes.test}>
          <Autocomplete
            className={classes.grow}
            options={devices}
            value={testDevice}
            onChange={(_, value) => {
              setTestDevice(value);
              setTestResult(null);
            }}
            getOptionLabel={(option) => `${option.name} (${option.uniqueId})`}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => <TextField {...params} label={t('ioTestDevice')} />}
          />
          <Button variant="outlined" disabled={!testDevice || !expression} onClick={handleTest}>
            {t('ioTest')}
          </Button>
        </div>
        {testResult !== null && (
          <Alert severity="info">{`${t('ioTestResult')}: ${testResult || '—'}`}</Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel')}</Button>
        <Button
          variant="contained"
          disabled={!description.trim() || !attribute.trim() || !expression}
          onClick={handleSave}
        >
          {t('save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MappingDialog;
