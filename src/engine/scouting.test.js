import { describe, test, expect } from "vitest";
import {
  getTrackStrategy, getTrackForm, hasPdUpside, isPlayoffWeek, activePlayoffKeys,
  getToRear, toggleInList, scoutingTags,
} from "./scouting.js";

const drv = (name, finish) => ({ name, finish });

describe("strategy callout", () => {
  test("road course = STAGE FLIP, superspeedway = TRACK STRATEGY, others none", () => {
    expect(getTrackStrategy("road_course")).toMatchObject({ title: "STAGE FLIP", mult: "RC ×1.5" });
    expect(getTrackStrategy("superspeedway")).toMatchObject({ title: "TRACK STRATEGY", mult: "SS ×1.0" });
    expect(getTrackStrategy("intermediate")).toBeNull();
    expect(getTrackStrategy("short_track")).toBeNull();
  });
});

describe("track-package form", () => {
  // 2026 short tracks: w4, w7, w8, w21, w23, w24 · w5 is intermediate
  const data = { results: {
    w4:  { raw: { drivers: [drv("#12 Ryan Blaney", 10), drv("#11 Denny Hamlin", 1)] } },
    w7:  { raw: { drivers: [drv("#12 Ryan Blaney", 8)] } },
    w8:  { raw: { drivers: [drv("#12 Ryan Blaney", 6)] } },
    w21: { raw: { drivers: [drv("#12 Ryan Blaney", 4)] } },
    w23: { raw: { drivers: [drv("#12 Ryan Blaney", 2)] } },
    w24: { raw: { drivers: [drv("#12 Ryan Blaney", 0), drv("#60 Ryan Preece", 5)] } },   // finish 0 ignored
    w5:  { raw: { drivers: [drv("#12 Ryan Blaney", 40)] } },                              // other archetype
  } };
  const f = getTrackForm(data, "short_track");
  test("last 5 at the archetype, newest first", () => {
    expect(f.ryanblaney.finishes).toEqual([2, 4, 6, 8, 10]);
    expect(f.ryanblaney).toMatchObject({ races: 5, avgFinish: 6 });
  });
  test("fewer than 5 races still averages; keyed by name so renumbered drivers carry over", () => {
    expect(f.dennyhamlin).toEqual({ races: 1, avgFinish: 1, finishes: [1] });
    expect(f.ryanpreece.races).toBe(1);
  });
  test("nothing at that archetype → empty", () => {
    expect(getTrackForm(data, "road_course")).toEqual({});
  });
});

describe("PD upside", () => {
  test("starts P20+ and averages 12+ spots better", () => {
    expect(hasPdUpside(24, 12)).toBe(true);
    expect(hasPdUpside(20, 8)).toBe(true);
    expect(hasPdUpside(19, 2)).toBe(false);       // not deep enough
    expect(hasPdUpside(30, 19)).toBe(false);      // gap only 11
    expect(hasPdUpside(null, 5)).toBe(false);
    expect(hasPdUpside(30, null)).toBe(false);
  });
});

describe("playoffs", () => {
  test("weeks 27–36 only", () => {
    expect(isPlayoffWeek(26)).toBe(false);
    expect(isPlayoffWeek(27)).toBe(true);
    expect(isPlayoffWeek(36)).toBe(true);
    expect(isPlayoffWeek(37)).toBe(false);
  });
  test("active field excludes eliminated drivers", () => {
    const s = activePlayoffKeys({ drivers: ["#11 Denny Hamlin", "#12 Ryan Blaney"], eliminated: { "#12 Ryan Blaney": 30 } });
    expect([...s]).toEqual(["dennyhamlin"]);
    expect(activePlayoffKeys(null).size).toBe(0);
  });
});

describe("to the rear", () => {
  test("read per week and toggle", () => {
    const data = { toRear: { w35: ["#5 Kyle Larson"] } };
    expect(getToRear(data, 35)).toEqual(["#5 Kyle Larson"]);
    expect(getToRear(data, 34)).toEqual([]);
    expect(toggleInList(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleInList(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("tags", () => {
  test("order: to the rear, PD upside, playoff", () => {
    expect(scoutingTags({ start: 28, avgFinish: 10, toRear: true, playoff: true }).map(t => t.label))
      .toEqual(["TO THE REAR", "PD UPSIDE", "PLAYOFF"]);
  });
  test("tones and no tags by default", () => {
    const t = scoutingTags({ start: 28, avgFinish: 10 });
    expect(t).toEqual([expect.objectContaining({ id: "pd", tone: "go" })]);
    expect(scoutingTags({})).toEqual([]);
  });
});
