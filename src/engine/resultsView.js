// ─── Results tab — derived view data (pure) ──────────────────────────────────
// Everything the redesigned Results tab shows that isn't already stored: the
// week scrubber's winner dots, the race "quick facts", league average, and the
// takeaway superlatives. Scoring itself is untouched (see scoring.js / stats.js).

import { SCHEDULE, TRACK_MULTS } from "../constants.js";
import { storeFor, isScored } from "./events.js";
import { calcDriverScore } from "./scoring.js";

const round1 = n => Math.round(n * 10) / 10;

/** "#12 Ryan Blaney" → "12"; names without a "#" fall back to the full name. */
export const carKey = name => (String(name).match(/^#(\S+)\s/) || [])[1] || String(name);

/** "#12 Ryan Blaney" → { num: "12", name: "Ryan Blaney" } */
export function parseDriver(d) {
  const m = String(d).match(/^#(\S+)\s+(.*)$/);
  return m ? { num: m[1], name: m[2] } : { num: "", name: String(d) };
}

/** Scored events in schedule order (oldest first), so the Clash / All-Star sit where they ran. */
export const scoredWeeks = data => SCHEDULE.map(s => s.w).filter(w => isScored(data, w));

/** Player id with the best score for a scored week (weeklyWin flag, else highest total). */
export function weekWinnerPid(scored) {
  const entries = Object.entries(scored || {});
  if (!entries.length) return null;
  const flagged = entries.find(([, s]) => s.weeklyWin);
  if (flagged) return flagged[0];
  return entries.sort((a, b) => b[1].total - a[1].total)[0][0];
}

/** { [week]: pid } for every scored week — drives the coloured dots on the scrubber. */
export function weekWinners(data) {
  const out = {};
  scoredWeeks(data).forEach(w => {
    out[w] = weekWinnerPid(storeFor(data, w).results?.["w" + w]?.scored);
  });
  return out;
}

/** Previous / next week in a list (null at the ends). */
export function stepWeek(weeks, current, dir) {
  const i = weeks.indexOf(current);
  if (i < 0) return null;
  const j = i + dir;
  return j >= 0 && j < weeks.length ? weeks[j] : null;
}

/**
 * Who owns each car this week, keyed by car number: { "12": ["justin"] }.
 * Built from what actually scored (so garage swaps count) plus the raw picks.
 */
export function buildOwnerMap(scored, picks) {
  const m = {};
  const add = (name, pid) => {
    if (!name) return;
    const k = carKey(name);
    if (!m[k]) m[k] = [];
    if (!m[k].includes(pid)) m[k].push(pid);
  };
  Object.entries(scored || {}).forEach(([pid, s]) => (s.drivers || []).forEach(d => { if (!d.dnr) add(d.driver, pid); }));
  Object.entries(picks || {}).forEach(([pid, list]) => (list || []).forEach(pk => { if (!pk.garage) add(pk.driver, pid); }));
  return m;
}

/** Race "quick facts" from the stored result lines (any of them may be missing). */
export function getRaceFacts(raw) {
  const drivers = raw?.drivers || [];
  const winner = drivers.find(d => d.finish === 1) || null;
  const pole   = drivers.find(d => d.pole) || null;
  const stageWinners = [1, 2, 3]
    .map(n => ({ stage: n, driver: drivers.find(d => d["stageWin" + n]) || null }))
    .filter(s => s.driver);
  const leaders = drivers.filter(d => d.lapsLed > 0).length;
  const lapsLed = drivers.reduce((a, d) => a + (d.lapsLed || 0), 0);
  const dnfs    = drivers.filter(d => d.dnf).length;
  return {
    winner: winner?.name || null,
    pole: pole?.name || null,
    stageWinners: stageWinners.map(s => ({ stage: s.stage, name: s.driver.name })),
    leaders, lapsLed, dnfs,
  };
}

/** Mean player score for the week, one decimal (null when nothing scored). */
export function leagueAverage(scored) {
  const t = Object.values(scored || {}).map(s => s.total);
  return t.length ? round1(t.reduce((a, b) => a + b, 0) / t.length) : null;
}

/**
 * The takeaway superlatives for one week:
 *   mvp         — best drafted driver              { driver, total, pid }
 *   heartbreaker— worst drafted driver (DNF/DQ)    { driver, total, pid, dnf }
 *   bestUndrafted — best driver nobody drafted     { driver, total }  (needs the full result list)
 *   margin      — { pid, pts }  winner over 2nd place
 * Drivers who did not race (dnr) are ignored.
 */
export function getSuperlatives(scored, raw, week, picks) {
  const entries = Object.entries(scored || {});
  const owned = [];
  entries.forEach(([pid, s]) => (s.drivers || []).forEach(d => { if (!d.dnr) owned.push({ ...d, pid }); }));

  let mvp = null;
  owned.forEach(d => { if (!mvp || d.total > mvp.total) mvp = d; });

  // heartbreaker: lowest score; on a tie a DNF/DQ beats a plain finish
  const rawByKey = Object.fromEntries((raw?.drivers || []).map(d => [carKey(d.name), d]));
  const flagged = d => { const r = rawByKey[carKey(d.driver)]; return !!(r && (r.dnf || r.dq)); };
  let heart = null;
  owned.forEach(d => {
    if (!heart || d.total < heart.total || (d.total === heart.total && flagged(d) && !flagged(heart))) heart = d;
  });

  const ownerMap = buildOwnerMap(scored, picks);
  let bestUndrafted = null;
  const ty = SCHEDULE.find(s => s.w === week)?.ty || "intermediate";
  (raw?.drivers || []).forEach(d => {
    if (ownerMap[carKey(d.name)]) return;
    const total = calcDriverScore(d, ty, false, !!raw.threeStages).total;
    if (!bestUndrafted || total > bestUndrafted.total) bestUndrafted = { driver: d.name, total };
  });

  const ranked = entries.slice().sort((a, b) => b[1].total - a[1].total);
  const margin = ranked.length > 1
    ? { pid: ranked[0][0], pts: round1(ranked[0][1].total - ranked[1][1].total) }
    : null;

  const pick = d => d && { driver: d.driver, total: d.total, pid: d.pid };
  return {
    mvp: pick(mvp),
    heartbreaker: heart ? { ...pick(heart), dnf: flagged(heart) } : null,
    bestUndrafted,
    margin,
  };
}

/** "+94.5" / "0" / "-5" */
export const fmtPts = n => (n > 0 ? "+" : "") + (Math.round(n * 10) / 10);

export const TRACK_ARCHETYPE = {
  superspeedway: "Superspeedway",
  short_track:   "Short Track",
  intermediate:  "Intermediate",
  road_course:   "Road Course",
};
export const trackMult = ty => TRACK_MULTS[ty];
