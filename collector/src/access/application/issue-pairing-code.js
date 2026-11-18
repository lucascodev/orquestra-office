import { pairingLinksOf } from "../domain/pairing-links.js";

export function createIssuePairingCode({ pairingCodes, lanHosts = [] }) {
  return function issuePairingCode({ requestHost }) {
    const issued = pairingCodes.issue();
    if (!issued) return null;
    return { ...issued, urls: pairingLinksOf({ requestHost, lanHosts, code: issued.code }) };
  };
}
