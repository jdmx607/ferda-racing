// ─── All-Time Career Stats — derived facts (pure) ─────────────────────────────
// Turns the recorded finish tallies (careerStats.js) and the season list
// (championsHistory.js) into the cards, rates, sort orders and record book shown on
// the "All-Time Career Stats" view.

import { PLAYERS } from "../constants.js";
import { getOverallRuns } from "./champions.js";

/** 0.8954… → "89.5" (one decimal, tabular-friendly) */
export const fmtPct = ratio => (Math.round(ratio * 1000) / 10).toFixed(1);

export const peatLabel = n => (n === 3 ? "3-Peat" : `${n}-Peat`);

/** The longest run of consecutive Overall titles (latest run wins a tie), or null. */
export function getLongestStreak(history) {
  const runs = getOverallRuns(history, 1);
  if (!runs.length) return null;
  return runs.reduce((best, r) => (r.length >= best.length ? r : best));
}

/**
 * One card per player: finishes, percentages for the stacked bar, win % / podium %,
 * title counts and years, and the milestone line.
 *   [{ id, order, firstYear, lastYear, races, joinedLate,
 *      finishes: {first, second, third, fourth}, bar: [n1,n2,n3,n4],
 *      winPct, podiumPct, winRatio, podiumRatio,
 *      titles: { overall, regularSeason, overallYears[], regularSeasonYears[] },
 *      milestone }]
 */
export function getCareerCards(stats, history) {
  const est = Math.min(...Object.values(stats).map(s => s.firstYear));
  return PLAYERS.map((p, order) => ({ p, order, s: stats[p.id] }))
    .filter(x => x.s)
    .map(({ p, order, s }) => {
      const [first, second, third, fourth] = s.finishes;
      const winRatio    = first / s.races;
      const podiumRatio = (first + second + third) / s.races;
      const yrs = key => history.filter(h => h[key] === p.id).map(h => h.year).sort((a, b) => a - b);
      const overallYears = yrs("overall");
      const regularSeasonYears = yrs("regularSeason");

      const dynasty = getOverallRuns(history, 3)
        .filter(r => r.pid === p.id)
        .reduce((best, r) => (!best || r.length >= best.length ? r : best), null);
      const milestone = dynasty
        ? `${s.milestone} • ${peatLabel(dynasty.length)} Dynasty (${dynasty.startYear}–${dynasty.endYear})`
        : s.milestone;

      return {
        id: p.id, order,
        firstYear: s.firstYear, lastYear: s.lastYear, races: s.races,
        joinedLate: s.firstYear > est,
        finishes: { first, second, third, fourth },
        bar: [first, second, third, fourth],
        winRatio, podiumRatio, winPct: fmtPct(winRatio), podiumPct: fmtPct(podiumRatio),
        titles: {
          overall: overallYears.length, regularSeason: regularSeasonYears.length,
          overallYears, regularSeasonYears,
        },
        milestone,
      };
    });
}

export const SORT_KEYS = ["wins", "winPct", "podiumPct", "titles"];

/** Sorted copy, best first. Ties fall back to Overall titles, then league order. */
export function sortCareer(cards, key = "wins") {
  const val = c => ({
    wins: c.finishes.first,
    winPct: c.winRatio,
    podiumPct: c.podiumRatio,
    titles: c.titles.overall * 1000 + c.titles.regularSeason,
  })[key] ?? c.finishes.first;
  return [...cards].sort((a, b) =>
    val(b) - val(a) || b.titles.overall - a.titles.overall || a.order - b.order);
}

/** League era banner: { est, seasons, races } */
export function getEra(history, totalRaces) {
  return {
    est: Math.min(...history.map(h => h.year)),
    seasons: history.length,
    races: totalRaces,
  };
}

/**
 * The four "FRL All-Time Records":
 *   [{ key, label, pid, value, sub }]
 */
export function getRecordBook(cards, history, extra) {
  const topWins = sortCareer(cards, "wins")[0];
  const streak = getLongestStreak(history);
  const { seasonWins, weekScore } = extra;
  return [
    { key: "careerWins", label: "Most Career Wins", pid: topWins.id,
      value: `${topWins.finishes.first} Wins`, sub: `${topWins.firstYear}–${topWins.lastYear}` },
    { key: "seasonWins", label: "Single-Season Win Record", pid: seasonWins.pid,
      value: `${seasonWins.wins} Wins`, sub: String(seasonWins.year) },
    { key: "weekScore", label: "Highest Single-Week Score (Modern Era)", pid: weekScore.pid,
      value: `${weekScore.pts.toFixed(1)} pts`, sub: `${weekScore.race} ${weekScore.year}` },
    streak && { key: "streak", label: "Longest Championship Streak", pid: streak.pid,
      value: streak.length >= 2 ? peatLabel(streak.length) : "—",
      sub: `${streak.startYear}–${streak.endYear}` },
  ].filter(Boolean);
}
