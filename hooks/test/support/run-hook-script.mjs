import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const HOOKS_DIR = fileURLToPath(new URL("../../", import.meta.url)).replace(/[\\/]$/, "");

export const THROWAWAY_SECRET = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8";
const THROWAWAY_HOME = mkdtempSync(join(tmpdir(), "office-throwaway-home-"));
process.on("exit", () => rmSync(THROWAWAY_HOME, { recursive: true, force: true }));
mkdirSync(join(THROWAWAY_HOME, ".orquestra-office"));
writeFileSync(join(THROWAWAY_HOME, ".orquestra-office", "secret"), `${THROWAWAY_SECRET}\n`);

// The child never inherits the real environment, and its home is a throwaway folder, already holding an office secret,
// unless a test passes another, so a test can never reach the user's ~/.claude, ~/.codex or ~/.orquestra-office.
export const BASE_ENV = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, HOME: THROWAWAY_HOME, USERPROFILE: THROWAWAY_HOME };

const RECORD_FETCH = pathToFileURL(fileURLToPath(new URL("./record-fetch.mjs", import.meta.url))).href;

export function runScript(scriptPath, { env = {}, args = [], input = "", cwd, nodeArgs = [] } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [...nodeArgs, scriptPath, ...args], { env: { ...BASE_ENV, ...env }, cwd });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    // A hook that exits without reading its input closes the pipe first; that is a valid outcome, not a test failure.
    child.stdin.on("error", (error) => { if (error.code !== "EPIPE") reject(error); });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}

export const runHookScript = (scriptName, options) => runScript(join(HOOKS_DIR, scriptName), options);

export async function runRecordingFetch(t, scriptName, { env = {}, input = "" } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "office-fetch-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const log = join(dir, "fetch.log");
  const result = await runHookScript(scriptName, { env: { ...env, FETCH_LOG: log }, input, nodeArgs: ["--import", RECORD_FETCH] });
  const urls = existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean) : [];
  return { ...result, urls };
}

export const requestedUrls = async (t, scriptName, options) => (await runRecordingFetch(t, scriptName, options)).urls;
