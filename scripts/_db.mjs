// Shared helpers for the season scripts: connect to the league database and write
// local backups. Backups go OUTSIDE the repo (a sibling folder) because the league
// document holds phone numbers and push subscriptions.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, runTransaction } from "firebase/firestore";
import { firebaseConfig } from "../src/firebaseConfig.js";
import { seasonDocId } from "../src/seasons.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const BACKUP_DIR = path.resolve(here, "..", "..", "ferda-racing-backups");

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const fsApi = { doc, runTransaction };
export { doc, getDoc, setDoc, runTransaction, seasonDocId };

export async function readSeason(year) {
  const snap = await getDoc(doc(db, "leagues", seasonDocId(year)));
  return snap.exists() ? snap.data() : null;
}

/** Save a season document to ../ferda-racing-backups/ and return the file path. */
export function writeBackup(year, data, tag = "") {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = path.join(BACKUP_DIR, `ferda-season-${year}${tag ? "-" + tag : ""}-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

export function describe(data) {
  const weeks = Object.keys(data?.results || {}).filter(k => data.results[k]?.scored).length;
  return {
    season: data?.season ?? "(none)", archived: !!data?.archived,
    scoredWeeks: weeks, pickWeeks: Object.keys(data?.picks || {}).length,
    draftWeeks: Object.keys(data?.drafts || {}).length,
    players: Object.keys(data?.playerSettings || {}).length, kb: Math.round(JSON.stringify(data || {}).length / 1024),
  };
}
