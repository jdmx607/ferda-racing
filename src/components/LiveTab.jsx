import { useState, useEffect } from "react";
import { PClr, TTL } from "../theme";
import { PLAYERS, SCHEDULE, TRACK_MULTS } from "../constants";
import { fetchLapTimes } from "../nascar";
import { storeFor } from "../engine/events";
import { carNumber } from "../driverPaint";
import { DriverCard } from "./DriverCard";
import { FlagStrip, raceFlagState } from "./FlagStrip";
import { RaceHeader } from "./RaceHeader";

function fmtLap(secs) {
  if (!secs || secs <= 0) return "—";
  if (secs >= 60) {
    const m = Math.floor(secs / 60);
    const s = (secs % 60).toFixed(3).padStart(6, "0");
    return `${m}:${s}`;
  }
  return secs.toFixed(3);
}

function buildPickMap(weekPicks) {
  const map = {};
  Object.entries(weekPicks || {}).forEach(([pid, picks]) => {
    (picks || []).forEach(pk => {
      const m = pk.driver?.match(/^#(\S+)/);
      if (m) {
        if (!map[m[1]]) map[m[1]] = [];
        map[m[1]].push(pid);
      }
    });
  });
  return map;
}

const accentOf = pid => PClr[pid]?.accent || "var(--text-2)";

// ── Timing Tower ───────────────────────────────────────────────────────────────
function TimingTower({ timingData, weekPicks }) {
  const pickMap = buildPickMap(weekPicks);

  if (!timingData) {
    return (
      <div style={{ textAlign:"center", color:"var(--text-2)", padding:"40px 20px", fontSize:13 }}>
        Waiting for timing data…
        <div style={{ fontSize:11, color:"var(--text-3)", marginTop:6 }}>Syncs every 30 seconds.</div>
      </div>
    );
  }

  const { vehicles, lapNumber, lapsInRace, flagName, flagColor, stage, cautions, leadChanges, updatedAt } = timingData;
  const pct = lapsInRace > 0 ? Math.min((lapNumber / lapsInRace) * 100, 100) : 0;

  return (
    <div className="card" style={{ overflow:"hidden" }}>
      {/* Race status */}
      <div style={{
        padding:"10px 14px", borderBottom:"1px solid var(--border)",
        display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8,
      }}>
        <div style={{ display:"flex", gap:20, alignItems:"center", flexWrap:"wrap" }}>
          <div>
            <div className="label">Lap</div>
            <div className="num" style={{ fontSize:18, fontWeight:700 }}>
              {lapNumber} <span style={{ color:"var(--text-2)", fontSize:12, fontWeight:500 }}>/ {lapsInRace}</span>
            </div>
          </div>
          <div>
            <div className="label">Flag</div>
            <div style={{ fontSize:14, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
              <span className="dot" style={{ background:flagColor }} />{flagName}
            </div>
          </div>
          {stage && (
            <div>
              <div className="label">Stage</div>
              <div className="num" style={{ fontSize:14, fontWeight:600 }}>{stage.stage_num ?? "—"}</div>
            </div>
          )}
          <div className="num" style={{ color:"var(--text-2)", fontSize:11 }}>
            {cautions} ctn · {leadChanges} LC
          </div>
        </div>
        {updatedAt && (
          <div className="num" style={{ color:"var(--text-3)", fontSize:10 }}>
            {new Date(updatedAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
          </div>
        )}
      </div>

      {/* Lap progress */}
      <div style={{ height:2, background:"var(--border)" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:"var(--text-2)", transition:"width 1s ease" }}/>
      </div>

      {/* Header */}
      <div className="tt-row tt-head">
        <div>P</div><div>Car</div><div>Driver</div>
        <div className="tt-r">Last</div><div className="tt-r">Best</div>
        <div className="tt-r tt-opt">MPH</div><div className="tt-r tt-opt">LL</div>
      </div>

      {vehicles.map(v => {
        const pids = pickMap[v.carNumber] || [];
        const mine = pids.length > 0;
        return (
          <div key={v.carNumber} className={`tt-row${mine ? " tt-pick" : ""}`} style={{
            borderLeft: mine ? `3px solid ${accentOf(pids[0])}` : "3px solid transparent",
            opacity: v.isOnTrack ? 1 : 0.55,
          }}>
            <div className="num" style={{ fontWeight:700, fontSize:13, color: v.position <= 3 ? "var(--text)" : "var(--text-2)" }}>
              {v.position}
            </div>
            <div className="num" style={{ fontWeight:700, fontSize:13, fontStyle:"italic" }}>#{v.carNumber}</div>
            <div style={{
              fontSize:12.5, color: mine ? "var(--text)" : "var(--text-2)", fontWeight: mine ? 600 : 400,
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
              display:"flex", alignItems:"center", gap:6,
            }}>
              <span style={{ overflow:"hidden", textOverflow:"ellipsis" }}>{v.driver}</span>
              {!v.isOnTrack && <span className="pill caution" style={{ padding:"0 5px", fontSize:9 }}>PIT</span>}
              {pids.map(pid => <span key={pid} className="dot" style={{ width:6, height:6, background:accentOf(pid) }}/>)}
            </div>
            <div className="num tt-r" style={{ fontSize:11.5, color:"var(--text-2)" }}>{fmtLap(v.lastLap)}</div>
            <div className="num tt-r" style={{ fontSize:11.5, color: v.bestLap > 0 ? "var(--go)" : "var(--text-3)", fontWeight: v.bestLap > 0 ? 600 : 400 }}>
              {fmtLap(v.bestLap)}
            </div>
            <div className="num tt-r tt-opt" style={{ fontSize:11.5, color:"var(--text-2)" }}>
              {v.lastSpeed > 0 ? v.lastSpeed.toFixed(1) : "—"}
            </div>
            <div className="num tt-r tt-opt" style={{ fontSize:11.5, color: v.lapsLed > 0 ? "var(--text)" : "var(--text-3)", fontWeight: v.lapsLed > 0 ? 600 : 400 }}>
              {v.lapsLed || "—"}
            </div>
          </div>
        );
      })}

      <div style={{ padding:"8px 14px", fontSize:10.5, color:"var(--text-3)" }}>
        Coloured bar = FERDA pick · green = best lap · PIT = off track
      </div>
    </div>
  );
}

// ── Lap History (post-race, from cacher) ──────────────────────────────────────
function LapHistory({ week, weekPicks }) {
  const [st, setSt] = useState({ loading:true, data:null, error:null });
  const pickMap = buildPickMap(weekPicks);

  useEffect(() => {
    if (!week) return;
    setSt({ loading:true, data:null, error:null });
    fetchLapTimes(week).then(result => {
      if (!result.ok) setSt({ loading:false, data:null, error:result.error });
      else            setSt({ loading:false, data:result, error:null });
    });
  }, [week]);

  if (st.loading) {
    return <div style={{ textAlign:"center", color:"var(--text-2)", padding:20, fontSize:12 }}>Loading lap history…</div>;
  }

  if (st.error || !st.data) {
    return (
      <div className="card" style={{ textAlign:"center", padding:"14px 20px", color:"var(--text-2)", fontSize:12 }}>
        Lap history for W{week} not yet available.
      </div>
    );
  }

  const board = st.data.drivers
    .filter(d => d.laps.length > 0)
    .map(d => {
      const valid = d.laps.filter(l => l.time > 0);
      if (!valid.length) return null;
      const best = valid.reduce((mn, l) => l.time < mn.time ? l : mn, valid[0]);
      const racing = valid.filter(l => l.time <= best.time * 2);
      const avgSpd = racing.length ? racing.reduce((s, l) => s + l.speed, 0) / racing.length : 0;
      return {
        carNumber: d.carNumber, name: d.name, finalPos: d.finalPos,
        bestLap: best.time, bestLapNum: best.lap, bestSpeed: best.speed, avgSpd,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.bestLap - b.bestLap);

  return (
    <div className="card" style={{ overflow:"hidden" }}>
      <div style={{
        padding:"12px 14px", borderBottom:"1px solid var(--border)",
        display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:8,
      }}>
        <div style={{ fontSize:15, fontWeight:700 }}>Lap history · W{week}</div>
        <div className="label">Best-lap leaderboard</div>
      </div>

      <div className="lh-row tt-head">
        <div>RK</div><div>Car</div><div>Driver</div>
        <div className="tt-r">Best</div><div className="tt-r tt-opt">MPH</div><div className="tt-r">Fin</div>
      </div>

      {board.map((d, i) => {
        const pids = pickMap[d.carNumber] || [];
        const mine = pids.length > 0;
        return (
          <div key={d.carNumber} className={`lh-row${mine ? " tt-pick" : ""}`} style={{
            borderLeft: mine ? `3px solid ${accentOf(pids[0])}` : "3px solid transparent",
          }}>
            <div className="num" style={{ fontWeight:700, fontSize:12.5, color: i < 3 ? "var(--text)" : "var(--text-2)" }}>{i + 1}</div>
            <div className="num" style={{ fontWeight:700, fontSize:13, fontStyle:"italic" }}>#{d.carNumber}</div>
            <div style={{
              fontSize:12.5, color: mine ? "var(--text)" : "var(--text-2)", fontWeight: mine ? 600 : 400,
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
              display:"flex", alignItems:"center", gap:6,
            }}>
              <span style={{ overflow:"hidden", textOverflow:"ellipsis" }}>{d.name}</span>
              {pids.map(pid => <span key={pid} className="dot" style={{ width:6, height:6, background:accentOf(pid) }}/>)}
            </div>
            <div className="num tt-r" style={{ fontSize:12, color: i === 0 ? "var(--go)" : "var(--text)", fontWeight: i < 3 ? 700 : 500 }}>
              {fmtLap(d.bestLap)}
            </div>
            <div className="num tt-r tt-opt" style={{ fontSize:11.5, color:"var(--text-2)" }}>
              {d.bestSpeed > 0 ? d.bestSpeed.toFixed(1) : "—"}
            </div>
            <div className="num tt-r" style={{ fontSize:11.5, color:"var(--text-2)" }}>P{d.finalPos}</div>
          </div>
        );
      })}

      <div style={{ padding:"8px 14px", fontSize:10.5, color:"var(--text-3)" }}>
        {board.length} drivers · Fastest lap: Lap {board[0]?.bestLapNum} · Coloured bar = FERDA picks
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
export function LiveTab({ data, liveScores, liveStatus, raceInfo, currentWeek, timingData }) {
  const [activeView, setActiveView] = useState("scoring");

  const isActive = !!(data?.liveRace?.active && liveScores);
  const week = data?.liveRace?.week || currentWeek;
  const weekInfo = SCHEDULE.find(s => s.w === week);
  const weekPicks = storeFor(data, week).picks?.["w" + week] || {};

  // ── Inactive state ─────────────────────────────────────────────────────────
  if (!isActive) return (
    <div style={{ maxWidth:700, margin:"0 auto", position:"relative", zIndex:1 }}>
      {weekInfo && (
        <>
          <RaceHeader
            title={weekInfo.r} track={weekInfo.t} trackType={weekInfo.ty}
            right={<div className="label">{weekInfo.d}</div>}
          />
          <FlagStrip state="none" />
        </>
      )}
      <div style={{ padding:"20px 16px" }}>
        <div className="card" style={{ padding:"36px 24px", textAlign:"center" }}>
          <div style={{ fontSize:18, fontWeight:700, marginBottom:6 }}>No race in progress</div>
          <div style={{ color:"var(--text-2)", fontSize:13.5, lineHeight:1.55 }}>
            Live scoring starts when the commissioner starts a race. Check back on race day.
          </div>
          {weekInfo && (
            <div style={{ marginTop:18, paddingTop:16, borderTop:"1px solid var(--border)" }}>
              <div className="label" style={{ marginBottom:4 }}>Next up</div>
              <div style={{ fontWeight:600, fontSize:15 }}>{weekInfo.r}</div>
              <div className="num" style={{ color:"var(--text-2)", fontSize:12.5, marginTop:2 }}>
                {weekInfo.t} · {weekInfo.d} · {TTL[weekInfo.ty]} ×{TRACK_MULTS[weekInfo.ty]}
              </div>
            </div>
          )}
        </div>

        {/* Lap history for current/last week */}
        {currentWeek >= 1 && (
          <div style={{ marginTop:20 }}>
            <LapHistory week={currentWeek} weekPicks={weekPicks} />
          </div>
        )}
      </div>
    </div>
  );

  // ── Active race ─────────────────────────────────────────────────────────────
  const ranked = PLAYERS.map(p => ({
    ...p,
    seasonPts: data.meta.standings[p.id] || 0,
    livePts:   liveScores[p.id]?.total   || 0,
    drivers:   liveScores[p.id]?.drivers || [],
    picks:     weekPicks[p.id]           || [],
  })).sort((a, b) => b.livePts - a.livePts);

  const positions = raceInfo?.positions || {};

  return (
    <div style={{ maxWidth:900, margin:"0 auto", position:"relative", zIndex:1 }}>

      <RaceHeader
        live
        title={raceInfo?.raceName || weekInfo?.r || `Week ${week}`}
        track={weekInfo?.t}
        trackType={weekInfo?.ty}
        stage={timingData?.stage?.stage_num}
        lap={timingData?.lapNumber}
        laps={timingData?.lapsInRace}
        right={
          <>
            <div className="label">{liveStatus || "Live"}</div>
            {raceInfo?.source && <div className="race-meta">{raceInfo.source}</div>}
          </>
        }
      />
      <FlagStrip state={raceFlagState(timingData, raceInfo)} />

      <div style={{ padding:"12px 16px 0" }}>
        <div className="seg" role="tablist">
          {[
            { id:"scoring", label:"Scoring" },
            { id:"timing",  label:"Timing tower" },
          ].map(v => (
            <button key={v.id} aria-pressed={activeView === v.id} onClick={() => setActiveView(v.id)}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scoring view */}
      {activeView === "scoring" && (
        <div style={{ padding:"0 16px 24px" }}>
          {ranked.map((p, i) => {
            const mullPicks = (p.picks || []).filter(pk => pk.mulligan).map(pk => pk.driver);
            const gap = i > 0 ? ranked[i - 1].livePts - p.livePts : 0;
            const total = p.livePts;

            return (
              <section key={p.id}>
                <div className="group-head">
                  <div className="who">
                    <span className="num label" style={{ width:14 }}>{i + 1}</span>
                    <span className="dot" style={{ background:accentOf(p.id) }} />
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:16, fontWeight:700, lineHeight:1.1 }}>{p.name}</div>
                      <div className="num" style={{ fontSize:11, color:"var(--text-2)", marginTop:2 }}>
                        Season {p.seasonPts.toLocaleString()} pts
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div className="num" style={{
                      fontSize:26, fontWeight:700, lineHeight:1,
                      color: total > 0 ? "var(--go)" : total < 0 ? "var(--stop)" : "var(--text)",
                    }}>
                      {total > 0 ? "+" : ""}{total}
                    </div>
                    <div className="num" style={{ fontSize:11, color:"var(--text-2)", marginTop:3 }}>
                      {i === 0 ? "leading" : `−${gap.toFixed(1)} behind`}
                    </div>
                  </div>
                </div>

                <div className="stack">
                  {p.drivers.length === 0
                    ? <div className="card" style={{ color:"var(--text-3)", fontSize:12, textAlign:"center", padding:14 }}>No picks found</div>
                    : p.drivers.slice().sort((a, b) => b.total - a.total).map(d => {
                        const pos = positions[carNumber(d.driver)];
                        return (
                          <DriverCard
                            key={d.driver}
                            driver={d.driver}
                            points={d.total}
                            currentPos={pos?.finish}
                            startPos={pos?.start}
                            dnf={pos?.dnf}
                            dnr={d.dnr}
                            mulligan={mullPicks.includes(d.driver)}
                            breakdown={d.breakdown}
                          />
                        );
                      })
                  }
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Timing Tower view */}
      {activeView === "timing" && (
        <div style={{ padding:"12px 16px 24px" }}>
          <TimingTower timingData={timingData} weekPicks={weekPicks} />
        </div>
      )}
    </div>
  );
}
