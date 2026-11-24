import { describe, test, expect } from "vitest";
import { buildTrackIndex, raceDetail, trackSummary } from "./raceArchive.js";

const drv = (name, finish, extra = {}) => ({
  name, finish, qualPos: 20, lapsLed: 0, dnf: false, dq: false, pole: false,
  stageWin1: false, stageWin2: false, stageWin3: false, fastestLap: false, mostLapsLed: false,
  stage1: 0, stage2: 0, stage3: 0, ...extra,
});
const sd = (driver, total, extra = {}) => ({ driver, total, breakdown: [], ...extra });

// 2026 W3 = COTA, W5 = Las Vegas, W6 = Darlington (see SCHEDULE_2026)
const doc2026 = {
  results: {
    w3: {
      raw: { drivers: [drv("#45 Tyler Reddick", 1, { qualPos: 1 }), drv("#12 Ryan Blaney", 2), drv("#5 Kyle Larson", 3, { dnf: true }), drv("#19 Chase Briscoe", 4)] },
      scored: {
        justin: { total: 100, weeklyWin: true, drivers: [sd("#45 Tyler Reddick", 70), sd("#12 Ryan Blaney", 30)] },
        rich: { total: 60, drivers: [sd("#5 Kyle Larson", 40), sd("#33 Austin Hill", 0, { dnr: true })] },
        monroe: { total: 10, drivers: [] }, bigmonroe: { total: 5, drivers: [] },
      },
    },
    w5: { raw: { drivers: [drv("#45 Tyler Reddick", 1)] }, scored: { rich: { total: 80, weeklyWin: true, drivers: [sd("#45 Tyler Reddick", 50)] }, justin: { total: 20, drivers: [] }, monroe: { total: 0, drivers: [] }, bigmonroe: { total: 0, drivers: [] } } },
  },
  drafts: {
    w3: [
      { driver: "#45 Tyler Reddick", pid: "justin", pickNum: 0 }, { driver: "#5 Kyle Larson", pid: "rich", pickNum: 1 },
      { driver: "#12 Ryan Blaney", pid: "monroe", pickNum: 2 }, { driver: "#9 Chase Elliott", pid: "bigmonroe", pickNum: 3 },
      { driver: "#24 William Byron", pid: "justin", pickNum: 4 },
    ],
  },
};
// A later season that also raced COTA at W3 (2027 schedule)
const doc2027 = {
  results: { w3: { raw: { drivers: [drv("#45 Tyler Reddick", 5)] }, scored: { monroe: { total: 90, weeklyWin: true, drivers: [sd("#45 Tyler Reddick", 40)] }, justin: { total: 10, drivers: [] }, rich: { total: 5, drivers: [] }, bigmonroe: { total: 0, drivers: [] } } } },
};

describe("buildTrackIndex", () => {
  const idx = buildTrackIndex({ 2026: doc2026, 2027: doc2027 });
  test("groups every scored race under its track, newest first", () => {
    const cota = idx.find(t => t.slug === "cota");
    expect(cota.races.map(r => r.year)).toEqual([2027, 2026]);
    expect(cota.ty).toBe("road_course");
    expect(idx.find(t => t.slug === "las-vegas").races).toHaveLength(1);
  });
  test("busiest tracks first; empty seasons are skipped", () => {
    expect(idx[0].slug).toBe("cota");
    expect(buildTrackIndex({ 2026: null })).toEqual([]);
  });
});

describe("raceDetail", () => {
  const cota26 = buildTrackIndex({ 2026: doc2026 }).find(t => t.slug === "cota").races[0];
  const d = raceDetail(doc2026, cota26);
  test("ranks managers and flags the winner", () => {
    expect(d.managers.map(m => m.pid)).toEqual(["justin", "rich", "monroe", "bigmonroe"]);
    expect(d.managers[0]).toMatchObject({ winner: true, total: 100, rank: 1 });
  });
  test("attaches pick order from the draft log and real start/finish", () => {
    const reddick = d.managers[0].drivers[0];
    expect(reddick).toMatchObject({ num: "45", name: "Tyler Reddick", pick: { overall: 1, round: 1 }, start: 1, finish: 1 });
    expect(d.managers[0].drivers[1].pick).toMatchObject({ overall: 3, round: 1 });   // Blaney: 3rd overall, round 1
    expect(d.managers[1].drivers[0].dnf).toBe(true);                                  // Larson crashed
    expect(d.managers[1].drivers[1].dnr).toBe(true);
  });
  test("lists the real top finishers with owners, and the best driver nobody had", () => {
    expect(d.results.map(r => r.finish)).toEqual([1, 2, 3, 4]);
    expect(d.results[0].owners).toEqual(["justin"]);
    expect(d.results[3].owners).toEqual([]);          // Briscoe: undrafted
    expect(d.gotAway?.name).toBe("#19 Chase Briscoe");
  });
  test("works for a race with no draft log", () => {
    const lv = buildTrackIndex({ 2026: doc2026 }).find(t => t.slug === "las-vegas").races[0];
    expect(raceDetail(doc2026, lv).managers[0].drivers[0].pick).toBeNull();
  });
});

describe("trackSummary", () => {
  const races = buildTrackIndex({ 2026: doc2026, 2027: doc2027 }).find(t => t.slug === "cota").races;
  const s = trackSummary(races);
  const by = Object.fromEntries(s.perManager.map(m => [m.pid, m]));
  test("counts wins, averages and best weeks per manager", () => {
    expect(by.justin).toMatchObject({ races: 2, wins: 1, avg: 55, best: { total: 100, year: 2026 } });
    expect(by.monroe).toMatchObject({ wins: 1, best: { total: 90, year: 2027 } });
  });
  test("tracks each manager's most-picked drivers here", () => {
    expect(by.justin.topPicks[0]).toMatchObject({ name: "Tyler Reddick", count: 1 });
    expect(by.rich.topPicks.map(p => p.name)).toEqual(["Kyle Larson"]);          // the did-not-race pick is ignored
  });
  test("finds the best single driver score and the league's favourite", () => {
    expect(s.bestDriver).toMatchObject({ name: "Tyler Reddick", total: 70, year: 2026 });
    expect(s.hotSeat).toMatchObject({ name: "Tyler Reddick", count: 2 });
  });
});
