// ─── Live tab — derived view data (pure) ─────────────────────────────────────
// Everything the pit-box live monitor shows that isn't already computed: the
// 4-player standings with points-back, per-driver telemetry rows, stage status,
// fastest-lap pill and the race-control event log. Live SCORING is untouched —
// owned drivers' points come straight from scoreWeekFull (liveScores) and
// everyone else is scored with the same calcDriverScore.

import { SCHEDULE } from "../constants.js";
import { calcDriverScore } from "./scoring.js";

const round1 = n => Math.round(n * 10) / 10;
export const carNum = name => (String(name).match(/^#(\S+)/) || [])[1] || null;

/** 31.42 → "31.42s";  63.5 → "1:03.50" */
export function fmtLapTime(secs) {
  if (!(secs > 0)) return "—";
  if (secs >= 60) return `${Math.floor(secs / 60)}:${(secs % 60).toFixed(2).padStart(5, "0")}`;
  return `${secs.toFixed(2)}s`;
}

/** "+64.5" / "0" / "-3" */
export const fmtPts = n => (n > 0 ? "+" : "") + (Math.round(n * 10) / 10);

// ── Race status ──────────────────────────────────────────────────────────────
/** Fastest lap currently on the board: { carNumber, driver, time } or null. */
export function getFastestLap(vehicles) {
  let best = null;
  (vehicles || []).forEach(v => {
    if (v.bestLap > 0 && (!best || v.bestLap < best.time)) best = { carNumber: v.carNumber, driver: v.driver, time: v.bestLap };
  });
  return best;
}

/**
 * Stage status from the feed's stage block ({ stage_num, finish_at_lap }):
 *   { num, final, lapsLeft, label: "STAGE 2 • 23 LAPS LEFT" } or null.
 */
export function getStageStatus(timing) {
  const st = timing?.stage;
  if (!st?.stage_num) return null;
  const lapsInRace = timing.lapsInRace || 0;
  const finishAt = st.finish_at_lap || 0;
  const final = lapsInRace > 0 && (finishAt === 0 || finishAt >= lapsInRace);
  const endLap = final ? lapsInRace : finishAt;
  const lapsLeft = endLap > 0 ? Math.max(0, endLap - (timing.lapNumber || 0)) : null;
  const name = final ? "FINAL STAGE" : `STAGE ${st.stage_num}`;
  return {
    num: st.stage_num, final, lapsLeft,
    label: lapsLeft == null ? name : `${name} • ${lapsLeft} LAP${lapsLeft === 1 ? "" : "S"} LEFT`,
  };
}

/** Show the dashed "stage points cutoff" under P10 only while a non-final stage 1/2 is running. */
export const showStageCutoff = status => !!status && !status.final && status.num <= 2;

// ── Intervals ────────────────────────────────────────────────────────────────
/**
 * Interval-to-leader text per car: { [carNumber]: { text, secs, lapsDown } }.
 * The feed's `delta` is read as the gap to the leader; if the lead-lap values
 * don't climb with running order (i.e. they're really gaps to the car ahead) they
 * are accumulated instead. Lapped cars show "-1L"; the leader shows "LEAD".
 */
export function normalizeIntervals(vehicles) {
  const vs = (vehicles || []).filter(v => v.position > 0).slice().sort((a, b) => a.position - b.position);
  const out = {};
  if (!vs.length) return out;
  const leaderLaps = vs[0].lapsComp || 0;
  const lead = vs.filter(v => ((leaderLaps - (v.lapsComp || 0)) <= 0));
  const gaps = lead.slice(1).map(v => Math.abs(v.delta || 0));
  const toLeader = gaps.every((g, i) => i === 0 || g + 0.001 >= gaps[i - 1]);
  let running = 0;
  vs.forEach((v, i) => {
    const lapsDown = Math.max(0, leaderLaps - (v.lapsComp || 0));
    if (i === 0) { out[v.carNumber] = { text: "LEAD", secs: 0, lapsDown: 0 }; return; }
    if (lapsDown > 0) { out[v.carNumber] = { text: `-${lapsDown}L`, secs: null, lapsDown }; return; }
    const d = Math.abs(v.delta || 0);
    const secs = toLeader ? d : (running += d);
    out[v.carNumber] = { text: secs > 0 ? `+${secs >= 100 ? secs.toFixed(0) : secs.toFixed(1)}s` : "—", secs: secs > 0 ? secs : null, lapsDown: 0 };
  });
  return out;
}

// ── Standings ────────────────────────────────────────────────────────────────
/**
 * Live 4-player leaderboard: [{ id, name, pts, back, pct, drivers }] sorted by live
 * points. `back` is points behind P1 (0 for the leader); `pct` (0-100) sizes the bar.
 */
export function buildStandings(players, liveScores) {
  const rows = players.map(p => ({
    id: p.id, name: p.name,
    pts: liveScores?.[p.id]?.total || 0,
    drivers: liveScores?.[p.id]?.drivers || [],
  })).sort((a, b) => b.pts - a.pts);
  const top = rows[0]?.pts || 0;
  return rows.map(r => ({
    ...r,
    back: round1(top - r.pts),
    pct: top > 0 ? Math.max(0, Math.min(100, (r.pts / top) * 100)) : 0,
  }));
}

// ── Driver rows ──────────────────────────────────────────────────────────────
/**
 * One telemetry row per driver, in running order:
 *   { key, num, name, driver, pos, start, posDelta, interval, pit, dnf, pts, owners, breakdown,
 *     mull, dnr, lastLap, bestLap, lastSpeed, lapsLed }
 * Sources: timing.vehicles (full field), raceInfo.positions / raceInfo.raw (scoring feed),
 * liveScores (owned drivers' official live points).
 */
export function buildDriverRows({ timing, raceInfo, liveScores, week }) {
  const ty = SCHEDULE.find(s => s.w === week)?.ty || "intermediate";
  const three = !!raceInfo?.raw?.threeStages;
  const positions = raceInfo?.positions || {};
  const rawByCar = {};
  (raceInfo?.raw?.drivers || []).forEach(d => { const k = carNum(d.name); if (k) rawByCar[k] = d; });

  // who owns what (and the official score for it)
  const owned = {};   // car → { name, owners:[pid], total, breakdown, mull, dnr }
  Object.entries(liveScores || {}).forEach(([pid, s]) => (s.drivers || []).forEach(d => {
    const k = carNum(d.driver);
    if (!k) return;
    const o = owned[k] || (owned[k] = { name: d.driver, owners: [], total: d.total, breakdown: d.breakdown || [], mull: false, dnr: !!d.dnr });
    if (!o.owners.includes(pid)) o.owners.push(pid);
    if (d.isMulligan) o.mull = true;
  }));

  const intervals = normalizeIntervals(timing?.vehicles);
  const rows = [];
  const seen = new Set();

  const make = (k, v) => {
    seen.add(k);
    const raw = rawByCar[k];
    const o = owned[k];
    const p = positions[k];
    const pos = v?.position > 0 ? v.position : (p?.finish > 0 ? p.finish : null);
    const start = p?.start > 0 ? p.start : (v?.startPos > 0 ? v.startPos : null);
    const name = o?.name || raw?.name || `#${k} ${v?.driver || ""}`.trim();
    const pts = o ? o.total : raw ? calcDriverScore(raw, ty, false, three).total : null;
    const iv = intervals[k];
    return {
      key: k, num: k, name, driver: String(name).replace(/^#\S+\s*/, ""),
      pos, start,
      posDelta: pos && start ? start - pos : null,
      interval: v && v.isOnTrack === false ? "PIT" : (iv?.text ?? null),
      pit: !!v && v.isOnTrack === false,
      dnf: !!p?.dnf, dnr: !!o?.dnr,
      pts,
      owners: o?.owners || [],
      breakdown: (o?.breakdown || (raw ? calcDriverScore(raw, ty, false, three).breakdown : [])).filter(b => b.pts !== 0),
      mull: !!o?.mull,
      lastLap: v?.lastLap || 0, bestLap: v?.bestLap || 0, lastSpeed: v?.lastSpeed || 0, lapsLed: v?.lapsLed || 0,
    };
  };

  if (timing?.vehicles?.length) timing.vehicles.forEach(v => { if (v.carNumber && !seen.has(v.carNumber)) rows.push(make(v.carNumber, v)); });
  else Object.keys(rawByCar).forEach(k => rows.push(make(k, null)));
  // owned drivers the feeds don't list (did not race)
  Object.keys(owned).forEach(k => { if (!seen.has(k)) rows.push(make(k, null)); });

  return rows.sort((a, b) => (a.pos ?? 999) - (b.pos ?? 999) || a.num.localeCompare(b.num, undefined, { numeric: true }));
}

export const FILTERS = [
  { id: "mine", label: "My 5 Drivers" },
  { id: "drafted", label: "All 20 Drafted" },
  { id: "field", label: "Full Field" },
];

export function filterRows(rows, filter, playerId) {
  if (filter === "mine") return rows.filter(r => r.owners.includes(playerId));
  if (filter === "drafted") return rows.filter(r => r.owners.length > 0);
  return rows;
}

// ── Race-control event log ───────────────────────────────────────────────────
const FLAG_EVENT = { 2: ["Caution", "caution"], 3: ["Red flag", "stop"], 4: ["White flag — final lap", "go"], 5: ["Checkered flag", "go"] };
const short = (carNumber, driver) => `#${carNumber} ${String(driver || "").trim().split(/\s+/).slice(-1)[0] || ""}`.trim();

/**
 * Key events between two timing snapshots (30s apart):
 *   { kind: "flag"|"caution"|"lead"|"stage"|"fastest", tone, lap, text, car? }
 * No events for the very first snapshot (nothing to compare against).
 */
export function diffTimingEvents(prev, next) {
  if (!prev || !next) return [];
  const ev = [];
  const lap = next.lapNumber || 0;
  const leader = vs => (vs || []).find(v => v.position === 1);

  const newCautions = (next.cautions || 0) - (prev.cautions || 0);
  if (newCautions > 0) {
    ev.push({ kind: "caution", tone: "caution", lap, text: newCautions > 1 ? `${newCautions} cautions (#${next.cautions})` : `Caution #${next.cautions}` });
  } else if (next.flagState !== prev.flagState) {
    if (next.flagState === 1 && (prev.flagState === 2 || prev.flagState === 3)) ev.push({ kind: "flag", tone: "go", lap, text: "Green flag — racing resumes" });
    else if (FLAG_EVENT[next.flagState]) ev.push({ kind: "flag", tone: FLAG_EVENT[next.flagState][1], lap, text: FLAG_EVENT[next.flagState][0] });
  }
  if (next.flagState === 3 && prev.flagState !== 3 && newCautions > 0) ev.push({ kind: "flag", tone: "stop", lap, text: "Red flag" });

  const ps = prev.stage?.stage_num, ns = next.stage?.stage_num;
  if (ps && ns && ns > ps) ev.push({ kind: "stage", tone: "go", lap, text: `Stage ${ps} complete` });

  const lc = (next.leadChanges || 0) - (prev.leadChanges || 0);
  if (lc > 0) {
    const l = leader(next.vehicles), pl = leader(prev.vehicles);
    ev.push({
      kind: "lead", tone: "neutral", lap, car: l?.carNumber,
      text: l && (!pl || pl.carNumber !== l.carNumber)
        ? `Lead change — ${short(l.carNumber, l.driver)} takes the lead`
        : `${lc} lead change${lc === 1 ? "" : "s"}`,
    });
  }

  const pf = getFastestLap(prev.vehicles), nf = getFastestLap(next.vehicles);
  if (nf && (!pf || nf.time < pf.time - 0.0005)) {
    ev.push({ kind: "fastest", tone: "go", lap, car: nf.carNumber, text: `Fastest lap — ${short(nf.carNumber, nf.driver)} ${fmtLapTime(nf.time)}` });
  }
  return ev;
}

// ── Pre-race lineups ─────────────────────────────────────────────────────────
/**
 * Each manager's roster for the Pre-Race Pit Box:
 *   [{ id, name, drivers: ["#11 Denny Hamlin", …], locked, complete }]
 * `locked` = picks are saved for the week; otherwise drivers drafted so far are
 * shown (draft in progress) and `complete` is false until all `size` are in.
 */
export function getLineups(players, weekPicks, draftState, size = 5) {
  return players.map(p => {
    const saved = (weekPicks?.[p.id] || []).filter(pk => !pk.garage).map(pk => pk.driver);
    const drafted = (draftState || []).filter(d => d.pid === p.id).map(d => d.driver);
    const locked = saved.length > 0;
    const drivers = locked ? saved : drafted;
    return { id: p.id, name: p.name, drivers, locked, complete: drivers.length >= size };
  });
}
