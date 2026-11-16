// ─── Chase war room (pure) ───────────────────────────────────────────────────
// The FRL Chase is one cumulative points race among all four managers (W27–36,
// no eliminations). This adds title-line math on top of getChaseTotals:
//   leader:   LOCKED IN (mathematically clinched) or SAFE (+lead)
//   trailers: ELIMINATED (mathematically out), MUST-WIN (needs more per race than a
//             typical weekly winning margin) or IN THE HUNT (−gap)
// NASCAR's round names label W27–36 for flavour only.

import { PLAYERS, PLAYOFF_START_WEEK } from "../constants.js";
import { getChaseTotals } from "./chase.js";

export const LAST_CHASE_WEEK = 36;
export const CHASE_ROUNDS = [
  { id: "r16",   label: "Round of 16",    from: 27, to: 29 },
  { id: "r12",   label: "Round of 12",    from: 30, to: 32 },
  { id: "r8",    label: "Round of 8",     from: 33, to: 35 },
  { id: "final", label: "Championship 4", from: 36, to: 36 },
];
export const chaseRound = w => CHASE_ROUNDS.find(r => w >= r.from && w <= r.to) || null;

const r1 = n => Math.round(n * 10) / 10;

/**
 * Season weekly swing stats: biggest single-week gap between any two managers
 * (the most anyone can realistically claw back in one race) and the average
 * weekly winning margin (1st over 2nd).
 */
export function weeklySwings(data) {
  let maxSwing = 0, marginSum = 0, n = 0;
  Object.values(data?.results || {}).forEach(wr => {
    const t = Object.values(wr?.scored || {}).map(s => s.total || 0).sort((a, b) => b - a);
    if (t.length < 2) return;
    maxSwing = Math.max(maxSwing, t[0] - t[t.length - 1]);
    marginSum += t[0] - t[1]; n++;
  });
  return { maxSwing: r1(maxSwing), avgMargin: n ? r1(marginSum / n) : 0 };
}

/**
 * { round, remaining, swings, rows:[{ pid, total, cut, status, needPerRace }] } sorted by total.
 * `cut` is +lead (leader, over 2nd) or −gap to the leader.
 */
export function getChaseWarRoom(data, { nextWeek } = {}) {
  const { totals } = getChaseTotals(data);
  const chaseWeeks = [];
  for (let w = PLAYOFF_START_WEEK; w <= LAST_CHASE_WEEK; w++) chaseWeeks.push(w);
  const remaining = chaseWeeks.filter(w => !data?.results?.["w" + w]?.scored).length;
  const upcoming = nextWeek ?? chaseWeeks.find(w => !data?.results?.["w" + w]?.scored) ?? LAST_CHASE_WEEK;
  const swings = weeklySwings(data);
  const reach = remaining * swings.maxSwing;

  const ranked = PLAYERS.map(p => ({ pid: p.id, total: r1(totals[p.id] || 0) })).sort((a, b) => b.total - a.total);
  const lead = ranked[0];
  const rows = ranked.map((r, i) => {
    if (i === 0) {
      const margin = r1(r.total - (ranked[1]?.total ?? r.total));
      const status = remaining === 0 ? "CHAMPION" : margin > reach ? "LOCKED IN" : "SAFE";
      return { ...r, cut: margin, status, needPerRace: 0 };
    }
    const gap = r1(lead.total - r.total);
    const needPerRace = remaining ? r1(gap / remaining) : null;
    const status = remaining === 0 ? "FINAL"
      : gap > reach ? "ELIMINATED"
      : needPerRace > swings.avgMargin ? "MUST-WIN"
      : "IN THE HUNT";
    return { ...r, cut: -gap, status, needPerRace };
  });
  return { round: chaseRound(upcoming), remaining, swings, rows };
}
