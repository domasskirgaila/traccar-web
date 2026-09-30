import fetchOrThrow from '../../common/util/fetchOrThrow';

const link = (permission) =>
  fetch('/api/permissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(permission),
  });

const unlink = (permission) =>
  fetch('/api/permissions', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(permission),
  });

// A company is its Admin plus the users that Admin manages. A company device is linked to all
// of them, to all company saved commands and to the company IO mappings (computed attributes),
// otherwise users would not see it, could not send commands to it or would see raw IO.
//
// companyId is the company Admin. An administrator (Installer or SuperAdmin) passes its own
// id as creatorId, so the automatic link Traccar adds to the creator gets removed again.
export const linkDeviceToCompany = async (deviceId, companyId, creatorId) => {
  const [usersResponse, commandsResponse, attributesResponse] = await Promise.all([
    fetchOrThrow(`/api/users?userId=${companyId}`),
    fetchOrThrow(`/api/commands?userId=${companyId}`),
    fetchOrThrow(`/api/attributes/computed?userId=${companyId}`),
  ]);
  const users = await usersResponse.json();
  const commands = await commandsResponse.json();
  const attributes = await attributesResponse.json();
  const userIds = new Set([companyId, ...users.map((user) => user.id)]);
  await Promise.all([
    ...[...userIds].map((userId) => link({ userId, deviceId })),
    ...commands.map((command) => link({ deviceId, commandId: command.id })),
    ...attributes.map((attribute) => link({ deviceId, attributeId: attribute.id })),
  ]);
  if (creatorId && !userIds.has(creatorId)) {
    await unlink({ userId: creatorId, deviceId });
  }
};

export const createCompanyDevice = async (device, companyId, creatorId) => {
  const response = await fetchOrThrow('/api/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(device),
  });
  const created = await response.json();
  await linkDeviceToCompany(created.id, companyId, creatorId);
  return created;
};
