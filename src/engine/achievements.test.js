import { describe, test, expect } from "vitest";
import { getAchievements, getRecords, progress, mulliganSwaps } from "./achievements.js";

const drv = (name, finish, extra = {}) => ({
  name, finish, qualPos: finish, lapsLed: 0, dnf: false, dq: false, pole: false,
  stageWin1: false, stageWin2: false, stageWin3: false, fastestLap: false, mostLapsLed: false,
  stage1: 0, stage2: 0, stage3: 0, ...extra,
});
const sd = (driver, total, extra = {}) => ({ driver, total, breakdown: [], ...extra });
const by = (list, id) => list.find(b => b.id === id);
const pids = b => b.holders.map(h => h.pid).sort();

// W10 = Talladega (superspeedway), W11 = Texas
const data = {
  results: {
    w10: {
      raw: { drivers: [
        drv("#12 Ryan Blaney", 1, { pole: true, stageWin1: true, stageWin2: true }),
        drv("#11 Denny Hamlin", 2), drv("#5 Kyle Larson", 3), drv("#9 Chase Elliott", 30, { dnf: true }),
        drv("#20 Christopher Bell", 31, { dnf: true }), drv("#24 William Byron", 32, { dnf: true }),
        drv("#1 Ross Chastain", 33, { dnf: true, qualPos: 4 }),
      ] },
      scored: {
        justin:    { total: 200, weeklyWin: true, drivers: [sd("#12 Ryan Blaney", 150, { breakdown: [{ label: "Fast Lap", pts: 1 }] }), sd("#11 Denny Hamlin", 50)] },
        rich:      { total: 198, drivers: [sd("#9 Chase Elliott", 5), sd("#20 Christopher Bell", 5), sd("#24 William Byron", 5)] },
        monroe:    { total: 60,  drivers: [sd("#1 Ross Chastain", 0), sd("#5 Kyle Larson", 60)] },
        bigmonroe: { total: 10,  drivers: [sd("#24 William Byron", 10)] },
      },
    },
    w11: {
      raw: { drivers: [drv("#5 Kyle Larson", 1), drv("#11 Denny Hamlin", 2), drv("#9 Chase Elliott", 25)] },
      scored: {
        rich:      { total: 90, weeklyWin: true, drivers: [sd("#5 Kyle Larson", 90, { breakdown: [{ label: "Fast Lap", pts: 1 }] })] },
        justin:    { total: 80, drivers: [sd("#11 Denny Hamlin", 80)] },
        monroe:    { total: 20, drivers: [sd("#9 Chase Elliott", 20)] },
        bigmonroe: { total: 5,  drivers: [] },
      },
    },
  },
  picks: {},
  mulligans: {
    justin: [{ week: 11, driver: "#9 Chase Elliott", replacement: "#11 Denny Hamlin" }],   // P25 → P2 swap
    monroe: [{ week: 11, driver: "#5 Kyle Larson", replacement: "#9 Chase Elliott" }],    // dropped the winner
  },
};

const career = {
  justin:    { firstYear: 2019, races: 100, finishes: [100, 0, 0, 0] },
  monroe:    { firstYear: 2019, races: 100, finishes: [10, 10, 80, 0] },
  bigmonroe: { firstYear: 2019, races: 100, finishes: [20, 20, 20, 40] },
  rich:      { firstYear: 2021, races: 50,  finishes: [10, 10, 10, 20] },
};
const history = [
  { year: 2019, regularSeason: "bigmonroe", overall: "bigmonroe" },
  { year: 2020, regularSeason: "justin", overall: "justin" },
  { year: 2021, regularSeason: "justin", overall: "rich" },
  { year: 2022, regularSeason: "monroe", overall: "justin" },
  { year: 2023, regularSeason: "justin", overall: "justin" },
  { year: 2024, regularSeason: "justin", overall: "justin" },
];

const all = getAchievements(data, { career, history });

