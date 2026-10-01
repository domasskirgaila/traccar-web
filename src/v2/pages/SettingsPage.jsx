import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Alert, Button, Card, CardContent, MenuItem, TextField, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { sessionActions } from '../../store';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { useCatch } from '../../reactHelper';
import { useLocalization, useTranslation } from '../../common/components/LocalizationProvider';
import useT from '../common/useT';

const useStyles = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    maxWidth: 560,
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(2),
    },
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    marginTop: theme.spacing(1.5),
  },
}));

const speedUnits = ['kmh', 'kn', 'mph'];
const distanceUnits = ['km', 'mi', 'nmi'];
const liveRoutes = ['none', 'selected', 'all'];
const liveRouteTitleKeys = {
  none: 'settingsLiveRoutesNone',
  selected: 'settingsLiveRoutesSelected',
  all: 'settingsLiveRoutesAll',
};

// Personal preferences, stored on the user like in the old UI so both UIs agree.
const SettingsPage = () => {
  const { classes } = useStyles();
  const t = useT();
  const sharedT = useTranslation();
  const dispatch = useDispatch();
  const { languages } = useLocalization();

  const user = useSelector((state) => state.session.user);
  const [attributes, setAttributes] = useState(() => ({
    language: '',
    speedUnit: 'kmh',
    distanceUnit: 'km',
    mapLiveRoutes: 'none',
    ...user.attributes,
  }));
  const [password, setPassword] = useState('');
  const [saved, setSaved] = useState(null);

  const save = async (changes) => {
    const response = await fetchOrThrow(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...user, ...changes }),
    });
    dispatch(sessionActions.updateUser(await response.json()));
  };

  const handleSavePreferences = useCatch(async () => {
    const { language, ...rest } = attributes;
    const next = { ...user.attributes, ...rest };
    if (language) {
      next.language = language;
    } else {
      delete next.language;
    }
    await save({ attributes: next });
    setSaved('preferences');
  });

  const handleSavePassword = useCatch(async () => {
    await save({ password });
    setPassword('');
    setSaved('password');
  });

  const update = (key) => (e) => {
    setSaved(null);
    setAttributes({ ...attributes, [key]: e.target.value });
  };

  return (
    <div className={classes.root}>
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600}>
            {t('settingsPreferences')}
          </Typography>
          <div className={classes.form}>
            <TextField
              select
              label={t('settingsLanguage')}
              value={attributes.language || ''}
              onChange={update('language')}
            >
              <MenuItem value="">{t('settingsLanguageAuto')}</MenuItem>
              {Object.entries(languages).map(([code, language]) => (
                <MenuItem key={code} value={code}>
                  {language.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={t('settingsSpeedUnit')}
              value={attributes.speedUnit}
              onChange={update('speedUnit')}
            >
              {speedUnits.map((unit) => (
                <MenuItem key={unit} value={unit}>
                  {sharedT({ kmh: 'sharedKmh', kn: 'sharedKn', mph: 'sharedMph' }[unit])}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={t('settingsDistanceUnit')}
              value={attributes.distanceUnit}
              onChange={update('distanceUnit')}
            >
              {distanceUnits.map((unit) => (
                <MenuItem key={unit} value={unit}>
                  {sharedT({ km: 'sharedKm', mi: 'sharedMi', nmi: 'sharedNmi' }[unit])}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={t('settingsLiveRoutes')}
              value={attributes.mapLiveRoutes}
              onChange={update('mapLiveRoutes')}
            >
              {liveRoutes.map((value) => (
                <MenuItem key={value} value={value}>
                  {t(liveRouteTitleKeys[value])}
                </MenuItem>
              ))}
            </TextField>
            {saved === 'preferences' && <Alert severity="success">{t('settingsSaved')}</Alert>}
            <Button variant="contained" onClick={handleSavePreferences} disabled={user.readonly}>
              {t('save')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600}>
            {t('settingsPassword')}
          </Typography>
          <div className={classes.form}>
            <TextField
              type="password"
              autoComplete="new-password"
              label={t('settingsNewPassword')}
              value={password}
              onChange={(e) => {
                setSaved(null);
                setPassword(e.target.value);
              }}
            />
            {saved === 'password' && <Alert severity="success">{t('settingsPasswordSaved')}</Alert>}
            <Button
              variant="outlined"
              onClick={handleSavePassword}
              disabled={password.length < 6 || user.readonly}
            >
              {t('settingsChangePassword')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
