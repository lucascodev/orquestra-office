import { clip } from "../shared/text/clip.js";

const QUESTION_LIMIT = 8;
const OPTION_LIMIT = 12;
const QUESTION_TEXT_LIMIT = 500;
const HEADER_LIMIT = 40;
const OPTION_LABEL_LIMIT = 120;
const OPTION_DESCRIPTION_LIMIT = 300;

export function questionsOf(toolInput) {
  const questions = Array.isArray(toolInput?.questions) ? toolInput.questions.slice(0, QUESTION_LIMIT) : [];
  return questions.map((item) => ({
    question: clip(String(item?.question ?? ""), QUESTION_TEXT_LIMIT),
    header: clip(String(item?.header ?? ""), HEADER_LIMIT),
    multiSelect: item?.multiSelect === true,
    options: (Array.isArray(item?.options) ? item.options.slice(0, OPTION_LIMIT) : []).map((option) => ({
      label: clip(String(option?.label ?? ""), OPTION_LABEL_LIMIT),
      description: clip(String(option?.description ?? ""), OPTION_DESCRIPTION_LIMIT),
    })),
  }));
}
