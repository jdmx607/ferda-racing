import { describe, test, expect } from "vitest";
import { PLAYERS } from "../constants.js";
import {
  getLineupStatus, getPlayerLineup, getHomeLineupWeek, getSeasonWrapUp,
  getRaceMvp, shortName, pointsBack,
  defaultStandingsView, standingsProgress, getStandings, cutlineRank, buildBubble,
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

  test("all four players exist", () => { expect(PLAYERS).toHaveLength(4); });
});

describe("standings views: Regular Season (W1–26) vs The Chase (W27–36)", () => {
  const build = () => {
    const d = blank();
    d.meta.standings  = { justin: 3000, bigmonroe: 3200, monroe: 2900, rich: 3100 };   // frozen at W26
    d.meta.playoffPts = { justin: 100, bigmonroe: 50, monroe: 0, rich: 20 };
    d.meta.chasePts   = { justin: 0, bigmonroe: 0, monroe: 0, rich: 0 };
    d.results.w10 = scoredWeek({ justin: 90, bigmonroe: 80, monroe: 70, rich: 60 });
    d.results.w10.scored.justin.weeklyWin = true;
    return d;
  };

  test("defaults to Regular Season until a Chase race is scored", () => {
    const d = build();
    expect(defaultStandingsView(d)).toBe("regular");
    d.results.w27 = scoredWeek({ justin: 10, bigmonroe: 20, monroe: 30, rich: 40 });
    expect(defaultStandingsView(d)).toBe("chase");
  });

  test("progress counts only races in that view", () => {
    const d = build();
    d.results.w27 = scoredWeek({ justin: 1, bigmonroe: 2, monroe: 3, rich: 4 });
    d.results.w28 = scoredWeek({ justin: 1, bigmonroe: 2, monroe: 3, rich: 4 });
    expect(standingsProgress(d, "regular")).toEqual({ done: 1, total: 26 });
    expect(standingsProgress(d, "chase")).toEqual({ done: 2, total: 10 });
  });

  test("regular view ranks by season points; wins only count W1–26", () => {
    const d = build();
    d.results.w27 = scoredWeek({ justin: 10, bigmonroe: 20, monroe: 30, rich: 40 });
    d.results.w27.scored.rich.weeklyWin = true;
    const reg = getStandings(d, "regular");
    expect(reg.map(r => r.id)).toEqual(["bigmonroe", "rich", "justin", "monroe"]);
    expect(reg.find(r => r.id === "justin").wins).toBe(1);
    expect(reg.find(r => r.id === "rich").wins).toBe(0);      // the W27 win is a Chase win
  });

  test("chase view ranks by Chase total (1,000 + playoff pts + bonus + Chase pts); wins only count W27+", () => {
    const d = build();
    d.meta.chasePts = { justin: 10, bigmonroe: 5, monroe: 300, rich: 80 };
    d.results.w27 = scoredWeek({ justin: 10, bigmonroe: 5, monroe: 300, rich: 80 });
    d.results.w27.scored.monroe.weeklyWin = true;
    const ch = getStandings(d, "chase");
    expect(ch[0].id).toBe("monroe");                           // 1000 + 0 + 300 beats 1000 + 100 + 10
    expect(ch[0].pts).toBe(1300);
    expect(ch.find(r => r.id === "justin").wins).toBe(0);      // the W10 win is a regular-season win
    expect(ch[0].wins).toBe(1);
  });
});

describe("chase cutline (top 16 drivers)", () => {
  const field = Array.from({ length: 30 }, (_, i) => ({
    num: String(i + 1), name: `#${i + 1} Driver ${i + 1}`, pos: i + 1, points: 1000 - i * 10, inChase: i < 16,
  }));

  test("cutline rank by week", () => {
    expect(cutlineRank(1)).toBe(16);
    expect(cutlineRank(26)).toBe(16);
    expect(cutlineRank(27)).toBe(12);
    expect(cutlineRank(29)).toBe(12);
    expect(cutlineRank(30)).toBe(8);
    expect(cutlineRank(33)).toBe(4);
    expect(cutlineRank(35)).toBe(4);
    expect(cutlineRank(36)).toBeNull();
  });

  test("regular season: bubble is ranks 14–19 around 16th, gap measured to the 16th driver", () => {
    const b = buildBubble(field, 26);
    expect(b.cut).toBe(16);
    expect(b.rows.map(r => r.rank)).toEqual([14, 15, 16, 17, 18, 19]);
    const r16 = b.rows.find(r => r.rank === 16), r17 = b.rows.find(r => r.rank === 17), r15 = b.rows.find(r => r.rank === 15);
    expect(r16).toMatchObject({ gap: 0, inside: true, bubble: true });
    expect(r17).toMatchObject({ gap: -10, inside: false, bubble: true });
    expect(r15).toMatchObject({ gap: 10, inside: true, bubble: false });
  });

  test("Chase rounds only consider playoff drivers", () => {
    const b = buildBubble(field, 27);                 // round of 16 → cut to 12
    expect(b.cut).toBe(12);
    expect(b.rows.every(r => r.inChase)).toBe(true);
    expect(buildBubble(field, 36)).toBeNull();
  });

  test("returns null when the feed has too few drivers", () => {
    expect(buildBubble(field.slice(0, 10), 5)).toBeNull();
    expect(buildBubble(null, 5)).toBeNull();
  });
});
