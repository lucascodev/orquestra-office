// A rotated secret changes the key id, and with it every paired device stops being found.
export function createIdentifyDevice({ deviceSessions, hashToken, currentKeyId }) {
  return function identifyDevice(token) {
    const keyId = currentKeyId();
    if (!keyId || typeof token !== "string" || token === "") return null;
    deviceSessions.useKey(keyId);
    const device = deviceSessions.findByTokenHash(hashToken(token));
    if (device) deviceSessions.touch(device.id);
    return device;
  };
}
