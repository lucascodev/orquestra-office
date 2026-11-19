import { createRunnerAuth } from "./auth/runner-auth.js";
import { createClaudeLauncher } from "./claude/claude-process.js";
import { createServer } from "./http/server.js";
import { isDirectory } from "./infra/is-directory.js";
import { createOfficeSecretFile } from "./infra/office-secret-file.js";
import { createSessionRegistry } from "./sessions/session-registry.js";

// Tests pass startProcess to stand in for Claude Code; everyone else gets the real launcher built from claude.
export function createRunner({ allowedOrigins, claude = {}, startProcess = createClaudeLauncher(claude), secretFile = null }) {
  const registry = createSessionRegistry({ startProcess, isDirectory });
  const runnerAuth = createRunnerAuth({ readOfficeKey: createOfficeSecretFile(secretFile) });
  const server = createServer({ registry, allowedOrigins, runnerAuth });

  return { server, stop: () => registry.stopAll() };
}
