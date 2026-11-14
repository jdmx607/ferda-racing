import { describe, test, expect } from "vitest";
import {
  scoredWeekList, getDriverProfile, getManagerEfficiency, getHeadToHead,
  getTrackSpecialists, getDraftTrends, leaderboardMetrics,
} from "./statsView.js";

const drv = (name, finish, extra = {}) => ({
  name, finish, qualPos: finish, lapsLed: 0, dnf: false, dq: false, pole: false,
  stageWin1: false, stageWin2: false, stageWin3: false, fastestLap: false, mostLapsLed: false,
  stage1: 0, stage2: 0, stage3: 0, ...extra,
});
const sd = (driver, total, extra = {}) => ({ driver, total, breakdown: [], ...extra });
const pk = d => ({ driver: d });
const five = (a, b, c, d, e) => [a, b, c, d, e].map(pk);

// 2026 schedule: w4 Phoenix short_track, w7 Martinsville short_track, w5 Las Vegas intermediate
const data = {
  results: {
    w4: {
      raw: { drivers: [drv("#12 Ryan Blaney", 1), drv("#11 Denny Hamlin", 2), drv("#5 Kyle Larson", 3), drv("#9 Chase Elliott", 30, { dnf: true }), drv("#20 Christopher Bell", 5), drv("#24 William Byron", 6), drv("#1 Ross Chastain", 7)] },
      scored: {
        justin: { total: 100, drivers: [sd("#12 Ryan Blaney", 60), sd("#5 Kyle Larson", 20), sd("#20 Christopher Bell", 10), sd("#24 William Byron", 6), sd("#1 Ross Chastain", 4)] },
        rich:   { total: 80,  drivers: [sd("#11 Denny Hamlin", 40), sd("#9 Chase Elliott", 0), sd("#99 Nobody", 0, { dnr: true }), sd("#5 Kyle Larson", 20), sd("#20 Christopher Bell", 20)] },
      },
    },
    w7: {
      raw: { drivers: [drv("#11 Denny Hamlin", 1), drv("#12 Ryan Blaney", 4), drv("#5 Kyle Larson", 2)] },
      scored: {
        justin: { total: 50, drivers: [sd("#12 Ryan Blaney", 50)] },
        rich:   { total: 90, drivers: [sd("#11 Denny Hamlin", 90)] },
      },
    },
    w5: {
      raw: { drivers: [drv("#12 Ryan Blaney", 2)] },
      scored: { justin: { total: 70, drivers: [sd("#12 Ryan Blaney", 70)] }, rich: { total: 70, drivers: [] } },
    },
    w9: {},                                        // not scored → ignored
  },
  picks: {
    w4: {
      justin: five("#12 Ryan Blaney", "#5 Kyle Larson", "#20 Christopher Bell", "#24 William Byron", "#1 Ross Chastain"),
      rich:   five("#11 Denny Hamlin", "#9 Chase Elliott", "#99 Nobody", "#5 Kyle Larson", "#20 Christopher Bell"),
    },
    w7: { justin: [pk("#12 Ryan Blaney")], rich: [pk("#11 Denny Hamlin")] },
    w5: { justin: [pk("#12 Ryan Blaney")], rich: [] },
  },
};

test("scored weeks are chronological and skip empty ones", () => {
  expect(scoredWeekList(data).map(x => x.w)).toEqual([4, 5, 7]);
});

describe("driver profile", () => {
  const p = getDriverProfile(data, "#12 Ryan Blaney");
  test("race log newest first with who drafted him", () => {
    expect(p.log.map(r => r.week)).toEqual([7, 5, 4]);
    expect(p.log[2]).toMatchObject({ race: "Straight Talk 500", track: "Phoenix", finish: 1, pickedBy: ["justin"] });
    expect(p.races).toBe(3);
  });
  test("track-type splits", () => {
    expect(p.splits.short_track.races).toBe(2);
    expect(p.splits.intermediate.races).toBe(1);
    expect(p.splits.road_course).toEqual({ races: 0, avg: null });
  });
  test("top drafter + totals", () => {
    expect(p.top).toEqual({ pid: "justin", count: 3, share: 100 });
    expect(p.best).toBe(Math.max(...p.log.map(r => r.pts)));
    expect(p.avg).toBeCloseTo(p.total / 3, 0);
  });
  test("matches by name, so a renumbered driver keeps his history", () => {
    expect(getDriverProfile(data, "#99 Ryan Blaney").races).toBe(3);
  });
  test("unknown driver → empty profile", () => {
    expect(getDriverProfile(data, "#0 Ghost")).toMatchObject({ races: 0, total: 0, avg: 0, best: 0, top: null });
  });
});

