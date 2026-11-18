import { freshestThoughts, thoughtAt } from "../domain/behavior/agent-thoughts.js";
import { createFreeTimeClock } from "../domain/behavior/free-time-clock.js";
import { assignPlaces } from "../domain/behavior/room-places.js";
import { nearestLaneZ, routeBetween } from "../domain/room/room-routes.js";
import { exitStop } from "../domain/room/room-spots.js";
import { createConversationTracker } from "../view/conversation-tracker.js";
import { THREE } from "./kit.js";
import { isWalking, placeAt, setReaction, standAt, stepPerson, TAG_HEIGHT_ABOVE_HIP, walkTo } from "./people.js";
import { buildRoom } from "./room.js";
import { createThoughtBubble } from "./thought-bubble.js";

const ART_PIXEL = 2;
const FRAME_MS = 1000 / 12;
const MAX_STEP_SECONDS = 0.25;
const VIEW_ELEVATION = (58 * Math.PI) / 180;
const VIEW_DIRECTION = new THREE.Vector3(0, Math.sin(VIEW_ELEVATION), Math.cos(VIEW_ELEVATION));
const NAME_TAG_MAX_WIDTH = 1.2;
const AMBIENT_INTENSITY = 2.3;
const SUN_INTENSITY = 1.1;
const SAME_STOP = 0.01;
const NAMEPLATE_HEIGHT = 0.75;
const ROUTINE_CHECK_MS = 2_000;
const HURRYING_THOUGHTS = "hurrying";
const LIT = new Set(["working", "reviewing", "needs_you", "waiting"]);

const isSameStop = (a, b) => Boolean(a && b) && Math.abs(a.x - b.x) < SAME_STOP && Math.abs(a.z - b.z) < SAME_STOP;

