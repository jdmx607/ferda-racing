// ─── Draft room — derived view data (pure) ───────────────────────────────────
// Everything the "Pit-Wall Draft Room" shows that isn't already stored: the
// snake "Up Next" queue, per-driver scouting stats, the filtered driver pool and
// the manager's pre-draft queue. The draft itself (order, snake sequence, picks,
// timers) is untouched — see engine/draft.js and App.jsx.

import { SCHEDULE } from "../constants.js";
import { calcDriverScore } from "./scoring.js";
import { nameKey } from "../driverKey.js";

const round1 = n => Math.round(n * 10) / 10;

// ── Up Next strip ────────────────────────────────────────────────────────────
/**
 * The next `count` turns starting with the one on the clock:
 *   { pickNo, pid, round, seed, now, turn }
 * `seed` is the manager's slot in the draft order ("1. Rich"); `turn` marks the
 * first item of a new round, where the order wraps ("4. Justin ↻ 1. Rich"). The
 * league drafts the SAME order every round (no reversing snake — see PROJECT_CONTEXT.md),
 * so the strip simply mirrors engine/draft.js's buildSnakeOrder sequence.
 */
export function getUpNext(snake, pickNum, draftOrder, count = 8) {
  const out = [];
  for (let i = pickNum; i < Math.min(snake.length, pickNum + count); i++) {
    const t = snake[i];
    const prev = out[out.length - 1];
    out.push({
      pickNo: i + 1, pid: t.pid, round: t.round,
      seed: draftOrder.indexOf(t.pid) + 1,
      now: i === pickNum,
      turn: !!prev && t.round !== prev.round,
    });
  }
  return out;
}

/** How many picks until `pid` is on the clock (0 = now), or null if they're done. */
export function picksUntil(snake, pickNum, pid) {
  for (let i = pickNum; i < snake.length; i++) if (snake[i].pid === pid) return i - pickNum;
  return null;
}

// ── Names ────────────────────────────────────────────────────────────────────
const SUFFIX   = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv"]);
const PARTICLE = new Set(["van", "de", "di", "del", "della"]);

/** "#12 Ryan Blaney" → { num: "12", name: "Ryan Blaney" } (names without a # keep num "") */
export function splitDriver(d) {
  const m = String(d).match(/^#(\S+)\s+(.*)$/);
  return m ? { num: m[1], name: m[2].trim() } : { num: "", name: String(d).trim() };
}

/** "Ryan Blaney" → "Blaney"; keeps "Jr" and "Van" so "Stenhouse Jr" / "Van Gisbergen" survive. */
export function lastNameOf(name) {
  const base = String(name).split(" / ")[0].replace(/[#*]+\s*$/, "").trim();
  const t = base.split(/\s+/).filter(Boolean);
  if (t.length <= 1) return base;
  let i = t.length - 1;
  if (SUFFIX.has(t[i].toLowerCase()) && i > 0) i--;
  if (i > 0 && PARTICLE.has(t[i - 1].toLowerCase())) i--;
  return t.slice(i).join(" ");
}

/** "#12 Ryan Blaney" → "#12 Blaney" — the board's slot-pill label. */
export function pillLabel(d) {
  const { num, name } = splitDriver(d);
  return { num: num ? "#" + num : "", last: lastNameOf(name) };
}

// ── Scouting stats ───────────────────────────────────────────────────────────
/**
 * Season stats per driver (keyed by nameKey) from the scored results:
 *   { races, avgFinish, trackRaces, trackAvg }
 * `trackAvg` is the average FERDA score at tracks of this week's archetype (`ty`).
 */
export function getScouting(data, ty) {
  const acc = {};
  Object.entries(data?.results || {}).forEach(([key, wr]) => {
    if (!wr?.raw?.drivers) return;
    const w   = parseInt(key.replace("w", ""), 10);
    const wty = SCHEDULE.find(s => s.w === w)?.ty || "intermediate";
    const three = !!wr.raw.threeStages;
    wr.raw.drivers.forEach(d => {
      if (!(d.finish > 0)) return;
      const k = nameKey(d.name);
      if (!k) return;
      const a = acc[k] || (acc[k] = { races: 0, finishSum: 0, trackRaces: 0, trackSum: 0 });
      a.races++; a.finishSum += d.finish;
      if (wty === ty) { a.trackRaces++; a.trackSum += calcDriverScore(d, wty, false, three).total; }
    });
  });
  const out = {};
  Object.entries(acc).forEach(([k, a]) => {
    out[k] = {
      races: a.races,
      avgFinish: a.races ? round1(a.finishSum / a.races) : null,
      trackRaces: a.trackRaces,
      trackAvg: a.trackRaces ? round1(a.trackSum / a.trackRaces) : null,
    };
  });
  return out;
}

// ── Driver pool ──────────────────────────────────────────────────────────────
export const POOL_MODES = ["bonus", "track", "top10"];

/**
 * Rows for the scouting pool.
 *   owners        { [driver]: pid }    who has already drafted whom
 *   availableOnly true → drafted drivers are hidden; false → shown dimmed at the bottom
 *   mode          null | "bonus" (rookies float up) | "track" (best track rating first)
 *                 | "top10" (only drivers starting P1–P10, in grid order)
 *   grid          { [nameKey]: startPos } or null when qualifying hasn't set one
 * Memorial drivers always sit last (locked). Free agents are split off by `pool`.
 */
export function buildPool({
  drivers, owners = {}, search = "", availableOnly = true, mode = null, pool = "drivers",
  scouting = {}, grid = null, isRookie = () => false, isFreeAgent = () => false, isMemorial = () => false,
}) {
  const q = search.trim().toLowerCase();
  let rows = drivers
    .filter(d => (pool === "free") === isFreeAgent(d))
    .filter(d => !q || d.toLowerCase().includes(q))
    .map(d => {
      const k = nameKey(d);
      const s = scouting[k] || {};
      return {
        driver: d,
        owner: owners[d] || null,
        memorial: isMemorial(d),
        rookie: isRookie(d),
        start: grid && grid[k] != null ? grid[k] : null,
        avgFinish: s.avgFinish ?? null,
        trackAvg: s.trackAvg ?? null,
        trackRaces: s.trackRaces || 0,
        races: s.races || 0,
      };
    });

  if (availableOnly) rows = rows.filter(r => !r.owner);

  if (mode === "top10") rows = rows.filter(r => r.start != null && r.start <= 10).sort((a, b) => a.start - b.start);
  else if (mode === "track") rows = rows.slice().sort((a, b) => (b.trackAvg ?? -1) - (a.trackAvg ?? -1));
  else if (mode === "bonus") rows = rows.slice().sort((a, b) => Number(b.rookie) - Number(a.rookie));

  // stable partition: open drivers → drafted (dimmed) → memorial (locked)
  const rank = r => (r.memorial ? 2 : r.owner ? 1 : 0);
  return rows.map((r, i) => ({ r, i })).sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i).map(x => x.r);
}

// ── My Queue (pre-draft watchlist) ───────────────────────────────────────────
export const toggleQueue = (queue, driver) =>
  queue.includes(driver) ? queue.filter(d => d !== driver) : [...queue, driver];

export const moveToTop = (queue, driver) =>
  queue.includes(driver) ? [driver, ...queue.filter(d => d !== driver)] : queue;

/** Drop drivers that have since been drafted (or are memorial) — keeps priority order. */
export const pruneQueue = (queue, taken, isMemorial = () => false) =>
  queue.filter(d => !taken.has(d) && !isMemorial(d));
