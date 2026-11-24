import { describe, test, expect } from "vitest";
import { buildSeasonSeed, markArchived, runRollover } from "./rollover.js";
import { seasonDocId, appSeasons, backupKey } from "../seasons.js";

// Tiny in-memory Firestore: enough for doc()/runTransaction() with get/set.
function fakeFirestore(initial = {}) {
  const store = new Map(Object.entries(initial));
  const fs = {
    doc: (_db, _col, id) => ({ id }),
    runTransaction: async (_db, fn) => {
      const writes = [];
      const tx = {
        get: async ref => ({ exists: () => store.has(ref.id), data: () => JSON.parse(JSON.stringify(store.get(ref.id))) }),
        set: (ref, data) => writes.push([ref.id, data]),
      };
      const out = await fn(tx);
      writes.forEach(([id, data]) => store.set(id, JSON.parse(JSON.stringify(data))));   // commit only if fn didn't throw
      return out;
    },
  };
  return { fs, store };
}

const prev2026 = {
  season: 2026,
  results: { w1: { scored: { justin: { total: 10 } } } },
  picks: { w1: { justin: [{ driver: "#1 A" }] } },
  drafts: { w1: [{ pid: "justin" }] },
  mulligans: { justin: [{ week: 1 }] },
  meta: { standings: { justin: 99 }, playoffPts: {}, chasePts: {} },
  playerSettings: { bigmonroe: { simplifiedMode: true, phone: "555-0100" }, rich: { pushSubscription: { endpoint: "https://x" } } },
  chaseField: { drivers: ["#11 Denny Hamlin"] },
  iscBracket: { locked: true },
  ballot: { season: 2027, proposals: [{ id: "1" }] },
};

describe("season seed", () => {
  const seed = buildSeasonSeed(prev2026, 2027, new Date("2027-01-02T00:00:00Z"));
  test("empty season: no results, picks, drafts, standings or mulligans", () => {
    expect(seed).toMatchObject({ season: 2027, carriedFrom: 2026, results: {}, picks: {}, drafts: {} });
    expect(seed.mulligans).toEqual({ justin: [], bigmonroe: [], monroe: [], rich: [] });
    expect(seed.meta.standings).toEqual({ justin: 0, bigmonroe: 0, monroe: 0, rich: 0 });
    expect(seed.meta.lastScoredWeek).toBe(0);
    expect(seed.liveRace.active).toBe(false);
    expect(seed.chaseField).toEqual({ drivers: [], eliminated: {} });
  });
  test("keeps what belongs to the people: phones, push subscriptions, Simplified Mode", () => {
    expect(seed.playerSettings.bigmonroe).toEqual({ simplifiedMode: true, phone: "555-0100" });
    expect(seed.playerSettings.rich.pushSubscription.endpoint).toBe("https://x");
  });
  test("last season's ISC bracket, ballot and live state do not carry over", () => {
    expect(seed.iscBracket).toBeUndefined();
    expect(seed.ballot).toBeUndefined();
  });
  test("the seed shares nothing with the previous doc (deep copy)", () => {
    seed.playerSettings.bigmonroe.phone = "changed";
    expect(prev2026.playerSettings.bigmonroe.phone).toBe("555-0100");
  });
  test("no previous season → still a valid empty season", () => {
    const s = buildSeasonSeed(null, 2027);
    expect(s.playerSettings).toEqual({});
    expect(s.carriedFrom).toBeNull();
    expect(["results", "picks", "meta"].every(k => k in s)).toBe(true);   // satisfies the Firestore write rule
  });
});

describe("archive flag", () => {
  test("marks the doc archived without changing a single result", () => {
    const a = markArchived(prev2026, 2026, new Date("2027-01-02T00:00:00Z"));
    expect(a).toMatchObject({ archived: true, archivedAt: "2027-01-02T00:00:00.000Z", season: 2026 });
    expect(a.results).toEqual(prev2026.results);
    expect(a.picks).toEqual(prev2026.picks);
    expect(a.drafts).toEqual(prev2026.drafts);
    expect(a.mulligans).toEqual(prev2026.mulligans);
    expect(markArchived({ results: {} }, 2025).season).toBe(2025);
  });
});

describe("runRollover", () => {
  test("creates the new season, archives the old one, loses nothing", async () => {
    const { fs, store } = fakeFirestore({ [seasonDocId(2026)]: prev2026 });
    const out = await runRollover({}, fs, { fromYear: 2026, toYear: 2027 });
    expect(out).toMatchObject({ created: true, archivedPrevious: true });
    const old = store.get(seasonDocId(2026)), neu = store.get(seasonDocId(2027));
    expect(old.archived).toBe(true);
    expect(old.results).toEqual(prev2026.results);
    expect(old.picks).toEqual(prev2026.picks);
    expect(old.meta).toEqual(prev2026.meta);
    expect(neu.results).toEqual({});
    expect(neu.playerSettings.bigmonroe.simplifiedMode).toBe(true);
  });
  test("running it again (or from a second device) changes nothing", async () => {
    const { fs, store } = fakeFirestore({ [seasonDocId(2026)]: prev2026 });
    await runRollover({}, fs, { fromYear: 2026, toYear: 2027 });
    const snapshot = JSON.stringify([...store.entries()]);
    const again = await runRollover({}, fs, { fromYear: 2026, toYear: 2027 });
    expect(again).toMatchObject({ created: false, reason: "exists" });
    expect(JSON.stringify([...store.entries()])).toBe(snapshot);
  });
  test("never overwrites a season that already has results", async () => {
    const live2027 = { ...buildSeasonSeed(prev2026, 2027), results: { w1: { scored: {} } } };
    const { fs, store } = fakeFirestore({ [seasonDocId(2026)]: prev2026, [seasonDocId(2027)]: live2027 });
    const out = await runRollover({}, fs, { fromYear: 2026, toYear: 2027 });
    expect(out.created).toBe(false);
    expect(store.get(seasonDocId(2027)).results.w1).toBeDefined();
  });
  test("missing previous season: refuses unless allowEmpty", async () => {
    const a = fakeFirestore({});
    expect(await runRollover({}, a.fs, { fromYear: 2026, toYear: 2027 })).toMatchObject({ created: false, reason: "no-previous" });
    expect(a.store.size).toBe(0);
    const b = fakeFirestore({});
    expect((await runRollover({}, b.fs, { fromYear: 2026, toYear: 2027, allowEmpty: true })).created).toBe(true);
    expect(b.store.has(seasonDocId(2027))).toBe(true);
  });
  test("an already-archived previous season isn't rewritten", async () => {
    const frozen = { ...prev2026, archived: true, archivedAt: "2026-12-01T00:00:00.000Z" };
    const { fs, store } = fakeFirestore({ [seasonDocId(2026)]: frozen });
    const out = await runRollover({}, fs, { fromYear: 2026, toYear: 2027 });
    expect(out.archivedPrevious).toBe(false);
    expect(store.get(seasonDocId(2026)).archivedAt).toBe("2026-12-01T00:00:00.000Z");
  });
});

describe("seasons registry", () => {
  test("doc ids, backup keys and the season list", () => {
    expect(seasonDocId(2027)).toBe("ferda-season-2027");
    expect(backupKey(2027)).toBe("ferda-backup-2027");
    expect(appSeasons(2028)).toEqual([2028, 2027, 2026]);
    expect(appSeasons(2026)).toEqual([2026]);
  });
});