function createNameTag(key, onPick) {
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

export function createRoomRenderer({ onPick, describeStatus }) {
  const stage = document.createElement("div");
  stage.className = "room-stage";
  const canvas = document.createElement("canvas");
  canvas.className = "room-canvas";
  const tagLayer = document.createElement("div");
  tagLayer.className = "room-tags";
  stage.append(canvas, tagLayer);

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
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  scene.add(new THREE.AmbientLight("#ffffff", AMBIENT_INTENSITY));
  const sun = new THREE.DirectionalLight("#fff4e0", SUN_INTENSITY);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.002;
  scene.add(sun, sun.target);

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const raycaster = new THREE.Raycaster();
  const tags = new Map();
  const thoughts = new Map();
  // Where everyone was last seen, so a redraw of the room does not teleport people back to their desks.
  const lastSeen = new Map();
  const reactionSince = new Map();
  const freeTimeClock = createFreeTimeClock();
  const followConversations = createConversationTracker();
  let places = new Map();
  const visitedRooms = new Set();
  const anchor = new THREE.Vector3();
  let room = null;
  let roomAgents = [];
  let lastRoutineCheck = 0;
  let roomKey = "";
  let signature = "";
  let aspect = 1.6;
  let lastFrame = 0;
  let dirty = true;

  function frame(size) {
    const center = new THREE.Vector3(size.W / 2, size.H / 2, size.D / 2);
    camera.position.copy(center).addScaledVector(VIEW_DIRECTION, 60);
    camera.lookAt(center);
    camera.updateMatrixWorld();
    const inverse = camera.matrixWorldInverse;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const x of [-0.2, size.W + 0.2]) for (const y of [-0.1, size.H + 0.6]) for (const z of [-0.2, size.D + 0.2]) {
      const p = new THREE.Vector3(x, y, z).applyMatrix4(inverse);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const pad = 0.3;
    camera.left = minX - pad; camera.right = maxX + pad; camera.bottom = minY - pad; camera.top = maxY + pad;
    camera.updateProjectionMatrix();
    aspect = (camera.right - camera.left) / (camera.top - camera.bottom);

    sun.position.set(size.W / 2 + 2, 18, size.D / 2 + 5);
    sun.target.position.set(size.W / 2, 0, size.D / 2);
    const reach = (size.W + size.D) * 0.75;
    Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: 60 });
    sun.shadow.camera.updateProjectionMatrix();
  }

  function resize() {
    const host = stage.parentElement;
    if (!host) return;
    const cssWidth = Math.max(320, host.clientWidth);
    const cssHeight = Math.min(cssWidth / aspect, window.innerHeight * 0.74);
    const width = cssHeight * aspect;
    renderer.setSize(Math.round(width / ART_PIXEL), Math.round(cssHeight / ART_PIXEL), false);
    canvas.style.width = `${Math.round(width)}px`;
    canvas.style.height = `${Math.round(cssHeight)}px`;
    dirty = true;
  }

  function createNameplate({ role, x, z, hipY }) {
    const plate = document.createElement("span");
    plate.className = "name-tag reserved";
    plate.textContent = role;
    plate.title = `Mesa de ${role}: ninguém neste papel agora`;
    anchor.set(x, hipY + NAMEPLATE_HEIGHT, z).project(camera);
    plate.style.left = `${(anchor.x + 1) * 50}%`;
    plate.style.top = `${(1 - anchor.y) * 50}%`;
    return plate;
  }

  function createNameTags() {
    tags.clear();
    thoughts.clear();
    for (const key of room.people.keys()) {
      tags.set(key, createNameTag(key, onPick));
      thoughts.set(key, createThoughtBubble());
    }
    tagLayer.style.setProperty("--tag-max-width", `${(NAME_TAG_MAX_WIDTH / (camera.right - camera.left)) * 100}%`);
    const bubbles = [...thoughts.values()].map((bubble) => bubble.element);
    tagLayer.replaceChildren(...room.nameplates.map(createNameplate), ...[...tags.values()].map((tag) => tag.element), ...bubbles);
  }

  function headPositionOf(person) {
    anchor.copy(person.root.position);
    anchor.y += TAG_HEIGHT_ABOVE_HIP;
    anchor.project(camera);
    return { left: `${(anchor.x + 1) * 50}%`, top: `${(1 - anchor.y) * 50}%` };
  }

  function currentThought(person, seconds) {
    const agent = roomAgents.find((candidate) => candidate.key === person.key);
    const current = reactionSince.get(person.key);
    if (!agent || !current || !person.root.visible) return null;
    const reactionId = isWalking(person) && person.isHurrying ? HURRYING_THOUGHTS : current.reactionId;
    return thoughtAt({
      agentKey: person.key, reactionId, action: agent.action,
      sinceSeconds: current.since, nowSeconds: seconds, gapSeconds: person.temperament.thoughtGapSeconds,
    });
  }

  function converse(seconds) {
    const people = [...room.people.values()].map((person) => ({
      key: person.key, x: person.root.position.x, z: person.root.position.z,
      isStill: person.hasPosition && person.root.visible && !isWalking(person),
    }));
    const roles = reduceMotion ? new Map() : followConversations({ people, agents: roomAgents, places, nowMs: Date.now(), seconds });
    for (const person of room.people.values()) person.conversation = roles.get(person.key) ?? null;
  }

  function follow(seconds) {
    const thinking = [];
    const speeches = new Map();
    for (const [key, person] of room.people) {
      const tag = tags.get(key);
      const { left, top } = headPositionOf(person);
      tag.element.hidden = !person.root.visible;
      tag.element.style.left = left;
      tag.element.style.top = top;
      if (person.conversation) {
        if (person.conversation.speech) speeches.set(key, { text: person.conversation.speech, left, top });
        continue;
      }
      const thought = reduceMotion ? null : currentThought(person, seconds);
      if (thought) thinking.push([key, { ...thought, left, top }]);
    }
    const shown = freshestThoughts(thinking);
    const byKey = new Map(thinking);
    for (const [key, bubble] of thoughts) {
      const speech = speeches.get(key);
      const thought = byKey.get(key);
      if (speech) bubble.show(speech.text, speech.left, speech.top, { isSpeech: true });
      else if (shown.has(key)) bubble.show(thought.text, thought.left, thought.top);
      else bubble.hide();
    }
  }

  function rebuild(project, theme) {
    if (room) scene.remove(room.root);
    room = buildRoom(project, theme);
    roomKey = project.key;
    scene.add(room.root);
    frame(room.size);
    createNameTags();
    resize();
  }

  function startingPoint(person) {
    const seen = lastSeen.get(person.key);
    if (seen) return seen;
    return visitedRooms.has(roomKey) ? exitStop(room.layout) : null;
  }

  function keepsCourse(person, stop, isUrgent) {
    if (!isSameStop(person.stop, stop)) return false;
    return !isUrgent || !isWalking(person) || person.isHurrying;
  }

  function direct(person, { stop, isUrgent }) {
    if (keepsCourse(person, stop, isUrgent)) return;
    const { lanes } = room.layout.zones;
    const staysSeated = !person.hasPosition && Boolean(lastSeen.get(person.key)?.wasAtDesk) && Boolean(stop.isDesk);
    const from = person.hasPosition ? { x: person.root.position.x, z: person.root.position.z } : startingPoint(person);
    if (!from || reduceMotion || staysSeated || isSameStop(from, stop)) {
      placeAt(person, stop);
      return;
    }
    if (!person.hasPosition) standAt(person, from);
    const origin = isSameStop(from, person.stop) ? person.stop : { ...from, laneZ: nearestLaneZ(from.z, lanes.laneZs), spine: null };
    walkTo(person, stop, routeBetween(origin, stop, lanes), { isUrgent });
  }

  function noteReaction(person, reactionId, seconds) {
    const current = reactionSince.get(person.key);
    if (current?.reactionId === reactionId) return;
    const since = current ? seconds : seconds - person.temperament.phaseSeconds;
    reactionSince.set(person.key, { reactionId, since });
  }

  // Runs on every update and on a timer, because people with free time change activity as time passes.
  function arrange() {
    const freeSince = freeTimeClock(roomAgents);
    places = assignPlaces(roomAgents, reduceMotion ? null : Date.now(), room.layout, freeSince);
    const seconds = performance.now() / 1000;
    for (const [key, person] of room.people) {
      const place = places.get(key);
      if (!place) continue;
      if (setReaction(person, place.reaction)) dirty = true;
      noteReaction(person, place.reaction, seconds);
      direct(person, place);
    }
  }

  function show(project, theme) {
    const agents = Object.values(project.agents);
    const next = `${project.key}|${theme.id}|${(project.team ?? []).join(",")}|${agents.map((a) => `${a.key}:${LIT.has(a.status)}:${Boolean(a.endedAt)}`).sort().join(",")}`;
    if (next !== signature) {
      rebuild(project, theme);
      signature = next;
    }
    roomAgents = agents;
    arrange();
    for (const agent of agents) {
      const tag = tags.get(agent.key);
      if (!tag) continue;
      tag.element.dataset.status = agent.status;
      tag.name.textContent = agent.name;
      tag.title.textContent = agent.label;
      tag.element.title = `${agent.name} · ${agent.label} · ${describeStatus(agent.status)}`;
    }
    visitedRooms.add(project.key);
    dirty = true;
  }

  function tick(now) {
    requestAnimationFrame(tick);
    if (!room || !canvas.isConnected || document.hidden) return;
    const elapsed = now - lastFrame;
    if (elapsed < FRAME_MS) return;
    if (reduceMotion && !dirty) return;
    lastFrame = now;
    dirty = false;
    const dt = Math.min(elapsed / 1000, MAX_STEP_SECONDS);
    if (now - lastRoutineCheck > ROUTINE_CHECK_MS) {
      lastRoutineCheck = now;
      arrange();
    }
    const seconds = now / 1000;
    converse(seconds);
    for (const person of room.people.values()) {
      stepPerson(person, dt, seconds);
      const wasAtDesk = Boolean(person.stop?.isDesk) && !isWalking(person);
      lastSeen.set(person.key, { x: person.root.position.x, z: person.root.position.z, wasAtDesk });
    }
    follow(seconds);
    renderer.render(scene, camera);
  }

  function agentAt(event) {
    if (!room) return null;
    const rect = canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const bodies = [...room.people.values()].map((person) => person.root);
    const hit = raycaster.intersectObjects(bodies, true)[0];
    for (let node = hit?.object; node; node = node.parent) if (node.userData.agentKey) return node.userData.agentKey;
    return null;
  }

  canvas.addEventListener("click", (event) => { const key = agentAt(event); if (key) onPick(key); });
  canvas.addEventListener("pointermove", (event) => { canvas.style.cursor = agentAt(event) ? "pointer" : "default"; });
  new ResizeObserver(resize).observe(document.body);
  requestAnimationFrame(tick);

  return { element: stage, show, resize };
}
