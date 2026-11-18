export function createRevokeDevice({ deviceSessions, onRevoked = () => {} }) {
  return function revokeDevice(id) {
    if (!deviceSessions.revoke(String(id ?? ""))) return false;
    onRevoked(id);
    return true;
  };
}
