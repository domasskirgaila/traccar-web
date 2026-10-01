import { useReducer, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
import BusinessIcon from '@mui/icons-material/Business';
import BaseCommandView from '../../../settings/components/BaseCommandView';
import { useAsyncTask, useCatch } from '../../../reactHelper';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import { useTranslation } from '../../../common/components/LocalizationProvider';
import { prefixString } from '../../../common/util/stringUtils';
import ConfirmDialog from '../../common/ConfirmDialog';
import useCompanies from '../../common/useCompanies';
import { withNoQueueDefault } from '../../common/commands';
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
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
  },
  actions: {
    whiteSpace: 'nowrap',
    textAlign: 'end',
  },
  code: {
    fontFamily: 'monospace',
  },
  dialogContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: `${theme.spacing(1)} !important`,
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

// A template assigned to a company is linked to its Admin, its users and its devices, exactly
// like the company's own saved commands, so new devices and users pick it up as well.
const companyTargets = async (companyId) => {
  const [usersResponse, devicesResponse] = await Promise.all([
    fetchOrThrow(`/api/users?userId=${companyId}`),
    fetchOrThrow(`/api/devices?userId=${companyId}&excludeAttributes=true`),
  ]);
  const users = await usersResponse.json();
  const devices = await devicesResponse.json();
  return [
    { userId: companyId },
    ...users.filter((user) => user.id !== companyId).map((user) => ({ userId: user.id })),
    ...devices.map((device) => ({ deviceId: device.id })),
  ];
};

const setAssignment = async (commandId, companyId, assigned) => {
  const targets = await companyTargets(companyId);
  await Promise.all(
    targets.map((target) => permission(assigned ? 'POST' : 'DELETE', { ...target, commandId })),
  );
};

// SuperAdmin command templates shared with chosen companies. Marked with attributes.v2Global
// so company Admins see them as read-only.
const CommandTemplatesPage = () => {
  const { classes } = useStyles();
  const t = useT();
  const sharedT = useTranslation();
  const companies = useCompanies();

  const [reloadKey, reload] = useReducer((x) => x + 1, 0);
  const [templates, setTemplates] = useState(null);
  const [assigned, setAssigned] = useState({});
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const [assignValue, setAssignValue] = useState([]);

  useAsyncTask(
    async ({ signal }) => {
      void reloadKey;
      if (!companies) {
        return;
      }
      const response = await fetchOrThrow('/api/commands?all=true', { signal });
      const all = (await response.json()).filter((command) => command.attributes.v2Global);
      const perCompany = await Promise.all(
        companies.map(async (company) => {
          const companyResponse = await fetchOrThrow(`/api/commands?userId=${company.id}`, {
            signal,
          });
          return [company, await companyResponse.json()];
        }),
      );
      const map = {};
      perCompany.forEach(([company, items]) => {
        items.forEach((item) => {
          map[item.id] = [...(map[item.id] || []), company];
        });
      });
      setAssigned(map);
      setTemplates(all.sort((a, b) => a.description.localeCompare(b.description)));
    },
    [companies, reloadKey],
  );

  const handleSave = useCatch(async () => {
    const body = { ...editing, attributes: { ...editing.attributes, v2Global: true } };
    await fetchOrThrow(editing.id ? `/api/commands/${editing.id}` : '/api/commands', {
      method: editing.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setEditing(null);
    reload();
  });

  const handleRemove = useCatch(async () => {
    await fetchOrThrow(`/api/commands/${removing.id}`, { method: 'DELETE' });
    setRemoving(null);
    reload();
  });

  const handleAssign = useCatch(async () => {
    const before = new Set((assigned[assigning.id] || []).map((company) => company.id));
    const after = new Set(assignValue.map((company) => company.id));
    await Promise.all([
      ...[...after]
        .filter((id) => !before.has(id))
        .map((id) => setAssignment(assigning.id, id, true)),
      ...[...before]
        .filter((id) => !after.has(id))
        .map((id) => setAssignment(assigning.id, id, false)),
    ]);
    setAssigning(null);
    reload();
  });

  return (
    <div className={classes.root}>
      <div className={classes.toolbar}>
        <Alert severity="info" className={classes.grow}>
          {t('templatesIntro')}
        </Alert>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setEditing({ description: '', attributes: { noQueue: true } })}
        >
          {t('templatesNew')}
        </Button>
      </div>

      <Paper variant="outlined" className={classes.table}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('commandsDescription')}</TableCell>
              <TableCell>{t('sharedType')}</TableCell>
              <TableCell>{t('installerCommandText')}</TableCell>
              <TableCell>{t('menuCompanies')}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {templates?.map((template) => (
              <TableRow key={template.id} hover>
                <TableCell>{template.description}</TableCell>
                <TableCell>{sharedT(prefixString('command', template.type))}</TableCell>
                <TableCell className={classes.code}>{template.attributes.data ?? ''}</TableCell>
                <TableCell>
                  <div className={classes.chips}>
                    {(assigned[template.id] || []).map((company) => (
                      <Chip key={company.id} size="small" label={company.name} />
                    ))}
                  </div>
                </TableCell>
                <TableCell className={classes.actions}>
                  <Tooltip title={t('ioAssign')}>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setAssigning(template);
                        setAssignValue(assigned[template.id] || []);
                      }}
                    >
                      <BusinessIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('commandsEdit')}>
                    <IconButton size="small" onClick={() => setEditing(template)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('remove')}>
                    <IconButton size="small" onClick={() => setRemoving(template)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {templates && templates.length === 0 && (
          <Typography className={classes.empty} color="textSecondary">
            {t('templatesNone')}
          </Typography>
        )}
      </Paper>

      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{editing?.id ? t('commandsEdit') : t('templatesNew')}</DialogTitle>
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

      <Dialog open={Boolean(assigning)} onClose={() => setAssigning(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{assigning && `${t('ioAssign')}: ${assigning.description}`}</DialogTitle>
        <DialogContent>
          <Autocomplete
            multiple
            sx={{ mt: 1 }}
            options={companies || []}
            value={assignValue}
            onChange={(_, value) => setAssignValue(value)}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => <TextField {...params} label={t('menuCompanies')} />}
          />
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            {t('templatesAssignHint')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssigning(null)}>{t('cancel')}</Button>
          <Button variant="contained" onClick={handleAssign}>
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
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          {t('templatesRemoveHint')}
        </Typography>
      </ConfirmDialog>
    </div>
  );
};

export default CommandTemplatesPage;
