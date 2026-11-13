// Exhibition events (the Clash and the All-Star Race).
//
// They're drafted and scored like any race, but they are NOT part of the
// points season: their picks/results live in `data.exhibitions` (never in
// `data.results`), so standings, stats and history can't pick them up by
// accident. They get their own event ids:
//   Clash    = 0   (runs before Week 1 — its result sets Week 1's draft order)
//   All-Star = -1  (runs between Weeks 12 and 13 — its bonus pts count toward
//                   the Chase entry total, but not the standings)
// Regular points weeks stay 1-36, so the Chase still starts at Week 27.

export const CLASH_WEEK    = 0;
export const ALL_STAR_WEEK = -1;
export const EXHIBITION_WEEKS = [CLASH_WEEK, ALL_STAR_WEEK];

export function isExhibition(week) {
  return week === CLASH_WEEK || week === ALL_STAR_WEEK;
}

// Short label for chips/banners: "W5", "Clash", "All-Star"
export function weekLabel(week) {
  if (week === CLASH_WEEK)    return "Clash";
  if (week === ALL_STAR_WEEK) return "All-Star";
  return "W" + week;
}

// Longer label for headings: "Week 5", "The Clash", "The All-Star Race"
export function weekName(week) {
  if (week === CLASH_WEEK)    return "The Clash";
  if (week === ALL_STAR_WEEK) return "The All-Star Race";
  return "Week " + week;
}
