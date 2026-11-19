// A browser that redeems a code while still paired gets a new cookie, so its old device would be left in the list unused.
export function createRedeemPairing({ pairingCodes, deviceSessions, newSessionToken, hashToken, currentKeyId }) {
  return function redeemPairing({ code, label, host, previousDeviceId = null }) {
    const keyId = currentKeyId();
    if (!keyId) return null;
    deviceSessions.useKey(keyId);
    if (!pairingCodes.redeem(code)) return null;
    const token = newSessionToken();
    const device = deviceSessions.add({ tokenHash: hashToken(token), label, host });
    if (previousDeviceId) deviceSessions.revoke(previousDeviceId);
    return { token, device };
  };
}
