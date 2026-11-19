// The test summary sits at the end of the output, and the parser never needs to scan megabytes of it.
const OUTPUT_TAIL_LIMIT = 64 * 1024;
const EXIT_CODE_FIELDS = ["exitCode", "exit_code", "returnCode"];

const tailOf = (text) => (text.length > OUTPUT_TAIL_LIMIT ? text.slice(-OUTPUT_TAIL_LIMIT) : text);
const textOf = (value) => (typeof value === "string" ? tailOf(value) : "");

export function shellOutputOf(response) {
  if (typeof response === "string") return tailOf(response);
  const parts = [textOf(response?.stdout), textOf(response?.stderr)].filter(Boolean);
  return tailOf(parts.join("\n"));
}

export const failureOutputOf = (error) => textOf(error);

export function isShellCallOk(response) {
  if (response?.interrupted === true) return false;
  const exitCode = EXIT_CODE_FIELDS.map((field) => response?.[field]).find((value) => Number.isInteger(value));
  return exitCode === undefined || exitCode === 0;
}
