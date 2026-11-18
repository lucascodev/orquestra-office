import { spawn } from "node:child_process";
import { lineReader, parseEvent } from "./json-lines.js";

const STREAM_ARGS = ["-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose", "--include-partial-messages"];
const STDERR_TAIL = 2_000;
const STOP_GRACE_MS = 5_000;

export function createClaudeLauncher({ command = "claude", model = "" } = {}) {
  const args = model ? [...STREAM_ARGS, "--model", model] : STREAM_ARGS;

  return function startClaudeProcess({ cwd, onEvent, onExit }) {
    const child = spawn(command, args, { cwd, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let stderrTail = "";
    let hasExited = false;
    let controlRequests = 0;

    const exitOnce = (outcome) => {
      if (hasExited) return;
      hasExited = true;
      onExit(outcome);
    };
    const write = (message) => {
      if (!hasExited && child.stdin.writable) child.stdin.write(`${JSON.stringify(message)}\n`);
    };

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", lineReader((line) => {
      const event = parseEvent(line);
      if (event) onEvent(event);
    }));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderrTail = (stderrTail + chunk).slice(-STDERR_TAIL); });
    child.stdin.on("error", () => { /* the process is gone; "exit" reports it */ });
    child.on("error", (error) => exitOnce({ code: null, error: error.message }));
    child.on("exit", (code) => exitOnce({ code, error: code === 0 ? "" : stderrTail.trim() }));

    return {
      send: (text) => write({ type: "user", message: { role: "user", content: [{ type: "text", text }] } }),
      interrupt: () => {
        controlRequests += 1;
        write({ type: "control_request", request_id: `office-${controlRequests}`, request: { subtype: "interrupt" } });
      },
      stop: () => {
        if (hasExited) return;
        child.stdin.end();
        setTimeout(() => { if (!hasExited) child.kill(); }, STOP_GRACE_MS).unref();
      },
    };
  };
}
