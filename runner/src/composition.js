import { createClaudeLauncher } from "./claude/claude-process.js";
import { createServer } from "./http/server.js";
import { isDirectory } from "./infra/is-directory.js";
import { createSessionRegistry } from "./sessions/session-registry.js";

// Tests pass startProcess to stand in for Claude Code; everyone else gets the real launcher built from claude.
export function createRunner({ allowedOrigins, claude = {}, startProcess = createClaudeLauncher(claude) }) {
  const registry = createSessionRegistry({ startProcess, isDirectory });
  const server = createServer({ registry, allowedOrigins });

  return { server, stop: () => registry.stopAll() };
}
