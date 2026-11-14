import { describe, test, expect } from "vitest";
import {
  getUpNext, picksUntil, splitDriver, lastNameOf, pillLabel, getScouting, buildPool,
  toggleQueue, moveToTop, pruneQueue,
} from "./draftBoard.js";
import { buildSnakeOrder } from "./draft.js";
import { nameKey } from "../driverKey.js";

const order = ["rich", "monroe", "bigmonroe", "justin"];
const snake = buildSnakeOrder(order);

describe("up next strip", () => {
  test("starts on the clock and marks where the order wraps into the next round", () => {
    // pick 3 of the draft (index 2) = Big Monroe; the same order repeats every round (no snake)
    const n = getUpNext(snake, 2, order, 5);
    expect(n.map(x => x.pid)).toEqual(["bigmonroe", "justin", "rich", "monroe", "bigmonroe"]);
    expect(n.map(x => x.seed)).toEqual([3, 4, 1, 2, 3]);
    expect(n.map(x => x.now)).toEqual([true, false, false, false, false]);
    expect(n.map(x => x.turn)).toEqual([false, false, true, false, false]);
    expect(n.map(x => x.round)).toEqual([1, 1, 2, 2, 2]);
    expect(n.map(x => x.pickNo)).toEqual([3, 4, 5, 6, 7]);
  });
  test("from pick 1: Rich → Monroe → Big Monroe → Justin ↻ Rich", () => {
    const n = getUpNext(snake, 0, order, 5);
    expect(n.map(x => x.seed)).toEqual([1, 2, 3, 4, 1]);
    expect(n[4].turn).toBe(true);
  });
  test("stops at the end of the draft and is empty once complete", () => {
    expect(getUpNext(snake, 18, order, 8)).toHaveLength(2);
    expect(getUpNext(snake, snake.length, order, 8)).toEqual([]);
  });
  test("picksUntil", () => {
    expect(picksUntil(snake, 0, "rich")).toBe(0);
    expect(picksUntil(snake, 0, "justin")).toBe(3);
    expect(picksUntil(snake, 1, "rich")).toBe(3);      // wraps into round 2
    expect(picksUntil(snake, snake.length, "rich")).toBeNull();
  });
});

describe("driver names", () => {
  test("nameKey ignores numbers, suffix decorations and accents", () => {
    expect(nameKey("#12 Ryan Blaney")).toBe("ryanblaney");
    expect(nameKey("Ryan Blaney")).toBe("ryanblaney");
    expect(nameKey("#88 Connor Zilisch #")).toBe("connorzilisch");
    expect(nameKey("Jimmie Johnson(i)")).toBe("jimmiejohnson");
    expect(nameKey("#7 Daniel Suárez")).toBe("danielsuarez");
    expect(nameKey("#33 Austin Hill / Jesse Love")).toBe("austinhill");
    expect(nameKey("#60 Ryan Preece")).toBe(nameKey("#6 Ryan Preece"));   // number change
    expect(nameKey("#6 Brad Keselowski")).not.toBe(nameKey("#6 Ryan Preece"));
  });
  test("splitDriver / lastNameOf / pillLabel", () => {
    expect(splitDriver("#12 Ryan Blaney")).toEqual({ num: "12", name: "Ryan Blaney" });
    expect(splitDriver("Mystery")).toEqual({ num: "", name: "Mystery" });
    expect(lastNameOf("Ryan Blaney")).toBe("Blaney");
    expect(lastNameOf("Ricky Stenhouse Jr")).toBe("Stenhouse Jr");
    expect(lastNameOf("Shane Van Gisbergen")).toBe("Van Gisbergen");
    expect(lastNameOf("Austin Hill / Jesse Love")).toBe("Hill");
    expect(pillLabel("#5 Kyle Larson")).toEqual({ num: "#5", last: "Larson" });
  });
});

describe("scouting", () => {
  const drv = (name, finish, extra = {}) => ({
    name, finish, qualPos: finish, lapsLed: 0, dnf: false, dq: false, pole: false,
    stageWin1: false, stageWin2: false, stageWin3: false, fastestLap: false, mostLapsLed: false,
    stage1: 0, stage2: 0, stage3: 0, ...extra,
  });
  // 2026 SCHEDULE: w4 Phoenix = short_track, w5 Las Vegas = intermediate, w7 Martinsville = short_track
  const data = { results: {
    w4: { raw: { drivers: [drv("#12 Ryan Blaney", 2), drv("#5 Kyle Larson", 10)] } },
    w5: { raw: { drivers: [drv("#12 Ryan Blaney", 6), drv("#5 Kyle Larson", 1)] } },
    w7: { raw: { drivers: [drv("#12 Ryan Blaney", 4)] } },
    w9: {},                                            // no raw → ignored
  } };
  const s = getScouting(data, "short_track");
  test("average finish across all scored races", () => {
    expect(s.ryanblaney.races).toBe(3);
    expect(s.ryanblaney.avgFinish).toBe(4);            // (2 + 6 + 4) / 3
    expect(s.kylelarson.avgFinish).toBe(5.5);
  });
  test("track rating = avg FERDA score at this archetype only", () => {
    expect(s.ryanblaney.trackRaces).toBe(2);
    expect(s.kylelarson.trackRaces).toBe(1);
    expect(s.ryanblaney.trackAvg).toBeGreaterThan(s.kylelarson.trackAvg);   // P2 and P4 beat a lone P10
  });
  test("no races of the archetype → null track rating", () => {
    expect(getScouting(data, "road_course").ryanblaney.trackAvg).toBeNull();
  });
});

