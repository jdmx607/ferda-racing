// ─── Hall of Champions — derived facts (pure) ────────────────────────────────
// Everything on the Hall of Champions screen is calculated from the season list
// in championsHistory.js: title counts, split/sweep badges and dynasty streaks.

import { PLAYERS } from "../constants.js";

export const newestFirst = history => [...history].sort((a, b) => b.year - a.year);

/** Did this player win the Overall and/or Regular Season title that year? */
export function wonTitle(season, pid) {
  return { overall: season.overall === pid, regularSeason: season.regularSeason === pid };
}
export const wonAnyTitle = (season, pid) => {
  const w = wonTitle(season, pid);
  return w.overall || w.regularSeason;
};

/** [{ id, overall, regularSeason }] — most Overall titles first (then Regular Season, then league order). */
export function getTitleTally(history) {
  return PLAYERS
    .map((p, order) => ({
      id: p.id, order,
      overall: history.filter(s => s.overall === p.id).length,
      regularSeason: history.filter(s => s.regularSeason === p.id).length,
    }))
    .sort((a, b) => b.overall - a.overall || b.regularSeason - a.regularSeason || a.order - b.order)
    .map(({ order, ...t }) => t);
}

/** Milestone flags for one season. */
export function seasonBadges(season) {
  const split = season.regularSeason !== season.overall;
  return { sweep: !split, split, inaugural: !!season.inaugural };
}

/**
 * Consecutive Overall titles by the same player (length ≥ minLength), oldest first:
 *   [{ pid, startYear, endYear, length }]
 */
export function getOverallRuns(history, minLength = 2) {
  const asc = [...history].sort((a, b) => a.year - b.year);
  const runs = [];
  let cur = null;
  asc.forEach(s => {
    if (cur && cur.pid === s.overall && s.year === cur.endYear + 1) {
      cur.endYear = s.year; cur.length++;
    } else {
      if (cur) runs.push(cur);
      cur = { pid: s.overall, startYear: s.year, endYear: s.year, length: 1 };
    }
  });
  if (cur) runs.push(cur);
  return runs.filter(r => r.length >= minLength);
}

const WORDS = { 2: "BACK-TO-BACK", 3: "THREE-PEAT DYNASTY" };

/** "🔥 2024–2026 THREE-PEAT DYNASTY" / "🏆 2020–2021 BACK-TO-BACK" */
export function runLabel(run) {
  const text = WORDS[run.length] || `${run.length}-PEAT DYNASTY`;
  return `${run.length >= 3 ? "🔥" : "🏆"} ${run.startYear}–${run.endYear} ${text}`;
}

/**
 * The reigning champion: newest season, and how many Overall titles in a row they
 * have. dynasty is "" for a first title, "BACK-TO-BACK", or "3-PEAT DYNASTY" etc.
 */
export function getReigning(history) {
  const season = newestFirst(history)[0];
  if (!season) return null;
  const run = getOverallRuns(history, 1).find(r => r.pid === season.overall && r.endYear === season.year);
  const streak = run?.length || 1;
  const dynasty = streak === 1 ? "" : streak === 2 ? "BACK-TO-BACK" : `${streak}-PEAT DYNASTY`;
  return { season, pid: season.overall, streak, dynasty };
}
