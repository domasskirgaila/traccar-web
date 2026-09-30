import { useLocation } from 'react-router-dom';
import { AppBar, IconButton, Toolbar, Tooltip, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import MenuIcon from '@mui/icons-material/Menu';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import menu from '../common/menu';
import useT from '../common/useT';
import { themeModes, useThemeMode } from '../theme/ThemeProvider';
import UserMenu from './UserMenu';

const useStyles = makeStyles()((theme) => ({
  appBar: {
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  title: {
    flexGrow: 1,
  },
}));

const themeIcons = {
  light: LightModeIcon,
  dark: DarkModeIcon,
  system: SettingsBrightnessIcon,
};

const themeTitleKeys = {
  light: 'themeLight',
  dark: 'themeDark',
  system: 'themeSystem',
};

const Header = ({ showMenuButton, onMenuClick }) => {
  const { classes } = useStyles();
  const t = useT();
  const location = useLocation();
  const { mode, setMode } = useThemeMode();

  const current = menu.flat().find((item) => location.pathname.startsWith(`/${item.path}`));
  const ThemeIcon = themeIcons[mode] || SettingsBrightnessIcon;
  const nextMode = themeModes[(themeModes.indexOf(mode) + 1) % themeModes.length];

  return (
    <AppBar position="static" color="inherit" elevation={0} className={classes.appBar}>
      <Toolbar>
        {showMenuButton && (
          <IconButton edge="start" color="inherit" onClick={onMenuClick}>
            <MenuIcon />
          </IconButton>
        )}
        <Typography variant="h6" noWrap className={classes.title}>
          {current && t(current.titleKey)}
        </Typography>
        <Tooltip title={t(themeTitleKeys[mode])}>
          <IconButton color="inherit" onClick={() => setMode(nextMode)}>
            <ThemeIcon />
          </IconButton>
        </Tooltip>
        <UserMenu />
      </Toolbar>
    </AppBar>
  );
};

export default Header;
