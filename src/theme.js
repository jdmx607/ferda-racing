// UI color tokens — imported by every component that renders anything.
// League constants (players, scoring tables, schedule) live in constants.js.

export const C = {
  bg:"#0a0e17", card:"#111827", accent:"#f59e0b", green:"#10b981",
  red:"#ef4444", blue:"#3b82f6", purple:"#8b5cf6", text:"#f1f5f9",
  dim:"#94a3b8", border:"#1e293b", input:"#0f172a",
};

export const PClr = {
  justin:   { bg:"#000000", fg:"#CFC493" },
  bigmonroe:{ bg:"#DC0019", fg:"#FFFFFF" },
  monroe:   { bg:"#046A38", fg:"#91999F" },
  rich:     { bg:"#B3995D", fg:"#AA0000" },
};

export const PC = {
  justin:    PClr.justin.fg,
  bigmonroe: "#ef4444",
  monroe:    PClr.monroe.fg,
  rich:      PClr.rich.fg,
};

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
