import { test } from "node:test";
import assert from "node:assert/strict";
import { scriptCommandOf } from "../src/work/domain/commands/script-command.js";
import { testCommandOf } from "../src/work/domain/commands/test-command.js";
import { TEST_FRAMEWORK } from "../src/work/domain/test-output/test-framework.js";
import { FRAMEWORK_IDS } from "../src/work/domain/values/frameworks.js";

const COMMAND_LIMIT = 200;

const recognized = [
  ["jest", "jest --ci", "jest"],
  ["vitest run", "vitest run", "vitest"],
  ["mocha", "mocha 'test/**/*.spec.js'", "mocha"],
  ["ava", "ava --verbose", "ava"],
  ["node --test", "node --test collector/test/*.test.js", "node-test"],
  ["node --test after other flags", "node --experimental-vm-modules --test", "node-test"],
  ["bun test", "bun test", "bun"],
  ["deno test", "deno test --allow-read", "deno"],
  ["playwright test", "npx playwright test --project=chromium", "playwright"],
  ["cypress run", "cypress run --spec cypress/e2e/login.cy.ts", "cypress"],
  ["npm test", "npm test", null],
  ["npm t", "npm t", null],
  ["npm run test:unit", "npm run test:unit", null],
  ["npm run-script test", "npm run-script test", null],
  ["npm test with a prefix", "npm --prefix collector test", null],
  ["npm test in a workspace", "npm -w web run test", null],
  ["pnpm test", "pnpm test", null],
  ["pnpm test filtered", "pnpm --filter web test", null],
  ["pnpm running a test binary", "pnpm vitest run", "vitest"],
  ["pnpm exec", "pnpm exec jest", "jest"],
  ["yarn test", "yarn test", null],
  ["yarn running a test binary", "yarn jest --runInBand", "jest"],
  ["yarn workspace test", "yarn workspace web test", null],
  ["bun run test", "bun run test", null],
  ["bunx", "bunx vitest", "vitest"],
  ["nx test", "nx test web", null],
  ["nx run target", "nx run web:test", null],
  ["nx affected", "npx nx affected -t test", null],
  ["turbo test", "turbo test", null],
  ["turbo run test", "turbo run test --filter=web", null],
  ["pytest", "pytest -q tests/test_calc.py", "pytest"],
  ["py.test", "py.test", "pytest"],
  ["python -m pytest", "python -m pytest -x", "pytest"],
  ["python3 -m unittest", "python3 -m unittest discover", "unittest"],
  ["py -m pytest on Windows", "py -m pytest", "pytest"],
  ["tox", "tox -e py312", null],
  ["nox", "nox -s tests", null],
  ["uv run pytest", "uv run pytest", "pytest"],
  ["poetry run pytest", "poetry run pytest -k calc", "pytest"],
  ["go test", "go test ./...", "go"],
  ["cargo test", "cargo test --workspace", "cargo"],
  ["cargo nextest", "cargo nextest run", "cargo"],
  ["dotnet test", "dotnet test MySolution.sln", "dotnet"],
  ["mvn test", "mvn -q test", "maven"],
  ["mvn verify", "mvn clean verify", "maven"],
  ["maven wrapper", "./mvnw test", "maven"],
  ["gradle test", "gradle test", "gradle"],
  ["gradle wrapper", "./gradlew :app:test", "gradle"],
  ["gradle wrapper on Windows", ".\\gradlew.bat testDebugUnitTest", "gradle"],
  ["rspec", "rspec spec/calc_spec.rb", "rspec"],
  ["bundle exec rspec", "bundle exec rspec", "rspec"],
  ["rails test", "bin/rails test", "minitest"],
  ["rake test", "rake test", "minitest"],
  ["phpunit", "vendor/bin/phpunit --testdox", "phpunit"],
  ["phpunit through php", "php vendor/bin/phpunit", "phpunit"],
  ["pest", "./vendor/bin/pest", "pest"],
  ["artisan test", "php artisan test", null],
  ["mix test", "mix test --trace", "mix"],
  ["flutter test", "flutter test", "flutter"],
  ["dart test", "dart test", "dart"],
  ["swift test", "swift test", "swift"],
  ["xcodebuild test", "xcodebuild -scheme App test", "xcodebuild"],
  ["a test after cd", "cd collector && node --test", "node-test"],
  ["a test after an environment variable", "CI=true npm test", null],
  ["a test after several environment variables", "NODE_ENV=test FORCE_COLOR=0 jest", "jest"],
  ["a test after a PowerShell environment variable", "$env:CI = 'true'; npx vitest run", "vitest"],
  ["a test after cross-env", "cross-env NODE_ENV=test jest", "jest"],
  ["a test piped into tail", "npm test 2>&1 | tail -20", null],
  ["a test inside a subshell", "(cd web && npx vitest run)", "vitest"],
  ["a test later in a chain", "npm run build; pytest", "pytest"],
  ["a test on its own line", "cd collector\nnode --test", "node-test"],
  ["a Windows executable", "C:\\tools\\pytest.exe", "pytest"],
];

