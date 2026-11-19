import { cargoParser } from "./frameworks/cargo.js";
import { dotnetParser } from "./frameworks/dotnet.js";
import { goParser } from "./frameworks/go.js";
import { gradleParser } from "./frameworks/gradle.js";
import { jestParser } from "./frameworks/jest.js";
import { mavenParser } from "./frameworks/maven.js";
import { mixParser } from "./frameworks/mix.js";
import { mochaParser } from "./frameworks/mocha.js";
import { nodeTestParser } from "./frameworks/node-test.js";
import { phpunitParser } from "./frameworks/phpunit.js";
import { playwrightParser } from "./frameworks/playwright.js";
import { pytestParser } from "./frameworks/pytest.js";
import { rspecParser } from "./frameworks/rspec.js";
import { tapParser } from "./frameworks/tap.js";
import { vitestParser } from "./frameworks/vitest.js";

// The order is the order of the failures when one output carries summaries of several frameworks.
export const TEST_OUTPUT_PARSERS = Object.freeze([
  jestParser,
  vitestParser,
  pytestParser,
  nodeTestParser,
  tapParser,
  goParser,
  cargoParser,
  dotnetParser,
  mavenParser,
  gradleParser,
  mochaParser,
  rspecParser,
  phpunitParser,
  mixParser,
  playwrightParser,
]);
