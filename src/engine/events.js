// ─── Schedule events (points weeks + exhibitions) ───────────────────────────
// Pure helpers. A regular week's picks/drafts/results live at the top level of
// the league doc; an exhibition's live in `data.exhibitions` (same shape).
// `storeFor` / `ensureStore` hide that difference so callers can write
// `storeFor(data, week).drafts?.["w"+week]` for either kind of event.

import { SCHEDULE } from "../constants.js";
import { isExhibition } from "../exhibitions.js";

// Read-only view of the object holding this event's results/picks/drafts/etc.
export function storeFor(data, week) {
  return isExhibition(week) ? (data?.exhibitions || {}) : (data || {});
}

// Writable version (creates `exhibitions` on the doc if needed).
export function ensureStore(d, week) {
  if (!isExhibition(week)) return d;
  if (!d.exhibitions) d.exhibitions = {};
  return d.exhibitions;
}

export function isScored(data, week) {
  return !!storeFor(data, week).results?.["w" + week];
}

// The event the league is on now: the one after the latest-scored event in
// schedule order (so the Clash precedes Week 1 and the All-Star sits between
// Weeks 12 and 13). Before anything is scored, the first event. After the
// final race there is no next event; returns (last points week + 1) so
// callers' "season over" checks (no schedule entry for it) keep working.
export function getCurrentWeek(data) {
  let last = -1;
  SCHEDULE.forEach((s, i) => { if (isScored(data, s.w)) last = i; });
  if (last < SCHEDULE.length - 1) return SCHEDULE[last + 1].w;
  const lastPoints = Math.max(...SCHEDULE.filter(s => !isExhibition(s.w)).map(s => s.w));
  return lastPoints + 1;
}

// The event after `week` in schedule order, or null at the end of the season.
export function getNextEventWeek(week) {
  const i = SCHEDULE.findIndex(s => s.w === week);
  return i >= 0 && i < SCHEDULE.length - 1 ? SCHEDULE[i + 1].w : null;
}

// The most recent *points* week before `week` in schedule order (skipping
// exhibitions), or null. Used so the All-Star Race's draft order follows the
// last points race rather than itself.
export function getPrevPointsWeek(week) {
  const i = SCHEDULE.findIndex(s => s.w === week);
  for (let j = i - 1; j >= 0; j--) if (!isExhibition(SCHEDULE[j].w)) return SCHEDULE[j].w;
  return null;
}
