// "no-referrer" would also make browsers send "Origin: null" on the office's own POSTs, and isSameOrigin refuses that.
// img-src keeps an image in a plan or a failure message from calling another site; there is no default-src, which
// would also block the scripts and styles the page loads today.
const SECURITY_HEADERS = Object.freeze({
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "frame-ancestors 'none'; img-src 'self' data: blob:",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "same-origin",
});

// The office has buttons that approve commands, so no other site may frame it, sniff it or embed its responses.
export function applySecurityHeaders(res) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
}
