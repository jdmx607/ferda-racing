import { useState, useEffect } from "react";
import { C, PClr, TTC, TTL, rankColor, shadow, r } from "../theme";
import { PLAYERS, SCHEDULE, DRIVER_INFO, MAKE_COLORS, TRACK_MULTS } from "../constants";
import { fetchLapTimes } from "../nascar";

const CHIP_MAP = {
  "Top 5":    { short:"T5",   col:"#10b981" },
  "Top 10":   { short:"T10",  col:"#10b981" },
  "Pole":     { short:"POLE", col:"#f59e0b" },
  "S1 Win":   { short:"S1W",  col:"#f59e0b" },
  "S2 Win":   { short:"S2W",  col:"#f59e0b" },
  "S3 Win":   { short:"S3W",  col:"#f59e0b" },
  "Fast Lap": { short:"FL",   col:"#8b5cf6" },
  "Most Led": { short:"ML",   col:"#3b82f6" },
  "SWEEP!":   { short:"💫",   col:"#f59e0b" },
  "DQ":       { short:"DQ",   col:"#ef4444" },
  "DNF":      { short:"DNF",  col:"#94a3b8" },
};

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

function BreakdownChips({ breakdown, fg }) {
  const chips = (breakdown || []).filter(b => b.pts !== 0 || CHIP_MAP[b.label]);
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginTop:3 }}>
      {chips.map((b, i) => {
        const map = CHIP_MAP[b.label];
        const col = map?.col || (b.pts > 0 ? "#10b981" : b.pts < 0 ? "#ef4444" : "#475569");
        const short = map?.short || b.label;
        return (
          <span key={i} style={{
            fontSize:9, fontWeight:700, letterSpacing:0.5,
            color:col, background:col+"22",
            padding:"2px 5px", borderRadius:r.pill,
            border:`1px solid ${col}44`,
          }}>
            {short}{b.pts !== 0 ? ` ${b.pts > 0 ? "+" : ""}${b.pts}` : ""}
          </span>
        );
      })}
    </div>
  );
}

function DriverRow({ d, mullPicks, playerBg, playerFg }) {
  const isMull = mullPicks.includes(d.driver);
  const info = DRIVER_INFO[d.driver] || {};
  const score = d.total;
  const scoreColor = score > 0 ? "#10b981" : score < 0 ? "#ef4444" : playerFg + "88";

  return (
    <div style={{
      display:"flex", alignItems:"flex-start", justifyContent:"space-between",
      padding:"8px 12px",
      background: playerBg === "#000000" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.18)",
      borderRadius:r.sm,
      borderLeft:`2px solid ${score > 30 ? "#f59e0b66" : score > 0 ? playerFg+"33" : "#ef444433"}`,
    }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{
            fontSize:13, fontWeight:700,
            color: d.dnr ? playerFg+"55" : playerFg,
            fontFamily:"'Barlow Condensed',sans-serif",
          }}>
            {d.driver}
            {isMull && <span style={{ fontSize:9, color:"#f59e0b", marginLeft:4 }}>MULL</span>}
            {d.dnr && <span style={{ fontSize:9, color:playerFg+"66", marginLeft:4 }}>DNR</span>}
          </span>
        </div>
        {info.team && (
          <div style={{ fontSize:9, color:playerFg+"55", marginTop:1 }}>
            {info.team}
            {info.make && <span style={{ color:MAKE_COLORS[info.make], marginLeft:4, fontWeight:700 }}>{info.make}</span>}
          </div>
        )}
        {!d.dnr && <BreakdownChips breakdown={d.breakdown} fg={playerFg} />}
      </div>
      <div style={{ textAlign:"right", marginLeft:8, flexShrink:0 }}>
        <div style={{
          fontFamily:"'Oswald',sans-serif", fontSize:20, fontWeight:700,
          color:scoreColor, lineHeight:1,
        }}>
          {score > 0 ? "+" : ""}{score}
        </div>
        <div style={{ fontSize:9, color:playerFg+"55", marginTop:2 }}>pts</div>
      </div>
    </div>
  );
}

