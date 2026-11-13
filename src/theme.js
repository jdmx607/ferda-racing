// ─── UI DESIGN TOKENS ─────────────────────────────────────────────────────────
// "Pit-Wall Minimalism": monochrome base, colour reserved for live telemetry.
//
// The CSS variables in styles.css are the source of truth for theming (they carry
// the light-mode overrides). This JS object mirrors the DARK values as plain hex
// because much of the UI still builds colours like `C.accent + "22"` (hex + alpha),
// which `var(--x)` strings can't do. Migrate call sites to the CSS vars / classes
// in styles.css over time; once they're gone these can become `var(--…)`.
// League data (players, scoring, schedule) lives in constants.js.

export const C = {
  // surfaces
  bg:      "#0F1115",
  bgDeep:  "#0B0D10",
  card:    "#181B22",
  cardAlt: "#14171D",
  input:   "#14171D",
  border:       "#24272E",   // ≈ rgba(255,255,255,0.07) on --surface
  borderBright: "#363A43",

  // text
  text:    "#F4F6F9",
  textDim: "#C4C9D2",
  dim:     "#949BA8",
  muted:   "#6B7280",

  // base UI is monochrome — "accent" is just high-contrast white
  accent:    "#F4F6F9",
  accentDim: "#C4C9D2",
  gold:      "#E7E9EE",
  goldDim:   "#A6ACB8",
  blue:      "#B4BAC6",
  blueDim:   "#8B93A1",
  purple:    "#A5ABB7",

  // live telemetry — the only bright colours
  green:   "#10B981",   // green flag / position gain
  greenDim:"#059669",
  red:     "#EF4444",   // red flag / position loss / DNF
  redDim:  "#DC2626",
  amber:   "#F59E0B",   // caution / cutoff warning
};

// Per-player identity. Cards are flat dark surfaces; `accent` is the one small
// splash of identity colour (dots, bars). `fg` is neutral so names stay readable.
export const PClr = {
  justin:   { bg:"#181B22", fg:"#F4F6F9", accent:"#FF1F8F" },
  bigmonroe:{ bg:"#181B22", fg:"#F4F6F9", accent:"#65FE08" },
  monroe:   { bg:"#181B22", fg:"#F4F6F9", accent:"#91999F" },
  rich:     { bg:"#181B22", fg:"#F4F6F9", accent:"#B3995D" },
};

// Per-player accent (chart lines, highlights)
export const PC = {
  justin:    PClr.justin.accent,
  bigmonroe: PClr.bigmonroe.accent,
  monroe:    PClr.monroe.accent,
  rich:      PClr.rich.accent,
};

// Track types are shown in greys — the label (SS / ST / INT / RC) carries the meaning
export const TTC = {
  superspeedway: "#D5D9E0",
  short_track:   "#B0B6C2",
  intermediate:  "#8D95A3",
  road_course:   "#6F7786",
};

export const TTL = {
  superspeedway: "SS",
  short_track:   "ST",
  intermediate:  "INT",
  road_course:   "RC",
};

// ─── SPACING SCALE (4px grid) ─────────────────────────────────────────────────
export const sp = { 1:4, 2:8, 3:12, 4:16, 5:20, 6:24, 7:32, 8:40, 9:48, 10:64 };

// ─── BORDER RADIUS ────────────────────────────────────────────────────────────
export const r = { sm:6, md:8, lg:12, xl:14, pill:9999 };

// ─── BOX SHADOWS — flat UI: depth comes from borders, not glow ────────────────
export const shadow = {
  sm:  "none",
  md:  "none",
  lg:  "0 8px 24px rgba(0,0,0,0.35)",
  xl:  "0 16px 40px rgba(0,0,0,0.45)",
  glow:      () => "none",
  glowStrong:() => "none",
  card: "none",
};

// ─── TRANSITIONS ──────────────────────────────────────────────────────────────
export const t = {
  fast:   "all 0.12s ease",
  normal: "all 0.22s ease",
  slow:   "all 0.35s ease",
};

// ─── POSITION RANK PALETTE (monochrome) ───────────────────────────────────────
export const rankColor = {
  1: { fg:"#F4F6F9", bg:"rgba(244,246,249,0.10)", label:"1ST" },
  2: { fg:"#C4C9D2", bg:"rgba(196,201,210,0.08)", label:"2ND" },
  3: { fg:"#949BA8", bg:"rgba(148,155,168,0.08)", label:"3RD" },
  4: { fg:"#6B7280", bg:"rgba(107,114,128,0.08)", label:""    },
};
