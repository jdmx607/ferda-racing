import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { SCHEDULES, DRIVERS } from "../constants.js";
import { nameKey } from "../driverKey.js";
import {
  trackSlug, seasonTracks, currentTrack, ownersFor, buildRows, sortRows, groupByTier, logSummary, sheetSubtitle, TIERS,
} from "./cheatSheet.js";

const DATA_DIR = path.resolve(__dirname, "../../public/data");
const readJson = p => JSON.parse(fs.readFileSync(path.join(DATA_DIR, p), "utf8"));

const fixtureSheet = {
  slug: "daytona", track: "Daytona", discipline: "superspeedway", seasons: [2022, 2026], nextGenRaces: 10, lengthMi: 2.5, surface: "paved",
  drivers: [
    { key: "kylelarson", name: "Kyle Larson", tier: 1, composite: 90, start: null, stats: { avgFinish: 5, rating: 110, ledPct: 8, disciplineAvg: 9, starts: 10 }, tags: ["x"], log: [{ season: 2026, race: 1, start: 4, finish: 2, led: 10, win: false }] },
    { key: "chaseelliott", name: "Chase Elliott", tier: 2, composite: 70, start: null, stats: { avgFinish: 11, rating: 90, ledPct: 3, disciplineAvg: 12, starts: 10 }, tags: [], log: [] },
    { key: "ryanblaney", name: "Ryan Blaney", tier: 4, composite: 20, start: null, stats: { avgFinish: 25, rating: 60, ledPct: 0, disciplineAvg: 22, starts: 4 }, tags: [], log: [] },
  ],
};

describe("trackSlug", () => {
  it("matches the slugs the Python pipeline writes", () => {
    expect(trackSlug("N. Wilkesboro")).toBe("n-wilkesboro");
    expect(trackSlug("WWT Raceway")).toBe("wwt-raceway");
    expect(trackSlug("COTA")).toBe("cota");
    expect(trackSlug("New Hampshire")).toBe("new-hampshire");
    expect(trackSlug("Watkins Glen")).toBe("watkins-glen");
  });
});

describe("season tracks", () => {
  it("lists each track once, in schedule order", () => {
    const t = seasonTracks(SCHEDULES[2027]);
    expect(new Set(t.map(x => x.slug)).size).toBe(t.length);
    expect(t[0].slug).toBe("daytona");
  });
  it("currentTrack follows the week and survives the end of the season", () => {
    expect(currentTrack(3, SCHEDULES[2027]).slug).toBe("cota");
    expect(currentTrack(999, SCHEDULES[2027])).toBeTruthy();
  });
});

describe("generated data (public/data)", () => {
  const master = readJson("tracks_master.json");
  it("has a sheet for every track on the 2026 and 2027 schedules", () => {
    const slugs = new Set(master.tracks.map(t => t.slug));
    for (const year of [2026, 2027]) {
      for (const t of seasonTracks(SCHEDULES[year])) {
        expect(slugs.has(t.slug), `${year} ${t.track} → ${t.slug}`).toBe(true);
        expect(fs.existsSync(path.join(DATA_DIR, "cheat_sheets", t.slug + ".json"))).toBe(true);
      }
    }
  });
  it("agrees with the app on each track's discipline", () => {
    const bySlug = Object.fromEntries(master.tracks.map(t => [t.slug, t.discipline]));
    for (const year of [2026, 2027]) {
      for (const t of seasonTracks(SCHEDULES[year])) expect(bySlug[t.slug], t.track).toBe(t.ty);
    }
  });
  it("every sheet is well-formed and scores stay in range", () => {
    for (const t of master.tracks) {
      const sheet = readJson(`cheat_sheets/${t.slug}.json`);
      expect(sheet.drivers.length).toBeGreaterThan(30);
      for (const d of sheet.drivers) {
        expect(d.composite).toBeGreaterThanOrEqual(0);
        expect(d.composite).toBeLessThanOrEqual(100);
        expect([1, 2, 3, 4]).toContain(d.tier);
        expect(d.log.length).toBe(d.stats.starts);
        expect(d.tags.length).toBeLessThanOrEqual(3);
        d.log.forEach(r => expect(r.season).toBeGreaterThanOrEqual(2022));
      }
      expect(sheet.drivers.some(d => d.tier === 1), `${t.slug} has an elite tier`).toBe(true);
    }
  });
  it("excludes obsolete configurations and merges the renamed Atlanta track", () => {
    const atlanta = readJson("cheat_sheets/atlanta.json");
    expect(atlanta.nextGenRaces).toBe(10);
    const bristol = readJson("cheat_sheets/bristol.json");
    const names = bristol.drivers.flatMap(d => d.log.map(r => r.track));
    expect(names.some(n => /Dirt/i.test(n))).toBe(false);
  });
  it("covers (nearly) every draftable driver in the app pool", () => {
    const sheet = readJson("cheat_sheets/daytona.json");
    const keys = new Set(sheet.drivers.map(d => d.key));
    const missing = buildRows(sheet).filter(r => !keys.has(r.key)).map(r => r.driver);
    // Rookies / new full-timers may have no 2026 Cup start yet; everyone else must match by name.
    expect(missing.length).toBeLessThanOrEqual(3);
  });
});

