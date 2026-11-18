import { createServer } from "node:http";

const LOOPBACK = "127.0.0.1";
const ANY_FREE_PORT = 0;

export async function startFakeOffice(t) {
  const requests = [];
  const server = createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      requests.push({ method: request.method, url: request.url, contentType: request.headers["content-type"], body: Buffer.concat(chunks).toString("utf8") });
      response.end();
    });
  });
  await new Promise((resolve) => server.listen(ANY_FREE_PORT, LOOPBACK, resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return { url: `http://${LOOPBACK}:${server.address().port}`, requests };
}
