// ─── Season archive views (pure) ─────────────────────────────────────────────
// Everything on the Seasons screen is derived from a season's stored document plus
// THAT season's own schedule (SCHEDULES[year]) — never the active season's — so an
// archived 2026 keeps its 2026 tracks even after 2027 becomes the active season.

import { PLAYERS, SCHEDULES } from "../constants.js";
import { calcDriverScore } from "./scoring.js";
import { storeFor } from "./events.js";
import { getChaseTotals } from "./chase.js";
import { weekWinnerPid } from "./resultsView.js";
import { CHAMPION_HISTORY } from "../championsHistory.js";

const r1 = n => Math.round(n * 10) / 10;
const carOf = name => (String(name).match(/^#(\S+)\s/) || [])[1] || null;
const ownersOf = (scored, name) => Object.entries(scored || {})
  .filter(([, ps]) => (ps.drivers || []).some(d => !d.dnr && (d.driver === name || (carOf(d.driver) && carOf(d.driver) === carOf(name)))))
  .map(([pid]) => pid);

/**
 * Every scored event of a season in schedule order (exhibitions included, flagged):
 *   { w, race, track, ty, date, ex, scores:[{ pid, total, weeklyWin, drivers }] (best first),
 *     winner, margin, mvp:{ name, total, owners } | null }
 */
export function seasonWeeks(data, year) {
  const schedule = SCHEDULES[year] || [];
  return schedule.map(s => {
    const wr = storeFor(data, s.w)?.results?.["w" + s.w];
    if (!wr?.scored) return null;
    const winner = weekWinnerPid(wr.scored);
    const scores = Object.entries(wr.scored)
      .map(([pid, ps]) => ({ pid, total: ps.total ?? 0, weeklyWin: !!ps.weeklyWin, drivers: ps.drivers || [] }))
      .sort((a, b) => (a.pid === winner ? -1 : b.pid === winner ? 1 : b.total - a.total));
    const three = !!wr.raw?.threeStages;
    let mvp = null;
    (wr.raw?.drivers || []).forEach(d => {
      const total = calcDriverScore(d, s.ty, false, three).total;
      if (!mvp || total > mvp.total) mvp = { name: d.name, total };
    });
    if (mvp) mvp.owners = ownersOf(wr.scored, mvp.name);
    return {
      w: s.w, race: s.r, track: s.t, ty: s.ty, date: s.d, ex: !!s.ex,
      scores, winner,
      margin: scores.length > 1 ? r1(scores[0].total - scores[1].total) : null,
      mvp,
    };
  }).filter(Boolean);
}

/** Wins per manager (points weeks only), their longest streak, best week and best driver. */
export function seasonHighlights(weeks) {
  const pts = weeks.filter(w => !w.ex);
  const wins = Object.fromEntries(PLAYERS.map(p => [p.id, 0]));
  const streak = Object.fromEntries(PLAYERS.map(p => [p.id, 0]));
  const run = Object.fromEntries(PLAYERS.map(p => [p.id, 0]));
  let bestWeek = null, bestDriver = null;
  pts.forEach(w => {
    PLAYERS.forEach(p => {
      if (w.winner === p.id) { wins[p.id]++; run[p.id]++; streak[p.id] = Math.max(streak[p.id], run[p.id]); }
      else run[p.id] = 0;
    });
    w.scores.forEach(s => { if (!bestWeek || s.total > bestWeek.total) bestWeek = { pid: s.pid, total: r1(s.total), w: w.w, race: w.race }; });
    if (w.mvp && (!bestDriver || w.mvp.total > bestDriver.total)) bestDriver = { name: w.mvp.name, total: r1(w.mvp.total), w: w.w, race: w.race, owners: w.mvp.owners };
  });
  const longest = Object.entries(streak).sort((a, b) => b[1] - a[1])[0];
  return { wins, streak, longestStreak: longest && longest[1] > 0 ? { pid: longest[0], length: longest[1] } : null, bestWeek, bestDriver };
}

/**
 * Standings: Chase totals (entry 1,000 + bonus + Chase-week scoring) ranked, with
 * regular-season points and weekly wins alongside.
 *   [{ pid, total, regPts, wins }]
 */
export function seasonStandings(data, weeks) {
  const { totals } = getChaseTotals(data);
  const wins = seasonHighlights(weeks).wins;
  return PLAYERS
    .map(p => ({ pid: p.id, total: r1(totals[p.id] || 0), regPts: r1(data?.meta?.standings?.[p.id] || 0), wins: wins[p.id] || 0 }))
    .sort((a, b) => b.total - a.total || b.regPts - a.regPts);
}

/** The recorded champions for a year (Hall of Champions), if that year is in the books. */
export const championsFor = year => CHAMPION_HISTORY.find(s => s.year === year) || null;

/** A one-line facts summary for the season list. */
export function seasonSummary(data, year) {
  const weeks = seasonWeeks(data, year);
  const pts = weeks.filter(w => !w.ex);
  return { year, races: pts.length, exhibitions: weeks.length - pts.length, archived: !!data?.archived };
}
