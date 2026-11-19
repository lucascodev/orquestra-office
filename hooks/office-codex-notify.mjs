import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { activityAuthorizationOf } from "./lib/activity-authorization.mjs";
import { chainedArgumentsOf } from "./lib/codex-chain.mjs";
import { officeUrlFromArguments } from "./lib/office-url.mjs";

const REPORT_TIMEOUT_MS = 3000;

const { officeArgs, previous, turn } = chainedArgumentsOf(process.argv.slice(2));
const officeUrl = officeUrlFromArguments(officeArgs);

// A refused --office-url or a missing secret only skips the report: the previous command must still get the turn.
async function reportToOffice() {
  const authorization = officeUrl === null ? null : activityAuthorizationOf(homedir());
  if (authorization === null || turn === undefined) return;
  try {
    await fetch(`${officeUrl}/events/codex`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: authorization }, body: turn, signal: AbortSignal.timeout(REPORT_TIMEOUT_MS),
    });
  } catch {
    // Codex never reads what a notify command says, so the office being down has nowhere to be reported.
  }
}

// No shell: the previous command runs exactly as it was written in config.toml, with the turn as its last argument.
function runPrevious() {
  const [program, ...args] = previous;
  if (program === undefined || turn === undefined) return Promise.resolve();
  return new Promise((resolve) => {
    const child = spawn(program, [...args, turn], { stdio: "ignore", windowsHide: true });
    child.on("error", resolve);
    child.on("exit", resolve);
  });
}

await Promise.all([reportToOffice(), runPrevious()]);
