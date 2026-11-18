import { THREE } from "../kit.js";
import { TAG_HEIGHT_ABOVE_HIP } from "../people/people.js";

const NAME_TAG_MAX_WIDTH = 1.2;
const NAMEPLATE_HEIGHT = 0.75;
const VIEW_EDGE = 1;

const anchor = new THREE.Vector3();

function screenPositionOf(camera) {
  anchor.project(camera);
  return {
    left: `${(anchor.x + 1) * 50}%`,
    top: `${(1 - anchor.y) * 50}%`,
    isInView: Math.abs(anchor.x) <= VIEW_EDGE && Math.abs(anchor.y) <= VIEW_EDGE,
  };
}

export function createNameTag(key, onPick) {
  const tag = document.createElement("button");
  tag.type = "button";
  tag.className = "name-tag";
  const text = document.createElement("span");
  const name = document.createElement("b");
  const title = document.createElement("small");
  text.append(name, title);
  tag.append(document.createElement("i"), text);
  tag.addEventListener("click", () => onPick(key));
  return { element: tag, name, title };
}

// A plate stands where its desk is in its own space (the room or the headquarters); the screen needs the world position.
export function placeNameplate(plate, { x, z, hipY }, camera, space = null) {
  anchor.set(x, hipY + NAMEPLATE_HEIGHT, z);
  if (space) {
    space.updateWorldMatrix(true, false);
    space.localToWorld(anchor);
  }
  const { left, top } = screenPositionOf(camera);
  plate.style.left = left;
  plate.style.top = top;
}

export function createNameplate(nameplate, camera, space = null) {
  const plate = document.createElement("span");
  plate.className = "name-tag reserved";
  plate.textContent = nameplate.role;
  plate.title = `Mesa de ${nameplate.role}: ninguém neste papel agora`;
  placeNameplate(plate, nameplate, camera, space);
  return plate;
}

export function headPositionOf(person, camera) {
  person.root.getWorldPosition(anchor);
  anchor.y += TAG_HEIGHT_ABOVE_HIP;
  return screenPositionOf(camera);
}

export function worldPointOnScreen(point, camera) {
  anchor.set(point.x, point.y, point.z);
  return screenPositionOf(camera);
}

export const nameTagMaxWidth = (camera) => `${(NAME_TAG_MAX_WIDTH / (camera.right - camera.left)) * 100}%`;
