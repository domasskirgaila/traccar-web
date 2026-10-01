import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { useLocalization } from '../common/components/LocalizationProvider';
import { generateLoginToken } from '../common/components/NativeInterface';
import Loader from '../common/components/Loader';
import { useAsyncTask } from '../reactHelper';
import App from './App';
import RoleRoute from './common/RoleRoute';
import HomeRedirect from './common/HomeRedirect';
import menu from './common/menu';
import { ADMIN, USER } from './common/roles';
import PlaceholderPage from './pages/PlaceholderPage';

// Login, registration and password reset are shared with the old UI for now.
const LoginPage = lazy(() => import('../login/LoginPage'));
const RegisterPage = lazy(() => import('../login/RegisterPage'));
const ResetPasswordPage = lazy(() => import('../login/ResetPasswordPage'));
const ChangeServerPage = lazy(() => import('../login/ChangeServerPage'));
const CompaniesPage = lazy(() => import('./pages/CompaniesPage'));
const InstallerPage = lazy(() => import('./pages/installer/InstallerPage'));
const MapPage = lazy(() => import('./pages/map/MapPage'));
const VehiclesPage = lazy(() => import('./pages/VehiclesPage'));
const CommandsPage = lazy(() => import('./pages/commands/CommandsPage'));
const EquipmentPage = lazy(() => import('./pages/equipment/EquipmentPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const UsersPage = lazy(() => import('./pages/users/UsersPage'));
const IoMappingPage = lazy(() => import('./pages/io/IoMappingPage'));
const HistoryPage = lazy(() => import('./pages/history/HistoryPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const EventsPage = lazy(() => import('./pages/events/EventsPage'));
const CommandTemplatesPage = lazy(() => import('./pages/commandTemplates/CommandTemplatesPage'));
const SystemPage = lazy(() => import('./pages/system/SystemPage'));

const pages = {
  companies: <CompaniesPage />,
  installer: <InstallerPage />,
  map: <MapPage />,
  vehicles: <VehiclesPage />,
  commands: <CommandsPage />,
  equipment: <EquipmentPage />,
  dashboard: <DashboardPage />,
  reports: <ReportsPage />,
  users: <UsersPage />,
  'io-mapping': <IoMappingPage />,
  settings: <SettingsPage />,
  events: <EventsPage />,
  'command-templates': <CommandTemplatesPage />,
  system: <SystemPage />,
};

const Navigation = () => {
  const { setLocalLanguage } = useLocalization();
  const [searchParams, setSearchParams] = useSearchParams();

  const hasQueryParams = ['locale', 'token', 'openid'].some((key) => searchParams.has(key));

  useAsyncTask(
    async ({ signal }) => {
      if (!hasQueryParams) {
        return;
      }
      const newParams = new URLSearchParams(searchParams);
      if (searchParams.has('locale')) {
        setLocalLanguage(searchParams.get('locale'));
        newParams.delete('locale');
      }
      if (searchParams.has('token')) {
        const token = searchParams.get('token');
        await fetch(`/api/session?token=${encodeURIComponent(token)}`, { signal });
        newParams.delete('token');
      }
      if (searchParams.has('openid')) {
        if (searchParams.get('openid') === 'success') {
          generateLoginToken();
        }
        newParams.delete('openid');
      }
      setSearchParams(newParams, { replace: true });
    },
    [hasQueryParams, searchParams, setSearchParams, setLocalLanguage],
  );

  if (hasQueryParams) {
    return <Loader />;
  }
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/change-server" element={<ChangeServerPage />} />
        <Route path="/" element={<App />}>
          <Route index element={<HomeRedirect />} />
          {menu.flat().map((item) => (
            <Route key={item.path} element={<RoleRoute roles={item.roles} />}>
              <Route
                path={item.path}
                element={pages[item.path] || <PlaceholderPage titleKey={item.titleKey} />}
              />
            </Route>
          ))}
          <Route element={<RoleRoute roles={[USER, ADMIN]} />}>
            <Route path="history" element={<HistoryPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
};

export default Navigation;
