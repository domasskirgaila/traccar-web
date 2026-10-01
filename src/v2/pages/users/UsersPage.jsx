import { useMemo, useReducer, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Button,
  Chip,
  IconButton,
  InputAdornment,
  MenuItem,
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
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddBusinessIcon from '@mui/icons-material/AddBusiness';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { useAsyncTask, useCatch } from '../../../reactHelper';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import ConfirmDialog from '../../common/ConfirmDialog';
import { ADMIN, DRIVER, USER, getRole, isCompany, roleTitleKeys } from '../../common/roles';
import useT from '../../common/useT';
import UserDialog, { deleteUser } from './UserDialog';

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
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    alignItems: 'center',
  },
  search: {
    minWidth: 240,
    flex: '1 1 240px',
    maxWidth: 400,
  },
  filter: {
    minWidth: 220,
  },
  table: {
    overflowX: 'auto',
  },
  actions: {
    whiteSpace: 'nowrap',
    textAlign: 'end',
  },
  empty: {
    padding: theme.spacing(2),
  },
}));

const roleColors = {
  user: 'default',
  driver: 'success',
  admin: 'primary',
  installer: 'warning',
  superadmin: 'error',
};

// SuperAdmin user and role management across all companies.
const UsersPage = () => {
  const { classes } = useStyles();
  const t = useT();
  const currentUserId = useSelector((state) => state.session.user.id);

  const [reloadKey, reload] = useReducer((x) => x + 1, 0);
  const [users, setUsers] = useState(null);
  const [companyOf, setCompanyOf] = useState({});
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState('all');
  const [dialog, setDialog] = useState(null);
  const [removing, setRemoving] = useState(null);

  useAsyncTask(
    async ({ signal }) => {
      void reloadKey;
      const response = await fetchOrThrow('/api/users', { signal });
      const all = await response.json();
      // Which company each User belongs to: the Admins that manage it.
      const companies = all.filter(isCompany);
      const managed = await Promise.all(
        companies.map(async (company) => {
          const managedResponse = await fetchOrThrow(`/api/users?userId=${company.id}`, {
            signal,
          });
          return [company, await managedResponse.json()];
        }),
      );
      const map = {};
      managed.forEach(([company, members]) => {
        members.forEach((member) => {
          if (member.id !== company.id) {
            map[member.id] = company;
          }
        });
      });
      setCompanyOf(map);
      setUsers(all.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    },
    [reloadKey],
  );

  const companies = useMemo(() => (users || []).filter(isCompany), [users]);

  const filtered = useMemo(() => {
    const lowerCaseKeyword = keyword.trim().toLowerCase();
    return (users || []).filter((user) => {
      const role = getRole(user);
      const company = role === ADMIN ? user : companyOf[user.id];
      if (filter === 'admins' && user.administrator !== true) {
        return false;
      }
      if (filter === 'none' && (user.administrator || company)) {
        return false;
      }
      if (filter !== 'all' && filter !== 'admins' && filter !== 'none' && company?.id !== filter) {
        return false;
      }
      return (
        !lowerCaseKeyword ||
        [user.name, user.email, company?.name].some((value) =>
          value?.toLowerCase().includes(lowerCaseKeyword),
        )
      );
    });
  }, [users, companyOf, keyword, filter]);

  const handleRemove = useCatch(async () => {
    if (getRole(removing) === ADMIN) {
      const [membersResponse, devicesResponse] = await Promise.all([
        fetchOrThrow(`/api/users?userId=${removing.id}`),
        fetchOrThrow(`/api/devices?userId=${removing.id}`),
      ]);
      const members = (await membersResponse.json()).filter((it) => it.id !== removing.id);
      if (members.length || (await devicesResponse.json()).length) {
        setRemoving(null);
        throw new Error(t('usersCompanyNotEmpty'));
      }
    }
    await deleteUser(removing.id);
    setRemoving(null);
    reload();
  });

  return (
    <div className={classes.root}>
      <div className={classes.toolbar}>
        <TextField
          className={classes.search}
          placeholder={t('usersSearch')}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          select
          className={classes.filter}
          label={t('installerCompany')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <MenuItem value="all">{t('usersFilterAll')}</MenuItem>
          <MenuItem value="admins">{t('usersFilterAdmins')}</MenuItem>
          <MenuItem value="none">{t('usersFilterNone')}</MenuItem>
          {companies.map((company) => (
            <MenuItem key={company.id} value={company.id}>
              {company.name}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant="contained"
          startIcon={<AddBusinessIcon />}
          onClick={() => setDialog({ user: null, role: ADMIN })}
        >
          {t('usersNewCompany')}
        </Button>
        <Button
          variant="outlined"
          startIcon={<PersonAddIcon />}
          onClick={() =>
            setDialog({
              user: null,
              role: USER,
              company: companies.find((company) => company.id === filter),
            })
          }
        >
          {t('usersNewUser')}
        </Button>
      </div>

      <Paper variant="outlined" className={classes.table}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('usersName')}</TableCell>
              <TableCell>{t('usersEmail')}</TableCell>
              <TableCell>{t('usersRole')}</TableCell>
              <TableCell>{t('installerCompany')}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((user) => {
              const role = getRole(user);
              const company = role === ADMIN ? user : companyOf[user.id];
              const self = user.id === currentUserId;
              return (
                <TableRow key={user.id} hover>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={roleColors[role]}
                      label={t(roleTitleKeys[role])}
                    />
                  </TableCell>
                  <TableCell>{company?.name ?? '—'}</TableCell>
                  <TableCell className={classes.actions}>
                    <Tooltip title={self ? t('usersSelf') : t('usersEdit')}>
                      <span>
                        <IconButton
                          size="small"
                          disabled={self}
                          onClick={() =>
                            setDialog({
                              user,
                              company: role === USER || role === DRIVER ? company : null,
                            })
                          }
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={self ? t('usersSelf') : t('remove')}>
                      <span>
                        <IconButton size="small" disabled={self} onClick={() => setRemoving(user)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {users && filtered.length === 0 && (
          <Typography className={classes.empty} color="textSecondary">
            {t('usersNone')}
          </Typography>
        )}
      </Paper>

      {dialog && (
        <UserDialog
          user={dialog.user}
          initialRole={dialog.role}
          currentCompany={dialog.company}
          companies={companies}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            reload();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        title={t('usersRemoveTitle')}
        confirmLabel={t('remove')}
        danger
        onConfirm={handleRemove}
        onCancel={() => setRemoving(null)}
      >
        <Typography>{removing && `${removing.name} (${removing.email})`}</Typography>
        {removing && getRole(removing) === ADMIN && (
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            {t('usersRemoveCompanyHint')}
          </Typography>
        )}
      </ConfirmDialog>
    </div>
  );
};

export default UsersPage;
