import { describe, test, expect } from "vitest";
import { CHAMPION_HISTORY } from "../championsHistory.js";
import {
  newestFirst, wonTitle, wonAnyTitle, getTitleTally, seasonBadges,
  getOverallRuns, runLabel, getReigning,
} from "./champions.js";

describe("the 2019–2026 dataset", () => {
  test("eight consecutive seasons, each with both champions", () => {
    expect(CHAMPION_HISTORY.map(s => s.year).sort()).toEqual([2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
    CHAMPION_HISTORY.forEach(s => {
      expect(["justin", "bigmonroe", "monroe", "rich"]).toContain(s.overall);
      expect(["justin", "bigmonroe", "monroe", "rich"]).toContain(s.regularSeason);
    });
  });

  test("career tallies match the league's records", () => {
    const t = Object.fromEntries(getTitleTally(CHAMPION_HISTORY).map(x => [x.id, x]));
    expect(t.justin).toMatchObject({ overall: 6, regularSeason: 4 });
    expect(t.rich).toMatchObject({ overall: 1, regularSeason: 2 });
    expect(t.bigmonroe).toMatchObject({ overall: 1, regularSeason: 1 });
    expect(t.monroe).toMatchObject({ overall: 0, regularSeason: 1 });
  });

  test("tally order: Justin, Rich, Big Monroe, Monroe", () => {
    expect(getTitleTally(CHAMPION_HISTORY).map(x => x.id)).toEqual(["justin", "rich", "bigmonroe", "monroe"]);
  });

  test("2023 and 2025 are the split crowns; the other six seasons are sweeps", () => {
    const split = CHAMPION_HISTORY.filter(s => seasonBadges(s).split).map(s => s.year);
    expect(split).toEqual([2025, 2023]);
    expect(CHAMPION_HISTORY.filter(s => seasonBadges(s).sweep)).toHaveLength(6);
    expect(seasonBadges(CHAMPION_HISTORY.find(s => s.year === 2023)).sweep).toBe(false);
    expect(seasonBadges(CHAMPION_HISTORY.find(s => s.year === 2025)).sweep).toBe(false);
  });

  test("only 2019 is the inaugural season", () => {
    expect(CHAMPION_HISTORY.filter(s => seasonBadges(s).inaugural).map(s => s.year)).toEqual([2019]);
  });

  test("the optional notes and margin fields are carried", () => {
    const s26 = CHAMPION_HISTORY.find(s => s.year === 2026);
    expect(s26.notes).toBe("3,552 Chase pts • Won by 378.2 • 12 Wins");
    expect(s26.margin).toBe(378.2);
    expect(CHAMPION_HISTORY.find(s => s.year === 2025).notes).toBe("First split-crown season in league history");
  });
});

describe("streaks and the reigning champion", () => {
  test("Justin's runs: 2020–2021 back-to-back and the 2023–2026 4-peat", () => {
    const runs = getOverallRuns(CHAMPION_HISTORY);
    expect(runs).toEqual([
      { pid: "justin", startYear: 2020, endYear: 2021, length: 2 },
      { pid: "justin", startYear: 2023, endYear: 2026, length: 4 },
    ]);
    expect(runs.map(runLabel)).toEqual(["🏆 2020–2021 BACK-TO-BACK", "🔥 2023–2026 4-PEAT DYNASTY"]);
  });

  test("a gap year or a different champion breaks a run", () => {
    const h = [
      { year: 2010, regularSeason: "a", overall: "justin" },
      { year: 2012, regularSeason: "a", overall: "justin" },       // 2011 missing
      { year: 2013, regularSeason: "a", overall: "rich" },
    ];
    expect(getOverallRuns(h)).toEqual([]);
    expect(runLabel({ startYear: 2020, endYear: 2023, length: 4 })).toBe("🔥 2020–2023 4-PEAT DYNASTY");
  });

  test("reigning champion is 2026 Justin on a 4-peat", () => {
    expect(getReigning(CHAMPION_HISTORY)).toMatchObject({ pid: "justin", streak: 4, dynasty: "4-PEAT DYNASTY" });
    expect(getReigning(CHAMPION_HISTORY).season.year).toBe(2026);
    expect(getReigning(CHAMPION_HISTORY.slice(1))).toMatchObject({ pid: "justin", streak: 3, dynasty: "3-PEAT DYNASTY" });   // as of 2025
    expect(getReigning(CHAMPION_HISTORY.slice(3))).toMatchObject({ pid: "justin", streak: 1, dynasty: "" });                 // as of 2023: first of the run
    expect(getReigning(CHAMPION_HISTORY.filter(s => s.year === 2022))).toMatchObject({ pid: "rich", streak: 1, dynasty: "" });
    expect(getReigning([])).toBeNull();
  });
});

describe("filtering helpers", () => {
  const s25 = CHAMPION_HISTORY.find(s => s.year === 2025);
  test("split season: Rich won the regular season, Justin the title", () => {
    expect(wonTitle(s25, "rich")).toEqual({ overall: false, regularSeason: true });
    expect(wonTitle(s25, "justin")).toEqual({ overall: true, regularSeason: false });
    expect(wonAnyTitle(s25, "monroe")).toBe(false);
  });
  test("filtering by player keeps exactly the seasons they won something", () => {
    const years = pid => newestFirst(CHAMPION_HISTORY).filter(s => wonAnyTitle(s, pid)).map(s => s.year);
    expect(years("justin")).toEqual([2026, 2025, 2024, 2023, 2021, 2020]);
    expect(years("rich")).toEqual([2025, 2022]);
    expect(years("monroe")).toEqual([2023]);               // his only title is the 2023 regular season
    expect(years("bigmonroe")).toEqual([2019]);
  });
});
