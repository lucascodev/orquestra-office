const START_TAG = /<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>/g;
const ATTRIBUTE = /([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
const BODY = /<body[^>]*>([\s\S]*)<\/body>/;
const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>/;

function attributesOf(source) {
  const attributes = new Map();
  for (const [, name, doubleQuoted, singleQuoted, bare] of source.matchAll(ATTRIBUTE)) {
    attributes.set(name.toLowerCase(), doubleQuoted ?? singleQuoted ?? bare ?? "");
  }
  return attributes;
}

export const startTags = (html) => [...html.matchAll(START_TAG)].map(([, name, attributes]) => ({ name: name.toLowerCase(), attributes: attributesOf(attributes) }));

export const bodyOf = (html) => BODY.exec(html)?.[1] ?? "";

export const hasInlineScript = (html) => INLINE_SCRIPT.test(html);