for (const [what, command, framework] of recognized) {
  test(`${what} is a test run with framework ${framework}`, () => {
    assert.equal(testCommandOf(command)?.framework, framework);
  });
}

const notTests = [
  ["npm run build", "npm run build"],
  ["npm run check", "npm run check"],
  ["npm install", "npm install"],
  ["node running a script", "node scripts/test.js"],
  ["a git commit about tests", "git commit -m \"test: cover the parser\""],
  ["echo test", "echo test"],
  ["grep for test", "grep -rn test src"],
  ["go vet", "go vet ./..."],
  ["cargo build", "cargo build --release"],
  ["dotnet build", "dotnet build"],
  ["mvn package", "mvn package -DskipTests"],
  ["gradle build", "./gradlew build"],
  ["playwright install", "npx playwright install"],
  ["cypress open", "cypress open"],
  ["python running a script", "python manage.py runserver"],
  ["an empty command", ""],
  ["no command", undefined],
];

for (const [what, command] of notTests) {
  test(`${what} is not a test run`, () => {
    assert.equal(testCommandOf(command), null);
  });
}

// The page keeps a phrase for each id, so the list holds only names something can produce.
test("the framework ids are exactly the ones the output parser and the command reader give", () => {
  const fromCommands = recognized.map(([, command]) => testCommandOf(command).framework).filter(Boolean);
  const produced = new Set([...Object.values(TEST_FRAMEWORK), ...fromCommands]);
  assert.ok(Object.isFrozen(FRAMEWORK_IDS));
  assert.deepEqual([...FRAMEWORK_IDS].sort(), [...produced].sort());
});

test("the command of a test run starts at the test program, without the cd before it or the variables set for it", () => {
  assert.equal(testCommandOf("cd collector && API_TOKEN=abc npm test -- --reporter=dot 2>&1 | tail -5").command, "npm test -- --reporter=dot 2>&1");
});

test("the command of a test run drops the variables set through cross-env but keeps the wrapper", () => {
  assert.equal(testCommandOf("cross-env SECRET_KEY=abc NODE_ENV=test jest --ci").command, "cross-env jest --ci");
});

test("the command of a test run keeps the wrapper the agent typed", () => {
  assert.equal(testCommandOf("npx vitest run src/calc.test.ts").command, "npx vitest run src/calc.test.ts");
});

test("the command of a test run masks secrets passed as arguments", () => {
  assert.equal(testCommandOf("pytest --api-key=sk-abcdefghijklmnopqrstu tests").command, "pytest --api-key=[redacted] tests");
});

test("the command of a test run has no control characters", () => {
  assert.equal(testCommandOf("jest\u0007 --ci‮").command, "jest --ci");
});

test("the command of a test run is cut at 200 characters", () => {
  const long = `pytest ${"tests/test_calc.py ".repeat(30)}`;
  assert.equal(testCommandOf(long).command.length, COMMAND_LIMIT);
});

test("only the first 4 KB of a command are read", () => {
  assert.equal(testCommandOf(`echo ${"x".repeat(5_000)}; npm test`), null);
});

test("a long command with no separators is read in linear time", () => {
  const started = performance.now();
  testCommandOf(`A=${"=".repeat(4_000)}`);
  scriptCommandOf(`${"(".repeat(4_000)}`);
  assert.ok(performance.now() - started < 200);
});

const scripts = [
  ["npm run", "cd web && CI=1 npm run check", "npm run check"],
  ["pnpm run", "pnpm --filter web run lint:all", "pnpm --filter web run lint:all"],
  ["yarn run", "yarn run verify", "yarn run verify"],
  ["bun run", "bun run ci", "bun run ci"],
  ["make", "make check", "make check"],
  ["a script after another program", "curl -s https://x > /dev/null; make", "make"],
];

for (const [what, command, shown] of scripts) {
  test(`${what} is a script whose output may hold a test summary`, () => {
    assert.equal(scriptCommandOf(command), shown);
  });
}

const notScripts = [
  ["curl", "curl -H 'Authorization: Bearer xyz' https://x"],
  ["npm install", "npm install"],
  ["npm run with no script", "npm run"],
  ["git", "git status"],
  ["an empty command", ""],
  ["no command", undefined],
];

for (const [what, command] of notScripts) {
  test(`${what} is not a script whose output is read`, () => {
    assert.equal(scriptCommandOf(command), null);
  });
}
