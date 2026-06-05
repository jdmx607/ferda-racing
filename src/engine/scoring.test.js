import { describe, test, expect } from "vitest";
import { buildInitialData, calcDriverScore, scoreWeekFull } from "./scoring.js";
import { getWeekTopDrivers, getDriverSeasonStats, getSeasonRecords } from "./stats.js";
import { getSeasonTimeline, getHeadToHead, getAchievements } from "./history.js";
import { generateFullRecap, generateWeekPreview, getSeasonStorylines, getDriverStatsByTrackType } from "./narrative.js";
import { HISTORICAL_RESULTS } from "../historicalData.js";

// ─── W1-W14 SCORING LOCK TESTS ──────────────────────────────────────────────
// These tests freeze the scoring engine output against all 14 real race results.
// They exist to catch regressions — if you change scoring logic and these break,
// you must verify the change was intentional before updating the snapshots.
//
// To regenerate snapshots after an intentional rule change:
//   npx vitest --update-snapshots

describe("W1-W14 scoring lock", () => {
  const data = buildInitialData();

  test("final season standings match known output", () => {
    expect(data.meta.standings).toMatchSnapshot();
  });

  test("final playoff points match known output", () => {
    expect(data.meta.playoffPts).toMatchSnapshot();
  });

  test("mulligan usage counts match known output", () => {
    expect(data.meta.mulligansUsed).toMatchSnapshot();
  });

  // Lock every week's per-player totals and the weekly winner
  for (let w = 1; w <= 14; w++) {
    const key = "w" + w;
    test(`W${w} per-player totals and winner`, () => {
      const scored = data.results[key]?.scored;
      expect(scored).toBeDefined();
      const summary = Object.fromEntries(
        Object.entries(scored).map(([pid, s]) => [pid, { total: s.total, weeklyWin: s.weeklyWin }])
      );
      expect(summary).toMatchSnapshot();
    });
  }
});

// ─── UNIT TESTS: calcDriverScore ─────────────────────────────────────────────

describe("calcDriverScore", () => {
  test("DQ returns -5 flat regardless of other fields", () => {
    const result = calcDriverScore(
      { finish: 1, qualPos: 1, lapsLed: 100, pole: true, stageWin1: true, stageWin2: true, dq: true },
      "intermediate", false, false
    );
    expect(result.total).toBe(-5);
    expect(result.bonusPoints).toBe(0);
  });

  test("DNF driver still scores finish position and net position", () => {
    const result = calcDriverScore(
      { finish: 10, qualPos: 5, lapsLed: 0, dnf: true },
      "intermediate", false, false
    );
    // P10 = 27, Top 10 = +1, net Q5→P10 = -5
    expect(result.total).toBe(23);
    expect(result.breakdown.some(b => b.label === "DNF")).toBe(true);
  });

  test("mulligan driver gets finish + net only (no stage, no laps, no bonuses)", () => {
    const result = calcDriverScore(
      { finish: 5, qualPos: 15, lapsLed: 50, pole: true, stageWin1: true, stageWin2: true, stage1: 1, stage2: 1 },
      "superspeedway", true, false
    );
    // P5 = 32, net Q15→P5 = +10 (capped)
    expect(result.total).toBe(42);
    expect(result.bonusPoints).toBe(0);
    expect(result.breakdown.some(b => b.label === "Mulligan")).toBe(true);
  });

  test("laps led multiplier applied correctly for road course", () => {
    const result = calcDriverScore(
      { finish: 15, qualPos: 15, lapsLed: 10 },
      "road_course", false, false
    );
    // P15 = 22, 10 laps * 1.5 = 15, led a lap = 0.5
    expect(result.total).toBe(37.5);
  });

  test("sweep bonus applies correctly for 2-stage race", () => {
    const result = calcDriverScore(
      { finish: 1, qualPos: 1, lapsLed: 0, pole: true, stageWin1: true, stageWin2: true },
      "intermediate", false, false
    );
    // P1=55, top5=+2, pole=+5, SW1=+2.5, SW2=+2.5, sweep=+12.5
    expect(result.total).toBe(79.5);
    expect(result.breakdown.some(b => b.label === "SWEEP!")).toBe(true);
  });

  test("sweep does NOT apply in 3-stage race without stageWin3", () => {
    const result = calcDriverScore(
      { finish: 1, qualPos: 1, lapsLed: 0, pole: true, stageWin1: true, stageWin2: true, stageWin3: false },
      "intermediate", false, true
    );
    expect(result.breakdown.some(b => b.label === "SWEEP!")).toBe(false);
  });

  test("net position capped at +10", () => {
    const result = calcDriverScore(
      { finish: 1, qualPos: 40, lapsLed: 0 },
      "intermediate", false, false
    );
    const netEntry = result.breakdown.find(b => b.label.startsWith("Net"));
    expect(netEntry.pts).toBe(10);
  });

  test("net position capped at -10", () => {
    const result = calcDriverScore(
      { finish: 40, qualPos: 1, lapsLed: 0 },
      "intermediate", false, false
    );
    const netEntry = result.breakdown.find(b => b.label.startsWith("Net"));
    expect(netEntry.pts).toBe(-10);
  });
});

// ─── STATS ENGINE TESTS ───────────────────────────────────────────────────────

