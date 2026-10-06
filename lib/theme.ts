/**
 * Appearance settings: a colour theme (accent palette) and a light/dark mode.
 *
 * Both are stored in localStorage and applied to <html> as `data-theme` and the
 * `dark` class. The matching CSS lives in app/globals.css. `THEME_SCRIPT` runs
 * inline before hydration so the page never flashes the default theme.
 */

export interface ThemeDefinition {
  id: string;
  name: string;
  /** Representative colour used for the swatch in the picker. */
  swatch: string;
}

export const THEMES: readonly ThemeDefinition[] = [
  { id: "graphite", name: "Graphite", swatch: "oklch(0.25 0 0)" },
  { id: "navy", name: "Navy", swatch: "oklch(0.34 0.09 262)" },
  { id: "ocean", name: "Ocean", swatch: "oklch(0.5 0.13 240)" },
  { id: "indigo", name: "Indigo", swatch: "oklch(0.47 0.17 278)" },
  { id: "teal", name: "Teal", swatch: "oklch(0.5 0.09 192)" },
  { id: "forest", name: "Forest", swatch: "oklch(0.44 0.1 152)" },
  { id: "slate", name: "Slate", swatch: "oklch(0.4 0.03 255)" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export type ThemeMode = "light" | "dark" | "system";

export const DEFAULT_THEME: ThemeId = "graphite";
export const DEFAULT_MODE: ThemeMode = "light";

export const THEME_STORAGE_KEY = "inv-theme";
export const MODE_STORAGE_KEY = "inv-mode";

export const MODES: { id: ThemeMode; name: string }[] = [
  { id: "light", name: "Light" },
  { id: "dark", name: "Dark" },
  { id: "system", name: "System" },
];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEMES.some((t) => t.id === value);
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

/** Applies the theme and mode to the document (client only). */
export function applyAppearance(theme: ThemeId, mode: ThemeMode): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
}

export function readAppearance(): { theme: ThemeId; mode: ThemeMode } {
  try {
    const theme = localStorage.getItem(THEME_STORAGE_KEY);
    const mode = localStorage.getItem(MODE_STORAGE_KEY);
    return { theme: isThemeId(theme) ? theme : DEFAULT_THEME, mode: isThemeMode(mode) ? mode : DEFAULT_MODE };
  } catch {
    return { theme: DEFAULT_THEME, mode: DEFAULT_MODE };
  }
}

export function saveAppearance(theme: ThemeId, mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // Storage may be unavailable (private mode); the choice still applies for this page.
  }
}

/**
 * Inline bootstrap script. Mirrors applyAppearance/readAppearance in plain JS
 * so it can run before React loads.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var m=localStorage.getItem(${JSON.stringify(MODE_STORAGE_KEY)});var ids=${JSON.stringify(THEMES.map((t) => t.id))};if(ids.indexOf(t)<0)t=${JSON.stringify(DEFAULT_THEME)};if(m!=="light"&&m!=="dark"&&m!=="system")m=${JSON.stringify(DEFAULT_MODE)};var d=document.documentElement;d.setAttribute("data-theme",t);var dark=m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(dark)d.classList.add("dark");else d.classList.remove("dark");}catch(e){}})();`;
