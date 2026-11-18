export const SIGNATURE_VERSION = "v1";
export const NONCE_HEADER = "x-office-nonce";
export const SIGNATURE_HEADER = "x-office-signature";
export const ACTIVITY_TOKEN_LABEL = "orquestra-office/activity-token/v1";
export const KEY_ID_LABEL = "orquestra-office/key-id/v1";

const REQUEST_LABEL = "orquestra-office/request/v1";
const RESPONSE_LABEL = "orquestra-office/response/v1";
const RUNNER_TICKET_LABEL = "orquestra-office/runner-ticket/v1";
const FIELD_SEPARATOR = "\n";
const SIGNATURE_PREFIX = `${SIGNATURE_VERSION}=`;
const NONCE = /^[\w-]{22}$/;

// Fields are joined by line breaks, so a field holding one could shift the others and sign a different message.
function messageOf(fields) {
  const parts = fields.map(String);
  if (parts.some((part) => part.includes(FIELD_SEPARATOR))) throw new TypeError("a signed field cannot hold a line break");
  return parts.join(FIELD_SEPARATOR);
}

export const requestMessage = ({ path, nonce, bodyHash }) => messageOf([REQUEST_LABEL, path, nonce, bodyHash]);

export const responseMessage = ({ path, nonce, status, bodyHash }) => messageOf([RESPONSE_LABEL, path, nonce, status, bodyHash]);

export const runnerTicketMessage = (nonce) => messageOf([RUNNER_TICKET_LABEL, nonce]);

export const signatureHeaderOf = (signature) => `${SIGNATURE_PREFIX}${signature}`;

export const signatureFromHeader = (value) => (typeof value === "string" && value.startsWith(SIGNATURE_PREFIX) ? value.slice(SIGNATURE_PREFIX.length) : null);

export const isNonce = (value) => typeof value === "string" && NONCE.test(value);
