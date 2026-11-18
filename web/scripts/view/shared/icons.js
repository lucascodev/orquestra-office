const PATHS = {
  back: `<path d="M15 6l-6 6 6 6"/>`,
  close: `<path d="M6 6l12 12M18 6L6 18"/>`,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  stop: `<rect x="7" y="7" width="10" height="10" rx="1"/>`,
  expand: `<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>`,
  collapse: `<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>`,
};

export function icon(name, size = 16) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PATHS[name] ?? ""}</svg>`;
}
