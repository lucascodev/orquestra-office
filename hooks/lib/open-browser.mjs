import { spawn } from "node:child_process";

// Only what a pairing link holds: no quote, space, &, %, ^ or anything else a shell or cmd.exe would act on.
const SAFE_LINK = /^https?:\/\/[\w.:[\]-]+\/#pair=[\w-]+$/;

export const isSafeLink = (link) => SAFE_LINK.test(link);

export function browserCommandFor(platform, link) {
  if (!isSafeLink(link)) throw new TypeError(`refusing to open ${JSON.stringify(link)}`);
  if (platform === "win32") return ["cmd.exe", ["/d", "/c", "start", "", link]];
  if (platform === "darwin") return ["open", [link]];
  return ["xdg-open", [link]];
}

export function openBrowser(link, { platform = process.platform, run = spawn } = {}) {
  const [command, args] = browserCommandFor(platform, link);
  const child = run(command, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.on("error", () => {});
  child.unref();
}
