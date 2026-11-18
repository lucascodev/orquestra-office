export const BODY_TOO_LARGE = "BODY_TOO_LARGE";

const bodyTooLargeError = (limitBytes) => Object.assign(new Error(`request body is over ${limitBytes} bytes`), { code: BODY_TOO_LARGE });

// Broken JSON reads as null, so a hook never blocks Claude Code; only a body over the limit is refused.
export function readJsonBody(req, limitBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const collect = (chunk) => {
      size += chunk.length;
      if (size <= limitBytes) return chunks.push(chunk);
      req.off("data", collect);
      return reject(bodyTooLargeError(limitBytes));
    };
    req.on("data", collect);
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

export function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}
