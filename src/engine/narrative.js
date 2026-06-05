// ─── Narrative Engine ──────────────────────────────────────────────────────────
// Generates structured story data from scored results and season data.
// All functions are pure — no React, no Firebase.

import { SCHEDULE, PLAYERS, PNAME } from "../constants.js";
import { calcDriverScore } from "./scoring.js";
import { getWeekTopDrivers, getDriverSeasonStats, getSeasonRecords } from "./stats.js";
import { getWeeklyFinishes } from "./history.js";

// ─── Track-specific driver performance ────────────────────────────────────────

// Returns driver stats filtered to a specific track type only.
// Used for pre-race pick suggestions based on relevant history.
export function getDriverStatsByTrackType(data, trackType) {
  const stats = {};
  const init = (name) => {
    if (!stats[name]) stats[name] = { name, appearances:0, totalPts:0, bestScore:0, bestWeek:null };
  };

  Object.entries(data.results || {}).forEach(([key, wr]) => {
    if (!wr.raw?.drivers) return;
    const week     = parseInt(key.replace("w",""));
    const weekInfo = SCHEDULE.find(s => s.w === week);
    if (weekInfo?.ty !== trackType) return;           // only matching track type

    const threeStages = !!wr.raw.threeStages;
    wr.raw.drivers.forEach(d => {
      init(d.name);
      const sc = calcDriverScore(d, trackType, false, threeStages);
      stats[d.name].appearances++;
      stats[d.name].totalPts = Math.round((stats[d.name].totalPts + sc.total) * 100) / 100;
      if (sc.total > stats[d.name].bestScore) {
        stats[d.name].bestScore = sc.total;
        stats[d.name].bestWeek  = week;
      }
    });
  });

  return Object.values(stats)
    .map(s => ({
      ...s,
      avgScore: s.appearances > 0 ? Math.round((s.totalPts / s.appearances) * 10) / 10 : 0,
    }))
    .filter(s => s.appearances > 0)
    .sort((a, b) => b.avgScore - a.avgScore);
}

// ─── Full week recap ───────────────────────────────────────────────────────────

export function generateFullRecap(week, data) {
  const key      = "w" + week;
  const wr       = data.results?.[key];
  if (!wr?.scored || !wr?.raw?.drivers) return null;

  const weekInfo    = SCHEDULE.find(s => s.w === week);
  const trackType   = weekInfo?.ty || "intermediate";
  const threeStages = !!wr.raw.threeStages;

  // Player standings for this week
  const weekStandings = Object.entries(wr.scored)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([pid, s], i) => ({ pid, total:s.total, position:i+1, weeklyWin:s.weeklyWin, bonusPoints:s.bonusPoints||0 }));

  const weekWinner = weekStandings[0];
  const weekLoser  = weekStandings[weekStandings.length - 1];

  // Race winner (P1 in the actual NASCAR race)
  const raceWinner = wr.raw.drivers.find(d => d.finish === 1);

  // Who picked the race winner
  const raceWinnerPickers = [];
  Object.entries(data.picks?.[key] || {}).forEach(([pid, picks]) => {
    if ((picks || []).some(pk => pk.driver === raceWinner?.name && !pk.mulligan)) {
      raceWinnerPickers.push(pid);
    }
  });

  // MVP driver (highest FERDA scorer)
  const topDrivers = getWeekTopDrivers(wr.raw, week, 5);
  const mvp = topDrivers[0] || null;

  // All drivers picked this week
  const pickedDrivers = new Set();
  const pickerMap = {};
  Object.entries(data.picks?.[key] || {}).forEach(([pid, picks]) => {
    (picks || []).forEach(pk => {
      if (pk.driver) {
        pickedDrivers.add(pk.driver);
        if (!pickerMap[pk.driver]) pickerMap[pk.driver] = [];
        pickerMap[pk.driver].push(pid);
      }
    });
  });

  // Biggest miss (highest scorer that nobody drafted)
  const biggestMiss = topDrivers.find(d => !pickedDrivers.has(d.name)) || null;

  // Who contributed the highest single-driver score that was drafted
  let bestPickedDriver = null;
  topDrivers.forEach(d => {
    if (pickedDrivers.has(d.name) && !bestPickedDriver) {
      bestPickedDriver = { ...d, pickedBy: pickerMap[d.name] || [] };
    }
  });

  // Mulligan report
  const mulliganReport = [];
  const mulliganHistory = data.mulligans || {};
  Object.entries(data.picks?.[key] || {}).forEach(([pid, picks]) => {
    const mulls = (picks || []).filter(pk => pk.mulligan);
    mulls.forEach(pk => {
      // Find what they replaced
      const histEntry = (mulliganHistory[pid] || []).find(m => m.week === week && m.replacement === pk.driver);
      const replacedName = histEntry?.driver || null;

      const newDriver = wr.raw.drivers.find(d => d.name === pk.driver);
      const oldDriver = replacedName ? wr.raw.drivers.find(d => d.name === replacedName) : null;

      const newScore  = newDriver  ? calcDriverScore(newDriver,  trackType, true,  threeStages).total : null;
      const oldScore  = oldDriver  ? calcDriverScore(oldDriver,  trackType, false, threeStages).total : null;

      mulliganReport.push({
        pid,
        replacement:   pk.driver,
        replacedDriver: replacedName,
        newScore,
        oldScore,
        netGain: (newScore != null && oldScore != null) ? Math.round((newScore - oldScore) * 100) / 100 : null,
        helped: newScore != null && oldScore != null ? newScore > oldScore : null,
      });
    });
  });

  // Standings impact: current cumulative standings
  const cumStandings = Object.entries(data.meta.standings)
    .sort((a, b) => b[1] - a[1])
    .map(([pid, pts], i) => ({ pid, pts, position:i+1 }));

  // Season pts gap at top
  const gapAtTop = cumStandings.length >= 2 ? cumStandings[0].pts - cumStandings[1].pts : 0;

  return {
    week,
    raceName:   weekInfo?.r || `Week ${week}`,
    track:      weekInfo?.t || "",
    trackType,
    date:       weekInfo?.d || "",
    threeStages,
    weekWinner,
    weekLoser,
    weekStandings,
    raceWinner:        raceWinner?.name || null,
    raceWinnerPickers,
    topDrivers,
    mvp,
    biggestMiss,
    bestPickedDriver,
    mulliganReport,
    cumStandings,
    gapAtTop,
    marginOfVictory: weekStandings.length >= 2
      ? Math.round((weekStandings[0].total - weekStandings[1].total) * 100) / 100
      : 0,
  };
}

