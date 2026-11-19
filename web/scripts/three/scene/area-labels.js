import { ISLAND_SEATS } from "../../domain/headquarters/island-grid.js";
import { seatStop } from "../../domain/room/room-spots.js";
import { createNameplate, placeNameplate, worldPointOnScreen } from "./name-tags.js";

const LABELED_AREAS = new Set(["meeting", "pantry", "games", "lounge", "work", "reception"]);
const AREA_LABEL_INSET = 0.7;
const AREA_LABEL_HEIGHT = 1.1;
const ISLAND_LABEL_HEIGHT = 2.5;
const FREE_ISLAND_TEXT = `ilha livre · ${ISLAND_SEATS} lugares`;

function areaEntries(layout) {
  return layout.areas.filter((area) => LABELED_AREAS.has(area.id)).map((area) => ({
    kind: "area", text: area.name, point: { x: area.x + AREA_LABEL_INSET, y: AREA_LABEL_HEIGHT, z: area.z + AREA_LABEL_INSET },
  }));
}

function islandEntries(layout) {
  return layout.islands.map((island) => ({
    kind: island.projectKey ? "island" : "free-island",
    text: island.projectKey ? island.projectName : FREE_ISLAND_TEXT,
    detail: island.projectKey ? ` · ${island.theme.name}` : "",
    point: { x: island.desk.x + island.desk.w / 2, y: ISLAND_LABEL_HEIGHT, z: island.desk.z + island.desk.d / 2 },
  }));
}

function reservedDesks(layout) {
  return layout.islands.flatMap((island) => island.seats.filter((seat) => !seat.agent && seat.role).map((seat) => ({ role: seat.role, ...seatStop(island, seat) })));
}

function labelOf({ kind, text, detail = "" }) {
  const label = document.createElement("span");
  label.className = `area-label is-${kind}`;
  label.textContent = text;
  if (detail) {
    const extra = document.createElement("span");
    extra.className = "area-label-detail";
    extra.textContent = detail;
    label.append(extra);
  }
  return label;
}

const signatureOf = (entries, plates) => JSON.stringify([entries, plates.map(({ role, x, z }) => [role, x, z])]);

// Names of the common rooms, of each island and of the desks reserved for a role, kept on their spot as the camera moves.
// From afar only the project names stay, without their theme.
export function createAreaLabels(layer) {
  let labels = [];
  let plates = [];
  let signature = "";

  function show(layout, camera) {
    const entries = [...areaEntries(layout), ...islandEntries(layout)];
    const reserved = reservedDesks(layout);
    const next = signatureOf(entries, reserved);
    if (next === signature) return;
    signature = next;
    labels = entries.map((entry) => ({ element: labelOf(entry), point: entry.point }));
    plates = reserved.map((desk) => ({ element: createNameplate(desk, camera), desk }));
    layer.replaceChildren(...labels.map(({ element }) => element), ...plates.map(({ element }) => element));
  }

  function place(camera, detail) {
    if (layer.dataset.detail !== detail) layer.dataset.detail = detail;
    for (const { element, point } of labels) {
      const { left, top, isInView } = worldPointOnScreen(point, camera);
      element.style.left = left;
      element.style.top = top;
      element.hidden = !isInView;
    }
    for (const { element, desk } of plates) placeNameplate(element, desk, camera);
  }

  return { show, place };
}
