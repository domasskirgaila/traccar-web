import { useReducer, useState } from 'react';
import { Autocomplete, Card, CardContent, TextField, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import BuildIcon from '@mui/icons-material/Build';
import usePersistedState from '../../../common/util/usePersistedState';
import { getInstallerCompany, setInstallerCompany } from '../../common/installerCompany';
import useCompanies from '../../common/useCompanies';
import useT from '../../common/useT';
import InstallationForm from './InstallationForm';
import CompanyDevices from './CompanyDevices';
import DeviceTest from './DeviceTest';

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
  company: {
    maxWidth: 480,
  },
  grid: {
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'minmax(0, 1fr)',
    alignItems: 'start',
    [theme.breakpoints.up('lg')]: {
      gridTemplateColumns: 'minmax(320px, 400px) minmax(0, 1fr)',
    },
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
}));

const InstallerPage = () => {
  const { classes } = useStyles();
  const t = useT();
  const companies = useCompanies();

  const [company, setCompany] = useState(getInstallerCompany);
  const [testDeviceId, setTestDeviceId] = usePersistedState('v2InstallerTestDevice', null);
  const [reloadKey, reload] = useReducer((x) => x + 1, 0);

  const selectCompany = (value) => {
    setCompany(value);
    setTestDeviceId(null);
    if (value) {
      setInstallerCompany(value);
    }
  };

  return (
    <div className={classes.root}>
      <Autocomplete
        className={classes.company}
        options={companies || []}
        loading={companies === null}
        value={company}
        onChange={(_, value) => selectCompany(value)}
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        renderInput={(params) => <TextField {...params} label={t('installerCompany')} />}
      />
      {company ? (
        <div className={classes.grid}>
          <div className={classes.column}>
            <InstallationForm
              key={company.id}
              company={company}
              onCreated={(device) => {
                reload();
                setTestDeviceId(device.id);
              }}
            />
            <CompanyDevices
              company={company}
              reloadKey={reloadKey}
              selectedId={testDeviceId}
              onSelect={setTestDeviceId}
            />
          </div>
          {testDeviceId ? (
            <DeviceTest deviceId={testDeviceId} />
          ) : (
            <Card variant="outlined">
              <CardContent className={classes.empty}>
                <BuildIcon />
                <Typography>{t('installerTestHint')}</Typography>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Typography color="textSecondary">{t('installerNoCompany')}</Typography>
      )}
    </div>
  );
};

export default InstallerPage;
