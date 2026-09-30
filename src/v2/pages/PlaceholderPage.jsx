import { Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import ConstructionIcon from '@mui/icons-material/Construction';
import useT from '../common/useT';

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(3),
    color: theme.palette.text.secondary,
    textAlign: 'center',
  },
  icon: {
    fontSize: 48,
  },
}));

const PlaceholderPage = ({ titleKey }) => {
  const { classes } = useStyles();
  const t = useT();
  return (
    <div className={classes.root}>
      <ConstructionIcon className={classes.icon} />
      <Typography variant="h5" color="textPrimary">
        {t(titleKey)}
      </Typography>
      <Typography>{t('placeholder')}</Typography>
    </div>
  );
};

export default PlaceholderPage;
