import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  CardActions,
  CardContent,
  CircularProgress,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import SearchIcon from '@mui/icons-material/Search';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AddIcon from '@mui/icons-material/Add';
import { useAsyncTask, useCatch } from '../../reactHelper';
import fetchOrThrow from '../../common/util/fetchOrThrow';
import { SUPERADMIN, useRole } from '../common/roles';
import useCompanies from '../common/useCompanies';
import { openCompanyFleet } from '../common/impersonation';
import { setInstallerCompany } from '../common/installerCompany';
import useT from '../common/useT';

const useStyles = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(3),
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'minmax(0, 1fr)',
    [theme.breakpoints.up('md')]: {
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
      alignItems: 'start',
    },
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(2),
    },
  },
  listPaper: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '70vh',
  },
  search: {
    padding: theme.spacing(2),
  },
  list: {
    overflow: 'auto',
  },
  empty: {
    padding: theme.spacing(2),
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
    gap: theme.spacing(2),
    marginTop: theme.spacing(2),
  },
  actions: {
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    padding: theme.spacing(0, 2, 2),
  },
}));

const Stat = ({ label, value }) => (
  <div>
    <Typography variant="h4">{value}</Typography>
    <Typography variant="body2" color="textSecondary">
      {label}
    </Typography>
  </div>
);

const CompaniesPage = () => {
  const { classes } = useStyles();
  const t = useT();
  const navigate = useNavigate();
  const role = useRole();

  // Only company names are loaded here; no fleet data until a company is chosen.
  const companies = useCompanies();
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState(null);
  const [summary, setSummary] = useState(null);

  useAsyncTask(
    async ({ signal }) => {
      setSummary(null);
      if (!selected) {
        return;
      }
      const [devicesResponse, usersResponse] = await Promise.all([
        fetchOrThrow(`/api/devices?userId=${selected.id}&excludeAttributes=true`, { signal }),
        fetchOrThrow(`/api/users?userId=${selected.id}`, { signal }),
      ]);
      const devices = await devicesResponse.json();
      const users = await usersResponse.json();
      const online = devices.filter((device) => device.status === 'online').length;
      setSummary({
        devices: devices.length,
        online,
        offline: devices.length - online,
        users: users.filter((user) => user.id !== selected.id).length,
      });
    },
    [selected],
  );

  const filtered = useMemo(() => {
    const lowerCaseKeyword = keyword.toLowerCase();
    return (companies || []).filter((company) =>
      [company.name, company.email].some((s) => s && s.toLowerCase().includes(lowerCaseKeyword)),
    );
  }, [companies, keyword]);

  const handleOpenFleet = useCatch(async () => {
    await openCompanyFleet(selected);
  });

  const handleAddEquipment = () => {
    setInstallerCompany(selected);
    navigate('/installer');
  };

  return (
    <div className={classes.root}>
      <Paper variant="outlined" className={classes.listPaper}>
        <div className={classes.search}>
          <TextField
            fullWidth
            autoFocus
            placeholder={t('companySearch')}
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
        </div>
        {companies === null && (
          <div className={classes.empty}>
            <CircularProgress size={24} />
          </div>
        )}
        {companies !== null && filtered.length === 0 && (
          <Typography className={classes.empty} color="textSecondary">
            {t('companyNone')}
          </Typography>
        )}
        <List className={classes.list} dense>
          {filtered.map((company) => (
            <ListItemButton
              key={company.id}
              selected={selected?.id === company.id}
              onClick={() => setSelected(company)}
            >
              <ListItemText primary={company.name} secondary={company.email} />
            </ListItemButton>
          ))}
        </List>
      </Paper>

      <Card variant="outlined">
        {selected ? (
          <>
            <CardContent>
              <Typography variant="h5">{selected.name}</Typography>
              <Typography variant="body2" color="textSecondary">
                {selected.email}
              </Typography>
              {summary ? (
                <div className={classes.stats}>
                  <Stat
                    label={t('companyDevices')}
                    value={
                      selected.deviceLimit >= 0
                        ? `${summary.devices} / ${selected.deviceLimit}`
                        : summary.devices
                    }
                  />
                  <Stat label={t('companyOnline')} value={summary.online} />
                  <Stat label={t('companyOffline')} value={summary.offline} />
                  <Stat label={t('companyUsers')} value={summary.users} />
                </div>
              ) : (
                <CircularProgress size={24} className={classes.stats} />
              )}
            </CardContent>
            <CardActions className={classes.actions}>
              {role === SUPERADMIN && (
                <Button variant="contained" startIcon={<OpenInNewIcon />} onClick={handleOpenFleet}>
                  {t('companyOpenFleet')}
                </Button>
              )}
              <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddEquipment}>
                {t('companyAddEquipment')}
              </Button>
            </CardActions>
          </>
        ) : (
          <CardContent>
            <Typography variant="h6">{t('companySelect')}</Typography>
            <Typography color="textSecondary">{t('companyHint')}</Typography>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default CompaniesPage;
