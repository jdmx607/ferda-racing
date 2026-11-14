import { describe, test, expect } from "vitest";
import {
  fmtLapTime, fmtPts, getFastestLap, getStageStatus, showStageCutoff, normalizeIntervals,
  buildStandings, buildDriverRows, filterRows, diffTimingEvents, getLineups,
} from "./liveBoard.js";

const v = (carNumber, position, extra = {}) => ({
  carNumber, driver: `Driver ${carNumber}`, position, lapsComp: 100, delta: 0, isOnTrack: true,
  bestLap: 0, lastLap: 0, lastSpeed: 0, lapsLed: 0, ...extra,
});
const raw = (name, finish, extra = {}) => ({
  name, finish, qualPos: finish, lapsLed: 0, dnf: false, dq: false, pole: false,
  stageWin1: false, stageWin2: false, stageWin3: false, fastestLap: false, mostLapsLed: false,
  stage1: 0, stage2: 0, stage3: 0, ...extra,
});

describe("formatting", () => {
  test("lap times and points", () => {
    expect(fmtLapTime(31.42)).toBe("31.42s");
    expect(fmtLapTime(63.5)).toBe("1:03.50");
    expect(fmtLapTime(0)).toBe("—");
    expect(fmtPts(64.5)).toBe("+64.5");
    expect(fmtPts(0)).toBe("0");
    expect(fmtPts(-3)).toBe("-3");
  });
});

describe("race status", () => {
  test("fastest lap = lowest positive best lap", () => {
    expect(getFastestLap([v("1", 1, { bestLap: 32.1 }), v("11", 2, { bestLap: 31.42 }), v("5", 3, { bestLap: 0 })]))
      .toEqual({ carNumber: "11", driver: "Driver 11", time: 31.42 });
    expect(getFastestLap([v("1", 1)])).toBeNull();
    expect(getFastestLap(null)).toBeNull();
  });
  test("stage status counts laps left to the stage end", () => {
    const t = { lapNumber: 142, lapsInRace: 267, stage: { stage_num: 2, finish_at_lap: 165 } };
    expect(getStageStatus(t)).toEqual({ num: 2, final: false, lapsLeft: 23, label: "STAGE 2 • 23 LAPS LEFT" });
    expect(getStageStatus({ ...t, lapNumber: 164 }).label).toBe("STAGE 2 • 1 LAP LEFT");
  });
  test("final stage ends with the race", () => {
    const s = getStageStatus({ lapNumber: 250, lapsInRace: 267, stage: { stage_num: 3, finish_at_lap: 267 } });
    expect(s).toMatchObject({ final: true, lapsLeft: 17, label: "FINAL STAGE • 17 LAPS LEFT" });
    expect(getStageStatus({ lapNumber: 1, lapsInRace: 200, stage: { stage_num: 3, finish_at_lap: 0 } }).final).toBe(true);
  });
  test("no stage block / pre-race → null", () => {
    expect(getStageStatus(null)).toBeNull();
    expect(getStageStatus({ lapNumber: 0, lapsInRace: 0, stage: { stage_num: 0 } })).toBeNull();
  });
  test("cutoff line only in non-final stages 1 and 2", () => {
    expect(showStageCutoff({ num: 1, final: false })).toBe(true);
    expect(showStageCutoff({ num: 2, final: false })).toBe(true);
    expect(showStageCutoff({ num: 3, final: false })).toBe(false);
    expect(showStageCutoff({ num: 2, final: true })).toBe(false);
    expect(showStageCutoff(null)).toBe(false);
  });
});

describe("intervals", () => {
  test("gap-to-leader deltas pass straight through; leader is LEAD; lapped cars are -nL", () => {
    const iv = normalizeIntervals([
      v("12", 1), v("11", 2, { delta: -1.8 }), v("5", 3, { delta: -2.4 }), v("9", 4, { delta: -12.6 }),
      v("77", 5, { lapsComp: 99, delta: -50 }),
    ]);
    expect(iv["12"].text).toBe("LEAD");
    expect(iv["11"].text).toBe("+1.8s");
    expect(iv["5"].text).toBe("+2.4s");
    expect(iv["9"].text).toBe("+12.6s");
    expect(iv["77"]).toMatchObject({ text: "-1L", lapsDown: 1 });
  });
  test("gaps to the car ahead (non-increasing vs leader) are accumulated", () => {
    const iv = normalizeIntervals([v("12", 1), v("11", 2, { delta: 1.8 }), v("5", 3, { delta: 0.6 }), v("9", 4, { delta: 0.4 })]);
    expect(iv["5"].text).toBe("+2.4s");
    expect(iv["9"].text).toBe("+2.8s");
  });
  test("missing delta → dash; empty → nothing", () => {
    expect(normalizeIntervals([v("12", 1), v("11", 2)])["11"].text).toBe("—");
    expect(normalizeIntervals([])).toEqual({});
  });
});

