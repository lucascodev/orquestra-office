import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { decodePathSegment } from "./url-path.js";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

export async function serveFile(res, rootDir, urlPath) {
  const decoded = decodePathSegment(urlPath === "/" ? "/index.html" : urlPath);
  if (decoded === null) return false;
  const relative = normalize(decoded).replace(/^([/\\])+/, "");
  const root = normalize(rootDir + sep);
  const target = normalize(join(root, relative));
  const type = TYPES[extname(target)];
  if (!target.startsWith(root) || !type) return false;
  try {
    const body = await readFile(target);
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}
