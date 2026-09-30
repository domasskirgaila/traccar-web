import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, CardContent, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import BusinessIcon from '@mui/icons-material/Business';
import useT from '../common/useT';
import { getInstallerCompany } from '../common/installerCompany';

const useStyles = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    maxWidth: 720,
  },
  company: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  name: {
    flexGrow: 1,
  },
}));

const InstallerPage = () => {
  const { classes } = useStyles();
  const t = useT();
  const navigate = useNavigate();

  const [company] = useState(getInstallerCompany);

  return (
    <div className={classes.root}>
      <Card variant="outlined">
        <CardContent className={classes.company}>
          <BusinessIcon color="action" />
          <div className={classes.name}>
            <Typography variant="overline" color="textSecondary">
              {t('installerCompany')}
            </Typography>
            <Typography variant="h6">{company ? company.name : t('installerNoCompany')}</Typography>
          </div>
          <Button variant="outlined" onClick={() => navigate('/companies')}>
            {company ? t('companyChange') : t('companySelect')}
          </Button>
        </CardContent>
      </Card>
      <Typography color="textSecondary">{t('placeholder')}</Typography>
    </div>
  );
};

export default InstallerPage;
