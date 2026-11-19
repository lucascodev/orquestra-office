import { createHash, randomBytes } from "node:crypto";

const SESSION_TOKEN_BYTES = 32;
const PAIRING_CODE_BYTES = 16;
const DEVICE_ID_BYTES = 9;

export const newSessionToken = () => randomBytes(SESSION_TOKEN_BYTES).toString("base64url");

export const newPairingCode = () => randomBytes(PAIRING_CODE_BYTES).toString("base64url");

export const newDeviceId = () => randomBytes(DEVICE_ID_BYTES).toString("base64url");

export const hashToken = (token) => createHash("sha256").update(token).digest("hex");
