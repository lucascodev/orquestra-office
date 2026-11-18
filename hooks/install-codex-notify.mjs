import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const OFFICE_URL = process.env.OFFICE_URL ?? "http://127.0.0.1:8420";
const NOTIFY = ["curl", "-s", "-m", "3", "-X", "POST", "-H", "Content-Type: application/json", `${OFFICE_URL}/events/codex`, "--data-raw"];
const NOTIFY_LINE = `notify = ${JSON.stringify(NOTIFY).replace(/,/g, ", ")}`;
const remove = process.argv.includes("--remove");
const configPath = join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "config.toml");

const lines = existsSync(configPath) ? readFileSync(configPath, "utf8").split(/\r?\n/) : [];
const firstTable = lines.findIndex((line) => /^\s*\[/.test(line));
const rootEnd = firstTable === -1 ? lines.length : firstTable;
const notifyIndex = lines.slice(0, rootEnd).findIndex((line) => /^\s*notify\s*=/.test(line));
const isOurs = notifyIndex !== -1 && lines[notifyIndex].includes("/events/codex");

if (notifyIndex !== -1 && !isOurs) {
  console.error(`${configPath} already has another notify command:\n  ${lines[notifyIndex]}\nNothing was changed. Codex accepts a single notify command; merge them by hand if you want both.`);
  process.exit(1);
}

if (existsSync(configPath)) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  copyFileSync(configPath, `${configPath}.bak-${stamp}`);
  console.log(`Backup: ${configPath}.bak-${stamp}`);
}

if (isOurs) lines.splice(notifyIndex, 1);
if (!remove) lines.unshift(NOTIFY_LINE);

mkdirSync(dirname(configPath), { recursive: true });
writeFileSync(configPath, `${lines.join("\n").replace(/\n+$/, "")}\n`);
console.log(remove ? `Office notify removed from ${configPath}.` : `Office notify installed in ${configPath}. Codex turns will show up at ${OFFICE_URL}.`);
