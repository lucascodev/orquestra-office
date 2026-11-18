import { clip } from "../shared/text/clip.js";

const QUESTION_LIMIT = 8;
const OPTION_LIMIT = 12;

export function questionsOf(toolInput) {
  const questions = Array.isArray(toolInput?.questions) ? toolInput.questions.slice(0, QUESTION_LIMIT) : [];
  return questions.map((item) => ({
    question: clip(String(item?.question ?? ""), 500),
    header: clip(String(item?.header ?? ""), 40),
    multiSelect: item?.multiSelect === true,
    options: (Array.isArray(item?.options) ? item.options.slice(0, OPTION_LIMIT) : []).map((option) => ({
      label: clip(String(option?.label ?? ""), 120),
      description: clip(String(option?.description ?? ""), 300),
    })),
  }));
}
