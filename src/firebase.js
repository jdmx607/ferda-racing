import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PASTE YOUR FIREBASE CONFIG HERE (from Firebase Console)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const firebaseConfig = {
  apiKey: "AIzaSyAxCUd_e9Fx-Aw8Ms6MAdxeTMkWwxbVWuE",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "ferdaracingleague",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const DOC_ID = "ferda-season-2026";

export async function loadLeagueData() {
  try {
    const snap = await getDoc(doc(db, "leagues", DOC_ID));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.error("Load error:", e);
    return null;
  }
}

export async function saveLeagueData(data) {
  try {
    await setDoc(doc(db, "leagues", DOC_ID), data);
  } catch (e) {
    console.error("Save error:", e);
  }
}

export function subscribeToLeagueData(callback) {
  return onSnapshot(doc(db, "leagues", DOC_ID), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}
