import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nearestOnGraph, shortestWalk, walkGraphOf } from "../scripts/domain/navigation/walk-graph.js";

const p = (x, z) => ({ x, z });

const square = () => walkGraphOf([[p(0, 0), p(10, 0), p(10, 10)], [p(0, 0), p(0, 4), p(10, 4)]]);
const hasRepeat = (path) => path.some((point, i) => i > 0 && point.x === path[i - 1].x && point.z === path[i - 1].z);

describe("walk graph", () => {
  it("joins paths that share a point into one node", () => {
    const graph = walkGraphOf([[p(0, 0), p(5, 0)], [p(5, 0), p(5, 5)]]);
    assert.deepEqual(graph.nodes, [p(0, 0), p(5, 0), p(5, 5)]);
    assert.deepEqual(graph.edges, [[0, 1], [1, 2]]);
  });

  it("splits a path where another one ends on it, so a side corridor meets the main one", () => {
    const graph = walkGraphOf([[p(0, 0), p(10, 0)], [p(4, 0), p(4, 6)]]);
    assert.deepEqual(shortestWalk(graph, p(0, 0), p(4, 6)), [p(0, 0), p(4, 0), p(4, 6)]);
  });

  it("takes the shorter of two ways around", () => {
    assert.deepEqual(shortestWalk(square(), p(0, 0), p(9, 4)), [p(0, 0), p(0, 4), p(9, 4)]);
    assert.deepEqual(shortestWalk(square(), p(0, 0), p(10, 1)), [p(0, 0), p(10, 0), p(10, 1)]);
  });

  it("brings a loose point to the nearest spot on the nearest path first", () => {
    assert.deepEqual(nearestOnGraph(square(), p(3, 1)), { x: 3, z: 0, edge: [0, 1] });
    assert.deepEqual(shortestWalk(square(), p(3, 1), p(6, 3.5)), [p(3, 0), p(0, 0), p(0, 4), p(6, 4)]);
  });

  it("walks straight along a path when both ends land on the same stretch", () => {
    assert.deepEqual(shortestWalk(square(), p(2, -1), p(8, 1)), [p(2, 0), p(8, 0)]);
  });

  it("never repeats a point, even when the walker already stands on a node", () => {
    const path = shortestWalk(square(), p(0, 0), p(0, 4));
    assert.deepEqual(path, [p(0, 0), p(0, 4)]);
    assert.equal(hasRepeat(path), false);
    assert.deepEqual(shortestWalk(square(), p(10, 4), p(10, 4)), [p(10, 4)]);
  });

  it("ignores a path it cannot reach in a straight line, like one behind a wall", () => {
    const behindWall = (from, to) => !(from.z < 2 && to.z >= 2) && !(from.z >= 2 && to.z < 2);
    const graph = walkGraphOf([[p(0, 0), p(10, 0)], [p(0, 3), p(10, 3)]]);
    assert.deepEqual(nearestOnGraph(graph, p(5, 1.9)), { x: 5, z: 3, edge: [2, 3] });
    assert.deepEqual(nearestOnGraph(graph, p(5, 1.9), behindWall), { x: 5, z: 0, edge: [0, 1] });
  });

  it("enters the destination's stretch from its nearer end, even when the other end was listed first", () => {
    const graph = walkGraphOf([[p(20, 0), p(10, 0)], [p(0, 0), p(10, 0)]]);
    assert.deepEqual(shortestWalk(graph, p(1, 0), p(15, 0)), [p(1, 0), p(10, 0), p(15, 0)]);
  });

  it("returns no way at all between parts that do not touch", () => {
    const graph = walkGraphOf([[p(0, 0), p(5, 0)], [p(0, 9), p(5, 9)]]);
    assert.deepEqual(shortestWalk(graph, p(1, 0), p(4, 9)), []);
  });

  it("returns no way at all on an empty graph", () => {
    const graph = walkGraphOf([]);
    assert.equal(nearestOnGraph(graph, p(1, 1)), null);
    assert.deepEqual(shortestWalk(graph, p(1, 1), p(2, 2)), []);
  });
});
