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
// of them, to all company saved commands, IO mappings (computed attributes) and geofences,
// otherwise users would not see it, could not send commands to it, would see raw IO or get
// no geofence events.
//
// companyId is the company Admin. An administrator (Installer or SuperAdmin) passes its own
// id as creatorId, so the automatic link Traccar adds to the creator gets removed again.
export const linkDeviceToCompany = async (deviceId, companyId, creatorId) => {
  const [usersResponse, commandsResponse, attributesResponse, geofencesResponse] =
    await Promise.all([
      fetchOrThrow(`/api/users?userId=${companyId}`),
      fetchOrThrow(`/api/commands?userId=${companyId}`),
      fetchOrThrow(`/api/attributes/computed?userId=${companyId}`),
      fetchOrThrow(`/api/geofences?userId=${companyId}`),
    ]);
  const users = await usersResponse.json();
  const commands = await commandsResponse.json();
  const attributes = await attributesResponse.json();
  const geofences = await geofencesResponse.json();
  const userIds = new Set([companyId, ...users.map((user) => user.id)]);
  await Promise.all([
    ...[...userIds].map((userId) => link({ userId, deviceId })),
    ...commands.map((command) => link({ deviceId, commandId: command.id })),
    ...attributes.map((attribute) => link({ deviceId, attributeId: attribute.id })),
    ...geofences.map((geofence) => link({ deviceId, geofenceId: geofence.id })),
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
