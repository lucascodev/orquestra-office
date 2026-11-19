import { countOf, sumOf, unknownCounts } from "../count.js";
import { TEST_FRAMEWORK } from "../test-framework.js";

// One line per test project from the VSTest console logger, in English or Portuguese.
const PROJECT_RESULT = /^[^!]{1,40}!\s+[-–]\s+(?:Failed|Com falha):\s+(\d+), (?:Passed|Aprovado):\s+(\d+), (?:Skipped|Ignorado):\s+(\d+), Total:\s+\d+/;
// One line for the whole run from the terminal logger (dotnet test -tl).
const RUN_RESULT = /^Test summary: total: \d+[;,] failed: (\d+)[;,] succeeded: (\d+)[;,] skipped: (\d+)/;
// A block for the whole run from Microsoft.Testing.Platform.
const PLATFORM_RESULT_HEADER = "Test run summary: ";
const PLATFORM_RESULT_FIELD = /^\s+(total|failed|succeeded|skipped): (\d+)$/;

function platformResultOf(lines) {
  const header = lines.findLastIndex((line) => line.startsWith(PLATFORM_RESULT_HEADER));
  if (header < 0) return null;
  const fields = {};
  for (let index = header + 1; index < lines.length; index += 1) {
    const field = PLATFORM_RESULT_FIELD.exec(lines[index]);
    if (!field) break;
    fields[field[1]] = countOf(field[2]);
  }
  if (!("failed" in fields && "succeeded" in fields)) return null;
  return { passed: fields.succeeded, failed: fields.failed, skipped: fields.skipped ?? null, failures: [] };
}

function runResultOf(lines) {
  const result = lines.map((line) => RUN_RESULT.exec(line)).findLast(Boolean);
  return result ? { passed: countOf(result[2]), failed: countOf(result[1]), skipped: countOf(result[3]), failures: [] } : null;
}

function projectResultsOf(lines, isComplete) {
  const results = lines.map((line) => PROJECT_RESULT.exec(line)).filter(Boolean);
  if (results.length === 0) return null;
  if (!isComplete) return unknownCounts([]);
  const total = (group) => sumOf(results.map((result) => countOf(result[group])));
  return { passed: total(2), failed: total(1), skipped: total(3), failures: [] };
}

function parse(lines, { isComplete }) {
  return platformResultOf(lines) ?? runResultOf(lines) ?? projectResultsOf(lines, isComplete);
}

export const dotnetParser = Object.freeze({ framework: TEST_FRAMEWORK.DOTNET, parse });
