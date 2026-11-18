import { copyFileSync } from "node:fs";

export const backupStamp = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");

export function backupConfig(path, now = new Date()) {
  const backupPath = `${path}.bak-${backupStamp(now)}`;
  copyFileSync(path, backupPath);
  return backupPath;
}
