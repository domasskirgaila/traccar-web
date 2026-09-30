import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { Autocomplete, Tab, Tabs, TextField, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import StatusDot from '../../common/StatusDot';
import { ADMIN, useRole } from '../../common/roles';
import useT from '../../common/useT';
import SendCommands from './SendCommands';
import SavedCommands from './SavedCommands';

const useStyles = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    maxWidth: 900,
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(2),
    },
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
}));

const CommandsPage = () => {
  const { classes } = useStyles();
  const t = useT();
  const role = useRole();

  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState('send');

  const items = useSelector((state) => state.devices.items);
  const devices = useMemo(
    () => Object.values(items).sort((a, b) => a.name.localeCompare(b.name)),
    [items],
  );

  const deviceId = Number(searchParams.get('deviceId'));
  const device = items[deviceId] || null;

  return (
    <div className={classes.root}>
      {role === ADMIN && (
        <Tabs value={tab} onChange={(_, value) => setTab(value)}>
          <Tab value="send" label={t('commandsSendTab')} />
          <Tab value="saved" label={t('commandsSavedTab')} />
        </Tabs>
      )}
      {tab === 'saved' ? (
        <SavedCommands />
      ) : (
        <>
          <Autocomplete
            options={devices}
            value={device}
            onChange={(_, value) =>
              setSearchParams(value ? { deviceId: value.id } : {}, { replace: true })
            }
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderOption={({ key, ...props }, option) => (
              <li key={key} {...props}>
                <span className={classes.option}>
                  <StatusDot device={option} />
                  {option.name}
                </span>
              </li>
            )}
            renderInput={(params) => <TextField {...params} label={t('commandsVehicle')} />}
          />
          {device ? (
            <SendCommands device={device} />
          ) : (
            <Typography color="textSecondary">{t('commandsSelectVehicle')}</Typography>
          )}
        </>
      )}
    </div>
  );
};

export default CommandsPage;
