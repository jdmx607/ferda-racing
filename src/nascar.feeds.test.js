import { describe, test, expect, vi, afterEach } from "vitest";
import pointsSample from "./__fixtures__/live-points.sample.json";
import raceListSample from "./__fixtures__/race-list.sample.json";
import { fetchDriverStandings, fetchRaceStartTimes } from "./nascar.js";
import { buildBubble } from "./engine/home.js";
import { raceStartMs, formatRaceWhen } from "./engine/racetime.js";

// Real payloads from NASCAR's feeds (trimmed), served through a mocked fetch.
const serve = body => vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => body })));
afterEach(() => vi.unstubAllGlobals());

describe("NASCAR driver standings feed", () => {
  test("parses names, points and the chase flag from the real payload", async () => {
    serve(pointsSample);
    const s = await fetchDriverStandings();
    expect(s.drivers).toHaveLength(24);
    expect(s.drivers[0]).toMatchObject({ num: "5", name: "#5 Kyle Larson", pos: 1, points: 2501, inChase: true });
    expect(s.drivers[1]).toMatchObject({ num: "20", name: "#20 Christopher Bell" });
    expect(s.drivers.every(d => !d.name.includes("("))).toBe(true);          // "(C)" decorations stripped
    expect(s.drivers.map(d => d.pos)).toEqual([...s.drivers.map(d => d.pos)].sort((a, b) => a - b));
  });

  test("a blank car number is recovered from the league driver list (Hocevar → #77)", async () => {
    serve(pointsSample);
    const s = await fetchDriverStandings();
    const h = s.drivers.find(d => d.name.endsWith("Carson Hocevar"));
    expect(h).toMatchObject({ num: "77", name: "#77 Carson Hocevar" });
  });

  test("returns null on a bad response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 })));
    expect(await fetchDriverStandings()).toBeNull();
    serve({ not: "an array" });
    expect(await fetchDriverStandings()).toBeNull();
  });

  test("regular-season cutline: 16th place is the line, drivers 17+ are below it", async () => {
    serve(pointsSample);
    const { drivers } = await fetchDriverStandings();
    const b = buildBubble(drivers, 26);
    expect(b.cut).toBe(16);
    expect(b.cutPoints).toBe(2212);                                        // Buescher, 16th
    expect(b.rows.map(r => r.rank)).toEqual([14, 15, 16, 17, 18, 19]);
    expect(b.rows.find(r => r.rank === 16)).toMatchObject({ gap: 0, inside: true });
    expect(b.rows.find(r => r.rank === 17).gap).toBe(774 - 2212);           // Van Gisbergen, far below
    expect(b.rows.find(r => r.rank === 17).inside).toBe(false);
  });
});

describe("NASCAR race list → start times", () => {
  test("maps date → Eastern start time, points races over exhibitions", async () => {
    serve(raceListSample);
    const t = await fetchRaceStartTimes(2026);
    expect(t).toEqual({
      "2026-02-04": "18:00", "2026-02-12": "19:00", "2026-02-15": "14:30", "2026-02-22": "15:00",
    });
  });

  test("feeds the schedule labels", async () => {
    serve(raceListSample);
    const t = await fetchRaceStartTimes(2026);
    expect(formatRaceWhen({ d: "Feb 15" }, t)).toBe("SUN FEB 15 • 2:30 PM ET");
    expect(formatRaceWhen({ d: "Feb 22" }, t)).toBe("SUN FEB 22 • 3:00 PM ET");
    expect(new Date(raceStartMs({ d: "Feb 22" }, t)).toISOString()).toBe("2026-02-22T20:00:00.000Z");
  });

  test("an unpublished season → {} (callers use the 2:00 PM placeholder)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404 })));
    expect(await fetchRaceStartTimes(2027)).toEqual({});
    expect(formatRaceWhen({ d: "Feb 15" }, {})).toBe("SUN FEB 15 • 2:00 PM ET");
  });
});
