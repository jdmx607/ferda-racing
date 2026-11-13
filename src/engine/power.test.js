import { describe, test, expect } from "vitest";
import {
  getWeeklyPerformance, getPowerRankings, weightedScore, toPwr, formInsight,
  formatRankDelta, POWER_WEIGHTS,
} from "./power.js";

// Build one scored week. spec: { pid: { total, finishes:[…5 finishing positions], mull?, win? } }
const makeWeek = (spec) => {
  const scored = {}, rawDrivers = [];
  let n = 1;
  Object.entries(spec).forEach(([pid, s]) => {
    scored[pid] = {
      total: s.total,
      weeklyWin: !!s.win,
      drivers: s.finishes.map(f => {
        const name = `#${n++} Driver${n}`;
        rawDrivers.push({ name, finish: f });
        return { driver: name, total: 0, isMulligan: false };
      }),
    };
    if (s.mull) scored[pid].drivers[0].isMulligan = true;
  });
  return { scored, raw: { drivers: rawDrivers } };
};
const league = (weeks) => ({ results: Object.fromEntries(weeks.map((w, i) => ["w" + (i + 1), w])), picks: {} });
const flat = (total, mull = false) => ({ total, finishes: [15, 16, 17, 18, 19], mull });   // no bonuses/penalties

describe("Weekly Performance Score (W)", () => {
  test("base points + top-10 bonus − wreck penalty + placement − mulligan", () => {
    const d = league([makeWeek({
      justin:    { total: 100, finishes: [1, 5, 9, 31, 20], win: true, mull: true },   // 3 top-10, 1 wreck, winner, mulligan
      bigmonroe: { total: 90,  finishes: [2, 3, 4, 6, 7] },                            // 5 top-10 → +20; 2nd → +5
      monroe:    { total: 80,  finishes: [30, 35, 40, 12, 14] },                        // 3 wrecks → −15
      rich:      { total: 70,  finishes: [11, 12, 13, 14, 15] },
    })]);
    const p = getWeeklyPerformance(d);
    expect(p.justin[0]).toMatchObject({ top10: 3, wrecks: 1, place: 1, mulligan: true });
    expect(p.justin[0].w).toBe(100 + 12 - 5 + 15 - 12);                // 110
    expect(p.bigmonroe[0].w).toBe(90 + 20 + 5);                         // 115
    expect(p.monroe[0].w).toBe(80 - 15);                                // 65
    expect(p.rich[0].w).toBe(70);
  });

  test("top-10 bonus caps at +20 and 30th is the wreck line", () => {
    const d = league([makeWeek({
      justin: { total: 0, finishes: [1, 2, 3, 4, 5] }, bigmonroe: flat(0), monroe: flat(0), rich: flat(0),
    })]);
    expect(getWeeklyPerformance(d).justin[0].top10).toBe(5);
    const e = league([makeWeek({
      justin: { total: 0, finishes: [29, 30, 20, 20, 20] }, bigmonroe: flat(0), monroe: flat(0), rich: flat(0),
    })]);
    expect(getWeeklyPerformance(e).justin[0].wrecks).toBe(1);           // 29th is fine, 30th is not
  });

  test("the weekly-win flag (league tiebreak) decides 1st place", () => {
    const d = league([makeWeek({
      justin: { total: 100, finishes: [15, 16, 17, 18, 19] },
      bigmonroe: { total: 100, finishes: [15, 16, 17, 18, 19], win: true },
      monroe: flat(50), rich: flat(40),
    })]);
    const p = getWeeklyPerformance(d);
    expect(p.bigmonroe[0].place).toBe(1);
    expect(p.justin[0].place).toBe(2);
  });

  test("mulligan also detected from saved picks; unknown finishes earn nothing", () => {
    const d = league([makeWeek({ justin: flat(10), bigmonroe: flat(10), monroe: flat(10), rich: flat(10) })]);
    d.picks.w1 = { rich: [{ driver: "x", mulligan: true }] };
    delete d.results.w1.raw;                                            // no finishing data at all
    const p = getWeeklyPerformance(d);
    expect(p.rich[0].mulligan).toBe(true);
    expect(p.justin[0]).toMatchObject({ top10: 0, wrecks: 0 });
  });
});

describe("momentum window (40 / 30 / 20 / 10)", () => {
  const E = (...ws) => ws.map(w => ({ w }));

  test("exactly four races use 40/30/20/10 with the newest weighted most", () => {
    expect(POWER_WEIGHTS).toEqual([0.4, 0.3, 0.2, 0.1]);
    expect(weightedScore(E(100, 100, 100, 200))).toBeCloseTo(100 * 0.1 + 100 * 0.2 + 100 * 0.3 + 200 * 0.4, 6);   // 140
    expect(weightedScore(E(200, 100, 100, 100))).toBeCloseTo(200 * 0.1 + 100 * 0.9, 6);                              // 110
  });

  test("fewer than four races re-normalise across what exists", () => {
    expect(weightedScore(E(120))).toBe(120);
    expect(weightedScore(E(100, 200))).toBeCloseTo((100 * 0.3 + 200 * 0.4) / 0.7, 6);
    expect(weightedScore(E(100, 100, 100))).toBeCloseTo(100, 6);
    expect(weightedScore([])).toBe(0);
  });

  test("only the last four races count", () => {
    expect(weightedScore(E(999, 100, 100, 100, 100))).toBeCloseTo(100, 6);
  });
});

