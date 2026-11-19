import { postSigned } from "./hook-client.js";

const SESSION_COOKIE = /^office_session=([\w-]+);/;

export async function bootstrapChallengeOf(base, options) {
  const answer = await postSigned(base, "/pairing/challenge", {}, options);
  if (answer.status !== 200 || !answer.isSigned) throw new Error(`challenge failed with ${answer.status}`);
  return answer.body.challenge;
}

export async function issueBootstrapCode(base, options) {
  const answer = await postSigned(base, "/pairing/bootstrap", { challenge: await bootstrapChallengeOf(base, options) }, options);
  if (answer.status !== 200 || !answer.isSigned) throw new Error(`bootstrap failed with ${answer.status}`);
  return answer.body.code;
}

export async function redeem(base, code, { origin = base, label = "test browser" } = {}) {
  return fetch(`${base}/api/pairings/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ code, label }),
  });
}

export const cookieOf = (res) => {
  const [, token] = SESSION_COOKIE.exec(res.headers.get("set-cookie") ?? "") ?? [];
  return token ? `office_session=${token}` : null;
};

// A browser paired the way the opener command pairs the first one: a signed bootstrap, then the code redeemed by the page.
export async function pairBrowser(base, options) {
  const res = await redeem(base, await issueBootstrapCode(base, options));
  const cookie = cookieOf(res);
  if (!cookie) throw new Error(`redeem failed with ${res.status}`);
  const withCookie = (headers = {}) => ({ Cookie: cookie, ...headers });
  return {
    cookie,
    get: (path, { headers, signal } = {}) => fetch(`${base}${path}`, { headers: withCookie(headers), signal }),
    post: (path, body, headers = {}) => fetch(`${base}${path}`, {
      method: "POST",
      headers: withCookie({ "Content-Type": "application/json", Origin: base, ...headers }),
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  };
}
