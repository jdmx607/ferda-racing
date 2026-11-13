import { useMemo, useState, useEffect } from "react";
import { PClr, TTL } from "../theme";
import { PLAYERS, PNAME, SCHEDULE, TRACK_MULTS, ACTIVE_SEASON, ACTIVE_PICKS } from "../constants";
import { getCurrentWeek, storeFor } from "../engine/events";
import { getMulliganAllowance } from "../engine/mulligans";
import { getPowerRankings } from "../engine/power";
import { getSeasonChampion } from "../engine/chase";
import {
  getLineupStatus, getPlayerLineup, getHomeLineupWeek, getSeasonWrapUp,
  getRaceMvp, shortName, pointsBack,
  getStandings, defaultStandingsView, standingsProgress, buildBubble,
} from "../engine/home";
import { raceStartMs, formatRaceWhen, hasRealRaceTime } from "../engine/racetime";
import { useRaceTimes, useDriverStandings } from "../hooks/useNascarFeeds";
import { weekLabel } from "../exhibitions";
import { paintFor, carNumber } from "../driverPaint";
import { TrophyCaseModal } from "./TrophyCase";
import { BottomSheet } from "./BottomSheet";
import { PowerBoard, RankDelta } from "./PowerBoard";

const ARCHETYPE = {
  superspeedway: "SUPERSPEEDWAY", short_track: "SHORT TRACK",
  intermediate: "INTERMEDIATE", road_course: "ROAD COURSE",
};

const signed = n => `${n > 0 ? "+" : ""}${n}`;
const mullTone = n => (n <= 1 ? "down" : n <= 5 ? "caution" : "");
const statusTone = state => (state === "open" ? "up" : state === "waiting" ? "caution" : "");

// ── 1. Champion ribbon ──────────────────────────────────────────────────────
// Shown once the final race (W36) is scored.
function ChampionRibbon({ champ, onOpen }) {
  const { pids, tied, total } = champ;
  const names = pids.map(p => PNAME[p]).join(" & ").toUpperCase();
  return (
    <div className="ribbon" role="button" onClick={onOpen}>
      <span>
        🏆 {ACTIVE_SEASON} FERDA {tied ? "CO-CHAMPIONS" : "CHAMPION"} • {names} — <span className="num">{total.toLocaleString()}</span> Chase Pts
      </span>
    </div>
  );
}

// ── Countdown (ticks every second, mono so it never jitters) ────────────────
function Countdown({ entry, times }) {
  const target = raceStartMs(entry, times);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = target - now;
  if (!target || diff <= 0) return null;
  const d = Math.floor(diff / 86400000);
  const h = String(Math.floor((diff % 86400000) / 3600000)).padStart(2, "0");
  const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
  const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
  return (
    <div className="hero-clock num">
      {d > 0 && `${d}d `}{h}:{m}:{s}
      <small>to green</small>
    </div>
  );
}

function TrackPlaceholder() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" opacity="0.5" aria-hidden="true">
      <rect x="6" y="14" width="52" height="36" rx="18" />
      <rect x="18" y="24" width="28" height="16" rx="8" />
    </svg>
  );
}

