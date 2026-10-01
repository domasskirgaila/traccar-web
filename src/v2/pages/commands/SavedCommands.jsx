import { useReducer, useState } from 'react';
import {
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import BaseCommandView from '../../../settings/components/BaseCommandView';
import { useAsyncTask, useCatch } from '../../../reactHelper';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import { prefixString } from '../../../common/util/stringUtils';
import ConfirmDialog from '../../common/ConfirmDialog';
import { withNoQueueDefault } from '../../common/commands';
import useT from '../../common/useT';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    alignItems: 'flex-start',
  },
  card: {
    alignSelf: 'stretch',
  },
  empty: {
    padding: theme.spacing(2),
  },
  dialogContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: `${theme.spacing(1)} !important`,
  },
}));

// Every saved command of a company is available to all of its users and devices, the same
// way the company's devices are. Traccar only offers a saved command for a device when the
// command is linked to both the user and the device.
const linkToCompany = async (commandId) => {
  const [usersResponse, devicesResponse] = await Promise.all([
    fetchOrThrow('/api/users'),
    fetchOrThrow('/api/devices'),
  ]);
  const users = await usersResponse.json();
  const devices = await devicesResponse.json();
  const permissions = [
    ...users.map((user) => ({ userId: user.id, commandId })),
    ...devices.map((device) => ({ deviceId: device.id, commandId })),
  ];
  await Promise.all(
    permissions.map((permission) =>
      fetch('/api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(permission),
      }),
    ),
  );
};

const SavedCommands = () => {
  const { classes } = useStyles();
  const t = useT();
  const sharedT = useTranslation();

  const [reloadKey, reload] = useReducer((x) => x + 1, 0);
  const [commands, setCommands] = useState(null);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);

  useAsyncTask(
    async ({ signal }) => {
      void reloadKey;
      const response = await fetchOrThrow('/api/commands', { signal });
      setCommands(await response.json());
    },
    [reloadKey],
  );

  const handleSave = useCatch(async () => {
    const { id } = editing;
    const response = await fetchOrThrow(id ? `/api/commands/${id}` : '/api/commands', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    });
    if (!id) {
      const created = await response.json();
      await linkToCompany(created.id);
    }
    setEditing(null);
    reload();
  });

  const handleRemove = useCatch(async () => {
    await fetchOrThrow(`/api/commands/${removing.id}`, { method: 'DELETE' });
    setRemoving(null);
    reload();
  });

  return (
    <div className={classes.root}>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => setEditing({ description: '', attributes: { noQueue: true } })}
      >
        {t('commandsAdd')}
      </Button>
      <Card variant="outlined" className={classes.card}>
        {commands && commands.length === 0 && (
          <Typography className={classes.empty} color="textSecondary">
            {t('commandsNone')}
          </Typography>
        )}
        <List>
          {commands?.map((command) => (
            <ListItem
              key={command.id}
              secondaryAction={
                // Templates from the SuperAdmin are shared by several companies.
                command.attributes.v2Global ? (
                  <Chip size="small" variant="outlined" label={t('templatesShared')} />
                ) : (
                  <>
                    <IconButton onClick={() => setEditing(command)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton onClick={() => setRemoving(command)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </>
                )
              }
            >
              <ListItemText
                primary={command.description}
                secondary={sharedT(prefixString('command', command.type))}
              />
            </ListItem>
          ))}
        </List>
      </Card>

      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{editing?.id ? t('commandsEdit') : t('commandsAdd')}</DialogTitle>
        {editing && (
          <DialogContent className={classes.dialogContent}>
            <TextField
              label={t('commandsDescription')}
              value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
            />
            <BaseCommandView item={editing} setItem={withNoQueueDefault(setEditing)} />
            <Typography variant="caption" color="textSecondary">
              {t('commandsQueueHint')}
            </Typography>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setEditing(null)}>{t('cancel')}</Button>
          <Button
            variant="contained"
            disabled={!editing?.description || !editing?.type}
            onClick={handleSave}
          >
            {t('save')}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(removing)}
        title={t('commandsRemoveTitle')}
        confirmLabel={t('remove')}
        danger
        onConfirm={handleRemove}
        onCancel={() => setRemoving(null)}
      >
        <Typography>{removing?.description}</Typography>
      </ConfirmDialog>
    </div>
  );
};

export default SavedCommands;
