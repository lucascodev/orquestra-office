import { homedir } from "node:os";
import { activityAuthorizationOf } from "./lib/activity-authorization.mjs";
import { officeUrlFromArguments } from "./lib/office-url.mjs";
import { readStdin } from "./lib/read-stdin.mjs";
import { statusLineText } from "./lib/status-line-text.mjs";

const OFFICE_URL = officeUrlFromArguments(process.argv.slice(2));
const REPORT_TIMEOUT_MS = 800;

const AUTHORIZATION = OFFICE_URL === null ? null : activityAuthorizationOf(homedir());

// A refused --office-url, or a missing secret, only stops the report; the terminal keeps its status line.
async function reportToOffice(body) {
  if (AUTHORIZATION === null) return;
  try {
    await fetch(`${OFFICE_URL}/events/statusline`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: AUTHORIZATION }, body, signal: AbortSignal.timeout(REPORT_TIMEOUT_MS),
    });
  } catch {
    // The office being down must never break the terminal's status line.
  }
}

const input = await readStdin();
await reportToOffice(input);
try {
  console.log(statusLineText(JSON.parse(input)));
} catch {
  console.log("");
}