// ── 2. Race-week hero ───────────────────────────────────────────────────────
function RaceHero({ data, player, setTab, isLive, liveScores, liveStatus, timingData, week, raceTimes }) {
  const info = SCHEDULE.find(s => s.w === week);
  const pid  = player.id;

  // Off-season fallback: all races complete → season wrap-up
  if (!info) {
    const w = getSeasonWrapUp(data, pid);
    return (
      <section className="card hero">
        <div className="hero-head" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
          <div>
            <div className="hero-eyebrow">{ACTIVE_SEASON} · final</div>
            <div className="hero-title">Season Wrap-Up</div>
            <div className="hero-meta">{player.name}</div>
          </div>
          <button className="link-btn" onClick={() => setTab("schedule")}>Next season →</button>
        </div>
        <div className="hero-body">
          <div className="wrap-bar">
            <div className="wrap-stat"><div className="v num">{w.bestScore != null ? w.bestScore : "—"}</div><div className="l">Best race score</div></div>
            <div className="wrap-stat"><div className="v num">{w.avgFinish != null ? w.avgFinish.toFixed(1) : "—"}</div><div className="l">Avg finish</div></div>
            <div className="wrap-stat"><div className="v num">{w.races ? `+${w.playoffPts}` : "—"}</div><div className="l">Playoff pts</div></div>
          </div>
        </div>
      </section>
    );
  }

  const lineup = getPlayerLineup(data, week, pid);
  const slots  = Array.from({ length: ACTIVE_PICKS }, (_, i) => lineup[i] || null);
  const stage  = timingData?.stage?.stage_num;

  return (
    <section className="card hero">
      <div className="hero-head">
        <div className="track-slot sm"><TrackPlaceholder /></div>

        <div style={{ minWidth: 0 }}>
          <div className="hero-eyebrow">
            {isLive ? "Live" : "Next race"} · {weekLabel(week)}{info.ex ? " · Exhibition" : ""}
          </div>
          <div className="hero-title">{info.t}</div>
          <div className="hero-meta num">
            {isLive
              ? <><span className="live-dot" />LIVE{stage != null ? ` · STAGE ${stage}` : ""}</>
              : <span title={hasRealRaceTime(info, raceTimes) ? undefined : "Start time not announced yet — 2:00 PM ET placeholder"}>
                  {hasRealRaceTime(info, raceTimes)
                    ? formatRaceWhen(info, raceTimes)
                    : formatRaceWhen(info, raceTimes).replace("• ", "• ~")}
                </span>}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <span className="pill num" style={{ fontSize: 9.5 }}>{ARCHETYPE[info.ty]} ×{TRACK_MULTS[info.ty]}</span>
          {isLive
            ? <div className="hero-clock num">
                {timingData?.lapsInRace > 0 ? `LAP ${timingData.lapNumber}/${timingData.lapsInRace}` : (liveStatus || "")}
              </div>
            : <div style={{ marginTop: 6 }}><Countdown entry={info} times={raceTimes} /></div>}
        </div>
      </div>

      <div className="hero-body">
        {lineup.length === 0 ? (
          <button className="cta-block" onClick={() => setTab("draft")}>+ Set lineup</button>
        ) : (
          <>
            <div className="sec-head" style={{ margin: 0 }}>
              <span className="label">Your lineup</span>
              <button className="link-btn" onClick={() => setTab("draft")}>Draft →</button>
            </div>
            <div className="lineup-strip">
              {slots.map((s, i) => s ? (
                <div key={i} className={`dchip${s.mulligan ? " mull" : ""}`} style={{ "--paint": paintFor(s.driver) }}>
                  <div className="dchip-num num">{carNumber(s.driver) || "—"}</div>
                  <div className="dchip-name">{shortName(s.driver)}</div>
                </div>
              ) : (
                <div key={i} className="dchip empty num">—</div>
              ))}
            </div>
          </>
        )}

        {isLive && liveScores && (
          <div className="live-row" onClick={() => setTab("live")}>
            {Object.entries(liveScores).sort((a, b) => b[1].total - a[1].total).map(([p2, s], i) => (
              <div key={p2} className="live-chip">
                <div className="n">{i === 0 ? "👑 " : ""}{PNAME[p2]}</div>
                <div className="v num" style={{ color: s.total > 0 ? "var(--go)" : s.total < 0 ? "var(--stop)" : "var(--text)" }}>
                  {signed(s.total)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const Chevron = () => (
  <svg className="chev" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2.5 4.5 6 8l3.5-3.5" />
  </svg>
);

// ── Home ────────────────────────────────────────────────────────────────────
export function WelcomeTab({ player, data, setTab, liveScores, liveStatus, timingData }) {
  const pid = player.id;
  const clr = PClr[pid];
  const [trophyPid, setTrophyPid]   = useState(null);
  const [openRow, setOpenRow]       = useState(null);      // accordion: one standings row open at a time
  const [showRankings, setShowRankings] = useState(false);

  const currentWeek = getCurrentWeek(data);

  // Two separate standings: Regular Season (W1–26) and The Chase (W27–36)
  const [view, setView] = useState(() => defaultStandingsView(data));
  const standings = useMemo(() =>
    getStandings(data, view).map(r => ({
      ...r,
      name: PNAME[r.id],
      mullsLeft: getMulliganAllowance(data, r.id, currentWeek).remaining,
    })),
  [data, view, currentWeek]);
  const back     = pointsBack(standings);
  const progress = standingsProgress(data, view);

  const raceTimes = useRaceTimes();
  const seasonOver = !SCHEDULE.some(s => s.w === currentWeek);
  const driverStandings = useDriverStandings(!seasonOver);
  const bubble = !seasonOver && driverStandings ? buildBubble(driverStandings.drivers, currentWeek) : null;

  const seasonChampion = useMemo(() => getSeasonChampion(data), [data]);
  const powerRankings  = useMemo(() => getPowerRankings(data), [data]);
  const powerLeader    = powerRankings[0];

  const myStats = standings.find(s => s.id === pid);

  const isLive = !!(data?.liveRace?.active && liveScores);
  const heroWeek = isLive ? data.liveRace.week : currentWeek;
  const liveRanked = isLive
    ? PLAYERS.map(p => ({ id: p.id, live: liveScores[p.id]?.total || 0 })).sort((a, b) => b.live - a.live)
    : null;
  const myLiveRank = liveRanked ? liveRanked.findIndex(x => x.id === pid) + 1 : 0;

  const status = getLineupStatus(data, currentWeek);

  // Latest scored race (for the Last Race card)
  const lastWeekKey  = Object.keys(data.results || {}).map(k => parseInt(k.replace("w", ""))).sort((a, b) => b - a)[0];
  const lastWeek     = lastWeekKey ? data.results["w" + lastWeekKey] : null;
  const lastRaceInfo = SCHEDULE.find(s => s.w === lastWeekKey);
  const lastSorted   = Object.entries(lastWeek?.scored || {}).sort((a, b) => b[1].total - a[1].total);
  const lastMax      = Math.max(lastSorted[0]?.[1]?.total || 0, 1);
  const lastMargin   = lastSorted.length > 1 ? Math.round((lastSorted[0][1].total - lastSorted[1][1].total) * 10) / 10 : 0;

  // What the expandable standings rows show
  const lw       = useMemo(() => getHomeLineupWeek(data), [data]);
  const lwInfo   = SCHEDULE.find(s => s.w === lw.week);
  const lwScored = storeFor(data, lw.week).results?.["w" + lw.week]?.scored;

  // Which players picked each driver this race (for the cutline card)
  const pickedBy = useMemo(() => {
    const m = {};
    PLAYERS.forEach(p => getPlayerLineup(data, heroWeek, p.id).forEach(l => {
      const n = carNumber(l.driver);
      (m[n] ||= []).push(p.id);
    }));
    return m;
  }, [data, heroWeek]);

  return (
    <div className="home">

      {seasonChampion && <ChampionRibbon champ={seasonChampion} onOpen={() => setTab("hall")} />}

      {/* ── Driver hub ─────────────────────────────────────────────────────── */}
      <section className="card hub">
        <div className="hub-top">
          <div className="hub-name">
            <span className="dot" style={{ width: 10, height: 10, background: clr.accent }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{player.name}</span>
          </div>
          <button className="btn-ghost" onClick={() => setTab("hall")}>🏆 Trophy Case</button>
        </div>
        <div className="hub-row">
          <span className={`pill lg ${statusTone(status.state)}`}>{status.label}</span>
          <span className={`pill lg num ${mullTone(myStats?.mullsLeft ?? 0)}`}>M:{myStats?.mullsLeft ?? 0}</span>
          {isLive && myLiveRank > 0 && (
            <span className="pill lg down num"><span className="live-dot" />P{myLiveRank} LIVE</span>
          )}
        </div>
      </section>

      {/* ── Race week hero ─────────────────────────────────────────────────── */}
      <RaceHero
        data={data} player={player} setTab={setTab} isLive={isLive}
        liveScores={liveScores} liveStatus={liveStatus} timingData={timingData}
        week={heroWeek} raceTimes={raceTimes}
      />

      {/* ── Season standings ───────────────────────────────────────────────── */}
      <div>
        <div className="sec-head" style={{ marginBottom: 8 }}>
          <span className="label">Standings</span>
          <span className="num" style={{ fontSize: 11, color: "var(--text-3)" }}>
            {view === "chase" ? "W27–36" : "W1–26"} · {progress.done} / {progress.total} races
          </span>
        </div>
        <div className="seg" role="tablist" aria-label="Standings" style={{ marginBottom: 8 }}>
          <button aria-pressed={view === "regular"} onClick={() => { setView("regular"); setOpenRow(null); }}>Regular season</button>
          <button aria-pressed={view === "chase"}   onClick={() => { setView("chase");   setOpenRow(null); }}>The Chase</button>
        </div>
        {view === "chase" && progress.done === 0 && (
          <div style={{ fontSize: 11, color: "var(--text-2)", margin: "0 2px 8px" }}>
            Chase entry totals — 1,000 + playoff pts + champion bonus. Weeks 27–36 add on top.
          </div>
        )}

        <div className="stand">
          {standings.map((p, i) => {
            const isMe    = p.id === pid;
            const open    = openRow === p.id;
            const lineup  = getPlayerLineup(data, lw.week, p.id);
            const dScores = lwScored?.[p.id]?.drivers || [];
            return (
              <div key={p.id}>
                <div className={`stand-item${open ? " open" : ""}`}>
                  <button className="stand-row" aria-expanded={open} onClick={() => setOpenRow(open ? null : p.id)}>
                    <span className="num label" style={{ textAlign: "center" }}>{i + 1}</span>
                    <span style={{ minWidth: 0 }}>
                      <span className="stand-name">
                        <span className="dot" style={{ background: PClr[p.id].accent }} />
                        {p.name}{isMe && <span className="you">YOU</span>}
                      </span>
                      <span className="stand-sub num" style={{ display: "block" }}>
                        {p.wins}W · {view === "chase" ? `+${p.chasePts} chase` : `+${p.pp} PP`} ·{" "}
                        <span style={{ color: p.mullsLeft <= 1 ? "var(--stop)" : p.mullsLeft <= 5 ? "var(--caution)" : "var(--text-2)" }}>M:{p.mullsLeft}</span>
                      </span>
                    </span>
                    <span className="stand-pts">
                      <div className="v num">{p.pts.toLocaleString()}</div>
                      {i > 0 && <div className="back num">{back[i] === 0 ? "—" : back[i].toFixed(1)}</div>}
                    </span>
                    <Chevron />
                  </button>

                  <div className="acc" aria-hidden={!open}>
                    <div>
                      <div className="acc-body">
                        {lineup.length === 0
                          ? <div style={{ fontSize: 12, color: "var(--text-3)" }}>No picks yet for this race.</div>
                          : lineup.map((l, k) => {
                              const ds = dScores.find(d => d.driver === l.driver);
                              return (
                                <div key={k} className="acc-row" style={{ "--paint": paintFor(l.driver) }}>
                                  <span className="bar" />
                                  <span className="n num">{carNumber(l.driver)}</span>
                                  <span className="nm">{l.driver.replace(/^#\S+\s*/, "")}{l.mulligan ? " · M" : ""}</span>
                                  {ds && (
                                    <span className="num" style={{ fontWeight: 700, color: ds.total > 0 ? "var(--go)" : ds.total < 0 ? "var(--stop)" : "var(--text-2)" }}>
                                      {signed(ds.total)}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                        <div className="acc-foot">
                          <span>{lwInfo ? `${weekLabel(lw.week)} · ${lwInfo.t}${lw.scored ? "" : " · upcoming"}` : ""}</span>
                          <button className="link-btn" onClick={() => setTrophyPid(p.id)}>Trophy case →</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Playoff cutline: NASCAR driver standings around the cut ─────────── */}
      {bubble && (
        <section className="card" style={{ padding: "12px 14px" }}>
          <div className="sec-head" style={{ margin: "0 0 6px" }}>
            <span className="label">Playoff cutline · top {bubble.cut}</span>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>NASCAR points</span>
          </div>
          <div>
            {bubble.rows.map(d => (
              <div key={d.name}>
                {d.rank === bubble.cut + 1 && <div className="cutline">CHASE CUTLINE</div>}
                <div className={`bub-row${d.inside ? "" : " out"}`}>
                  <span className="rk num">{d.rank}</span>
                  <span className="bar" style={{ "--paint": paintFor(d.name) }} />
                  <span className="n num">{d.num}</span>
                  <span className="nm">
                    {d.name.replace(/^#\S+\s*/, "")}
                    {(pickedBy[d.num] || []).map(pid2 => (
                      <span key={pid2} className="dot" title={`${PNAME[pid2]}'s pick`}
                            style={{ width: 6, height: 6, marginLeft: 5, background: PClr[pid2].accent, display: "inline-block" }} />
                    ))}
                  </span>
                  <span className="pts num">{d.points.toLocaleString()}</span>
                  <span className="gap num" style={{ color: d.gap === 0 ? "var(--caution)" : d.gap > 0 ? "var(--go)" : "var(--stop)" }}>
                    {d.gap === 0 ? "CUT" : signed(d.gap)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 6 }}>
            Points ahead (+) or behind (−) the driver on the cutline. Dots mark FERDA picks this race.
          </div>
        </section>
      )}

      {/* ── Power rankings ─────────────────────────────────────────────────── */}
      {powerLeader && (
        <section className="card" style={{ padding: "12px 14px" }}>
          <div className="sec-head" style={{ margin: "0 0 8px" }}>
            <span className="label">Power rankings</span>
            <button className="link-btn" onClick={() => setShowRankings(true)}>Full Rankings →</button>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 15 }}>#1 {PNAME[powerLeader.id]}</strong>
            <span className="num" style={{ fontSize: 13 }}>
              <span style={{ fontSize: 9, letterSpacing: "0.1em", color: "var(--text-2)", marginRight: 4 }}>PWR</span>
              <strong>{powerLeader.pwr.toFixed(1)}</strong>
            </span>
            <RankDelta delta={powerLeader.delta} />
          </div>
          <div style={{ fontSize: 12, color: "var(--text-2)", margin: "4px 0 10px" }}>{powerLeader.insight}</div>
          <div className="pr-strip">
            {powerRankings.map(p => (
              <div key={p.id} className="pr-chip">
                <div className="top num">
                  <span style={{ color: "var(--text-2)", fontWeight: 600 }}>{p.rank}</span>
                  <span className={p.delta > 0 ? "trend-up" : p.delta < 0 ? "trend-down" : "trend-flat"} style={{ fontWeight: 700 }}>
                    {p.delta > 0 ? `▲${p.delta}` : p.delta < 0 ? `▼${-p.delta}` : "–"}
                  </span>
                </div>
                <div className="nm">{PNAME[p.id]}</div>
                <div className="sub num">{p.pwr.toFixed(1)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Last race ──────────────────────────────────────────────────────── */}
      {lastWeek && lastRaceInfo && (
        <section className="card" style={{ padding: "12px 14px" }}>
          <div className="sec-head" style={{ margin: "0 0 4px" }}>
            <span className="label">Last race · W{lastWeekKey}</span>
            {lastMargin > 0 && <span className="num" style={{ fontSize: 11, color: "var(--text-2)" }}>won by {lastMargin}</span>}
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>{lastRaceInfo.r}</div>
          <div style={{ fontSize: 12, color: "var(--text-2)", margin: "2px 0 10px" }}>@ {lastRaceInfo.t}</div>

          <div style={{ display: "grid", gap: 5 }}>
            {lastSorted.map(([p2, s], i) => {
              const mvp = i === 0 ? getRaceMvp(s) : null;
              const pct = Math.max(0, Math.min(100, (s.total / lastMax) * 100));
              return (
                <div key={p2} className="lr-row">
                  <span className="lr-bar" style={{ width: `${pct}%` }} />
                  <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ width: 18, textAlign: "center", fontSize: 13 }}>{i === 0 ? "👑" : i === 3 ? "💩" : ""}</span>
                    <span style={{ fontSize: 13.5, fontWeight: s.weeklyWin ? 800 : 600 }}>
                      {PNAME[p2]}{p2 === pid && <span className="you" style={{ marginLeft: 6 }}>YOU</span>}
                    </span>
                    {mvp && <span className="mvp-tag num">{shortName(mvp.driver)} {signed(mvp.total)}</span>}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {s.weeklyWin && <span className="pill num" style={{ fontSize: 9.5 }}>+25 PP</span>}
                    <span className="num" style={{ fontSize: 16, fontWeight: 700 }}>{s.total}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Full power rankings sheet ──────────────────────────────────────── */}
      <BottomSheet open={showRankings} onClose={() => setShowRankings(false)} title="Power Rankings">
        <PowerBoard rankings={powerRankings} />
        <div style={{ marginTop: 14 }}>
          <button className="link-btn" onClick={() => { setShowRankings(false); setTab("stats"); }}>More in Stats →</button>
        </div>
      </BottomSheet>

      {trophyPid && <TrophyCaseModal pid={trophyPid} data={data} onClose={() => setTrophyPid(null)} />}
    </div>
  );
}
