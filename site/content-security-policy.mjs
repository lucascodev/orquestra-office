const LANDING_DIRECTIVES = [
  ["default-src", "'self'"],
  ["script-src", "'self'"],
  ["style-src", "'self'"],
  ["img-src", "'self'"],
  ["frame-src", "'self'"],
  ["connect-src", "'none'"],
  ["object-src", "'none'"],
  ["base-uri", "'none'"],
  ["form-action", "'none'"],
];

const policyOf = (directives) => directives.map(([name, sources]) => `${name} ${sources}`).join("; ");

export const LANDING_CONTENT_SECURITY_POLICY = policyOf(LANDING_DIRECTIVES);
