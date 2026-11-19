import { MINIMAP_SIZE } from "../../domain/headquarters/minimap-shapes.js";
import { esc } from "../shared/escape-html.js";

const MINIMAP_HINT = "Clique ou arraste no minimapa para levar a câmera";

// The minimap is only for the mouse and touch: the room list is its keyboard and screen reader equivalent.
export function renderCameraControls() {
  return `<canvas class="hq-minimap" width="${MINIMAP_SIZE.width}" height="${MINIMAP_SIZE.height}" aria-hidden="true" title="${MINIMAP_HINT}" data-minimap></canvas>
    <div class="hq-camera-buttons">
      <button class="hq-camera-button" type="button" data-camera="in" aria-label="Aproximar" title="Aproximar (+)">+</button>
      <button class="hq-camera-button" type="button" data-camera="out" aria-label="Afastar" title="Afastar (-)">−</button>
      <button class="hq-camera-button" type="button" data-camera="whole" aria-label="Enquadrar a Sede inteira" title="Enquadrar a Sede inteira (0)">⤢</button>
    </div>
    <div class="hq-following" data-slot="following" hidden></div>`;
}

export function renderFollowing(agentName) {
  return `<span class="hq-following-text">Seguindo <b>${esc(agentName)}</b></span>
    <button class="btn btn-sm btn-secondary" type="button" data-camera="unfollow">Parar de seguir</button>`;
}

export const followingStoppedText = (agentName) => `A câmera parou de seguir ${agentName}.`;
