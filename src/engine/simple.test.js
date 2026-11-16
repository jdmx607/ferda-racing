import { describe, test, expect } from "vitest";
import { isSimplified, draftStatus, myPicks, availableDrivers, scoreboard, mulliganWindow, splitName } from "./simple.js";

// W35 draft: order from W34 (lowest score first) → rich, monroe, bigmonroe, justin (same every round)
const base = { results: { w34: { scored: { rich: { total: 1 }, monroe: { total: 2 }, bigmonroe: { total: 3 }, justin: { total: 4 } } } } };
const ORDER = ["rich", "monroe", "bigmonroe", "justin"];
const withDraft = n => ({ ...base, drafts: { w35: Array.from({ length: n }, (_, i) => ({ pid: ORDER[i % 4], driver: ["#5 Kyle Larson", "#11 Denny Hamlin", "#12 Ryan Blaney", "#9 Chase Elliott", "#20 Christopher Bell", "#24 William Byron", "#45 Tyler Reddick", "#22 Joey Logano"][i] || `#${90 + i} X`, pickNum: i })) } });

describe("simplified mode default", () => {
  test("Big Monroe on by default; Settings override wins", () => {
    expect(isSimplified("bigmonroe", {})).toBe(true);
    expect(isSimplified("justin", {})).toBe(false);
    expect(isSimplified("bigmonroe", { bigmonroe: { simplifiedMode: false } })).toBe(false);
    expect(isSimplified("rich", { rich: { simplifiedMode: true } })).toBe(true);
  });
  test("name split", () => { expect(splitName("#12 Ryan Blaney")).toEqual({ num: "12", name: "Ryan Blaney" }); });
});

describe("draft status (plain English)", () => {
  test("waiting: who's on the clock and my next overall pick + round", () => {
    expect(draftStatus(withDraft(0), 35, "bigmonroe")).toEqual({ state: "waiting", onClock: "rich", nextOverall: 3, nextRound: 1, myPickNo: 1 });
    expect(draftStatus(withDraft(3), 35, "bigmonroe")).toMatchObject({ state: "waiting", onClock: "justin", nextOverall: 7, nextRound: 2, myPickNo: 2 });
  });
  test("my turn → pick X of 5", () => {
    expect(draftStatus(withDraft(2), 35, "bigmonroe")).toEqual({ state: "myTurn", onClock: "bigmonroe", myPickNo: 1, pickNum: 2 });
    expect(draftStatus(withDraft(6), 35, "bigmonroe")).toMatchObject({ state: "myTurn", myPickNo: 2, pickNum: 6 });
  });
  test("gated before Monday 5 PM; complete after 20 picks; no race when the season is over", () => {
    const gated = { ...withDraft(0), draftSchedule: { w35: { opensAt: "2099-01-01T00:00:00Z" } } };
    expect(draftStatus(gated, 35, "bigmonroe").state).toBe("gated");
    expect(draftStatus(withDraft(20), 35, "bigmonroe").state).toBe("complete");
    expect(draftStatus(base, 99, "bigmonroe").state).toBe("none");
  });
});

describe("my picks + available drivers", () => {
  test("five slots, filled from the draft", () => {
    const p = myPicks(withDraft(7), 35, "bigmonroe");
    expect(p.map(x => x.driver)).toEqual(["#12 Ryan Blaney", "#45 Tyler Reddick", null, null, null]);
    expect(p.map(x => x.slot)).toEqual([1, 2, 3, 4, 5]);
    expect(p.every(x => x.mulligan === false)).toBe(true);
    const saved = { picks: { w35: { bigmonroe: [{ driver: "#1 A" }, { driver: "#2 B", mulligan: true }] } } };
    expect(myPicks(saved, 35, "bigmonroe")[1]).toEqual({ slot: 2, driver: "#2 B", mulligan: true });
  });
  test("drafted, memorial and free-agent drivers are hidden; search + sort", () => {
    const list = availableDrivers(withDraft(4), 35);
    expect(list).not.toContain("#5 Kyle Larson");
    expect(list).not.toContain("#8 Kyle Busch");               // memorial
    expect(list).not.toContain("#6 Brad Keselowski");          // free agent, no ride
    expect(list[0]).toBe("#1 Ross Chastain");                  // by car number
    expect(availableDrivers(withDraft(0), 35, { search: "24" })).toEqual(["#24 William Byron"]);
    expect(availableDrivers(withDraft(0), 35, { search: "#24" })).toEqual(["#24 William Byron"]);
    expect(availableDrivers(withDraft(0), 35, { search: "blaney" })).toEqual(["#12 Ryan Blaney"]);
    const az = availableDrivers(withDraft(0), 35, { sort: "az" });
    expect(az[0]).toBe("#16 AJ Allmendinger");                 // A–Z by last name
  });
});

describe("scoreboard", () => {
  test("live scores when racing, else the latest final", () => {
    const live = scoreboard(base, { currentWeek: 35, liveScores: { justin: { total: 50 }, rich: { total: 80 } }, liveWeek: 35 });
    expect(live).toMatchObject({ week: 35, label: "LIVE" });
    expect(live.rows.map(r => r.pid).slice(0, 2)).toEqual(["rich", "justin"]);
    const fin = scoreboard(base, { currentWeek: 35 });
    expect(fin).toMatchObject({ week: 34, label: "FINAL" });
    expect(fin.rows.map(r => r.total)).toEqual([4, 3, 2, 1]);
    expect(scoreboard({ results: {} }, { currentWeek: 1 })).toMatchObject({ week: null, label: null });
  });
});

describe("mulligan window", () => {
  const five = ["#12 Ryan Blaney", "#45 Tyler Reddick", "#1 Ross Chastain", "#2 Austin Cindric", "#3 Austin Dillon"].map(driver => ({ driver }));
  const data = { ...base, picks: { w35: { bigmonroe: [...five.slice(0, 4), { driver: "#3 Austin Dillon", mulligan: true }], justin: [{ driver: "#5 Kyle Larson" }] } } };
  test("open for the current unscored week; already-mulliganed slot can't be swapped again", () => {
    const m = mulliganWindow(data, "bigmonroe", 35);
    expect(m.open).toBe(true);
    expect(m.remaining).toBe(9);                               // 10 − the one already used
    expect(m.mine).toEqual(five.slice(0, 4).map(p => p.driver));
    expect(m.pool).not.toContain("#5 Kyle Larson");           // someone else's driver
    expect(m.pool).not.toContain("#12 Ryan Blaney");
  });
  test("closed once the week is scored or with no lineup", () => {
    expect(mulliganWindow({ ...data, results: { ...data.results, w35: { scored: {} } } }, "bigmonroe", 35).open).toBe(false);
    expect(mulliganWindow(data, "rich", 35).open).toBe(false);
  });
});
