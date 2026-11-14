import { describe, test, expect } from "vitest";
import {
  carKey, parseDriver, scoredWeeks, weekWinnerPid, weekWinners, stepWeek, buildOwnerMap,
  getRaceFacts, leagueAverage, getSuperlatives, fmtPts,
} from "./resultsView.js";

const drv = (name, finish, extra = {}) => ({
  name, finish, qualPos: finish, lapsLed: 0, dnf: false, dq: false, pole: false,
  stageWin1: false, stageWin2: false, stageWin3: false, fastestLap: false, mostLapsLed: false,
  stage1: 0, stage2: 0, stage3: 0, ...extra,
});

const raw = {
  threeStages: false,
  drivers: [
    drv("#12 Ryan Blaney", 1, { lapsLed: 115, mostLapsLed: true, stageWin2: true, qualPos: 8 }),
    drv("#11 Denny Hamlin", 2, { lapsLed: 60, pole: true, stageWin1: true, qualPos: 1 }),
    drv("#23 Bubba Wallace", 3),
    drv("#1 Ross Chastain", 30, { dnf: true }),
    drv("#5 Kyle Larson", 4, { lapsLed: 10 }),
  ],
};
const sd = (driver, total, extra = {}) => ({ driver, total, breakdown: [], bonusPoints: 0, ...extra });
const scored = {
  justin:    { total: 120.5, weeklyWin: true,  drivers: [sd("#11 Denny Hamlin", 94.5), sd("#23 Bubba Wallace", 26)] },
  rich:      { total: 98.5,  weeklyWin: false, drivers: [sd("#1 Ross Chastain", 0), sd("#12 Ryan Blaney", 98.5)] },
  monroe:    { total: 50,    weeklyWin: false, drivers: [sd("#99 Missing Guy", 0, { dnr: true }), sd("#5 Kyle Larson", 50)] },
  bigmonroe: { total: 40,    weeklyWin: false, drivers: [] },
};

describe("helpers", () => {
  test("car keys and names", () => {
    expect(carKey("#12 Ryan Blaney")).toBe("12");
    expect(carKey("Mystery")).toBe("Mystery");
    expect(parseDriver("#7 Corey LaJoie")).toEqual({ num: "7", name: "Corey LaJoie" });
    expect(parseDriver("Mystery")).toEqual({ num: "", name: "Mystery" });
  });
  test("fmtPts", () => {
    expect(fmtPts(94.5)).toBe("+94.5");
    expect(fmtPts(0)).toBe("0");
    expect(fmtPts(-5)).toBe("-5");
  });
});

describe("week scrubber data", () => {
  test("winner is the weeklyWin flag, else the highest total", () => {
    expect(weekWinnerPid(scored)).toBe("justin");
    expect(weekWinnerPid({ a: { total: 5 }, b: { total: 9 } })).toBe("b");
    expect(weekWinnerPid({})).toBeNull();
    expect(weekWinnerPid(null)).toBeNull();
  });

  test("scoredWeeks (schedule order) / weekWinners", () => {
    const data = {
      results: { w3: { scored: { a: { total: 1 }, b: { total: 2 } } }, w1: { scored } },
    };
    expect(scoredWeeks(data)).toEqual([1, 3]);
    expect(weekWinners(data)).toEqual({ 1: "justin", 3: "b" });
  });

  test("stepWeek moves along the strip and stops at the ends", () => {
    const w = [1, 2, 3];
    expect(stepWeek(w, 2, -1)).toBe(1);
    expect(stepWeek(w, 2, 1)).toBe(3);
    expect(stepWeek(w, 1, -1)).toBeNull();
    expect(stepWeek(w, 3, 1)).toBeNull();
    expect(stepWeek(w, 9, 1)).toBeNull();
  });
});

describe("race facts", () => {
  test("winner, pole, stage winners, leaders and DNFs", () => {
    expect(getRaceFacts(raw)).toEqual({
      winner: "#12 Ryan Blaney",
      pole: "#11 Denny Hamlin",
      stageWinners: [{ stage: 1, name: "#11 Denny Hamlin" }, { stage: 2, name: "#12 Ryan Blaney" }],
      leaders: 3, lapsLed: 185, dnfs: 1,
    });
  });
  test("missing data degrades to nulls", () => {
    expect(getRaceFacts(null)).toMatchObject({ winner: null, pole: null, stageWinners: [], leaders: 0, dnfs: 0 });
    expect(getRaceFacts({ drivers: [drv("#9 A", 1)] }).pole).toBeNull();
  });
});

describe("league average", () => {
  test("mean of the player totals, one decimal", () => {
    expect(leagueAverage(scored)).toBe(77.3);          // (120.5 + 98.5 + 50 + 40) / 4 = 77.25
    expect(leagueAverage({})).toBeNull();
  });
});

describe("owner map", () => {
  test("merges scored drivers and picks, ignores did-not-race and garage slots", () => {
    const m = buildOwnerMap(scored, { bigmonroe: [{ driver: "#23 Bubba Wallace" }, { driver: "#77 Garage Guy", garage: true }] });
    expect(m["11"]).toEqual(["justin"]);
    expect(m["23"]).toEqual(["justin", "bigmonroe"]);
    expect(m["99"]).toBeUndefined();
    expect(m["77"]).toBeUndefined();
  });
});

describe("superlatives", () => {
  const s = getSuperlatives(scored, raw, 1, {});
  test("MVP pick is the best drafted driver and who drafted him", () => {
    expect(s.mvp).toEqual({ driver: "#12 Ryan Blaney", total: 98.5, pid: "rich" });
  });
  test("heartbreaker is the worst drafted driver; DNF flagged; did-not-race ignored", () => {
    expect(s.heartbreaker).toEqual({ driver: "#1 Ross Chastain", total: 0, pid: "rich", dnf: true });
  });
  test("best undrafted is the top driver nobody drafted (none here: every raced car was drafted except none)", () => {
    // Blaney, Hamlin, Wallace, Chastain and Larson are all drafted in this fixture
    expect(s.bestUndrafted).toBeNull();
    const more = { ...raw, drivers: [...raw.drivers, drv("#2 Austin Cindric", 5, { lapsLed: 5 })] };
    const s2 = getSuperlatives(scored, more, 1, {});
    expect(s2.bestUndrafted.driver).toBe("#2 Austin Cindric");
    expect(s2.bestUndrafted.total).toBeGreaterThan(0);
  });
  test("margin of victory", () => {
    expect(s.margin).toEqual({ pid: "justin", pts: 22 });
  });
  test("empty week is all null", () => {
    expect(getSuperlatives({}, { drivers: [] }, 1, {})).toEqual({ mvp: null, heartbreaker: null, bestUndrafted: null, margin: null });
  });
});
