import { useEffect, useMemo, useState } from 'react';

// Client of the chat service (tools/chat-service), served under /chat-api on the same origin as
// Traccar so the Traccar session cookie identifies the user.

export class ChatError extends Error {
  constructor(status, body) {
    super(body?.error || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

export const chatFetch = async (path, { method = 'GET', body, signal } = {}) => {
  const response = await fetch(`/chat-api${path}`, {
    method,
    signal,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!response.ok) {
    throw new ChatError(response.status, data);
  }
  return data;
};

// Polls driver, last message and unread count for the given vehicles.
// Returns null while loading and { unavailable: true } when the chat service cannot be reached.
export const useChatSummary = (deviceIds, interval = 15000) => {
  const key = deviceIds.join(',');
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!key) {
      setSummary({});
      return undefined;
    }
    const controller = new AbortController();
    const load = async () => {
      try {
        setSummary(await chatFetch(`/summary?deviceIds=${key}`, { signal: controller.signal }));
      } catch (error) {
        if (error.name !== 'AbortError') {
          setSummary({ unavailable: true });
        }
      }
    };
    load();
    const timer = setInterval(load, interval);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [key, interval]);

  return summary;
};

export const getAssignment = () => chatFetch('/me/assignment');

export const takeVehicle = (deviceId, force = false) =>
  chatFetch('/me/assignment', { method: 'POST', body: { deviceId, force } });

export const releaseVehicle = () => chatFetch('/me/assignment', { method: 'DELETE' });

// Drivers only work with the vehicle they chose; everyone else sees all company devices.
export const useVisibleDevices = (items, isDriver) => {
  const [vehicleId, setVehicleId] = useState(undefined);

  useEffect(() => {
    if (!isDriver) {
      return undefined;
    }
    let active = true;
    getAssignment()
      .then((assignment) => active && setVehicleId(assignment?.deviceId ?? null))
      .catch(() => active && setVehicleId(null));
    return () => {
      active = false;
    };
  }, [isDriver]);

  return useMemo(() => {
    if (!isDriver) {
      return items;
    }
    return items[vehicleId] ? { [vehicleId]: items[vehicleId] } : {};
  }, [items, isDriver, vehicleId]);
};
