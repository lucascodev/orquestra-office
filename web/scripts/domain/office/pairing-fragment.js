const PAIRING_FRAGMENT = /^#pair=([\w-]{22})$/;

export const pairingCodeOf = (hash) => PAIRING_FRAGMENT.exec(String(hash ?? ""))?.[1] ?? null;
