import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDoc, setDoc, onSnapshot, runTransaction } from "firebase/firestore";
import { ensureStore } from "./engine/events.js";
import { firebaseConfig } from "./firebaseConfig.js";
import { ACTIVE_SEASON } from "./constants.js";
import { seasonDocId, backupKey, LEGACY_BACKUP_KEY, FIRST_APP_SEASON } from "./seasons.js";
import { runRollover } from "./engine/rollover.js";


let db = null;
let firebaseReady = false;

try {
  const app = initializeApp(firebaseConfig);
  // Persistent IndexedDB cache so the installed PWA opens with the last league
  // snapshot (historical stats, standings, rules data) when offline. Falls back to
  // the default memory cache where IndexedDB isn't available (e.g. private mode).
  try {
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch (cacheErr) {
    console.warn("Firestore offline cache unavailable:", cacheErr?.message);
    db = getFirestore(app);
  }
  firebaseReady = true;
  console.log("Firebase initialized OK");
} catch (e) {
  console.error("Firebase init failed:", e);
}

// The live league document is the ACTIVE season's. Earlier seasons are read-only archives.
const DOC_ID = seasonDocId(ACTIVE_SEASON);
const BACKUP_KEY = backupKey(ACTIVE_SEASON);
const writeBackup = data => { try { localStorage.setItem(BACKUP_KEY, JSON.stringify(data)); } catch { /* storage unavailable */ } };

function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Firebase timeout after " + ms + "ms")), ms))
  ]);
}

export function isFirebaseReady() { return firebaseReady; }

export async function loadLeagueData() {
  if (!firebaseReady || !db) return null;
  try {
    const snap = await withTimeout(getDoc(doc(db, "leagues", DOC_ID)));
    return snap.exists() ? snap.data() : null;
  } catch (e) { console.error("Load error:", e.message); return null; }
}

export async function saveLeagueData(data) {
  if (!firebaseReady || !db) {
    writeBackup(data);
    return;
  }
  try {
    await withTimeout(setDoc(doc(db, "leagues", DOC_ID), data));
    writeBackup(data);
  } catch (e) {
    console.error("Save error:", e.message);
    writeBackup(data);
  }
}

// Atomically append a draft pick. Reads the LIVE server document inside the
// transaction — never trusts the caller's local React state — so a client
// that's been offline, backgrounded, or just slow to re-sync can never
// silently overwrite picks another player already made. Firestore retries
// the transaction automatically if two clients collide on the same read.
export async function saveDraftPick(week, pid, driver, pickNum) {
  if (!firebaseReady || !db) return { ok:false, applied:false, reason:"offline" };
  const ref = doc(db, "leagues", DOC_ID);
  try {
    const outcome = await withTimeout(runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error("League document not found");
      const d = snap.data();
      const key = "w" + week;
      // Exhibitions (Clash / All-Star) keep their picks in d.exhibitions
      const s = ensureStore(d, week);
      if (!s.drafts) s.drafts = {};
      if (!s.drafts[key]) s.drafts[key] = [];
      // Guard: only accept if this is genuinely the next pick in the slot.
      // Rejects stale clicks (someone already picked) without losing data.
      if (s.drafts[key].length !== pickNum) {
        return { applied:false, currentLength:s.drafts[key].length };
      }
      s.drafts[key].push({ pid, driver, pickNum });
      if (!s.picks) s.picks = {};
      if (!s.picks[key]) s.picks[key] = {};
      if (!s.picks[key][pid]) s.picks[key][pid] = [];
      s.picks[key][pid].push({ driver, mulligan:false });
      if (!s.draftTimers) s.draftTimers = {};
      s.draftTimers[key] = { startedAt:new Date().toISOString(), reminderSent:false };
      tx.set(ref, d);
      return { applied:true, data:d };
    }));
    if (outcome.applied) writeBackup(outcome.data);
    return { ok:true, ...outcome };
  } catch (e) {
    console.error("Draft pick transaction failed:", e.message);
    return { ok:false, applied:false, error:e.message };
  }
}

export function subscribeToLeagueData(callback) {
  if (!firebaseReady || !db) return () => {};
  try {
    return onSnapshot(doc(db, "leagues", DOC_ID), (snap) => {
      if (snap.exists()) callback(snap.data());
    }, (err) => { console.error("Realtime listener error:", err.message); });
  } catch (e) { return () => {}; }
}

export function loadLocalBackup() {
  try {
    let raw = localStorage.getItem(BACKUP_KEY);
    // 2026 builds kept their offline copy under the old un-versioned key. Only the 2026
    // season may read it — a stale 2026 copy must never be mistaken for a later season.
    if (!raw && ACTIVE_SEASON === FIRST_APP_SEASON) raw = localStorage.getItem(LEGACY_BACKUP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ── Seasons ───────────────────────────────────────────────────────────────────
const seasonCache = new Map();

/** Read-only load of any season's document (cached for the session). null if it doesn't exist / can't be read. */
export async function loadSeasonDoc(year, { fresh = false } = {}) {
  if (!firebaseReady || !db) return null;
  if (!fresh && seasonCache.has(year)) return seasonCache.get(year);
  try {
    const snap = await withTimeout(getDoc(doc(db, "leagues", seasonDocId(year))));
    const data = snap.exists() ? snap.data() : null;
    if (data) seasonCache.set(year, data);
    return data;
  } catch (e) { console.error("Season load error:", e.message); return null; }
}

/**
 * First load of a new season: create the ACTIVE season's document from the previous
 * one (clean slate + carried-over player settings) and archive the old season — in
 * one transaction, so it's safe if several people open the app at once. Returns the
 * season data, or null if it couldn't be verified (offline / timeout) — callers must
 * NOT write a replacement in that case.
 */
export async function ensureActiveSeason() {
  if (!firebaseReady || !db || ACTIVE_SEASON <= FIRST_APP_SEASON) return null;
  try {
    const out = await withTimeout(
      runRollover(db, { doc, runTransaction }, { fromYear: ACTIVE_SEASON - 1, toYear: ACTIVE_SEASON, allowEmpty: true }),
      15000
    );
    return out.data || null;
  } catch (e) { console.error("Season rollover failed:", e.message); return null; }
}
