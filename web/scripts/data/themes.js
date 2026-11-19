const BASE = { cabinet: "#eef1f5", leg: "#dfe3e8", chair: "#2a2d36", screen: "#4fb7e8", keyboard: "#e9edf2" };

export const THEMES = [
  { ...BASE, id: "startup", name: "Laboratório", chair: "#3b4a6b", leg: "#c9ced6", desk: "#f7f8fa", rug: "#b4bcd8", divider: "#8f9bc4",
    items: ["#3a6ab0", "#e85a3a", "#f2c94c", "#47b85e", "#8a4ab0", "#2b2f3a", "#e8ecf3", "#ff7aa8"] },
  { ...BASE, id: "cafe", name: "Café", leg: "#6b4a30", chair: "#3f6b57", cabinet: "#f3ead9", desk: "#b9855a", rug: "#a9c2a0", divider: "#9a6a44",
    items: ["#f4f1ea", "#e0a13a", "#4f7cc4", "#6fa06a", "#f2c94c", "#7a3a1a", "#e8e8e8", "#c8654a"] },
  { ...BASE, id: "biblioteca", name: "Biblioteca", leg: "#4a2f1e", chair: "#2f4a3f", cabinet: "#7a5230", desk: "#dcb888", rug: "#a35458", divider: "#5a3a24",
    items: ["#b03a3a", "#2f6a5a", "#e3c13b", "#3a6ab0", "#8a4ab0", "#e8d9b8", "#a0522d", "#2b5a8a"] },
  { ...BASE, id: "garagem", name: "Garagem", leg: "#2b2f3a", chair: "#2b2f3a", cabinet: "#5d6675", desk: "#e3c48f", rug: "#7d8594", divider: "#3e4148",
    items: ["#d23a2a", "#b56a3a", "#2b5ab0", "#3e4148", "#d0d4dc", "#f0b429", "#47b85e", "#1d1d1d"] },
  { ...BASE, id: "estacao", name: "Estação espacial", leg: "#8793ab", chair: "#f08a3c", cabinet: "#dfe5ef", screen: "#47e09b", desk: "#f6f8fc", rug: "#5f6f98", divider: "#8fd8ff",
    items: ["#6fc3ff", "#f08a3c", "#ff6b6b", "#c9d1de", "#b28cff", "#3a4456", "#e8ecf3", "#ffe066"] },
  { ...BASE, id: "jardim", name: "Jardim", leg: "#b99a6a", chair: "#3f8f8a", cabinet: "#e9dcc0", desk: "#fbf7ee", rug: "#dfc08f", divider: "#c9a878",
    items: ["#ff8ad0", "#f6d365", "#ff6b6b", "#b28cff", "#3f8a36", "#ffffff", "#f2a65a", "#6fc3ff"] },
  { ...BASE, id: "fliperama", name: "Fliperama", leg: "#4fe3ff", chair: "#ff5fd2", cabinet: "#3a2a7a", screen: "#ff4fd8", keyboard: "#b28cff", desk: "#5744b0", rug: "#40308a", divider: "#6a4fd0",
    items: ["#ff4fd8", "#4fe3ff", "#ffe04f", "#9be36b", "#ff8a3d", "#ffffff", "#b28cff", "#ff6b6b"] },
];

export const themeById = (id) => THEMES.find((t) => t.id === id) ?? THEMES[0];
