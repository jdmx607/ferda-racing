// ─── UI DESIGN TOKENS ─────────────────────────────────────────────────────────
// Single source of truth for all visual constants.
// League data (players, scoring, schedule) lives in constants.js.

// Color palette
export const C = {
  bg:      "#0a0e17",
  bgDeep:  "#060912",
  card:    "#111827",
  cardAlt: "#0d1520",
  accent:  "#f59e0b",
  accentDim:"#d97706",
  green:   "#10b981",
  greenDim:"#059669",
  red:     "#ef4444",
  redDim:  "#dc2626",
  blue:    "#3b82f6",
  blueDim: "#2563eb",
  purple:  "#8b5cf6",
  text:    "#f1f5f9",
  textDim: "#cbd5e1",
  dim:     "#94a3b8",
  muted:   "#475569",
  border:  "#1e293b",
  borderBright: "#334155",
  input:   "#0f172a",
};

// Per-player brand colors — always use these for player identity
export const PClr = {
  justin:   { bg:"#FFF44F", fg:"#1C2541" },
  bigmonroe:{ bg:"#000000", fg:"#65FE08" },
  monroe:   { bg:"#046A38", fg:"#91999F" },
  rich:     { bg:"#B3995D", fg:"#AA0000" },
};

// Per-player accent (for text highlights, score colors)
export const PC = {
  justin:    PClr.justin.fg,
  bigmonroe: "#ef4444",
  monroe:    PClr.monroe.fg,
  rich:      PClr.rich.fg,
};

// Track type colors and labels
export const TTC = {
  superspeedway: C.blue,
  short_track:   C.red,
  intermediate:  C.accent,
  road_course:   C.green,
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
export const r = { sm:6, md:10, lg:16, xl:20, pill:9999 };

// ─── BOX SHADOWS ──────────────────────────────────────────────────────────────
export const shadow = {
  sm:  "0 1px 4px rgba(0,0,0,0.4)",
  md:  "0 4px 16px rgba(0,0,0,0.5)",
  lg:  "0 8px 32px rgba(0,0,0,0.6)",
  xl:  "0 16px 48px rgba(0,0,0,0.75)",
  glow:      (col) => `0 0 20px ${col}55`,
  glowStrong:(col) => `0 0 30px ${col}77, 0 0 60px ${col}33`,
  card: "0 2px 12px rgba(0,0,0,0.5)",
};

// ─── TRANSITIONS ──────────────────────────────────────────────────────────────
export const t = {
  fast:   "all 0.12s ease",
  normal: "all 0.22s ease",
  slow:   "all 0.35s ease",
};

// ─── POSITION RANK PALETTE ────────────────────────────────────────────────────
// Used by Live tab and any ranked display
export const rankColor = {
  1: { fg:"#f59e0b", bg:"rgba(245,158,11,0.15)", label:"GOLD"   },
  2: { fg:"#94a3b8", bg:"rgba(148,163,184,0.12)", label:"SILVER" },
  3: { fg:"#cd7f32", bg:"rgba(205,127,50,0.12)",  label:"BRONZE" },
  4: { fg:"#475569", bg:"rgba(71,85,105,0.1)",    label:""       },
};
