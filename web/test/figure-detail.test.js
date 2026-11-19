import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bubbleDetail, figureDetail, NEAR_FIGURES_FROM_SCALE } from "../scripts/domain/headquarters/figure-detail.js";
import { FULL_TAGS_FROM_SCALE } from "../scripts/domain/headquarters/label-detail.js";

const WHOLE_BUILDING_AT_1440 = 22.9;
const ONE_ISLAND_AT_1440 = 64.4;

describe("figure detail", () => {
  it("draws people whole, with eyes, things in hand and their shadow, only from up close", () => {
    assert.equal(figureDetail(NEAR_FIGURES_FROM_SCALE), "near");
    assert.equal(figureDetail(ONE_ISLAND_AT_1440), "near");
    assert.equal(figureDetail(NEAR_FIGURES_FROM_SCALE - 0.1), "far");
  });

  it("simplifies the people when the whole building is on screen", () => {
    assert.equal(figureDetail(WHOLE_BUILDING_AT_1440), "far");
  });
});

describe("bubble detail", () => {
  const FAR = FULL_TAGS_FROM_SCALE - 1;

  it("shows thoughts and speech whole while the tags are whole", () => {
    assert.equal(bubbleDetail({ scale: FULL_TAGS_FROM_SCALE, isSpeech: false, isFollowed: false }), "full");
    assert.equal(bubbleDetail({ scale: FULL_TAGS_FROM_SCALE, isSpeech: true, isFollowed: false }), "full");
  });

  it("hides thoughts and shrinks speech to a mark when the tags shrink to dots, so they never cover the dots", () => {
    assert.equal(bubbleDetail({ scale: FAR, isSpeech: false, isFollowed: false }), "hidden");
    assert.equal(bubbleDetail({ scale: FAR, isSpeech: true, isFollowed: false }), "compact");
  });

  it("keeps the bubbles of the person the camera follows whole, however far", () => {
    assert.equal(bubbleDetail({ scale: WHOLE_BUILDING_AT_1440, isSpeech: false, isFollowed: true }), "full");
    assert.equal(bubbleDetail({ scale: WHOLE_BUILDING_AT_1440, isSpeech: true, isFollowed: true }), "full");
  });
});
