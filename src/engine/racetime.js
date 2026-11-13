// ─── Race start times ─────────────────────────────────────────────────────────
// Start times change every race, so they're looked up from NASCAR's race list
// (see fetchRaceStartTimes in nascar.js). Lookup order for one race:
//   1. an explicit `time: "15:30"` (24h, ET) on the schedule entry
//   2. the NASCAR feed, keyed by date ("2026-02-15" → "14:30", ET)
//   3. the 2:00 PM ET placeholder
// All times are Eastern Time (NASCAR publishes them that way).

import { ACTIVE_SEASON } from "../constants.js";

export const DEFAULT_RACE_TIME = "14:00";   // placeholder when no real time is known

const MONTH_IDX = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
const ET = "America/New_York";

// Minutes to add to a UTC instant to get Eastern wall-clock time (−240 EDT / −300 EST)
function etOffsetMinutes(utcMs) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET, hourCycle: "h23",
    year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",
  }).formatToParts(new Date(utcMs));
  const g = t => parseInt(parts.find(p => p.type === t).value, 10);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return (asUtc - utcMs) / 60000;
}

/** The real instant for an Eastern wall-clock time. */
export function etToMs(year, monthIdx, day, hour, minute) {
  const naive = Date.UTC(year, monthIdx, day, hour, minute);
  let ms = naive - etOffsetMinutes(naive) * 60000;
  ms = naive - etOffsetMinutes(ms) * 60000;           // second pass settles DST edges
  return ms;
}

/** Schedule entry date ("Feb 15") → "2026-02-15" (or null). */
export function entryIsoDate(entry, season = ACTIVE_SEASON) {
  const [mon, day] = String(entry?.d || "").split(" ");
  if (!(mon in MONTH_IDX)) return null;
  return `${season}-${String(MONTH_IDX[mon] + 1).padStart(2, "0")}-${String(parseInt(day, 10)).padStart(2, "0")}`;
}

/** "HH:MM" (ET) for a race: entry override → NASCAR feed → placeholder. */
export function raceClock(entry, times) {
  const iso = entryIsoDate(entry);
  return entry?.time || (iso && times?.[iso]) || DEFAULT_RACE_TIME;
}

/** True when the time came from real data (not the placeholder). */
export function hasRealRaceTime(entry, times) {
  const iso = entryIsoDate(entry);
  return !!(entry?.time || (iso && times?.[iso]));
}

export function raceStartMs(entry, times) {
  const iso = entryIsoDate(entry);
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const [hh, mm] = raceClock(entry, times).split(":").map(Number);
  return etToMs(y, m - 1, d, hh, mm);
}

/** "SUN FEB 15 • 2:30 PM ET" */
export function formatRaceWhen(entry, times) {
  const ms = raceStartMs(entry, times);
  if (ms == null) return entry?.d || "";
  const dt   = new Date(ms);
  const dow  = dt.toLocaleDateString("en-US", { weekday: "short", timeZone: ET });
  const md   = dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: ET });
  const time = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: ET });
  return `${dow} ${md} • ${time} ET`.toUpperCase();
}

/** Short form for tight spots: "SUN 2:30 PM ET" */
export function formatRaceShort(entry, times) {
  const ms = raceStartMs(entry, times);
  if (ms == null) return "";
  const dt   = new Date(ms);
  const dow  = dt.toLocaleDateString("en-US", { weekday: "short", timeZone: ET });
  const time = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: ET });
  return `${dow} ${time} ET`.toUpperCase();
}