describe("standings", () => {
  const players = [{ id: "justin", name: "Justin" }, { id: "monroe", name: "Monroe" }, { id: "rich", name: "Rich" }];
  test("sorted by live points with points-back and bar width", () => {
    const s = buildStandings(players, { justin: { total: 80 }, monroe: { total: 94.5 }, rich: { total: 20 } });
    expect(s.map(x => x.id)).toEqual(["monroe", "justin", "rich"]);
    expect(s.map(x => x.back)).toEqual([0, 14.5, 74.5]);
    expect(s[0].pct).toBe(100);
    expect(Math.round(s[1].pct)).toBe(85);
  });
  test("all zeros → empty bars, no NaN", () => {
    const s = buildStandings(players, {});
    expect(s.every(x => x.pts === 0 && x.back === 0 && x.pct === 0)).toBe(true);
  });
});

describe("driver rows", () => {
  const liveScores = {
    justin: { total: 90, drivers: [
      { driver: "#11 Denny Hamlin", total: 64.5, breakdown: [{ label: "P3", pts: 34 }, { label: "Fast Lap", pts: 1 }, { label: "DNF", pts: 0 }] },
      { driver: "#99 Missing Guy", total: 0, breakdown: [], dnr: true },
    ] },
    rich: { total: 30, drivers: [{ driver: "#12 Ryan Blaney", total: 30, breakdown: [], isMulligan: true }] },
  };
  const timing = {
    vehicles: [
      v("5", 1, { driver: "Kyle Larson", lapsComp: 100 }),
      v("12", 2, { driver: "Ryan Blaney", delta: -0.9 }),
      v("11", 3, { driver: "Denny Hamlin", delta: -1.8, isOnTrack: false }),
      v("2", 4, { driver: "Austin Cindric", delta: -3.2 }),
    ],
  };
  const raceInfo = {
    positions: { "5": { finish: 1, start: 4 }, "12": { finish: 2, start: 2 }, "11": { finish: 3, start: 8 }, "2": { finish: 4, start: 3, dnf: false } },
    raw: { threeStages: false, drivers: [raw("#5 Kyle Larson", 1, { lapsLed: 40 }), raw("#2 Austin Cindric", 4)] },
  };
  const rows = buildDriverRows({ timing, raceInfo, liveScores, week: 4 });
  const by = k => rows.find(r => r.num === k);

  test("running order, owners and official points for owned drivers", () => {
    expect(rows.map(r => r.num).slice(0, 4)).toEqual(["5", "12", "11", "2"]);
    expect(by("11")).toMatchObject({ owners: ["justin"], pts: 64.5, pos: 3, start: 8, posDelta: 5, pit: true, interval: "PIT" });
    expect(by("12")).toMatchObject({ owners: ["rich"], pts: 30, mull: true, interval: "+0.9s", posDelta: 0 });
  });
  test("breakdown chips drop zero-point labels", () => {
    expect(by("11").breakdown.map(b => b.label)).toEqual(["P3", "Fast Lap"]);
  });
  test("undrafted drivers are scored with the same calcDriverScore", () => {
    expect(by("5").owners).toEqual([]);
    expect(by("5").pts).toBeGreaterThan(55);           // P1 + laps led etc.
    expect(by("2").pts).toBeGreaterThan(0);
  });
  test("drivers with no raw line and no owner have no points", () => {
    const r2 = buildDriverRows({ timing, raceInfo: { ...raceInfo, raw: { drivers: [] } }, liveScores: {}, week: 4 });
    expect(r2.every(r => r.pts === null)).toBe(true);
  });
  test("owned driver the feeds don't list still appears (did not race), last", () => {
    expect(rows[rows.length - 1]).toMatchObject({ num: "99", dnr: true, pos: null });
  });
  test("filters: mine / all drafted / full field", () => {
    expect(filterRows(rows, "mine", "justin").map(r => r.num)).toEqual(["11", "99"]);
    expect(filterRows(rows, "drafted", "justin").map(r => r.num)).toEqual(["12", "11", "99"]);
    expect(filterRows(rows, "field", "justin")).toHaveLength(rows.length);
  });
  test("works from the scoring feed alone when timing is missing", () => {
    const r = buildDriverRows({ timing: null, raceInfo, liveScores, week: 4 });
    expect(r.find(x => x.num === "5").pos).toBe(1);
    expect(r.find(x => x.num === "5").interval).toBeNull();
  });
});

