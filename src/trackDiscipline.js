// ─── Track disciplines — visual identity + quick specs ───────────────────────
// One accent colour, label and strategy tag per track type, shared by every race
// header (Home, Live, Draft, Results). Multipliers come from TRACK_MULTS.

import { TRACK_MULTS } from "./constants.js";

export const DISCIPLINE = {
  short_track:   { code: "ST",  accent: "#F97316", label: "BULLRING",      tag: "BULLRING • PD > LAPS" },
  road_course:   { code: "RC",  accent: "#8B5CF6", label: "ROAD COURSE",   tag: "LEFT & RIGHT • ×1.5 LAPS" },
  intermediate:  { code: "INT", accent: "#38BDF8", label: "INTERMEDIATE",  tag: null },        // built from track length
  superspeedway: { code: "SS",  accent: "#22C55E", label: "SUPERSPEEDWAY", tag: "PACK DRAFT • SURVIVAL" },
};

// Oval lengths (miles) for intermediates, so the spec tag is accurate per track.
export const TRACK_MILES = {
  "Las Vegas": "1.5", "Kansas": "1.5", "Texas": "1.5", "Charlotte": "1.5", "Chicagoland": "1.5", "Homestead": "1.5",
  "Darlington": "1.366", "Nashville": "1.33", "Michigan": "2.0", "Pocono": "2.5", "Indianapolis": "2.5",
  "WWT Raceway": "1.25", "Dover": "1.0",
};

export const disciplineOf = ty => DISCIPLINE[ty] || null;

/** "INT ×0.5" */
export function multLabel(ty) {
  const d = DISCIPLINE[ty];
  return d && TRACK_MULTS[ty] != null ? `${d.code} ×${TRACK_MULTS[ty].toFixed(1)}` : "";
}

/** Compact spec + strategy tag: "1.5 MI OVAL • TIRE WEAR", "BULLRING • PD > LAPS"… */
export function trackSpecTag(ty, track) {
  const d = DISCIPLINE[ty];
  if (!d) return "";
  if (ty === "intermediate") {
    const mi = TRACK_MILES[track];
    return mi ? `${mi} MI OVAL • TIRE WEAR` : "OVAL • TIRE WEAR";
  }
  return d.tag;
}
