// ─── Sweat alerts (pure) ─────────────────────────────────────────────────────
// Compact snapshots of draft + live-race state; diffing two snapshots yields the
// alerts worth surfacing: you're on the clock, owned stage winners, owned DNFs and
// the "10 to go" points gap. The first snapshot never alerts (no backlog spam).

import { PLAYERS, PNAME } from "../constants.js";
import { getDraftOrder, buildSnakeOrder } from "./draft.js";
import { storeFor } from "./events.js";

const carOf = name => (String(name).match(/^#(\S+)\s/) || [])[1] || String(name);
const short = name => `${String(name).match(/^#\S+/)?.[0] || ""} ${String(name).replace(/^#\S+\s+/, "").split(" / ")[0].split(/\s+/).slice(-1)[0]}`.trim();
const f1 = n => (Math.round(n * 10) / 10).toFixed(1);

/**
 * { week, draftLen, onClock, pickNo, round, stage:{1,2}, dnfs:[car], lapsToGo, standings:[{pid,pts}], owners:{car:[pid]} }
 */
export function sweatSnapshot({ data, week, liveWeek, raceInfo, liveScores, timing }) {
  const src = storeFor(data, week);
  const draft = src?.drafts?.["w" + week] || [];
  const snake = buildSnakeOrder(getDraftOrder(data, week));
  const turn = draft.length < snake.length ? snake[draft.length] : null;

  const owners = {};
  const lw = liveWeek ?? week;
  const picks = storeFor(data, lw)?.picks?.["w" + lw] || {};
  Object.entries(picks).forEach(([pid, list]) => (list || []).forEach(pk => {
    if (!pk.driver || pk.garage) return;
    (owners[carOf(pk.driver)] = owners[carOf(pk.driver)] || []).push(pid);
  }));

  const drivers = raceInfo?.raw?.drivers || [];
  const stage = {};
  [1, 2].forEach(n => { const d = drivers.find(x => x["stageWin" + n]); if (d) stage[n] = d.name; });
  const dnfs = drivers.filter(d => d.dnf).map(d => d.name);
  const standings = PLAYERS.map(p => ({ pid: p.id, pts: liveScores?.[p.id]?.total || 0 })).sort((a, b) => b.pts - a.pts);
  const lapsToGo = timing?.lapsInRace > 0 ? Math.max(0, timing.lapsInRace - timing.lapNumber) : (raceInfo?.lapsToGo ?? null);

  return {
    week, draftLen: draft.length, onClock: turn?.pid || null, pickNo: draft.length + 1, totalPicks: snake.length, round: turn?.round || null,
    stage, dnfs, lapsToGo, standings: liveScores ? standings : [], owners,
  };
}

/** Alerts between two snapshots: [{ id, kind, tone, title, body }] */
export function diffSweatEvents(prev, next, { me } = {}) {
  if (!prev || !next) return [];
  const ev = [];
  const ownersOf = name => (next.owners[carOf(name)] || []).map(pid => PNAME[pid]);

  if (next.week === prev.week && next.draftLen > prev.draftLen && next.onClock === me && prev.onClock !== me) {
    ev.push({ kind: "draft", tone: "go", title: "You're On The Clock!", body: `Pick ${next.pickNo} of ${next.totalPicks} · Round ${next.round}` });
  }
  [1, 2].forEach(n => {
    const name = next.stage[n];
    if (!name || prev.stage[n] === name) return;
    const who = ownersOf(name);
    if (!who.length) return;
    ev.push({ kind: "stage", tone: "gold", title: `Stage ${n} winner: ${short(name)}`, body: `${who.join(" & ")} banks +10 stage pts +2.5 bonus` });
  });
  next.dnfs.filter(n => !prev.dnfs.includes(n)).forEach(name => {
    const who = ownersOf(name);
    if (!who.length) return;
    ev.push({ kind: "dnf", tone: "stop", title: `Garage alert: ${short(name)} is out`, body: `DNF for ${who.join(" & ")}` });
  });
  const crossed = next.lapsToGo != null && next.lapsToGo > 0 && next.lapsToGo <= 10 && (prev.lapsToGo == null || prev.lapsToGo > 10);
  if (crossed && next.standings.length >= 2) {
    const [a, b] = next.standings;
    ev.push({ kind: "ten", tone: "caution", title: `${next.lapsToGo} to go`, body: `${PNAME[a.pid]} leads ${PNAME[b.pid]} by ${f1(a.pts - b.pts)} pts` });
  }
  return ev;
}
