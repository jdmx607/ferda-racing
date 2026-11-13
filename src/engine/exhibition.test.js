import { describe, test, expect, vi } from "vitest";

// Run these against the 2027 schedule (the one with the Clash and All-Star),
// regardless of which season the app is currently set to.
vi.mock("../constants.js", async (orig) => {
  const m = await orig();
  return { ...m, SCHEDULE: m.SCHEDULES[2027] };
});

import { PLAYOFF_START_WEEK } from "../constants.js";
import { SCHEDULE_2027 } from "../schedule2027.js";
import { CLASH_WEEK, ALL_STAR_WEEK, isExhibition, weekLabel } from "../exhibitions.js";
import { getCurrentWeek, getNextEventWeek, getPrevPointsWeek, storeFor, ensureStore } from "./events.js";
import { getDraftOrder } from "./draft.js";
import { recalcMeta } from "./meta.js";

// ── helpers ─────────────────────────────────────────────────────────────────
const scored = (totals, extra = {}) =>
  Object.fromEntries(Object.entries(totals).map(([pid, total]) =>
    [pid, { total, bonusPoints: 0, weeklyWin: false, ...(extra[pid] || {}) }]));

const blank = () => ({ results: {}, picks: {}, drafts: {}, meta: {} });

// W12 / Clash / All-Star results where `loser` scored least and `winner` most
const withResult = (d, week, totals, extra) => {
  const s = ensureStore(d, week);
  s.results = s.results || {};
  s.results["w" + week] = { scored: scored(totals, extra), raw: {} };
  return d;
};

describe("2027 schedule", () => {
  const points = SCHEDULE_2027.filter(s => !s.ex);
  const ex     = SCHEDULE_2027.filter(s => s.ex);

  test("36 points races, numbered 1-36 in order", () => {
    expect(points.map(s => s.w)).toEqual(Array.from({ length: 36 }, (_, i) => i + 1));
  });

  test("exactly the Clash and the All-Star Race are exhibitions", () => {
    expect(ex.map(s => s.r)).toEqual(["Wheatley Vodka Clash", "NASCAR All-Star Race"]);
    expect(ex.map(s => s.w)).toEqual([CLASH_WEEK, ALL_STAR_WEEK]);
    expect(SCHEDULE_2027.every(s => isExhibition(s.w) === !!s.ex)).toBe(true);
  });

  test("Clash opens the season; All-Star runs between Week 12 and Week 13", () => {
    const ids = SCHEDULE_2027.map(s => s.w);
    expect(ids[0]).toBe(CLASH_WEEK);
    expect(ids.indexOf(ALL_STAR_WEEK)).toBe(ids.indexOf(12) + 1);
    expect(ids.indexOf(13)).toBe(ids.indexOf(ALL_STAR_WEEK) + 1);
  });

  test("dates run forward through the year", () => {
    const MONTHS = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
    const t = s => { const [m, d] = s.d.split(" "); return new Date(2027, MONTHS[m], +d).getTime(); };
    for (let i = 1; i < SCHEDULE_2027.length; i++) {
      expect(t(SCHEDULE_2027[i])).toBeGreaterThan(t(SCHEDULE_2027[i - 1]));
    }
  });

  test("the Chase starts at Richmond in Week 27; finale is Homestead", () => {
    expect(PLAYOFF_START_WEEK).toBe(27);
    expect(SCHEDULE_2027.find(s => s.w === 27).t).toBe("Richmond");
    expect(SCHEDULE_2027.find(s => s.w === 36).t).toBe("Homestead");
  });

  test("labels", () => {
    expect([CLASH_WEEK, ALL_STAR_WEEK, 5].map(weekLabel)).toEqual(["Clash", "All-Star", "W5"]);
  });
});

describe("event order", () => {
  test("starts on the Clash, then Week 1", () => {
    const d = blank();
    expect(getCurrentWeek(d)).toBe(CLASH_WEEK);
    withResult(d, CLASH_WEEK, { justin: 1, bigmonroe: 2, monroe: 3, rich: 4 });
    expect(getCurrentWeek(d)).toBe(1);
  });

  test("All-Star comes after Week 12, then Week 13", () => {
    const d = blank();
    withResult(d, CLASH_WEEK, { justin: 1, bigmonroe: 2, monroe: 3, rich: 4 });
    for (let w = 1; w <= 12; w++) withResult(d, w, { justin: 1, bigmonroe: 2, monroe: 3, rich: 4 });
    expect(getCurrentWeek(d)).toBe(ALL_STAR_WEEK);
    withResult(d, ALL_STAR_WEEK, { justin: 1, bigmonroe: 2, monroe: 3, rich: 4 });
    expect(getCurrentWeek(d)).toBe(13);
  });

  test("after the finale there is no next event (season over)", () => {
    const d = blank();
    SCHEDULE_2027.forEach(s => withResult(d, s.w, { justin: 1, bigmonroe: 2, monroe: 3, rich: 4 }));
    expect(getCurrentWeek(d)).toBe(37);
    expect(getNextEventWeek(36)).toBeNull();
  });

  test("neighbours in schedule order", () => {
    expect(getNextEventWeek(CLASH_WEEK)).toBe(1);
    expect(getNextEventWeek(12)).toBe(ALL_STAR_WEEK);
    expect(getNextEventWeek(ALL_STAR_WEEK)).toBe(13);
    expect(getPrevPointsWeek(ALL_STAR_WEEK)).toBe(12);
    expect(getPrevPointsWeek(13)).toBe(12);   // the All-Star is skipped
    expect(getPrevPointsWeek(CLASH_WEEK)).toBeNull();
  });

  test("exhibition data lives in data.exhibitions, regular data at the top", () => {
    const d = blank();
    expect(storeFor(d, 5)).toBe(d);
    ensureStore(d, CLASH_WEEK).picks = { w0: { justin: [] } };
    expect(storeFor(d, CLASH_WEEK).picks.w0).toBeDefined();
    expect(d.picks.w0).toBeUndefined();
  });
});

