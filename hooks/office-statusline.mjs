import { statusLineText } from "./lib/status-line-text.mjs";

const OFFICE_URL = process.env.OFFICE_URL ?? "http://127.0.0.1:8420";
const REPORT_TIMEOUT_MS = 800;

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function reportToOffice(body) {
  try {
    await fetch(`${OFFICE_URL}/events/statusline`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(REPORT_TIMEOUT_MS),
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
