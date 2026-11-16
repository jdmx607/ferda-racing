// ─── What-if tools (pure) ────────────────────────────────────────────────────
// Mulligan swap preview + the "Optimal 5" hindsight ghost. Both reuse the real
// calcDriverScore (mulligan replacements score finish + net position only), so
// the numbers always match how a confirmed swap / a real lineup would score.

import { calcDriverScore } from "./scoring.js";
import { TRACK_MULTS, SCHEDULE } from "../constants.js";
import { getWeekBoard } from "../utils/gmRating.js";

const r1 = n => Math.round(n * 10) / 10;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const carOf = name => (String(name).match(/^#(\S+)\s/) || [])[1] || null;
export const sameCar = (a, b) => !!a && !!b && (a === b || (!!carOf(a) && carOf(a) === carOf(b)));
const tyOf = w => SCHEDULE.find(s => s.w === w)?.ty || "intermediate";

/** A scoreable driver line: the live/raw line if we have one, else a projection. */
export function projectedLine(name, raw, { finish, qualPos, lapsLed } = {}) {
  return {
    name, dnf: false, dq: false, pole: false, stageWin1: false, stageWin2: false, stageWin3: false,
    fastestLap: false, mostLapsLed: false, stage1: 0, stage2: 0, stage3: 0, lapsLed: 0,
    ...(raw || {}),
    ...(finish != null ? { finish } : {}),
    ...(qualPos != null ? { qualPos } : {}),
    ...(lapsLed != null ? { lapsLed } : {}),
  };
}

/**
 * Preview a mulligan: drop `dropped` (full scoring) for `replacement` (mulligan
 * scoring — finish + net position only, capped ±10).
 *   { dropPts, repPts, delta, mult, lapsLedPts, net, netRaw, netCapped, dropBreakdown, repBreakdown }
 */
export function simulateMulligan({ dropped, replacement, ty, threeStages = false }) {
  const drop = calcDriverScore(dropped, ty, false, threeStages);
  const rep = calcDriverScore(replacement, ty, true, threeStages);
  const mult = TRACK_MULTS[ty] || 0.5;
  const netRaw = replacement.qualPos && replacement.finish ? replacement.qualPos - replacement.finish : 0;
  const net = clamp(netRaw, -10, 10);
  return {
    dropPts: drop.total, repPts: rep.total, delta: r1(rep.total - drop.total),
    mult, lapsLedPts: r1((dropped.lapsLed || 0) * mult),
    net, netRaw, netCapped: net !== netRaw,
    dropBreakdown: drop.breakdown, repBreakdown: rep.breakdown,
  };
}

/**
 * "Optimal 5" hindsight ghost for one manager in one scored week: at each of their
 * real draft slots, the best-scoring driver still on the board (everyone else's
 * earlier picks gone, plus the ghost's own earlier picks).
 *   { picks:[{ k, round, driver, pts, actualDriver, actualPts }], total, actual, left } or null
 */
export function optimalLineup(data, week, pid) {
  const wr = data?.results?.["w" + week];
  if (!wr?.raw?.drivers?.length) return null;
  const board = getWeekBoard(data, week);
  const mine = board.filter(b => b.pid === pid).sort((a, b) => a.k - b.k);
  if (!mine.length) return null;
  const ty = tyOf(week), three = !!wr.raw.threeStages;
  const field = wr.raw.drivers.map(d => ({ name: d.name, pts: calcDriverScore(d, ty, false, three).total }));
  const ptsOf = name => field.find(f => sameCar(f.name, name))?.pts ?? 0;

  const ghost = [];
  const picks = mine.map(m => {
    const gone = board.filter(b => b.k < m.k && b.pid !== pid).map(b => b.driver);
    const best = field
      .filter(f => !gone.some(g => sameCar(g, f.name)) && !ghost.some(g => sameCar(g, f.name)))
      .sort((a, b) => b.pts - a.pts)[0];
    if (best) ghost.push(best.name);
    return { k: m.k, round: m.round, driver: best?.name || null, pts: best?.pts ?? 0, actualDriver: m.driver, actualPts: ptsOf(m.driver) };
  });
  const total = r1(picks.reduce((a, p) => a + p.pts, 0));
  const actual = r1(picks.reduce((a, p) => a + p.actualPts, 0));
  return { picks, total, actual, left: r1(total - actual) };
}