describe("draft order", () => {
  test("Clash result sets Week 1's order: last place picks first", () => {
    const d = blank();
    withResult(d, CLASH_WEEK, { justin: 100, bigmonroe: 40, monroe: 70, rich: 90 });
    expect(getDraftOrder(d, 1)).toEqual(["bigmonroe", "monroe", "rich", "justin"]);
  });

  test("Week 1 falls back to the default order until the Clash is scored", () => {
    expect(getDraftOrder(blank(), 1)).toEqual(["justin", "bigmonroe", "monroe", "rich"]);
  });

  test("the Clash only affects Week 1 — Week 2 follows Week 1", () => {
    const d = blank();
    withResult(d, CLASH_WEEK, { justin: 100, bigmonroe: 40, monroe: 70, rich: 90 });
    withResult(d, 1, { justin: 10, bigmonroe: 90, monroe: 50, rich: 30 });
    expect(getDraftOrder(d, 2)).toEqual(["justin", "rich", "monroe", "bigmonroe"]);
  });

  test("All-Star and Week 13 both follow Week 12, not the All-Star", () => {
    const d = blank();
    withResult(d, 12, { justin: 10, bigmonroe: 90, monroe: 50, rich: 30 });
    withResult(d, ALL_STAR_WEEK, { justin: 99, bigmonroe: 1, monroe: 50, rich: 60 });
    const expected = ["justin", "rich", "monroe", "bigmonroe"];
    expect(getDraftOrder(d, ALL_STAR_WEEK)).toEqual(expected);
    expect(getDraftOrder(d, 13)).toEqual(expected);
  });
});

describe("points: exhibitions stay out of the standings", () => {
  const build = () => {
    const d = blank();
    d.meta = {};
    withResult(d, 1, { justin: 200, bigmonroe: 150, monroe: 100, rich: 50 },
      { justin: { weeklyWin: true, bonusPoints: 5 } });
    return d;
  };

  test("the Clash changes nothing", () => {
    const base = build(); recalcMeta(base);
    const d = build();
    withResult(d, CLASH_WEEK, { justin: 5, bigmonroe: 500, monroe: 5, rich: 5 },
      { bigmonroe: { weeklyWin: true, bonusPoints: 30 } });
    recalcMeta(d);
    expect(d.meta.standings).toEqual(base.meta.standings);
    expect(d.meta.playoffPts).toEqual(base.meta.playoffPts);
    expect(d.meta.lastScoredWeek).toBe(1);
  });

  test("the All-Star leaves standings alone but adds bonus pts + win bonus to playoff pts", () => {
    const base = build(); recalcMeta(base);
    const d = build();
    withResult(d, ALL_STAR_WEEK, { justin: 20, bigmonroe: 300, monroe: 20, rich: 20 },
      { bigmonroe: { weeklyWin: true, bonusPoints: 7.5 }, rich: { bonusPoints: 2.5 } });
    recalcMeta(d);
    expect(d.meta.standings).toEqual(base.meta.standings);          // not in the standings
    expect(d.meta.playoffPts.bigmonroe).toBe(base.meta.playoffPts.bigmonroe + 7.5 + 25);
    expect(d.meta.playoffPts.rich).toBe(base.meta.playoffPts.rich + 2.5);
    expect(d.meta.playoffPts.justin).toBe(base.meta.playoffPts.justin);
    expect(d.meta.lastScoredWeek).toBe(1);                          // not a points week
    expect(d.meta.chasePts).toEqual(base.meta.chasePts);
  });

  test("the All-Star is never treated as a Chase week", () => {
    const d = build();
    withResult(d, ALL_STAR_WEEK, { justin: 20, bigmonroe: 300, monroe: 20, rich: 20 });
    recalcMeta(d);
    expect(Object.values(d.meta.chasePts).every(v => v === 0)).toBe(true);
  });
});
