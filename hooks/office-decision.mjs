import { parseArgs } from "node:util";
import { permissionOutput, questionOutput, stopOutput } from "./lib/hook-output.mjs";
import { OFFICE_URL_OPTION, parseOfficeUrl } from "./lib/office-url.mjs";
import { readSecretFile } from "./lib/office-secret.mjs";
import { readStdin } from "./lib/read-stdin.mjs";
import { postSigned } from "./lib/signed-request.mjs";

const DECISION_TIMEOUT_MS = 140_000;
const STOP_TIMEOUT_MS = 4_000;
const QUESTION_TOOL = "AskUserQuestion";

const isBlankList = (list) => Array.isArray(list) && list.every((item) => typeof item === "string" && item.trim() === "");

const PERMISSION = {
  path: "/hooks/claude/permission",
  timeoutMs: DECISION_TIMEOUT_MS,
  outputOf: (answer) => permissionOutput(answer),
  isUndecided: (answer) => answer?.decision === null,
};
const QUESTION = {
  path: "/hooks/claude/question",
  timeoutMs: DECISION_TIMEOUT_MS,
  outputOf: (answer, payload) => questionOutput(answer, payload.tool_input),
  isUndecided: (answer) => answer?.answers === null,
};
const STOP = {
  path: "/hooks/claude/stop",
  timeoutMs: STOP_TIMEOUT_MS,
  outputOf: (answer) => stopOutput(answer),
  isUndecided: (answer) => isBlankList(answer?.messages),
};

function routeOf(payload) {
  switch (payload?.hook_event_name) {
    case "PermissionRequest":
      return PERMISSION;
    case "PreToolUse":
      return payload.tool_name === QUESTION_TOOL ? QUESTION : null;
    case "Stop":
      return STOP;
    default:
      return null;
  }
}

// Every failure ends here: exit 0 with nothing on stdout hands the request back to the terminal, as if the office were closed.
function leaveToTerminal(reason) {
  console.error(`orquestra-office: ${reason}`);
  process.exit(0);
}

// The address and the secret come from the arguments the installer wrote, never from the environment:
// a project's .claude/settings.json can set environment variables, and with them point the hook at a key it chose.
function settingsFromArguments() {
  const { values } = parseArgs({ options: { [OFFICE_URL_OPTION]: { type: "string" }, "secret-file": { type: "string" } }, strict: false });
  const officeUrl = parseOfficeUrl(values[OFFICE_URL_OPTION] ?? "", { allowRemote: true });
  if (!officeUrl.origin) leaveToTerminal(`no usable --office-url (${officeUrl.problem})`);
  const key = typeof values["secret-file"] === "string" ? readSecretFile(values["secret-file"]) : null;
  if (!key) leaveToTerminal("the office secret is missing or invalid; run node hooks/install-claude-hooks.mjs");
  return { officeUrl: officeUrl.origin, key };
}

function payloadOf(input) {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

const payload = payloadOf(await readStdin());
const route = routeOf(payload);
if (!route) process.exit(0);
const { officeUrl, key } = settingsFromArguments();

try {
  const answer = await postSigned({ officeUrl, path: route.path, payload, key, timeoutMs: route.timeoutMs });
  const output = route.outputOf(answer, payload);
  if (output) process.stdout.write(`${JSON.stringify(output)}\n`);
  else if (!route.isUndecided(answer)) leaveToTerminal("the office answer is outside the contract");
} catch (error) {
  leaveToTerminal(error.message);
}
