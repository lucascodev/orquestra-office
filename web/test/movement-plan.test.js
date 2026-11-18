import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planMovement } from "../scripts/domain/behavior/movement-plan.js";

const DESK = { x: 2, z: 3, laneZ: 2.4, isDesk: true, isSeat: true };
const MOVED_DESK = { x: 5, z: 3, laneZ: 2.4, isDesk: true, isSeat: true };
const COFFEE = { x: 1, z: 0.9, laneZ: 0.9, isSeat: false };
const DOOR = { x: 0.6, z: 0.72, laneZ: 0.9, isSeat: false };
const HALFWAY = { x: 3.3, z: 1.7 };

function roomOf({ hasVisited = true } = {}) {
  const routes = [];
  const routeFor = (from, to) => {
    routes.push({ from, to });
    return [{ x: from.x, z: from.z }, { x: to.x, z: to.z }];
  };
  return { room: { door: DOOR, hasVisited, routeFor }, routes };
}

const personOf = (extra = {}) => ({ stop: null, position: null, isWalking: false, isHurrying: false, lastSeen: null, ...extra });

const plan = (person, place, { room, isMotionReduced = false }) => planMovement({ person, place, room, isMotionReduced });

describe("movement plan", () => {
  it("keeps someone who was seated at a desk seated when the desks change, instead of walking them over", () => {
    const { room, routes } = roomOf();
    const redrawn = personOf({ lastSeen: { x: DESK.x, z: DESK.z, wasAtDesk: true } });
    assert.deepEqual(plan(redrawn, { stop: MOVED_DESK, isUrgent: true }, { room }), { kind: "place", stop: MOVED_DESK });
    assert.deepEqual(routes, []);
  });

  it("walks someone seen seated who now goes somewhere that is not a desk, like the door or the coffee, from where they were", () => {
    for (const stop of [DOOR, COFFEE]) {
      const { room, routes } = roomOf();
      const lastSeen = { x: DESK.x, z: DESK.z, wasAtDesk: true };
      const movement = plan(personOf({ lastSeen }), { stop, isUrgent: false }, { room });
      assert.deepEqual(movement, { kind: "walk", from: lastSeen, path: [{ x: DESK.x, z: DESK.z }, { x: stop.x, z: stop.z }], isUrgent: false });
      assert.deepEqual(routes, [{ from: { x: DESK.x, z: DESK.z }, to: stop }]);
    }
  });

  it("walks someone already standing in the room to a new desk, even if they were last seen seated", () => {
    const { room, routes } = roomOf();
    const standing = personOf({ stop: DESK, position: { x: DESK.x, z: DESK.z }, lastSeen: { x: DESK.x, z: DESK.z, wasAtDesk: true } });
    const movement = plan(standing, { stop: MOVED_DESK, isUrgent: true }, { room });
    assert.equal(movement.kind, "walk");
    assert.deepEqual(routes, [{ from: DESK, to: MOVED_DESK }]);
  });

  it("walks someone back to the desk from where they were last seen when they were away from it", () => {
    const { room, routes } = roomOf();
    const lastSeen = { x: COFFEE.x, z: COFFEE.z, wasAtDesk: false };
    const movement = plan(personOf({ lastSeen }), { stop: DESK, isUrgent: true }, { room });
    assert.deepEqual(movement, { kind: "walk", from: lastSeen, path: [{ x: COFFEE.x, z: COFFEE.z }, { x: DESK.x, z: DESK.z }], isUrgent: true });
    assert.deepEqual(routes, [{ from: { x: COFFEE.x, z: COFFEE.z }, to: DESK }]);
  });

  it("brings someone new into a room already visited through the door", () => {
    const { room, routes } = roomOf({ hasVisited: true });
    const movement = plan(personOf(), { stop: DESK, isUrgent: false }, { room });
    assert.equal(movement.kind, "walk");
    assert.equal(movement.from, DOOR);
    assert.deepEqual(routes, [{ from: { x: DOOR.x, z: DOOR.z }, to: DESK }]);
  });

  it("puts everyone straight in place the first time a room is seen", () => {
    const { room } = roomOf({ hasVisited: false });
    assert.deepEqual(plan(personOf(), { stop: DESK, isUrgent: false }, { room }), { kind: "place", stop: DESK });
  });

  it("interrupts a calm walk when urgent work comes up, and hurries from where the person is", () => {
    const { room, routes } = roomOf();
    const strolling = personOf({ stop: DESK, position: HALFWAY, isWalking: true, isHurrying: false });
    const movement = plan(strolling, { stop: DESK, isUrgent: true }, { room });
    assert.deepEqual(movement, { kind: "walk", from: HALFWAY, path: [HALFWAY, { x: DESK.x, z: DESK.z }], isUrgent: true });
    assert.deepEqual(routes, [{ from: HALFWAY, to: DESK }]);
  });

  it("lets a walk that is already hurrying carry on when the work is still urgent", () => {
    const { room } = roomOf();
    const hurrying = personOf({ stop: DESK, position: HALFWAY, isWalking: true, isHurrying: true });
    assert.deepEqual(plan(hurrying, { stop: DESK, isUrgent: true }, { room }), { kind: "keep" });
  });

  it("puts people straight in place when the viewer asked for reduced motion", () => {
    const { room, routes } = roomOf();
    const atCoffee = personOf({ stop: COFFEE, position: { x: COFFEE.x, z: COFFEE.z } });
    assert.deepEqual(plan(atCoffee, { stop: DESK, isUrgent: true }, { room, isMotionReduced: true }), { kind: "place", stop: DESK });
    assert.deepEqual(plan(personOf(), { stop: DESK, isUrgent: false }, { room, isMotionReduced: true }), { kind: "place", stop: DESK });
    assert.deepEqual(routes, []);
  });

  it("keeps the route when the stop stays the same, even if it moved by less than a hair", () => {
    const { room, routes } = roomOf();
    const strolling = personOf({ stop: COFFEE, position: HALFWAY, isWalking: true });
    assert.deepEqual(plan(strolling, { stop: COFFEE, isUrgent: false }, { room }), { kind: "keep" });
    assert.deepEqual(plan(strolling, { stop: { ...COFFEE, x: COFFEE.x + 0.005 }, isUrgent: false }, { room }), { kind: "keep" });
    assert.deepEqual(routes, []);
  });

  it("leaves a spot through its own way in, starting from the stop itself", () => {
    const { room, routes } = roomOf();
    const atCoffee = personOf({ stop: COFFEE, position: { x: COFFEE.x, z: COFFEE.z } });
    plan(atCoffee, { stop: DESK, isUrgent: false }, { room });
    assert.deepEqual(routes, [{ from: COFFEE, to: DESK }]);
  });

  it("does not move someone who is already standing where they need to be", () => {
    const { room } = roomOf();
    const atDesk = personOf({ stop: COFFEE, position: { x: DESK.x, z: DESK.z } });
    assert.deepEqual(plan(atDesk, { stop: DESK, isUrgent: false }, { room }), { kind: "place", stop: DESK });
  });
});
