// Save a full copy of a season's document to ../ferda-racing-backups/ (read-only; changes nothing).
//   npm run backup              → the active season
//   npm run backup -- 2026      → a specific season
import { readSeason, writeBackup, describe } from "./_db.mjs";
import { ACTIVE_SEASON } from "../src/constants.js";

const year = parseInt(process.argv[2], 10) || ACTIVE_SEASON;
const data = await readSeason(year);
if (!data) { console.error(`No document found for ${year}.`); process.exit(1); }
const file = writeBackup(year, data);
console.log(`Backed up ${year}:`, describe(data));
console.log("Saved to", file);
process.exit(0);
