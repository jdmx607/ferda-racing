// ─── Stats tab — derived views (pure) ────────────────────────────────────────
// New season views for the redesigned Stats tab: a driver's full profile (race
// log, track-type splits, top drafter), manager efficiency / loyalty, the
// head-to-head matrix, track specialists and draft trends. Scoring is reused
// (calcDriverScore / stored `scored` results), never re-implemented.

import { calcDriverScore } from "./scoring.js";
import { SCHEDULE, PLAYERS } from "../constants.js";

const round1 = n => Math.round(n * 10) / 10;
const tyOf = w => SCHEDULE.find(s => s.w === w)?.ty || "intermediate";
const raceOf = w => SCHEDULE.find(s => s.w === w) || null;
const carOf = name => (String(name).match(/^#(\S+)\s/) || [])[1] || null;
export const TRACK_TYPES = ["superspeedway", "short_track", "intermediate", "road_course"];

/** Scored weeks with raw results, oldest first: [{ w, key, wr }] */
export function scoredWeekList(data) {
  return Object.entries(data?.results || {})
    .filter(([, wr]) => wr?.raw?.drivers?.length)
    .map(([key, wr]) => ({ w: parseInt(key.replace("w", ""), 10), key, wr }))
    .sort((a, b) => a.w - b.w);
}

/** Active (non-garage) picks for a manager in a week, in draft-slot order. */
const picksOf = (data, key, pid) => (data?.picks?.[key]?.[pid] || []).filter(pk => !pk.garage && pk.driver);

/** Raw result line for a picked driver: exact name, else same car number. */
function findRaw(drivers, name) {
  const num = carOf(name);
  return drivers.find(d => d.name === name) || (num ? drivers.find(d => d.name.startsWith(`#${num} `)) : null) || null;
}

// ── Driver profile (bottom sheet) ────────────────────────────────────────────
/**
 * Everything the driver sheet shows:
 *   log      [{ week, race, track, ty, finish, qualPos, dnf, pts, pickedBy:[pid] }] newest first
 *   splits   { [trackType]: { races, avg } }
 *   drafters [{ pid, count, share }] most first;  top = drafters[0] or null
 *   races, total, avg, best
 */
export function getDriverProfile(data, name) {
  const log = [];
  const split = {};
  const drafted = {};
  scoredWeekList(data).forEach(({ w, key, wr }) => {
    const d = wr.raw.drivers.find(x => x.name === name);
    if (!d) return;
    const ty = tyOf(w);
    const pts = calcDriverScore(d, ty, false, !!wr.raw.threeStages).total;
    const pickedBy = PLAYERS.filter(p => (data.picks?.[key]?.[p.id] || []).some(pk => pk.driver === name)).map(p => p.id);
    pickedBy.forEach(pid => { drafted[pid] = (drafted[pid] || 0) + 1; });
    const ri = raceOf(w);
    log.push({ week: w, race: ri?.r || `Week ${w}`, track: ri?.t || "", ty, finish: d.finish, qualPos: d.qualPos, dnf: !!d.dnf, pts, pickedBy });
    const s = split[ty] || (split[ty] = { races: 0, sum: 0 });
    s.races++; s.sum += pts;
  });
  const splits = {};
  TRACK_TYPES.forEach(ty => {
    const s = split[ty];
    splits[ty] = s ? { races: s.races, avg: round1(s.sum / s.races) } : { races: 0, avg: null };
  });
  const totalPicks = Object.values(drafted).reduce((a, b) => a + b, 0);
  const drafters = Object.entries(drafted)
    .map(([pid, count]) => ({ pid, count, share: totalPicks ? Math.round((count / totalPicks) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
  const total = round1(log.reduce((a, r) => a + r.pts, 0));
  return {
    name, log: log.reverse(), splits, drafters, top: drafters[0] || null,
    races: log.length, total,
    avg: log.length ? round1(total / log.length) : 0,
    best: log.length ? Math.max(...log.map(r => r.pts)) : 0,
  };
}

// ── Manager efficiency & loyalty ─────────────────────────────────────────────
/**
 * Per manager:
 *   weeks, avg (weekly score), lateRoundPts / lateRoundAvg (points from draft slots 4 & 5),
 *   starts, dnfs, dnfRate (% of their drivers who DNF'd), rideOrDie { driver, count, pts }
 * Slots come from the saved picks order (= draft order; a mulligan keeps its slot).
 */
export function getManagerEfficiency(data) {
  const weeks = scoredWeekList(data).filter(x => x.wr.scored);
  return PLAYERS.map(p => {
    let n = 0, sum = 0, late = 0, starts = 0, dnfs = 0;
    const loyal = {};   // driver → { count, pts }
    weeks.forEach(({ key, wr }) => {
      const s = wr.scored?.[p.id];
      if (!s) return;
      n++; sum += s.total || 0;
      const ds = s.drivers || [];
      ds.forEach((d, i) => {
        if (i >= 3 && i <= 4) late += d.total || 0;
        if (d.dnr) return;
        starts++;
        const r = findRaw(wr.raw.drivers, d.driver);
        if (r?.dnf) dnfs++;
      });
      picksOf(data, key, p.id).forEach(pk => {
        const l = loyal[pk.driver] || (loyal[pk.driver] = { count: 0, pts: 0 });
        l.count++;
        const sd = ds.find(d => d.driver === pk.driver);
        if (sd) l.pts += sd.total || 0;
      });
    });
    const top = Object.entries(loyal).sort((a, b) => b[1].count - a[1].count || b[1].pts - a[1].pts)[0];
    return {
      id: p.id, name: p.name, weeks: n,
      avg: n ? round1(sum / n) : 0,
      lateRoundPts: round1(late), lateRoundAvg: n ? round1(late / n) : 0,
      starts, dnfs, dnfRate: starts ? round1((dnfs / starts) * 100) : 0,
      rideOrDie: top ? { driver: top[0], count: top[1].count, pts: round1(top[1].pts) } : null,
    };
  });
}

/** Weekly head-to-head records: h2h[a][b] = { w, l, t } (a's record against b). */
export function getHeadToHead(data) {
  const h = {};
  PLAYERS.forEach(a => { h[a.id] = {}; PLAYERS.forEach(b => { if (a.id !== b.id) h[a.id][b.id] = { w: 0, l: 0, t: 0 }; }); });
  scoredWeekList(data).forEach(({ wr }) => {
    const s = wr.scored;
    if (!s) return;
    PLAYERS.forEach(a => PLAYERS.forEach(b => {
      if (a.id === b.id || s[a.id] == null || s[b.id] == null) return;
      const d = (s[a.id].total || 0) - (s[b.id].total || 0);
      const rec = h[a.id][b.id];
      if (d > 0) rec.w++; else if (d < 0) rec.l++; else rec.t++;
    }));
  });
  return h;
}

// ── Track specialists ────────────────────────────────────────────────────────
/** Best drivers at one track type by average FERDA points (min `min` races there). */
export function getTrackSpecialists(data, ty, { min = 2, n = 10 } = {}) {
  const acc = {};
  scoredWeekList(data).forEach(({ w, wr }) => {
    if (tyOf(w) !== ty) return;
    wr.raw.drivers.forEach(d => {
      const pts = calcDriverScore(d, ty, false, !!wr.raw.threeStages).total;
      const a = acc[d.name] || (acc[d.name] = { name: d.name, races: 0, total: 0, best: 0, wins: 0, top5: 0 });
      a.races++; a.total += pts; a.best = Math.max(a.best, pts);
      if (d.finish === 1) a.wins++;
      if (d.finish > 0 && d.finish <= 5) a.top5++;
    });
  });
  const racesHeld = scoredWeekList(data).filter(x => tyOf(x.w) === ty).length;
  const need = Math.min(min, Math.max(1, racesHeld));
  return Object.values(acc)
    .filter(a => a.races >= need)
    .map(a => ({ ...a, total: round1(a.total), avg: round1(a.total / a.races) }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, n);
}

// ── Draft trends ─────────────────────────────────────────────────────────────
/**
 * firstRound   [{ name, count }]          drivers taken with a manager's first pick most often
 * lateValue    [{ name, pid, pts, week }] best single scores from draft slots 4–5
 * mostDrafted  [{ name, count, ppp }]     most picks overall, with points per pick
 */
export function getDraftTrends(data, n = 6) {
  const first = {}, most = {};
  const late = [];
  scoredWeekList(data).forEach(({ w, key, wr }) => {
    PLAYERS.forEach(p => {
      const picks = picksOf(data, key, p.id);
      if (picks[0]) first[picks[0].driver] = (first[picks[0].driver] || 0) + 1;
      const ds = wr.scored?.[p.id]?.drivers || [];
      picks.forEach((pk, i) => {
        const sd = ds.find(d => d.driver === pk.driver);
        const m = most[pk.driver] || (most[pk.driver] = { name: pk.driver, count: 0, pts: 0 });
        m.count++; m.pts += sd?.total || 0;
        if (i >= 3 && i <= 4 && sd && !sd.dnr) late.push({ name: pk.driver, pid: p.id, pts: sd.total, week: w });
      });
    });
  });
  return {
    firstRound: Object.entries(first).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, n),
    lateValue: late.sort((a, b) => b.pts - a.pts).slice(0, n),
    mostDrafted: Object.values(most)
      .map(m => ({ name: m.name, count: m.count, ppp: m.count ? round1(m.pts / m.count) : 0 }))
      .sort((a, b) => b.count - a.count || b.ppp - a.ppp).slice(0, n),
  };
}

// ── Leaderboard helpers ──────────────────────────────────────────────────────
export const SORTS = [
  { key: "totalFerdaPts", label: "Total Pts",    short: "TOT"  },
  { key: "avgScore",      label: "Avg / Race",   short: "AVG"  },
  { key: "bestScore",     label: "Best Race",    short: "BEST" },
  { key: "pickCount",     label: "Times Picked", short: "PICKS" },
];

/** Primary metric text for the active sort + the secondary line ("55.7 AVG • 145.5 BEST"). */
export function leaderboardMetrics(s, sortKey) {
  const f = v => (Math.round((v || 0) * 10) / 10).toFixed(1);
  const all = { totalFerdaPts: `${f(s.totalFerdaPts)} TOT`, avgScore: `${f(s.avgScore)} AVG`, bestScore: `${f(s.bestScore)} BEST` };
  const primary = sortKey === "pickCount" ? String(s.pickCount) : f(s[sortKey]);
  const rest = ["totalFerdaPts", "avgScore", "bestScore"].filter(k => k !== sortKey).slice(0, 2).map(k => all[k]);
  return { primary, unit: sortKey === "pickCount" ? (s.pickCount === 1 ? "pick" : "picks") : null, secondary: rest.join(" • ") };
}
