import { HEADQUARTERS_PALETTE } from "../../data/headquarters-palette.js";
import { signCells } from "../../domain/site/sign-letters.js";
import { box, shade } from "../kit.js";

const LETTER_DEPTH = 0.05;
const BLOCK_MARGIN_X = 0.5;
const BLOCK_MARGIN_Y = 0.1;
const CAP_HEIGHT = 0.05;
const CAP_OVERHANG = 0.04;

// Square cells as big as the face allows, centered: the whole word always stays inside the face.
export function pixelLettering(parent, text, { x, y, z, w, h }, color) {
  const { cells, columns, rows } = signCells(text);
  if (columns === 0) return;
  const cell = Math.min(w / columns, h / rows);
  const left = x + (w - cell * columns) / 2;
  const top = y + (h + cell * rows) / 2;
  for (const { col, row } of cells) {
    box(parent, [cell, cell, LETTER_DEPTH], [left + col * cell, top - (row + 1) * cell, z], color, { glow: true });
  }
}

export function monumentSign(parent, { base, block, text }) {
  const { yard, accent } = HEADQUARTERS_PALETTE;
  box(parent, [base.w, base.height, base.d], [base.x, 0, base.z], yard.signBase);
  box(parent, [block.w, block.height, block.d], [block.x, base.height, block.z], yard.signBlock);
  const top = base.height + block.height;
  box(parent, [block.w + CAP_OVERHANG * 2, CAP_HEIGHT, block.d + CAP_OVERHANG * 2], [block.x - CAP_OVERHANG, top, block.z - CAP_OVERHANG], shade(yard.signBlock, 0.4));
  pixelLettering(parent, text, {
    x: block.x + BLOCK_MARGIN_X,
    y: base.height + BLOCK_MARGIN_Y,
    z: block.z + block.d,
    w: block.w - BLOCK_MARGIN_X * 2,
    h: block.height - BLOCK_MARGIN_Y * 2,
  }, accent);
}
