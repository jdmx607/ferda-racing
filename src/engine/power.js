// ─── Power Rankings — predictive momentum ────────────────────────────────────
// A player's Power Rating (PWR, 0–100) is a recency-weighted blend of their last
// four Weekly Performance Scores (W). It answers "who's hot right now", not
// "who has the most points".
//
// Weekly Performance Score (W), per player per completed race week:
//   base fantasy points that week
//   + 4  for each of their 5 drivers who finished Top 10   (max +20)
//   − 5  for each driver who finished 30th or worse         (DNF / wreck penalty)
//   + 15 for winning the week, + 5 for finishing 2nd among the 4 players
//   − 12 if they used a Mulligan that week
//
// Momentum window: last 4 completed races, weights newest→oldest 40/30/20/10
// (re-normalised over however many races exist). weighted score 250 ⇒ 100.0 PWR.

import { PLAYERS } from "../constants.js";

export const POWER_WEIGHTS = [0.4, 0.3, 0.2, 0.1];     // newest → oldest
export const PWR_FULL_SCALE = 250;                      // weighted score that equals 100.0 PWR

export const TOP10_BONUS      = 4;
export const WRECK_PENALTY    = 5;
export const WRECK_FINISH     = 30;                     // 30th or worse
export const WIN_BONUS        = 15;
export const SECOND_BONUS     = 5;
export const MULLIGAN_PENALTY = 12;

const round1 = x => Math.round(x * 10) / 10;
const round2 = x => Math.round(x * 100) / 100;

