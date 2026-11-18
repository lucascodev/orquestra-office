import { frameBounds, ISOMETRIC_VIEW } from "../../domain/camera/viewpoint.js";
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

// Applies a viewpoint of domain/camera/viewpoint.js ({ target on the ground, scale in CSS pixels per unit}) to an
// orthographic camera at the angle of the approved plan, and keeps the sun's shadow over the whole map.
export function createCameraRig({ view = ISOMETRIC_VIEW } = {}) {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, CAMERA_NEAR, CAMERA_FAR);
  const sun = new THREE.DirectionalLight(SUN_COLOR, SUN_INTENSITY);
  sun.castShadow = true;
  sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  sun.shadow.bias = SHADOW_BIAS;
  const direction = directionOf(view);
  let viewport = { width: 1, height: 1 };
  let bounds = null;
  let viewpoint = null;

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

  const frameWhole = () => apply(frameBounds({ bounds, viewport, insets: FRAME_INSETS, view }));

  // Bounds are the map on the ground plus the height of the tallest thing on it.
  function frame(nextBounds) {
    bounds = nextBounds;
    aimSun(sun, bounds);
    frameWhole();
  }

  function setViewport(width, height) {
    viewport = { width: Math.max(1, width), height: Math.max(1, height) };
    if (bounds) frameWhole();
  }

  return { camera, sun, frame, setViewport, apply, viewpoint: () => viewpoint, viewport: () => viewport };
}
