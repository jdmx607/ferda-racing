import { describe, test, expect } from "vitest";
import {
  expectedPts, tierFor, pickLabel, getWeekBoard, scoreGmWeek, rollingAverage, getGmRatings,
  formatGmDelta, WEIGHTS, STEAL_DELTA, BUST_DELTA,
} from "./gmRating.js";

// One fully-drafted week (W5 = Las Vegas, intermediate). Straight draft, same order
// every round: rich (seed 1), monroe (2), bigmonroe (3), justin (4).
// Overall pick k drafts driver "#k Driver k".
const ORDER = ["rich", "monroe", "bigmonroe", "justin"];
//              k:  finish, qualPos, dnf
const LINES = {
  1: [1, 1], 2: [2, 2], 3: [5, 3], 4: [4, 4], 5: [6, 5], 6: [7, 6], 7: [9, 7], 8: [8, 8],
  9: [30, 9, true], 10: [10, 10], 11: [11, 11], 12: [3, 12], 13: [35, 13, true], 14: [14, 14],
  15: [16, 15], 16: [15, 30], 17: [17, 17], 18: [18, 18], 19: [19, 19], 20: [25, 22],
};
const name = k => `#${k} Driver${k}`;
const drv = (k) => ({
  name: name(k), finish: LINES[k][0], qualPos: LINES[k][1], dnf: !!LINES[k][2], dq: false,
  lapsLed: 0, pole: false, stageWin1: false, stageWin2: false, stageWin3: false,
  fastestLap: false, mostLapsLed: false, stage1: 0, stage2: 0, stage3: 0,
});
const ks = Array.from({ length: 20 }, (_, i) => i + 1);
const pidOf = k => ORDER[(k - 1) % 4];

function weekFixture(week, totals, winner) {
  return {
    raw: { drivers: ks.map(drv) },
    scored: Object.fromEntries(ORDER.map(pid => [pid, { total: totals[pid], weeklyWin: pid === winner, drivers: [] }])),
  };
}
const draftLog = ks.map(k => ({ pid: pidOf(k), driver: name(k), pickNum: k - 1 }));
const picksOf = () => Object.fromEntries(ORDER.map(pid => [pid, ks.filter(k => pidOf(k) === pid).map(k => ({ driver: name(k) }))]));

const data = {
  results: { w5: weekFixture(5, { justin: 200, rich: 150, monroe: 120, bigmonroe: 100 }, "justin") },
  drafts: { w5: draftLog },
  picks: { w5: { ...picksOf(), rich: picksOf().rich.map((p, i) => (i === 4 ? { ...p, mulligan: true } : p)) } },
  mulligans: { rich: [{ week: 5, driver: "#17 Old Guy", replacement: name(17) }] },
};

describe("formula pieces", () => {
  test("expectation curve: pick 1 = max, pick 20 = max − 75% of the range", () => {
    expect(expectedPts(1, 100, 20)).toBe(100);
    expect(expectedPts(20, 100, 20)).toBe(40);
    expect(expectedPts(11, 100, 20)).toBeCloseTo(100 - (10 / 19) * 80 * 0.75, 6);
  });
  test("tiers", () => {
    expect(tierFor(90).label).toBe("CREW CHIEF");
    expect(tierFor(89.9).label).toBe("CONTENDER");
    expect(tierFor(80).label).toBe("CONTENDER");
    expect(tierFor(75).label).toBe("MID-PACK");
    expect(tierFor(69.9).label).toBe("GARAGE REBUILD");
  });
  test("labels and deltas", () => {
    expect(pickLabel(14, 4)).toBe("Pick #14 • R4");
    expect(formatGmDelta(1)).toBe("▲ +1");
    expect(formatGmDelta(-1)).toBe("▼ -1");
    expect(formatGmDelta(0)).toBe("—");
  });
  test("rolling weights 40/30/20/10, normalised when fewer than 4 races", () => {
    expect(rollingAverage([10, 20, 30, 40])).toBeCloseTo(0.4 * 40 + 0.3 * 30 + 0.2 * 20 + 0.1 * 10, 6);
    expect(rollingAverage([0, 10, 20, 30, 40])).toBeCloseTo(30, 6);         // oldest dropped
    expect(rollingAverage([50, 100])).toBeCloseTo((0.4 * 100 + 0.3 * 50) / 0.7, 6);
    expect(rollingAverage([])).toBe(0);
  });
});

describe("draft board", () => {
  test("uses the stored draft log", () => {
    const b = getWeekBoard(data, 5);
    expect(b).toHaveLength(20);
    expect(b[0]).toMatchObject({ k: 1, pid: "rich", round: 1, seed: 1 });
    expect(b[19]).toMatchObject({ k: 20, pid: "justin", round: 5, seed: 4 });
  });
  test("rebuilds from draft order + slot order when there's no log, mapping mulligans back", () => {
    // W2 order comes from W1: lowest score picks first → justin, rich, monroe, bigmonroe
    const d = {
      results: { w1: { scored: { justin: { total: 10 }, rich: { total: 20 }, monroe: { total: 30 }, bigmonroe: { total: 40 } } } },
      picks: { w2: {
        justin: [{ driver: "#1 A" }, { driver: "#9 New", mulligan: true }],
        rich: [{ driver: "#2 B" }, { driver: "#6 F" }],
        monroe: [{ driver: "#3 C" }, { driver: "#7 G" }],
        bigmonroe: [{ driver: "#4 D" }, { driver: "#8 H" }],
      } },
      mulligans: { justin: [{ week: 2, driver: "#5 E", replacement: "#9 New" }] },
    };
    const b = getWeekBoard(d, 2);
    expect(b.map(x => `${x.k}:${x.pid}:${x.driver}`)).toEqual([
      "1:justin:#1 A", "2:rich:#2 B", "3:monroe:#3 C", "4:bigmonroe:#4 D",
      "5:justin:#5 E", "6:rich:#6 F", "7:monroe:#7 G", "8:bigmonroe:#8 H",
    ]);
    expect(b.filter(x => x.pid === "justin").every(x => x.mulligan)).toBe(true);
  });
});

