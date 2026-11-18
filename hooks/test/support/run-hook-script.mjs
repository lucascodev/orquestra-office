import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export const HOOKS_DIR = fileURLToPath(new URL("../../", import.meta.url)).replace(/[\\/]$/, "");

// The child never inherits the real environment, so a test can never reach the user's ~/.claude or ~/.codex.
const BASE_ENV = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot };

export function runHookScript(scriptName, { env = {}, args = [], input = "", cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [`${HOOKS_DIR}/${scriptName}`, ...args], { env: { ...BASE_ENV, ...env }, cwd });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}