describe("buildRows", () => {
  const pool = ["#5 Kyle Larson", "#9 Chase Elliott", "#12 Ryan Blaney", "#99 Nobody New"];
  it("joins the sheet by driver name, using the app's own car number", () => {
    const rows = buildRows(fixtureSheet, { pool });
    expect(rows.find(r => r.key === "kylelarson")).toMatchObject({ num: "5", tier: 1, composite: 90 });
    expect(rows.find(r => r.key === "nobodynew")).toMatchObject({ tier: null, sheet: null });
  });
  it("flags drivers already drafted and place-diff targets", () => {
    const rows = buildRows(fixtureSheet, { pool, owners: { kylelarson: "rich" }, grid: { kylelarson: 24, ryanblaney: 30 } });
    expect(rows.find(r => r.key === "kylelarson")).toMatchObject({ owner: "rich", start: 24, placeDiffTarget: true });
    // P30 but Tier 4 → not a target
    expect(rows.find(r => r.key === "ryanblaney").placeDiffTarget).toBe(false);
  });
});

describe("ownersFor", () => {
  it("reads this week's draft log and lineups", () => {
    const data = {
      drafts: { w3: [{ driver: "#5 Kyle Larson", pid: "rich" }, { driver: "#9 Chase Elliott", pid: "justin" }] },
      picks: { w3: { monroe: ["#12 Ryan Blaney"], rich: ["#5 Kyle Larson"] } },
    };
    expect(ownersFor(data, 3)).toEqual({ kylelarson: "rich", chaseelliott: "justin", ryanblaney: "monroe" });
    expect(ownersFor({}, 3)).toEqual({});
  });
});

describe("sorting and grouping", () => {
  const rows = buildRows(fixtureSheet, { pool: ["#5 Kyle Larson", "#9 Chase Elliott", "#12 Ryan Blaney", "#99 Nobody New"] });
  it("sorts best-first for each stat and pushes missing data last", () => {
    expect(sortRows(rows, "composite").map(r => r.key)).toEqual(["kylelarson", "chaseelliott", "ryanblaney", "nobodynew"]);
    expect(sortRows(rows, "avgFinish").map(r => r.key)[0]).toBe("kylelarson");   // lower is better
    expect(sortRows(rows, "avgFinish").map(r => r.key).at(-1)).toBe("nobodynew");
    expect(sortRows(rows, "ledPct").map(r => r.key)[0]).toBe("kylelarson");       // higher is better
  });
  it("groups by tier with an unrated bucket", () => {
    const g = groupByTier(rows);
    expect(g.map(x => x.tier)).toEqual([1, 2, 3, 4, null]);
    expect(g[2].rows).toHaveLength(0);
    expect(g[4].rows[0].key).toBe("nobodynew");
  });
  it("tier metadata covers all four tiers", () => {
    expect(Object.keys(TIERS)).toEqual(["1", "2", "3", "4"]);
  });
});

describe("log helpers", () => {
  it("summarises a race log", () => {
    const s = logSummary([{ start: 10, finish: 2, led: 5, win: false }, { start: 20, finish: 1, led: 50, win: true }]);
    expect(s).toMatchObject({ starts: 2, avgStart: 15, avgFinish: 1.5, led: 55, wins: 1 });
    expect(logSummary([])).toBeNull();
  });
  it("describes the track in one line", () => {
    expect(sheetSubtitle(fixtureSheet)).toBe("2.5 mi · paved · 10 Next Gen races (2022–2026)");
  });
});

describe("app pool sanity", () => {
  it("DRIVERS yields unique name keys", () => {
    const keys = DRIVERS.map(nameKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
