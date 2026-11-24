// Smoke-test the deployed Firestore rules against a THROWAWAY season document
// (ferda-season-2099). Never touches real data. Run after every rules deploy:
//   npm run rules-test
// then delete the test doc (printed at the end).
import { db, doc, getDoc, setDoc } from "./_db.mjs";
import { deleteDoc } from "firebase/firestore";

const shape = (extra = {}) => ({ results: {}, picks: {}, meta: { standings: {} }, ...extra });
const outcomes = [];
async function check(name, wantAllowed, fn) {
  let allowed = true, why = "";
  try { await fn(); } catch (e) { allowed = false; why = e.code || e.message; }
  const ok = allowed === wantAllowed;
  outcomes.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${allowed ? "allowed" : "denied"}${ok ? "" : `   (wanted ${wantAllowed ? "allowed" : "denied"}; ${why})`}`);
}
const ref = id => doc(db, "leagues", id);
const TEST = "ferda-season-2099";

await check("read the real 2026 season", true, () => getDoc(ref("ferda-season-2026")));
await check("create a valid season document", true, () => setDoc(ref(TEST), shape({ n: 1 })));
await check("update it while it's live", true, () => setDoc(ref(TEST), shape({ n: 2 })));
await check("write a malformed document (missing fields)", false, () => setDoc(ref(TEST), { nope: true }));
await check("archive it", true, () => setDoc(ref(TEST), shape({ n: 3, archived: true })));
await check("read an archived season", true, () => getDoc(ref(TEST)));
await check("update an ARCHIVED season (must be frozen)", false, () => setDoc(ref(TEST), shape({ n: 4 })));
await check("un-archive from the client (must be frozen)", false, () => setDoc(ref(TEST), shape({ archived: false })));
await check("delete a season document", false, () => deleteDoc(ref(TEST)));
await check("write a document with a non-season name", false, () => setDoc(ref("something-else"), shape()));
await check("write ferda-season-abcd (bad year)", false, () => setDoc(ref("ferda-season-abcd"), shape()));
await check("read a non-season document", false, () => getDoc(ref("something-else")));

const bad = outcomes.filter(r => !r).length;
console.log(`\n${outcomes.length - bad}/${outcomes.length} passed.${bad ? "  FAILED: roll the rules back (git show HEAD:firestore.rules)." : ""}`);
console.log("\nClean up the throwaway doc:\n  firebase firestore:delete leagues/ferda-season-2099 -f --project ferdaracingleague");
process.exit(bad ? 1 : 0);
