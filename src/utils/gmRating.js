// ─── Pit-Box GM Rating & Draft Efficiency (pure) ─────────────────────────────
// Grades each manager's front-office work every completed race week:
//   VOPE (40%)      draft value over pick expectation
//   Scouting (25%)  late-round track reads + qualifying (P20+ gaining 10+ spots)
//   Execution (20%) roster floor: clean sheets, top-15s, DNFs, mulligans
//   Finish (15%)    weekly placement + back-of-draft winner bonus
// …then a 4-race recency-weighted Rolling GM Rating (40/30/20/10) with tiers.
//
// Read-only: works off stored results / picks / drafts and reuses calcDriverScore;
// scoring rules, pick histories and the league doc are never modified.

import { PLAYERS, SCHEDULE } from "../constants.js";
import { calcDriverScore } from "../engine/scoring.js";
import { getDraftOrder } from "../engine/draft.js";

export const WEIGHTS = { vope: 0.40, scouting: 0.25, execution: 0.20, finish: 0.15 };
export const ROLLING_WEIGHTS = [0.4, 0.3, 0.2, 0.1];            // most recent first
export const PLACE_SCORE = [90, 70, 50, 30];
// Tag thresholds, tuned on the 2026 season so each tag is rare (≈ top 10% of all
// picks for STEAL, ≈ bottom 10–12% of round 1–2 picks for BUST).
export const STEAL_DELTA = 45;
export const BUST_DELTA = -60;
export const BUST_MAX_PICK = 8;                                    // rounds 1–2
export const MANAGERS = PLAYERS.length;                            // 4