describe("manager efficiency", () => {
  const e = Object.fromEntries(getManagerEfficiency(data).map(x => [x.id, x]));
  test("average weekly score", () => {
    expect(e.justin.avg).toBeCloseTo((100 + 50 + 70) / 3, 1);
    expect(e.rich.avg).toBe(80);
  });
  test("late-round points come from draft slots 4 and 5", () => {
    expect(e.justin.lateRoundPts).toBe(10);       // Byron 6 + Chastain 4
    expect(e.rich.lateRoundPts).toBe(40);         // Larson 20 + Bell 20
  });
  test("DNF rate ignores did-not-race", () => {
    expect(e.rich.starts).toBe(5);                // 4 in W4 (one DNR) + Hamlin W7
    expect(e.rich.dnfs).toBe(1);                  // Elliott
    expect(e.rich.dnfRate).toBe(20);
    expect(e.justin.dnfRate).toBe(0);
  });
  test("ride-or-die = most-drafted driver with points earned for that manager", () => {
    expect(e.justin.rideOrDie).toEqual({ driver: "#12 Ryan Blaney", count: 3, pts: 180 });
    expect(e.rich.rideOrDie).toEqual({ driver: "#11 Denny Hamlin", count: 2, pts: 130 });
  });
  test("managers with no weeks are zeroed", () => {
    expect(e.monroe).toMatchObject({ weeks: 0, avg: 0, dnfRate: 0, rideOrDie: null });
  });
});

test("head-to-head counts weekly wins, losses and ties", () => {
  const h = getHeadToHead(data);
  expect(h.justin.rich).toEqual({ w: 1, l: 1, t: 1 });
  expect(h.rich.justin).toEqual({ w: 1, l: 1, t: 1 });
  expect(h.justin.monroe).toEqual({ w: 0, l: 0, t: 0 });   // monroe never scored
});

describe("track specialists", () => {
  test("ranked by average at that track type", () => {
    const s = getTrackSpecialists(data, "short_track", { min: 2 });
    expect(s.map(x => x.name)).toEqual(expect.arrayContaining(["#12 Ryan Blaney", "#11 Denny Hamlin", "#5 Kyle Larson"]));
    expect(s.every(x => x.races >= 2)).toBe(true);
    expect(s[0].avg).toBeGreaterThanOrEqual(s[s.length - 1].avg);
    expect(s.find(x => x.name === "#11 Denny Hamlin").wins).toBe(1);
  });
  test("minimum relaxes to the races actually held", () => {
    expect(getTrackSpecialists(data, "intermediate", { min: 2 }).map(x => x.name)).toEqual(["#12 Ryan Blaney"]);
    expect(getTrackSpecialists(data, "road_course")).toEqual([]);
  });
});

test("draft trends", () => {
  const t = getDraftTrends(data);
  expect(t.firstRound[0]).toEqual({ name: "#12 Ryan Blaney", count: 3 });
  expect(t.mostDrafted[0]).toMatchObject({ name: "#12 Ryan Blaney", count: 3, ppp: 60 });
  expect(t.lateValue.map(x => x.pts)).toEqual([20, 20, 6, 4]);
  expect(t.lateValue[0]).toMatchObject({ week: 4 });
});

test("leaderboard metrics follow the active sort", () => {
  const s = { totalFerdaPts: 2005.84, avgScore: 55.7, bestScore: 145.5, pickCount: 36 };
  expect(leaderboardMetrics(s, "totalFerdaPts")).toEqual({ primary: "2005.8", unit: null, secondary: "55.7 AVG • 145.5 BEST" });
  expect(leaderboardMetrics(s, "avgScore").secondary).toBe("2005.8 TOT • 145.5 BEST");
  expect(leaderboardMetrics(s, "bestScore").secondary).toBe("2005.8 TOT • 55.7 AVG");
  expect(leaderboardMetrics(s, "pickCount")).toEqual({ primary: "36", unit: "picks", secondary: "2005.8 TOT • 55.7 AVG" });
});
