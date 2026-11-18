import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { applyNotify, configLines, configText } from "./lib/codex-config.mjs";

const officeUrl = process.env.OFFICE_URL ?? "http://127.0.0.1:8420";
const isRemoving = process.argv.includes("--remove");
const configPath = join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "config.toml");

const lines = existsSync(configPath) ? configLines(readFileSync(configPath, "utf8")) : [];
const result = applyNotify(lines, { isRemoving, officeUrl });

if (result.foreignNotifyLine !== undefined) {
  console.error(`${configPath} already has another notify command:\n  ${result.foreignNotifyLine}\nNothing was changed. Codex accepts a single notify command; merge them by hand if you want both.`);
  process.exit(1);
}

if (existsSync(configPath)) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  copyFileSync(configPath, `${configPath}.bak-${stamp}`);
  console.log(`Backup: ${configPath}.bak-${stamp}`);
}

mkdirSync(dirname(configPath), { recursive: true });
writeFileSync(configPath, configText(result.lines));
console.log(isRemoving ? `Office notify removed from ${configPath}.` : `Office notify installed in ${configPath}. Codex turns will show up at ${officeUrl}.`);
