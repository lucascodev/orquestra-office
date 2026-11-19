import {
  TEST_COUNTS, TEST_FILE_ACTIONS, TEST_FILE_RESULTS, TEST_RUN_FALLBACK_LABEL, TEST_RUN_WITHOUT_COUNTS, TEST_VERDICTS, TESTS_TEXT,
} from "../../data/text/pt-br/work-sheet.js";
import { WORK_MARKS } from "../../data/work-marks.js";
import { countPhrase } from "../../domain/text/count-phrase.js";
import { fillPhrase } from "../../domain/text/fill-phrase.js";
import { esc } from "../shared/escape-html.js";
import { clockTime } from "../shared/format.js";
import { formatTestDuration } from "./work-format.js";

const VERDICT_MARKS = { passed: WORK_MARKS["tests-passed"], failed: WORK_MARKS["tests-failed"] };
const FILE_RESULT_MARKS = { failing: WORK_MARKS["tests-failed"], passing: WORK_MARKS["tests-passed"], unknown: WORK_MARKS["no-result"] };
const COUNT_ORDER = ["passed", "failed", "skipped"];
const SEPARATOR = " · ";

function runningSection(running) {
  if (!running) return "";
  const clock = `<span class="work-clock" data-elapsed-since="${running.startedAt}"></span>`;
  const command = running.command ?? running.frameworkName;
  return `<section class="work-card is-running" aria-label="${TESTS_TEXT.runningLabel}">
      <div class="work-card-head"><span class="work-mark" aria-hidden="true">${WORK_MARKS.testing}</span><b>${TESTS_TEXT.running}</b>${clock}</div>
      ${command ? `<code class="work-command">${esc(command)}</code>` : ""}
      <div class="work-sweep" aria-hidden="true"><span></span></div>
    </section>`;
}

function shareBar(run) {
  if (!run.hasCounts) return "";
  const parts = [["passed", run.passed], ["skipped", run.skipped], ["failed", run.failed]].filter(([, count]) => count > 0);
  if (parts.length === 0) return "";
  return `<div class="work-share" aria-hidden="true">${parts.map(([kind, count]) => `<span data-kind="${kind}" style="flex:${count}"></span>`).join("")}</div>`;
}

function countsLine(run) {
  const known = COUNT_ORDER.filter((kind) => run[kind] !== null);
  if (known.length === 0) return "";
  return `<p class="work-counts">${known.map((kind) => `<span><b data-kind="${kind}">${run[kind]}</b> ${TEST_COUNTS[kind]}</span>`).join("")}</p>`;
}

function failureOf(failure) {
  const parts = [
    failure.name ? `<b>${esc(failure.name)}</b>` : "",
    failure.location ? `<span class="work-failure-where">${esc(failure.location)}</span>` : "",
    failure.message ? `<code class="work-failure-message">${esc(failure.message)}</code>` : "",
  ].filter(Boolean);
  return parts.length ? `<li class="work-failure">${parts.join("")}</li>` : "";
}

function lastRunSection(run) {
  if (!run) return "";
  const headline = [countPhrase(TEST_VERDICTS[run.verdict], run.headlineCount), run.frameworkName].filter(Boolean).join(SEPARATOR);
  const when = [run.finishedAt === null ? "" : clockTime(run.finishedAt), formatTestDuration(run.durationMs)].filter(Boolean).join(SEPARATOR);
  const failures = run.failures.map(failureOf).join("");
  return `<section class="work-card" data-verdict="${run.verdict}" aria-label="${TESTS_TEXT.lastRunLabel}">
      <div class="work-card-head"><span class="work-mark" aria-hidden="true">${VERDICT_MARKS[run.verdict]}</span><b>${esc(headline)}</b>${when ? `<span class="work-muted">${esc(when)}</span>` : ""}</div>
      ${shareBar(run)}${countsLine(run)}
      ${failures ? `<ul class="work-failures">${failures}</ul>` : ""}
    </section>`;
}

function runResult(run) {
  if (!run.hasCounts) return TEST_RUN_WITHOUT_COUNTS[run.verdict];
  const failed = run.failed > 0 ? `${run.failed} ${VERDICT_MARKS.failed}` : "";
  const passed = run.passed === null ? "" : `${run.passed} ${VERDICT_MARKS.passed}`;
  return [failed, passed].filter(Boolean).join(SEPARATOR);
}

// The marks read badly aloud, so a screen reader gets the round in words.
function runResultSpoken(run) {
  if (!run.hasCounts) return TEST_VERDICTS[run.verdict].unknown;
  const failed = run.failed > 0 ? countPhrase(TEST_VERDICTS.failed, run.failed) : "";
  const passed = run.passed === null ? "" : countPhrase(TEST_VERDICTS.passed, run.passed);
  return [failed, passed].filter(Boolean).join(", ");
}

function runRow(run) {
  const time = run.finishedAt === null ? "" : clockTime(run.finishedAt);
  return `<li class="work-row work-run" data-verdict="${run.verdict}"><time class="work-time">${time}</time><span class="work-mark" aria-hidden="true">${VERDICT_MARKS[run.verdict]}</span><span class="work-row-text">${esc(run.label ?? run.frameworkName ?? TEST_RUN_FALLBACK_LABEL)}</span><span class="work-row-end" aria-hidden="true">${esc(runResult(run))}</span><span class="sr-only">: ${esc(runResultSpoken(run))}</span></li>`;
}

function runsSection(runs) {
  if (runs.length === 0) return "";
  const title = countPhrase(TESTS_TEXT.runsToday, runs.length);
  return `<section class="work-list" aria-label="${esc(title)}"><h3 class="work-heading">${esc(title)}</h3><ol>${runs.map(runRow).join("")}</ol></section>`;
}

function fileRow(file) {
  const result = file.result === "failing" ? `${FILE_RESULT_MARKS.failing} ${file.failed}` : FILE_RESULT_MARKS[file.result];
  const action = file.action ? TEST_FILE_ACTIONS[file.action] : "";
  return `<li class="work-row work-file" data-result="${file.result}"><span class="work-file-action" data-action="${file.action ?? ""}">${action}</span><code class="work-row-text">${esc(file.path)}</code><span class="work-row-end" aria-hidden="true">${result}</span><span class="sr-only">: ${esc(fileResultSpoken(file))}</span></li>`;
}

const fileResultSpoken = (file) => (file.result === "failing" ? countPhrase(TEST_VERDICTS.failed, file.failed) : TEST_FILE_RESULTS[file.result]);

function filesSection(files) {
  if (files.length === 0) return "";
  const title = fillPhrase(TESTS_TEXT.files, { count: files.length });
  return `<section class="work-list" aria-label="${esc(title)}"><h3 class="work-heading">${esc(title)}</h3><ul>${files.map(fileRow).join("")}</ul></section>`;
}

// The Testes tab: the round running now with its clock, the last round with its numbers and failures, today's rounds and the
// test files of the session. The clock is left empty here and kept ticking by the sheet.
export function renderTestsTab(overview) {
  if (!overview) return `<p class="work-empty">${TESTS_TEXT.empty}</p>`;
  return `<div class="work-stack">
    ${runningSection(overview.running)}${lastRunSection(overview.lastRun)}${runsSection(overview.runsToday)}${filesSection(overview.files)}
    <p class="work-note">${TESTS_TEXT.note}</p>
  </div>`;
}