const clamp = (v, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
const r1 = n => Math.round(n * 10) / 10;
const tyOf = w => SCHEDULE.find(s => s.w === w)?.ty || "intermediate";
const carOf = name => (String(name).match(/^#(\S+)\s/) || [])[1] || null;

/**
 * Raw expected fantasy points for overall pick k on a linear curve (pick 1 ≈ the
 * week's best). scoreGmWeek re-centres this curve on the week's actual average so
 * the 20 picks sum to zero over expectation — the raw curve sits above nearly
 * every pick (scores are right-skewed), which pinned VOPE at 0 for everyone.
 */
export function expectedPts(k, maxScore, minScore, n = 20) {
  const span = Math.max(1, n - 1);
  return maxScore - ((k - 1) / span) * (maxScore - minScore) * 0.75;
}

export function tierFor(rating) {
  if (rating >= 90) return { id: "crew-chief", label: "CREW CHIEF",     tone: "gold" };
  if (rating >= 80) return { id: "contender",  label: "CONTENDER",      tone: "emerald" };
  if (rating >= 70) return { id: "mid-pack",   label: "MID-PACK",       tone: "slate" };
  return               { id: "rebuild",    label: "GARAGE REBUILD", tone: "crimson" };
}

export const pickLabel = (k, round) => `Pick #${k} • R${round}`;

// ── The draft board for one week ─────────────────────────────────────────────
/**
 * The week's drafted picks in overall order:
 *   [{ k, pid, round, seed, driver, mulligan }]
 * `driver` is the ORIGINALLY drafted driver (a mulligan's replacement is mapped
 * back via the mulligan log). Uses the stored draft log when it has the full
 * board; otherwise rebuilds it from the week's draft order + saved slot order
 * (the league drafts the same order every round).
 */
export function getWeekBoard(data, week) {
  const key = "w" + week;
  const picks = data?.picks?.[key] || {};
  const mullOf = (pid, driver) => (data?.mulligans?.[pid] || []).find(m => m.week === week && m.replacement === driver);
  const slotsOf = pid => (picks[pid] || []).filter(pk => !pk.garage && pk.driver);
  const usedMull = pid => slotsOf(pid).some(pk => pk.mulligan) || (data?.mulligans?.[pid] || []).some(m => m.week === week);
  const expectedCount = PLAYERS.reduce((a, p) => a + slotsOf(p.id).length, 0);

  const log = (data?.drafts?.[key] || []).filter(d => d && d.pid && d.driver);
  if (log.length && log.length >= expectedCount) {
    return log.slice().sort((a, b) => a.pickNum - b.pickNum).map((d, i) => {
      const n = Number.isFinite(d.pickNum) ? d.pickNum : i;
      return { k: n + 1, pid: d.pid, round: Math.floor(n / MANAGERS) + 1, seed: (n % MANAGERS) + 1, driver: d.driver, mulligan: usedMull(d.pid) };
    });
  }

  const order = getDraftOrder(data, week);
  const board = [];
  order.forEach((pid, seedIdx) => {
    slotsOf(pid).forEach((pk, i) => {
      const m = pk.mulligan ? mullOf(pid, pk.driver) : null;
      board.push({
        k: i * MANAGERS + seedIdx + 1, pid, round: i + 1, seed: seedIdx + 1,
        driver: m ? m.driver : pk.driver, mulligan: usedMull(pid),
      });
    });
  });
  return board.sort((a, b) => a.k - b.k);
}

function findRaw(drivers, name) {
  const num = carOf(name);
  return drivers.find(d => d.name === name) || (num ? drivers.find(d => d.name.startsWith(`#${num} `)) : null) || null;
}

// ── One week ─────────────────────────────────────────────────────────────────
/**
 * GM scores for one completed week, or null if it can't be graded.
 *   { week, picks:[{ k, pid, round, seed, driver, pts, expected, delta, steal, bust,
 *                    finish, qualPos, dnf, dnr }],
 *     managers: { [pid]: { gm, vopeScore, totalVOPE, scouting, execution, finish,
 *                          placement, seed, backRowWin, mulligan, dnfs, top15,
 *                          bestValue, steals, busts } } }
 */
export function scoreGmWeek(data, week) {
  const wr = data?.results?.["w" + week];
  if (!wr?.scored || !wr?.raw?.drivers?.length) return null;
  const board = getWeekBoard(data, week);
  if (board.length < 2) return null;

  const ty = tyOf(week);
  const three = !!wr.raw.threeStages;
  const picks = board.map(b => {
    const raw = findRaw(wr.raw.drivers, b.driver);
    const pts = raw ? calcDriverScore(raw, ty, false, three).total : 0;
    return {
      ...b, pts,
      finish: raw?.finish > 0 ? raw.finish : null,
      qualPos: raw?.qualPos > 0 ? raw.qualPos : null,
      dnf: !!raw?.dnf, dnr: !raw,
    };
  });

  // Step 1 — pick-slot expectation curve (same slope, centred on the week's average)
  const sorted = picks.map(p => p.pts).sort((a, b) => b - a);
  const maxScore = sorted[0], minScore = sorted[sorted.length - 1];
  const rawExp = picks.map(p => expectedPts(p.k, maxScore, minScore, picks.length));
  const shift = picks.reduce((a, p) => a + p.pts, 0) / picks.length - rawExp.reduce((a, b) => a + b, 0) / picks.length;
  picks.forEach((p, i) => {
    p.expected = r1(rawExp[i] + shift);
    p.delta = r1(p.pts - p.expected);
    p.steal = p.delta >= STEAL_DELTA;
    p.bust = p.k <= BUST_MAX_PICK && p.delta <= BUST_DELTA;
  });

  // Step 4 — weekly placement (weeklyWin flag first, then total)
  const placed = Object.entries(wr.scored).sort((a, b) =>
    (b[1].weeklyWin ? 1 : 0) - (a[1].weeklyWin ? 1 : 0) || (b[1].total || 0) - (a[1].total || 0));
  const placeOf = pid => placed.findIndex(([id]) => id === pid);

  const managers = {};
  PLAYERS.forEach(p => {
    const mine = picks.filter(x => x.pid === p.id);
    if (!mine.length || !wr.scored[p.id]) return;

    const totalVOPE = r1(mine.reduce((a, x) => a + x.delta, 0));
    const vopeScore = clamp(50 + totalVOPE * 0.6);

    // Step 2 — scouting IQ
    let scouting = 50;
    mine.forEach(x => {
      if (x.k >= 9 && x.finish && x.finish <= 10) scouting += 12;
      if (x.qualPos >= 20 && x.finish && x.qualPos - x.finish >= 10) scouting += 10;
    });
    scouting = clamp(scouting);

    // Step 3 — roster floor & clean execution
    const dnfs = mine.filter(x => x.dnf).length;
    const top15 = mine.filter(x => x.finish && x.finish <= 15).length;
    const mulligan = mine.some(x => x.mulligan);
    let execution = 50 + (dnfs === 0 ? 20 : 0) + Math.min(30, top15 * 6) - 15 * dnfs - (mulligan ? 15 : 0);
    execution = clamp(execution);

    // Step 4 — finish + back-row winner bonus
    const place = placeOf(p.id);
    const seed = mine[0].seed;
    const backRowWin = place === 0 && seed === MANAGERS;
    const finish = clamp((PLACE_SCORE[place] ?? 30) + (backRowWin ? 10 : 0));

    const gm = r1(WEIGHTS.vope * vopeScore + WEIGHTS.scouting * scouting + WEIGHTS.execution * execution + WEIGHTS.finish * finish);
    const best = mine.slice().sort((a, b) => b.delta - a.delta)[0];

    managers[p.id] = {
      gm, totalVOPE, vopeScore: r1(vopeScore), scouting, execution, finish,
      placement: place + 1, seed, backRowWin, mulligan, dnfs, top15,
      bestValue: best ? { driver: best.driver, k: best.k, round: best.round, delta: best.delta, pts: best.pts } : null,
      steals: mine.filter(x => x.steal).map(x => x.driver),
      busts: mine.filter(x => x.bust).map(x => x.driver),
    };
  });

  return { week, picks, managers };
}

// ── Season / rolling ─────────────────────────────────────────────────────────
/** Recency-weighted mean of the last 4 values (oldest → newest input), normalised. */
export function rollingAverage(values, weights = ROLLING_WEIGHTS) {
  const recent = values.slice(-weights.length).reverse();       // newest first
  if (!recent.length) return 0;
  let sum = 0, w = 0;
  recent.forEach((v, i) => { sum += v * weights[i]; w += weights[i]; });
  return sum / w;
}

const PILLARS = ["vopeScore", "scouting", "execution", "finish"];

function summarise(weeks) {
  const out = {};
  PLAYERS.forEach(p => {
    const mine = weeks.map(w => w.managers[p.id]).filter(Boolean);
    const gms = mine.map(m => m.gm);
    const pillar = (fn) => Object.fromEntries(PILLARS.map(k => [k, r1(fn(mine.map(m => m[k])))]));
    out[p.id] = {
      races: mine.length,
      rolling: r1(rollingAverage(gms)),
      season: gms.length ? r1(gms.reduce((a, b) => a + b, 0) / gms.length) : 0,
      rollingPillars: pillar(v => rollingAverage(v)),
      seasonPillars: pillar(v => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0)),
    };
  });
  return out;
}

const rankBy = (sum, key) => {
  const ids = PLAYERS.map(p => p.id).filter(id => sum[id].races > 0)
    .sort((a, b) => sum[b][key] - sum[a][key] || a.localeCompare(b));
  return Object.fromEntries(ids.map((id, i) => [id, i + 1]));
};

/**
 * Full GM picture:
 *   weeks   [scoreGmWeek…] oldest → newest;  byWeek { [week]: weekResult }
 *   managers [{ id, name, races, rolling, season, tier, seasonTier, rank, seasonRank,
 *               delta, seasonDelta, rollingPillars, seasonPillars, last }] sorted by rolling
 *   rank deltas compare against the same table one week earlier (▲ positive = climbed).
 */
export function getGmRatings(data) {
  const weekNums = Object.keys(data?.results || {})
    .map(k => parseInt(k.replace("w", ""), 10)).filter(Number.isFinite).sort((a, b) => a - b);
  const weeks = weekNums.map(w => scoreGmWeek(data, w)).filter(Boolean);
  const byWeek = Object.fromEntries(weeks.map(w => [w.week, w]));

  const now = summarise(weeks);
  const prev = summarise(weeks.slice(0, -1));
  const rank = rankBy(now, "rolling"), prevRank = weeks.length > 1 ? rankBy(prev, "rolling") : {};
  const sRank = rankBy(now, "season"), prevSRank = weeks.length > 1 ? rankBy(prev, "season") : {};

  const managers = PLAYERS.filter(p => now[p.id].races > 0).map(p => {
    const s = now[p.id];
    const lastWeek = [...weeks].reverse().find(w => w.managers[p.id]);
    return {
      id: p.id, name: p.name, ...s,
      tier: tierFor(s.rolling), seasonTier: tierFor(s.season),
      rank: rank[p.id], seasonRank: sRank[p.id],
      delta: prevRank[p.id] ? prevRank[p.id] - rank[p.id] : 0,
      seasonDelta: prevSRank[p.id] ? prevSRank[p.id] - sRank[p.id] : 0,
      last: lastWeek ? { week: lastWeek.week, ...lastWeek.managers[p.id] } : null,
    };
  }).sort((a, b) => a.rank - b.rank);

  return { weeks, byWeek, managers };
}

/** "▲ +1" / "▼ -1" / "—" */
export const formatGmDelta = d => (d > 0 ? `▲ +${d}` : d < 0 ? `▼ ${d}` : "—");
