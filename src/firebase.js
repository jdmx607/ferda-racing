import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

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
