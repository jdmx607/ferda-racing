import { describe, test, expect } from "vitest";
import {
  DEFAULT_RACE_TIME, etToMs, entryIsoDate, raceClock, hasRealRaceTime,
  raceStartMs, formatRaceWhen, formatRaceShort,
} from "./racetime.js";

describe("Eastern time → real instant", () => {
  test("winter (EST, UTC−5) and summer (EDT, UTC−4)", () => {
    expect(new Date(etToMs(2026, 1, 15, 14, 30)).toISOString()).toBe("2026-02-15T19:30:00.000Z");
    expect(new Date(etToMs(2026, 7, 1, 14, 0)).toISOString()).toBe("2026-08-01T18:00:00.000Z");
  });
  test("after the November fall-back (DST ends Nov 1, 2026) it is EST again", () => {
    expect(new Date(etToMs(2026, 10, 1, 14, 0)).toISOString()).toBe("2026-11-01T19:00:00.000Z");
    expect(new Date(etToMs(2026, 9, 25, 14, 0)).toISOString()).toBe("2026-10-25T18:00:00.000Z");   // the week before: EDT
  });
});

describe("race clock lookup order", () => {
  const entry = { d: "Feb 15" };

  test("placeholder is 2:00 PM when nothing is known", () => {
    expect(DEFAULT_RACE_TIME).toBe("14:00");
    expect(raceClock(entry, {})).toBe("14:00");
    expect(raceClock(entry, undefined)).toBe("14:00");
    expect(hasRealRaceTime(entry, {})).toBe(false);
  });

  test("NASCAR feed time (by date) beats the placeholder", () => {
    expect(raceClock(entry, { "2026-02-15": "14:30" })).toBe("14:30");
    expect(hasRealRaceTime(entry, { "2026-02-15": "14:30" })).toBe(true);
    expect(raceClock(entry, { "2026-02-22": "15:00" })).toBe("14:00");   // a different date doesn't match
  });

  test("an explicit entry time beats the feed", () => {
    expect(raceClock({ d: "Feb 15", time: "15:30" }, { "2026-02-15": "14:30" })).toBe("15:30");
  });

  test("date helpers", () => {
    expect(entryIsoDate({ d: "Feb 5" })).toBe("2026-02-05");
    expect(entryIsoDate({ d: "nonsense" })).toBeNull();
    expect(raceStartMs({ d: "nonsense" })).toBeNull();
  });
});

describe("labels (always Eastern)", () => {
  test("full and short", () => {
    expect(formatRaceWhen({ d: "Feb 15" }, { "2026-02-15": "14:30" })).toBe("SUN FEB 15 • 2:30 PM ET");
    expect(formatRaceWhen({ d: "Feb 15" })).toBe("SUN FEB 15 • 2:00 PM ET");
    expect(formatRaceShort({ d: "Feb 15" }, { "2026-02-15": "15:00" })).toBe("SUN 3:00 PM ET");
    expect(formatRaceWhen(undefined)).toBe("");
  });
});
