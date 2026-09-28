import { PLAYERS, ACTIVE_PICKS, PICKS_PER_WEEK, GARAGE_PICK_ENABLED, SCHEDULE, DRIVERS, PLAYOFF_START_WEEK, isMemorial, isPartTime } from "../constants.js";
import { calcDriverScore } from "./scoring.js";
import { getChaseEntryTotals } from "./chase.js";

export function getDraftOrder(data, currentWeek) {
  // W27 only: draft order is the INVERSE of the Chase-entering standings —
  // whoever leads the Chase picks last, last place picks first. Every other
  // week (including W28+) uses the normal "previous week's loser picks
  // first" rule below.
  if (currentWeek === PLAYOFF_START_WEEK) {
    const { totals } = getChaseEntryTotals(data);
    return PLAYERS.map(p => ({ id: p.id, total: totals[p.id] ?? 1000 }))
      .sort((a, b) => a.total - b.total)
      .map(s => s.id);
  }
  const prev = data.results?.["w" + (currentWeek - 1)];
  if (!prev?.scored) return PLAYERS.map(p => p.id);
  return PLAYERS.map(p => ({ id: p.id, score: prev.scored[p.id]?.total || 0 }))
    .sort((a, b) => a.score - b.score)
    .map(s => s.id);
}

export function buildSnakeOrder(order) {
  const seq = [];
  const rounds = GARAGE_PICK_ENABLED ? PICKS_PER_WEEK : ACTIVE_PICKS;
  for (let r = 0; r < rounds; r++) {
    order.forEach(pid => seq.push({ pid, round: r + 1 }));
  }
  return seq;
}

// Next Monday at 5:00 PM (local time, same convention as the rest of the
// schedule) from a given moment. If it's already Monday past 5pm, rolls to
// the following Monday. Used to gate the draft open — it no longer starts
// the instant results are posted.
export function getNextDraftOpenTime(fromDate = new Date()) {
  const d = new Date(fromDate);
  const day = d.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const daysUntilMonday = (1 - day + 7) % 7;
  const candidate = new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysUntilMonday, 17, 0, 0, 0);
  if (candidate <= d) candidate.setDate(candidate.getDate() + 7);
  return candidate;
}

// Canonical driver lookup by car number so raw-result names with feed quirks
// ("#88 Connor Zilisch #") still credit the right driver.
const DRIVER_BY_NUM = {};
DRIVERS.forEach(d => {
  const m = d.match(/^#(\S+)\s/);
  if (m) DRIVER_BY_NUM[m[1]] = d;
});
function canonicalName(rawName) {
  const num = (String(rawName).match(/^#(\S+)\s/) || [])[1];
  return (num && DRIVER_BY_NUM[num]) || rawName;
}

// Best undrafted driver for autopick. Ranks by average FERDA pts per race at
// THIS week's track type (mirrors the "Best drivers at X tracks" feed list);
// falls back to overall season totals when no same-type races are scored yet.
// Part-time/limited-schedule drivers (Corey Heim, Jimmie Johnson, shared
// rides, etc. — see DRIVER_INFO.partTime in constants.js) are excluded so a
// rare good outing doesn't get autopicked into a lineup for a race they
// might not even be entered in. Only falls back to including them if no
// full-time driver is left undrafted at all.
export function getBestAvailableDriver(data, takenSet, week) {
  const ty = SCHEDULE.find(s => s.w === week)?.ty || "intermediate";
  const stats = {};   // canonical name → { typeTotal, typeRaces, total }

  Object.entries(data.results || {}).forEach(([key, wr]) => {
    if (!wr.raw?.drivers) return;
    const w   = parseInt(key.replace("w", ""));
    const wty = SCHEDULE.find(s => s.w === w)?.ty || "intermediate";
    const three = !!wr.raw.threeStages;
    wr.raw.drivers.forEach(d => {
      const name = canonicalName(d.name);
      if (!stats[name]) stats[name] = { typeTotal: 0, typeRaces: 0, total: 0 };
      const sc = calcDriverScore(d, wty, false, three).total;
      stats[name].total += sc;
      if (wty === ty) { stats[name].typeTotal += sc; stats[name].typeRaces++; }
    });
  });

  const rank = (candidates) => {
    const byTypeAvg = candidates
      .filter(d => (stats[d]?.typeRaces || 0) > 0)
      .sort((a, b) =>
        (stats[b].typeTotal / stats[b].typeRaces) - (stats[a].typeTotal / stats[a].typeRaces)
      );
    if (byTypeAvg.length) return byTypeAvg[0];

    return candidates
      .filter(d => (stats[d]?.total || 0) > 0)
      .sort((a, b) => (stats[b]?.total || 0) - (stats[a]?.total || 0))[0]
      ?? candidates[0]
      ?? null;
  };

  const allCandidates = DRIVERS.filter(d => !takenSet.has(d) && !isMemorial(d));
  const fullTimeCandidates = allCandidates.filter(d => !isPartTime(d));
  return rank(fullTimeCandidates) ?? rank(allCandidates);
}
