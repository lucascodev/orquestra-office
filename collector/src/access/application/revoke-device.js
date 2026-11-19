export function createRevokeDevice({ deviceSessions }) {
  return (id) => deviceSessions.revoke(String(id ?? ""));
}