describe("PWR scale", () => {
  test("250 weighted = 100.0, clamped to 0–100, one decimal", () => {
    expect(toPwr(250)).toBe(100);
    expect(toPwr(125)).toBe(50);
    expect(toPwr(400)).toBe(100);
    expect(toPwr(-30)).toBe(0);
    expect(toPwr(137.5)).toBe(55);
    expect(toPwr(111)).toBe(44.4);
  });
});

describe("rankings, rank change and insight", () => {
  test("empty until a race is scored", () => {
    expect(getPowerRankings({ results: {} })).toEqual([]);
  });

  const build = () => league([
    makeWeek({ justin: { ...flat(150), win: true }, bigmonroe: flat(100), monroe: flat(80), rich: flat(60) }),
    makeWeek({ justin: flat(120), bigmonroe: flat(100), monroe: { ...flat(200), win: true }, rich: flat(80) }),
  ]);

  test("ranks by PWR and reports movement against the previous race", () => {
    const r = getPowerRankings(build());
    expect(r.map(p => p.id)).toEqual(["monroe", "justin", "bigmonroe", "rich"]);
    const m = r.find(p => p.id === "monroe");
    expect(m.rank).toBe(1);
    expect(m.prevRank).toBe(3);        // after W1 alone: justin, bigmonroe, monroe, rich
    expect(m.delta).toBe(2);
    expect(r.find(p => p.id === "justin")).toMatchObject({ prevRank: 1, delta: -1, rank: 2 });
    expect(r.every(p => p.pwr >= 0 && p.pwr <= 100)).toBe(true);
    // monroe: W1 = 80, W2 = 200 + 15 (win) = 215 → (80·0.3 + 215·0.4) / 0.7 = 157.14 → 62.9 PWR
    expect(r[0].weighted).toBe(157.1);
    expect(r[0].pwr).toBe(62.9);
    expect(r[0].powerScore).toBe(r[0].pwr);                              // legacy field
  });

  test("first race: no movement", () => {
    const r = getPowerRankings(league([makeWeek({ justin: flat(150), bigmonroe: flat(100), monroe: flat(80), rich: flat(60) })]));
    expect(r.every(p => p.delta === 0)).toBe(true);
  });

  test("breakdown reports the window", () => {
    const m = getPowerRankings(build()).find(p => p.id === "monroe");
    expect(m.breakdown).toMatchObject({ races: 2, wins: 1, mulligans: 0, top10: 0 });
    expect(m.window).toHaveLength(2);
  });

  test("rank-change labels", () => {
    expect(formatRankDelta(1)).toBe("▲ +1");
    expect(formatRankDelta(-2)).toBe("▼ -2");
    expect(formatRankDelta(0)).toBe("—");
  });
});

describe("form insight", () => {
  const e = (o = {}) => ({ w: 100, top10: 1, wrecks: 0, place: 3, mulligan: false, ...o });

  test("wins first", () => {
    expect(formInsight([e({ place: 1 }), e(), e({ place: 1 }), e()])).toBe("2 wins in last 4 races");
  });
  test("mulligan + wrecks", () => {
    expect(formInsight([e({ mulligan: true, wrecks: 1 }), e({ wrecks: 1 })])).toBe("Dipped after Mulligan + 2 DNFs");
  });
  test("wrecks alone", () => {
    expect(formInsight([e({ wrecks: 2 }), e()])).toBe("2 DNFs in last 2 races");
  });
  test("Top-10 average with a mulligan note", () => {
    expect(formInsight([e({ top10: 3 }), e({ top10: 3 }), e({ top10: 4 }), e({ top10: 3 })])).toBe("3.3 Top-10 drivers avg • Zero Mulligans burned");
    expect(formInsight([e({ top10: 3, mulligan: true }), e({ top10: 3 })])).toBe("3 Top-10 drivers avg • 1 Mulligan burned");
  });
  test("single win, many mulligans, trend, default", () => {
    expect(formInsight([e({ place: 1 }), e()])).toBe("1 win in last 2 races");
    expect(formInsight([e({ mulligan: true }), e({ mulligan: true }), e()])).toBe("2 Mulligans burned in last 3 races");
    expect(formInsight([e({ w: 80 }), e({ w: 120 })])).toBe("Peaked in the last race");
    expect(formInsight([e({ w: 120 }), e({ w: 80 })])).toBe("Cooling off after the last race");
    expect(formInsight([e({ w: 100 })])).toBe("1 Top-10 drivers avg");
    expect(formInsight([])).toBe("No races yet");
  });
});
