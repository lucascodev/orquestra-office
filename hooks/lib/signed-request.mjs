import { SIGNATURE_HEADER, isResponseSigned, newNonce, signedRequestHeaders } from "./signed-message.mjs";

const OK_STATUS = 200;
const ANSWER_LIMIT_BYTES = 1024 * 1024;

async function readCapped(response) {
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body ?? []) {
    size += chunk.length;
    if (size > ANSWER_LIMIT_BYTES) throw new Error(`the office answer is over ${ANSWER_LIMIT_BYTES} bytes`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

// Only an answer signed with this machine's secret and bound to this request's nonce is read; anything else throws.
export async function postSigned({ officeUrl, path, payload, key, timeoutMs }) {
  const body = JSON.stringify(payload);
  const nonce = newNonce();
  const response = await fetch(`${officeUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...signedRequestHeaders({ key, path, nonce, body }) },
    body,
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await readCapped(response);
  if (response.status !== OK_STATUS) throw new Error(`the office answered ${response.status}`);
  if (!isResponseSigned({ key, path, nonce, status: response.status, body: text, header: response.headers.get(SIGNATURE_HEADER) })) {
    throw new Error("the office answer is not signed with this machine's secret");
  }
  return JSON.parse(text);
}
