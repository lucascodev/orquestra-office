import { freshestThoughts, thoughtAt } from "../../domain/behavior/agent-thoughts.js";
import { createFreeTimeClock } from "../../domain/behavior/free-time-clock.js";
import { planMovement } from "../../domain/behavior/movement-plan.js";
import { placeAgents } from "../../domain/behavior/room-places.js";
import { createConversationTracker } from "../../domain/conversations/conversation-tracker.js";
import { areaOfPoint } from "../../domain/headquarters/area-of-point.js";
import { bubbleDetail, figureDetail } from "../../domain/headquarters/figure-detail.js";
import { tagDetail } from "../../domain/headquarters/label-detail.js";
import { group } from "../kit.js";
import { createCrowd } from "../people/crowd.js";
import { createPerson, isWalking, placeAt, removePerson, setReaction, standAt, stepPerson, walkTo } from "../people/people.js";
import { createNameTag, headPositionOf } from "./name-tags.js";
import { createThoughtBubble } from "./thought-bubble.js";

const HURRYING_THOUGHTS = "hurrying";
const LEAVING = "leaving";
const RECEPTIONIST_KEY = "headquarters:receptionist";
const RECEPTIONIST_REACTION = "typing";
const RECEPTIONIST_TAG = "recepção";
const FIGURANT_STATUS = "idle";
const NEAR_FIGURES = "near";
const HIDDEN_BUBBLE = "hidden";
const COMPACT_BUBBLE = "compact";

function createFigurantTag(text) {
  const tag = document.createElement("span");
  tag.className = "name-tag is-figurant";
  tag.textContent = text;
  return tag;
}

function createReceptionist(parent) {
  const person = createPerson(parent, { key: RECEPTIONIST_KEY });
  delete person.root.userData.agentKey;
  setReaction(person, RECEPTIONIST_REACTION);
  return person;
}

