// ─── Season rollover (pure) ──────────────────────────────────────────────────
// Starting a new season = a brand-new, empty league document plus the few things
// that belong to the people, not the season (phone numbers, push subscriptions,
// notification and display preferences). The previous season is only ever
// *flagged* archived — its results, picks, drafts and mulligans are never edited.

import { PLAYERS } from "../constants.js";
import { seasonDocId } from "../seasons.js";

const zeros = () => Object.fromEntries(PLAYERS.map(p => [p.id, 0]));
const clone = v => JSON.parse(JSON.stringify(v ?? null));

/** A clean season document. `prev` (the last season's data) supplies carried-over player settings. */
export function buildSeasonSeed(prev, year, now = new Date()) {
  return {
    season: year,
    createdAt: now.toISOString(),
    carriedFrom: prev ? (prev.season ?? year - 1) : null,
    results: {},
    picks: {},
    drafts: {},
    mulligans: Object.fromEntries(PLAYERS.map(p => [p.id, []])),
    playerSettings: clone(prev?.playerSettings) || {},
    meta: {
      standings: zeros(), playoffPts: zeros(), chasePts: zeros(), mulligansUsed: zeros(),
      lastScoredWeek: 0,
    },
    liveRace: { active: false, week: null, startedAt: null },
    chaseField: { drivers: [], eliminated: {} },
    draftTimers: {},
    draftSchedule: {},
  };
}

/** The same document, frozen. The database rules refuse any later write to it. */
export function markArchived(data, year, now = new Date()) {
  return { ...data, season: data.season ?? year, archived: true, archivedAt: now.toISOString() };
}

/**
 * Create `toYear`'s document from `fromYear`'s, and archive `fromYear`, in ONE
 * transaction. Safe to call from several devices at once and safe to repeat:
 * if the new season already exists it changes nothing and returns it.
 *
 * `fs` = { doc, runTransaction } from firebase/firestore (injected so the web app,
 * the rollover script and the tests can all share this one implementation).
 *   → { created, reason?, data, archivedPrevious? }
 */
export async function runRollover(db, fs, { fromYear, toYear, now = new Date(), allowEmpty = false }) {
  const toRef = fs.doc(db, "leagues", seasonDocId(toYear));
  const fromRef = fs.doc(db, "leagues", seasonDocId(fromYear));
  return fs.runTransaction(db, async tx => {
    const toSnap = await tx.get(toRef);
    if (toSnap.exists()) return { created: false, reason: "exists", data: toSnap.data() };
    const fromSnap = await tx.get(fromRef);
    if (!fromSnap.exists() && !allowEmpty) return { created: false, reason: "no-previous" };
    const prev = fromSnap.exists() ? fromSnap.data() : null;
    const seed = buildSeasonSeed(prev, toYear, now);
    tx.set(toRef, seed);
    const archivePrev = !!prev && !prev.archived;
    if (archivePrev) tx.set(fromRef, markArchived(prev, fromYear, now));
    return { created: true, data: seed, archivedPrevious: archivePrev };
  });
}
