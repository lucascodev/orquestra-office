import { bodyOf, startTags } from "./html.mjs";

const UNTRANSLATED_ATTRIBUTES = new Set(["class", "role", "type", "hidden", "tabindex", "aria-selected", "aria-hidden", "loading", "width", "height"]);
const UNTRANSLATED_ATTRIBUTE_PREFIX = "data-install";
const CURRENT_LANGUAGE_ATTRIBUTES = new Set(["aria-current"]);
const ID_REFERENCE_ATTRIBUTES = new Set(["aria-controls", "aria-labelledby"]);
const ID_SEPARATOR = /\s+/;

const isUntranslated = (name) => UNTRANSLATED_ATTRIBUTES.has(name) || name.startsWith(UNTRANSLATED_ATTRIBUTE_PREFIX);

function describeAttribute(name, value, positionById) {
  if (ID_REFERENCE_ATTRIBUTES.has(name)) return `${name}=${value.split(ID_SEPARATOR).map((id) => `@${positionById.get(id)}`).join(" ")}`;
  if (isUntranslated(name)) return `${name}=${value}`;
  return name;
}

export function skeletonOf(html) {
  const tags = startTags(bodyOf(html));
  const positionById = new Map(tags.map((tag, position) => [tag.attributes.get("id"), position]).filter(([id]) => id));
  return tags.map(({ name, attributes }) => {
    const describedAttributes = [...attributes].filter(([attributeName]) => !CURRENT_LANGUAGE_ATTRIBUTES.has(attributeName)).map(([attributeName, value]) => describeAttribute(attributeName, value, positionById));
    return `<${name} ${describedAttributes.sort().join(" ")}>`;
  });
}
