// ─── Draft Analysis Engine ────────────────────────────────────────────────────
// Post-draft "how does your lineup stack up?" scoring.
// Uses historical avg FERDA score at the same track type as the projection.
// Pure functions — no React, no Firebase.

import { SCHEDULE, PLAYERS } from "../constants.js";
import { getDriverStatsByTrackType } from "./narrative.js";

// Mulligan drivers earn finish position only (≈40 % of full value on average)
const MULLIGAN_DISCOUNT = 0.4;

export function analyzeLineups(weekPicks, week, data) {
  const weekInfo = SCHEDULE.find(s => s.w === week);
  if (!weekInfo) return null;

  const trackStats = getDriverStatsByTrackType(data, weekInfo.ty);
  if (!trackStats.length) return null;          // no history for this track type yet

  const statsMap = Object.fromEntries(trackStats.map(s => [s.name, s]));
  const racesOfType = Math.max(...trackStats.map(s => s.appearances), 0);

  // Build set of all picked drivers
  const allPickedDrivers = new Set(
    Object.values(weekPicks).flatMap(picks =>
      (picks || []).map(pk => pk.driver).filter(Boolean)
    )
  );

  // Per-player analysis
  const lineups = PLAYERS.map(p => {
    const picks = weekPicks[p.id] || [];
    const drivers = picks
      .filter(pk => pk.driver)
      .map(pk => {
        const stat = statsMap[pk.driver] || { avgScore: 0, appearances: 0 };
        return {
          driver:      pk.driver,
          isMulligan:  !!pk.mulligan,
          avgScore:    stat.avgScore,
          appearances: stat.appearances,
          // Mulligan-discounted projected contribution
          projected:   Math.round((pk.mulligan ? stat.avgScore * MULLIGAN_DISCOUNT : stat.avgScore) * 10) / 10,
        };
      })
      .sort((a, b) => b.avgScore - a.avgScore);

    const projectedTotal = Math.round(drivers.reduce((s, d) => s + d.projected, 0) * 10) / 10;

    return { ...p, drivers, projectedTotal };
  }).sort((a, b) => b.projectedTotal - a.projectedTotal);

  // Best driver left on the board (not in anyone's lineup)
  const bestAvailable = trackStats.find(s => !allPickedDrivers.has(s.name)) || null;

  // Per-player "best left on the board" — best unpicked driver they could have taken
  // (highest avg score that wasn't in *their* lineup specifically)
  const perPlayerMiss = {};
  PLAYERS.forEach(p => {
    const myDrivers = new Set((weekPicks[p.id] || []).map(pk => pk.driver).filter(Boolean));
    perPlayerMiss[p.id] = trackStats.find(s => !myDrivers.has(s.name)) || null;
  });

  return {
    week,
    raceName:    weekInfo.r,
    trackName:   weekInfo.t,
    trackType:   weekInfo.ty,
    racesOfType,
    lineups,
    bestAvailable,
    perPlayerMiss,
    maxProjected: lineups[0]?.projectedTotal || 1,
  };
}
