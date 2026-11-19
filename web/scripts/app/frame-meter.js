import { frameStats } from "../domain/shared/frame-stats.js";

const WINDOW_MS = 2_000;
const DECIMALS = 1;

// ?medir=1 only: what the last frame cost the GPU and what the frames of the last two seconds cost the page.
export function createFrameMeter(host) {
  const meter = document.createElement("output");
  meter.className = "hq-meter";
  host.append(meter);
  let frames = [];

  return ({ calls, triangles, scale, at, workMs }) => {
    frames = [...frames.filter((frame) => frame.at > at - WINDOW_MS), { at, workMs }];
    const { perSecond, averageMs, worstMs } = frameStats({ frames, now: at, windowMs: WINDOW_MS });
    Object.assign(meter.dataset, { calls, triangles, scale, perSecond, averageMs, worstMs });
    meter.textContent = `chamadas de desenho ${calls} · triângulos ${triangles} · quadro ${averageMs.toFixed(DECIMALS)} ms (pior ${worstMs.toFixed(DECIMALS)}) · ${perSecond.toFixed(DECIMALS)} por segundo`;
  };
}
