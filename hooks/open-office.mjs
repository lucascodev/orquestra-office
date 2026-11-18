import { homedir } from "node:os";
import { openBrowser } from "./lib/open-browser.mjs";
import { officeFilesOf } from "./lib/office-home.mjs";
import { readSecretFile } from "./lib/office-secret.mjs";
import { ALLOW_REMOTE_FLAG, installerOfficeUrl } from "./lib/office-url.mjs";
import { pairingLinkOf } from "./lib/pairing-link.mjs";

const NO_OPEN_FLAG = "--no-open";

function fail(message) {
  console.error(message);
  process.exit(1);
}

const officeUrl = installerOfficeUrl(process.env, { allowRemote: process.argv.includes(ALLOW_REMOTE_FLAG) });
if (officeUrl.problem) fail(`OFFICE_URL was refused: ${officeUrl.problem}.`);
const { secretFile } = officeFilesOf(homedir());
const key = readSecretFile(secretFile);
if (!key) fail(`The office secret was not found at ${secretFile}. Run node hooks/install-claude-hooks.mjs first.`);

let link;
try {
  link = await pairingLinkOf({ officeUrl: officeUrl.origin, key });
} catch (error) {
  fail(`Could not pair a browser with the office at ${officeUrl.origin}: ${error.message}. Check that the collector is running and was restarted after the secret was created.`);
}

console.log(`Open this address to use the office in this browser (it works once, for 2 minutes):\n${link}`);
if (!process.argv.includes(NO_OPEN_FLAG)) openBrowser(link);