function findRaw(rawDrivers, name) {
  if (!rawDrivers?.length || !name) return null;
  const num = (String(name).match(/^#(\S+)\s/) || [])[1];
  return rawDrivers.find(d => d.name === name)
      || (num ? rawDrivers.find(d => d.name?.startsWith(`#${num} `)) : null)
      || null;
}

/**
 * Weekly Performance for every completed points week:
 *   { pid: [{ week, points, top10, wrecks, place, mulligan, w }] }  (oldest → newest)
 * `place` is the player's rank among the four that week (1 = weekly winner).
 */
export function getWeeklyPerformance(data) {
  const out = Object.fromEntries(PLAYERS.map(p => [p.id, []]));

  Object.entries(data?.results || {}).forEach(([key, wr]) => {
    if (!wr?.scored) return;
    const week = parseInt(key.replace("w", ""), 10);
    const raw  = wr.raw?.drivers || [];

    // Placement among the players (weeklyWin flag carries the league tiebreak)
    const order = Object.entries(wr.scored)
      .sort((a, b) => (b[1].weeklyWin ? 1 : 0) - (a[1].weeklyWin ? 1 : 0) || b[1].total - a[1].total)
      .map(([pid]) => pid);

    PLAYERS.forEach(({ id }) => {
      const s = wr.scored[id];
      if (!s) return;
      let top10 = 0, wrecks = 0;
      (s.drivers || []).forEach(d => {
        if (d.dnr) return;
        const finish = findRaw(raw, d.driver)?.finish;
        if (!finish) return;
        if (finish <= 10) top10++;
        if (finish >= WRECK_FINISH) wrecks++;
      });
      const place = order.indexOf(id) + 1;
      const mulligan =
        (s.drivers || []).some(d => d.isMulligan) ||
        (data?.picks?.["w" + week]?.[id] || []).some(pk => pk.mulligan);

      const w =
        (s.total || 0)
        + TOP10_BONUS * Math.min(top10, 5)
        - WRECK_PENALTY * wrecks
        + (place === 1 ? WIN_BONUS : place === 2 ? SECOND_BONUS : 0)
        - (mulligan ? MULLIGAN_PENALTY : 0);

      out[id].push({ week, points: s.total || 0, top10, wrecks, place, mulligan, w: round2(w) });
    });
  });

  Object.values(out).forEach(arr => arr.sort((a, b) => a.week - b.week));
  return out;
}

/** Recency-weighted average of the last four W's (weights re-normalised when fewer exist). */
export function weightedScore(entries, pick = e => e.w) {
  const recent = entries.slice(-POWER_WEIGHTS.length);          // oldest → newest
  if (!recent.length) return 0;
  const ws = POWER_WEIGHTS.slice(0, recent.length).reverse();   // align weights oldest → newest
  const sum = ws.reduce((a, b) => a + b, 0);
  return recent.reduce((t, e, i) => t + pick(e) * ws[i], 0) / sum;
}

/** Weighted score → 0–100.0 Power Rating. */
export function toPwr(weighted) {
  return round1(Math.min(100, Math.max(0, (weighted / PWR_FULL_SCALE) * 100)));
}

const fmt = n => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const lastN = k => (k === 1 ? "last race" : `last ${k} races`);

/** One-line "form insight" from a player's window of weekly entries. */
export function formInsight(window) {
  const k = window.length;
  if (!k) return "No races yet";
  const wins   = window.filter(e => e.place === 1).length;
  const mulls  = window.filter(e => e.mulligan).length;
  const wrecks = window.reduce((s, e) => s + e.wrecks, 0);
  const top10Avg = window.reduce((s, e) => s + e.top10, 0) / k;

  if (wins >= 2) return `${wins} wins in ${lastN(k)}`;
  if (mulls >= 1 && wrecks >= 2) return `Dipped after Mulligan + ${wrecks} DNFs`;
  if (wrecks >= 2) return `${wrecks} DNFs in ${lastN(k)}`;
  if (top10Avg >= 3) {
    return `${fmt(Math.round(top10Avg * 10) / 10)} Top-10 drivers avg • ` +
      (mulls === 0 ? "Zero Mulligans burned" : `${mulls} Mulligan${mulls > 1 ? "s" : ""} burned`);
  }
  if (wins === 1) return `1 win in ${lastN(k)}`;
  if (mulls >= 2) return `${mulls} Mulligans burned in ${lastN(k)}`;
  if (k >= 2) {
    const latest = window[k - 1].w;
    const ws = window.map(e => e.w);
    if (latest === Math.max(...ws)) return "Peaked in the last race";
    if (latest === Math.min(...ws)) return "Cooling off after the last race";
  }
  return `${fmt(Math.round(top10Avg * 10) / 10)} Top-10 drivers avg`;
}

function rankPlayers(perf, upToWeek) {
  return PLAYERS
    .map(p => {
      const entries = (perf[p.id] || []).filter(e => e.week <= upToWeek);
      return { id: p.id, entries, weighted: weightedScore(entries), latest: entries.at(-1)?.w ?? -Infinity };
    })
    .sort((a, b) => b.weighted - a.weighted || b.latest - a.latest);
}

/**
 * Ranked Power Rankings (best first). [] until a race has been scored.
 *   id, rank, prevRank, delta (+ = moved up), pwr (0–100.0), powerScore (= pwr, kept for older callers),
 *   weighted (raw weighted W), weeksPlayed, insight,
 *   window: [{ week, points, top10, wrecks, place, mulligan, w }]  (the races counted, oldest → newest)
 *   breakdown: { races, points (recency-weighted avg), top10, wins, mulligans, wrecks }
 */
export function getPowerRankings(data) {
  const perf = getWeeklyPerformance(data);
  const weeks = [...new Set(Object.values(perf).flatMap(a => a.map(e => e.week)))].sort((a, b) => a - b);
  if (!weeks.length) return [];

  const current  = rankPlayers(perf, weeks[weeks.length - 1]);
  const previous = weeks.length > 1 ? rankPlayers(perf, weeks[weeks.length - 2]) : current;
  const prevRank = {};
  previous.forEach((p, i) => { prevRank[p.id] = i + 1; });

  return current.map((p, i) => {
    const win = p.entries.slice(-POWER_WEIGHTS.length);
    const rank = i + 1;
    return {
      id: p.id,
      rank,
      prevRank: prevRank[p.id] ?? rank,
      delta: (prevRank[p.id] ?? rank) - rank,
      pwr: toPwr(p.weighted),
      powerScore: toPwr(p.weighted),
      weighted: round1(p.weighted),
      weeksPlayed: p.entries.length,
      insight: formInsight(win),
      window: win,
      breakdown: {
        races: win.length,
        points: round1(weightedScore(win, e => e.points)),
        top10: win.reduce((s, e) => s + e.top10, 0),
        wins: win.filter(e => e.place === 1).length,
        mulligans: win.filter(e => e.mulligan).length,
        wrecks: win.reduce((s, e) => s + e.wrecks, 0),
      },
    };
  });
}

/** "▲ +1", "▼ -2" or "—" */
export function formatRankDelta(delta) {
  if (delta > 0) return `▲ +${delta}`;
  if (delta < 0) return `▼ ${delta}`;
  return "—";
}
