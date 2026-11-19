import { clip } from "../shared/text/clip.js";

const QUESTION_LIMIT = 8;
const OPTION_LIMIT = 12;
const HEADER_LIMIT = 40;
const OPTION_LABEL_LIMIT = 120;
const OPTION_DESCRIPTION_LIMIT = 300;
const QUESTION_TEXT_LIMIT = 4_000;

const questionTextOf = (item) => String(item?.question ?? "");

// The question text is the answer's key, and the hook only accepts the exact text Claude Code asked: only the page clips it.
// A text over the limit would go whole in every frame to every device, so the request is not held and the terminal asks it.
export function questionsOf(toolInput) {
  const questions = Array.isArray(toolInput?.questions) ? toolInput.questions.slice(0, QUESTION_LIMIT) : [];
  if (questions.some((item) => questionTextOf(item).length > QUESTION_TEXT_LIMIT)) return [];
  return questions.map((item) => ({
    question: questionTextOf(item),
    header: clip(String(item?.header ?? ""), HEADER_LIMIT),
    multiSelect: item?.multiSelect === true,
    options: (Array.isArray(item?.options) ? item.options.slice(0, OPTION_LIMIT) : []).map((option) => ({
      label: clip(String(option?.label ?? ""), OPTION_LABEL_LIMIT),
      description: clip(String(option?.description ?? ""), OPTION_DESCRIPTION_LIMIT),
    })),
  }));
}
