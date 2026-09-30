import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Chip,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import LogoutIcon from '@mui/icons-material/Logout';
import { sessionActions } from '../../store';
import { nativePostMessage } from '../../common/components/NativeInterface';
import { roleTitleKeys, useRole } from '../common/roles';
import { clearImpersonation } from '../common/impersonation';
import useT from '../common/useT';

const useStyles = makeStyles()((theme) => ({
  info: {
    padding: theme.spacing(1, 2),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing(0.5),
  },
  chip: {
    marginInlineEnd: theme.spacing(1),
  },
}));

const UserMenu = () => {
  const { classes } = useStyles();
  const t = useT();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('sm'));
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const user = useSelector((state) => state.session.user);
  const role = useRole();

  const [anchorEl, setAnchorEl] = useState(null);

  const handleLogout = async () => {
    setAnchorEl(null);

    const notificationToken = window.localStorage.getItem('notificationToken');
    if (notificationToken && !user.readonly) {
      window.localStorage.removeItem('notificationToken');
      const tokens = user.attributes.notificationTokens?.split(',') || [];
      if (tokens.includes(notificationToken)) {
        await fetch(`/api/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...user,
            attributes: {
              ...user.attributes,
              notificationTokens:
                tokens.length > 1
                  ? tokens.filter((it) => it !== notificationToken).join(',')
                  : undefined,
            },
          }),
        });
      }
    }

    clearImpersonation();
    await fetch('/api/session', { method: 'DELETE' });
    nativePostMessage('logout');
    navigate('/login');
    dispatch(sessionActions.updateUser(null));
  };

  const roleChip = (
    <Chip size="small" color="primary" variant="outlined" label={t(roleTitleKeys[role])} />
  );

  return (
    <>
      {desktop && <span className={classes.chip}>{roleChip}</span>}
      <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
        <Avatar sx={{ width: 32, height: 32 }}>{user.name?.charAt(0).toUpperCase()}</Avatar>
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <div className={classes.info}>
          <Typography variant="subtitle2">{user.name}</Typography>
          <Typography variant="body2" color="textSecondary">
            {user.email}
          </Typography>
          {roleChip}
        </div>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          {t('logout')}
        </MenuItem>
      </Menu>
    </>
  );
};

export default UserMenu;