describe("race-control events", () => {
  const snap = (extra = {}) => ({
    lapNumber: 100, cautions: 1, leadChanges: 3, flagState: 1, stage: { stage_num: 1, finish_at_lap: 60 },
    vehicles: [v("12", 1, { driver: "Ryan Blaney", bestLap: 32 }), v("11", 2, { driver: "Denny Hamlin", bestLap: 32.5 })], ...extra,
  });
  test("first snapshot produces nothing", () => {
    expect(diffTimingEvents(null, snap())).toEqual([]);
    expect(diffTimingEvents(snap(), snap())).toEqual([]);
  });
  test("caution + restart", () => {
    expect(diffTimingEvents(snap(), snap({ cautions: 2, flagState: 2, lapNumber: 104 }))[0])
      .toMatchObject({ kind: "caution", lap: 104, text: "Caution #2", tone: "caution" });
    expect(diffTimingEvents(snap({ flagState: 2 }), snap({ flagState: 1 }))[0])
      .toMatchObject({ kind: "flag", text: "Green flag — racing resumes" });
  });
  test("red flag and checkered", () => {
    expect(diffTimingEvents(snap(), snap({ flagState: 3 }))[0].text).toBe("Red flag");
    expect(diffTimingEvents(snap(), snap({ flagState: 5 }))[0].text).toBe("Checkered flag");
  });
  test("lead change names the new leader", () => {
    const next = snap({ leadChanges: 4, vehicles: [v("11", 1, { driver: "Denny Hamlin", bestLap: 32.5 }), v("12", 2, { driver: "Ryan Blaney", bestLap: 32 })] });
    expect(diffTimingEvents(snap(), next).find(e => e.kind === "lead")).toMatchObject({ car: "11", text: "Lead change — #11 Hamlin takes the lead" });
  });
  test("stage break", () => {
    expect(diffTimingEvents(snap(), snap({ stage: { stage_num: 2, finish_at_lap: 120 } })).find(e => e.kind === "stage").text).toBe("Stage 1 complete");
  });
  test("new fastest lap only when it beats the old one", () => {
    const faster = snap({ vehicles: [v("12", 1, { driver: "Ryan Blaney", bestLap: 32 }), v("11", 2, { driver: "Denny Hamlin", bestLap: 31.42 })] });
    expect(diffTimingEvents(snap(), faster).find(e => e.kind === "fastest")).toMatchObject({ car: "11", text: "Fastest lap — #11 Hamlin 31.42s" });
    expect(diffTimingEvents(faster, snap()).find(e => e.kind === "fastest")).toBeUndefined();
  });
});

describe("pre-race lineups", () => {
  const players = [{ id: "justin", name: "Justin" }, { id: "rich", name: "Rich" }, { id: "monroe", name: "Monroe" }];
  const five = ["#1 A", "#2 B", "#3 C", "#4 D", "#5 E"].map(driver => ({ driver }));
  test("saved picks are locked; garage slots ignored", () => {
    const l = getLineups(players, { justin: [...five, { driver: "#9 Garage", garage: true }] }, []);
    expect(l[0]).toMatchObject({ id: "justin", locked: true, complete: true });
    expect(l[0].drivers).toHaveLength(5);
  });
  test("draft in progress shows what's been picked so far", () => {
    const l = getLineups(players, {}, [{ pid: "rich", driver: "#12 Ryan Blaney" }, { pid: "rich", driver: "#5 Kyle Larson" }]);
    expect(l[1]).toMatchObject({ locked: false, complete: false, drivers: ["#12 Ryan Blaney", "#5 Kyle Larson"] });
    expect(l[2]).toMatchObject({ locked: false, complete: false, drivers: [] });
  });
  test("a fully drafted but unsaved lineup is complete, not locked", () => {
    const l = getLineups(players, {}, five.map(f => ({ pid: "justin", driver: f.driver })));
    expect(l[0]).toMatchObject({ locked: false, complete: true });
  });
});
