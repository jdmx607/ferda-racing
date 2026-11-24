import { describe, test, expect } from "vitest";
import {
  weekContext, ownership, startFor, estimatePts, leagueRacesAt, trackHistory,
  disciplineProfile, formTone, recentForm, pickCta,
} from "./telemetryCard.js";

const drv = (name, finish, extra = {}) => ({
  name, finish, qualPos: finish, lapsLed: 0, dnf: false, dq: false, pole: false,
  stageWin1: false, stageWin2: false, stageWin3: false, fastestLap: false, mostLapsLed: false,
  stage1: 0, stage2: 0, stage3: 0, ...extra,
});

// 2026 schedule: W3 COTA + W12 Watkins Glen (road courses), W4 Phoenix (short track), W2 / W20 Atlanta
const REDDICK = "#45 Tyler Reddick", BLANEY = "#12 Ryan Blaney", LARSON = "#5 Kyle Larson", ELLIOTT = "#9 Chase Elliott";
const data = {
  results: {
    w3: { raw: { drivers: [drv(REDDICK, 1, { qualPos: 5, lapsLed: 10 }), drv(BLANEY, 2), drv(LARSON, 12), drv(ELLIOTT, 3)] },
          scored: { justin: { total: 90, drivers: [{ driver: REDDICK, total: 76.5 }] }, rich: { total: 40, drivers: [{ driver: BLANEY, total: 37 }, { driver: "#99 Nobody", total: 0, dnr: true }] } } },
    w12: { raw: { drivers: [drv(REDDICK, 11), drv(BLANEY, 1), drv(ELLIOTT, 4)] } },
    w4: { raw: { drivers: [drv(REDDICK, 1), drv(BLANEY, 30, { dnf: true })] } },
  },
  exhibitions: { results: { w0: { raw: { drivers: [drv(REDDICK, 1)] } } } },
};

describe("estimatePts", () => {
  test("uses the real scoring rules on what the public data has", () => {
    expect(estimatePts({ finish: 2, start: 10, led: 0 }, "road_course")).toBe(45);          // 35 + top-5 2 + net +8
    expect(estimatePts({ finish: 2, start: 10, led: 20 }, "road_course")).toBe(75.5);       // + 20 laps ×1.5 + 0.5 led-a-lap
    expect(estimatePts({ finish: 1, start: 1, led: 0 }, "intermediate")).toBe(62);          // 55 + 2 + pole 5
  });
});

describe("leagueRacesAt", () => {
  test("finds this driver's scored races at a track, with real points", () => {
    const r = leagueRacesAt({ 2026: data }, "cota", REDDICK);
    expect(r).toEqual([{ year: 2026, order: 3, finish: 1, start: 5, led: 10, dnf: false, pts: 76.5, exact: true }]);
  });
  test("ignores other tracks, other drivers and exhibition races", () => {
    expect(leagueRacesAt({ 2026: data }, "las-vegas", REDDICK)).toEqual([]);
    expect(leagueRacesAt({ 2026: data }, "cota", "#1 Ross Chastain")).toEqual([]);
    expect(leagueRacesAt({ 2026: data }, "daytona", REDDICK)).toEqual([]);   // only the Clash had him
    expect(leagueRacesAt({ 2026: null, 2027: undefined }, "cota", REDDICK)).toEqual([]);
  });
});

