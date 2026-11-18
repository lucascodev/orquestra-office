const isPlainObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

export function settingsShapeProblem(settings) {
  if (!isPlainObject(settings)) return "the settings is not an object";
  if (settings.hooks === undefined) return null;
  if (!isPlainObject(settings.hooks)) return '"hooks" is not an object';
  const eventWithoutList = Object.keys(settings.hooks).find((event) => !Array.isArray(settings.hooks[event]));
  return eventWithoutList === undefined ? null : `"hooks.${eventWithoutList}" is not an array`;
}
