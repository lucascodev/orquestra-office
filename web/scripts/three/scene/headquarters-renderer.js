import { layoutHeadquarters } from "../../domain/headquarters/headquarters-layout.js";
import { headquartersSpots } from "../../domain/headquarters/headquarters-spots.js";
import { headquartersRoutes } from "../../domain/navigation/headquarters-routes.js";
import { isScreenLit } from "../../domain/office/agent-status.js";
import { buildCommonRooms } from "../furniture/common-rooms.js";
import { buildHeadquartersShell } from "../furniture/headquarters-shell.js";
import { buildIsland } from "../furniture/island.js";
import { monumentSign } from "../furniture/monument-sign.js";
import { buildYard } from "../furniture/yard.js";
import { THREE } from "../kit.js";
import { createAreaLabels } from "./area-labels.js";
import { createCameraRig } from "./camera-rig.js";
import { createHeadquartersPeople } from "./headquarters-people.js";
import { batchStatic } from "./static-batch.js";

const ART_PIXEL = 2;
const AMBIENT_INTENSITY = 2.3;
const SIGN_CAP_ALLOWANCE = 0.2;
const FRAME_MS = 1000 / 12;
const MAX_STEP_SECONDS = 0.25;
const ROUTINE_CHECK_MS = 2_000;

const seatSignature = (seat) => (seat.agent ? `${seat.agent.key}:${isScreenLit(seat.agent)}` : `-${seat.role ?? ""}`);
const islandSignature = (island) => `${island.projectKey}|${island.theme.id}|${island.x}|${island.z}|${island.seats.map(seatSignature).join(",")}`;
const siteSignature = (layout) => `${layout.size.D}|${layout.corners.map((corner) => corner.index).join(",")}`;
const routesSignature = (layout) => `${siteSignature(layout)}|${layout.islands.length}`;
const agentsOf = (projects) => Object.values(projects).flatMap((project) => Object.values(project.agents));

function disposePiece(piece) {
  piece.traverse((node) => {
    if (node.isInstancedMesh) node.dispose();
    else if (node.isMesh) {
      node.material.map?.dispose();
      node.material.dispose();
    }
  });
}

function buildSite(layout) {
  const piece = new THREE.Group();
  buildYard(piece, layout);
  buildHeadquartersShell(piece, layout);
  buildCommonRooms(piece, layout);
  monumentSign(piece, layout.yard.sign);
  return batchStatic(piece);
}

const islandPiece = (island) => batchStatic(buildIsland(new THREE.Group(), island));

// The building, the common rooms and the yard as one static piece, one piece per island that is rebuilt alone when its project,
// theme, occupants or screens change, and the people on top, who live through every rebuild.
export function createHeadquartersRenderer({ onFrame = () => {}, onPick = () => {}, describeStatus = (status) => status } = {}) {
  const stage = document.createElement("div");
  stage.className = "hq-stage";
  const canvas = document.createElement("canvas");
  canvas.className = "hq-canvas";
  const labelLayer = document.createElement("div");
  labelLayer.className = "hq-labels";
  const tagLayer = document.createElement("div");
  tagLayer.className = "room-tags hq-tags";
  stage.append(canvas, labelLayer, tagLayer);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: "low-power" });
  } catch {
    return null;
  }
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;
  renderer.setPixelRatio(1);

  const scene = new THREE.Scene();
  const rig = createCameraRig();
  scene.add(new THREE.AmbientLight("#ffffff", AMBIENT_INTENSITY), rig.sun, rig.sun.target);

  const isMotionReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const people = createHeadquartersPeople({ scene, tagLayer, onPick, describeStatus, isMotionReduced });
  const labels = createAreaLabels(labelLayer);
  const raycaster = new THREE.Raycaster();
  let layout = null;
  let site = null;
  let siteKey = "";
  let routes = null;
  let routesKey = "";
  const islands = new Map();
  let isDirty = true;
  let lastStep = 0;
  let lastRoutineCheck = 0;

  function replace(previous, next) {
    if (previous) {
      scene.remove(previous);
      disposePiece(previous);
    }
    scene.add(next);
    return next;
  }

  function showSite() {
    const key = siteSignature(layout);
    if (key === siteKey) return;
    siteKey = key;
    site = replace(site, buildSite(layout));
    rig.frame({ ...layout.bounds, maxY: layout.yard.flagpole.height + SIGN_CAP_ALLOWANCE });
  }

  function showIslands() {
    for (const island of layout.islands) {
      const key = islandSignature(island);
      const shown = islands.get(island.index);
      if (shown?.key === key) continue;
      islands.set(island.index, { key, piece: replace(shown?.piece, islandPiece(island)) });
    }
    for (const [index, { piece }] of islands) {
      if (index < layout.islands.length) continue;
      scene.remove(piece);
      disposePiece(piece);
      islands.delete(index);
    }
  }

  function routesFor() {
    const key = routesSignature(layout);
    if (key !== routesKey) {
      routesKey = key;
      routes = headquartersRoutes(layout);
    }
    return routes.routeFor;
  }

  function show(projects) {
    layout = layoutHeadquarters(projects);
    showSite();
    showIslands();
    const spots = headquartersSpots(layout);
    people.show({ layout, spots, routeFor: routesFor(), agents: agentsOf(projects) }, performance.now() / 1000);
    labels.show(layout, rig.camera);
    isDirty = true;
  }

  function resize() {
    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);
    renderer.setSize(Math.round(width / ART_PIXEL), Math.round(height / ART_PIXEL), false);
    rig.setViewport(width, height);
    isDirty = true;
  }

  // People move at the pixel-art pace of 12 frames a second; with reduced motion they only change when something does.
  function stepPeople(now) {
    const elapsed = now - lastStep;
    const isAnimating = people.hasPeople() && !isMotionReduced;
    if (elapsed < FRAME_MS || !(isAnimating || isDirty)) return;
    lastStep = now;
    const seconds = now / 1000;
    if (now - lastRoutineCheck > ROUTINE_CHECK_MS) {
      lastRoutineCheck = now;
      people.arrange(seconds);
    }
    people.step(Math.min(elapsed / 1000, MAX_STEP_SECONDS), seconds);
    isDirty = true;
  }

  function tick(now) {
    requestAnimationFrame(tick);
    if (!layout || !canvas.isConnected || document.hidden) return;
    stepPeople(now);
    if (!isDirty) return;
    isDirty = false;
    people.follow(rig.camera, now / 1000);
    labels.place(rig.camera);
    renderer.render(scene, rig.camera);
    onFrame({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles });
  }

  function agentAt({ clientX, clientY }) {
    const rect = canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, rig.camera);
    const hit = raycaster.intersectObjects(people.bodies(), true)[0];
    for (let node = hit?.object; node; node = node.parent) if (node.userData.agentKey) return node.userData.agentKey;
    return null;
  }

  canvas.addEventListener("click", (event) => { const key = agentAt(event); if (key) onPick(key); });
  canvas.addEventListener("pointermove", (event) => { canvas.style.cursor = agentAt(event) ? "pointer" : "default"; });
  new ResizeObserver(resize).observe(stage);
  requestAnimationFrame(tick);

  const invalidate = () => { isDirty = true; };

  return { element: stage, show, resize, invalidate, scene, rig, layoutShown: () => layout };
}
