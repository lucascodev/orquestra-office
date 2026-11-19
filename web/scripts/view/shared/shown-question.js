import { clipText } from "../../domain/text/clip-text.js";

const QUESTION_TEXT_LIMIT = 500;

// Only what is shown is clipped: the whole text stays the answer's key, the one Claude Code checks the answer by.
export const shownQuestion = (text) => clipText(String(text ?? ""), QUESTION_TEXT_LIMIT);
