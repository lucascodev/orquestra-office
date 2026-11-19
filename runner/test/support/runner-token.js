import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runnerTicketMessage } from "../../../collector/src/shared/auth/signed-message.js";

export const TEST_SECRET = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8";

let processSecretFile = null;

// For tests whose helpers have no test context: one secret file for the whole run, removed when it ends.
export function processWideSecretFile() {
  if (processSecretFile) return processSecretFile;
  const dir = mkdtempSync(join(tmpdir(), "runner-secret-"));
  process.on("exit", () => rmSync(dir, { recursive: true, force: true }));
  processSecretFile = join(dir, "secret");
  writeFileSync(processSecretFile, `${TEST_SECRET}\n`);
  return processSecretFile;
}

const ticketFor = (nonce) => createHmac("sha256", Buffer.from(TEST_SECRET, "base64url")).update(runnerTicketMessage(nonce)).digest("base64url");

// What the office page does: a challenge from the runner, a ticket the collector signs for it, then the token.
export async function runnerTokenOf(base, origin) {
  const headers = { "Content-Type": "application/json", Origin: origin };
  const { nonce } = await (await fetch(`${base}/auth/challenge`, { method: "POST", headers, body: "{}" })).json();
  const res = await fetch(`${base}/auth/session`, { method: "POST", headers, body: JSON.stringify({ nonce, ticket: ticketFor(nonce) }) });
  return (await res.json()).token;
}
