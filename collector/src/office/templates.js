export const TEMPLATE_IDS = ["startup", "cafe", "biblioteca", "garagem", "estacao", "jardim", "fliperama"];

export function nextTemplate(projects) {
  const used = new Set(Object.values(projects).map((project) => project.template));
  const free = TEMPLATE_IDS.find((id) => !used.has(id));
  if (free) return free;
  return TEMPLATE_IDS[Object.keys(projects).length % TEMPLATE_IDS.length];
}

export function isTemplate(id) {
  return TEMPLATE_IDS.includes(id);
}
