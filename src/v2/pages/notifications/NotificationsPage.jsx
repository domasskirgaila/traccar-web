import { useMemo, useReducer, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Button,
  Chip,
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
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAsyncTask, useCatch } from '../../../reactHelper';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import {
  useTranslation,
  useTranslationKeys,
} from '../../../common/components/LocalizationProvider';
import { prefixString } from '../../../common/util/stringUtils';
import ConfirmDialog from '../../common/ConfirmDialog';
import useT from '../../common/useT';
import NotificationDialog from './NotificationDialog';

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
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
  },
  actions: {
    whiteSpace: 'nowrap',
    textAlign: 'end',
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

// Company notifications for Admins: every notification goes to all company users and covers
// either the whole fleet or chosen vehicles.
const NotificationsPage = () => {
  const { classes } = useStyles();
  const t = useT();
  const sharedT = useTranslation();
  const items = useSelector((state) => state.devices.items);

  const alarmKeys = useTranslationKeys((key) => key.startsWith('alarm'));
  const alarmNames = useMemo(
    () =>
      Object.fromEntries(
        alarmKeys.map((key) => [key.charAt(5).toLowerCase() + key.slice(6), sharedT(key)]),
      ),
    [alarmKeys, sharedT],
  );

  const [reloadKey, reload] = useReducer((x) => x + 1, 0);
  const [notifications, setNotifications] = useState(null);
  const [types, setTypes] = useState([]);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);

  useAsyncTask(async ({ signal }) => {
    const response = await fetchOrThrow('/api/notifications/types', { signal });
    setTypes((await response.json()).map((it) => it.type));
  }, []);

  useAsyncTask(
    async ({ signal }) => {
      void reloadKey;
      const response = await fetchOrThrow('/api/notifications', { signal });
      setNotifications(await response.json());
    },
    [reloadKey],
  );

  const handleSave = useCatch(async (item) => {
    const previousDevices = editing.notification?.attributes.v2DeviceIds || [];
    const nextDevices = item.always ? [] : item.attributes.v2DeviceIds || [];
    const body = {
      ...item,
      attributes: { ...item.attributes, v2DeviceIds: nextDevices },
    };
    const response = await fetchOrThrow(
      item.id ? `/api/notifications/${item.id}` : '/api/notifications',
      {
        method: item.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    const saved = await response.json();
    const links = [];
    if (!item.id) {
      // Every company user gets it; the Admin itself is linked by Traccar as the creator.
      const users = await (await fetchOrThrow('/api/users')).json();
      users.forEach((user) =>
        links.push(permission('POST', { userId: user.id, notificationId: saved.id })),
      );
    }
    nextDevices
      .filter((id) => !previousDevices.includes(id))
      .forEach((id) => links.push(permission('POST', { deviceId: id, notificationId: saved.id })));
    previousDevices
      .filter((id) => !nextDevices.includes(id))
      .forEach((id) =>
        links.push(permission('DELETE', { deviceId: id, notificationId: saved.id })),
      );
    await Promise.all(links);
    setEditing(null);
    reload();
  });

  const handleRemove = useCatch(async () => {
    await fetchOrThrow(`/api/notifications/${removing.id}`, { method: 'DELETE' });
    setRemoving(null);
    reload();
  });

  const describeAlarms = (notification) =>
    (notification.attributes.alarms || '')
      .split(',')
      .filter(Boolean)
      .map((alarm) => alarmNames[alarm] || alarm)
      .join(', ');

  return (
    <div className={classes.root}>
      <div className={classes.toolbar}>
        <Typography color="textSecondary" className={classes.grow}>
          {t('notificationsIntro')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setEditing({ notification: null })}
        >
          {t('notificationsNew')}
        </Button>
      </div>

      <Paper variant="outlined" className={classes.table}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('notificationsEvent')}</TableCell>
              <TableCell>{t('notificationsChannels')}</TableCell>
              <TableCell>{t('reportsVehicles')}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {notifications?.map((notification) => {
              const alarmsText = describeAlarms(notification);
              const deviceIds = notification.attributes.v2DeviceIds || [];
              return (
                <TableRow key={notification.id} hover>
                  <TableCell>
                    {sharedT(prefixString('event', notification.type))}
                    {alarmsText && (
                      <Typography variant="caption" color="textSecondary" component="div">
                        {alarmsText}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className={classes.chips}>
                      {(notification.notificators || '')
                        .split(',')
                        .filter(Boolean)
                        .map((channel) => (
                          <Chip key={channel} size="small" label={channel} />
                        ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {notification.always
                      ? t('notificationsAllVehicles')
                      : deviceIds
                          .map((id) => items[id]?.name)
                          .filter(Boolean)
                          .join(', ')}
                  </TableCell>
                  <TableCell className={classes.actions}>
                    <Tooltip title={t('notificationsEdit')}>
                      <IconButton size="small" onClick={() => setEditing({ notification })}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('remove')}>
                      <IconButton size="small" onClick={() => setRemoving(notification)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {notifications && notifications.length === 0 && (
          <Typography className={classes.empty} color="textSecondary">
            {t('notificationsNone')}
          </Typography>
        )}
      </Paper>

      {editing && (
        <NotificationDialog
          notification={editing.notification}
          types={types}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        title={t('notificationsRemoveTitle')}
        confirmLabel={t('remove')}
        danger
        onConfirm={handleRemove}
        onCancel={() => setRemoving(null)}
      >
        <Typography>{removing && sharedT(prefixString('event', removing.type))}</Typography>
      </ConfirmDialog>
    </div>
  );
};

export default NotificationsPage;