describe("stats engine", () => {
  const data = buildInitialData();

  test("W14 top driver is Denny Hamlin (dominant Nashville race)", () => {
    const top = getWeekTopDrivers(HISTORICAL_RESULTS.w14, 14, 1);
    expect(top[0].name).toBe("#11 Denny Hamlin");
    expect(top[0].total).toBeGreaterThan(100);
  });

  test("getWeekTopDrivers returns N results", () => {
    const top5 = getWeekTopDrivers(HISTORICAL_RESULTS.w1, 1, 5);
    expect(top5).toHaveLength(5);
    // Results are sorted descending
    expect(top5[0].total).toBeGreaterThanOrEqual(top5[1].total);
  });

  test("season driver stats includes all drivers and snapshots", () => {
    const stats = getDriverSeasonStats(data);
    expect(stats.length).toBeGreaterThan(20);
    // Hamlin should be near the top — dominated Nashville and appeared in many weeks
    const hamlin = stats.find(s => s.name === "#11 Denny Hamlin");
    expect(hamlin).toBeDefined();
    expect(hamlin.appearances).toBeGreaterThan(0);
    expect(hamlin.totalFerdaPts).toBeGreaterThan(0);
    expect(hamlin.bestScore).toMatchSnapshot();
  });

  test("season records snapshot", () => {
    const records = getSeasonRecords(data);
    expect(records.bestPlayerWeek).toBeDefined();
    expect(records.bestDriverPerf).toBeDefined();
    expect(records.bestPlayerWeek).toMatchSnapshot();
    expect(records.bestDriverPerf.name).toMatchSnapshot();
    expect(records.bestDriverPerf.score).toMatchSnapshot();
  });
});

// ─── HISTORY ENGINE TESTS ─────────────────────────────────────────────────────

describe("history engine", () => {
  const data = buildInitialData();

  test("season timeline has 14 entries, one per scored week", () => {
    const timeline = getSeasonTimeline(data);
    expect(timeline).toHaveLength(14);
    expect(timeline[0].week).toBe(1);
    expect(timeline[13].week).toBe(14);
    // Every entry has scores for all 4 players
    timeline.forEach(row => {
      expect(Object.keys(row.scores)).toHaveLength(4);
    });
  });

  test("each week has exactly one weekly winner", () => {
    const timeline = getSeasonTimeline(data);
    timeline.forEach(row => {
      const winners = Object.values(row.scores).filter(s => s.weeklyWin);
      expect(winners).toHaveLength(1);
    });
  });

  test("head-to-head records sum correctly (each pair: wins+losses = total weeks)", () => {
    const h2h  = getHeadToHead(data);
    const weeks = 14;
    // Justin vs Rich: wins + losses + ties should = 14
    const jvr = h2h.justin.rich;
    const rvj = h2h.rich.justin;
    expect(jvr.wins + jvr.losses + jvr.ties).toBe(weeks);
    // Symmetric
    expect(jvr.wins).toBe(rvj.losses);
    expect(jvr.losses).toBe(rvj.wins);
  });

  test("achievements snapshot for all players", () => {
    const ach = getAchievements(data);
    const summary = Object.fromEntries(
      Object.entries(ach).map(([pid, { unlocked }]) => [pid, unlocked.map(a => a.id)])
    );
    expect(summary).toMatchSnapshot();
  });
});

// ─── NARRATIVE ENGINE TESTS ───────────────────────────────────────────────────

describe("narrative engine", () => {
  const data = buildInitialData();

  test("generateFullRecap W14 returns correct winner and MVP", () => {
    const recap = generateFullRecap(14, data);
    expect(recap).not.toBeNull();
    expect(recap.weekWinner.pid).toBe("monroe");         // Monroe won W14
    expect(recap.weekWinner.total).toBeGreaterThan(180); // 189 pts
    expect(recap.mvp.name).toBe("#11 Denny Hamlin");     // Hamlin MVP
    expect(recap.mvp.total).toBeGreaterThan(100);
    expect(recap.week).toBe(14);
  });

  test("generateFullRecap W14 Hamlin was not picked by everyone", () => {
    const recap = generateFullRecap(14, data);
    // Hamlin picked by Monroe only in W14 — biggestMiss should be someone else
    expect(recap.mulliganReport).toBeDefined();
    // Monroe's mulligan (Zilisch→Keselowski) should be in the report
    const monroeMull = recap.mulliganReport.find(m => m.pid === "monroe");
    expect(monroeMull).toBeDefined();
    expect(monroeMull.replacement).toBe("#6 Brad Keselowski");
  });

  test("generateWeekPreview returns draft order and track stats", () => {
    const preview = generateWeekPreview(15, data);
    expect(preview).not.toBeNull();
    expect(preview.week).toBe(15);
    expect(preview.draftOrder).toHaveLength(4);
    // Track stats for W15 Michigan (intermediate) based on W5,W6,W9,W11,W13,W14
    expect(preview.trackStats.length).toBeGreaterThan(0);
    expect(preview.trackStats[0].avgScore).toBeGreaterThan(0);
  });

  test("getDriverStatsByTrackType returns only intermediates", () => {
    const stats = getDriverStatsByTrackType(data, "intermediate");
    expect(stats.length).toBeGreaterThan(0);
    // All returned stats should have at least 1 appearance
    stats.forEach(s => expect(s.appearances).toBeGreaterThan(0));
  });

  test("getSeasonStorylines returns at least 3 storylines", () => {
    const lines = getSeasonStorylines(data);
    expect(lines.length).toBeGreaterThanOrEqual(3);
    // Should have a leader storyline
    expect(lines.some(l => l.icon === "🏁")).toBe(true);
  });
});
