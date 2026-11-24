// ─── Seasons registry ────────────────────────────────────────────────────────
// One Firestore document per season (leagues/ferda-season-YYYY). The ACTIVE
// season's document is the live league; every earlier one is a frozen archive
// (flagged `archived: true`, and the database rules then refuse further writes).
// Rolling over to a new year never touches the old data — see engine/rollover.js.

import { ACTIVE_SEASON } from "./constants.js";

export const FIRST_SEASON = 2019;          // the league's founding year (pre-app seasons live only as career stats)
export const FIRST_APP_SEASON = 2026;      // first season stored in the app / database

export const seasonDocId = year => `ferda-season-${year}`;

/** Per-device offline copy of a season's document. */
export const backupKey = year => `ferda-backup-${year}`;
/** Pre-2027 builds stored the 2026 copy under this key. */
export const LEGACY_BACKUP_KEY = "ferda-backup";

/** Seasons that exist in the app, newest first: [2027, 2026]. */
export function appSeasons(active = ACTIVE_SEASON) {
  const out = [];
  for (let y = active; y >= FIRST_APP_SEASON; y--) out.push(y);
  return out;
}
