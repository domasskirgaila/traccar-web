import { useMemo } from 'react';
import { useSelector } from 'react-redux';

export const statusFilters = ['all', 'online', 'offline', 'unknown'];

export const vehicleStatus = (device) =>
  device.status === 'online' || device.status === 'offline' ? device.status : 'unknown';

// Devices of the current company with their latest positions, filtered for the list and map.
// Derived with useMemo so a position update renders once and the map gets stable arrays.
const useVehicles = (keyword, status) => {
  const devices = useSelector((state) => state.devices.items);
  const positions = useSelector((state) => state.session.positions);

  return useMemo(() => {
    const all = Object.values(devices).sort((a, b) => a.name.localeCompare(b.name));
    const counts = { all: all.length, online: 0, offline: 0, unknown: 0 };
    all.forEach((device) => {
      counts[vehicleStatus(device)] += 1;
    });

    const lowerCaseKeyword = keyword.trim().toLowerCase();
    const vehicles = all
      .filter((device) => status === 'all' || vehicleStatus(device) === status)
      .filter(
        (device) =>
          !lowerCaseKeyword ||
          [device.name, device.uniqueId, device.phone, device.model, device.contact].some(
            (value) => value && value.toLowerCase().includes(lowerCaseKeyword),
          ),
      )
      .map((device) => ({ device, position: positions[device.id] }));

    return {
      vehicles,
      counts,
      positions: vehicles.map((vehicle) => vehicle.position).filter(Boolean),
    };
  }, [devices, positions, keyword, status]);
};

export default useVehicles;
