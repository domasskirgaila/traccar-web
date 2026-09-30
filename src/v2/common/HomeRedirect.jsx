import { Navigate } from 'react-router-dom';
import { roleHome, useRole } from './roles';

const HomeRedirect = () => {
  const role = useRole();
  return <Navigate to={roleHome(role)} replace />;
};

export default HomeRedirect;
