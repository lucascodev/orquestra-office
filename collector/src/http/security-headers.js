// "no-referrer" would also make browsers send "Origin: null" on the office's own POSTs, and isSameOrigin refuses that.
const SECURITY_HEADERS = Object.freeze({
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "same-origin",
});

// The office has buttons that approve commands, so no other site may frame it, sniff it or embed its responses.
export function applySecurityHeaders(res) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
}
