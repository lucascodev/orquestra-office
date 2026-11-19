const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

// On this machine the page can tell you which command pairs it; elsewhere it points you to a paired browser instead.
export const isLoopbackHost = (hostname) => LOOPBACK_HOSTS.has(String(hostname ?? "").toLowerCase());
