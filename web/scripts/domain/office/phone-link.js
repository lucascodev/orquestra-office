const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const hostNameOf = (link) => {
  try {
    return new URL(link).hostname;
  } catch {
    return "";
  }
};

// A phone cannot reach this machine's localhost, so the QR shows the network address whenever there is one.
export const phoneLinkOf = (urls) => urls.find((link) => !LOOPBACK_HOSTS.has(hostNameOf(link))) ?? urls[0] ?? null;