describe("driver pool", () => {
  const drivers = ["#12 Ryan Blaney", "#5 Kyle Larson", "#88 Connor Zilisch", "#8 Kyle Busch", "#6 Brad Keselowski", "#11 Denny Hamlin"];
  const base = {
    drivers,
    owners: { "#12 Ryan Blaney": "rich" },
    scouting: { ryanblaney: { trackAvg: 30 }, kylelarson: { trackAvg: 55 }, dennyhamlin: { trackAvg: 40 } },
    grid: { kylelarson: 3, dennyhamlin: 1, ryanblaney: 12 },
    isRookie: d => d === "#88 Connor Zilisch",
    isFreeAgent: d => d === "#6 Brad Keselowski",
    isMemorial: d => d === "#8 Kyle Busch",
  };
  const names = rows => rows.map(r => r.driver);

  test("default: owned drivers hidden, memorial last, free agents in their own pool", () => {
    expect(names(buildPool(base))).toEqual(["#5 Kyle Larson", "#88 Connor Zilisch", "#11 Denny Hamlin", "#8 Kyle Busch"]);
    expect(names(buildPool({ ...base, pool: "free" }))).toEqual(["#6 Brad Keselowski"]);
  });
  test("Available off: owned shown, dimmed to the bottom (before memorial) with their owner", () => {
    const rows = buildPool({ ...base, availableOnly: false });
    expect(names(rows)).toEqual(["#5 Kyle Larson", "#88 Connor Zilisch", "#11 Denny Hamlin", "#12 Ryan Blaney", "#8 Kyle Busch"]);
    expect(rows[3].owner).toBe("rich");
    expect(rows[4].memorial).toBe(true);
  });
  test("search by name or number", () => {
    expect(names(buildPool({ ...base, search: "larson" }))).toEqual(["#5 Kyle Larson"]);
    expect(names(buildPool({ ...base, search: "#11" }))).toEqual(["#11 Denny Hamlin"]);
    expect(buildPool({ ...base, search: "zzz" })).toEqual([]);
  });
  test("bonus/rookie mode floats rookies to the top", () => {
    expect(names(buildPool({ ...base, mode: "bonus" }))[0]).toBe("#88 Connor Zilisch");
  });
  test("track rating mode sorts best first, unrated last", () => {
    expect(names(buildPool({ ...base, mode: "track" })).slice(0, 3)).toEqual(["#5 Kyle Larson", "#11 Denny Hamlin", "#88 Connor Zilisch"]);
  });
  test("starting top 10 filters to the front of the grid in grid order; no grid → empty", () => {
    expect(names(buildPool({ ...base, mode: "top10" }))).toEqual(["#11 Denny Hamlin", "#5 Kyle Larson"]);
    expect(buildPool({ ...base, mode: "top10", grid: null })).toEqual([]);
  });
  test("rows carry the display stats", () => {
    const r = buildPool({ ...base, scouting: { kylelarson: { avgFinish: 7.2, trackAvg: 55, trackRaces: 3, races: 20 } } })
      .find(x => x.driver === "#5 Kyle Larson");
    expect(r).toMatchObject({ start: 3, avgFinish: 7.2, trackAvg: 55, trackRaces: 3, rookie: false, owner: null });
  });
});

describe("my queue", () => {
  test("toggle adds to the end / removes", () => {
    expect(toggleQueue([], "a")).toEqual(["a"]);
    expect(toggleQueue(["a", "b"], "c")).toEqual(["a", "b", "c"]);
    expect(toggleQueue(["a", "b"], "a")).toEqual(["b"]);
  });
  test("moveToTop sets priority", () => {
    expect(moveToTop(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
    expect(moveToTop(["a"], "zzz")).toEqual(["a"]);
  });
  test("prune drops drafted + memorial, keeps order", () => {
    expect(pruneQueue(["a", "b", "c", "d"], new Set(["b"]), d => d === "d")).toEqual(["a", "c"]);
  });
});
