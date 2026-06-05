import {
  PLAYERS, FINISH_POINTS, STAGE_POINTS, TRACK_MULTS,
  SCHEDULE, ACTIVE_PICKS, GARAGE_PICK_ENABLED, PICKS_PER_WEEK,
} from "../constants.js";
import { HISTORICAL_PICKS, HISTORICAL_RESULTS } from "../historicalData.js";

const LAST_HISTORICAL_WEEK = 14;

export function calcDriverScore(driver, trackType, isMulligan, threeStages) {
  const mult = TRACK_MULTS[trackType] || 0.5;
  const bd = [];
  let score = 0;

  if (driver.dq) return { total: -5, breakdown: [{ label: "DQ", pts: -5 }], bonusPoints: 0 };
  if (driver.dnf) bd.push({ label: "DNF", pts: 0 });

  const fp = FINISH_POINTS[driver.finish] || 1;
  score += fp;
  bd.push({ label: "P" + driver.finish, pts: fp });

  if (isMulligan) {
    if (driver.qualPos && driver.finish) {
      let net = driver.qualPos - driver.finish;
      net = Math.max(-10, Math.min(10, net));
      if (net !== 0) { score += net; bd.push({ label: "Net Q" + driver.qualPos + ">P" + driver.finish, pts: net }); }
    }
    bd.push({ label: "Mulligan", pts: 0 });
    return { total: Math.round(score * 100) / 100, breakdown: bd, bonusPoints: 0 };
  }

  if (driver.finish <= 5)       { score += 2; bd.push({ label: "Top 5",  pts: 2 }); }
  else if (driver.finish <= 10) { score += 1; bd.push({ label: "Top 10", pts: 1 }); }

  if (driver.stage1 > 0 && driver.stage1 <= 10) { const sp = STAGE_POINTS[driver.stage1]; score += sp; bd.push({ label: "S1:P" + driver.stage1, pts: sp }); }
  if (driver.stage2 > 0 && driver.stage2 <= 10) { const sp = STAGE_POINTS[driver.stage2]; score += sp; bd.push({ label: "S2:P" + driver.stage2, pts: sp }); }
  if (driver.stage3 > 0 && driver.stage3 <= 10) { const sp = STAGE_POINTS[driver.stage3]; score += sp; bd.push({ label: "S3:P" + driver.stage3, pts: sp }); }

  if (driver.lapsLed > 0) {
    const lp = Math.round(driver.lapsLed * mult * 10) / 10;
    score += lp;  bd.push({ label: driver.lapsLed + "laps*" + mult, pts: lp });
    score += 0.5; bd.push({ label: "Led a lap", pts: 0.5 });
  }

  if (driver.qualPos && driver.finish) {
    let net = driver.qualPos - driver.finish;
    net = Math.max(-10, Math.min(10, net));
    if (net !== 0) { score += net; bd.push({ label: "Net Q" + driver.qualPos + ">P" + driver.finish, pts: net }); }
  }

  let bp = 0;
  if (driver.pole)       { score += 5;   bp += 5;   bd.push({ label: "Pole",     pts: 5   }); }
  if (driver.stageWin1)  { score += 2.5; bp += 2.5; bd.push({ label: "S1 Win",   pts: 2.5 }); }
  if (driver.stageWin2)  { score += 2.5; bp += 2.5; bd.push({ label: "S2 Win",   pts: 2.5 }); }
  if (driver.stageWin3)  { score += 2.5; bp += 2.5; bd.push({ label: "S3 Win",   pts: 2.5 }); }
  if (driver.fastestLap) { score += 1;   bp += 1;   bd.push({ label: "Fast Lap", pts: 1   }); }
  if (driver.mostLapsLed){ score += 5;   bp += 5;   bd.push({ label: "Most Led", pts: 5   }); }

  const sweep = threeStages
    ? (driver.pole && driver.stageWin1 && driver.stageWin2 && driver.stageWin3)
    : (driver.pole && driver.stageWin1 && driver.stageWin2);
  if (sweep) { score += 12.5; bp += 12.5; bd.push({ label: "SWEEP!", pts: 12.5 }); }

  return { total: Math.round(score * 100) / 100, breakdown: bd, bonusPoints: bp };
}

