import { describe, test, expect } from "vitest";
import { CAREER_STATS, LEAGUE_RACES, RECORD_BOOK } from "../careerStats.js";
import { CHAMPION_HISTORY } from "../championsHistory.js";
import {
  fmtPct, getCareerCards, sortCareer, getEra, getRecordBook, getLongestStreak, peatLabel,
} from "./career.js";

const cards = getCareerCards(CAREER_STATS, CHAMPION_HISTORY);
const by = id => cards.find(c => c.id === id);

describe("recorded career data", () => {
  test("every player's finishes add up to their races", () => {
    cards.forEach(c => {
      const f = c.finishes;
      expect(f.first + f.second + f.third + f.fourth).toBe(c.races);
    });
  });

  test("287 league races; Rich joined in 2022 with 178", () => {
    expect(LEAGUE_RACES).toBe(287);
    expect(by("justin").races).toBe(287);
    expect(by("rich")).toMatchObject({ firstYear: 2022, lastYear: 2026, races: 178, joinedLate: true });
    expect(cards.filter(c => c.joinedLate).map(c => c.id)).toEqual(["rich"]);
  });
});

describe("calculated rates match the league's published figures", () => {
  test.each([
    ["justin",    "36.9", "89.5"],
    ["monroe",    "29.3", "85.4"],
    ["bigmonroe", "20.2", "78.4"],
    ["rich",      "22.5", "77.0"],
  ])("%s: win %s / podium %s", (id, win, pod) => {
    expect(by(id).winPct).toBe(win);
    expect(by(id).podiumPct).toBe(pod);
  });

  test("fmtPct keeps one decimal", () => {
    expect(fmtPct(0.5)).toBe("50.0");
    expect(fmtPct(0.89547)).toBe("89.5");
  });
});

describe("championships come from the Hall of Champions list", () => {
  test("counts and years", () => {
    expect(by("justin").titles).toMatchObject({ overall: 6, regularSeason: 4 });
    expect(by("justin").titles.regularSeasonYears).toEqual([2020, 2021, 2024, 2026]);
    expect(by("rich").titles).toMatchObject({ overall: 1, regularSeason: 2, regularSeasonYears: [2022, 2025] });
    expect(by("bigmonroe").titles).toMatchObject({ overall: 1, regularSeason: 1, overallYears: [2019] });
    expect(by("monroe").titles).toMatchObject({ overall: 0, regularSeason: 1, regularSeasonYears: [2023] });
  });

  test("Justin's milestone carries the calculated dynasty; the others are untouched", () => {
    expect(by("justin").milestone).toBe("100-Win Club (106 Wins) • 4-Peat Dynasty (2023–2026)");
    expect(by("rich").milestone).toBe("40-Win Club in 5 Seasons • 2022 Rookie-Year Champion");
    expect(by("monroe").milestone).toBe("All-Time Podium Floor Leader (93 Third-Place Finishes)");
    expect(by("bigmonroe").milestone).toBe("Inaugural 2019 Undisputed Champion");
  });
});

describe("sorting", () => {
  const order = key => sortCareer(cards, key).map(c => c.id);
  test("default (wins): Justin, Monroe, Big Monroe, Rich", () => {
    expect(order("wins")).toEqual(["justin", "monroe", "bigmonroe", "rich"]);
  });
  test("win %: Justin, Monroe, Rich, Big Monroe (Rich's rate is fair despite fewer races)", () => {
    expect(order("winPct")).toEqual(["justin", "monroe", "rich", "bigmonroe"]);
  });
  test("podium %: Justin, Monroe, Big Monroe, Rich", () => {
    expect(order("podiumPct")).toEqual(["justin", "monroe", "bigmonroe", "rich"]);
  });
  test("titles: Justin, then Rich (1 + 2), Big Monroe (1 + 1), Monroe", () => {
    expect(order("titles")).toEqual(["justin", "rich", "bigmonroe", "monroe"]);
  });
  test("does not mutate its input", () => {
    const copy = [...cards];
    sortCareer(cards, "winPct");
    expect(cards).toEqual(copy);
  });
});

describe("era banner and record book", () => {
  test("EST. 2019 • 8 SEASONS • 287 RACES", () => {
    expect(getEra(CHAMPION_HISTORY, LEAGUE_RACES)).toEqual({ est: 2019, seasons: 8, races: 287 });
  });

  test("longest streak is the 2023–2026 4-peat", () => {
    expect(getLongestStreak(CHAMPION_HISTORY)).toMatchObject({ pid: "justin", startYear: 2023, endYear: 2026, length: 4 });
    expect(peatLabel(3)).toBe("3-Peat");
    expect(peatLabel(4)).toBe("4-Peat");
  });

  test("four records", () => {
    const book = getRecordBook(cards, CHAMPION_HISTORY, RECORD_BOOK);
    expect(book.map(r => [r.key, r.pid, r.value, r.sub])).toEqual([
      ["careerWins", "justin", "106 Wins", "2019–2026"],
      ["seasonWins", "justin", "18 Wins", "2021"],
      ["weekScore",  "rich",   "375.5 pts", "Sonoma 2025"],
      ["streak",     "justin", "4-Peat", "2023–2026"],
    ]);
  });
});
