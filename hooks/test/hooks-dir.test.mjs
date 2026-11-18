import assert from "node:assert/strict";
import { test } from "node:test";
import { hooksDirProblem } from "../lib/hooks-dir.mjs";

test("accepts ordinary folders on Windows, macOS and Linux, accented names included", () => {
  for (const dir of [
    "C:\\Users\\João\\projetos\\orquestra-office\\hooks",
    "C:\\Users\\lucas\\My Projects\\office_v2\\hooks",
    "/home/me/src/orquestra-office/hooks",
    "/Users/me/Código/a+b,c=d@e~f/hooks",
  ]) {
    assert.equal(hooksDirProblem(dir), null, dir);
  }
});

test("refuses a folder with characters a shell would interpret inside double quotes", () => {
  for (const [dir, shown] of [
    ["/tmp/odd$(touch x)/hooks", '"$", "(", ")"'],
    ["/tmp/odd`touch x`/hooks", '"`"'],
    ['/tmp/odd"quote/hooks', '"\\""'],
    ["/tmp/odd;touch x/hooks", '";"'],
    ["/tmp/line\nbreak/hooks", '"\\n"'],
  ]) {
    const problem = hooksDirProblem(dir);

    assert.match(problem, /not safe in a shell command/, dir);
    assert.ok(problem.includes(shown), `${problem} should list ${shown}`);
  }
});
