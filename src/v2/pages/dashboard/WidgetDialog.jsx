import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import usePositionAttributes from '../../../common/attributes/usePositionAttributes';
import useT from '../../common/useT';
import { statMetrics, statTitleKeys, widgetTypes } from './widgets';

const useStyles = makeStyles()((theme) => ({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: `${theme.spacing(1)} !important`,
  },
}));

const sizes = ['small', 'medium', 'large'];
const sizeTitleKeys = {
  small: 'widgetSizeSmall',
  medium: 'widgetSizeMedium',
  large: 'widgetSizeLarge',
};
const dayOptions = [7, 14, 30];

// Adds a widget (widget === null) or changes the settings of one.
const WidgetDialog = ({ widget, onClose, onSave }) => {
  const { classes } = useStyles();
  const t = useT();
  const sharedT = useTranslation();
  const positionAttributes = usePositionAttributes(sharedT);

  const items = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);
  const devices = useMemo(
    () => Object.values(items).sort((a, b) => a.name.localeCompare(b.name)),
    [items],
  );
  // Offer the attributes the company's vehicles actually report.
  const attributeOptions = useMemo(() => {
    const keys = new Set();
    Object.values(positions).forEach((position) =>
      Object.keys(position.attributes).forEach((key) => keys.add(key)),
    );
    return [...keys].sort();
  }, [positions]);

  const [config, setConfig] = useState(
    () => widget || { type: 'stat', metric: 'vehicles', size: 'small' },
  );
  const type = widgetTypes[config.type];

  const setType = (value) =>
    setConfig({
      id: config.id,
      type: value,
      size: widgetTypes[value].size,
      metric: value === 'stat' ? 'vehicles' : undefined,
      attribute:
        value === 'ioValues'
          ? attributeOptions.includes('fuel')
            ? 'fuel'
            : attributeOptions[0]
          : undefined,
      days: value === 'distanceHistory' ? 7 : undefined,
    });

  const valid = config.type !== 'ioValues' || Boolean(config.attribute);

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{widget ? t('widgetEdit') : t('widgetAdd')}</DialogTitle>
      <DialogContent className={classes.content}>
        <TextField
          select
          label={t('widgetType')}
          value={config.type}
          onChange={(e) => setType(e.target.value)}
        >
          {Object.entries(widgetTypes).map(([key, value]) => (
            <MenuItem key={key} value={key}>
              {t(value.titleKey)}
            </MenuItem>
          ))}
        </TextField>
        {type.options.includes('metric') && (
          <TextField
            select
            label={t('widgetMetric')}
            value={config.metric}
            onChange={(e) => setConfig({ ...config, metric: e.target.value })}
          >
            {statMetrics.map((metric) => (
              <MenuItem key={metric} value={metric}>
                {t(statTitleKeys[metric])}
              </MenuItem>
            ))}
          </TextField>
        )}
        {type.options.includes('attribute') && (
          <Autocomplete
            freeSolo
            options={attributeOptions}
            value={config.attribute || ''}
            onInputChange={(_, value) => setConfig({ ...config, attribute: value })}
            getOptionLabel={(option) =>
              positionAttributes[option] ? `${positionAttributes[option].name} (${option})` : option
            }
            renderInput={(params) => <TextField {...params} label={t('widgetAttribute')} />}
          />
        )}
        {type.options.includes('days') && (
          <TextField
            select
            label={t('widgetDays')}
            value={config.days || 7}
            onChange={(e) => setConfig({ ...config, days: e.target.value })}
          >
            {dayOptions.map((days) => (
              <MenuItem key={days} value={days}>
                {`${days} ${t('widgetDaysUnit')}`}
              </MenuItem>
            ))}
          </TextField>
        )}
        {type.options.includes('deviceIds') && (
          <Autocomplete
            multiple
            options={devices}
            value={devices.filter((device) => config.deviceIds?.includes(device.id))}
            onChange={(_, value) =>
              setConfig({ ...config, deviceIds: value.map((device) => device.id) })
            }
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('reportsVehicles')}
                placeholder={config.deviceIds?.length ? '' : t('reportsAllVehicles')}
              />
            )}
          />
        )}
        <TextField
          select
          label={t('widgetSize')}
          value={config.size}
          onChange={(e) => setConfig({ ...config, size: e.target.value })}
        >
          {sizes.map((size) => (
            <MenuItem key={size} value={size}>
              {t(sizeTitleKeys[size])}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label={t('widgetTitle')}
          helperText={t('widgetTitleHint')}
          value={config.title || ''}
          onChange={(e) => setConfig({ ...config, title: e.target.value || undefined })}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel')}</Button>
        <Button variant="contained" disabled={!valid} onClick={() => onSave(config)}>
          {t('save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WidgetDialog;
