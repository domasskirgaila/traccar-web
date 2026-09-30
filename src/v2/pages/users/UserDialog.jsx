import { useState } from 'react';
import {
  Alert,
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
import { ADMIN, INSTALLER, SUPERADMIN, USER, getRole, roleTitleKeys } from '../../common/roles';
import { RoleChangeError, changeRole, createUser } from '../../common/userRoles';
import fetchOrThrow from '../../../common/util/fetchOrThrow';
import useT from '../../common/useT';

const useStyles = makeStyles()((theme) => ({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    paddingTop: `${theme.spacing(1)} !important`,
  },
}));

const roles = [USER, ADMIN, INSTALLER, SUPERADMIN];

// Creates a user or company (user === null) or edits an existing one.
// A User always belongs to a company; an Admin is a company of its own.
const UserDialog = ({ user, initialRole, currentCompany, companies, onClose, onSaved }) => {
  const { classes } = useStyles();
  const t = useT();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(() => (user ? getRole(user) : initialRole));
  const [company, setCompany] = useState(currentCompany || null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const isNew = !user;
  const needsCompany = role === USER;
  const escalates = (role === INSTALLER || role === SUPERADMIN) && getRole(user) !== role;
  const valid = name.trim() && email.trim() && (!isNew || password) && (!needsCompany || company);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      let saved;
      if (isNew) {
        saved = await createUser(
          { name: name.trim(), email: email.trim(), password },
          role,
          company?.id,
        );
      } else {
        const details = { ...user, name: name.trim(), email: email.trim() };
        if (password) {
          details.password = password;
        }
        saved = await changeRole(details, role, {
          companyId: company?.id,
          currentCompanyId: currentCompany?.id,
        });
      }
      onSaved(saved);
    } catch (saveError) {
      setError(saveError instanceof RoleChangeError ? t(saveError.message) : saveError.message);
    } finally {
      setSaving(false);
    }
  };

  let title = t('usersEdit');
  if (isNew) {
    title = initialRole === ADMIN ? t('usersNewCompany') : t('usersNewUser');
  }

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent className={classes.content}>
        <TextField
          required
          label={role === ADMIN ? t('usersCompanyName') : t('usersName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          required
          type="email"
          label={t('usersEmail')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          required={isNew}
          type="password"
          autoComplete="new-password"
          label={isNew ? t('usersPassword') : t('usersNewPassword')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <TextField
          select
          label={t('usersRole')}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          {roles.map((value) => (
            <MenuItem key={value} value={value}>
              {t(roleTitleKeys[value])}
            </MenuItem>
          ))}
        </TextField>
        {needsCompany && (
          <Autocomplete
            options={companies}
            value={company}
            onChange={(_, value) => setCompany(value)}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField {...params} required label={t('installerCompany')} />
            )}
          />
        )}
        {role === ADMIN && !isNew && getRole(user) === USER && (
          <Alert severity="info">{t('usersBecomesCompany')}</Alert>
        )}
        {escalates && <Alert severity="warning">{t('usersEscalationWarning')}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel')}</Button>
        <Button variant="contained" disabled={!valid || saving} onClick={handleSave}>
          {t('save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const deleteUser = (userId) => fetchOrThrow(`/api/users/${userId}`, { method: 'DELETE' });

export default UserDialog;