// Everyone in the building: one figure per agent, created when the agent shows up and kept until it is gone, so people walk
// across the whole headquarters instead of being rebuilt with each island.
export function createHeadquartersPeople({ scene, tagLayer, onPick, describeStatus, isMotionReduced }) {
  const root = group(scene);
  const people = new Map();
  const reactionSince = new Map();
  const lastSeen = new Map();
  const freeTimeClock = createFreeTimeClock();
  const followConversations = createConversationTracker();
  const crowd = createCrowd(root);
  const receptionist = createReceptionist(root);
  crowd.join(RECEPTIONIST_KEY, receptionist.root);
  const receptionistTag = createFigurantTag(RECEPTIONIST_TAG);
  tagLayer.append(receptionistTag);
  let agents = [];
  let places = new Map();
  let layout = null;
  let spots = null;
  let routeFor = () => [];
  let hasShownPeople = false;
  let followedKey = null;

  function forget(key) {
    const { person, tag, bubble } = people.get(key);
    const wasAtDesk = Boolean(person.stop?.isDesk) && !isWalking(person);
    lastSeen.set(key, { x: person.root.position.x, z: person.root.position.z, wasAtDesk });
    removePerson(person);
    crowd.leave(key);
    tag.element.remove();
    bubble.element.remove();
    people.delete(key);
    reactionSince.delete(key);
  }

  function meet(agent) {
    const entry = { person: createPerson(root, agent), tag: createNameTag(agent.key, onPick), bubble: createThoughtBubble() };
    tagLayer.append(entry.tag.element, entry.bubble.element);
    crowd.join(agent.key, entry.person.root);
    people.set(agent.key, entry);
    label(agent);
  }

  // Someone on the way out finishes the walk to the main door even if the agent is forgotten before getting there.
  function isWalkingOut(key) {
    const { person } = people.get(key);
    return reactionSince.get(key)?.reactionId === LEAVING && person.root.visible;
  }

  // Only agents with somewhere to be get a figure: one that would have no place would just stand at the origin of the map.
  function gather() {
    const placed = agents.filter((agent) => places.get(agent.key)?.stop);
    const present = new Set(placed.map((agent) => agent.key));
    for (const key of [...people.keys()]) if (!present.has(key) && !isWalkingOut(key)) forget(key);
    for (const agent of placed) {
      if (people.has(agent.key)) continue;
      meet(agent);
      lastSeen.delete(agent.key);
    }
  }

  const movementOf = (person) => ({
    stop: person.stop,
    position: person.hasPosition ? { x: person.root.position.x, z: person.root.position.z } : null,
    isWalking: isWalking(person),
    isHurrying: person.isHurrying,
    isSeated: person.isSeated,
    lastSeen: lastSeen.get(person.key) ?? null,
  });

  function direct(person, place) {
    const room = { door: spots.arrival, hasVisited: hasShownPeople, routeFor };
    const plan = planMovement({ person: movementOf(person), place, room, isMotionReduced });
    if (plan.kind === "place") placeAt(person, plan.stop);
    if (plan.kind !== "walk") return;
    if (!person.hasPosition) standAt(person, plan.from);
    walkTo(person, place.stop, plan.path, { isUrgent: plan.isUrgent });
  }

  function noteReaction(person, reactionId, seconds) {
    const current = reactionSince.get(person.key);
    if (current?.reactionId === reactionId) return;
    const since = current ? seconds : seconds - person.temperament.phaseSeconds;
    reactionSince.set(person.key, { reactionId, since });
  }

  // Runs on every update and on a timer, because people with free time change activity as time passes.
  function arrange(seconds) {
    const freeSince = freeTimeClock(agents);
    places = placeAgents({ agents, now: isMotionReduced ? null : Date.now(), spots, freeSince, previous: places });
    gather();
    for (const [key, { person }] of people) {
      const place = places.get(key);
      if (!place) continue;
      setReaction(person, place.reaction);
      noteReaction(person, place.reaction, seconds);
      direct(person, place);
    }
  }

  function label(agent) {
    const { tag } = people.get(agent.key);
    tag.element.dataset.status = agent.status;
    tag.name.textContent = agent.name;
    tag.title.textContent = agent.label;
    tag.element.title = `${agent.name} · ${agent.label} · ${describeStatus(agent.status)}`;
  }

  function show(next, seconds) {
    ({ layout, spots, routeFor } = next);
    agents = next.agents;
    placeAt(receptionist, spots.receptionist);
    arrange(seconds);
    agents.filter((agent) => people.has(agent.key)).forEach(label);
    hasShownPeople = true;
  }

  function converse(seconds) {
    const positions = [...people.values()].map(({ person }) => ({
      key: person.key, x: person.root.position.x, z: person.root.position.z,
      areaId: areaOfPoint(layout, person.root.position),
      isStill: person.hasPosition && person.root.visible && !isWalking(person),
    }));
    const roles = isMotionReduced ? new Map() : followConversations({ people: positions, agents, places, nowMs: Date.now(), seconds });
    for (const { person } of people.values()) person.conversation = roles.get(person.key) ?? null;
  }

  function step(dt, seconds) {
    converse(seconds);
    for (const { person } of people.values()) stepPerson(person, dt, seconds);
    stepPerson(receptionist, dt, seconds);
  }

  function currentThought(person, agent, seconds) {
    const current = reactionSince.get(person.key);
    if (!agent || !current || !person.root.visible) return null;
    const reactionId = isWalking(person) && person.isHurrying ? HURRYING_THOUGHTS : current.reactionId;
    return thoughtAt({
      agentKey: person.key, reactionId, action: agent.action,
      sinceSeconds: current.since, nowSeconds: seconds, gapSeconds: person.temperament.thoughtGapSeconds,
    });
  }

  function showDetail(element, detail) {
    if (element.dataset.detail !== detail) element.dataset.detail = detail;
  }

  function pinTag(element, person, camera) {
    const position = headPositionOf(person, camera);
    element.hidden = !person.root.visible || !position.isInView;
    element.style.left = position.left;
    element.style.top = position.top;
    return position;
  }

  function showBubbles(thinking, speeches, scale) {
    const shown = freshestThoughts(thinking);
    const thoughts = new Map(thinking);
    for (const [key, { bubble }] of people) {
      const speech = speeches.get(key);
      const thought = shown.has(key) ? thoughts.get(key) : null;
      const said = speech ?? thought;
      const detail = said ? bubbleDetail({ scale, isSpeech: Boolean(speech), isFollowed: key === followedKey }) : HIDDEN_BUBBLE;
      if (detail === HIDDEN_BUBBLE) bubble.hide();
      else bubble.show(said.text, said.left, said.top, { isSpeech: Boolean(speech), isCompact: detail === COMPACT_BUBBLE });
    }
  }

  function drawFigures(scale) {
    const isNear = figureDetail(scale) === NEAR_FIGURES;
    receptionist.emote.mute(!isNear);
    for (const { person } of people.values()) person.emote.mute(!isNear);
    crowd.draw({ hasFineParts: isNear, castsShadow: isNear });
  }

  // Only people on screen think out loud, and only the three freshest of them. From afar the tags shrink to their status dot,
  // thoughts give way to the dots and the figures lose their small parts and shadows.
  function follow(camera, seconds, scale) {
    pinTag(receptionistTag, receptionist, camera);
    showDetail(receptionistTag, tagDetail({ scale, status: FIGURANT_STATUS, isFollowed: false }));
    const byKey = new Map(agents.map((agent) => [agent.key, agent]));
    const thinking = [];
    const speeches = new Map();
    for (const [key, { person, tag }] of people) {
      showDetail(tag.element, tagDetail({ scale, status: byKey.get(key)?.status, isFollowed: key === followedKey }));
      const { left, top, isInView } = pinTag(tag.element, person, camera);
      if (!isInView) continue;
      if (person.conversation) {
        if (person.conversation.speech) speeches.set(key, { text: person.conversation.speech, left, top });
        continue;
      }
      const thought = isMotionReduced ? null : currentThought(person, byKey.get(key), seconds);
      if (thought) thinking.push([key, { ...thought, left, top }]);
    }
    showBubbles(thinking, speeches, scale);
    drawFigures(scale);
  }

  function highlight(nextFollowedKey) {
    followedKey = nextFollowedKey;
    for (const [key, { tag }] of people) {
      const isFollowed = key === followedKey;
      tag.element.classList.toggle("is-followed", isFollowed);
      tag.element.setAttribute("aria-pressed", String(isFollowed));
    }
  }

  const destinations = () => new Map([...people.keys()].filter((key) => places.get(key)?.stop).map((key) => [key, places.get(key).stop]));
  const bodies = () => [...people.values()].map(({ person }) => person.root);
  const personOf = (key) => people.get(key)?.person ?? null;
  const tagOf = (key) => people.get(key)?.tag.element ?? null;

  return { show, arrange, step, follow, highlight, bodies, personOf, tagOf, destinations, hasPeople: () => people.size > 0 };
}
