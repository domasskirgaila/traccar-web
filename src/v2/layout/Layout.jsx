import { Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import Loader from '../../common/components/Loader';
import Sidebar from './Sidebar';
import Header from './Header';
import CompanyBanner from './CompanyBanner';

const useStyles = makeStyles()((theme) => ({
  root: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    backgroundColor: theme.palette.background.default,
  },
  main: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  content: {
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
    position: 'relative',
  },
}));

const Layout = () => {
  const { classes } = useStyles();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={classes.root}>
      <Sidebar desktop={desktop} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className={classes.main}>
        <Header showMenuButton={!desktop} onMenuClick={() => setSidebarOpen(true)} />
        <CompanyBanner />
        <main className={classes.content}>
          <Suspense fallback={<Loader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default Layout;