describe("trackHistory", () => {
  const sheetLog = [
    { season: 2025, race: 3, finish: 5, start: 5, led: 0, status: "running" },
    { season: 2026, race: 3, finish: 2, start: 10, led: 0, status: "running" },
    { season: 2024, race: 3, finish: 12, start: 20, led: 0, status: "accident" },
  ];
  const league = [{ year: 2026, order: 3, finish: 2, start: 10, led: 0, dnf: false, pts: 71.5, exact: true }];
  const h = trackHistory({ sheetLog, league, ty: "road_course" });

  test("blends Next Gen history with the league's own scores, newest first", () => {
    expect(h.starts).toBe(3);
    expect(h.avgFinish).toBe(6.3);               // (2 + 5 + 12) / 3
    expect(h.bestFinish).toBe(2);
    expect(h.last3.map(r => r.year)).toEqual([2026, 2025, 2024]);
    expect(h.last3[0]).toMatchObject({ finish: 2, pts: 71.5, exact: true });   // real score replaces the estimate
    expect(h.last3[1]).toMatchObject({ finish: 5, pts: 34, exact: false });    // 32 + 2
    expect(h.last3[2]).toMatchObject({ dnf: true, exact: false });
    expect(h.avgPts).toBe(46.2);                 // (71.5 + 34 + 33) / 3
  });
  test("flags averages that rely on estimates", () => {
    expect(h.estimated).toBe(true);
    expect(trackHistory({ sheetLog: [], league, ty: "road_course" }).estimated).toBe(false);
    expect(trackHistory({ sheetLog, league: [], ty: "road_course" }).avgPts).toBe(37.3);   // (45 + 34 + 33) / 3
  });
  test("adds league races the public data doesn't have yet, without double-counting", () => {
    const fresh = trackHistory({ sheetLog, league: [{ year: 2027, order: 3, finish: 1, start: 4, led: 5, dnf: false, pts: 80, exact: true }], ty: "road_course" });
    expect(fresh.starts).toBe(4);
    expect(fresh.last3[0]).toMatchObject({ year: 2027, finish: 1 });
    expect(fresh.wins).toBe(1);
    // numbering drift: same year / start / finish still merges
    const drift = trackHistory({ sheetLog, league: [{ ...league[0], order: 99 }], ty: "road_course" });
    expect(drift.starts).toBe(3);
  });
  test("returns null for a driver who has never raced here", () => {
    expect(trackHistory({ sheetLog: [], league: [], ty: "road_course" })).toBeNull();
    expect(trackHistory({ sheetLog: [{ season: 2025, race: 3, finish: null }], league: [], ty: "road_course" })).toBeNull();
  });
});

describe("disciplineProfile", () => {
  test("season-to-date average, top-10 rate and laps led on this kind of track only", () => {
    const p = disciplineProfile(data, REDDICK, "road_course");
    expect(p).toMatchObject({ racesHeld: 2, races: 2, avgPts: 51.3, top10Rate: 50, lapsLed: 10 });   // (76.5 + 26) / 2; Phoenix ignored
  });
  test("ranks by average points among drivers with enough starts", () => {
    expect(disciplineProfile(data, REDDICK, "road_course")).toMatchObject({ rank: 1, of: 3 });
    expect(disciplineProfile(data, BLANEY, "road_course")).toMatchObject({ rank: 2, avgPts: 47, top10Rate: 100 });
    expect(disciplineProfile(data, ELLIOTT, "road_course").rank).toBe(3);
  });
  test("a driver with too few starts shows stats but no rank; a stranger shows nothing", () => {
    expect(disciplineProfile(data, LARSON, "road_course")).toMatchObject({ races: 1, avgPts: 25, rank: null });
    expect(disciplineProfile(data, "#1 Ross Chastain", "road_course")).toMatchObject({ races: 0, avgPts: null, top10Rate: null, rank: null });
    expect(disciplineProfile(data, REDDICK, "superspeedway")).toMatchObject({ racesHeld: 0, races: 0, rank: null });
  });
});

describe("recent form pills", () => {
  test("colour tones: gold win, green top 5, blue top 10, red DNF", () => {
    expect(formTone({ finish: 1 })).toBe("gold");
    expect(formTone({ finish: 3 })).toBe("go");
    expect(formTone({ finish: 5 })).toBe("go");
    expect(formTone({ finish: 6 })).toBe("blue");
    expect(formTone({ finish: 10 })).toBe("blue");
    expect(formTone({ finish: 11 })).toBe("none");
    expect(formTone({ finish: 3, dnf: true })).toBe("stop");
  });
  test("last five, newest first, with a tap-for-detail line", () => {
    const log = [
      { week: 9, track: "Kansas", finish: 3, pts: 41.5 }, { week: 8, track: "Bristol", finish: 11, pts: 22 },
      { week: 7, track: "Martinsville", finish: 2, pts: 52 }, { week: 6, track: "Darlington", finish: 28, dnf: true, pts: -1 },
      { week: 5, track: "Las Vegas", finish: 6, pts: 31 }, { week: 4, track: "Phoenix", finish: 1, pts: 70 },
    ];
    const f = recentForm(log);
    expect(f.map(p => p.label)).toEqual(["P3", "P11", "P2", "DNF", "P6"]);
    expect(f.map(p => p.tone)).toEqual(["go", "none", "go", "stop", "blue"]);
    expect(f[0].detail).toBe("W9 · Kansas · P3 · +41.5 pts");
    expect(f[3].detail).toBe("W6 · Darlington · DNF (P28) · -1 pts");
    expect(recentForm(undefined)).toEqual([]);
  });
});

