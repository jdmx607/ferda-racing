// ─── FERDA Stats Engine ───────────────────────────────────────────────────────
// Pure functions — no React, no Firebase, no side effects.
// All inputs come from the Firestore data shape + HISTORICAL data.

import { calcDriverScore } from "./scoring.js";
import { SCHEDULE, PLAYERS } from "../constants.js";

// ── Weekly helpers ────────────────────────────────────────────────────────────

function trackTypeForWeek(week) {
  return SCHEDULE.find(s => s.w === week)?.ty || "intermediate";
}

// Score every driver in a raw race result and return top N.
// Uses full scoring (not mulligan) so scores match what players "could have" earned.
export function getWeekTopDrivers(rawResult, week, n = 5) {
  const trackType   = trackTypeForWeek(week);
  const threeStages = !!rawResult.threeStages;
  return (rawResult.drivers || [])
    .map(d => ({ ...d, ...calcDriverScore(d, trackType, false, threeStages) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, n);
}

// ── Season aggregates ─────────────────────────────────────────────────────────

// Returns per-driver season stats across all scored weeks.
export function getDriverSeasonStats(data) {
  const stats = {};

  const init = (name) => {
    if (!stats[name]) {
      stats[name] = {
        name,
        appearances: 0,
        pickCount: 0,
        pickedBy: {},           // pid -> times picked
        totalFerdaPts: 0,
        bestScore: 0,
        bestWeek: null,
        bestRace: null,
      };
    }
  };

  const scoredWeeks = Object.entries(data.results || {}).filter(([, wr]) => wr.raw?.drivers);

  scoredWeeks.forEach(([key, wr]) => {
    const week        = parseInt(key.replace("w", ""));
    const trackType   = trackTypeForWeek(week);
    const threeStages = !!wr.raw.threeStages;
    const raceInfo    = SCHEDULE.find(s => s.w === week);

    // Map driver name → pickers this week
    const pickerMap = {};
    Object.entries(data.picks?.[key] || {}).forEach(([pid, picks]) => {
      (picks || []).forEach(pk => {
        if (pk.driver) {
          if (!pickerMap[pk.driver]) pickerMap[pk.driver] = [];
          pickerMap[pk.driver].push(pid);
        }
      });
    });

    wr.raw.drivers.forEach(d => {
      init(d.name);
      const sc = calcDriverScore(d, trackType, false, threeStages);
      stats[d.name].appearances++;
      stats[d.name].totalFerdaPts = Math.round((stats[d.name].totalFerdaPts + sc.total) * 100) / 100;

      if (sc.total > stats[d.name].bestScore) {
        stats[d.name].bestScore = sc.total;
        stats[d.name].bestWeek  = week;
        stats[d.name].bestRace  = raceInfo?.r || null;
      }

      const pickers = pickerMap[d.name] || [];
      pickers.forEach(pid => {
        stats[d.name].pickCount++;
        stats[d.name].pickedBy[pid] = (stats[d.name].pickedBy[pid] || 0) + 1;
      });
    });
  });

  const weeksScored = scoredWeeks.length;

  return Object.values(stats).map(s => ({
    ...s,
    avgScore: s.appearances > 0 ? Math.round((s.totalFerdaPts / s.appearances) * 10) / 10 : 0,
    // Pick rate = fraction of player-slots this driver occupied (4 players × N weeks)
    pickRate: weeksScored > 0 ? Math.round((s.pickCount / (weeksScored * 4)) * 100) : 0,
    neverPicked: s.pickCount === 0 && s.appearances > 0,
  }));
}

// ── Season records ────────────────────────────────────────────────────────────

export function getSeasonRecords(data) {
  let bestPlayerWeek   = null; // { pid, week, score, race }
  let bestDriverPerf   = null; // { name, week, score, race, pickedBy }
  const winStreaks     = {};
  const currentStreaks = {};
  PLAYERS.forEach(p => { winStreaks[p.id] = 0; currentStreaks[p.id] = 0; });

  // Sort weeks chronologically for streak calculation
  const orderedWeeks = Object.keys(data.results || {})
    .map(k => parseInt(k.replace("w", "")))
    .sort((a, b) => a - b);

  orderedWeeks.forEach(w => {
    const key  = "w" + w;
    const wr   = data.results[key];
    if (!wr?.scored || !wr.raw?.drivers) return;

    const trackType   = trackTypeForWeek(w);
    const threeStages = !!wr.raw.threeStages;
    const raceInfo    = SCHEDULE.find(s => s.w === w);
    const weekPicks   = data.picks?.[key] || {};

    // Best player week
    Object.entries(wr.scored).forEach(([pid, s]) => {
      if (!bestPlayerWeek || s.total > bestPlayerWeek.score) {
        bestPlayerWeek = { pid, week:w, score:s.total, race:raceInfo?.r };
      }
    });

    // Best individual driver performance
    const pickerMap = {};
    Object.entries(weekPicks).forEach(([pid, picks]) => {
      (picks || []).forEach(pk => {
        if (pk.driver) {
          if (!pickerMap[pk.driver]) pickerMap[pk.driver] = [];
          pickerMap[pk.driver].push(pid);
        }
      });
    });

    wr.raw.drivers.forEach(d => {
      const sc = calcDriverScore(d, trackType, false, threeStages);
      if (!bestDriverPerf || sc.total > bestDriverPerf.score) {
        bestDriverPerf = {
          name:d.name, week:w, score:sc.total,
          race:raceInfo?.r, pickedBy:pickerMap[d.name] || [],
        };
      }
    });

    // Win streak tracking
    const winner = Object.entries(wr.scored).sort((a,b) => b[1].total - a[1].total)[0]?.[0];
    PLAYERS.forEach(p => {
      if (p.id === winner) {
        currentStreaks[p.id]++;
        winStreaks[p.id] = Math.max(winStreaks[p.id], currentStreaks[p.id]);
      } else {
        currentStreaks[p.id] = 0;
      }
    });
  });

  return { bestPlayerWeek, bestDriverPerf, winStreaks, currentStreaks };
}

// ── Weekly recap blurb ────────────────────────────────────────────────────────

export function generateWeekRecap(week, scoredResult, rawResult) {
  if (!scoredResult || !rawResult?.drivers) return null;

  const sorted      = Object.entries(scoredResult).sort((a,b) => b[1].total - a[1].total);
  const winnerEntry = sorted[0];
  const loserEntry  = sorted[sorted.length - 1];
  const raceWinner  = rawResult.drivers.find(d => d.finish === 1);
  const topDrivers  = getWeekTopDrivers(rawResult, week, 1);
  const mvp         = topDrivers[0];
  const raceInfo    = SCHEDULE.find(s => s.w === week);

  return {
    winnerPid:    winnerEntry?.[0],
    winnerScore:  winnerEntry?.[1].total,
    loserPid:     loserEntry?.[0],
    loserScore:   loserEntry?.[1].total,
    raceWinner:   raceWinner?.name,
    hadWinner:    winnerEntry?.[1].hadWinner,
    mvpDriver:    mvp?.name,
    mvpScore:     mvp?.total,
    mvpWasPicked: mvp ? Object.entries(scoredResult).some(([,s]) =>
                    s.drivers?.some(d => d.driver === mvp.name && !d.dnr)
                  ) : false,
    race:         raceInfo?.r,
    track:        raceInfo?.t,
  };
}
