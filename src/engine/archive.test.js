import { describe, test, expect } from "vitest";
import { seasonWeeks, seasonHighlights, seasonStandings, championsFor, seasonSummary } from "./archive.js";

const drv = (name, finish, extra = {}) => ({
  name, finish, qualPos: finish, lapsLed: 0, dnf: false, dq: false, pole: false,
  stageWin1: false, stageWin2: false, stageWin3: false, fastestLap: false, mostLapsLed: false,
  stage1: 0, stage2: 0, stage3: 0, ...extra,
});
const sd = (driver, total) => ({ driver, total, breakdown: [] });

// 2026: W7 Martinsville (short track), W5 Las Vegas (intermediate), W3 COTA (road course)
const data = {
  results: {
    w3: { raw: { drivers: [drv("#12 Ryan Blaney", 1), drv("#5 Kyle Larson", 2)] }, scored: {
      justin: { total: 100, weeklyWin: true, drivers: [sd("#12 Ryan Blaney", 80)] }, rich: { total: 90, drivers: [sd("#5 Kyle Larson", 60)] },
      monroe: { total: 50, drivers: [] }, bigmonroe: { total: 20, drivers: [] } } },
    w5: { raw: { drivers: [drv("#5 Kyle Larson", 1)] }, scored: {
      justin: { total: 80, weeklyWin: true, drivers: [] }, rich: { total: 70, drivers: [sd("#5 Kyle Larson", 70)] }, monroe: { total: 10, drivers: [] }, bigmonroe: { total: 5, drivers: [] } } },
    w7: { raw: { drivers: [drv("#11 Denny Hamlin", 1)] }, scored: {
      rich: { total: 120, weeklyWin: true, drivers: [] }, justin: { total: 60, drivers: [] }, monroe: { total: 40, drivers: [] }, bigmonroe: { total: 30, drivers: [] } } },
    w9: {},                                            // not scored → skipped
  },
  meta: { standings: { justin: 240, rich: 280, monroe: 100, bigmonroe: 55 }, playoffPts: {}, chasePts: {} },
};

describe("season weeks (uses the season's OWN schedule)", () => {
  const weeks = seasonWeeks(data, 2026);
  test("scored events only, in schedule order, with the right race and track type", () => {
    expect(weeks.map(w => w.w)).toEqual([3, 5, 7]);
    expect(weeks[0]).toMatchObject({ race: "DuraMAX Grand Prix", track: "COTA", ty: "road_course", ex: false });
    expect(weeks[2]).toMatchObject({ track: "Martinsville", ty: "short_track" });
  });
  test("winner first, margin over 2nd, MVP driver with its owners", () => {
    expect(weeks[0].scores.map(s => s.pid)).toEqual(["justin", "rich", "monroe", "bigmonroe"]);
    expect(weeks[0].margin).toBe(10);
    expect(weeks[0].mvp).toMatchObject({ name: "#12 Ryan Blaney", owners: ["justin"] });
    expect(weeks[1].mvp.owners).toEqual(["rich"]);
  });
  test("the same week number maps to a different track in 2027 — each year uses its own schedule", () => {
    expect(seasonWeeks(data, 2026).find(w => w.w === 7).track).toBe("Martinsville");
    expect(seasonWeeks(data, 2027).find(w => w.w === 7).track).not.toBe("Martinsville");   // same week number, different track
  });
  test("unknown season → nothing", () => { expect(seasonWeeks(data, 1999)).toEqual([]); });
});

describe("highlights + standings", () => {
  const weeks = seasonWeeks(data, 2026);
  const h = seasonHighlights(weeks);
  test("wins, streaks, best week and best driver", () => {
    expect(h.wins).toEqual({ justin: 2, bigmonroe: 0, monroe: 0, rich: 1 });
    expect(h.longestStreak).toEqual({ pid: "justin", length: 2 });          // won W3 and W5 back to back; Rich won W7
    expect(h.bestWeek).toMatchObject({ pid: "rich", total: 120, w: 7 });
    expect(h.bestDriver).toMatchObject({ name: "#12 Ryan Blaney" });
  });
  test("standings rank by Chase total (1,000 base) with reg-season pts and wins", () => {
    const s = seasonStandings(data, weeks);
    expect(s).toHaveLength(4);
    expect(s[0].total).toBeGreaterThanOrEqual(s[1].total);
    expect(s.find(x => x.pid === "justin")).toMatchObject({ regPts: 240, wins: 2 });
  });
  test("champions + summary", () => {
    expect(championsFor(2026)).toMatchObject({ overall: "justin", regularSeason: "justin" });
    expect(championsFor(1999)).toBeNull();
    expect(seasonSummary({ ...data, archived: true }, 2026)).toEqual({ year: 2026, races: 3, exhibitions: 0, archived: true });
  });
});
