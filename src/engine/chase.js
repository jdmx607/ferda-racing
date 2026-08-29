// ─── Chase math ────────────────────────────────────────────────────────────
// Shared source of truth for "what's the Chase-entering total for each
// player" — used both to display Chase standings and to determine the W27
// (inverse) draft order, so the two can never drift apart.

import { PLAYERS, PLAYOFF_START_WEEK } from "../constants.js";

// Regular-season champion bonus: 90% of the league's average weekly score,
// pooling every player's weekly total across the regular season only
// (weeks 1 through PLAYOFF_START_WEEK-1). Recomputed live from current
// data rather than frozen at the W26->W27 transition, so a commissioner
// fixing a past week's score naturally corrects the bonus too.
export function getChampBonus(data) {
  let sum = 0, count = 0;
  Object.entries(data.results || {}).forEach(([key, wr]) => {
    const w = parseInt(key.replace("w", ""));
    if (w >= PLAYOFF_START_WEEK || !wr.scored) return;
    Object.values(wr.scored).forEach(s => { sum += s.total; count++; });
  });
  if (count === 0) return 0;
  return Math.round((sum / count) * 0.9);
}

// Each player's Chase-entering total: 1,000 base + accumulated regular-season
// bonus/win points (meta.playoffPts, frozen at week 26) + the champion bonus
// for the regular-season leader (data.meta.standings, also frozen at week 26).
// This is the anchor Chase-week scoring (meta.chasePts) adds on top of.
export function getChaseEntryTotals(data) {
  const standings = PLAYERS.map(p => ({ id: p.id, pts: data.meta?.standings?.[p.id] || 0 }))
    .sort((a, b) => b.pts - a.pts);
  const leader = standings[0]?.id;
  const isTied = standings.length > 1 && standings[0]?.pts === standings[1]?.pts;
  const champBonus = getChampBonus(data);

  const totals = {};
  PLAYERS.forEach(p => {
    const pp = data.meta?.playoffPts?.[p.id] || 0;
    const bonus = (p.id === leader && !isTied) ? champBonus : 0;
    totals[p.id] = 1000 + pp + bonus;
  });
  return { totals, leader, isTied, champBonus };
}

// Current Chase total: entry total + accumulated Chase-week scoring so far.
export function getChaseTotals(data) {
  const { totals, leader, isTied, champBonus } = getChaseEntryTotals(data);
  const combined = {};
  PLAYERS.forEach(p => {
    combined[p.id] = totals[p.id] + (data.meta?.chasePts?.[p.id] || 0);
  });
  return { totals: combined, entryTotals: totals, leader, isTied, champBonus };
}
