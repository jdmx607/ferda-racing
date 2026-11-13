// ─── Home-screen helpers (pure — no React) ────────────────────────────────────
// Everything the Home "command center" derives from league data, kept here so
// it can be unit-tested and reused.

import { PLAYERS, SCHEDULE, ACTIVE_PICKS, PLAYOFF_START_WEEK } from "../constants.js";
import { storeFor, getCurrentWeek } from "./events.js";
import { getDraftOrder, buildSnakeOrder } from "./draft.js";
import { getChaseTotals } from "./chase.js";

/** Lineup for one player in one event — drafted picks if a draft ran, else saved picks. */
export function getPlayerLineup(data, week, pid) {
  const src   = storeFor(data, week);
  const draft = src.drafts?.["w" + week] || [];
  const saved = src.picks?.["w" + week]?.[pid] || [];
  const mull  = new Set(saved.filter(pk => pk.mulligan).map(pk => pk.driver));
  const names = draft.length > 0
    ? draft.filter(d => d.pid === pid).map(d => d.driver)
    : saved.filter(pk => !pk.garage).map(pk => pk.driver);
  return names.map(driver => ({ driver, mulligan: mull.has(driver) }));
}

export function hasAnyLineup(data, week) {
  return PLAYERS.some(p => getPlayerLineup(data, week, p.id).length > 0);
}

/**
 * Lineup-lock status for the current event, for the Driver Hub pill.
 *   open    — draft is open / in progress           ("DRAFT OPEN")
 *   locked  — every pick is in                       ("LINEUP LOCKED")
 *   waiting — draft not open yet (Monday gate)       ("DRAFT OPENS …")
 *   scored  — results already posted
 *   over    — no event left this season
 */
