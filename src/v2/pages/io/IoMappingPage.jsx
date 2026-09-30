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
import { useAsyncTask, useCatch } from '../../../reactHelper';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import ConfirmDialog from '../../common/ConfirmDialog';
import useCompanies from '../../common/useCompanies';
import useT from '../../common/useT';
import MappingDialog from './MappingDialog';
import { assignToCompany, unassignFromCompany } from './ioMapping';

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
  code: {
    fontFamily: 'monospace',
    whiteSpace: 'nowrap',
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

// SuperAdmin panel for turning raw device IO into named values, per company.
const IoMappingPage = () => {
  const { classes } = useStyles();
  const t = useT();
  const companies = useCompanies();

  const [reloadKey, reload] = useReducer((x) => x + 1, 0);
  const [mappings, setMappings] = useState(null);
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
      const response = await fetchOrThrow('/api/attributes/computed?all=true', { signal });
      const all = await response.json();
      // A mapping belongs to the companies whose Admin it is linked to.
      const perCompany = await Promise.all(
        companies.map(async (company) => {
          const companyResponse = await fetchOrThrow(
            `/api/attributes/computed?userId=${company.id}`,
            { signal },
          );
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
      setMappings(all.sort((a, b) => a.description.localeCompare(b.description)));
    },
    [companies, reloadKey],
  );

  const handleRemove = useCatch(async () => {
    await fetchOrThrow(`/api/attributes/computed/${removing.id}`, { method: 'DELETE' });
    setRemoving(null);
    reload();
  });

  const openAssign = (mapping) => {
    setAssigning(mapping);
    setAssignValue(assigned[mapping.id] || []);
  };

  const handleAssign = useCatch(async () => {
    const before = new Set((assigned[assigning.id] || []).map((company) => company.id));
    const after = new Set(assignValue.map((company) => company.id));
    await Promise.all([
      ...[...after].filter((id) => !before.has(id)).map((id) => assignToCompany(assigning.id, id)),
      ...[...before]
        .filter((id) => !after.has(id))
        .map((id) => unassignFromCompany(assigning.id, id)),
    ]);
    setAssigning(null);
    reload();
  });

  return (
    <div className={classes.root}>
      <div className={classes.toolbar}>
        <Alert severity="info" className={classes.grow}>
          {t('ioIntro')}
        </Alert>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing({})}>
          {t('ioNew')}
        </Button>
      </div>

      <Paper variant="outlined" className={classes.table}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('ioName')}</TableCell>
              <TableCell>{t('ioTarget')}</TableCell>
              <TableCell>{t('ioExpression')}</TableCell>
              <TableCell>{t('menuCompanies')}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {mappings?.map((mapping) => (
              <TableRow key={mapping.id} hover>
                <TableCell>{mapping.description}</TableCell>
                <TableCell className={classes.code}>{mapping.attribute}</TableCell>
                <TableCell className={classes.code}>{mapping.expression}</TableCell>
                <TableCell>
                  <div className={classes.chips}>
                    {(assigned[mapping.id] || []).map((company) => (
                      <Chip key={company.id} size="small" label={company.name} />
                    ))}
                  </div>
                </TableCell>
                <TableCell className={classes.actions}>
                  <Tooltip title={t('ioAssign')}>
                    <IconButton size="small" onClick={() => openAssign(mapping)}>
                      <BusinessIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('ioEdit')}>
                    <IconButton size="small" onClick={() => setEditing(mapping)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('remove')}>
                    <IconButton size="small" onClick={() => setRemoving(mapping)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {mappings && mappings.length === 0 && (
          <Typography className={classes.empty} color="textSecondary">
            {t('ioNone')}
          </Typography>
        )}
      </Paper>

      {editing && (
        <MappingDialog
          mapping={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}

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
            {t('ioAssignHint')}
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
        title={t('ioRemoveTitle')}
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

export default IoMappingPage;
