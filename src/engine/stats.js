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

// ── Driver finish streaks ─────────────────────────────────────────────────────

// Returns drivers currently on a notable consecutive top-5 or top-10 finish streak.
export function getDriverStreaks(data) {
  const orderedWeeks = Object.keys(data.results || {})
    .filter(k => data.results[k].raw?.drivers?.length)
    .map(k => parseInt(k.replace("w", "")))
    .sort((a, b) => a - b);

  const streaks = {}; // name -> { top5, top10 }

  orderedWeeks.forEach(w => {
    const drivers = data.results["w" + w].raw.drivers;
    drivers.forEach(d => {
      if (!streaks[d.name]) streaks[d.name] = { top5: 0, top10: 0 };
      if (d.finish <= 5) {
        streaks[d.name].top5++;
        streaks[d.name].top10++;
      } else if (d.finish <= 10) {
        streaks[d.name].top5 = 0;
        streaks[d.name].top10++;
      } else {
        streaks[d.name].top5 = 0;
        streaks[d.name].top10 = 0;
      }
    });
    // Drivers absent from the race: don't reset their streak
  });

  return Object.entries(streaks)
    .filter(([, s]) => s.top5 >= 2 || s.top10 >= 3)
    .map(([name, s]) => ({ name, top5: s.top5, top10: s.top10 }))
    .sort((a, b) => b.top5 - a.top5 || b.top10 - a.top10)
    .slice(0, 12);
}

// ── Season awards ─────────────────────────────────────────────────────────────

export function getSeasonAwards(data) {
  const orderedWeeks = Object.keys(data.results || {})
    .filter(k => data.results[k].raw?.drivers?.length && data.results[k].scored)
    .map(k => parseInt(k.replace("w", "")))
    .sort((a, b) => a - b);

  if (orderedWeeks.length < 2) return null;

  // 1. Consistency King — lowest coefficient of variation across weekly scores
  const playerWeeklyScores = {};
  PLAYERS.forEach(p => { playerWeeklyScores[p.id] = []; });
  orderedWeeks.forEach(w => {
    const scored = data.results["w" + w].scored || {};
    PLAYERS.forEach(p => {
      if (scored[p.id] != null) playerWeeklyScores[p.id].push(scored[p.id].total);
    });
  });

  let consistencyKing = null, lowestCV = Infinity;
  PLAYERS.forEach(p => {
    const scores = playerWeeklyScores[p.id];
    if (scores.length < 2) return;
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (mean <= 0) return;
    const stddev = Math.sqrt(scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length);
    const cv = stddev / mean;
    if (cv < lowestCV) {
      lowestCV = cv;
      consistencyKing = { pid: p.id, mean: Math.round(mean * 10) / 10, stddev: Math.round(stddev * 10) / 10, weeks: scores.length };
    }
  });

  // 2. Sleeper Hit — highest single-race score by a driver nobody picked
  let sleeperHit = null;
  orderedWeeks.forEach(w => {
    const key = "w" + w;
    const wr = data.results[key];
    const weekPicks = data.picks?.[key] || {};
    const pickedDrivers = new Set(
      Object.values(weekPicks).flatMap(picks => (picks || []).map(pk => pk.driver).filter(Boolean))
    );
    const trackType = trackTypeForWeek(w);
    const threeStages = !!wr.raw.threeStages;
    const raceInfo = SCHEDULE.find(s => s.w === w);
    wr.raw.drivers.forEach(d => {
      if (pickedDrivers.has(d.name)) return;
      const sc = calcDriverScore(d, trackType, false, threeStages);
      if (sc.total > 0 && (!sleeperHit || sc.total > sleeperHit.score)) {
        sleeperHit = { name: d.name, score: sc.total, week: w, race: raceInfo?.r || "" };
      }
    });
  });

  // 3. Eye of the Tiger — player who had the race winner in their lineup most often
  const winnerPickCounts = {};
  PLAYERS.forEach(p => { winnerPickCounts[p.id] = 0; });
  orderedWeeks.forEach(w => {
    const key = "w" + w;
    const wr = data.results[key];
    const raceWinner = wr.raw.drivers.find(d => d.finish === 1)?.name;
    if (!raceWinner) return;
    const weekPicks = data.picks?.[key] || {};
    PLAYERS.forEach(p => {
      if ((weekPicks[p.id] || []).some(pk => pk.driver === raceWinner)) winnerPickCounts[p.id]++;
    });
  });
  const bestEye = PLAYERS.reduce(
    (best, p) => winnerPickCounts[p.id] > (winnerPickCounts[best?.id] ?? -1) ? p : best,
    null
  );
  const eyeOfTiger = bestEye && winnerPickCounts[bestEye.id] > 0
    ? { pid: bestEye.id, count: winnerPickCounts[bestEye.id] }
    : null;

  // 4. Comeback King — biggest single-race position gain (qualPos → finish)
  let comebackKing = null;
  orderedWeeks.forEach(w => {
    const wr = data.results["w" + w];
    const raceInfo = SCHEDULE.find(s => s.w === w);
    wr.raw.drivers.forEach(d => {
      if (!d.qualPos || !d.finish || d.qualPos <= 0 || d.finish <= 0) return;
      const gain = d.qualPos - d.finish;
      if (gain > 0 && (!comebackKing || gain > comebackKing.gain)) {
        comebackKing = { name: d.name, gain, qualPos: d.qualPos, finish: d.finish, week: w, race: raceInfo?.r || "" };
      }
    });
  });

  // 5. Best Mulligan — biggest pts gain from a single mulligan swap
  let bestMulligan = null;
  PLAYERS.forEach(p => {
    (data.mulligans?.[p.id] || []).forEach(mul => {
      const key = "w" + mul.week;
      const wr = data.results?.[key];
      if (!wr?.raw?.drivers) return;
      const trackType = trackTypeForWeek(mul.week);
      const threeStages = !!wr.raw.threeStages;
      const origData = wr.raw.drivers.find(d => d.name === mul.driver);
      const newData  = wr.raw.drivers.find(d => d.name === mul.replacement);
      if (!origData || !newData) return;
      const origScore = calcDriverScore(origData, trackType, false, threeStages).total;
      const newScore  = calcDriverScore(newData,  trackType, true,  threeStages).total;
      const gain = Math.round((newScore - origScore) * 10) / 10;
      if (!bestMulligan || gain > bestMulligan.gain) {
        bestMulligan = { pid: p.id, gain, origDriver: mul.driver, origScore, newDriver: mul.replacement, newScore, week: mul.week };
      }
    });
  });

  return { consistencyKing, sleeperHit, eyeOfTiger, comebackKing, bestMulligan };
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
