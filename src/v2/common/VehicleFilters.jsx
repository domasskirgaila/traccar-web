import { Chip, InputAdornment, TextField } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import SearchIcon from '@mui/icons-material/Search';
import { statusFilters } from './useVehicles';
import useT from './useT';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
  },
}));

const statusTitleKeys = {
  all: 'statusAll',
  online: 'statusOnline',
  offline: 'statusOffline',
  unknown: 'statusUnknown',
};

const VehicleFilters = ({ keyword, onKeywordChange, status, onStatusChange, counts }) => {
  const { classes } = useStyles();
  const t = useT();

  return (
    <div className={classes.root}>
      <TextField
        fullWidth
        placeholder={t('vehiclesSearch')}
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
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
      <div className={classes.chips}>
        {statusFilters.map((value) => (
          <Chip
            key={value}
            size="small"
            label={`${t(statusTitleKeys[value])} ${counts[value]}`}
            color={status === value ? 'primary' : 'default'}
            variant={status === value ? 'filled' : 'outlined'}
            onClick={() => onStatusChange(value)}
          />
        ))}
      </div>
    </div>
  );
};

export default VehicleFilters;
