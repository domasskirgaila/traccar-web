import fetchOrThrow from '../../common/util/fetchOrThrow';
import { ADMIN, INSTALLER, SUPERADMIN, USER, getRole } from './roles';

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
// devices and saved commands.
const joinCompany = async (userId, companyId) => {
  const [devices, commands] = await Promise.all([
    getJson(`/api/devices?userId=${companyId}`),
    getJson(`/api/commands?userId=${companyId}`),
  ]);
  await Promise.all([
    permission('POST', { userId: companyId, managedUserId: userId }),
    ...devices.map((device) => permission('POST', { userId, deviceId: device.id })),
    ...commands.map((command) => permission('POST', { userId, commandId: command.id })),
  ]);
};

const leaveCompany = async (userId, companyId) => {
  const [devices, commands] = await Promise.all([
    getJson(`/api/devices?userId=${userId}`),
    getJson(`/api/commands?userId=${userId}`),
  ]);
  await Promise.all([
    permission('DELETE', { userId: companyId, managedUserId: userId }),
    ...devices.map((device) => permission('DELETE', { userId, deviceId: device.id })),
    ...commands.map((command) => permission('DELETE', { userId, commandId: command.id })),
  ]);
};

export class RoleChangeError extends Error {}

// companyId: the company a User belongs to after the change (required for USER),
// currentCompanyId: the company the user belongs to now, if it is a User.
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
  if (oldRole === USER && currentCompanyId && (role !== USER || companyId !== currentCompanyId)) {
    await leaveCompany(user.id, currentCompanyId);
  }
  const response = await request('PUT', `/api/users/${user.id}`, roleFields(user, role));
  if (role === USER && companyId && companyId !== currentCompanyId) {
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
  if (role === USER && companyId) {
    await joinCompany(created.id, companyId);
  }
  return created;
};