export function getLineupStatus(data, week) {
  if (!SCHEDULE.some(s => s.w === week)) return { state: "over", label: "SEASON COMPLETE" };
  const src      = storeFor(data, week);
  const key      = "w" + week;
  if (src.results?.[key]?.scored) return { state: "scored", label: "RESULTS POSTED" };

  const drafted  = src.drafts?.[key] || [];
  const seq      = buildSnakeOrder(getDraftOrder(data, week));
  const hasSaved = Object.values(src.picks?.[key] || {}).some(p => p && p.length > 0);

  if (drafted.length >= seq.length || (hasSaved && drafted.length === 0)) {
    return { state: "locked", label: "LINEUP LOCKED" };
  }
  if (drafted.length === 0 && !hasSaved) {
    const opensAt = src.draftSchedule?.[key]?.opensAt;
    if (opensAt && Date.now() < new Date(opensAt).getTime()) {
      const dt = new Date(opensAt);
      const when = `${dt.toLocaleDateString("en-US", { weekday: "short" })} ${dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
      return { state: "waiting", label: `DRAFT OPENS ${when}`.toUpperCase() };
    }
  }
  return { state: "open", label: "DRAFT OPEN" };
}

/**
 * Which race the standings rows expand to: the current event once anyone has a
 * lineup for it, otherwise the latest scored race.
 */
export function getHomeLineupWeek(data) {
  const current = getCurrentWeek(data);
  if (SCHEDULE.some(s => s.w === current) && hasAnyLineup(data, current)) {
    return { week: current, scored: !!storeFor(data, current).results?.["w" + current]?.scored };
  }
  const last = Object.keys(data.results || {})
    .map(k => parseInt(k.replace("w", ""))).filter(w => data.results["w" + w]?.scored)
    .sort((a, b) => b - a)[0];
  return last ? { week: last, scored: true } : { week: current, scored: false };
}

/** Off-season wrap-up for one player: best race score, average weekly finish (1–4), playoff points. */
export function getSeasonWrapUp(data, pid) {
  let best = null, posSum = 0, races = 0;
  Object.values(data.results || {}).forEach(wr => {
    if (!wr?.scored || !wr.scored[pid]) return;
    const sorted = Object.entries(wr.scored).sort((a, b) => b[1].total - a[1].total);
    const pos = sorted.findIndex(([id]) => id === pid) + 1;
    const total = wr.scored[pid].total;
    if (best == null || total > best) best = total;
    posSum += pos; races++;
  });
  return {
    races,
    bestScore: best,
    avgFinish: races ? Math.round((posSum / races) * 10) / 10 : null,
    playoffPts: data.meta?.playoffPts?.[pid] || 0,
  };
}

const SUFFIXES = new Set(["Jr", "Jr.", "Sr", "Sr.", "II", "III", "IV"]);

/** "#24 William Byron" → "Byron";  "#47 Ricky Stenhouse Jr" → "Stenhouse" */
export function shortName(driver = "") {
  const parts = String(driver).replace(/^#\S+\s*/, "").split(/\s+/).filter(Boolean);
  while (parts.length > 1 && SUFFIXES.has(parts[parts.length - 1])) parts.pop();
  return parts[parts.length - 1] || "";
}

/** A player's top-scoring driver in a scored race: { driver, total } or null. */
export function getRaceMvp(playerScored) {
  const ds = (playerScored?.drivers || []).filter(d => !d.dnr);
  if (!ds.length) return null;
  const top = ds.reduce((m, d) => (d.total > m.total ? d : m), ds[0]);
  return { driver: top.driver, total: top.total };
}

/** Points behind the leader for each row of a standings list sorted high→low. */
export function pointsBack(sorted) {
  const lead = sorted[0]?.pts ?? 0;
  return sorted.map(p => Math.round((p.pts - lead) * 10) / 10);   // 0 for the leader, negative otherwise
}

// ── Standings: Regular Season (W1–26) vs The Chase (W27–36) ───────────────────

const weekOf = key => parseInt(key.replace("w", ""), 10);
const inView = (view, w) => (view === "chase" ? w >= PLAYOFF_START_WEEK : w < PLAYOFF_START_WEEK);

/** Chase tab by default once any Chase race has been scored, else Regular Season. */
export function defaultStandingsView(data) {
  const chaseStarted = Object.entries(data.results || {})
    .some(([k, wr]) => wr?.scored && weekOf(k) >= PLAYOFF_START_WEEK);
  return chaseStarted ? "chase" : "regular";
}

/** Scored races in this view vs how many it has in total (26 regular / 10 Chase). */
export function standingsProgress(data, view) {
  const total = view === "chase" ? 36 - PLAYOFF_START_WEEK + 1 : PLAYOFF_START_WEEK - 1;
  const done = Object.entries(data.results || {})
    .filter(([k, wr]) => wr?.scored && inView(view, weekOf(k))).length;
  return { done, total };
}

/**
 * The four players ranked for one standings view.
 *   regular — season points through Week 26 (meta.standings)
 *   chase   — Chase total: 1,000 + playoff pts + champ bonus + Chase-week points (Weeks 27–36)
 * Each row: { id, pts, wins (in this view), pp (playoff pts), chasePts }.
 */
export function getStandings(data, view) {
  const chase = view === "chase" ? getChaseTotals(data).totals : null;
  return PLAYERS.map(p => ({
    id: p.id,
    pts: chase ? chase[p.id] : (data.meta?.standings?.[p.id] || 0),
    pp: data.meta?.playoffPts?.[p.id] || 0,
    chasePts: data.meta?.chasePts?.[p.id] || 0,
    wins: Object.entries(data.results || {})
      .filter(([k, wr]) => inView(view, weekOf(k)) && wr?.scored?.[p.id]?.weeklyWin).length,
  })).sort((a, b) => b.pts - a.pts);
}

// ── Chase cutline (NASCAR driver standings) ───────────────────────────────────
// Regular season: the top 16 drivers make the playoffs, so the cutline is 16th.
// Chase rounds (NASCAR format): the field is cut to 12 after W29, 8 after W32,
// 4 after W35; W36 is the title race (no cut).

/** Rank of the last driver still safe at this week's cutline, or null when there is none. */
export function cutlineRank(week) {
  if (week < PLAYOFF_START_WEEK) return 16;
  const round = Math.floor((week - PLAYOFF_START_WEEK) / 3);
  return [12, 8, 4][round] ?? null;
}

/**
 * Drivers around the cutline. `drivers`: [{ num, name, pos, points, inChase }].
 * Returns { cut, rows:[{...driver, rank, gap, inside, bubble}], cutPoints } or null.
 * gap = points ahead (+) / behind (−) of the driver sitting on the cutline.
 */
export function buildBubble(drivers, week, span = 3) {
  const cut = cutlineRank(week);
  if (!cut || !Array.isArray(drivers)) return null;
  const pool = week >= PLAYOFF_START_WEEK ? drivers.filter(d => d.inChase) : drivers;
  const sorted = [...pool].sort((a, b) => b.points - a.points || a.pos - b.pos);
  if (sorted.length < cut) return null;
  const cutPoints = sorted[cut - 1].points;
  const start = Math.max(0, cut - span);
  const rows = sorted.slice(start, cut + span).map((d, i) => {
    const rank = start + i + 1;
    return { ...d, rank, gap: d.points - cutPoints, inside: rank <= cut, bubble: rank === cut || rank === cut + 1 };
  });
  return { cut, rows, cutPoints };
}

export { ACTIVE_PICKS };
