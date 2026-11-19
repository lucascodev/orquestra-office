import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HEADQUARTERS_PALETTE } from "../scripts/data/headquarters-palette.js";
import { centerBetweenPanels, frameBounds, zoomAt } from "../scripts/domain/camera/viewpoint.js";
import { layoutHeadquarters } from "../scripts/domain/headquarters/headquarters-layout.js";
import {
  cameraFootprint, fromMinimap, MINIMAP_SIZE, minimapFootprint, minimapShapes, toMinimap,
} from "../scripts/domain/headquarters/minimap-shapes.js";

const NOW = 1_800_000_000_000;
const VIEWPORT = { width: 1440, height: 900 };
const NO_INSETS = { left: 0, right: 0, top: 0, bottom: 0 };

const agentOf = (key, status) => ({ key, kind: "main", parentKey: null, label: "Claude Code", status, startedAt: NOW, updatedAt: NOW, endedAt: null });
const projectOf = (key, template, agents, createdAt) => ({ key, name: key, template, createdAt, updatedAt: NOW, team: [], agents: Object.fromEntries(agents.map((agent) => [agent.key, agent])) });
const layout = layoutHeadquarters({
  "c:/calm": projectOf("c:/calm", "cafe", [agentOf("claude:calm", "working")], 1),
  "c:/asking": projectOf("c:/asking", "fliperama", [agentOf("claude:asking", "needs_you")], 2),
});
const areaOf = (polygon) => Math.abs(polygon.reduce((sum, point, i) => {
  const next = polygon[(i + 1) % polygon.length];
  return sum + point.x * next.y - next.x * point.y;
}, 0)) / 2;
const ON_THE_EDGE = 1e-9;
const turns = (polygon, { x, y }) => polygon.map((point, i) => {
  const next = polygon[(i + 1) % polygon.length];
  return (next.x - point.x) * (y - point.y) - (next.y - point.y) * (x - point.x);
});
const isInsidePolygon = (polygon, point) => {
  const sides = turns(polygon, point);
  return sides.every((side) => side >= -ON_THE_EDGE) || sides.every((side) => side <= ON_THE_EDGE);
};

describe("minimap", () => {
  const { frame, shapes } = minimapShapes(layout);

  it("fits the whole map in 132 by 84 pixels without stretching it, centered", () => {
    assert.deepEqual(MINIMAP_SIZE, { width: 132, height: 84 });
    const [ground] = shapes;
    assert.equal(ground.kind, "ground");
    assert.ok(ground.x >= 0 && ground.y >= 0 && ground.x + ground.w <= 132.000001 && ground.y + ground.h <= 84.000001);
    assert.ok(Math.abs(ground.w / ground.h - 30 / 29) < 1e-9);
    assert.ok(Math.abs(ground.x - (132 - ground.w) / 2) < 1e-9 && Math.abs(ground.y - (84 - ground.h) / 2) < 1e-9);
    assert.ok(Math.abs(frame.scale - ground.w / 30) < 1e-12);
  });

  it("draws the building, every area with its floor and every island with the rug of its project", () => {
    const kinds = shapes.map((shape) => shape.kind);
    assert.deepEqual([...new Set(kinds)], ["ground", "building", "area", "island", "sign"]);
    assert.deepEqual(shapes.filter((shape) => shape.kind === "area").map((shape) => shape.color), Object.values(HEADQUARTERS_PALETTE.floors));
    const islands = shapes.filter((shape) => shape.kind === "island");
    assert.equal(islands.length, layout.islands.length);
    assert.deepEqual(islands.map((island) => island.color), layout.islands.map((island) => island.theme.rug));
  });

  it("outlines the island where someone needs you", () => {
    const islands = shapes.filter((shape) => shape.kind === "island");
    assert.deepEqual(islands.map((island) => [island.projectKey, island.isAlert]), [["c:/calm", false], ["c:/asking", true], [null, false], [null, false]]);
  });

  it("puts each place of the map where a click on the minimap brings it back", () => {
    const point = { x: 13.25, z: 9.5 };
    const back = fromMinimap(frame, toMinimap(frame, point));
    assert.ok(Math.abs(back.x - point.x) < 1e-9 && Math.abs(back.z - point.z) < 1e-9);
    const corner = toMinimap(frame, { x: layout.bounds.minX, z: layout.bounds.minZ });
    assert.deepEqual(corner, { x: shapes[0].x, y: shapes[0].y });
  });
});

describe("camera footprint on the ground", () => {
  const bounds = { ...layout.bounds, minY: 0, maxY: 0 };
  const whole = frameBounds({ bounds, viewport: VIEWPORT, insets: NO_INSETS });

  it("is the screen seen on the ground: a diamond around the target that covers what is framed", () => {
    const footprint = cameraFootprint(whole, VIEWPORT);
    assert.equal(footprint.length, 4);
    const inPixels = footprint.map(({ x, z }) => ({ x, y: z }));
    for (const x of [bounds.minX, bounds.maxX]) for (const z of [bounds.minZ, bounds.maxZ]) assert.ok(isInsidePolygon(inPixels, { x, y: z }), `${x},${z}`);
    const center = footprint.reduce((sum, point) => ({ x: sum.x + point.x / 4, z: sum.z + point.z / 4 }), { x: 0, z: 0 });
    assert.ok(Math.abs(center.x - whole.target.x) < 1e-9 && Math.abs(center.z - whole.target.z) < 1e-9);
  });

  it("covers only what the panels leave free, centered where a click on the minimap brings the camera", () => {
    const insets = { left: 252, right: 16, top: 158, bottom: 156 };
    const point = { x: 12, z: 7 };
    const viewpoint = { target: centerBetweenPanels({ point, scale: whole.scale * 2, viewport: VIEWPORT, insets }), scale: whole.scale * 2 };
    const footprint = cameraFootprint(viewpoint, VIEWPORT, insets);
    const center = footprint.reduce((sum, corner) => ({ x: sum.x + corner.x / 4, z: sum.z + corner.z / 4 }), { x: 0, z: 0 });
    assert.ok(Math.abs(center.x - point.x) < 1e-9 && Math.abs(center.z - point.z) < 1e-9);
    const free = areaOf(footprint.map(({ x, z }) => ({ x, y: z })));
    const full = areaOf(cameraFootprint(viewpoint, VIEWPORT).map(({ x, z }) => ({ x, y: z })));
    const freeShare = ((VIEWPORT.width - 268) * (VIEWPORT.height - 314)) / (VIEWPORT.width * VIEWPORT.height);
    assert.ok(Math.abs(free / full - freeShare) < 1e-9);
  });

  it("is drawn on the minimap in its pixels", () => {
    const { frame } = minimapShapes(layout);
    const onMinimap = minimapFootprint(frame, whole, VIEWPORT);
    assert.deepEqual(onMinimap, cameraFootprint(whole, VIEWPORT).map((corner) => toMinimap(frame, corner)));
  });

  it("shrinks to a quarter of the ground when the camera comes twice as close", () => {
    const closer = zoomAt(whole, { factor: 2, at: { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 }, viewport: VIEWPORT, limits: { min: 0, max: Infinity } });
    const toArea = (viewpoint) => areaOf(cameraFootprint(viewpoint, VIEWPORT).map(({ x, z }) => ({ x, y: z })));
    assert.ok(Math.abs(toArea(closer) / toArea(whole) - 0.25) < 1e-9);
  });
});
