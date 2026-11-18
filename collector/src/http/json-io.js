export const BODY_TOO_LARGE = "BODY_TOO_LARGE";

const bodyTooLargeError = (limitBytes) => Object.assign(new Error(`request body is over ${limitBytes} bytes`), { code: BODY_TOO_LARGE });
const EMPTY_BODY = Buffer.alloc(0);

export function readRawBody(req, limitBytes) {
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
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", () => resolve(EMPTY_BODY));
  });
}

// Broken JSON reads as null, so a hook never blocks Claude Code; only a body over the limit is refused.
export function parseJsonOrNull(body) {
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    return null;
  }
}

export async function readJsonBody(req, limitBytes) {
  return parseJsonOrNull(await readRawBody(req, limitBytes));
}

export function sendJsonText(res, status, text, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(text);
}

export function sendJson(res, status, body, headers = {}) {
  sendJsonText(res, status, JSON.stringify(body), headers);
}