// ─── Week preview ─────────────────────────────────────────────────────────────

export function generateWeekPreview(nextWeek, data) {
  const weekInfo = SCHEDULE.find(s => s.w === nextWeek);
  if (!weekInfo) return null;

  // Draft order (computed from last week's results)
  const lastWeekKey  = "w" + (nextWeek - 1);
  const lastWeekScored = data.results?.[lastWeekKey]?.scored;
  let draftOrder;
  if (lastWeekScored) {
    draftOrder = Object.entries(lastWeekScored)
      .sort((a, b) => a[1].total - b[1].total)  // loser first
      .map(([pid]) => pid);
  } else {
    draftOrder = PLAYERS.map(p => p.id);
  }

  // Top drivers by this track type (based on season history)
  const trackStats = getDriverStatsByTrackType(data, weekInfo.ty)
    .filter(s => s.appearances > 0)
    .slice(0, 10);

  // Races of this track type already scored
  const racesOfType = Object.entries(data.results || {})
    .filter(([key, wr]) => {
      const w = parseInt(key.replace("w",""));
      return SCHEDULE.find(s => s.w === w)?.ty === weekInfo.ty && wr.raw?.drivers;
    })
    .length;

  // Standings pressure: points gap for each player to next position
  const cumStandings = Object.entries(data.meta.standings)
    .sort((a, b) => b[1] - a[1])
    .map(([pid, pts], i, arr) => ({
      pid, pts, position:i+1,
      gapToNext: i > 0 ? arr[i-1][1] - pts : 0,
      gapToFirst: arr[0][1] - pts,
    }));

  // Who's "in danger" / "on fire"
  const pressureNarratives = [];
  cumStandings.forEach((s, i) => {
    if (i === 0) {
      const gap = s.pts - (cumStandings[1]?.pts || 0);
      pressureNarratives.push({ pid:s.pid, type:"leader", text:`Leads by ${gap.toLocaleString()} pts — needs consistency to stay ahead` });
    } else if (s.gapToNext <= 100 && s.gapToNext > 0) {
      pressureNarratives.push({ pid:s.pid, type:"close", text:`Only ${s.gapToNext} pts behind ${PNAME[cumStandings[i-1].pid]} — within striking distance` });
    } else if (s.gapToFirst > 300) {
      pressureNarratives.push({ pid:s.pid, type:"needs_big", text:`${s.gapToFirst} pts back — needs a career week` });
    }
  });

  return {
    week:         nextWeek,
    raceName:     weekInfo.r,
    track:        weekInfo.t,
    trackType:    weekInfo.ty,
    date:         weekInfo.d,
    draftOrder,
    trackStats,
    racesOfType,
    cumStandings,
    pressureNarratives,
  };
}

