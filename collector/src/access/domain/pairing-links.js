const PORT_SUFFIX = /:\d+$/;
const PAIRING_FRAGMENT = "#pair=";

// The code travels in the fragment, which the browser never sends to a server nor puts in a Referer.
export function pairingLinksOf({ requestHost, lanHosts, code }) {
  const port = PORT_SUFFIX.exec(requestHost)?.[0] ?? "";
  const requestName = requestHost.replace(PORT_SUFFIX, "").toLowerCase();
  const hosts = [requestHost, ...lanHosts.filter((host) => host.toLowerCase() !== requestName).map((host) => `${host}${port}`)];
  return [...new Set(hosts)].map((host) => `http://${host}/${PAIRING_FRAGMENT}${code}`);
}
