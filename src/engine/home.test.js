import { describe, test, expect } from "vitest";
import { PLAYERS } from "../constants.js";
import {
  getLineupStatus, getPlayerLineup, getHomeLineupWeek, getSeasonWrapUp,
  getRaceMvp, shortName, pointsBack, formatRaceWhen,
} from "./home.js";
import { buildSnakeOrder, getDraftOrder } from "./draft.js";

const blank = () => ({ results: {}, picks: {}, drafts: {}, meta: { standings: {}, playoffPts: {} } });
const scoredWeek = (totals, drivers = {}) => ({
  scored: Object.fromEntries(Object.entries(totals).map(([pid, total]) =>
    [pid, { total, drivers: drivers[pid] || [] }])),
});

describe("lineup status", () => {
  test("fresh week with no gate → DRAFT OPEN", () => {
    expect(getLineupStatus(blank(), 5)).toMatchObject({ state: "open", label: "DRAFT OPEN" });
  });

  test("draft gate in the future → waiting", () => {
    const d = blank();
    d.draftSchedule = { w5: { opensAt: new Date(Date.now() + 86400000).toISOString() } };
    const s = getLineupStatus(d, 5);
    expect(s.state).toBe("waiting");
    expect(s.label).toMatch(/^DRAFT OPENS /);
  });

  test("draft in progress → still open", () => {
    const d = blank();
    d.drafts.w5 = [{ pid: "justin", driver: "#5 Kyle Larson" }];
    expect(getLineupStatus(d, 5).state).toBe("open");
  });

  test("every pick made → LINEUP LOCKED", () => {
    const d = blank();
    const seq = buildSnakeOrder(getDraftOrder(d, 5));
    d.drafts.w5 = seq.map((t, i) => ({ pid: t.pid, driver: `#${i + 1} Driver ${i}` }));
    expect(getLineupStatus(d, 5)).toMatchObject({ state: "locked", label: "LINEUP LOCKED" });
  });

  test("saved picks without a draft also count as locked", () => {
    const d = blank();
    d.picks.w5 = { justin: [{ driver: "#5 Kyle Larson" }] };
    expect(getLineupStatus(d, 5).state).toBe("locked");
  });

  test("scored week and past-the-season", () => {
    const d = blank();
    d.results.w5 = scoredWeek({ justin: 1, bigmonroe: 2, monroe: 3, rich: 4 });
    expect(getLineupStatus(d, 5).state).toBe("scored");
    expect(getLineupStatus(d, 37).state).toBe("over");
  });
});

describe("lineups", () => {
  test("drafted picks win over saved picks; mulligans flagged", () => {
    const d = blank();
    d.drafts.w5 = [{ pid: "justin", driver: "#5 Kyle Larson" }, { pid: "rich", driver: "#24 William Byron" }];
    expect(getPlayerLineup(d, 5, "justin")).toEqual([{ driver: "#5 Kyle Larson", mulligan: false }]);
    const e = blank();
    e.picks.w5 = { justin: [{ driver: "#5 Kyle Larson", mulligan: true }, { driver: "#12 Ryan Blaney" }] };
    expect(getPlayerLineup(e, 5, "justin").map(x => x.mulligan)).toEqual([true, false]);
    expect(getPlayerLineup(e, 5, "rich")).toEqual([]);
  });

  test("expanded rows follow the latest scored race until the next event has lineups", () => {
    const d = blank();
    d.results.w4 = scoredWeek({ justin: 1, bigmonroe: 2, monroe: 3, rich: 4 });
    expect(getHomeLineupWeek(d)).toEqual({ week: 4, scored: true });
    d.drafts.w5 = [{ pid: "justin", driver: "#5 Kyle Larson" }];
    expect(getHomeLineupWeek(d)).toEqual({ week: 5, scored: false });
  });
});

describe("season wrap-up", () => {
  test("best score, average finish, playoff points", () => {
    const d = blank();
    d.results.w1 = scoredWeek({ justin: 100, bigmonroe: 80, monroe: 60, rich: 40 });   // justin P1
    d.results.w2 = scoredWeek({ justin: 50, bigmonroe: 90, monroe: 70, rich: 30 });    // justin P3
    d.meta.playoffPts = { justin: 55 };
    expect(getSeasonWrapUp(d, "justin")).toEqual({ races: 2, bestScore: 100, avgFinish: 2, playoffPts: 55 });
    expect(getSeasonWrapUp(blank(), "justin")).toMatchObject({ races: 0, bestScore: null, avgFinish: null });
  });
});

describe("small helpers", () => {
  test("shortName drops numbers and suffixes", () => {
    expect(shortName("#24 William Byron")).toBe("Byron");
    expect(shortName("#47 Ricky Stenhouse Jr")).toBe("Stenhouse");
    expect(shortName("#97 Shane Van Gisbergen")).toBe("Gisbergen");
  });

  test("race MVP is the top-scoring driver who raced", () => {
    expect(getRaceMvp({ drivers: [
      { driver: "#9 Chase Elliott", total: 12 },
      { driver: "#24 William Byron", total: 68.5 },
      { driver: "#6 Ryan Preece", total: 99, dnr: true },
    ] })).toEqual({ driver: "#24 William Byron", total: 68.5 });
    expect(getRaceMvp({ drivers: [] })).toBeNull();
  });

  test("points back is relative to P1", () => {
    expect(pointsBack([{ pts: 4962 }, { pts: 4551.2 }, { pts: 4253 }, { pts: 4197 }])).toEqual([0, -410.8, -709, -765]);
  });

  test("race date/time label", () => {
    expect(formatRaceWhen("Feb 15")).toMatch(/^[A-Z]{3} FEB 15 • 2:30 PM$/);
    expect(formatRaceWhen(undefined)).toBe("");
  });

  test("all four players exist", () => { expect(PLAYERS).toHaveLength(4); });
});
