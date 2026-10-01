import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Divider,
  Link,
  MenuItem,
  Paper,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { sessionActions } from '../../../store';
import { useLocalization, useTranslation } from '../../../common/components/LocalizationProvider';
import usePersistedState from '../../../common/util/usePersistedState';
import PasswordField from '../../../common/components/PasswordField';
import {
  generateLoginToken,
  handleLoginTokenListeners,
  nativePostMessage,
} from '../../../common/components/NativeInterface';
import { useCatch } from '../../../reactHelper';
import useT from '../../common/useT';

const useStyles = makeStyles()((theme) => ({
  root: {
    flex: 1,
    display: 'flex',
    minHeight: 0,
    backgroundColor: theme.palette.background.default,
  },
  brand: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(6),
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
  },
  brandIcon: {
    fontSize: 56,
  },
  side: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(3),
    overflowY: 'auto',
  },
  form: {
    width: '100%',
    maxWidth: 400,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    padding: theme.spacing(4),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(3),
    },
  },
  links: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
  },
  language: {
    alignSelf: 'flex-end',
    minWidth: 160,
  },
}));

const appTitle = document.title && !document.title.includes('${') ? document.title : 'Traccar';

const LoginPage = () => {
  const { classes } = useStyles();
  const t = useT();
  const sharedT = useTranslation();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { languages, language, setLocalLanguage } = useLocalization();

  const server = useSelector((state) => state.session.server);
  const languageEnabled =
    !server.attributes.language && !server.attributes['ui.disableLoginLanguage'];
  const openIdForced = server.openIdEnabled && server.openIdForce;

  const [email, setEmail] = usePersistedState('loginEmail', '');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeEnabled, setCodeEnabled] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  const finishLogin = (user) => {
    generateLoginToken();
    dispatch(sessionActions.updateUser(user));
    const target = window.sessionStorage.getItem('postLogin') || '/';
    window.sessionStorage.removeItem('postLogin');
    navigate(target, { replace: true });
  };

  const handlePasswordLogin = async (event) => {
    event.preventDefault();
    setFailed(false);
    setLoading(true);
    try {
      const form = { email, password };
      if (codeEnabled) {
        form.code = code;
      }
      const response = await fetch('/api/session', {
        method: 'POST',
        body: new URLSearchParams(form),
      });
      if (response.ok) {
        finishLogin(await response.json());
      } else if (response.status === 401 && response.headers.get('WWW-Authenticate') === 'TOTP') {
        setCodeEnabled(true);
      } else {
        throw Error(await response.text());
      }
    } catch {
      setFailed(true);
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  // Login with a token handed over by the native mobile app.
  const handleTokenLogin = useCatch(async (token) => {
    const response = await fetch(`/api/session?token=${encodeURIComponent(token)}`);
    if (response.ok) {
      finishLogin(await response.json());
    } else if (response.status === 401) {
      nativePostMessage('logout');
    }
  });
  const handleTokenLoginRef = useRef(handleTokenLogin);
  handleTokenLoginRef.current = handleTokenLogin;

  useEffect(() => nativePostMessage('authentication'), []);

  useEffect(() => {
    const listener = (token) => handleTokenLoginRef.current(token);
    handleLoginTokenListeners.add(listener);
    return () => handleLoginTokenListeners.delete(listener);
  }, []);

  return (
    <div className={classes.root}>
      {desktop && (
        <div className={classes.brand}>
          <LocalShippingIcon className={classes.brandIcon} />
          <Typography variant="h3" fontWeight={700}>
            {appTitle}
          </Typography>
          <Typography variant="h6" fontWeight={400} sx={{ opacity: 0.85, maxWidth: 440 }}>
            {t('loginTagline')}
          </Typography>
        </div>
      )}
      <div className={classes.side}>
        <Paper
          variant="outlined"
          component="form"
          className={classes.form}
          onSubmit={handlePasswordLogin}
        >
          {languageEnabled && (
            <TextField
              select
              size="small"
              className={classes.language}
              value={language}
              onChange={(e) => setLocalLanguage(e.target.value)}
            >
              {Object.entries(languages).map(([key, value]) => (
                <MenuItem key={key} value={key}>
                  {value.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          <Typography variant="h5" fontWeight={600}>
            {desktop ? t('loginTitle') : appTitle}
          </Typography>
          {server.announcement && <Alert severity="info">{server.announcement}</Alert>}
          {!openIdForced && (
            <>
              <TextField
                required
                error={failed}
                label={sharedT('userEmail')}
                name="email"
                value={email}
                autoComplete="email"
                autoFocus={!email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <PasswordField
                required
                error={failed}
                label={sharedT('userPassword')}
                name="password"
                value={password}
                autoComplete="current-password"
                autoFocus={Boolean(email)}
                onChange={(e) => setPassword(e.target.value)}
              />
              {codeEnabled && (
                <TextField
                  required
                  autoFocus
                  error={failed}
                  label={sharedT('loginTotpCode')}
                  name="code"
                  value={code}
                  slotProps={{ htmlInput: { inputMode: 'numeric', autoComplete: 'one-time-code' } }}
                  onChange={(e) => setCode(e.target.value)}
                />
              )}
              {failed && <Alert severity="error">{t('loginFailed')}</Alert>}
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={loading || !email || !password || (codeEnabled && !code)}
              >
                {sharedT('loginLogin')}
              </Button>
            </>
          )}
          {server.openIdEnabled && (
            <>
              {!openIdForced && <Divider>{t('loginOr')}</Divider>}
              <Button
                variant="outlined"
                size="large"
                onClick={() => {
                  document.location = '/api/session/openid/auth';
                }}
              >
                {sharedT('loginOpenId')}
              </Button>
            </>
          )}
          {!openIdForced && (server.registration || server.emailEnabled) && (
            <div className={classes.links}>
              {server.registration ? (
                <Link component="button" type="button" onClick={() => navigate('/register')}>
                  {sharedT('loginRegister')}
                </Link>
              ) : (
                <span />
              )}
              {server.emailEnabled && (
                <Link component="button" type="button" onClick={() => navigate('/reset-password')}>
                  {sharedT('loginReset')}
                </Link>
              )}
            </div>
          )}
        </Paper>
      </div>
    </div>
  );
};

export default LoginPage;
