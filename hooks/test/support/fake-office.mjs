import { createServer } from "node:http";

const LOOPBACK = "127.0.0.1";
const ANY_FREE_PORT = 0;
const EMPTY_ANSWER = () => ({ status: 200, text: "", headers: {} });

// answer receives each request (url, headers, body) and returns the status, text and headers to send back.
export async function startFakeOffice(t, { answer = EMPTY_ANSWER } = {}) {
  const requests = [];
  const server = createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const recorded = {
        method: request.method,
        url: request.url,
        contentType: request.headers["content-type"],
        authorization: request.headers.authorization ?? null,
        body: Buffer.concat(chunks).toString("utf8"),
      };
      requests.push(recorded);
      const { status = 200, text = "", headers = {} } = answer({ ...recorded, headers: request.headers });
      response.writeHead(status, headers);
      response.end(text);
    });
  });
  await new Promise((resolve) => server.listen(ANY_FREE_PORT, LOOPBACK, resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  return { url: `http://${LOOPBACK}:${server.address().port}`, requests };
}
