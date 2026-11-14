// ─── NASCAR pre-race scouting (pure) ─────────────────────────────────────────
// Smart tags for the Draft Room / Drivers tab: PD UPSIDE, TO THE REAR, PLAYOFF,
// the road-course / superspeedway strategy callout and each driver's recent form
// at this week's track archetype. Display only — scoring is untouched.

import { SCHEDULE, PLAYOFF_START_WEEK, TRACK_MULTS } from "../constants.js";
import { TTL } from "../theme.js";
import { nameKey } from "../driverKey.js";
import { storeFor } from "./events.js";
import { isExhibition } from "../exhibitions.js";

const round1 = n => Math.round(n * 10) / 10;
const tyOf = w => SCHEDULE.find(s => s.w === w)?.ty || "intermediate";

export const ARCHETYPE = {
  superspeedway: "Superspeedway",
  intermediate:  "Intermediate",
  short_track:   "Short Track",
  road_course:   "Road Course",
};

// ── Strategy callout ─────────────────────────────────────────────────────────
/** Road-course and superspeedway weeks get a strategy callout; other weeks null. */
export function getTrackStrategy(ty) {
  const mult = TTL[ty] ? `${TTL[ty]} ×${TRACK_MULTS[ty].toFixed(1)}` : "";
  if (ty === "road_course") return {
    id: "stage-flip", title: "STAGE FLIP", mult,
    text: "Crews pit before stage ends to flip track position. Laps led pay ×1.5 here, so cars that can run up front outweigh late-stage points.",
  };
  if (ty === "superspeedway") return {
    id: "track-strategy", title: "TRACK STRATEGY", mult,
    text: "Laps led pay full value and the pack shuffles the field. Track position and lap-led multipliers outweigh late-stage points, and deep starters carry real PD upside.",
  };
  return null;
}

// ── Track-package form ───────────────────────────────────────────────────────
/**
 * Each driver's last `n` races at one track archetype (newest first):
 *   { [nameKey]: { races, avgFinish, finishes:[P…] } }
 */
export function getTrackForm(data, ty, n = 5) {
  const weeks = Object.entries(data?.results || {})
    .filter(([, wr]) => wr?.raw?.drivers?.length)
    .map(([k, wr]) => ({ w: parseInt(k.replace("w", ""), 10), wr }))
    .filter(x => tyOf(x.w) === ty)
    .sort((a, b) => b.w - a.w);
  const acc = {};
  weeks.forEach(({ wr }) => wr.raw.drivers.forEach(d => {
    if (!(d.finish > 0)) return;
    const k = nameKey(d.name);
    if (!k) return;
    const a = acc[k] || (acc[k] = []);
    if (a.length < n) a.push(d.finish);
  }));
  const out = {};
  Object.entries(acc).forEach(([k, f]) => {
    out[k] = { races: f.length, avgFinish: round1(f.reduce((s, x) => s + x, 0) / f.length), finishes: f };
  });
  return out;
}

// ── PD upside ────────────────────────────────────────────────────────────────
// Net Position is capped at ±10, so a car starting P20+ that usually finishes
// 12+ spots better than where it starts is a strong bet to max out the +10.
export const PD_MIN_START = 20;
export const PD_MIN_GAP = 12;
export const hasPdUpside = (start, avgFinish) =>
  start != null && avgFinish != null && start >= PD_MIN_START && start - avgFinish >= PD_MIN_GAP;

// ── Playoffs ─────────────────────────────────────────────────────────────────
const LAST_POINTS_WEEK = Math.max(...SCHEDULE.filter(s => !isExhibition(s.w)).map(s => s.w));
export const isPlayoffWeek = w => w >= PLAYOFF_START_WEEK && w <= LAST_POINTS_WEEK && !isExhibition(w);

/** nameKeys of drivers still alive in the real Cup playoff field (commissioner-managed). */
export function activePlayoffKeys(chaseField) {
  const out = new Set();
  const elim = chaseField?.eliminated || {};
  (chaseField?.drivers || []).forEach(d => { if (!elim[d]) out.add(nameKey(d)); });
  return out;
}

// ── To the rear (commissioner flag, per week) ────────────────────────────────
/** Drivers flagged as starting from the rear this week (failed inspection / backup car). */
export const getToRear = (data, week) => storeFor(data, week).toRear?.["w" + week] || [];

export const toggleInList = (list, driver) =>
  list.includes(driver) ? list.filter(d => d !== driver) : [...list, driver];

// ── Tags ─────────────────────────────────────────────────────────────────────
/**
 * Scouting pills for one driver, in display order:
 *   [{ id: "rear"|"pd"|"playoff", label, tone: "caution"|"go"|"gold", hint }]
 */
export function scoutingTags({ start = null, avgFinish = null, toRear = false, playoff = false }) {
  const tags = [];
  if (toRear) tags.push({ id: "rear", label: "TO THE REAR", tone: "caution", hint: "Starts from the rear on lap 1 (inspection / backup car) despite the official qualifying spot" });
  if (hasPdUpside(start, avgFinish)) tags.push({
    id: "pd", label: "PD UPSIDE", tone: "go",
    hint: `Starts P${start}, averages P${avgFinish}: good odds of maxing the +10 Net Position bonus`,
  });
  if (playoff) tags.push({ id: "playoff", label: "PLAYOFF", tone: "gold", hint: "Still alive in the Cup Series playoffs" });
  return tags;
}
