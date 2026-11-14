// ─── FERDA All-Time Career Stats — recorded league data (2019–2026) ───────────
// Raw, hand-entered career figures. Everything shown on the "All-Time Career Stats"
// view that CAN be calculated is calculated (win %, podium %, title counts and years,
// dynasty text, the longest-streak record) — only genuinely recorded numbers live here.
//
//   firstYear / lastYear  seasons the player has been in the league
//   races                 weekly races they were scored in (finishes always add up to this)
//   finishes              [1st, 2nd, 3rd, 4th] weekly finishes among the four players
//   milestone             one signature line (a dynasty suffix is added automatically
//                         from championsHistory.js when the player has a 3+ title streak)
//
// After each season: add that season's finishes to every player, and bump
// LEAGUE_RACES, lastYear and (if broken) the RECORD_BOOK entries.

export const LEAGUE_RACES = 287;          // total recorded races since the 2019 founding

export const CAREER_STATS = {
  justin: {
    firstYear: 2019, lastYear: 2026, races: 287,
    finishes: [106, 90, 61, 30],
    milestone: "100-Win Club (106 Wins)",
  },
  monroe: {
    firstYear: 2019, lastYear: 2026, races: 287,
    finishes: [84, 68, 93, 42],
    milestone: "All-Time Podium Floor Leader (93 Third-Place Finishes)",
  },
  bigmonroe: {
    firstYear: 2019, lastYear: 2026, races: 287,
    finishes: [58, 82, 85, 62],
    milestone: "Inaugural 2019 Undisputed Champion",
  },
  rich: {
    firstYear: 2022, lastYear: 2026, races: 178,       // joined in 2022
    finishes: [40, 54, 43, 41],
    milestone: "40-Win Club in 5 Seasons • 2022 Rookie-Year Champion",
  },
};

// Records that can't be derived from the finish tallies above.
// ("Most career wins" and "Longest championship streak" are calculated.)
export const RECORD_BOOK = {
  seasonWins: { pid: "justin", wins: 18, year: 2021 },
  weekScore:  { pid: "rich", pts: 375.5, race: "Sonoma", year: 2025 },
};
