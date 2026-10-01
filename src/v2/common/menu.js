import DashboardIcon from '@mui/icons-material/Dashboard';
import MapIcon from '@mui/icons-material/Map';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import TerminalIcon from '@mui/icons-material/Terminal';
import AssessmentIcon from '@mui/icons-material/Assessment';
import RouterIcon from '@mui/icons-material/Router';
import BusinessIcon from '@mui/icons-material/Business';
import BuildIcon from '@mui/icons-material/Build';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import SettingsInputComponentIcon from '@mui/icons-material/SettingsInputComponent';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ListAltIcon from '@mui/icons-material/ListAlt';
import DnsIcon from '@mui/icons-material/Dns';
import { ADMIN, INSTALLER, SUPERADMIN, USER, allRoles } from './roles';

// Single source for both the sidebar and the route guards, so they cannot disagree.
// A SuperAdmin viewing a company is logged in as that company's Admin, so the fleet
// modules only need the USER and ADMIN roles.
export default [
  [
    { path: 'dashboard', titleKey: 'menuDashboard', icon: DashboardIcon, roles: [ADMIN] },
    { path: 'map', titleKey: 'menuMap', icon: MapIcon, roles: [USER, ADMIN] },
    { path: 'vehicles', titleKey: 'menuVehicles', icon: LocalShippingIcon, roles: [USER, ADMIN] },
    { path: 'commands', titleKey: 'menuCommands', icon: TerminalIcon, roles: [USER, ADMIN] },
    { path: 'events', titleKey: 'menuEvents', icon: NotificationsIcon, roles: [USER, ADMIN] },
    { path: 'reports', titleKey: 'menuReports', icon: AssessmentIcon, roles: [ADMIN] },
    { path: 'equipment', titleKey: 'menuEquipment', icon: RouterIcon, roles: [ADMIN] },
  ],
  [
    {
      path: 'companies',
      titleKey: 'menuCompanies',
      icon: BusinessIcon,
      roles: [SUPERADMIN, INSTALLER],
    },
    {
      path: 'installer',
      titleKey: 'menuInstaller',
      icon: BuildIcon,
      roles: [SUPERADMIN, INSTALLER],
    },
    { path: 'users', titleKey: 'menuUsers', icon: ManageAccountsIcon, roles: [SUPERADMIN] },
    {
      path: 'command-templates',
      titleKey: 'menuCommandTemplates',
      icon: ListAltIcon,
      roles: [SUPERADMIN],
    },
    {
      path: 'io-mapping',
      titleKey: 'menuIoMapping',
      icon: SettingsInputComponentIcon,
      roles: [SUPERADMIN],
    },
    { path: 'system', titleKey: 'menuSystem', icon: DnsIcon, roles: [SUPERADMIN] },
  ],
  [{ path: 'settings', titleKey: 'menuSettings', icon: SettingsIcon, roles: allRoles }],
];
