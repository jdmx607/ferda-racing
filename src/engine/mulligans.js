// ─── Mulligan allowance ──────────────────────────────────────────────────────
// 10 per season (regular season + playoffs only; exhibitions never allow them).
// A player who used NONE in the regular season (weeks before the Chase) earns
// PLAYOFF_MULLIGAN_BONUS extra for the playoffs.

import { MAX_MULLIGANS, PLAYOFF_MULLIGAN_BONUS, PLAYOFF_START_WEEK } from "../constants.js";

export function getMulliganAllowance(data, pid, currentWeek) {
  let used = 0, regularUsed = 0;
  // data.picks holds points weeks only — exhibitions are stored separately.
  Object.entries(data?.picks || {}).forEach(([key, wp]) => {
    const w = parseInt(key.replace("w", ""));
    const n = (wp?.[pid] || []).filter(pk => pk.mulligan).length;
    used += n;
    if (w < PLAYOFF_START_WEEK) regularUsed += n;
  });

  const inPlayoffs  = currentWeek >= PLAYOFF_START_WEEK;
  const cleanSoFar  = regularUsed === 0;
  const bonus       = PLAYOFF_MULLIGAN_BONUS && inPlayoffs && cleanSoFar ? PLAYOFF_MULLIGAN_BONUS : 0;
  const max         = MAX_MULLIGANS + bonus;

  return {
    used,
    regularUsed,
    max,
    bonus,                                   // bonus mulligans unlocked right now
    remaining: Math.max(0, max - used),
    // still-on-the-table bonus: regular season, no mulligan burned yet
    bonusAtStake: PLAYOFF_MULLIGAN_BONUS && !inPlayoffs && cleanSoFar ? PLAYOFF_MULLIGAN_BONUS : 0,
  };
}
