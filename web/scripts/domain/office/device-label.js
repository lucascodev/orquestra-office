const FALLBACK_LABEL = "Navegador";
// Order matters: Edge and Chrome on Android also say Safari, and every iPhone browser says Mac OS X.
const BROWSERS = [[/\bEdg\//, "Edge"], [/\bFirefox\//, "Firefox"], [/\bChrome\//, "Chrome"], [/\bSafari\//, "Safari"]];
const SYSTEMS = [[/\biPhone\b/, "iPhone"], [/\biPad\b/, "iPad"], [/\bAndroid\b/, "Android"], [/\bWindows\b/, "Windows"], [/\bMac OS X\b/, "macOS"], [/\bLinux\b/, "Linux"]];

const firstMatch = (text, candidates) => candidates.find(([pattern]) => pattern.test(text))?.[1] ?? null;

export function deviceLabelOf(userAgent) {
  const text = String(userAgent ?? "");
  const browser = firstMatch(text, BROWSERS) ?? FALLBACK_LABEL;
  const system = firstMatch(text, SYSTEMS);
  return system ? `${browser} no ${system}` : browser;
}
