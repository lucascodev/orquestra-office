import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { areaLabelDetail, FULL_AREA_LABELS_FROM_SCALE, FULL_TAGS_FROM_SCALE, tagDetail } from "../scripts/domain/headquarters/label-detail.js";

const FAR = FULL_TAGS_FROM_SCALE - 1;
const NEAR = FULL_TAGS_FROM_SCALE;

describe("name tag detail", () => {
  it("shows the whole tag close enough to tell people apart", () => {
    assert.equal(tagDetail({ scale: NEAR, status: "working", isFollowed: false }), "full");
    assert.equal(tagDetail({ scale: NEAR * 3, status: "idle", isFollowed: false }), "full");
  });

  it("shrinks to the status dot from afar, keeping the name of whoever needs you", () => {
    assert.equal(tagDetail({ scale: FAR, status: "working", isFollowed: false }), "dot");
    assert.equal(tagDetail({ scale: FAR, status: "blocked", isFollowed: false }), "dot");
    assert.equal(tagDetail({ scale: FAR, status: "needs_you", isFollowed: false }), "name");
  });

  it("keeps the whole tag of the person the camera follows, however far", () => {
    assert.equal(tagDetail({ scale: 1, status: "idle", isFollowed: true }), "full");
  });

  it("is close enough for whole tags when a single island fills a laptop screen, and far when the whole building does", () => {
    const WHOLE_BUILDING_AT_1440 = 22.9;
    const ONE_ISLAND_AT_1440 = 64.4;
    assert.equal(tagDetail({ scale: WHOLE_BUILDING_AT_1440, status: "working", isFollowed: false }), "dot");
    assert.equal(tagDetail({ scale: ONE_ISLAND_AT_1440, status: "working", isFollowed: false }), "full");
  });
});

describe("area label detail", () => {
  it("names every room and island in full only from up close", () => {
    assert.equal(areaLabelDetail(FULL_AREA_LABELS_FROM_SCALE), "full");
    assert.equal(areaLabelDetail(FULL_AREA_LABELS_FROM_SCALE - 0.1), "compact");
  });

  it("starts showing whole tags only after the labels of the rooms are back, so the map never shows tags without rooms", () => {
    assert.ok(FULL_AREA_LABELS_FROM_SCALE <= FULL_TAGS_FROM_SCALE);
  });
});
