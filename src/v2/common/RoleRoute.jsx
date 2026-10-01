import { Navigate, Outlet } from 'react-router-dom';
import { roleHome, useRole } from './roles';

// Hides pages the role should not use, including links opened directly by URL.
const RoleRoute = ({ roles }) => {
  const role = useRole();
  if (!roles.includes(role)) {
    return <Navigate to={roleHome(role)} replace />;
  }
  return <Outlet />;
};

export default RoleRoute;
