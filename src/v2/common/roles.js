import { useSelector } from 'react-redux';

export const USER = 'user';
export const ADMIN = 'admin';
export const SUPERADMIN = 'superadmin';
export const INSTALLER = 'installer';

export const allRoles = [USER, ADMIN, SUPERADMIN, INSTALLER];

export const roleTitleKeys = {
  [USER]: 'roleUser',
  [ADMIN]: 'roleAdmin',
  [SUPERADMIN]: 'roleSuperAdmin',
  [INSTALLER]: 'roleInstaller',
};

// Roles are derived from standard Traccar user fields, so the backend stays unchanged:
// administrator -> SuperAdmin (or Installer when attributes.role is "installer"),
// manager (userLimit != 0) -> Admin, i.e. one company, anyone else -> User.
// Only the backend enforces permissions; the role just decides what the UI shows.
export const getRole = (user) => {
  if (!user) {
    return null;
  }
  if (user.administrator) {
    return user.attributes?.role === INSTALLER ? INSTALLER : SUPERADMIN;
  }
  if ((user.userLimit || 0) !== 0) {
    return ADMIN;
  }
  return USER;
};

export const useRole = () => useSelector((state) => getRole(state.session.user));

export const isCompany = (user) => !user.administrator && (user.userLimit || 0) !== 0;

export const roleHome = (role) => {
  switch (role) {
    case ADMIN:
      return '/dashboard';
    case SUPERADMIN:
      return '/companies';
    case INSTALLER:
      return '/installer';
    default:
      return '/map';
  }
};
