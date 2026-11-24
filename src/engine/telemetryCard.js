// ─── Driver Telemetry Card (pure) ───────────────────────────────────────────
// Everything the tap-a-driver card shows, derived from the league's own season
// documents plus the Next Gen history already shipped for Ferda Tips. No React,
// no network, so it can be unit-tested like the rest of the engine.
//
// Scoring is reused (calcDriverScore), never re-implemented. The one honest caveat:
// the public Next Gen dataset has finish / start / laps led but no stage results or
// fastest-lap data, so FERDA points for races the league did NOT score itself are
// ESTIMATES (finish, top-5/10, place-diff, laps led, pole). Every estimate is flagged.

import { SCHEDULE, SCHEDULES, PLAYERS, ACTIVE_PICKS, isMemorial } from "../constants.js";
import { nameKey } from "../driverKey.js";
import { calcDriverScore } from "./scoring.js";
import { storeFor } from "./events.js";
import { scoredWeekList } from "./statsView.js";
import { trackSlug, ownersFor, currentTrack } from "./cheatSheet.js";
import { isExhibition } from "../exhibitions.js";

const r1 = n => Math.round(n * 10) / 10;
export const signed = v => (v > 0 ? "+" : "") + r1(v);

// ── The week the card is talking about ───────────────────────────────────────
/**
 * Race + state for one week:
 *   race    { slug, track, ty, week, race }   (falls back to the nearest event off-season)
 *   scored  results are in           live   the race is running now
 *   locked  the draft is over / the race has started (nothing is "available" any more)
 *   raw     the stored result lines (empty until scored)
 */
export function weekContext(data, week) {
  const race = currentTrack(week);
  const w = race?.week ?? week;
  const src = storeFor(data, w);
  const wr = src.results?.["w" + w];
  const raw = wr?.raw?.drivers || [];
  const scored = raw.length > 0;
  const live = !!(data?.liveRace?.active && data.liveRace.week === w);
  const picks = (src.drafts?.["w" + w] || []).length;
  return {
    race, week: w, scored, live, raw, scoredMap: wr?.scored || null,
    locked: scored || live || picks >= ACTIVE_PICKS * PLAYERS.length,
  };
}

// ── Ownership ────────────────────────────────────────────────────────────────
/**
 * Who has this driver for the week.
 *   status: "drafted" | "available" | "undrafted" (draft over, nobody took him) | "memorial"
 */
export function ownership(data, week, driver) {
  const ctx = weekContext(data, week);
  const key = nameKey(driver);
  let owners = [];
  if (ctx.scoredMap) {
    owners = PLAYERS.map(p => p.id).filter(pid =>
      (ctx.scoredMap[pid]?.drivers || []).some(d => !d.dnr && nameKey(d.driver) === key));
  }
  if (!owners.length) {
    const o = ownersFor(data, ctx.week)[key];
    if (o) owners = [o];
  }
  const status = owners.length ? "drafted" : isMemorial(driver) ? "memorial" : ctx.locked ? "undrafted" : "available";
  return { owners, status };
}

/** Starting spot: the recorded one once the race is scored, otherwise the live grid. */
export function startFor(data, week, driver, grid) {
  const ctx = weekContext(data, week);
  const key = nameKey(driver);
  const r = ctx.raw.find(d => nameKey(d.name) === key);
  if (r?.qualPos > 0) return r.qualPos;
  return grid?.[key] ?? null;
}

// ── Module B · this track's history ──────────────────────────────────────────
const isDnf = r => !!r.status && String(r.status).toLowerCase() !== "running";

/** FERDA points from what the public dataset has (no stage / fastest-lap data). Always an estimate. */
export function estimatePts(row, ty) {
  return r1(calcDriverScore({
    finish: row.finish, qualPos: row.start, lapsLed: row.led || 0, dnf: !!row.dnf, dq: false, pole: row.start === 1,
  }, ty, false, false).total);
}

/**
 * Every points race the league scored at one track, for one driver, across the given
 * season documents ({ [year]: doc }). These have the real FERDA score.
 */
export function leagueRacesAt(seasons, slug, driver) {
  const key = nameKey(driver);
  const out = [];
  Object.entries(seasons || {}).forEach(([year, doc]) => {
    if (!doc) return;
    (SCHEDULES[year] || []).forEach(s => {
      if (s.ex || isExhibition(s.w) || trackSlug(s.t) !== slug) return;
      const wr = storeFor(doc, s.w)?.results?.["w" + s.w];
      const d = (wr?.raw?.drivers || []).find(x => nameKey(x.name) === key);
      if (!d || !(d.finish > 0)) return;
      out.push({
        year: +year, order: s.w, finish: d.finish, start: d.qualPos || null, led: d.lapsLed || 0,
        dnf: !!(d.dnf || d.dq), pts: r1(calcDriverScore(d, s.ty, false, !!wr.raw.threeStages).total), exact: true,
      });
    });
  });
  return out;
}

/**
 * Venue breakdown for one driver.
 *   sheetLog  the driver's Next Gen log at this track (public/data/cheat_sheets/{slug}.json)
 *   league    leagueRacesAt(...) — the league's own scored races (real points)
 *   ty        the track's discipline (for the estimate)
 * Returns null with no races. Otherwise
 *   { starts, wins, avgFinish, bestFinish, avgPts, estimated, last3:[{ year, finish, dnf, pts, exact }] }
 * `estimated` is true when avgPts leans on at least one estimated race.
 */
