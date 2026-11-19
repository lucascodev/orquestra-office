const SAVED_VERSION = 1;
const DEVICE_LIMIT = 20;
const IDLE_LIMIT_MS = 30 * 24 * 60 * 60_000;
const TOUCH_SAVE_MS = 60 * 60_000;
const LABEL_LIMIT = 40;
const HOST_LIMIT = 255;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;

const cleanText = (value, limit) => String(value ?? "").replace(CONTROL_CHARACTERS, "").trim().slice(0, limit);

function savedDevicesOf(saved, keyId) {
  if (saved?.version !== SAVED_VERSION || !keyId || saved.keyId !== keyId || !Array.isArray(saved.devices)) return [];
  return saved.devices
    .filter((device) => typeof device?.id === "string" && typeof device.tokenHash === "string")
    .slice(0, DEVICE_LIMIT)
    .map((device) => ({
      id: device.id,
      tokenHash: device.tokenHash,
      label: cleanText(device.label, LABEL_LIMIT),
      host: cleanText(device.host, HOST_LIMIT),
      createdAt: Number(device.createdAt) || 0,
      lastSeenAt: Number(device.lastSeenAt) || 0,
    }));
}

// Devices hold only the hash of their cookie, under the key they were paired with: a new key drops them all.
export function createDeviceSessions({ saved = null, keyId, now = Date.now, newId }) {
  let currentKeyId = keyId;
  let devices = savedDevicesOf(saved, keyId);
  const listeners = new Set();
  const emit = () => listeners.forEach((listener) => listener());

  function dropIdle() {
    const oldest = now() - IDLE_LIMIT_MS;
    const active = devices.filter((device) => device.lastSeenAt > oldest);
    if (active.length === devices.length) return;
    devices = active;
    emit();
  }

  function add({ tokenHash, label, host }) {
    dropIdle();
    const at = now();
    const device = { id: newId(), tokenHash, label: cleanText(label, LABEL_LIMIT), host: cleanText(host, HOST_LIMIT), createdAt: at, lastSeenAt: at };
    const byLastUse = [...devices].sort((a, b) => b.lastSeenAt - a.lastSeenAt);
    devices = [...byLastUse.slice(0, DEVICE_LIMIT - 1), device];
    emit();
    return { ...device };
  }

  function findByTokenHash(tokenHash) {
    dropIdle();
    const device = devices.find((candidate) => candidate.tokenHash === tokenHash);
    return device ? { ...device } : null;
  }

  function touch(id) {
    const device = devices.find((candidate) => candidate.id === id);
    if (!device) return;
    const at = now();
    const isWorthSaving = at - device.lastSeenAt >= TOUCH_SAVE_MS;
    device.lastSeenAt = at;
    if (isWorthSaving) emit();
  }

  function revoke(id) {
    const remaining = devices.filter((device) => device.id !== id);
    if (remaining.length === devices.length) return false;
    devices = remaining;
    emit();
    return true;
  }

  function useKey(nextKeyId) {
    if (nextKeyId === currentKeyId) return;
    currentKeyId = nextKeyId;
    devices = [];
    emit();
  }

  return {
    add,
    findByTokenHash,
    touch,
    revoke,
    useKey,
    keyId: () => currentKeyId,
    list: () => devices.map((device) => ({ ...device })),
    snapshot: () => ({ version: SAVED_VERSION, keyId: currentKeyId, devices: devices.map((device) => ({ ...device })) }),
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const publicDeviceOf = (device, currentId) => ({
  id: device.id, label: device.label, host: device.host, createdAt: device.createdAt, lastSeenAt: device.lastSeenAt, isCurrent: device.id === currentId,
});
