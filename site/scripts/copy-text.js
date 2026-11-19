const COMMAND_SEPARATOR = "\n";

export const copyTextOf = (commandTexts) => commandTexts.map((command) => command.trim()).join(COMMAND_SEPARATOR);
