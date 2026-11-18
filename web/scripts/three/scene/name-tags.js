import { THREE } from "../kit.js";
import { TAG_HEIGHT_ABOVE_HIP } from "../people/people.js";

const NAME_TAG_MAX_WIDTH = 1.2;
const NAMEPLATE_HEIGHT = 0.75;

const anchor = new THREE.Vector3();

const screenPositionOf = (camera) => {
  anchor.project(camera);
  return { left: `${(anchor.x + 1) * 50}%`, top: `${(1 - anchor.y) * 50}%` };
};

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

export function createNameplate({ role, x, z, hipY }, camera) {
  const plate = document.createElement("span");
  plate.className = "name-tag reserved";
  plate.textContent = role;
  plate.title = `Mesa de ${role}: ninguém neste papel agora`;
  anchor.set(x, hipY + NAMEPLATE_HEIGHT, z);
  const { left, top } = screenPositionOf(camera);
  plate.style.left = left;
  plate.style.top = top;
  return plate;
}

export function headPositionOf(person, camera) {
  anchor.copy(person.root.position);
  anchor.y += TAG_HEIGHT_ABOVE_HIP;
  return screenPositionOf(camera);
}

export const nameTagMaxWidth = (camera) => `${(NAME_TAG_MAX_WIDTH / (camera.right - camera.left)) * 100}%`;