describe("weekContext / ownership / startFor", () => {
  const picks20 = Array.from({ length: 20 }, (_, i) => ({ driver: `#${i + 50} Driver ${String.fromCharCode(65 + i)}`, pid: ["justin", "rich", "monroe", "bigmonroe"][i % 4], pickNum: i }));
  const drafting = { drafts: { w5: [{ driver: BLANEY, pid: "monroe", pickNum: 0 }] }, results: {} };
  const locked = { drafts: { w5: picks20 }, results: {} };

  test("a draft in progress: drafted drivers show their manager, the rest are available", () => {
    expect(ownership(drafting, 5, BLANEY)).toEqual({ owners: ["monroe"], status: "drafted" });
    expect(ownership(drafting, 5, REDDICK)).toEqual({ owners: [], status: "available" });
    expect(weekContext(drafting, 5).locked).toBe(false);
  });
  test("once the draft is full nobody is 'available' any more", () => {
    expect(weekContext(locked, 5).locked).toBe(true);
    expect(ownership(locked, 5, REDDICK).status).toBe("undrafted");
  });
  test("a live race locks the week too", () => {
    expect(weekContext({ liveRace: { active: true, week: 5 }, results: {} }, 5).live).toBe(true);
    expect(ownership({ liveRace: { active: true, week: 5 }, results: {} }, 5, REDDICK).status).toBe("undrafted");
  });
  test("memorial drivers are never available", () => {
    expect(ownership(drafting, 5, "#8 Kyle Busch").status).toBe("memorial");
  });
  test("scored weeks read owners from the scored lineups (did-not-race picks don't count)", () => {
    expect(ownership(data, 3, REDDICK)).toEqual({ owners: ["justin"], status: "drafted" });
    expect(ownership(data, 3, BLANEY).owners).toEqual(["rich"]);
    expect(ownership(data, 3, LARSON)).toEqual({ owners: [], status: "undrafted" });
    expect(weekContext(data, 3)).toMatchObject({ scored: true, locked: true });
  });
  test("start: the recorded spot once scored, otherwise the live grid", () => {
    expect(startFor(data, 3, REDDICK, null)).toBe(5);
    expect(startFor(drafting, 5, REDDICK, { tylerreddick: 14 })).toBe(14);
    expect(startFor(drafting, 5, REDDICK, null)).toBeNull();
  });
});

describe("pickCta", () => {
  const base = { num: "12", name: "Ryan Blaney", me: "justin" };
  test("draft room: your turn → DRAFT", () => {
    expect(pickCta({ ...base, mode: "draft", status: "available", draft: { myTurn: true } }))
      .toEqual({ id: "draft", label: "DRAFT #12 RYAN BLANEY" });
  });
  test("draft room: waiting → queue / unqueue", () => {
    expect(pickCta({ ...base, mode: "draft", status: "available", draft: { myTurn: false, queued: false } }).label).toBe("ADD TO MY QUEUE");
    expect(pickCta({ ...base, mode: "draft", status: "available", draft: { myTurn: false, queued: true } }).label).toBe("REMOVE FROM QUEUE");
  });
  test("draft room: a driver who is already taken falls back to the race log", () => {
    expect(pickCta({ ...base, mode: "draft", status: "drafted", owners: ["rich"], draft: { myTurn: true } }).id).toBe("log");
    expect(pickCta({ ...base, mode: "draft", status: "memorial", draft: { myTurn: true } }).id).toBe("log");
  });
  test("lineups / live: captain button only for your own driver, and only once captains exist", () => {
    const captain = { isCaptain: false };
    expect(pickCta({ ...base, mode: "lineup", status: "drafted", owners: ["justin"], captain }).label).toBe("SET AS CAPTAIN (1.25× BONUS)");
    expect(pickCta({ ...base, mode: "live", status: "drafted", owners: ["justin"], captain: { isCaptain: true } }).id).toBe("uncaptain");
    expect(pickCta({ ...base, mode: "live", status: "drafted", owners: ["rich"], captain }).id).toBe("log");
    expect(pickCta({ ...base, mode: "live", status: "drafted", owners: ["justin"] }).id).toBe("log");   // no captain rule yet
  });
  test("results / stats / drivers: the season race log", () => {
    expect(pickCta({ ...base, mode: "results", status: "drafted", owners: ["justin"] }).label).toBe("VIEW FULL SEASON RACE LOG");
    expect(pickCta({ ...base, mode: "stats", status: "available", logOpen: true }).label).toBe("HIDE SEASON RACE LOG");
  });
});