describe("one week", () => {
  const w = scoreGmWeek(data, 5);
  const J = w.managers.justin, R = w.managers.rich;

  test("expectations are centred: the 20 picks sum to ~0 over expectation", () => {
    const sum = w.picks.reduce((a, p) => a + p.delta, 0);
    expect(Math.abs(sum)).toBeLessThan(1);                  // rounding only
    expect(w.picks[0].expected).toBeGreaterThan(w.picks[19].expected);
  });
  test("VOPE score = clamp(50 + totalVOPE × 0.6)", () => {
    const tot = w.picks.filter(p => p.pid === "justin").reduce((a, p) => a + p.delta, 0);
    expect(J.totalVOPE).toBeCloseTo(tot, 0);
    expect(J.vopeScore).toBeCloseTo(Math.min(100, Math.max(0, 50 + J.totalVOPE * 0.6)), 0);
  });
  test("scouting: +12 late-round top 10, +10 for P20+ starters gaining 10+", () => {
    expect(J.scouting).toBe(50 + 12 + 10);                  // #12 (k12) finished P3; #16 started P30 → P15
    expect(R.scouting).toBe(50);
  });
  test("execution: clean sheet, top-15s, DNFs, mulligan", () => {
    expect(J.execution).toBe(50 + 20 + 4 * 6);              // 0 DNF, 4 top-15s
    expect(R).toMatchObject({ dnfs: 2, top15: 2, mulligan: true });
    expect(R.execution).toBe(50 + 2 * 6 - 2 * 15 - 15);
  });
  test("finish: placement + back-row winner bonus", () => {
    expect(J).toMatchObject({ placement: 1, seed: 4, backRowWin: true, finish: 100 });
    expect(R).toMatchObject({ placement: 2, seed: 1, backRowWin: false, finish: 70 });
    expect(w.managers.bigmonroe.finish).toBe(30);
  });
  test("weekly GM = 40/25/20/15 composite", () => {
    const want = WEIGHTS.vope * J.vopeScore + WEIGHTS.scouting * J.scouting + WEIGHTS.execution * J.execution + WEIGHTS.finish * J.finish;
    expect(J.gm).toBeCloseTo(want, 0);
  });
  test("best value pick and steal / bust flags follow the deltas", () => {
    const mine = w.picks.filter(p => p.pid === "justin");
    expect(J.bestValue.delta).toBe(Math.max(...mine.map(p => p.delta)));
    w.picks.forEach(p => {
      expect(p.steal).toBe(p.delta >= STEAL_DELTA);
      expect(p.bust).toBe(p.k <= 8 && p.delta <= BUST_DELTA);
    });
  });
  test("the mulliganed slot is judged on the originally drafted driver", () => {
    const b = getWeekBoard(data, 5);
    expect(b.find(x => x.k === 17).driver).toBe(name(17));  // draft log already has the original
  });
  test("ungradeable weeks return null", () => {
    expect(scoreGmWeek(data, 9)).toBeNull();
    expect(scoreGmWeek({ results: { w5: { scored: {} } } }, 5)).toBeNull();
  });
});

describe("season ratings", () => {
  // W6 = Darlington (intermediate): same board, rich wins this time
  const two = {
    ...data,
    results: { ...data.results, w6: weekFixture(6, { justin: 90, rich: 210, monroe: 120, bigmonroe: 100 }, "rich") },
    drafts: { ...data.drafts, w6: draftLog },
    picks: { ...data.picks, w6: picksOf() },
  };
  const g = getGmRatings(two);
  test("ranked by rolling rating with tiers, pillars and last-week detail", () => {
    expect(g.weeks.map(w => w.week)).toEqual([5, 6]);
    expect(g.managers.map(m => m.rank)).toEqual([1, 2, 3, 4]);
    const ratings = g.managers.map(m => m.rolling);
    expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
    g.managers.forEach(m => {
      expect(m.tier.label).toBe(tierFor(m.rolling).label);
      expect(Object.keys(m.rollingPillars)).toEqual(["vopeScore", "scouting", "execution", "finish"]);
      expect(m.last.week).toBe(6);
    });
  });
  test("rolling = 40/30/20/10 of weekly GM; season = plain average", () => {
    const j = g.managers.find(m => m.id === "justin");
    const gms = [g.byWeek[5].managers.justin.gm, g.byWeek[6].managers.justin.gm];
    expect(j.rolling).toBeCloseTo(rollingAverage(gms), 0);
    expect(j.season).toBeCloseTo((gms[0] + gms[1]) / 2, 0);
  });
  test("rank delta compares with the table a week earlier", () => {
    const one = getGmRatings(data);                         // only W5
    g.managers.forEach(m => {
      const before = one.managers.find(x => x.id === m.id).rank;
      expect(m.delta).toBe(before - m.rank);
    });
    expect(one.managers.every(m => m.delta === 0)).toBe(true);
  });
});
