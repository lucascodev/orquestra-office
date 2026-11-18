import { clampToMap, frameBounds, ISOMETRIC_VIEW, transitionAt, zoomLimits } from "../../domain/camera/viewpoint.js";
import { THREE } from "../kit.js";

const CAMERA_DISTANCE = 120;
const CAMERA_NEAR = 1;
const CAMERA_FAR = 300;
const FRAME_MARGIN_PX = 16;
const FRAME_INSETS = { left: FRAME_MARGIN_PX, right: FRAME_MARGIN_PX, top: FRAME_MARGIN_PX, bottom: FRAME_MARGIN_PX };
const SUN_OFFSET = new THREE.Vector3(9, 22, 4);
const SUN_COLOR = "#fff4e0";
const SUN_INTENSITY = 1.1;
const SHADOW_MAP_SIZE = 2048;
const SHADOW_BIAS = -0.002;
const SHADOW_MARGIN = 2;
const PLACEHOLDER_SIZE = 1;

function directionOf({ yaw, pitch }) {
  return new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
}

function aimSun(sun, bounds) {
  const center = new THREE.Vector3((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2);
  sun.position.copy(center).add(SUN_OFFSET);
  sun.target.position.copy(center);
  const reach = Math.hypot(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2 + SHADOW_MARGIN;
  Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: SUN_OFFSET.length() + reach * 2 });
  sun.shadow.camera.updateProjectionMatrix();
}

// Applies a viewpoint of domain/camera/viewpoint.js ({ target on the ground, scale in CSS pixels per unit }) to an
// orthographic camera at the angle of the approved plan, glides between viewpoints and keeps the sun's shadow over the map.
export function createCameraRig({ view = ISOMETRIC_VIEW, isMotionReduced = false } = {}) {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, CAMERA_NEAR, CAMERA_FAR);
  const sun = new THREE.DirectionalLight(SUN_COLOR, SUN_INTENSITY);
  sun.castShadow = true;
  sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  sun.shadow.bias = SHADOW_BIAS;
  const direction = directionOf(view);
  let viewport = { width: PLACEHOLDER_SIZE, height: PLACEHOLDER_SIZE };
  let map = null;
  let viewpoint = null;
  let glide = null;

  function apply(next) {
    viewpoint = next;
    const target = new THREE.Vector3(next.target.x, 0, next.target.z);
    camera.position.copy(target).addScaledVector(direction, CAMERA_DISTANCE);
    camera.lookAt(target);
    const halfWidth = viewport.width / (2 * next.scale);
    const halfHeight = viewport.height / (2 * next.scale);
    Object.assign(camera, { left: -halfWidth, right: halfWidth, top: halfHeight, bottom: -halfHeight });
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  const framed = (bounds) => frameBounds({ bounds, viewport, insets: FRAME_INSETS, view });
  const limits = () => zoomLimits(framed(map).scale);
  const keptOnMap = (next) => clampToMap(next, map);
  const hasRealViewport = () => viewport.width > PLACEHOLDER_SIZE && viewport.height > PLACEHOLDER_SIZE;

  function frameWhole() {
    glide = null;
    apply(framed(map));
  }

  // The map is the ground the camera may look at plus the height of the tallest thing on it; it grows with each row of islands.
  function setMap(nextMap) {
    map = nextMap;
    aimSun(sun, map);
    if (viewpoint) apply(keptOnMap(viewpoint));
    else frameWhole();
  }

  // A resize keeps what the viewer was looking at; only the first real size frames the whole map.
  function setViewport(width, height) {
    const wasReal = hasRealViewport();
    viewport = { width: Math.max(PLACEHOLDER_SIZE, width), height: Math.max(PLACEHOLDER_SIZE, height) };
    if (!map) return;
    if (!viewpoint || !wasReal) frameWhole();
    else apply(keptOnMap(viewpoint));
  }

  function jumpTo(next) {
    glide = null;
    apply(keptOnMap(next));
  }

  function glideTo(next, now) {
    if (isMotionReduced) {
      jumpTo(next);
      return;
    }
    glide = { from: viewpoint, to: keptOnMap(next), startedAt: now };
  }

  function glideToBounds(bounds, now) {
    const next = framed(bounds);
    glideTo({ ...next, scale: Math.min(next.scale, limits().max) }, now);
  }

  const retarget = (target) => { if (glide) glide.to = keptOnMap({ ...glide.to, target }); };

  // Returns whether the camera moved, so the scene knows it must be drawn again.
  function step(now) {
    if (!glide) return false;
    const { viewpoint: next, isDone } = transitionAt(glide.from, glide.to, now - glide.startedAt, { isMotionReduced });
    apply(next);
    if (isDone) glide = null;
    return true;
  }

  return {
    camera, sun, setMap, setViewport, apply, jumpTo, glideTo, glideToBounds, retarget, step, frameWhole, limits,
    isGliding: () => glide !== null, viewpoint: () => viewpoint, viewport: () => viewport,
  };
}
