import { layoutHeadquarters } from "../../domain/headquarters/headquarters-layout.js";
import { isScreenLit } from "../../domain/office/agent-status.js";
import { buildCommonRooms } from "../furniture/common-rooms.js";
import { buildHeadquartersShell } from "../furniture/headquarters-shell.js";
import { buildIsland } from "../furniture/island.js";
import { monumentSign } from "../furniture/monument-sign.js";
import { buildYard } from "../furniture/yard.js";
import { THREE } from "../kit.js";
import { createCameraRig } from "./camera-rig.js";
import { batchStatic } from "./static-batch.js";

const ART_PIXEL = 2;
const AMBIENT_INTENSITY = 2.3;
const SIGN_CAP_ALLOWANCE = 0.2;

const seatSignature = (seat) => (seat.agent ? `${seat.agent.key}:${isScreenLit(seat.agent)}` : `-${seat.role ?? ""}`);
const islandSignature = (island) => `${island.projectKey}|${island.theme.id}|${island.x}|${island.z}|${island.seats.map(seatSignature).join(",")}`;
const siteSignature = (layout) => `${layout.size.D}|${layout.corners.map((corner) => corner.index).join(",")}`;

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

// The static headquarters: the building, the common rooms and the yard as one piece, and one piece per island that is rebuilt
// alone when its project, theme, occupants or screens change.
export function createHeadquartersRenderer({ onFrame = () => {} } = {}) {
  const stage = document.createElement("div");
  stage.className = "hq-stage";
  const canvas = document.createElement("canvas");
  canvas.className = "hq-canvas";
  stage.append(canvas);

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

  let layout = null;
  let site = null;
  let siteKey = "";
  const islands = new Map();
  let isDirty = true;

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

  function show(projects) {
    layout = layoutHeadquarters(projects);
    showSite();
    showIslands();
    isDirty = true;
  }

  function resize() {
    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);
    renderer.setSize(Math.round(width / ART_PIXEL), Math.round(height / ART_PIXEL), false);
    rig.setViewport(width, height);
    isDirty = true;
  }

  function tick() {
    requestAnimationFrame(tick);
    if (!isDirty || !layout || !canvas.isConnected || document.hidden) return;
    isDirty = false;
    renderer.render(scene, rig.camera);
    onFrame({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles });
  }

  new ResizeObserver(resize).observe(stage);
  requestAnimationFrame(tick);

  const invalidate = () => { isDirty = true; };

  return { element: stage, show, resize, invalidate, scene, rig, layoutShown: () => layout };
}
