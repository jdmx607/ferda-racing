// ─── Race Archive (pure) ─────────────────────────────────────────────────────
// A track-centric view over every saved season: pick a track, see each time the league
// raced there — who drafted whom, how everyone scored, how the real race finished.
// Built from the seasons' own documents and their own schedules (see archive.js).

import { PLAYERS } from "../constants.js";
import { nameKey } from "../driverKey.js";
import { calcDriverScore } from "./scoring.js";
import { storeFor } from "./events.js";
import { seasonWeeks, ownersOf } from "./archive.js";
import { trackSlug } from "./cheatSheet.js";

const r1 = n => Math.round(n * 10) / 10;
const nameOnly = d => String(d).replace(/^#\S+\s+/, "");

/**
 * Index of every scored race, grouped by track.
 *   docs: { [year]: seasonDoc }
 *   → [{ slug, track, ty, races:[{ year, w, race, date, ex, winner, margin, scores, mvp }] }]
 * Races are newest-first; tracks are ordered by how many times the league has raced there
 * (then A–Z), so the busiest venues lead.
 */
export function buildTrackIndex(docs) {
  const by = new Map();
  Object.keys(docs || {}).map(Number).forEach(year => {
    if (!docs[year]) return;
    seasonWeeks(docs[year], year).forEach(wk => {
      const slug = trackSlug(wk.track);
      if (!by.has(slug)) by.set(slug, { slug, track: wk.track, ty: wk.ty, races: [] });
      by.get(slug).races.push({ ...wk, year });
    });
  });
  const out = [...by.values()];
  out.forEach(t => t.races.sort((a, b) => b.year - a.year || b.w - a.w));
  return out.sort((a, b) => b.races.length - a.races.length || a.track.localeCompare(b.track));
}

/**
 * Everything about one race, ready to render:
 *   managers  [{ pid, total, rank, winner, drivers:[{ driver, num, name, total, dnr, mulligan, garage,
 *                pick:{ overall, round }|null, start, finish, lapsLed, dnf }] }]
 *   results   top 10 real finishers [{ name, num, finish, start, lapsLed, dnf, fantasy, owners }]
 *   gotAway   best-scoring driver nobody drafted (or null)
 */
export function raceDetail(doc, race) {
  const store = storeFor(doc, race.w);
  const wr = store?.results?.["w" + race.w];
  const raw = wr?.raw?.drivers || [];
  const three = !!wr?.raw?.threeStages;
  const log = store?.drafts?.["w" + race.w] || [];
  const nPlayers = Math.max(1, new Set(log.map(d => d.pid)).size || PLAYERS.length);
  const pickBy = {};
  log.forEach((d, i) => { pickBy[nameKey(d.driver)] = { overall: i + 1, round: Math.floor(i / nPlayers) + 1 }; });
  const rawBy = {};
  raw.forEach(d => { rawBy[nameKey(d.name)] = d; });

  const managers = race.scores.map((s, i) => ({
    pid: s.pid, total: r1(s.total), rank: i + 1, winner: s.pid === race.winner,
    drivers: s.drivers.map(d => {
      const r = rawBy[nameKey(d.driver)];
      return {
        driver: d.driver, num: (String(d.driver).match(/^#(\S+)/) || [])[1] || "", name: nameOnly(d.driver),
        total: d.total ?? 0, dnr: !!d.dnr, mulligan: !!d.isMulligan, garage: !!d.isGarage,
        pick: pickBy[nameKey(d.driver)] || null,
        start: r?.qualPos ?? null, finish: r?.finish ?? null, lapsLed: r?.lapsLed ?? 0, dnf: !!(r && (r.dnf || r.dq)),
      };
    }),
  }));

  const scored = wr?.scored || {};
  const results = raw
    .filter(d => d.finish != null)
    .map(d => ({
      name: d.name, num: (String(d.name).match(/^#(\S+)/) || [])[1] || "", finish: d.finish, start: d.qualPos ?? null,
      lapsLed: d.lapsLed || 0, dnf: !!(d.dnf || d.dq),
      fantasy: r1(calcDriverScore(d, race.ty, false, three).total), owners: ownersOf(scored, d.name),
    }))
    .sort((a, b) => a.finish - b.finish);

  const undrafted = results.filter(d => d.owners.length === 0).sort((a, b) => b.fantasy - a.fantasy)[0] || null;
  return {
    managers, results: results.slice(0, 10), field: results.length,
    gotAway: undrafted && undrafted.fantasy > 0 ? undrafted : null,
  };
}

/**
 * Track-wide summary across every race listed:
 *   perManager  [{ pid, races, wins, avg, best:{ total, year }|null, topPicks:[{ name, num, count, avg }] }]
 *   bestDriver  highest single-driver score here { name, total, year, pids }
 *   hotSeat     driver the league picked most often { name, count }
 */
export function trackSummary(races) {
  const pts = races;                                         // exhibitions count: they're races at this track too
  const mgr = Object.fromEntries(PLAYERS.map(p => [p.id, { pid: p.id, races: 0, wins: 0, sum: 0, best: null, picks: {} }]));
  const all = {};
  let bestDriver = null;
  pts.forEach(rc => {
    rc.scores.forEach(s => {
      const m = mgr[s.pid]; if (!m) return;
      m.races++; m.sum += s.total || 0;
      if (rc.winner === s.pid) m.wins++;
      if (!m.best || s.total > m.best.total) m.best = { total: r1(s.total), year: rc.year };
      s.drivers.forEach(d => {
        if (d.dnr) return;
        const k = nameKey(d.driver);
        const e = (m.picks[k] ||= { name: nameOnly(d.driver), num: (String(d.driver).match(/^#(\S+)/) || [])[1] || "", count: 0, sum: 0 });
        e.count++; e.sum += d.total || 0;
        const a = (all[k] ||= { name: nameOnly(d.driver), count: 0 });
        a.count++;
        if (!bestDriver || d.total > bestDriver.total) bestDriver = { name: nameOnly(d.driver), total: r1(d.total), year: rc.year, pids: [s.pid] };
        else if (d.total === bestDriver.total && bestDriver.name === nameOnly(d.driver) && !bestDriver.pids.includes(s.pid)) bestDriver.pids.push(s.pid);
      });
    });
  });
  const perManager = PLAYERS.map(p => {
    const m = mgr[p.id];
    const topPicks = Object.values(m.picks)
      .map(e => ({ name: e.name, num: e.num, count: e.count, avg: r1(e.sum / e.count) }))
      .sort((a, b) => b.count - a.count || b.avg - a.avg).slice(0, 3);
    return { pid: p.id, races: m.races, wins: m.wins, avg: m.races ? r1(m.sum / m.races) : null, best: m.best, topPicks };
  });
  const hot = Object.values(all).sort((a, b) => b.count - a.count)[0];
  return { perManager, bestDriver, hotSeat: hot && hot.count > 1 ? hot : null };
}
