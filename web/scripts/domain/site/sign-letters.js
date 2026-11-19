import { GLYPH_HEIGHT, GLYPH_WIDTH, SIGN_GLYPHS } from "../../data/sign-glyphs.js";
import { ownValueOf } from "../shared/own-value.js";

const LETTER_GAP = 1;
const FILLED = "#";
const BLANK = Array.from({ length: GLYPH_HEIGHT }, () => ".".repeat(GLYPH_WIDTH));

const glyphOf = (letter) => ownValueOf(SIGN_GLYPHS, letter) ?? BLANK;

// Row 0 is the top of the letters; an unknown letter keeps its width as a blank.
export function signCells(text) {
  const letters = [...text.toUpperCase()];
  const cells = letters.flatMap((letter, index) => {
    const left = index * (GLYPH_WIDTH + LETTER_GAP);
    return glyphOf(letter).flatMap((line, row) => [...line].flatMap((cell, col) => (cell === FILLED ? [{ col: left + col, row }] : [])));
  });
  const columns = letters.length === 0 ? 0 : letters.length * (GLYPH_WIDTH + LETTER_GAP) - LETTER_GAP;
  return { columns, rows: GLYPH_HEIGHT, cells };
}
