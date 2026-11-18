import { withBuildingAgentNames } from "../domain/office/agent-names.js";
import { createDemoBackend } from "../infra/backends/demo-backend.js";
import { createLiveBackend } from "../infra/backends/live-backend.js";
import { createHeadquartersRenderer } from "../three/scene/headquarters-renderer.js";
import { describeStatus } from "../view/office/status-display.js";
import { createDataSource } from "./data-source.js";

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

function createMeter(host) {
  const meter = document.createElement("output");
  meter.className = "hq-meter";
  host.append(meter);
  return ({ calls, triangles }) => { meter.textContent = `chamadas de desenho ${calls} · triângulos ${triangles}`; };
}

addStylesheet();
document.body.classList.add("is-headquarters");
const office = document.getElementById("office");
const showStats = params.get(MEASURE_PARAM) === MEASURE_ON ? createMeter(office) : () => {};
const headquarters = createHeadquartersRenderer({ onFrame: showStats, describeStatus });
if (headquarters) office.prepend(headquarters.element);
else office.textContent = NO_WEBGL;

const source = createDataSource((state) => headquarters?.show(withBuildingAgentNames(state.projects)));
const demo = () => createDemoBackend({ scene: params.get(SCENE_PARAM) });
source.start(params.get(MODE_PARAM) === DEMO_MODE ? [demo()] : [createLiveBackend(), demo()]);
