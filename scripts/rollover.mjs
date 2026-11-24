// Start a new season. Archives the old one and creates the new one in ONE transaction.
//   npm run rollover -- 2027             → dry run: shows exactly what would happen, changes nothing
//   npm run rollover -- 2027 --yes       → does it (after saving a backup of the old season)
// Safe to run twice: if the new season already exists it changes nothing.
import { readSeason, writeBackup, describe, db, fsApi } from "./_db.mjs";
import { runRollover, buildSeasonSeed } from "../src/engine/rollover.js";

const toYear = parseInt(process.argv[2], 10);
const yes = process.argv.includes("--yes");
if (!toYear) { console.error("Usage: npm run rollover -- <new season year> [--yes]"); process.exit(1); }
const fromYear = toYear - 1;

const prev = await readSeason(fromYear);
const existing = await readSeason(toYear);
if (!prev) { console.error(`No ${fromYear} document to roll over from.`); process.exit(1); }

console.log(`\nFrom ${fromYear}:`, describe(prev));
if (existing) {
  console.log(`\n${toYear} already exists — nothing to do:`, describe(existing));
  process.exit(0);
}
const seed = buildSeasonSeed(prev, toYear);
console.log(`\nWould create ${toYear}:`, describe(seed));
console.log(`Carried over player settings for: ${Object.keys(seed.playerSettings).join(", ") || "(none)"}`);
console.log(`Would mark ${fromYear} as archived (read-only).${prev.archived ? "  [already archived]" : ""}`);

if (!yes) { console.log("\nDry run only. Re-run with --yes to do it."); process.exit(0); }

const backup = writeBackup(fromYear, prev, "pre-rollover");
console.log("\nBackup saved:", backup);
const out = await runRollover(db, fsApi, { fromYear, toYear });
console.log("Result:", { created: out.created, reason: out.reason, archivedPrevious: out.archivedPrevious });

const afterOld = await readSeason(fromYear);
const afterNew = await readSeason(toYear);
console.log(`\nVerify ${fromYear}:`, describe(afterOld));
console.log(`Verify ${toYear}:`, describe(afterNew));
const intact = JSON.stringify(afterOld.results) === JSON.stringify(prev.results) && JSON.stringify(afterOld.picks) === JSON.stringify(prev.picks);
console.log(intact ? `\n✔ ${fromYear} results and picks are unchanged.` : `\n✖ ${fromYear} data differs — restore from ${backup}`);
process.exit(intact ? 0 : 1);
