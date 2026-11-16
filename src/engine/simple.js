// ─── Simplified Pit-Crew Mode (pure) ─────────────────────────────────────────
// Plain-English draft status, the "My 5 Picks" box, the drivers still available,
// a week scoreboard and the mulligan window — all derived from the same data and
// rules the full app uses (draft order, snake sequence, mulligan allowance).

import { PLAYERS, PNAME, DRIVERS, ACTIVE_PICKS, SCHEDULE, isMemorial, isFreeAgent } from "../constants.js";
import { getDraftOrder, buildSnakeOrder } from "./draft.js";
import { storeFor } from "./events.js";
import { getMulliganAllowance } from "./mulligans.js";
import { isExhibition } from "../exhibitions.js";

/** Big Monroe gets the simplified view by default; anyone can override it in Settings. */
export const SIMPLE_DEFAULT_PLAYERS = ["bigmonroe"];
export function isSimplified(pid, playerSettings) {
  const pref = playerSettings?.[pid]?.simplifiedMode;
  return typeof pref === "boolean" ? pref : SIMPLE_DEFAULT_PLAYERS.includes(pid);
}

export const splitName = d => {
  const m = String(d).match(/^#(\S+)\s+(.*)$/);
  return m ? { num: m[1], name: m[2] } : { num: "", name: String(d) };
};

/**
 * Where the draft stands for one manager, in plain English terms:
 *   state: "none" (no race) | "gated" (opens later) | "myTurn" | "waiting" | "done" (my 5 are in) | "complete"
 *   onClock (pid), myPickNo (1–5 for my next pick), nextOverall + nextRound (my next slot), opensAt
 */
export function draftStatus(data, week, pid, now = Date.now()) {
  const info = SCHEDULE.find(s => s.w === week);
  if (!info) return { state: "none" };
  const src = storeFor(data, week);
  const key = "w" + week;
  const draft = src?.drafts?.[key] || [];
  const snake = buildSnakeOrder(getDraftOrder(data, week));
  const opensAt = src?.draftSchedule?.[key]?.opensAt;
  if (opensAt && draft.length === 0 && now < new Date(opensAt).getTime()) return { state: "gated", opensAt };
  const savedMine = (src?.picks?.[key]?.[pid] || []).filter(p => !p.garage);
  if (draft.length >= snake.length) return { state: "complete" };
  const mine = draft.filter(d => d.pid === pid).length;
  const turn = snake[draft.length];
  if (turn?.pid === pid) return { state: "myTurn", onClock: pid, myPickNo: mine + 1, pickNum: draft.length };
  const nextIdx = snake.findIndex((t, i) => i >= draft.length && t.pid === pid);
  if (nextIdx < 0 || mine >= ACTIVE_PICKS || savedMine.length >= ACTIVE_PICKS) return { state: "done", onClock: turn?.pid || null };
  return { state: "waiting", onClock: turn?.pid || null, nextOverall: nextIdx + 1, nextRound: snake[nextIdx].round, myPickNo: mine + 1 };
}

/** My 5 slots: [{ slot, driver|null, mulligan }] — from the saved lineup, else the live draft. */
export function myPicks(data, week, pid) {
  const src = storeFor(data, week);
  const key = "w" + week;
  const drafted = (src?.drafts?.[key] || []).filter(d => d.pid === pid).map(d => ({ driver: d.driver }));
  const saved = (src?.picks?.[key]?.[pid] || []).filter(p => !p.garage);
  const list = saved.length ? saved : drafted;
  return Array.from({ length: ACTIVE_PICKS }, (_, i) => ({ slot: i + 1, driver: list[i]?.driver || null, mulligan: !!list[i]?.mulligan }));
}

/**
 * Drivers still on the board (drafted, memorial and no-ride free agents removed),
 * filtered by name / car number and sorted "num" (car #) or "az" (last name).
 */
export function availableDrivers(data, week, { search = "", sort = "num" } = {}) {
  const src = storeFor(data, week);
  const key = "w" + week;
  const taken = new Set([
    ...(src?.drafts?.[key] || []).map(d => d.driver),
    ...Object.values(src?.picks?.[key] || {}).flat().map(p => p?.driver),
  ].filter(Boolean));
  const q = search.trim().toLowerCase().replace(/^#/, "");
  const last = d => splitName(d).name.split(" / ")[0].trim().split(/\s+/).slice(-1)[0].toLowerCase();
  return DRIVERS
    .filter(d => !taken.has(d) && !isMemorial(d) && !isFreeAgent(d))
    .filter(d => !q || d.toLowerCase().includes(q) || splitName(d).num === q)
    .sort((a, b) => sort === "az"
      ? last(a).localeCompare(last(b)) || a.localeCompare(b)
      : (parseInt(splitName(a).num, 10) || 0) - (parseInt(splitName(b).num, 10) || 0));
}

/**
 * Week scoreboard: live scores when a race is on, else the week's final scores.
 *   { week, label: "LIVE" | "FINAL" | null, rows:[{ pid, name, total }] (1st → 4th) }
 */
export function scoreboard(data, { currentWeek, liveScores, liveWeek }) {
  let week = null, label = null, scored = null;
  if (liveScores && liveWeek != null) { week = liveWeek; label = "LIVE"; scored = liveScores; }
  else {
    const weeks = Object.keys(data?.results || {}).map(k => parseInt(k.replace("w", ""), 10)).filter(w => data.results["w" + w]?.scored);
    const w = weeks.includes(currentWeek) ? currentWeek : Math.max(-Infinity, ...weeks);
    if (Number.isFinite(w)) { week = w; label = "FINAL"; scored = data.results["w" + w].scored; }
  }
  const rows = PLAYERS.map(p => ({ pid: p.id, name: PNAME[p.id], total: scored?.[p.id]?.total ?? null }))
    .sort((a, b) => (b.total ?? -Infinity) - (a.total ?? -Infinity));
  return { week, label, rows, drivers: scored || {} };
}

/**
 * Mulligan window for a manager this week — same rules as the Mulligans tab:
 * current week, not scored yet, not an exhibition, lineup saved, mulligans left.
 *   { open, remaining, mine:[driver] (swappable), pool:[driver] (eligible adds) }
 */
export function mulliganWindow(data, pid, week) {
  const { remaining } = getMulliganAllowance(data, pid, week);
  const key = "w" + week;
  const picks = (data?.picks?.[key]?.[pid] || []).filter(p => !p.garage);
  const scored = !!data?.results?.[key]?.scored;
  const taken = new Set(Object.values(data?.picks?.[key] || {}).flat().map(p => p?.driver).filter(Boolean));
  const open = !scored && !isExhibition(week) && picks.length > 0 && remaining > 0 && !!SCHEDULE.find(s => s.w === week);
  return {
    open, remaining,
    mine: picks.filter(p => !p.mulligan).map(p => p.driver),
    pool: DRIVERS.filter(d => !taken.has(d) && !isMemorial(d) && !isFreeAgent(d)),
  };
}
