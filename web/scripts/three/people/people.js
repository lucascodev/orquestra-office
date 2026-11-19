import { temperamentOf } from "../../domain/behavior/agent-temperament.js";
import { fidgetAt } from "../../domain/behavior/seated-fidgets.js";
import { walkStep } from "../../domain/behavior/walk-step.js";
import { PUFF_HIP, STANDING_HIP } from "../../domain/room/room-dimensions.js";
import { box, cyl, group } from "../kit.js";
import { createEmote } from "./emotes.js";
import { looksOf } from "./looks.js";
import { CONVERSATION_POSES, FIDGET_POSES, POSES, rallyAt, resetPose, walkPose } from "./poses.js";
import { REACTIONS } from "./reactions.js";

const DARK = "#1b1f2b";
const WALK_SPEED = 1.5;
const HURRY_PACE = 2.4;
const EYE_HEIGHT = 0.07;
const CLOSED_EYE_HEIGHT = 0.012;
const BLINK_EVERY_SECONDS = 4.2;
const BLINK_SECONDS = 0.15;
const EYES_CLOSED_POSES = new Set(["dozing"]);
const MAX_SEATED_TURN = 1.3;
const SEATED_TORSO_SHARE = 0.4;
const SEATED_HEAD_SHARE = 0.6;
const EMOTE_OFFSET = { x: 0.42, y: 0.82 };
const TAG_HEIGHT = 1.02;
const EMOTE_FRAMES_PER_SECOND = 2;
const SIDES = [-1, 1];
const PADDLE_RED = "#d64545";
const PADDLE_HANDLE = "#9a6a44";
const BALL_SIZE = 0.06;
const BALL_WHITE = "#f4f6f8";

function buildArm(parent, side, look) {
  const shoulder = group(parent, side * 0.25, 0.42, 0);
  box(shoulder, [0.1, 0.22, 0.12], [-0.05, -0.22, -0.06], look.shirt);
  const elbow = group(shoulder, 0, -0.22, 0);
  box(elbow, [0.09, 0.24, 0.09], [-0.045, -0.24, -0.045], look.shirt);
  box(elbow, [0.09, 0.1, 0.09], [-0.045, -0.34, -0.045], look.skin);
  return { shoulder, elbow };
}

function buildLeg(parent, side, look) {
  const hip = group(parent, side * 0.105, 0, 0);
  box(hip, [0.15, 0.42, 0.14], [-0.075, -0.42, -0.07], look.pants);
  const knee = group(hip, 0, -0.42, 0);
  box(knee, [0.13, 0.42, 0.13], [-0.065, -0.42, -0.065], look.pants);
  box(knee, [0.14, 0.07, 0.22], [-0.07, -0.49, -0.07], DARK);
  return { hip, knee };
}

function asFineDetail(part) {
  part.userData.isFineDetail = true;
  return part;
}

function buildHead(parent, look) {
  const head = group(parent, 0, 0.46, 0);
  asFineDetail(box(head, [0.1, 0.05, 0.1], [-0.05, -0.02, -0.05], look.skin));
  box(head, [0.36, 0.32, 0.34], [-0.18, 0.02, -0.17], look.skin);
  box(head, [0.4, 0.11, 0.38], [-0.2, 0.3, -0.19], look.hair);
  box(head, [0.4, look.long ? 0.46 : 0.26, 0.09], [-0.2, look.long ? -0.12 : 0.06, -0.21], look.hair);
  asFineDetail(box(head, [0.05, 0.2, 0.2], [-0.2, 0.12, -0.14], look.hair));
  asFineDetail(box(head, [0.05, 0.2, 0.2], [0.15, 0.12, -0.14], look.hair));
  const eyes = [-0.1, 0.05].map((x) => asFineDetail(box(head, [0.05, EYE_HEIGHT, 0.012], [x, 0.13, 0.17], DARK)));
  return { head, eyes };
}

function buildProps(hand) {
  const mug = asFineDetail(group(hand));
  cyl(mug, 0.05, 0.11, [0, -0.4, 0.07], "#ffffff");
  const paper = asFineDetail(group(hand));
  box(paper, [0.34, 0.26, 0.015], [-0.44, -0.46, 0.05], "#ffffff");
  const can = asFineDetail(group(hand));
  box(can, [0.14, 0.16, 0.14], [-0.07, -0.5, 0.0], "#4f9d7a");
  box(can, [0.04, 0.04, 0.18], [-0.02, -0.42, 0.14], "#4f9d7a");
  const paddle = asFineDetail(group(hand));
  box(paddle, [0.04, 0.1, 0.04], [-0.02, -0.46, 0.03], PADDLE_HANDLE);
  box(paddle, [0.2, 0.2, 0.03], [-0.1, -0.66, 0.03], PADDLE_RED);
  return { mug, paper, can, paddle };
}

function buildBall(parent) {
  const ball = asFineDetail(group(parent));
  box(ball, [BALL_SIZE, BALL_SIZE, BALL_SIZE], [-BALL_SIZE / 2, -BALL_SIZE / 2, -BALL_SIZE / 2], BALL_WHITE, { shadow: false });
  ball.visible = false;
  return ball;
}

