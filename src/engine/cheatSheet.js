// ─── Track Cheat Sheet — pure helpers ───────────────────────────────────────
// The sheets themselves are static JSON built by scripts/update_cheat_sheets.py
// (public/data/cheat_sheets/{slug}.json). Everything here just joins a sheet to the
// app's own driver pool and this week's draft, so it can be unit-tested without a browser.

import { DRIVERS, DRIVER_INFO, SCHEDULE, isMemorial, isFreeAgent } from "../constants.js";
import { nameKey } from "../driverKey.js";
import { storeFor } from "./events.js";

/** "N. Wilkesboro" → "n-wilkesboro" (matches the slugs the Python script writes). */
export const trackSlug = name =>
  String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export const TIERS = {
  1: { id: 1, label: "Elite / Dominator",  short: "ELITE",    plain: "Top Pick",  color: "#10B981" },
  2: { id: 2, label: "Top-10 Contender",   short: "TOP 10",   plain: "Solid Pick", color: "#38BDF8" },
  3: { id: 3, label: "Place-Diff / Value", short: "VALUE",    plain: "Value Pick", color: "#F59E0B" },
  4: { id: 4, label: "Fade / High Risk",   short: "RISKY",    plain: "Risky",      color: "#EF4444" },
};

export const SORTS = [
  { id: "composite",  label: "Composite",   hint: "Best overall score first" },
  { id: "avgFinish",  label: "Avg Finish",  hint: "Best average finish first" },
  { id: "rating",     label: "Driver Rating", hint: "Highest rating first" },
  { id: "ledPct",     label: "Laps Led %",  hint: "Most laps led first" },
  { id: "disciplineAvg", label: "Discipline Avg", hint: "Best average on this kind of track first" },
];

/** Tracks the league runs this season, in schedule order, one entry per track. */
export function seasonTracks(schedule = SCHEDULE) {
  const seen = new Set(), out = [];
  for (const s of schedule) {
    const slug = trackSlug(s.t);
    if (seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug, track: s.t, ty: s.ty, firstWeek: s.w });
  }
  return out;
}

/** The track the league is on right now (falls back to the first/last race outside the season). */
export function currentTrack(week, schedule = SCHEDULE) {
  const s = schedule.find(x => x.w === week) || schedule[schedule.length - 1] || schedule[0];
  return s ? { slug: trackSlug(s.t), track: s.t, ty: s.ty, week: s.w, race: s.r } : null;
}

/** { nameKey: pid } for everyone already drafted this week. */
export function ownersFor(data, week) {
  const src = storeFor(data, week);
  const owners = {};
  (src.drafts?.["w" + week] || []).forEach(d => { if (d?.driver && d?.pid) owners[nameKey(d.driver)] = d.pid; });
  // Lineups that were set without a draft log (older seasons, manual fixes).
  Object.entries(src.picks?.["w" + week] || {}).forEach(([pid, list]) => {
    (Array.isArray(list) ? list : []).forEach(dr => { if (dr) owners[nameKey(dr)] ||= pid; });
  });
  return owners;
}

const numOf = d => (String(d).match(/^#(\S+)/) || [])[1] || "";
const nameOf = d => String(d).replace(/^#\S+\s+/, "");

/**
 * One row per draftable driver in the app's pool, joined to the sheet by name.
 * Drivers the sheet has no Next Gen data for are kept (tier null) so nobody vanishes.
 */
export function buildRows(sheet, { owners = {}, grid = {}, pool = DRIVERS } = {}) {
  const byKey = new Map((sheet?.drivers || []).map(d => [d.key, d]));
  return pool
    .filter(d => !isMemorial(d) && !isFreeAgent(d))
    .map(driver => {
      const key = nameKey(driver);
      const s = byKey.get(key) || null;
      const start = grid[key] ?? s?.start ?? null;
      const tier = s?.tier ?? null;
      return {
        driver, key, num: numOf(driver), name: nameOf(driver),
        team: DRIVER_INFO[driver]?.team || s?.team || "", make: DRIVER_INFO[driver]?.make || s?.make || "",
        owner: owners[key] || null,
        sheet: s, tier, composite: s?.composite ?? null,
        stats: s?.stats || null, tags: s?.tags || [], log: s?.log || [],
        start, placeDiffTarget: start != null && start >= 20 && tier != null && tier <= 2,
      };
    });
}

// Sort keys: lower is better for finish-style numbers, higher for the rest.
const SORT_DIR = { composite: -1, avgFinish: 1, rating: -1, ledPct: -1, disciplineAvg: 1 };
const sortValue = (row, key) => (key === "composite" ? row.composite : row.stats?.[key] ?? null);

export function sortRows(rows, key = "composite") {
  const dir = SORT_DIR[key] ?? -1;
  return [...rows].sort((a, b) => {
    const av = sortValue(a, key), bv = sortValue(b, key);
    if (av == null && bv == null) return a.name.localeCompare(b.name);
    if (av == null) return 1;
    if (bv == null) return -1;
    return (av - bv) * dir || (b.composite ?? -1) - (a.composite ?? -1) || a.name.localeCompare(b.name);
  });
}

/** [{ tier, rows }] for tiers 1–4, plus an "unrated" bucket (tier null) when anyone has no data. */
export function groupByTier(rows) {
  const groups = [1, 2, 3, 4].map(t => ({ tier: t, rows: rows.filter(r => r.tier === t) }));
  const none = rows.filter(r => r.tier == null);
  if (none.length) groups.push({ tier: null, rows: none });
  return groups;
}

/** Plain-average finish/start from a driver's race log (the sheet's headline numbers are recency-weighted). */
export function logSummary(log = []) {
  if (!log.length) return null;
  const avg = k => log.reduce((s, r) => s + (r[k] || 0), 0) / log.length;
  return {
    starts: log.length, avgStart: avg("start"), avgFinish: avg("finish"),
    led: log.reduce((s, r) => s + (r.led || 0), 0), wins: log.filter(r => r.win).length,
  };
}

/** Header line for the card: "1.5 mi · paved · 10 Next Gen races (2022–2026)". */
export function sheetSubtitle(sheet) {
  if (!sheet) return "";
  const seasons = sheet.seasons || [];
  const span = seasons.length ? (seasons.length > 1 ? `${seasons[0]}–${seasons[seasons.length - 1]}` : `${seasons[0]}`) : "";
  const n = sheet.nextGenRaces || 0;
  return [
    sheet.lengthMi ? `${sheet.lengthMi} mi` : null,
    sheet.surface,
    n ? `${n} Next Gen race${n === 1 ? "" : "s"}${span ? ` (${span})` : ""}` : "No Next Gen races yet",
  ].filter(Boolean).join(" · ");
}