export function scoreWeekFull(picks, raceResult, week, mullData) {
  const ty = SCHEDULE.find(s => s.w === week)?.ty || "intermediate";
  const threeStages = !!raceResult.threeStages;
  const ps = {};
  const raceWinner = raceResult.drivers?.find(d => d.finish === 1)?.name;

  PLAYERS.forEach(p => {
    const allPicks = picks[p.id] || [];
    const activePicks = allPicks.filter(pk => !pk.garage);
    const garagePick = allPicks.find(pk => pk.garage);
    let finalPicks = [...activePicks];
    if (garagePick?.garageActivated && garagePick.garageReplace) {
      finalPicks = finalPicks.filter(pk => pk.driver !== garagePick.garageReplace);
      finalPicks.push({ driver: garagePick.driver, mulligan: false, garageUsed: true });
    }

    let wt = 0, wb = 0;
    const ds = [];
    let hadWinner = false, topDriverScore = 0;

    finalPicks.forEach(pick => {
      const r = raceResult.drivers?.find(d => d.name === pick.driver);
      if (!r) {
        ds.push({ driver: pick.driver, total: 0, breakdown: [{ label: "Did not race", pts: 0 }], bonusPoints: 0, isMulligan: !!pick.mulligan, dnr: true });
        return;
      }
      const im = pick.mulligan || (!pick.garageUsed && mullData?.[p.id]?.some(m => m.week === week && m.driver === pick.driver));
      const sc = calcDriverScore(r, ty, im, threeStages);
      wt += sc.total;
      wb += sc.bonusPoints;
      if (pick.driver === raceWinner && !im) hadWinner = true;
      if (sc.total > topDriverScore) topDriverScore = sc.total;
      ds.push({ driver: pick.driver, total: sc.total, breakdown: sc.breakdown, bonusPoints: sc.bonusPoints, isMulligan: !!im, isGarage: !!pick.garageUsed });
    });

    ps[p.id] = {
      total: Math.round(wt * 100) / 100,
      bonusPoints: Math.round(wb * 100) / 100,
      drivers: ds,
      weeklyWin: false,
      hadWinner,
      topDriverScore: Math.round(topDriverScore * 100) / 100,
    };
  });

  const ranked = Object.entries(ps).sort((a, b) => {
    if (b[1].total !== a[1].total) return b[1].total - a[1].total;
    if (b[1].hadWinner !== a[1].hadWinner) return (b[1].hadWinner ? 1 : 0) - (a[1].hadWinner ? 1 : 0);
    return b[1].topDriverScore - a[1].topDriverScore;
  });
  if (ranked.length > 0) ps[ranked[0][0]].weeklyWin = true;

  return ps;
}

export function scoreAllWeeks(data) {
  const d = JSON.parse(JSON.stringify(data));
  const fs = { justin: 0, bigmonroe: 0, monroe: 0, rich: 0 };
  const fp = { justin: 0, bigmonroe: 0, monroe: 0, rich: 0 };
  let last = 0;

  Object.entries(d.results || {}).forEach(([key, wr]) => {
    const w = parseInt(key.replace("w", ""));
    if (!wr.raw?.drivers) return;
    const wp = d.picks?.[key] || {};
    const mo = {};
    PLAYERS.forEach(p => { mo[p.id] = (wp[p.id] || []).filter(pk => pk.mulligan).map(pk => ({ week: w, driver: pk.driver })); });
    const scored = scoreWeekFull(wp, wr.raw, w, mo);
    d.results[key].scored = scored;
    if (w > last) last = w;
    Object.entries(scored).forEach(([pid, s]) => {
      fs[pid] = Math.round((fs[pid] + s.total) * 100) / 100;
      fp[pid] = Math.round((fp[pid] + (s.bonusPoints || 0)) * 100) / 100;
      if (s.weeklyWin) fp[pid] = Math.round((fp[pid] + 25) * 100) / 100;
    });
  });

  const mc = { justin: 0, bigmonroe: 0, monroe: 0, rich: 0 };
  Object.entries(d.picks || {}).forEach(([, wp]) => {
    Object.entries(wp).forEach(([pid, pks]) => { (pks || []).forEach(pk => { if (pk.mulligan) mc[pid]++; }); });
  });

  d.meta = { ...d.meta, standings: fs, playoffPts: fp, mulligansUsed: mc, lastScoredWeek: last };
  return d;
}

export function buildInitialData() {
  const results = {}, picks = {};
  for (let w = 1; w <= LAST_HISTORICAL_WEEK; w++) {
    const key = "w" + w;
    const rawResult = HISTORICAL_RESULTS[key];
    const weekPicks = HISTORICAL_PICKS[key];
    if (!rawResult || !weekPicks) continue;
    results[key] = { raw: rawResult, scored: null };
    picks[key] = weekPicks;
  }
  return scoreAllWeeks({
    results,
    picks,
    drafts: {},
    mulligans: { justin: [], bigmonroe: [], monroe: [], rich: [] },
    playerSettings: {},
    meta: {
      standings: { justin: 0, bigmonroe: 0, monroe: 0, rich: 0 },
      playoffPts: { justin: 0, bigmonroe: 0, monroe: 0, rich: 0 },
      mulligansUsed: { justin: 0, bigmonroe: 0, monroe: 0, rich: 0 },
      lastScoredWeek: LAST_HISTORICAL_WEEK,
    },
  });
}
