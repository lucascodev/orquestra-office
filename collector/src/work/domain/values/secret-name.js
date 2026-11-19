// A name holds a secret when one of its words is a secret word: access_token, clientSecret, AWS_SECRET_ACCESS_KEY and
// --secret-key do, while passed, bypass, tokens and token_count do not.
const SECRET_WORD = /(?:^|_)(?:pass(?:word|wd)?|pwd|secret|(?:api_?|auth_?)?token|api_?key|access_?key|private_?key|credentials?)(?:$|_)/;
// A shell variable written in capitals is a setting, so a bare KEY there is a key (STRIPE_KEY), unlike "key: name" in text.
const SHELL_KEY_WORD = /(?:^|_)key(?:$|_)/;
const SHELL_VARIABLE = /^[A-Z][A-Z0-9_]*$/;
const HARMLESS_ENDING = /_(?:file|path|count|limit|type|name|length|size|url)$/;

const snakeCaseOf = (name) => name.replace(/^-+/, "").replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/-/g, "_").toLowerCase();

export function isSecretName(name) {
  const words = snakeCaseOf(name);
  if (HARMLESS_ENDING.test(words)) return false;
  return SECRET_WORD.test(words) || (SHELL_VARIABLE.test(name) && SHELL_KEY_WORD.test(words));
}
