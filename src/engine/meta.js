// ─── League meta (standings / playoff pts / Chase pts) ───────────────────────
// Re-derives d.meta from d.results (+ the All-Star exhibition). Mutates `d`.

import { PLAYERS, PLAYOFF_START_WEEK, ALL_STAR_PAYOUT } from "../constants.js";
import { ALL_STAR_WEEK } from "../exhibitions.js";

const round2 = x => Math.round(x * 100) / 100;

// Playoff points each player earns from the All-Star Race, by rank on score.
// Players tied on score split the payouts for the places they share.
export function allStarPayouts(scored) {
  const rows = Object.entries(scored)
    .map(([pid, s]) => ({ pid, total: s.total || 0 }))
    .sort((a, b) => b.total - a.total);
  const out = {};
  let i = 0;
  while (i < rows.length) {
    let j = i;
    while (j + 1 < rows.length && rows[j + 1].total === rows[i].total) j++;
    const slots = ALL_STAR_PAYOUT.slice(i, j + 1);
    const share = slots.reduce((a, b) => a + b, 0) / (j - i + 1);
    for (let k = i; k <= j; k++) out[rows[k].pid] = share;
    i = j + 1;
  }
  return out;
}

export function recalcMeta(d) {
  // Regular season (weeks 1-26): full total -> standings, bonus/win pts -> playoffPts.
  // Both freeze once the Chase starts — Chase weeks accumulate separately below,
  // so a player's "Chase entering total" (1000+playoffPts+champBonus) stays a
  // fixed anchor instead of drifting as more Chase weeks get scored.
  const zero = () => Object.fromEntries(PLAYERS.map(p => [p.id, 0]));
  const fs = zero(), fp2 = zero();
  // Chase weeks (27+): FULL score counts (not just bonus points), plus weekly win bonus.
  const cp = zero();
  let last = 0;

  // d.results holds points weeks only — exhibitions live in d.exhibitions,
  // so the Clash/All-Star can never reach the standings.
  Object.entries(d.results || {}).forEach(([key, wr]) => {
    const w = parseInt(key.replace("w", ""));
    if (w > last) last = w;
    if (!wr.scored) return;
    const isChaseWeek = w >= PLAYOFF_START_WEEK;
    Object.entries(wr.scored).forEach(([pid, s]) => {
      if (isChaseWeek) {
        cp[pid] = round2(cp[pid] + s.total + (s.weeklyWin ? 25 : 0));
      } else {
        fs[pid]  = round2(fs[pid] + s.total);
        fp2[pid] = round2(fp2[pid] + (s.bonusPoints || 0));
        if (s.weeklyWin) fp2[pid] = round2(fp2[pid] + 25);
      }
    });
  });

  // All-Star Race: NOT part of the standings. Players are ranked by their
  // All-Star score and paid into playoff points: 125 / 50 / 10 / 0.
  const allStar = d.exhibitions?.results?.["w" + ALL_STAR_WEEK]?.scored;
  if (allStar) {
    const payouts = allStarPayouts(allStar);
    Object.entries(payouts).forEach(([pid, pts]) => {
      if (pid in fp2) fp2[pid] = round2(fp2[pid] + pts);
    });
  }

  const mc = zero();
  Object.entries(d.picks || {}).forEach(([, wp]) => {
    Object.entries(wp).forEach(([pid, pks]) => { (pks || []).forEach(pk => { if (pk.mulligan) mc[pid]++; }); });
  });

  // ISC champion bonus: +25 regular-season pts for every player who correctly picked the champion
  const iscChamp = d.iscBracket?.results?.CHAMP;
  if (iscChamp) {
    PLAYERS.forEach(p => {
      if (d.iscBracket?.picks?.[p.id]?.CHAMP === iscChamp) fs[p.id] = round2(fs[p.id] + 25);
    });
  }

  d.meta.standings = fs; d.meta.playoffPts = fp2; d.meta.chasePts = cp;
  d.meta.lastScoredWeek = last; d.meta.mulligansUsed = mc;
}
