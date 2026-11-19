import { bodyOf, startTags } from "./html.mjs";

const UNTRANSLATED_ATTRIBUTES = new Set(["class", "role", "type", "hidden", "tabindex", "aria-selected", "aria-hidden", "loading", "width", "height"]);
const UNTRANSLATED_ATTRIBUTE_PREFIX = "data-install";
const CURRENT_LANGUAGE_ATTRIBUTES = new Set(["aria-current"]);
const ID_REFERENCE_ATTRIBUTES = new Set(["aria-controls", "aria-labelledby"]);
const ADDRESS_ATTRIBUTES = new Set(["href", "src"]);
const ID_SEPARATOR = /\s+/;
const FRAGMENT_PREFIX = "#";
const EXTERNAL_ADDRESS = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

const isUntranslated = (name) => UNTRANSLATED_ATTRIBUTES.has(name) || name.startsWith(UNTRANSLATED_ATTRIBUTE_PREFIX);

const positionOf = (id, positionById) => `@${positionById.get(id)}`;

function siteAddressOf(address, { pageUrl, siteUrl }) {
  const resolved = new URL(address, pageUrl).href;
  return resolved.startsWith(siteUrl) ? `/${resolved.slice(siteUrl.length)}` : resolved;
}

function describeAddress(address, page) {
  if (address.startsWith(FRAGMENT_PREFIX)) return positionOf(address.slice(FRAGMENT_PREFIX.length), page.positionById);
  if (EXTERNAL_ADDRESS.test(address)) return address;
  return siteAddressOf(address, page);
}

function describeAttribute(name, value, page) {
  if (ID_REFERENCE_ATTRIBUTES.has(name)) return `${name}=${value.split(ID_SEPARATOR).map((id) => positionOf(id, page.positionById)).join(" ")}`;
  if (ADDRESS_ATTRIBUTES.has(name)) return `${name}=${describeAddress(value, page)}`;
  if (isUntranslated(name)) return `${name}=${value}`;
  return name;
}

export function skeletonOf(html, { pageUrl, siteUrl }) {
  const tags = startTags(bodyOf(html));
  const positionById = new Map(tags.map((tag, position) => [tag.attributes.get("id"), position]).filter(([id]) => id));
  const page = { pageUrl, siteUrl, positionById };
  return tags.map(({ name, attributes }) => {
    const describedAttributes = [...attributes].filter(([attributeName]) => !CURRENT_LANGUAGE_ATTRIBUTES.has(attributeName)).map(([attributeName, value]) => describeAttribute(attributeName, value, page));
    return `<${name} ${describedAttributes.sort().join(" ")}>`;
  });
}
