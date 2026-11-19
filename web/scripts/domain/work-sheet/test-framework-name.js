import { TEST_FRAMEWORKS } from "../../data/text/pt-br/test-frameworks.js";
import { textOf } from "../shared/field-values.js";
import { ownValueOf } from "../shared/own-value.js";

// The framework as a person reads it. An id the catalog does not know yet, or the first word of a command the collector
// could not name, is shown as it came rather than hidden.
export function testFrameworkName(id) {
  const shown = textOf(id);
  return shown === null ? null : ownValueOf(TEST_FRAMEWORKS, shown) ?? shown;
}
