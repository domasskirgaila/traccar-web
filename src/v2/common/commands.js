// Traccar 6 has no API to view or cancel queued commands, so the new UI never queues unless
// someone explicitly unticks "no queue". Saved commands are re-read from the database when
// sent, so the setting has to live in the saved command itself.
export const withNoQueueDefault = (setItem) => (item) =>
  setItem(
    item.attributes?.noQueue === undefined
      ? { ...item, attributes: { ...item.attributes, noQueue: true } }
      : item,
  );

// Traccar answers this when a command must not be queued and the device is not connected.
export const isNotConnectedError = (error) => error.message.includes('Failed to send command');