export function trackHistory({ sheetLog = [], league = [], ty }) {
  const rows = (sheetLog || []).filter(r => r.finish > 0).map(r => {
    const row = { year: r.season, order: r.race, finish: r.finish, start: r.start ?? null, led: r.led || 0, dnf: isDnf(r), exact: false };
    row.pts = estimatePts(row, ty);
    return row;
  });
  // The league's own score replaces the estimate for the same race (same year + number,
  // or — if numbering ever drifts — the same year, start and finish).
  (league || []).forEach(l => {
    const hit = rows.find(r => r.year === l.year && (r.order === l.order || (r.finish === l.finish && r.start === l.start)));
    if (hit) Object.assign(hit, { pts: l.pts, exact: true, dnf: hit.dnf || l.dnf });
    else rows.push({ ...l });
  });
  if (!rows.length) return null;
  rows.sort((a, b) => b.year - a.year || b.order - a.order);
  const avg = k => r1(rows.reduce((s, r) => s + r[k], 0) / rows.length);
  return {
    starts: rows.length,
    wins: rows.filter(r => r.finish === 1).length,
    avgFinish: avg("finish"),
    bestFinish: Math.min(...rows.map(r => r.finish)),
    avgPts: avg("pts"),
    estimated: rows.some(r => !r.exact),
    last3: rows.slice(0, 3).map(r => ({ year: r.year, finish: r.finish, dnf: r.dnf, pts: r.pts, exact: r.exact })),
  };
}

// ── Module C · discipline performance (this season so far) ───────────────────
/**
 * How the driver has run on this kind of track so far this season:
 *   { ty, racesHeld, races, avgPts, top10Rate (0–100), lapsLed, rank, of }
 * `rank` is by average FERDA points among every driver with enough starts (the same
 * minimum the Track Specialists board uses), null if the driver hasn't qualified.
 */
export function disciplineProfile(data, driver, ty) {
  const weeks = scoredWeekList(data).filter(({ w }) => SCHEDULE.find(s => s.w === w)?.ty === ty);
  const acc = {};
  weeks.forEach(({ wr }) => {
    const three = !!wr.raw.threeStages;
    wr.raw.drivers.forEach(d => {
      if (!(d.finish > 0)) return;
      const k = nameKey(d.name);
      if (!k) return;
      const a = acc[k] || (acc[k] = { races: 0, pts: 0, top10: 0, led: 0 });
      a.races++; a.pts += calcDriverScore(d, ty, false, three).total;
      if (d.finish <= 10) a.top10++;
      a.led += d.lapsLed || 0;
    });
  });
  const need = Math.min(2, Math.max(1, weeks.length));
  const ranked = Object.entries(acc)
    .filter(([, a]) => a.races >= need)
    .map(([k, a]) => ({ k, avg: a.pts / a.races }))
    .sort((a, b) => b.avg - a.avg || a.k.localeCompare(b.k));
  const key = nameKey(driver);
  const me = acc[key];
  const at = ranked.findIndex(x => x.k === key);
  return {
    ty, racesHeld: weeks.length, races: me?.races || 0,
    avgPts: me ? r1(me.pts / me.races) : null,
    top10Rate: me ? Math.round((me.top10 / me.races) * 100) : null,
    lapsLed: me?.led || 0,
    rank: at >= 0 ? at + 1 : null, of: ranked.length,
  };
}

// ── Module D · recent form ───────────────────────────────────────────────────
/** gold = win · go = top 5 · blue = top 10 · stop = DNF · none = the rest */
export function formTone({ finish, dnf }) {
  if (dnf) return "stop";
  if (finish === 1) return "gold";
  if (finish <= 5) return "go";
  if (finish <= 10) return "blue";
  return "none";
}

/** The last `n` races from a driver profile log (newest first) as pills: [{ label, tone, detail }]. */
export function recentForm(log, n = 5) {
  return (log || []).slice(0, n).map(r => ({
    week: r.week,
    label: r.dnf ? "DNF" : `P${r.finish}`,
    tone: formTone(r),
    detail: `W${r.week} · ${r.track || r.race} · ${r.dnf ? `DNF (P${r.finish})` : `P${r.finish}`} · ${signed(r.pts)} pts`,
  }));
}

// ── The sticky call-to-action ────────────────────────────────────────────────
/**
 * What the big bottom button does, from where the card was opened:
 *   draft room, available + your turn → DRAFT #12 Ryan Blaney
 *   draft room, available, waiting    → ADD TO MY QUEUE / REMOVE FROM QUEUE
 *   lineups / live, YOUR driver       → SET AS CAPTAIN (1.25× BONUS)   (only when captains exist)
 *   everything else                   → VIEW FULL SEASON RACE LOG
 */
export function pickCta({ mode, status, owners = [], me, num, name, draft, captain, logOpen = false }) {
  const log = { id: "log", label: logOpen ? "HIDE SEASON RACE LOG" : "VIEW FULL SEASON RACE LOG" };
  if (mode === "draft" && draft && status === "available") {
    if (draft.myTurn) return { id: "draft", label: `DRAFT ${num ? `#${num} ` : ""}${name}`.toUpperCase() };
    return draft.queued ? { id: "unqueue", label: "REMOVE FROM QUEUE" } : { id: "queue", label: "ADD TO MY QUEUE" };
  }
  if ((mode === "lineup" || mode === "live") && captain && me && owners.includes(me)) {
    return captain.isCaptain ? { id: "uncaptain", label: "REMOVE CAPTAIN" } : { id: "captain", label: "SET AS CAPTAIN (1.25× BONUS)" };
  }
  return log;
}
