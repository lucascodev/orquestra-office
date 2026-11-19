import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { activityAuthorizationOf } from "./lib/activity-authorization.mjs";
import { canLookUpGitSafely } from "./lib/git-lookup.mjs";
import { officeUrlFromArguments } from "./lib/office-url.mjs";
import { readStdin } from "./lib/read-stdin.mjs";

const OFFICE_URL = officeUrlFromArguments(process.argv.slice(2));
const REPORT_TIMEOUT_MS = 1_500;
const GIT_TIMEOUT_MS = 1_500;
const TEAM_LIMIT = 40;
const AGENT_FILE = /\.md$/i;
const CAN_LOOK_UP_GIT = canLookUpGitSafely({ platform: process.platform, libuvVersion: process.versions.uv });

// Without the secret the collector would take this report for an old hook; there is nothing useful to send.
const AUTHORIZATION = OFFICE_URL === null ? null : activityAuthorizationOf(homedir());

if (AUTHORIZATION === null) process.exit(0);

// Without this variable Windows looks for git.exe in cwd before PATH, and cwd is whatever repository the session opened.
// libuv reads it from this process's own environment when it searches for the program, so the child's env option alone is not enough.
process.env.NoDefaultCurrentDirectoryInExePath = "1";

// A worktree shares the main repository's .git folder, so its parent is the project every worktree belongs to.
function repositoryRoot(cwd) {
  if (!CAN_LOOK_UP_GIT) return "";
  try {
    const commonDir = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd, timeout: GIT_TIMEOUT_MS, stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" }).trim();
    return basename(commonDir) === ".git" ? dirname(commonDir) : "";
  } catch {
    return "";
  }
}

// Only the file names are read: the role names, never what the agent files say.
function definedTeam(projectRoot) {
  try {
    return readdirSync(join(projectRoot, ".claude", "agents")).filter((name) => AGENT_FILE.test(name)).map((name) => name.replace(AGENT_FILE, "")).slice(0, TEAM_LIMIT);
  } catch {
    return [];
  }
}

async function reportToOffice(payload) {
  try {
    await fetch(`${OFFICE_URL}/events/claude`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: AUTHORIZATION }, body: JSON.stringify(payload), signal: AbortSignal.timeout(REPORT_TIMEOUT_MS),
    });
  } catch {
    // The office being down must never hold a session from starting.
  }
}

// Nothing is printed: on SessionStart, anything a hook writes to stdout is added to the model's context.
try {
  const payload = JSON.parse(await readStdin());
  const cwd = typeof payload.cwd === "string" && payload.cwd ? payload.cwd : process.cwd();
  const repoRoot = repositoryRoot(cwd);
  await reportToOffice({ ...payload, office: { repoRoot, team: definedTeam(repoRoot || cwd) } });
} catch {
  process.exitCode = 0;
}