describe("race & strategy", () => {
  test("weekend sweep needs the pole, both stage winners and the race winner", () => {
    expect(pids(by(all, "weekend-sweep"))).toEqual(["justin"]);
  });
  test("top dog = weekly winner, counted per manager", () => {
    expect(by(all, "top-dog").holders.map(h => [h.pid, h.count])).toEqual([["justin", 1], ["rich", 1]]);
  });
  test("big one survivor: clean at Talladega while 2+ others wreck", () => {
    expect(pids(by(all, "big-one"))).toEqual(["justin"]);   // rich, monroe and bigmonroe (Byron) all had DNFs
  });
  test("fastest lap king: ties share it", () => {
    const b = by(all, "fastest-lap-king");
    expect(b.counter).toMatchObject({ justin: 1, rich: 1, monroe: 0 });
    expect(pids(b)).toEqual(["justin", "rich"]);
  });
  test("photo finish: winning margin under 3", () => {
    expect(pids(by(all, "photo-finish"))).toEqual(["justin"]);              // W10 by 2.0
  });
  test("master of the mulligan: DNF / negative swapped for a top-5 finisher", () => {
    expect(pids(by(all, "mulligan-master"))).toEqual([]);                  // Elliott P25 wasn't a DNF
    const d2 = { ...data, mulligans: { justin: [{ week: 10, driver: "#9 Chase Elliott", replacement: "#11 Denny Hamlin" }] } };
    expect(pids(by(getAchievements(d2, { career, history }), "mulligan-master"))).toEqual(["justin"]);
  });
  test("crown jewels need all three races", () => {
    expect(by(all, "crown-jewel").holders).toEqual([]);
  });
});

describe("garage roasts", () => {
  test("poop award counter", () => {
    const b = by(all, "poop");
    expect(b.counter).toMatchObject({ bigmonroe: 2, justin: 0 });
    expect(pids(b)).toEqual(["bigmonroe"]);
  });
  test("wrecked bucket: 3+ DNFs in one lineup", () => {
    expect(pids(by(all, "wrecked-bucket"))).toEqual(["rich"]);
    expect(by(all, "wrecked-bucket").archive[0].text).toBe("Certified Wreckhouse Classic");
  });
  test("the donut: started top 10, scored 0 or less", () => {
    expect(pids(by(all, "donut"))).toEqual(["monroe"]);                    // Chastain started P4, 0 pts
  });
  test("wasted mulligan: dropped driver outscored the replacement", () => {
    expect(pids(by(all, "wasted-mulligan"))).toEqual(["monroe"]);
    expect(mulliganSwaps(data)).toHaveLength(2);
  });
  test("white flag isn't tracked yet", () => {
    expect(by(all, "white-flag")).toMatchObject({ tracked: false, holders: [] });
  });
});

describe("career milestones (derived from career + history)", () => {
  test("century club", () => { expect(pids(by(all, "century"))).toEqual(["justin"]); });
  test("3-peat dynasty from consecutive overall titles", () => {
    expect(by(all, "dynasty").holders).toEqual([{ pid: "justin", count: 1, lines: ["3-Peat · 2022–2024"] }]);
  });
  test("undisputed = same manager won both titles that year", () => {
    expect(by(all, "undisputed").holders.map(h => [h.pid, h.count])).toEqual([["justin", 3], ["bigmonroe", 1]]);
  });
  test("mr. podium: 75+ thirds or 85%+ podium rate", () => {
    expect(pids(by(all, "mr-podium"))).toEqual(["justin", "monroe"]);
  });
  test("rookie sensation + expansion archive note", () => {
    const b = by(all, "rookie");
    expect(pids(b)).toEqual(["bigmonroe", "rich"]);
    expect(b.archive).toEqual([{ pid: "rich", text: "2021 Expansion" }]);
  });
});

test("progress counts badges, overall or per manager", () => {
  const p = progress(all);
  expect(p.total).toBe(18);
  expect(p.unlocked).toBe(all.filter(b => b.holders.length).length);
  expect(progress(all, "justin").unlocked).toBe(all.filter(b => b.holders.some(h => h.pid === "justin")).length);
});

describe("records", () => {
  const r = getRecords(data, { weekScore: { pid: "rich", pts: 375.5, race: "Sonoma", year: 2025 }, seasonWins: { pid: "justin", wins: 18, year: 2021 } });
  test("season records", () => {
    expect(r.season.find(x => x.id === "week")).toMatchObject({ value: 200, pid: "justin" });
    expect(r.season.find(x => x.id === "season-wins")).toMatchObject({ value: 1 });
  });
  test("all-time keeps the better of the record book and this season", () => {
    expect(r.allTime.find(x => x.id === "week")).toMatchObject({ value: 375.5, pid: "rich", detail: "Sonoma • 2025" });
    expect(r.allTime.find(x => x.id === "season-wins")).toMatchObject({ value: 18, detail: "2021" });
    const big = getRecords(data, { weekScore: { pid: "rich", pts: 100, race: "X", year: 2025 } });
    expect(big.allTime.find(x => x.id === "week")).toMatchObject({ value: 200, pid: "justin" });
  });
  test("driver and streak records note where tracking starts", () => {
    expect(r.allTime.find(x => x.id === "driver").note).toMatch(/archived from/);
  });
});