function GapBanner({ gap }) {
  if (gap <= 0) return null;
  return (
    <div style={{
      textAlign:"center", padding:"6px 0",
      color:C.muted, fontSize:11, fontWeight:600, letterSpacing:1.5,
      fontFamily:"'Oswald',sans-serif",
    }}>
      ▲ GAP: +{gap.toFixed(1)} pts ahead
    </div>
  );
}

// ── Timing Tower ───────────────────────────────────────────────────────────────
function TimingTower({ timingData, weekPicks }) {
  const pickMap = buildPickMap(weekPicks);

  if (!timingData) {
    return (
      <div style={{ textAlign:"center", color:C.muted, padding:"40px 20px", fontSize:13 }}>
        <div style={{ fontSize:32, marginBottom:10 }}>📡</div>
        Waiting for timing data…
        <div style={{ fontSize:11, color:C.dim, marginTop:6 }}>Syncs every 30 seconds.</div>
      </div>
    );
  }

  const { vehicles, lapNumber, lapsInRace, flagName, flagColor, stage, cautions, leadChanges, updatedAt } = timingData;
  const pct = lapsInRace > 0 ? Math.min((lapNumber / lapsInRace) * 100, 100) : 0;

  return (
    <div>
      {/* Race status bar */}
      <div style={{
        padding:"10px 14px",
        background:"rgba(0,0,0,0.3)",
        borderBottom:`1px solid ${C.border}`,
        display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8,
      }}>
        <div style={{ display:"flex", gap:18, alignItems:"center", flexWrap:"wrap" }}>
          <div>
            <div style={{ color:C.dim, fontSize:9, letterSpacing:2, textTransform:"uppercase" }}>Lap</div>
            <div style={{ color:C.text, fontFamily:"'Oswald',sans-serif", fontSize:20, fontWeight:700, lineHeight:1 }}>
              {lapNumber} <span style={{ color:C.muted, fontSize:13 }}>/ {lapsInRace}</span>
            </div>
          </div>
          <div>
            <div style={{ color:C.dim, fontSize:9, letterSpacing:2, textTransform:"uppercase" }}>Flag</div>
            <div style={{ color:flagColor, fontFamily:"'Oswald',sans-serif", fontSize:15, fontWeight:700, lineHeight:1.2 }}>
              ● {flagName}
            </div>
          </div>
          {stage && (
            <div>
              <div style={{ color:C.dim, fontSize:9, letterSpacing:2, textTransform:"uppercase" }}>Stage</div>
              <div style={{ color:C.text, fontFamily:"'Oswald',sans-serif", fontSize:15, fontWeight:700, lineHeight:1.2 }}>
                {stage.stage_num ?? "—"}
              </div>
            </div>
          )}
          <div style={{ color:C.muted, fontSize:11 }}>
            {cautions} ctn &nbsp;·&nbsp; {leadChanges} LC
          </div>
        </div>
        {updatedAt && (
          <div style={{ color:C.dim, fontSize:9 }}>
            Updated {new Date(updatedAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
          </div>
        )}
      </div>

      {/* Lap progress bar */}
      <div style={{ height:3, background:C.border }}>
        <div style={{
          height:"100%", width:`${pct}%`,
          background:flagColor, transition:"width 1s ease",
        }}/>
      </div>

      {/* Table header */}
      <div style={{
        display:"grid",
        gridTemplateColumns:"30px 50px 1fr 66px 66px 54px 28px",
        padding:"5px 12px",
        borderBottom:`1px solid ${C.border}`,
        fontSize:9, fontWeight:700, letterSpacing:1.5, color:C.dim, textTransform:"uppercase",
      }}>
        <div>P</div>
        <div>Car</div>
        <div>Driver</div>
        <div style={{ textAlign:"right" }}>Last</div>
        <div style={{ textAlign:"right" }}>Best</div>
        <div style={{ textAlign:"right" }}>MPH</div>
        <div style={{ textAlign:"right" }}>LL</div>
      </div>

      {/* Rows */}
      {vehicles.map((v, i) => {
        const pids = pickMap[v.carNumber] || [];
        const accent = pids.length ? PClr[pids[0]]?.fg || C.accent : null;
        const posClr = i === 0 ? "#ffd700" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : C.muted;

        return (
          <div key={v.carNumber} style={{
            display:"grid",
            gridTemplateColumns:"30px 50px 1fr 66px 66px 54px 28px",
            padding:"5px 12px",
            alignItems:"center",
            background: accent ? accent+"10" : i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
            borderLeft: accent ? `3px solid ${accent}` : "3px solid transparent",
            borderBottom:`1px solid ${C.border}15`,
            opacity: v.isOnTrack ? 1 : 0.55,
          }}>
            <div style={{ fontFamily:"'Oswald',sans-serif", fontWeight:700, fontSize:14, color:posClr }}>
              {v.position}
            </div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:15, color:accent||C.text }}>
              #{v.carNumber}
            </div>
            <div style={{
              fontSize:12, color:accent ? C.text : C.dim, fontWeight:accent ? 700 : 400,
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
              display:"flex", alignItems:"center", gap:4,
            }}>
              {v.driver}
              {!v.isOnTrack && <span style={{ fontSize:8, color:"#f59e0b", fontWeight:700 }}>PIT</span>}
              {pids.map(pid => (
                <span key={pid} style={{
                  width:6, height:6, borderRadius:"50%", flexShrink:0,
                  background:PClr[pid]?.fg || C.accent,
                  display:"inline-block",
                }}/>
              ))}
            </div>
            <div style={{ textAlign:"right", fontFamily:"monospace", fontSize:11, color:C.muted }}>
              {fmtLap(v.lastLap)}
            </div>
            <div style={{
              textAlign:"right", fontFamily:"monospace", fontSize:11,
              color: v.bestLap > 0 ? "#10b981" : C.dim, fontWeight: v.bestLap > 0 ? 700 : 400,
            }}>
              {fmtLap(v.bestLap)}
            </div>
            <div style={{ textAlign:"right", fontSize:11, color:C.dim }}>
              {v.lastSpeed > 0 ? v.lastSpeed.toFixed(1) : "—"}
            </div>
            <div style={{
              textAlign:"right", fontSize:11,
              color: v.lapsLed > 0 ? "#3b82f6" : C.dim, fontWeight: v.lapsLed > 0 ? 700 : 400,
            }}>
              {v.lapsLed || "—"}
            </div>
          </div>
        );
      })}

      <div style={{ padding:"7px 12px", fontSize:10, color:C.dim, borderTop:`1px solid ${C.border}` }}>
        Colored dots = FERDA picks &nbsp;·&nbsp; BEST highlighted green &nbsp;·&nbsp; PIT = off track
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
    return (
      <div style={{ textAlign:"center", color:C.muted, padding:"20px", fontSize:12 }}>
        Loading lap history…
      </div>
    );
  }

  if (st.error || !st.data) {
    return (
      <div style={{
        textAlign:"center", padding:"14px 20px",
        color:C.dim, fontSize:12,
        background:C.card, borderRadius:r.md, border:`1px solid ${C.border}`,
      }}>
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
      const avgSpd = racing.length
        ? racing.reduce((s, l) => s + l.speed, 0) / racing.length
        : 0;
      return {
        carNumber: d.carNumber,
        name:      d.name,
        finalPos:  d.finalPos,
        bestLap:   best.time,
        bestLapNum:best.lap,
        bestSpeed: best.speed,
        avgSpd,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.bestLap - b.bestLap);

  return (
    <div style={{ background:C.card, borderRadius:r.xl, border:`1px solid ${C.border}`, overflow:"hidden" }}>
      <div style={{
        padding:"12px 16px", borderBottom:`1px solid ${C.border}`,
        display:"flex", alignItems:"center", justifyContent:"space-between",
      }}>
        <div style={{ color:C.text, fontFamily:"'Oswald',sans-serif", fontSize:16, fontWeight:700, letterSpacing:1 }}>
          LAP HISTORY — W{week}
        </div>
        <div style={{ color:C.dim, fontSize:10 }}>Best Lap Leaderboard</div>
      </div>

      {/* Headers */}
      <div style={{
        display:"grid",
        gridTemplateColumns:"28px 50px 1fr 66px 58px 34px",
        padding:"5px 12px",
        borderBottom:`1px solid ${C.border}`,
        fontSize:9, fontWeight:700, letterSpacing:1.5, color:C.dim, textTransform:"uppercase",
      }}>
        <div>RK</div>
        <div>Car</div>
        <div>Driver</div>
        <div style={{ textAlign:"right" }}>Best Lap</div>
        <div style={{ textAlign:"right" }}>MPH</div>
        <div style={{ textAlign:"right" }}>Fin</div>
      </div>

      {board.map((d, i) => {
        const pids = pickMap[d.carNumber] || [];
        const accent = pids.length ? PClr[pids[0]]?.fg || C.accent : null;

        return (
          <div key={d.carNumber} style={{
            display:"grid",
            gridTemplateColumns:"28px 50px 1fr 66px 58px 34px",
            padding:"6px 12px",
            alignItems:"center",
            background: accent ? accent+"10" : i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
            borderLeft: accent ? `3px solid ${accent}` : "3px solid transparent",
            borderBottom:`1px solid ${C.border}15`,
          }}>
            <div style={{
              fontFamily:"'Oswald',sans-serif", fontWeight:700, fontSize:13,
              color: i === 0 ? "#ffd700" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : C.muted,
            }}>
              {i + 1}
            </div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, fontSize:15, color:accent||C.text }}>
              #{d.carNumber}
            </div>
            <div style={{
              fontSize:12, color:accent ? C.text : C.dim, fontWeight:accent ? 700 : 400,
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
              display:"flex", alignItems:"center", gap:4,
            }}>
              {d.name}
              {pids.map(pid => (
                <span key={pid} style={{
                  width:6, height:6, borderRadius:"50%", flexShrink:0,
                  background:PClr[pid]?.fg || C.accent,
                  display:"inline-block",
                }}/>
              ))}
            </div>
            <div style={{
              textAlign:"right", fontFamily:"monospace", fontSize:12,
              color: i === 0 ? "#8b5cf6" : "#10b981",
              fontWeight: i < 3 ? 700 : 400,
            }}>
              {fmtLap(d.bestLap)}
            </div>
            <div style={{ textAlign:"right", fontSize:11, color:C.muted }}>
              {d.bestSpeed > 0 ? d.bestSpeed.toFixed(1) : "—"}
            </div>
            <div style={{ textAlign:"right", fontSize:11, color:C.dim }}>
              P{d.finalPos}
            </div>
          </div>
        );
      })}

      <div style={{ padding:"7px 12px", fontSize:10, color:C.dim, borderTop:`1px solid ${C.border}` }}>
        {board.length} drivers · Fastest lap: Lap {board[0]?.bestLapNum} · Colored dots = FERDA picks
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
  const weekPicks = data?.picks?.["w" + week] || {};

  // ── Inactive state ─────────────────────────────────────────────────────────
  if (!isActive) return (
    <div style={{ padding:20, maxWidth:700, margin:"0 auto", position:"relative", zIndex:1 }}>
      <h2 style={{ color:C.text, fontFamily:"'Oswald',sans-serif", fontSize:26, marginBottom:16, letterSpacing:1 }}>
        Live Scoring
      </h2>
      <div style={{
        background:C.card, borderRadius:r.xl, padding:"48px 32px",
        border:`1px solid ${C.border}`, textAlign:"center", boxShadow:shadow.md,
      }}>
        <div style={{ fontSize:56, marginBottom:16 }}>🏁</div>
        <div style={{
          color:C.text, fontFamily:"'Oswald',sans-serif",
          fontSize:22, fontWeight:700, marginBottom:8, letterSpacing:1,
        }}>
          No Race In Progress
        </div>
        <div style={{ color:C.dim, fontSize:14, lineHeight:1.5 }}>
          Live scoring activates when the commissioner starts a race. Check back on race day!
        </div>
        {weekInfo && (
          <div style={{
            marginTop:20, padding:"12px 20px",
            background:C.accent+"15", border:`1px solid ${C.accent}44`,
            borderRadius:r.md, display:"inline-block",
          }}>
            <div style={{ color:C.accent, fontFamily:"'Oswald',sans-serif", fontSize:11, letterSpacing:2, marginBottom:4, textTransform:"uppercase" }}>Next Up</div>
            <div style={{ color:C.text, fontWeight:700, fontSize:16 }}>W{week} — {weekInfo.r}</div>
            <div style={{ color:C.dim, fontSize:13, marginTop:2 }}>
              {weekInfo.t} · {weekInfo.d} ·{" "}
              <span style={{ color:TTC[weekInfo.ty], fontWeight:600 }}>{TTL[weekInfo.ty]} ×{TRACK_MULTS[weekInfo.ty]}</span>
            </div>
          </div>
        )}
      </div>

      {/* Lap history for current/last week */}
      {currentWeek >= 1 && (
        <div style={{ marginTop:24 }}>
          <LapHistory week={currentWeek} weekPicks={weekPicks} />
        </div>
      )}
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

  const leader = ranked[0]?.livePts || 0;

  return (
    <div style={{ maxWidth:900, margin:"0 auto", position:"relative", zIndex:1 }}>

      {/* Race header */}
      <div style={{
        background:"linear-gradient(135deg,#1a0505 0%,#0a0e17 60%)",
        borderBottom:`2px solid #ef4444`,
        padding:"16px 20px",
      }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ position:"relative", width:12, height:12, flexShrink:0 }}>
              <div style={{
                position:"absolute", inset:0, borderRadius:"50%",
                background:"#ef4444",
                animation:"livePulse 1.5s ease-in-out infinite",
              }}/>
            </div>
            <div>
              <div style={{ color:"#fff", fontFamily:"'Oswald',sans-serif", fontSize:20, fontWeight:900, letterSpacing:2, lineHeight:1 }}>
                RACE IN PROGRESS
              </div>
              {weekInfo && (
                <div style={{ color:"#ffffff88", fontSize:12, marginTop:3 }}>
                  W{week} — {raceInfo?.raceName || weekInfo.r} &nbsp;·&nbsp; {weekInfo.t} &nbsp;·&nbsp;
                  <span style={{ color:TTC[weekInfo.ty], fontWeight:700 }}>{TTL[weekInfo.ty]} ×{TRACK_MULTS[weekInfo.ty]}</span>
                </div>
              )}
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ color:C.text, fontSize:12, fontWeight:600 }}>{liveStatus}</div>
            {raceInfo?.source && <div style={{ color:C.muted, fontSize:10, marginTop:2 }}>{raceInfo.source}</div>}
          </div>
        </div>
      </div>

      {/* View toggle */}
      <div style={{ display:"flex", background:"rgba(0,0,0,0.3)", borderBottom:`1px solid ${C.border}` }}>
        {[
          { id:"scoring", label:"Scoring" },
          { id:"timing",  label:"⏱ Timing Tower" },
        ].map(v => (
          <button key={v.id} onClick={() => setActiveView(v.id)} style={{
            flex:1, padding:"10px", border:"none",
            background: activeView === v.id ? C.card : "transparent",
            color: activeView === v.id ? C.text : C.muted,
            fontFamily:"'Oswald',sans-serif", fontSize:13, fontWeight:700, letterSpacing:1,
            cursor:"pointer",
            borderBottom: activeView === v.id ? `2px solid ${C.accent}` : "2px solid transparent",
            transition:"all 0.15s",
          }}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Scoring view */}
      {activeView === "scoring" && (
        <div style={{ padding:"0 16px 24px" }}>
          {ranked.map((p, i) => {
            const rank = rankColor[i + 1] || rankColor[4];
            const mullPicks = (p.picks || []).filter(pk => pk.mulligan).map(pk => pk.driver);
            const bar = leader > 0 ? (p.livePts / leader) * 100 : 0;
            const gap = i > 0 ? ranked[i - 1].livePts - p.livePts : 0;
            const isLeading = i === 0;

            return (
              <div key={p.id}>
                {i > 0 && <GapBanner gap={gap} />}
                <div style={{
                  background:PClr[p.id].bg,
                  borderRadius:r.lg,
                  border:`2px solid ${isLeading ? rank.fg : PClr[p.id].bg === "#000000" ? C.border : PClr[p.id].bg+"66"}`,
                  overflow:"hidden",
                  marginTop: i === 0 ? 20 : 4,
                  boxShadow: isLeading ? shadow.glow(rank.fg) : shadow.card,
                  transition:"all 0.3s ease",
                }}>
                  <div style={{
                    padding:"14px 16px",
                    display:"flex", alignItems:"center", justifyContent:"space-between",
                    borderBottom:`1px solid ${PClr[p.id].bg === "#000000" ? C.border : "rgba(0,0,0,0.3)"}`,
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{
                        width:40, height:40, borderRadius:r.md,
                        background:rank.bg, border:`2px solid ${rank.fg}`,
                        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                        flexShrink:0,
                      }}>
                        <div style={{ fontFamily:"'Oswald',sans-serif", fontSize:20, fontWeight:900, color:rank.fg, lineHeight:1 }}>
                          {i + 1}
                        </div>
                      </div>
                      <div>
                        <div style={{ color:PClr[p.id].fg, fontFamily:"'Oswald',sans-serif", fontSize:22, fontWeight:900, letterSpacing:1, lineHeight:1 }}>
                          {p.name.toUpperCase()}
                          {isLeading && (
                            <span style={{
                              fontSize:10, fontWeight:700, letterSpacing:2,
                              color:rank.fg, background:rank.fg+"22",
                              padding:"2px 6px", borderRadius:r.pill,
                              marginLeft:8, verticalAlign:"middle",
                            }}>LEADING</span>
                          )}
                        </div>
                        <div style={{ color:PClr[p.id].fg+"66", fontSize:11, marginTop:2 }}>
                          Season: {p.seasonPts.toLocaleString()} pts
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{
                        fontFamily:"'Oswald',sans-serif", fontSize:38, fontWeight:900, lineHeight:1,
                        color: p.livePts > 0 ? "#10b981" : p.livePts < 0 ? "#ef4444" : PClr[p.id].fg,
                      }}>
                        {p.livePts > 0 ? "+" : ""}{p.livePts}
                      </div>
                      <div style={{ color:PClr[p.id].fg+"66", fontSize:10, textTransform:"uppercase", letterSpacing:1 }}>
                        this race
                      </div>
                    </div>
                  </div>
                  <div style={{ height:3, background:"rgba(0,0,0,0.3)" }}>
                    <div style={{
                      height:"100%", background:rank.fg,
                      width:`${Math.max(bar, leader > 0 ? 2 : 0)}%`,
                      transition:"width 0.6s ease", opacity:0.8,
                    }}/>
                  </div>
                  <div style={{ padding:"8px 10px", display:"flex", flexDirection:"column", gap:4 }}>
                    {p.drivers.length === 0
                      ? <div style={{ color:PClr[p.id].fg+"44", fontSize:12, fontStyle:"italic", textAlign:"center", padding:12 }}>No picks found</div>
                      : p.drivers.slice().sort((a, b) => b.total - a.total).map(d => (
                          <DriverRow key={d.driver} d={d} mullPicks={mullPicks} playerBg={PClr[p.id].bg} playerFg={PClr[p.id].fg} />
                        ))
                    }
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Timing Tower view */}
      {activeView === "timing" && (
        <div style={{ background:C.card }}>
          <TimingTower timingData={timingData} weekPicks={weekPicks} />
        </div>
      )}

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity:1; transform:scale(1); }
          50% { opacity:0.4; transform:scale(1.3); }
        }
      `}</style>
    </div>
  );
}
