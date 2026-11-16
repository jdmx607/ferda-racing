// ─── AP-style wire recap (pure) ──────────────────────────────────────────────
// A 2–3 sentence journalistic recap for a completed race week, built from the
// stored results: winner + margin, the week's top driver, and who finished 4th.

import { PNAME, SCHEDULE } from "../constants.js";
import { getWeekTopDrivers } from "./stats.js";

const f1 = n => (Math.round(n * 10) / 10).toFixed(1);
const carOf = name => (String(name).match(/^#(\S+)\s/) || [])[1] || null;
const lastName = name => String(name).replace(/^#\S+\s+/, "").split(" / ")[0].trim().split(/\s+/).slice(-1)[0];

/** "MARTINSVILLE (FRL) — Monroe won the Xfinity 500 week with 246.6 points, …" → [sentences] */
export function wireRecap(week, scored, raw) {
  const ranked = Object.entries(scored || {}).sort((a, b) =>
    (b[1].weeklyWin ? 1 : 0) - (a[1].weeklyWin ? 1 : 0) || (b[1].total || 0) - (a[1].total || 0));
  if (ranked.length < 2) return [];
  const info = SCHEDULE.find(s => s.w === week);
  const dateline = `${String(info?.t || `Week ${week}`).toUpperCase()} (FRL) —`;
  const race = info?.r ? `the ${info.r}` : `Week ${week}`;

  const [w, s] = ranked;
  const margin = (w[1].total || 0) - (s[1].total || 0);
  const how = margin === 0 ? `tying ${PNAME[s[0]]} and winning on the tiebreak`
    : margin < 3 ? `edging ${PNAME[s[0]]} by ${f1(margin)}`
    : margin < 40 ? `finishing ${f1(margin)} points clear of ${PNAME[s[0]]}`
    : `routing ${PNAME[s[0]]} by ${f1(margin)}`;
  const out = [`${dateline} ${PNAME[w[0]]} won ${race} week with ${f1(w[1].total || 0)} points, ${how}.`];

  const mvp = raw?.drivers?.length ? getWeekTopDrivers(raw, week, 1)[0] : null;
  if (mvp) {
    const owners = ranked.filter(([, ps]) => (ps.drivers || []).some(d => !d.dnr && (d.driver === mvp.name || carOf(d.driver) === carOf(mvp.name)))).map(([pid]) => PNAME[pid]);
    const who = `${mvp.name.match(/^#\S+/)?.[0] || ""} ${lastName(mvp.name)}`.trim();
    out.push(owners.length
      ? `${who} led all drivers with ${f1(mvp.total)} FERDA points for ${owners.join(" and ")}.`
      : `${who} led all drivers with ${f1(mvp.total)} FERDA points — and nobody had him.`);
  }

  if (ranked.length >= 4) {
    const last = ranked[ranked.length - 1];
    out.push(`${PNAME[last[0]]} finished fourth with ${f1(last[1].total || 0)}.`);
  }
  return out;
}
