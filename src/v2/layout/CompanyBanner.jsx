import { Button, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { useCatch } from '../../reactHelper';
import { returnToSuperAdmin } from '../common/impersonation';
import useImpersonation from '../common/useImpersonation';
import useT from '../common/useT';

const useStyles = makeStyles()((theme) => ({
  banner: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 2),
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
  },
  text: {
    flexGrow: 1,
  },
}));

// Shown only to a SuperAdmin viewing a company; a real Admin never sees it.
const CompanyBanner = () => {
  const { classes } = useStyles();
  const t = useT();
  const impersonation = useImpersonation();

  const handleChange = useCatch(returnToSuperAdmin);

  if (!impersonation) {
    return null;
  }
  return (
    <div className={classes.banner}>
      <Typography variant="body2" className={classes.text}>
        {`${t('companyViewing')}: `}
        <strong>{impersonation.company.name}</strong>
      </Typography>
      <Button size="small" color="inherit" startIcon={<SwapHorizIcon />} onClick={handleChange}>
        {t('companyChange')}
      </Button>
    </div>
  );
};

export default CompanyBanner;