// ─── Season storylines ────────────────────────────────────────────────────────

export function getSeasonStorylines(data) {
  const lines = [];
  const results   = data.results || {};
  const standings = data.meta.standings;
  const pp        = data.meta.playoffPts;

  const sorted = Object.entries(standings).sort((a, b) => b[1] - a[1]);
  if (sorted.length < 2) return lines;

  const [leadPid, leadPts] = sorted[0];
  const [, secondPts]      = sorted[1];
  const gap = leadPts - secondPts;

  // Standings leader
  lines.push({
    icon:"🏁", weight:"high",
    text:`${PNAME[leadPid]} leads the regular season with ${leadPts.toLocaleString()} pts — ${gap} ahead of the field.`,
  });

  // Playoff points leader
  const ppSorted = Object.entries(pp).sort((a,b) => b[1]-a[1]);
  if (ppSorted[0][1] > 0) {
    lines.push({
      icon:"⚡", weight:"medium",
      text:`${PNAME[ppSorted[0][0]]} has banked the most playoff points (${ppSorted[0][1]}) — enters the chase in the strongest position.`,
    });
  }

  // Win counts
  const wins = Object.fromEntries(
    PLAYERS.map(p => [p.id, Object.values(results).filter(r => r.scored?.[p.id]?.weeklyWin).length])
  );
  const winEntries = Object.entries(wins).sort((a,b) => b[1]-a[1]);
  if (winEntries[0][1] >= 2) {
    lines.push({
      icon:"👑", weight:"high",
      text:`${PNAME[winEntries[0][0]]} leads the weekly win count with ${winEntries[0][1]} wins.`,
    });
  }

  // Current streaks
  const finishMap = getWeeklyFinishes(data);
  PLAYERS.forEach(p => {
    const hist = finishMap[p.id] || [];
    if (hist.length < 2) return;
    const last = hist[hist.length - 1];
    const prev = hist[hist.length - 2];
    if (last.weeklyWin && prev.weeklyWin) {
      lines.push({ icon:"🔥", weight:"high", text:`${PNAME[p.id]} is on a hot streak — back-to-back weekly wins.` });
    }
  });

  // Nobody used mulligans
  const noMulls = PLAYERS.filter(p => (data.meta.mulligansUsed[p.id] || 0) === 0);
  if (noMulls.length === 1) {
    lines.push({ icon:"💎", weight:"medium", text:`${PNAME[noMulls[0].id]} is the only player yet to use a mulligan — still at 10/10.` });
  } else if (noMulls.length > 1) {
    lines.push({ icon:"💎", weight:"medium", text:`${noMulls.map(p=>PNAME[p.id]).join(" and ")} haven't used a mulligan all season.` });
  }

  // Heavy mulligan user
  const heavyMull = Object.entries(data.meta.mulligansUsed).sort((a,b)=>b[1]-a[1])[0];
  if (heavyMull[1] >= 4) {
    lines.push({ icon:"🔄", weight:"low", text:`${PNAME[heavyMull[0]]} has used ${heavyMull[1]} mulligans — burning through the season supply.` });
  }

  // Season most scored week (best player performance)
  const records = getSeasonRecords(data);
  if (records.bestPlayerWeek) {
    const bw = records.bestPlayerWeek;
    lines.push({ icon:"🚀", weight:"high", text:`Season high: ${PNAME[bw.pid]} scored ${bw.score} pts at ${bw.race} (W${bw.week}).` });
  }

  // Most missed big driver
  const driverStats = getDriverSeasonStats(data);
  const topUnpicked = driverStats
    .filter(s => s.neverPicked && s.totalFerdaPts > 50)
    .sort((a,b) => b.totalFerdaPts - a.totalFerdaPts)[0];
  if (topUnpicked) {
    lines.push({ icon:"😤", weight:"medium", text:`${topUnpicked.name} has scored ${topUnpicked.totalFerdaPts} pts this season — and nobody has ever drafted them.` });
  }

  // Season closeness
  const gap4to1 = sorted[0][1] - sorted[sorted.length-1][1];
  if (gap4to1 < 250) {
    lines.push({ icon:"🎯", weight:"medium", text:`The season is tight — only ${gap4to1} pts separate 1st from last place.` });
  }

  return lines;
}
