import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Autocomplete,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  FormLabel,
  MenuItem,
  TextField,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import {
  useTranslation,
  useTranslationKeys,
} from '../../../common/components/LocalizationProvider';
import { prefixString } from '../../../common/util/stringUtils';
import useT from '../../common/useT';

const useStyles = makeStyles()((theme) => ({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: `${theme.spacing(1)} !important`,
  },
}));

export const channels = ['web', 'mail'];
const channelTitleKeys = { web: 'notificationsChannelWeb', mail: 'notificationsChannelMail' };

// notification === null creates a new one. Device scope lives in attributes.v2DeviceIds so it
// can be shown and changed without querying every device.
const NotificationDialog = ({ notification, types, onClose, onSave }) => {
  const { classes } = useStyles();
  const t = useT();
  const sharedT = useTranslation();

  const alarmKeys = useTranslationKeys((key) => key.startsWith('alarm'));
  const alarms = useMemo(
    () =>
      alarmKeys.map((key) => ({
        id: key.charAt(5).toLowerCase() + key.slice(6),
        name: sharedT(key),
      })),
    [alarmKeys, sharedT],
  );

  const items = useSelector((state) => state.devices.items);
  const devices = useMemo(
    () => Object.values(items).sort((a, b) => a.name.localeCompare(b.name)),
    [items],
  );

  const [item, setItem] = useState(
    () => notification || { type: 'alarm', always: true, notificators: 'web', attributes: {} },
  );

  const selectedChannels = (item.notificators || '').split(',').filter(Boolean);
  const selectedAlarms = (item.attributes.alarms || '').split(',').filter(Boolean);
  const deviceIds = item.attributes.v2DeviceIds || [];

  const toggleChannel = (channel) => {
    const next = selectedChannels.includes(channel)
      ? selectedChannels.filter((it) => it !== channel)
      : [...selectedChannels, channel];
    setItem({ ...item, notificators: next.join(',') });
  };

  const valid = selectedChannels.length > 0 && (item.always || deviceIds.length > 0);

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{notification ? t('notificationsEdit') : t('notificationsNew')}</DialogTitle>
      <DialogContent className={classes.content}>
        <TextField
          select
          label={t('notificationsEvent')}
          value={item.type}
          onChange={(e) => setItem({ ...item, type: e.target.value })}
        >
          {types.map((type) => (
            <MenuItem key={type} value={type}>
              {sharedT(prefixString('event', type))}
            </MenuItem>
          ))}
        </TextField>
        {item.type === 'alarm' && (
          <Autocomplete
            multiple
            options={alarms}
            value={alarms.filter((alarm) => selectedAlarms.includes(alarm.id))}
            onChange={(_, value) =>
              setItem({
                ...item,
                attributes: { ...item.attributes, alarms: value.map((it) => it.id).join(',') },
              })
            }
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('notificationsAlarms')}
                placeholder={selectedAlarms.length ? '' : t('notificationsAllAlarms')}
              />
            )}
          />
        )}
        <div>
          <FormLabel component="legend">{t('notificationsChannels')}</FormLabel>
          <FormGroup row>
            {channels.map((channel) => (
              <FormControlLabel
                key={channel}
                control={
                  <Checkbox
                    checked={selectedChannels.includes(channel)}
                    onChange={() => toggleChannel(channel)}
                  />
                }
                label={t(channelTitleKeys[channel])}
              />
            ))}
          </FormGroup>
        </div>
        <FormControlLabel
          control={
            <Checkbox
              checked={item.always}
              onChange={(e) => setItem({ ...item, always: e.target.checked })}
            />
          }
          label={t('notificationsAllVehicles')}
        />
        {!item.always && (
          <Autocomplete
            multiple
            options={devices}
            value={devices.filter((device) => deviceIds.includes(device.id))}
            onChange={(_, value) =>
              setItem({
                ...item,
                attributes: { ...item.attributes, v2DeviceIds: value.map((device) => device.id) },
              })
            }
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField {...params} required label={t('reportsVehicles')} />
            )}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel')}</Button>
        <Button variant="contained" disabled={!valid} onClick={() => onSave(item)}>
          {t('save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NotificationDialog;
