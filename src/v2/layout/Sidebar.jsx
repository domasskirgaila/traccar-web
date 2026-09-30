import { Link, useLocation } from 'react-router-dom';
import {
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import menu from '../common/menu';
import { useRole } from '../common/roles';
import useT from '../common/useT';

const useStyles = makeStyles()((theme) => ({
  paper: {
    width: theme.dimensions.sidebarWidthV2,
    display: 'flex',
    flexDirection: 'column',
  },
  drawer: {
    width: theme.dimensions.sidebarWidthV2,
    flexShrink: 0,
  },
  title: {
    fontWeight: 600,
  },
  bottom: {
    marginTop: 'auto',
  },
}));

// The document title is only filled in by the server; the dev server leaves the template.
const appTitle = document.title && !document.title.includes('${') ? document.title : 'Traccar';

const Sidebar = ({ desktop, open, onClose }) => {
  const { classes } = useStyles();
  const t = useT();
  const role = useRole();
  const location = useLocation();

  const sections = menu.map((items) => items.filter((item) => item.roles.includes(role)));
  const footer = sections.pop();

  const renderItems = (items) => (
    <List>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <ListItemButton
            key={item.path}
            component={Link}
            to={`/${item.path}`}
            selected={location.pathname.startsWith(`/${item.path}`)}
            onClick={onClose}
          >
            <ListItemIcon>
              <Icon />
            </ListItemIcon>
            <ListItemText primary={t(item.titleKey)} />
          </ListItemButton>
        );
      })}
    </List>
  );

  const content = (
    <>
      <Toolbar>
        <Typography variant="h6" noWrap className={classes.title}>
          {appTitle}
        </Typography>
      </Toolbar>
      <Divider />
      {sections
        .filter((items) => items.length)
        .map((items, index) => (
          <div key={items[0].path}>
            {index > 0 && <Divider />}
            {renderItems(items)}
          </div>
        ))}
      {footer.length > 0 && (
        <div className={classes.bottom}>
          <Divider />
          {renderItems(footer)}
        </div>
      )}
    </>
  );

  if (desktop) {
    return (
      <Drawer variant="permanent" className={classes.drawer} classes={{ paper: classes.paper }}>
        {content}
      </Drawer>
    );
  }
  return (
    <Drawer
      variant="temporary"
      open={open}
      onClose={onClose}
      classes={{ paper: classes.paper }}
      ModalProps={{ keepMounted: true }}
    >
      {content}
    </Drawer>
  );
};

export default Sidebar;
