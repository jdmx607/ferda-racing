// ─── League Activity Feed ──────────────────────────────────────────────────
// Derives a "what's happened recently" feed purely from existing data — no
// new schema, no timestamps. Ordered by week descending; the app doesn't
// timestamp individual actions yet, so within a week the order is a fixed
// logical sequence rather than true chronological order.

import { PLAYERS, PNAME, ACTIVE_PICKS, PLAYOFF_START_WEEK } from "../constants.js";

export function buildActivityFeed(data, limit = 10) {
  const events = [];

  const iscChamp = data.iscBracket?.results?.CHAMP;
  if (iscChamp) {
    const correct = PLAYERS.filter(p => data.iscBracket?.picks?.[p.id]?.CHAMP === iscChamp);
    events.push({
      w: Infinity,
      icon: "🏆",
      text: `ISC Champion locked in: ${iscChamp}${correct.length ? ` — ${correct.map(p => PNAME[p.id]).join(", ")} called it` : ""}`,
    });
  }

  const scoredWeeks = Object.keys(data.results || {})
    .map(k => parseInt(k.replace("w", "")))
    .sort((a, b) => b - a);

  scoredWeeks.forEach(w => {
    const wr = data.results["w" + w];
    if (!wr?.scored) return;
    const winner = Object.entries(wr.scored).find(([, s]) => s.weeklyWin);
    if (winner) {
      events.push({ w, icon: "🏆", text: `${PNAME[winner[0]]} won Week ${w} with ${winner[1].total} pts` });
    }
    if (w === PLAYOFF_START_WEEK) {
      events.push({ w, icon: "🥇", text: "The Chase is live!" });
    }
  });

  PLAYERS.forEach(p => {
    (data.mulligans?.[p.id] || []).forEach(m => {
      events.push({ w: m.week, icon: "🔄", text: `${PNAME[p.id]} swapped ${m.driver} → ${m.replacement} (W${m.week})` });
    });
  });

  const draftWeeks = Object.keys(data.drafts || {})
    .map(k => parseInt(k.replace("w", "")))
    .filter(w => !data.results?.["w" + w]?.scored)
    .sort((a, b) => b - a);
  if (draftWeeks.length) {
    const w = draftWeeks[0];
    const picks = data.drafts["w" + w]?.length || 0;
    const total = ACTIVE_PICKS * PLAYERS.length;
    if (picks >= total) {
      events.push({ w, icon: "🏁", text: `Draft complete for Week ${w}` });
    } else if (picks > 0) {
      events.push({ w, icon: "📋", text: `Draft in progress for Week ${w} (${picks}/${total} picks)` });
    }
  }

  return events
    .sort((a, b) => b.w - a.w)
    .slice(0, limit);
}
