import createPurifier from "../../../vendor/purify.es.js";
import { Marked } from "../../../vendor/marked.esm.js";
import { esc } from "./escape-html.js";

const SAFE_LINK = /^(?:https?:|mailto:)/i;
const CHECKED = "☑ ";
const UNCHECKED = "☐ ";

// A plan sits next to the buttons that approve it, so its markdown gets far less than the terminal's: no raw HTML, no forms,
// no styles, no images, no ids, names or data attributes, and links only to the web or to mail, with the address in view.
const PLAN_PURIFY = {
  ALLOWED_TAGS: [
    "p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "strong", "em", "del", "code", "pre", "blockquote", "a", "hr", "br",
    "table", "thead", "tbody", "tr", "th", "td", "span", "div",
  ],
  ALLOWED_ATTR: ["href", "title", "class"],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ["style", "img", "form", "button", "input", "textarea", "select", "label", "dialog", "details"],
  ALLOWED_URI_REGEXP: SAFE_LINK,
};

function linkOf({ href, title, tokens }) {
  const text = this.parser.parseInline(tokens);
  const address = String(href ?? "");
  if (!SAFE_LINK.test(address)) return text;
  const shownAddress = text === esc(address) ? "" : ` <span class="plan-link-target">(${esc(address)})</span>`;
  return `<a href="${esc(address)}"${title ? ` title="${esc(title)}"` : ""}>${text}</a>${shownAddress}`;
}

const planMarked = new Marked({
  gfm: true,
  breaks: true,
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
