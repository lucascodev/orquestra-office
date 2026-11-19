import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { layoutHeadquarters } from "../scripts/domain/headquarters/headquarters-layout.js";
import { createAreaLabels } from "../scripts/three/scene/area-labels.js";

const ROLES = ["code-reviewer", "devops-engineer"];

const fakeElement = (tagName) => ({
  tagName, className: "", textContent: "", hidden: false, dataset: {}, style: {}, children: [],
  append(...children) { this.children.push(...children); },
});

const textOf = (element) => [element.textContent, ...element.children.map(textOf)].join("");

const project = {
  key: "c:/loja", name: "loja-online", template: "cafe", team: ROLES, updatedAt: 1,
  agents: { "claude:a1": { key: "claude:a1", name: "Ana", label: "Claude Code", source: "claude", kind: "main", status: "working", activity: "editing" } },
};

describe("labels over the headquarters", () => {
  beforeEach(() => { globalThis.document = { createElement: fakeElement }; });
  afterEach(() => { delete globalThis.document; });

  it("names the rooms and the islands but puts no plate on an empty chair reserved for a role", () => {
    const layout = layoutHeadquarters({ [project.key]: project });
    assert.ok(layout.islands.some((island) => island.seats.some((seat) => !seat.agent && seat.role)), "the layout keeps the reserved chairs");
    const layer = { dataset: {}, shown: [], replaceChildren(...children) { this.shown = children; } };
    createAreaLabels(layer).show(layout);
    const texts = layer.shown.map(textOf);
    assert.ok(texts.some((text) => text.startsWith("loja-online")));
    assert.deepEqual(texts.filter((text) => ROLES.some((role) => text.includes(role))), []);
    assert.deepEqual(layer.shown.filter((element) => element.className.includes("reserved")), []);
  });
});
