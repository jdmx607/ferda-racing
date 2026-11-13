// ─── Home-screen helpers (pure — no React) ────────────────────────────────────
// Everything the Home "command center" derives from league data, kept here so
// it can be unit-tested and reused.

import { PLAYERS, SCHEDULE, ACTIVE_SEASON, ACTIVE_PICKS } from "../constants.js";
import { storeFor, getCurrentWeek } from "./events.js";
import { getDraftOrder, buildSnakeOrder } from "./draft.js";

const MONTH_IDX = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };

// Races start ~2:30 PM local (same assumption the countdown has always used)
export function raceStartMs(dateStr) {
  if (!dateStr) return null;
  const [mon, day] = dateStr.split(" ");
  if (!(mon in MONTH_IDX)) return null;
  return new Date(ACTIVE_SEASON, MONTH_IDX[mon], parseInt(day), 14, 30, 0).getTime();
}

/** "Feb 15" → "SUN FEB 15 • 2:30 PM" */
export function formatRaceWhen(dateStr) {
  const ms = raceStartMs(dateStr);
  if (ms == null) return dateStr || "";
  const dt = new Date(ms);
  const dow  = dt.toLocaleDateString("en-US", { weekday: "short" });
  const md   = dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${dow} ${md} • ${time}`.toUpperCase();
}

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

export { ACTIVE_PICKS };
