// ─── FERDA Hall of Champions — historical results ─────────────────────────────
// One entry per season. Add a new object at the top whenever a season ends.
//
//   year           the season
//   regularSeason  player id who won the Regular Season (W1–26)   — justin | bigmonroe | monroe | rich
//   overall        player id who won the Overall / Chase title
//   notes          optional — one line shown on that season's plaque
//   margin         optional — winning margin in points (shown when there's no note)
//   inaugural      optional — true on the league's first season
//
// Wins, streaks and badges (UNDISPUTED SWEEP, SPLIT CROWN, THREE-PEAT…) are all
// calculated from this list — nothing else needs updating.

export const CHAMPION_HISTORY = [
  { year: 2026, regularSeason: "justin",    overall: "justin",    margin: 378.2,
    notes: "3,552 Chase pts • Won by 378.2 • 12 Wins" },
  { year: 2025, regularSeason: "rich",      overall: "justin",
    notes: "First split-crown season in league history" },
  { year: 2024, regularSeason: "justin",    overall: "justin" },
  { year: 2023, regularSeason: "monroe",    overall: "justin" },
  { year: 2022, regularSeason: "rich",      overall: "rich" },
  { year: 2021, regularSeason: "justin",    overall: "justin" },
  { year: 2020, regularSeason: "justin",    overall: "justin" },
  { year: 2019, regularSeason: "bigmonroe", overall: "bigmonroe", inaugural: true,
    notes: "Inaugural FERDA Season" },
];
