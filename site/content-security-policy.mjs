const STYLE_DIRECTIVE = "style-src";
const INLINE_STYLE_SOURCES = "'self' 'unsafe-inline'";

const LANDING_DIRECTIVES = [
  ["default-src", "'self'"],
  ["script-src", "'self'"],
  [STYLE_DIRECTIVE, "'self'"],
  ["img-src", "'self'"],
  ["frame-src", "'self'"],
  ["connect-src", "'none'"],
  ["object-src", "'none'"],
  ["base-uri", "'none'"],
  ["form-action", "'none'"],
];

const policyOf = (directives) => directives.map(([name, sources]) => `${name} ${sources}`).join("; ");

export const LANDING_CONTENT_SECURITY_POLICY = policyOf(LANDING_DIRECTIVES);

export const DEMO_CONTENT_SECURITY_POLICY = policyOf(LANDING_DIRECTIVES.map(([name, sources]) => [name, name === STYLE_DIRECTIVE ? INLINE_STYLE_SOURCES : sources]));
