import { FULL_TAGS_FROM_SCALE } from "./label-detail.js";

// Below this many CSS pixels per floor unit an eye is narrower than one art pixel and a person's shadow is a smudge under the
// tag, so the figures drop the small parts and stop casting shadows.
export const NEAR_FIGURES_FROM_SCALE = 34;

export const figureDetail = (scale) => (scale >= NEAR_FIGURES_FROM_SCALE ? "near" : "far");

export function bubbleDetail({ scale, isSpeech, isFollowed }) {
  if (isFollowed || scale >= FULL_TAGS_FROM_SCALE) return "full";
  return isSpeech ? "compact" : "hidden";
}
