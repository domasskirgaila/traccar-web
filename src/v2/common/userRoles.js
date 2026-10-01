import fetchOrThrow from '../../common/util/fetchOrThrow';
import { ADMIN, DRIVER, INSTALLER, SUPERADMIN, USER, getRole } from './roles';

const request = (method, url, body) =>
  fetchOrThrow(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });

const permission = (method, body) =>
  fetch('/api/permissions', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const getJson = async (url) => (await fetchOrThrow(url)).json();

// Traccar user fields for each role of the new UI.
export const roleFields = (user, role) => {
  const attributes = { ...user.attributes };
  delete attributes.role;
  const base = { ...user, attributes, readonly: false };
  switch (role) {
    case SUPERADMIN:
    case INSTALLER:
      return {
        ...base,
        administrator: true,
        attributes: { ...attributes, role },
        deviceReadonly: false,
        limitCommands: false,
      };
    case ADMIN:
      return {
        ...base,
        administrator: false,
        userLimit: user.userLimit > 0 ? user.userLimit : 50,
        deviceLimit: -1,
        deviceReadonly: false,
        limitCommands: false,
      };
    case DRIVER:
      return {
        ...base,
        administrator: false,
        attributes: { ...attributes, role },
        userLimit: 0,
        deviceReadonly: true,
        limitCommands: true,
      };
    case USER:
    default:
      return {
        ...base,
        administrator: false,
        userLimit: 0,
        deviceReadonly: true,
        limitCommands: true,
      };
  }
};

// Gives a user access to everything of a company: managed by its Admin, linked to its
// devices, saved commands and notifications.
const joinCompany = async (userId, companyId) => {
  const [devices, commands, notifications] = await Promise.all([
    getJson(`/api/devices?userId=${companyId}`),
    getJson(`/api/commands?userId=${companyId}`),
    getJson(`/api/notifications?userId=${companyId}`),
  ]);
  await Promise.all([
    permission('POST', { userId: companyId, managedUserId: userId }),
    ...devices.map((device) => permission('POST', { userId, deviceId: device.id })),
    ...commands.map((command) => permission('POST', { userId, commandId: command.id })),
    ...notifications.map((notification) =>
      permission('POST', { userId, notificationId: notification.id }),
    ),
  ]);
};

const leaveCompany = async (userId, companyId) => {
  const [devices, commands, notifications] = await Promise.all([
    getJson(`/api/devices?userId=${userId}`),
    getJson(`/api/commands?userId=${userId}`),
    getJson(`/api/notifications?userId=${userId}`),
  ]);
  await Promise.all([
    permission('DELETE', { userId: companyId, managedUserId: userId }),
    ...devices.map((device) => permission('DELETE', { userId, deviceId: device.id })),
    ...commands.map((command) => permission('DELETE', { userId, commandId: command.id })),
    ...notifications.map((notification) =>
      permission('DELETE', { userId, notificationId: notification.id }),
    ),
  ]);
};

export class RoleChangeError extends Error {}

// Users and Drivers belong to a company; Admins are one, administrators have none.
const inCompany = (role) => role === USER || role === DRIVER;

// companyId: the company a User or Driver belongs to after the change,
// currentCompanyId: the company the user belongs to now, if it is a User or Driver.
export const changeRole = async (user, role, { companyId, currentCompanyId }) => {
  const oldRole = getRole(user);
  if (oldRole === ADMIN && role !== ADMIN) {
    const [users, devices] = await Promise.all([
      getJson(`/api/users?userId=${user.id}`),
      getJson(`/api/devices?userId=${user.id}`),
    ]);
    if (users.some((it) => it.id !== user.id) || devices.length) {
      throw new RoleChangeError('usersCompanyNotEmpty');
    }
  }
  if (
    inCompany(oldRole) &&
    currentCompanyId &&
    (!inCompany(role) || companyId !== currentCompanyId)
  ) {
    await leaveCompany(user.id, currentCompanyId);
  }
  const response = await request('PUT', `/api/users/${user.id}`, roleFields(user, role));
  if (inCompany(role) && companyId && companyId !== currentCompanyId) {
    await joinCompany(user.id, companyId);
  }
  return response.json();
};

export const createUser = async ({ name, email, password }, role, companyId) => {
  const response = await request(
    'POST',
    '/api/users',
    roleFields({ name, email, password, attributes: {} }, role),
  );
  const created = await response.json();
  if (inCompany(role) && companyId) {
    await joinCompany(created.id, companyId);
  }
  return created;
};
