import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, runTransaction } from "firebase/firestore";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PASTE YOUR FIREBASE CONFIG HERE (from Firebase Console)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const firebaseConfig = {
  apiKey: "AIzaSyAxCUd_e9Fx-Aw8Ms6MAdxeTMkWwxbVWuE",
  authDomain: "ferdaracingleague.firebaseapp.com",
  projectId: "ferdaracingleague",
  storageBucket: "ferdaracingleague.firebasestorage.app",
  messagingSenderId: "927904138916",
  appId: "1:927904138916:web:8f76928d280ba3e81d8831",
};
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let db = null;
let firebaseReady = false;

try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  firebaseReady = true;
  console.log("Firebase initialized OK");
} catch (e) {
  console.error("Firebase init failed:", e);
}

const DOC_ID = "ferda-season-2026";

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
    localStorage.setItem("ferda-backup", JSON.stringify(data));
    return;
  }
  try {
    await withTimeout(setDoc(doc(db, "leagues", DOC_ID), data));
    localStorage.setItem("ferda-backup", JSON.stringify(data));
  } catch (e) {
    console.error("Save error:", e.message);
    localStorage.setItem("ferda-backup", JSON.stringify(data));
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
      if (!d.drafts) d.drafts = {};
      if (!d.drafts[key]) d.drafts[key] = [];
      // Guard: only accept if this is genuinely the next pick in the slot.
      // Rejects stale clicks (someone already picked) without losing data.
      if (d.drafts[key].length !== pickNum) {
        return { applied:false, currentLength:d.drafts[key].length };
      }
      d.drafts[key].push({ pid, driver, pickNum });
      if (!d.picks) d.picks = {};
      if (!d.picks[key]) d.picks[key] = {};
      if (!d.picks[key][pid]) d.picks[key][pid] = [];
      d.picks[key][pid].push({ driver, mulligan:false });
      if (!d.draftTimers) d.draftTimers = {};
      d.draftTimers[key] = { startedAt:new Date().toISOString(), reminderSent:false };
      tx.set(ref, d);
      return { applied:true, data:d };
    }));
    if (outcome.applied) localStorage.setItem("ferda-backup", JSON.stringify(outcome.data));
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
  try { const raw = localStorage.getItem("ferda-backup"); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
