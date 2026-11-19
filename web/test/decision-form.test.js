import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decisionBarOf, decisionOf, submitDecision } from "../scripts/app/decision-form.js";

// Just enough of the DOM for the decision form: a tree of elements that answers the few selectors it uses.
class FakeElement {
  constructor(tagName, { attributes = {}, value = "", children = [] } = {}) {
    this.tagName = tagName.toUpperCase();
    this.attributes = attributes;
    this.value = value;
    this.disabled = false;
    this.hidden = true;
    this.textContent = "";
    this.parent = null;
    this.children = children;
    for (const child of children) child.parent = this;
    this.id = attributes.id ?? "";
    this.dataset = Object.fromEntries(Object.entries(attributes).filter(([name]) => name.startsWith("data-"))
      .map(([name, attributeValue]) => [name.slice(5).replace(/-(\w)/g, (_, letter) => letter.toUpperCase()), attributeValue]));
    this.classList = { contains: (name) => (attributes.class ?? "").split(" ").includes(name) };
  }

  hasAttribute(name) {
    return Object.hasOwn(this.attributes, name);
  }

  matches(selector) {
    if (selector === "button") return this.tagName === "BUTTON";
    const attribute = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(selector);
    if (!attribute) throw new Error(`the fake DOM does not read ${selector}`);
    return this.hasAttribute(attribute[1]) && (attribute[2] === undefined || this.attributes[attribute[1]] === attribute[2]);
  }

  descendants() {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }

  querySelectorAll(selector) {
    return this.descendants().filter((element) => element.matches(selector));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  closest(selector) {
    for (let element = this; element; element = element.parent) if (element.matches(selector)) return element;
    return null;
  }

  contains(other) {
    for (let element = other; element; element = element.parent) if (element === this) return true;
    return false;
  }
}

const element = (tagName, attributes = {}, children = [], value = "") => new FakeElement(tagName, { attributes, children, value });

// A plan card as the alert draws it, with a plan that smuggled in its own button, field and bar.
function planCard() {
  const smuggledButton = element("button", { "data-decide": "allow" });
  const smuggledField = element("textarea", { name: "reason", id: "hq-plan-reason" }, [], "texto do plano");
  const smuggledBar = element("div", { "data-decision-bar": "", "data-reason-field": "hq-plan-reason" }, [smuggledField]);
  const plan = element("article", { class: "hq-plan md" }, [smuggledButton, smuggledBar]);
  const realField = element("textarea", { id: "hq-plan-reason" }, [], "  guarde o comando no manifesto  ");
  const deny = element("button", { "data-decide": "deny" });
  const allow = element("button", { "data-decide": "allow" });
  const bar = element("div", { "data-decision-bar": "", "data-reason-field": "hq-plan-reason" }, [element("div", { class: "field" }, [realField]), deny, allow]);
  const error = element("p", { class: "pending-error" });
  const card = element("div", { "data-pending": "req-plan" }, [plan, bar, error]);
  return { card, bar, deny, allow, smuggledButton, smuggledBar, error };
}

function recordingControl(wasSent = true) {
  const decisions = [];
  return { decisions, decide: async (id, body) => { decisions.push([id, body]); return wasSent; } };
}

describe("decision form", () => {
  it("finds the bar among the card's own children, never one inside the plan", () => {
    const { card, bar } = planCard();
    assert.equal(decisionBarOf(card), bar);
  });

  it("answers only a button of the card's own bar", () => {
    const { card, deny, smuggledButton } = planCard();
    assert.deepEqual(decisionOf(deny), { card, action: "deny" });
    assert.equal(decisionOf(smuggledButton), null);
    assert.equal(decisionOf(null), null);
  });

  it("sends the reason typed in the bar's own field, whatever the plan carries", async () => {
    const { card } = planCard();
    const control = recordingControl();
    await submitDecision(control, card, "deny");
    assert.deepEqual(control.decisions, [["req-plan", { behavior: "deny", message: "guarde o comando no manifesto" }]]);
  });

  it("approves with no message and locks the bar's buttons while it sends", async () => {
    const { card, deny, allow, smuggledButton } = planCard();
    const control = recordingControl();
    await submitDecision(control, card, "allow");
    assert.deepEqual(control.decisions, [["req-plan", { behavior: "allow" }]]);
    assert.deepEqual([deny.disabled, allow.disabled, smuggledButton.disabled], [true, true, false]);
  });

  it("gives the buttons back and says so when sending fails", async () => {
    const { card, allow, error } = planCard();
    await submitDecision(recordingControl(false), card, "allow");
    assert.deepEqual([allow.disabled, error.hidden], [false, false]);
    assert.match(error.textContent, /Não deu para enviar/);
  });
});
