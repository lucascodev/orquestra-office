import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GLYPH_HEIGHT, GLYPH_WIDTH, SIGN_GLYPHS } from "../scripts/data/sign-glyphs.js";
import { signCells } from "../scripts/domain/site/sign-letters.js";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const drawn = ({ columns, rows, cells }) => Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (__, col) => (cells.some((cell) => cell.col === col && cell.row === row) ? "#" : ".")).join(""));

describe("monument sign letters", () => {
  it("has every letter from A to Z, five cells wide and seven tall", () => {
    assert.deepEqual(Object.keys(SIGN_GLYPHS).sort().join(""), ALPHABET);
    for (const letter of ALPHABET) {
      assert.equal(SIGN_GLYPHS[letter].length, GLYPH_HEIGHT, letter);
      assert.ok(SIGN_GLYPHS[letter].every((line) => /^[#.]+$/.test(line) && line.length === GLYPH_WIDTH), letter);
    }
  });

  it("draws the letters side by side, the top row first, with one empty column between them", () => {
    assert.deepEqual(drawn(signCells("OI")), [
      ".###..###.",
      "#...#..#..",
      "#...#..#..",
      "#...#..#..",
      "#...#..#..",
      "#...#..#..",
      ".###..###.",
    ].map((line) => `${line.slice(0, 5)}.${line.slice(5)}`));
  });

  it("spells ORQUESTRA in 53 columns and 7 rows", () => {
    const sign = signCells("ORQUESTRA");
    assert.equal(sign.columns, 9 * GLYPH_WIDTH + 8);
    assert.equal(sign.rows, GLYPH_HEIGHT);
    const gaps = Array.from({ length: 8 }, (_, i) => (i + 1) * (GLYPH_WIDTH + 1) - 1);
    assert.ok(sign.cells.every((cell) => !gaps.includes(cell.col)));
    assert.deepEqual(drawn(sign).map((line) => line.slice(0, GLYPH_WIDTH)), SIGN_GLYPHS.O);
    assert.deepEqual(drawn(sign).map((line) => line.slice(-GLYPH_WIDTH)), SIGN_GLYPHS.A);
  });

  it("reads small letters as capitals and leaves a blank where it does not know the letter", () => {
    assert.deepEqual(signCells("orquestra"), signCells("ORQUESTRA"));
    const withUnknown = signCells("AÇA");
    assert.equal(withUnknown.columns, 3 * GLYPH_WIDTH + 2);
    assert.ok(withUnknown.cells.every((cell) => cell.col < GLYPH_WIDTH || cell.col > 2 * GLYPH_WIDTH));
    assert.deepEqual(signCells(""), { columns: 0, rows: GLYPH_HEIGHT, cells: [] });
  });
});
