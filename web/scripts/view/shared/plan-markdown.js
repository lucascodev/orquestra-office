import createPurifier from "../../../vendor/purify.es.js";
import { Marked } from "../../../vendor/marked.esm.js";
import { esc } from "./escape-html.js";

const SAFE_LINK = /^(?:https?:|mailto:)/i;
const CHECKED = "☑ ";
const UNCHECKED = "☐ ";

// A plan sits next to the buttons that approve it, so its markdown gets far less than the terminal's: no raw HTML, no forms,
// no styles, no images, no ids, names or data attributes, and links only to the web or to mail, with the address in view.
export const PLAN_PURIFY = Object.freeze({
  ALLOWED_TAGS: Object.freeze([
    "p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "strong", "em", "del", "code", "pre", "blockquote", "a", "hr", "br",
    "table", "thead", "tbody", "tr", "th", "td", "span", "div",
  ]),
  ALLOWED_ATTR: Object.freeze(["href", "title", "class"]),
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: Object.freeze(["style", "img", "form", "button", "input", "textarea", "select", "label", "dialog", "details"]),
  ALLOWED_URI_REGEXP: SAFE_LINK,
});

function linkOf({ href, title, tokens }) {
  const text = this.parser.parseInline(tokens);
  const address = String(href ?? "");
  if (!SAFE_LINK.test(address)) return text;
  const shownAddress = text === esc(address) ? "" : ` <span class="plan-link-target">(${esc(address)})</span>`;
  return `<a href="${esc(address)}"${title ? ` title="${esc(title)}"` : ""}>${text}</a>${shownAddress}`;
}

const TRAILING_NEWLINES = /\n+$/;
const DEFINITION_AS_TEXT = "planDefinitionText";
// Marked files what the def tokenizer returns under its tag; an empty label can never be referenced, so nothing links to it.
const UNREACHABLE_LABEL = "";

// A reference definition ("[x]: address") would vanish from the plan and give its address to any "[text][x]" elsewhere, out
// of view. Here the line stays in the plan as it was written, as escaped text, and no link can use it. The token has a type
// of its own: as a paragraph, Marked would try to append the next definition to it and fail.
function definitionAsText(src) {
  const match = this.rules.block.def.exec(src);
  if (!match) return undefined;
  const raw = match[0].replace(TRAILING_NEWLINES, "");
  return { type: DEFINITION_AS_TEXT, tag: UNREACHABLE_LABEL, raw, text: raw };
}

const planMarked = new Marked({
  gfm: true,
  breaks: true,
  tokenizer: {
    def: definitionAsText,
  },
  extensions: [{ name: DEFINITION_AS_TEXT, renderer: ({ text }) => `<p>${esc(text)}</p>\n` }],
  renderer: {
    html: ({ text }) => esc(text),
    image: ({ text }) => esc(text),
    checkbox: ({ checked }) => (checked ? CHECKED : UNCHECKED),
    link: linkOf,
  },
});

const purifier = createPurifier();
purifier.addHook?.("afterSanitizeAttributes", (node) => {
  if (node.tagName !== "A") return;
  node.setAttribute("target", "_blank");
  node.setAttribute("rel", "noopener noreferrer");
});

// The markdown step alone: raw HTML in the plan comes out as text, before any sanitizer runs.
export const planMarkdownHtml = (text) => planMarked.parse(String(text ?? ""));

// Where the sanitizer cannot run, the plan is shown as plain text instead of trusting the markdown step alone.
export function renderPlanMarkdown(text) {
  if (!purifier.isSupported) return `<p class="plan-plain">${esc(text)}</p>`;
  return purifier.sanitize(planMarkdownHtml(text), PLAN_PURIFY);
}