export function createPerson(parent, agent) {
  const look = looksOf(agent.key);
  const root = group(parent);
  root.userData.agentKey = agent.key;
  const upper = group(root);
  box(upper, [0.4, 0.46, 0.24], [-0.2, -0.02, -0.12], look.shirt);
  const arms = SIDES.map((side) => buildArm(upper, side, look));
  const { head, eyes } = buildHead(upper, look);
  const person = {
    key: agent.key, root, upper, arms, head, eyes,
    legs: SIDES.map((side) => buildLeg(root, side, look)),
    props: buildProps(arms[1].elbow),
    ball: buildBall(root),
    emote: createEmote(root),
    temperament: temperamentOf(agent.key),
    reaction: REACTIONS.typing, stop: null, path: [], pace: 1, isHurrying: false, isSeated: true, hasPosition: false, conversation: null,
  };
  person.emote.sprite.position.set(EMOTE_OFFSET.x, EMOTE_OFFSET.y, 0);
  setReaction(person, "typing");
  return person;
}

export function removePerson(person) {
  person.root.removeFromParent();
  person.emote.dispose();
}

export function setReaction(person, reactionId) {
  const reaction = REACTIONS[reactionId] ?? REACTIONS.typing;
  const hasChanged = person.reaction !== reaction;
  person.reaction = reaction;
  return hasChanged;
}

function holdProp(person, propName) {
  for (const [name, prop] of Object.entries(person.props)) prop.visible = propName === name;
}

export function placeAt(person, stop) {
  person.root.position.set(stop.x, stop.hipY, stop.z);
  person.root.rotation.y = stop.facing;
  person.stop = stop;
  person.path = [];
  person.isHurrying = false;
  person.isSeated = stop.isSeat;
  person.hasPosition = true;
}

export function standAt(person, point) {
  person.root.position.set(point.x, STANDING_HIP, point.z);
  person.isSeated = false;
  person.hasPosition = true;
}

export function walkTo(person, stop, path, { isUrgent }) {
  person.stop = stop;
  person.path = [...path];
  person.isHurrying = isUrgent;
  person.pace = person.temperament.walkPace * (isUrgent ? HURRY_PACE : 1);
  person.isSeated = false;
}

export const isWalking = (person) => person.path.length > 0;

function advance(person, dt, t) {
  const { position } = person.root;
  const step = walkStep({ position: { x: position.x, z: position.z }, path: person.path, distance: WALK_SPEED * person.pace * dt });
  position.x = step.position.x;
  position.z = step.position.z;
  person.path = step.path;
  if (step.heading !== null) person.root.rotation.y = step.heading;
  if (person.path.length === 0) placeAt(person, person.stop);
  else position.y = STANDING_HIP + walkPose(person, t, person.pace);
}

function seatedFidget(person, t) {
  const canFidget = person.isSeated && person.reaction.fidgets;
  return canFidget ? fidgetAt(person.key, t, person.temperament.fidgetEverySeconds) : null;
}

function blink(person, t, isAwake) {
  const isClosed = (!isAwake && EYES_CLOSED_POSES.has(person.reaction.pose)) || t % BLINK_EVERY_SECONDS < BLINK_SECONDS;
  for (const eye of person.eyes) eye.scale.y = isClosed ? CLOSED_EYE_HEIGHT : EYE_HEIGHT;
}

const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));

function faceTowards(person, focus) {
  const { position, rotation } = person.root;
  const angle = Math.atan2(focus.x - position.x, focus.z - position.z);
  if (!person.isSeated) {
    rotation.y = angle;
    return;
  }
  const turn = clamp(wrapAngle(angle - rotation.y), MAX_SEATED_TURN);
  person.upper.rotation.y += turn * SEATED_TORSO_SHARE;
  person.head.rotation.y += turn * SEATED_HEAD_SHARE;
}

// A low seat leaves no room for the legs under it, so whoever rests there stretches them out.
const isLowSeat = (stop) => Boolean(stop?.isSeat) && stop.hipY <= PUFF_HIP;
const stillPoseOf = (person) => (isLowSeat(person.stop) && person.reaction.lowSeatPose) || person.reaction.pose;

function poseWhileStill(person, t, talk, fidget) {
  resetPose(person, person.isSeated);
  if (talk) {
    CONVERSATION_POSES[talk.isSpeaking ? "speaking" : "listening"](person, t);
    faceTowards(person, talk.focus);
    return;
  }
  if (!person.isSeated && person.stop) person.root.rotation.y = person.stop.facing;
  if (fidget) FIDGET_POSES[fidget.pose](person, t, fidget.progress);
  else POSES[stillPoseOf(person)](person, t);
}

export function stepPerson(person, dt, seconds) {
  const t = seconds + person.temperament.phaseSeconds;
  if (isWalking(person)) advance(person, dt, t);
  const hasArrived = !isWalking(person);
  const talk = hasArrived ? person.conversation : null;
  const fidget = hasArrived && !talk ? seatedFidget(person, t) : null;
  if (hasArrived) poseWhileStill(person, t, talk, fidget);
  const isRallying = hasArrived && !talk && Boolean(person.reaction.hasRally);
  if (isRallying) rallyAt(person, seconds);
  person.ball.visible = isRallying;
  holdProp(person, fidget ? fidget.prop : person.reaction.prop);
  blink(person, t, Boolean(talk));
  person.root.visible = !(hasArrived && person.reaction.hidesOnArrival);
  person.emote.show(talk ? null : person.reaction.emote, Math.floor(t * EMOTE_FRAMES_PER_SECOND));
}

export const TAG_HEIGHT_ABOVE_HIP = TAG_HEIGHT;
