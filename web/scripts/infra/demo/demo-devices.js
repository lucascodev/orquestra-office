const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const PAIRING_TTL_MS = 120_000;
const DEMO_CODE = "demoAAAAAAAAAAAAAAAAAA";

// The demo never reaches a collector, so the devices and the pairing code are made up here.
export function demoDevices(now) {
  return [
    { id: "demo-laptop", label: "Chrome no Windows", host: "localhost:8420", createdAt: now - 12 * DAY, lastSeenAt: now, isCurrent: true },
    { id: "demo-phone", label: "Safari no iPhone", host: "192.168.0.50:8420", createdAt: now - 3 * DAY, lastSeenAt: now - 2 * HOUR, isCurrent: false },
  ];
}

export const demoPairingCode = (now) => ({ code: DEMO_CODE, expiresAt: now + PAIRING_TTL_MS, urls: [`http://192.168.0.50:8420/#pair=${DEMO_CODE}`] });
