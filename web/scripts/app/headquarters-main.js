import { deviceLabelOf } from "../domain/office/device-label.js";
import { agentKeyOfSession } from "../domain/office/live-sessions.js";
import { isLoopbackHost } from "../domain/office/loopback-host.js";
import { createDemoBackend } from "../infra/backends/demo-backend.js";
import { createLiveBackend } from "../infra/backends/live-backend.js";
import { createHeadquartersRenderer } from "../three/scene/headquarters-renderer.js";
import { describeStatus } from "../view/office/status-display.js";
import { createDataSource } from "./data-source.js";
import { createDevicesDialog } from "./devices-dialog.js";
import { createFrameMeter } from "./frame-meter.js";
import { createHeadquartersPage } from "./headquarters-page.js";
import { createNewSessionDialog } from "./new-session-dialog.js";
import { reloadOnPairingLink, takePairingCode } from "./pairing-code.js";

const MODE_PARAM = "modo";
const DEMO_MODE = "demo";
const SCENE_PARAM = "cena";
const MEASURE_PARAM = "medir";
const MEASURE_ON = "1";
const NO_WEBGL = "Este navegador não conseguiu abrir a cena 3D da Sede.";

const pairingCode = takePairingCode();
reloadOnPairingLink();
const params = new URLSearchParams(window.location.search);

const office = document.getElementById("office");
const hud = document.querySelector(".hq-hud");
const isMeasuring = params.get(MEASURE_PARAM) === MEASURE_ON;
const showStats = isMeasuring ? createFrameMeter(office) : () => {};
const headquarters = createHeadquartersRenderer({
  onFrame: showStats, describeStatus, isMeasuring,
  onPick: (key) => page.openAgentFromMap(key),
  onPickIsland: (projectKey) => page.openIslandFromMap(projectKey),
  onFollowChange: (key) => page.showFollowing(key),
  onManualMove: () => page.cameraMovedByHand(),
  onView: (view) => page.showView(view),
});
if (headquarters) office.prepend(headquarters.element);
else office.textContent = NO_WEBGL;

const source = createDataSource((state) => page.receive(state));
const newSessionDialog = createNewSessionDialog({
  dialog: document.getElementById("new-session"),
  control: source,
  onOpened: (session) => page.awaitAgent(agentKeyOfSession(session)),
});
const devicesDialog = createDevicesDialog({ dialog: document.getElementById("devices"), control: source });
const page = createHeadquartersPage({ hud, headquarters, source, newSessionDialog, devicesDialog, isOnThisMachine: isLoopbackHost(window.location.hostname) });

const demo = () => createDemoBackend({ scene: params.get(SCENE_PARAM), keepsAsking: true });
const live = () => createLiveBackend({ pairingCode, deviceLabel: deviceLabelOf(navigator.userAgent) });
source.start(params.get(MODE_PARAM) === DEMO_MODE ? [demo()] : [live(), demo()]);
