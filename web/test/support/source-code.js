const QUOTES = new Set(['"', "'"]);
const BACKTICK = "`";
const SUBSTITUTION_START = "${";
const EMPTY_TEXT = '""';
const SPECIFIER_LIKE = /^[\w$@.\/:-]+$/;
const REGEX_FLAG = /[a-z]/i;
const ENDS_AN_OPERAND = /[\w$)\]}"'`]$/;
const LAST_WORD = /[\w$]+$/;
const KEYWORDS_BEFORE_AN_OPERAND = new Set(["return", "typeof", "case", "do", "else", "in", "of", "new", "delete", "void", "throw", "instanceof", "yield", "await"]);

const stepOver = (source, index) => (source[index] === "\\" ? index + 2 : index + 1);

function quotedText(source, start) {
  const quote = source[start];
  let index = start + 1;
  while (index < source.length && source[index] !== quote && source[index] !== "\n") index = stepOver(source, index);
  return { text: source.slice(start + 1, index), end: source[index] === quote ? index + 1 : index };
}

function templateTextEnd(source, start) {
  let index = start;
  while (index < source.length && source[index] !== BACKTICK && !source.startsWith(SUBSTITUTION_START, index)) index = stepOver(source, index);
  return index;
}

function regexEnd(source, start) {
  let index = start + 1;
  let isInClass = false;
  while (index < source.length && source[index] !== "\n" && (source[index] !== "/" || isInClass)) {
    if (source[index] === "[") isInClass = true;
    if (source[index] === "]") isInClass = false;
    index = stepOver(source, index);
  }
  index += 1;
  while (REGEX_FLAG.test(source[index] ?? "")) index += 1;
  return index;
}

// A slash after something that ends an operand divides; anywhere else it opens a regular expression.
function opensRegex(written) {
  const before = written.trimEnd();
  const word = LAST_WORD.exec(before)?.[0];
  if (word && KEYWORDS_BEFORE_AN_OPERAND.has(word)) return true;
  return !ENDS_AN_OPERAND.test(before);
}

function rewritten(source, literalAs) {
  let written = "";
  let index = 0;
  const openBracesPerSubstitution = [];

  const openSubstitution = (textEnd) => {
    written += `${EMPTY_TEXT}(`;
    openBracesPerSubstitution.push(0);
    return textEnd + SUBSTITUTION_START.length;
  };

  const templateRest = (start) => {
    const end = templateTextEnd(source, start);
    if (source[end] !== BACKTICK) return openSubstitution(end);
    written += EMPTY_TEXT;
    return end + 1;
  };

  const countBrace = (delta) => {
    if (openBracesPerSubstitution.length > 0) openBracesPerSubstitution.push(openBracesPerSubstitution.pop() + delta);
  };

  while (index < source.length) {
    const char = source[index];
    if (source.startsWith("//", index)) {
      const lineEnd = source.indexOf("\n", index);
      index = lineEnd === -1 ? source.length : lineEnd;
    } else if (source.startsWith("/*", index)) {
      const commentEnd = source.indexOf("*/", index + 2);
      index = commentEnd === -1 ? source.length : commentEnd + 2;
      written += " ";
    } else if (char === "/" && opensRegex(written)) {
      index = regexEnd(source, index);
      written += EMPTY_TEXT;
    } else if (QUOTES.has(char)) {
      const { text, end } = quotedText(source, index);
      written += literalAs(text);
      index = end;
    } else if (char === BACKTICK) {
      const end = templateTextEnd(source, index + 1);
      if (source[end] === BACKTICK) {
        written += literalAs(source.slice(index + 1, end));
        index = end + 1;
      } else {
        index = openSubstitution(end);
      }
    } else if (char === "}" && openBracesPerSubstitution.at(-1) === 0) {
      openBracesPerSubstitution.pop();
      written += ")";
      index = templateRest(index + 1);
    } else {
      if (char === "{") countBrace(1);
      if (char === "}") countBrace(-1);
      written += char;
      index += 1;
    }
  }
  return written;
}

export const codeOf = (source) => rewritten(source, () => EMPTY_TEXT);

// Keeps only text that could be a module path, so the import readers see paths and nothing that merely reads like an import.
export const codeWithSpecifiers = (source) => rewritten(source, (text) => (SPECIFIER_LIKE.test(text) ? `"${text}"` : EMPTY_TEXT));
