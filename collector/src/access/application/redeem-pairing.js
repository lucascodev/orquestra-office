export function createRedeemPairing({ pairingCodes, deviceSessions, newSessionToken, hashToken, currentKeyId }) {
  return function redeemPairing({ code, label, host }) {
    const keyId = currentKeyId();
    if (!keyId) return null;
    deviceSessions.useKey(keyId);
    if (!pairingCodes.redeem(code)) return null;
    const token = newSessionToken();
    const device = deviceSessions.add({ tokenHash: hashToken(token), label, host });
    return { token, device };
  };
}
