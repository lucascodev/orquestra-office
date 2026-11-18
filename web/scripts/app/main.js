import { deviceLabelOf } from "../domain/office/device-label.js";
import { agentKeyOfSession } from "../domain/office/live-sessions.js";
import { pairingCodeOf } from "../domain/office/pairing-fragment.js";
import { createDemoBackend } from "../infra/backends/demo-backend.js";
import { createLiveBackend } from "../infra/backends/live-backend.js";
import { createRoomRenderer } from "../three/scene/renderer.js";
import { describeStatus } from "../view/office/status-display.js";
import { createAgentPanel } from "./agent-panel.js";
import { createDataSource } from "./data-source.js";
import { createDevicesDialog } from "./devices-dialog.js";
import { createNewSessionDialog } from "./new-session-dialog.js";
import { createOfficePage } from "./office-page.js";
import { createPanelResizer } from "./panel-resizer.js";

const MODE_PARAM = "modo";
const DEMO_MODE = "demo";
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const elements = {
  tabs: document.getElementById("tabs"),
  office: document.getElementById("office"),
  side: document.getElementById("side"),
  team: document.getElementById("team"),
  sheet: document.getElementById("sheet"),
  mode: document.getElementById("mode"),
  usage: document.getElementById("usage"),
  openSession: document.getElementById("open-session"),
  runnerOff: document.getElementById("runner-off"),
  devices: document.getElementById("devices-button"),
  security: document.getElementById("security-notice"),
};

// The pairing code is taken out of the address before anything else, so it never lingers in the history or a bookmark.
function takePairingCode() {
  const code = pairingCodeOf(window.location.hash);
  if (code) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  return code;
}

const pairingCode = takePairingCode();

const source = createDataSource((next) => page.receive(next));

const agentPanel = createAgentPanel({ team: elements.team, sheet: elements.sheet, control: source });

const room = createRoomRenderer({ onPick: (key) => page.openAgent(key), describeStatus });

createPanelResizer({
  handle: document.getElementById("side-resizer"),
  side: elements.side,
  workspace: document.querySelector(".workspace"),
  onResize: () => room?.resize(),
});

const newSessionDialog = createNewSessionDialog({
  dialog: document.getElementById("new-session"),
  control: source,
  onOpened: (session) => page.awaitAgent(agentKeyOfSession(session)),
});

const devicesDialog = createDevicesDialog({ dialog: document.getElementById("devices"), control: source });

const page = createOfficePage({
  elements, source, agentPanel, room, newSessionDialog, devicesDialog, isOnThisMachine: LOOPBACK_HOSTS.has(window.location.hostname),
});

const isDemoRequested = new URLSearchParams(window.location.search).get(MODE_PARAM) === DEMO_MODE;
const liveBackend = () => createLiveBackend({ pairingCode, deviceLabel: deviceLabelOf(navigator.userAgent) });
source.start(isDemoRequested ? [createDemoBackend()] : [liveBackend(), createDemoBackend()]);
