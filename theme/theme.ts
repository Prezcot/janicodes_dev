/**
 * The colour system: Sea glass.
 * Every colour of the desktop and the game is defined in this file and nowhere else.
 * To change a colour, change its value here. The styles and the 3D game both read it.
 */
/** One pistol look. With `fromPlayer`, the base and panel colours come from the player's own colour. With `plain`, nothing is drawn on it. */
export type Skin = { name: string; note: string; base: string; panel: string; line: string; accent: string; pattern?: "hatch" | "grid" | "dots"; patternInk?: string; fromPlayer?: boolean; plain?: boolean };
/** The pistol looks, in the order the game stores them. The first one is the default. */
const skins: Skin[] = [
  { name: "Ink steel", note: "Grey card with drawn panel lines.", base: "#4a686e", panel: "#3a555b", line: "#0f3a44", accent: "#f0704a" },
  { name: "Hatched steel", note: "Pen hatching, like the crates.", base: "#5d7d83", panel: "#46646a", line: "#0f3a44", accent: "#f0704a", pattern: "hatch", patternInk: "rgba(15,58,68,0.42)" },
  { name: "Paper cutout", note: "Cream card with ink lines.", base: "#f9f6ea", panel: "#dfe9e2", line: "#0f3a44", accent: "#f0704a" },
  { name: "Blueprint", note: "Teal with a fine light grid.", base: "#125e6b", panel: "#0e4a55", line: "#d2ebe8", accent: "#ffd9a0", pattern: "grid", patternInk: "rgba(210,235,232,0.3)" },
  { name: "Sand card", note: "Deck-coloured card with printed dots.", base: "#ecdab2", panel: "#d9c391", line: "#0f3a44", accent: "#a53412", pattern: "dots", patternInk: "rgba(15,58,68,0.24)" },
  { name: "Player colour", note: "The pistol matches your figure.", base: "", panel: "", line: "#0f3a44", accent: "#f9f6ea", pattern: "hatch", patternInk: "rgba(249,246,234,0.22)", fromPlayer: true },
  { name: "Flat grey", note: "Plain grey card with no drawing.", base: "#4a686e", panel: "#4a686e", line: "#0f3a44", accent: "#4a686e", plain: true },
];

export const theme = {
  /** Desktop, windows, and the game's panels. Each entry becomes a CSS variable: `surface2` is `--surface-2`. */
  ui: {
    desk: "#bcdcd8", // the desktop behind the windows
    surface: "#f9f6ea", // windows, menus, and game panels
    surface2: "#e3eee8", // sidebars and cards inside a window
    ink: "#0f3a44", // text and outlines
    muted: "#406067", // secondary text
    line: "#a3b8b4", // thin dividers inside a window
    fieldLine: "#6c8988", // the border of a text input
    chrome: "#125e6b", // title bars, the bottom bar, and window borders
    chromeHover: "#1b7484", // a bottom bar button under the pointer
    chromeInk: "#f9f6ea", // text on chrome
    chromeMuted: "#e3eee8", // quiet text on chrome
    brand: "#ffd9a0", // the JANI//OS name
    accent: "#f0704a", // primary buttons and highlights
    accentInk: "#2a0f08", // text on accent
    accentStrong: "#a53412", // accent-coloured text on paper, and the edge of a primary button
    focus: "#a53412", // the keyboard focus outline on paper and on the desk
    focusOnChrome: "#ffd9a0", // the keyboard focus outline on chrome
  },
  /** The 3D game. */
  game: {
    sky: "#d2ebe8",
    floor: "#e3eee8",
    wall: "#f9f6ea",
    deck: "#ecdab2",
    boundary: "#f0efe1", // the walls around the map
    low: "#a6d4cf",
    crate: "#f4a58c",
    gridLine: "#125e6b", // drawn semi-transparent on floors, walls, and low walls
    crateLine: "rgba(120,40,20,0.7)",
    edge: "#0f3a44", // the outline of every shape
    hole: "#0a2026", // the centre of a bullet hole
    flash: "#f0704a", // the muzzle flash
    light: { sky: "#ffffff", ground: "#e6dcc4", sun: "#fff6e0", hand: "#cbbd9c" },
  },
  /** The eight player colours, in the order the game stores them. */
  players: [
    { name: "Navy", colour: "#1f3a6e" },
    { name: "Rose", colour: "#b3245a" },
    { name: "Green", colour: "#2b7a3e" },
    { name: "Purple", colour: "#6b2fa0" },
    { name: "Blue", colour: "#2f6fd0" },
    { name: "Brown", colour: "#7a3b1d" },
    { name: "Ochre", colour: "#8a6400" },
    { name: "Graphite", colour: "#33363b" },
  ],
  skins,
} as const;

/** The `ui` colours as CSS variables, set once on the page's root element. */
export const cssVariables = Object.fromEntries(
  Object.entries(theme.ui).map(([name, value]) => [`--${name.replace(/[A-Z0-9]/g, (c) => `-${c.toLowerCase()}`)}`, value]),
);

/** A hex colour with transparency, for canvas drawing. */
export function alpha(hex: string, opacity: number) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${opacity})`;
}
