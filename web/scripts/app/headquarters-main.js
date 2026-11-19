import { agentKeyOfSession } from "../domain/office/live-sessions.js";
import { createDemoBackend } from "../infra/backends/demo-backend.js";
import { createLiveBackend } from "../infra/backends/live-backend.js";
import { createHeadquartersRenderer } from "../three/scene/headquarters-renderer.js";
import { describeStatus } from "../view/office/status-display.js";
import { createDataSource } from "./data-source.js";
import { createFrameMeter } from "./frame-meter.js";
import { createHeadquartersPage } from "./headquarters-page.js";
import { createNewSessionDialog } from "./new-session-dialog.js";

const MODE_PARAM = "modo";
const DEMO_MODE = "demo";
const SCENE_PARAM = "cena";
const MEASURE_PARAM = "medir";
const MEASURE_ON = "1";
const STYLESHEET = "styles/headquarters.css";
const NO_WEBGL = "Este navegador não conseguiu abrir a cena 3D da Sede.";

const params = new URLSearchParams(window.location.search);

function addStylesheet() {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = STYLESHEET;
  document.head.append(link);
}

// The map stays out of the live region of the old page: every name tag that changed would be read aloud.
function mountShell(office) {
  office.removeAttribute("aria-live");
  const hud = document.getElementById("headquarters-shell").content.firstElementChild.cloneNode(true);
  office.before(hud);
  return hud;
}

addStylesheet();
document.body.classList.add("is-headquarters");
const office = document.getElementById("office");
const hud = mountShell(office);
const isMeasuring = params.get(MEASURE_PARAM) === MEASURE_ON;
const showStats = isMeasuring ? createFrameMeter(office) : () => {};
const headquarters = createHeadquartersRenderer({
  onFrame: showStats, describeStatus, isMeasuring,
  onPick: (key) => page.openAgentFromMap(key),
  onFollowChange: (key) => page.showFollowing(key),
});
if (headquarters) office.prepend(headquarters.element);
else office.textContent = NO_WEBGL;

const source = createDataSource((state) => page.receive(state));
const newSessionDialog = createNewSessionDialog({
  dialog: document.getElementById("new-session"),
  control: source,
  onOpened: (session) => page.awaitAgent(agentKeyOfSession(session)),
});
const page = createHeadquartersPage({ hud, headquarters, source, newSessionDialog });

const demo = () => createDemoBackend({ scene: params.get(SCENE_PARAM), keepsAsking: true });
source.start(params.get(MODE_PARAM) === DEMO_MODE ? [demo()] : [createLiveBackend(), demo()]);
