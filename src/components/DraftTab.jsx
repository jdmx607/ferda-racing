import { useState, useMemo, useEffect, useRef } from "react";
import { C, PClr, PC, TTC, TTL, r, shadow } from "../theme";
import { PLAYERS, PNAME, SCHEDULE, DRIVERS, DRIVER_INFO, MAKE_COLORS, ACTIVE_PICKS, TRACK_MULTS, isMemorial } from "../constants";
import { getDraftOrder, buildSnakeOrder } from "../engine/draft";
import { analyzeLineups } from "../engine/draftAnalysis";
import { calcDriverScore } from "../engine/scoring";
import { notifyDraftTurn } from "../hooks/useNotifications";

const MAKE_BADGE = { Chevy:"#b8b8b8", Ford:"#4a90e2", Toyota:"#eb0a1e" };

const TIMER_12H = 12 * 3600 * 1000;
const TIMER_6H  =  6 * 3600 * 1000;

function fmtCountdown(msRemaining) {
  if (msRemaining <= 0) return "0m";
  const h = Math.floor(msRemaining / 3600000);
  const m = Math.floor((msRemaining % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Returns the best driver not yet drafted, ranked by total FERDA pts across all scored weeks
function getBestAvailableDriver(data, takenSet) {
  const totals = {};
  Object.entries(data.results || {}).forEach(([key, wr]) => {
    if (!wr.raw?.drivers) return;
    const week = parseInt(key.replace("w", ""));
    const ty   = SCHEDULE.find(s => s.w === week)?.ty || "intermediate";
    const three = !!wr.raw.threeStages;
    wr.raw.drivers.forEach(d => {
      if (!totals[d.name]) totals[d.name] = 0;
      totals[d.name] += calcDriverScore(d, ty, false, three).total;
    });
  });
  return DRIVERS
    .filter(d => !takenSet.has(d) && !isMemorial(d) && (totals[d] ?? 0) > 0)
    .sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0))[0]
    ?? DRIVERS.find(d => !takenSet.has(d) && !isMemorial(d))
    ?? null;
}

function DriverButton({ d, onPick, disabled }) {
  const mem  = isMemorial(d);
  const info = DRIVER_INFO[d] || {};
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={() => !mem && onPick(d)}
      disabled={mem || disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        textAlign:"left", padding:"9px 11px", borderRadius:r.sm,
        background: mem ? C.card+"66" : hov && !disabled ? C.cardAlt : C.card,
        border:`1px solid ${mem ? C.border+"44" : hov && !disabled ? C.accent+"66" : C.border}`,
        color: mem ? C.muted : C.text,
        fontSize:12, cursor: mem || disabled ? "not-allowed" : "pointer",
        fontFamily:"inherit", transition:"all 0.12s ease",
        opacity: mem ? 0.55 : 1,
      }}
    >
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:4 }}>
        <span style={{ fontWeight:700, fontSize:13, lineHeight:1.2 }}>{d}</span>
        {mem && <span style={{ fontSize:11, color:C.accent, flexShrink:0 }}>🕊️</span>}
      </div>
      {info.team && (
        <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:3 }}>
          <span style={{ fontSize:9, color:C.dim }}>{info.team}</span>
          {info.make && (
            <span style={{
              fontSize:8, fontWeight:700, letterSpacing:0.5,
              color:MAKE_BADGE[info.make], background:MAKE_BADGE[info.make]+"22",
              padding:"1px 5px", borderRadius:r.pill,
            }}>{info.make}</span>
          )}
        </div>
      )}
    </button>
  );
}

export function DraftTab({ player, data, onDraftPick, onUndoDraft, onReminderSent, currentWeek }) {
  const [search,  setSearch]  = useState("");
  const [undoMsg, setUndoMsg] = useState("");
  const [now,     setNow    ] = useState(() => Date.now());
  const autopickFiredRef = useRef(false);
  const reminderFiredRef = useRef(false);

  const weekInfo      = SCHEDULE.find(s => s.w === currentWeek);
  const draftKey      = "w" + currentWeek;
  const draftOrder    = useMemo(() => getDraftOrder(data, currentWeek),  [data, currentWeek]);
  const snakeSequence = useMemo(() => buildSnakeOrder(draftOrder), [draftOrder]);
  const draftState    = data.drafts?.[draftKey] || [];
  const currentPickNum = draftState.length;
  const draftComplete  = currentPickNum >= snakeSequence.length;
  const currentTurn    = !draftComplete ? snakeSequence[currentPickNum] : null;
  const isMyTurn       = currentTurn?.pid === player.id;

  const takenDrivers = new Set(draftState.map(d => d.driver));
  const available    = DRIVERS.filter(d =>
    !takenDrivers.has(d) && d.toLowerCase().includes(search.toLowerCase())
  );

  const playerPicks = {};
  PLAYERS.forEach(p => { playerPicks[p.id] = []; });
  draftState.forEach(d => { if (playerPicks[d.pid]) playerPicks[d.pid].push(d.driver); });

  // Post-draft analysis — computed once draft is locked
  const savedPicks = data.picks?.[draftKey] || {};
  const picksForAnalysis = draftComplete ? playerPicks : savedPicks;
  const analysis = useMemo(() => {
    if (!draftComplete) return null;
    // Build picks shape for analyzeLineups: {pid: [{driver, mulligan}]}
    const wp = {};
    PLAYERS.forEach(p => { wp[p.id] = (picksForAnalysis[p.id] || []).map(d => typeof d === "string" ? { driver:d, mulligan:false } : d); });
    return analyzeLineups(wp, currentWeek, data);
  }, [draftComplete, currentWeek, data]);

  const handlePick = (driver) => {
    if (!isMyTurn || draftComplete || isMemorial(driver)) return;
    if (!window.confirm(`Lock in ${driver}?`)) return;
    onDraftPick(currentWeek, player.id, driver, currentPickNum);
    setSearch("");
  };

  // ── Timer: tick every 30s ────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Reset fired refs when the current pick slot changes
  useEffect(() => {
    autopickFiredRef.current = false;
    reminderFiredRef.current = false;
  }, [currentPickNum, draftKey]);

  const timerMeta   = data.draftTimers?.[draftKey];
  const msElapsed   = timerMeta?.startedAt ? now - new Date(timerMeta.startedAt).getTime() : null;
  const msRemaining = msElapsed !== null ? Math.max(0, TIMER_12H - msElapsed) : null;
  const timerExpired = msElapsed !== null && msElapsed >= TIMER_12H;

  // ── Autopick / 6hr reminder ──────────────────────────────────────────────────
  useEffect(() => {
    if (!timerMeta?.startedAt || !currentTurn || draftComplete) return;
    const elapsed = now - new Date(timerMeta.startedAt).getTime();

    if (elapsed >= TIMER_12H && !autopickFiredRef.current) {
      autopickFiredRef.current = true;
      const best = getBestAvailableDriver(data, takenDrivers);
      if (best) onDraftPick(currentWeek, currentTurn.pid, best, currentPickNum);
      return;
    }

    if (elapsed >= TIMER_6H && !reminderFiredRef.current && !timerMeta.reminderSent) {
      reminderFiredRef.current = true;
      onReminderSent?.(currentWeek);
      const ri = SCHEDULE.find(s => s.w === currentWeek);
      notifyDraftTurn(currentTurn.pid, data.playerSettings, {
        week: currentWeek, pickNumber: currentPickNum + 1,
        totalPicks: snakeSequence.length, raceName: ri?.r || "Draft",
      }).catch(() => {});
    }
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ padding:20, maxWidth:900, margin:"0 auto", position:"relative", zIndex:1 }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom:16 }}>
        <h2 style={{ color:C.text, fontFamily:"'Oswald',sans-serif", fontSize:26, letterSpacing:1, margin:0 }}>
          Week {currentWeek} Draft
        </h2>
        {weekInfo && (
          <div style={{ color:C.dim, fontSize:13, marginTop:4 }}>
            {weekInfo.r} — {weekInfo.t} —{" "}
            <span style={{ color:TTC[weekInfo.ty], fontWeight:700 }}>
              {TTL[weekInfo.ty]} ×{TRACK_MULTS[weekInfo.ty]}
            </span>
          </div>
        )}
      </div>

      {/* ── Status banner ───────────────────────────────────────────────────── */}
      {draftComplete ? (
        <div style={{
          background:C.accent+"18", borderRadius:r.md, padding:"14px 18px", marginBottom:16,
          border:`1px solid ${C.accent}44`, textAlign:"center",
        }}>
          <div style={{ color:C.accent, fontFamily:"'Oswald',sans-serif", fontSize:18, fontWeight:700 }}>
            🏁 Draft Complete — All picks locked for W{currentWeek}
          </div>
        </div>
      ) : (
        <div style={{
          background: isMyTurn ? "#10b98122" : C.card,
          borderRadius:r.md, padding:"14px 18px", marginBottom:16,
          border:`2px solid ${isMyTurn ? "#10b981" : C.border}`,
          display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10,
          boxShadow: isMyTurn ? shadow.glow("#10b981") : "none",
        }}>
          <div>
            <div style={{
              fontFamily:"'Oswald',sans-serif", fontSize:20, fontWeight:900,
              color: isMyTurn ? "#10b981" : PC[currentTurn?.pid],
              letterSpacing:1,
            }}>
              {isMyTurn ? "⬆ YOUR PICK!" : `${PNAME[currentTurn?.pid]}'s Turn`}
            </div>
            <div style={{ color:C.dim, fontSize:12, marginTop:3 }}>
              Pick {currentPickNum + 1} of {snakeSequence.length} · Round {currentTurn?.round}
              {currentTurn?.round === ACTIVE_PICKS && (
                <span style={{ color:C.accent, fontWeight:700, marginLeft:6 }}>FINAL ROUND</span>
              )}
            </div>
          </div>
          {!isMyTurn && (
            <div style={{ textAlign:"right" }}>
              <div style={{ color:C.dim, fontSize:12 }}>
                Waiting for <span style={{ color:PC[currentTurn?.pid], fontWeight:700 }}>{PNAME[currentTurn?.pid]}</span>…
              </div>
              {timerExpired ? (
                <div style={{ color:C.accent, fontSize:11, fontWeight:700, marginTop:4 }}>
                  ⏳ Auto-picking…
                </div>
              ) : msRemaining !== null && (
                <div style={{
                  fontSize:10, marginTop:4, fontFamily:"'Oswald',sans-serif", letterSpacing:1,
                  color: msRemaining < 2*3600000 ? C.red : msRemaining < 6*3600000 ? C.accent : C.muted,
                }}>
                  ⏱ {fmtCountdown(msRemaining)} left
                </div>
              )}
            </div>
          )}
          {isMyTurn && msRemaining !== null && !timerExpired && (
            <div style={{
              fontSize:10, fontFamily:"'Oswald',sans-serif", letterSpacing:1,
              color: msRemaining < 2*3600000 ? C.red : msRemaining < 6*3600000 ? C.accent : C.muted,
              padding:"4px 10px", borderRadius:r.pill,
              background: msRemaining < 2*3600000 ? C.red+"15" : "transparent",
              border:`1px solid ${msRemaining < 2*3600000 ? C.red+"44" : "transparent"}`,
            }}>
              ⏱ {fmtCountdown(msRemaining)} to auto-pick
            </div>
          )}
        </div>
      )}

      {/* ── Draft order + pick boards ────────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:20 }}>
        {draftOrder.map((pid, i) => {
          const picks  = playerPicks[pid] || [];
          const isCur  = currentTurn?.pid === pid;
          return (
            <div key={pid} style={{
              background:PClr[pid].bg, borderRadius:r.md,
              border:`2px solid ${isCur ? PClr[pid].fg : PClr[pid].bg==="#000000" ? C.border : PClr[pid].bg+"55"}`,
              overflow:"hidden",
              boxShadow: isCur ? shadow.glow(PClr[pid].fg) : "none",
              transition:"all 0.2s ease",
            }}>
              {/* Player header */}
              <div style={{
                padding:"8px 10px",
                background: isCur ? PClr[pid].fg+"18" : "transparent",
                borderBottom:`1px solid ${PClr[pid].bg==="#000000" ? C.border : "rgba(0,0,0,0.2)"}`,
                display:"flex", alignItems:"center", justifyContent:"space-between",
              }}>
                <div>
                  <div style={{ color:PClr[pid].fg, fontWeight:700, fontSize:13, fontFamily:"'Oswald',sans-serif", letterSpacing:0.5 }}>
                    {PNAME[pid]}
                  </div>
                  <div style={{ color:PClr[pid].fg+"66", fontSize:9 }}>#{i+1} · {picks.length}/{ACTIVE_PICKS}</div>
                </div>
                {isCur && (
                  <div style={{
                    width:8, height:8, borderRadius:"50%",
                    background:PClr[pid].fg,
                    animation:"pulse 1.5s ease-in-out infinite",
                  }}/>
                )}
              </div>

              {/* Pick slots */}
              <div style={{ padding:"6px 8px", display:"flex", flexDirection:"column", gap:3 }}>
                {Array.from({ length:ACTIVE_PICKS }).map((_, si) => {
                  const driver = picks[si];
                  return (
                    <div key={si} style={{
                      padding:"5px 8px", borderRadius:r.sm,
                      background: driver
                        ? (PClr[pid].bg==="#000000" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.2)")
                        : "rgba(0,0,0,0.12)",
                      minHeight:26, display:"flex", alignItems:"center", gap:6,
                    }}>
                      <span style={{ fontSize:9, color:PClr[pid].fg+"55", fontWeight:700, width:20, flexShrink:0 }}>
                        R{si+1}
                      </span>
                      <span style={{ fontSize:11, color:driver ? PClr[pid].fg : PClr[pid].fg+"33", lineHeight:1.2 }}>
                        {driver || "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Driver picker (only on your turn) ────────────────────────────────── */}
      {isMyTurn && !draftComplete && (
        <div style={{ marginBottom:20 }}>
          <div style={{ color:C.textDim, fontSize:11, textTransform:"uppercase", letterSpacing:2, fontWeight:700, marginBottom:8 }}>
            Select a Driver
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or number…"
            autoFocus
            style={{
              width:"100%", padding:"12px 16px", borderRadius:r.md,
              border:`1px solid ${C.accent}55`,
              background:C.input, color:C.text,
              fontSize:14, fontFamily:"inherit", outline:"none",
              boxSizing:"border-box", marginBottom:10,
              boxShadow:shadow.glow(C.accent),
            }}
          />
          <div style={{
            maxHeight:340, overflowY:"auto",
            display:"grid", gridTemplateColumns:"1fr 1fr",
            gap:4,
          }}>
            {available.length === 0
              ? <div style={{ gridColumn:"1/-1", color:C.dim, textAlign:"center", padding:20 }}>No drivers match</div>
              : available.map(d => (
                  <DriverButton key={d} d={d} onPick={handlePick} disabled={false} />
                ))
            }
          </div>
        </div>
      )}

      {/* ── Pick log ────────────────────────────────────────────────────────── */}
      {draftState.length > 0 && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <div style={{ color:C.textDim, fontSize:11, textTransform:"uppercase", letterSpacing:2, fontWeight:700 }}>
              Pick Log
            </div>
            {player.id === "justin" && !draftComplete && (
              <button
                onClick={async () => {
                  const last = draftState[draftState.length - 1];
                  if (!window.confirm(`Undo last pick by ${PNAME[last.pid]} (${last.driver})?`)) return;
                  const removed = await onUndoDraft(currentWeek);
                  if (removed) setUndoMsg(`Undid ${PNAME[removed.pid]}'s pick: ${removed.driver}`);
                  setTimeout(() => setUndoMsg(""), 3000);
                }}
                style={{
                  padding:"5px 12px", borderRadius:r.pill,
                  border:`1px solid ${C.red}66`, background:C.red+"11",
                  color:C.red, fontSize:11, cursor:"pointer",
                  fontFamily:"inherit", fontWeight:700,
                }}
              >
                ↩ Undo Last Pick
              </button>
            )}
          </div>
          {undoMsg && (
            <div style={{ color:C.accent, fontSize:12, marginBottom:8, textAlign:"center" }}>{undoMsg}</div>
          )}
          <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
            {[...draftState].reverse().map((d, i) => (
              <div key={i} style={{
                display:"flex", alignItems:"center", gap:10, padding:"8px 12px",
                background:C.card, borderRadius:r.sm,
                border:`1px solid ${C.border}`,
                borderLeft:`3px solid ${PClr[d.pid].fg}55`,
              }}>
                <span style={{ fontSize:10, color:C.muted, width:26, flexShrink:0, fontFamily:"'Oswald',sans-serif" }}>
                  #{draftState.length - i}
                </span>
                <div style={{
                  width:6, height:6, borderRadius:"50%",
                  background:PClr[d.pid].fg, flexShrink:0,
                }}/>
                <span style={{ fontSize:12, color:PClr[d.pid].fg, fontWeight:700, width:90, flexShrink:0 }}>
                  {PNAME[d.pid]}
                </span>
                <span style={{ fontSize:12, color:C.text, flex:1 }}>{d.driver}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Post-draft lineup analysis ────────────────────────────────────────── */}
      {draftComplete && analysis && (
        <div style={{ marginTop:24 }}>
          {/* Header */}
          <div style={{
            background:`linear-gradient(135deg,#001a10,${C.bg})`,
            borderRadius:`${r.lg}px ${r.lg}px 0 0`,
            padding:"16px 20px",
            border:`1px solid ${TTC[analysis.trackType]}44`,
            borderBottom:"none",
            boxShadow:shadow.glow(TTC[analysis.trackType]),
          }}>
            <div style={{ color:TTC[analysis.trackType], fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:4 }}>
              📊 Lineup Analysis — W{analysis.week}
            </div>
            <div style={{ color:C.text, fontFamily:"'Oswald',sans-serif", fontSize:18, fontWeight:900, letterSpacing:1 }}>
              {analysis.raceName}
            </div>
            <div style={{ color:C.muted, fontSize:11, marginTop:3 }}>
              @ {analysis.trackName} · Based on {analysis.racesOfType} {TTL[analysis.trackType]} race{analysis.racesOfType!==1?"s":""} this season
            </div>
          </div>

          {/* Overall ranking */}
          <div style={{
            background:C.card, border:`1px solid ${C.border}`,
            borderTop:"none", padding:"14px 20px",
          }}>
            <div style={{ color:C.muted, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>
              Projected Ranking (avg pts at this track type)
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {analysis.lineups.map((p, i) => {
                const barW = analysis.maxProjected > 0 ? (p.projectedTotal / analysis.maxProjected) * 100 : 0;
                const isFirst = i === 0;
                return (
                  <div key={p.id}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
                      <span style={{
                        fontFamily:"'Oswald',sans-serif", fontSize:16, fontWeight:900,
                        color:isFirst ? C.accent : C.muted,
                        width:22, flexShrink:0,
                      }}>{i+1}</span>
                      <div style={{
                        width:28, height:28, borderRadius:"50%", flexShrink:0,
                        background:PClr[p.id].bg, border:`2px solid ${PClr[p.id].fg}44`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontFamily:"'Oswald',sans-serif", fontSize:12, fontWeight:900,
                        color:PClr[p.id].fg,
                      }}>{PNAME[p.id][0]}</div>
                      <span style={{ color:PClr[p.id].fg === "#AA0000" ? C.text : PClr[p.id].fg, fontWeight:700, fontSize:14, flex:1 }}>
                        {PNAME[p.id]}
                        {isFirst && <span style={{ color:C.accent, fontSize:10, marginLeft:8 }}>PAPER FAVORITE</span>}
                      </span>
                      <span style={{
                        fontFamily:"'Oswald',sans-serif", fontSize:18, fontWeight:900,
                        color:isFirst ? C.accent : C.text,
                      }}>{p.projectedTotal}</span>
                    </div>
                    <div style={{ marginLeft:60, height:5, background:C.border, borderRadius:r.pill, overflow:"hidden" }}>
                      <div style={{
                        height:"100%", width:`${barW}%`,
                        background:isFirst ? C.accent : PClr[p.id].fg,
                        opacity:0.75, transition:"width 0.6s ease",
                      }}/>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ color:C.muted, fontSize:10, marginTop:10 }}>
              Mulliganed drivers discounted ~60% (finish pts only). Projected ≠ actual — just historical avg.
            </div>
          </div>

          {/* Per-player driver breakdown */}
          <div style={{
            display:"grid", gridTemplateColumns:"repeat(2,1fr)",
            gap:1, border:`1px solid ${C.border}`,
            borderTop:"none",
            borderRadius:`0 0 ${r.lg}px ${r.lg}px`, overflow:"hidden",
          }}>
            {analysis.lineups.map((p, idx) => {
              const maxAvg = p.drivers[0]?.avgScore || 1;
              return (
                <div key={p.id} style={{
                  background:PClr[p.id].bg, padding:"12px 14px",
                  borderRight: idx % 2 === 0 ? `1px solid ${C.border}` : "none",
                }}>
                  <div style={{ color:PClr[p.id].fg, fontFamily:"'Oswald',sans-serif", fontSize:14, fontWeight:900, letterSpacing:0.5, marginBottom:8 }}>
                    {PNAME[p.id].toUpperCase()}
                    <span style={{ color:PClr[p.id].fg+"66", fontSize:9, fontWeight:400, marginLeft:6 }}>
                      {p.projectedTotal} proj
                    </span>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    {p.drivers.map(d => (
                      <div key={d.driver} style={{
                        display:"flex", alignItems:"center", gap:6, padding:"5px 8px",
                        background:PClr[p.id].bg==="#000000"?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.15)",
                        borderRadius:r.sm,
                      }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ color:PClr[p.id].fg, fontSize:11, fontWeight:700,
                            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                          }}>
                            {d.driver}{d.isMulligan?" 🔄":""}
                          </div>
                          {/* Mini bar */}
                          <div style={{ height:2, background:C.border+"55", borderRadius:r.pill, marginTop:3 }}>
                            <div style={{
                              height:"100%",
                              width:`${maxAvg>0?(d.avgScore/maxAvg)*100:0}%`,
                              background:PClr[p.id].fg, opacity:0.6,
                            }}/>
                          </div>
                        </div>
                        <div style={{ textAlign:"right", flexShrink:0 }}>
                          <span style={{
                            fontFamily:"'Oswald',sans-serif", fontSize:13, fontWeight:700,
                            color:d.avgScore>=40?C.accent:d.avgScore>=20?C.green:PClr[p.id].fg+"88",
                          }}>
                            {d.avgScore>0?d.avgScore:"—"}
                          </span>
                          {d.appearances>0&&<div style={{ color:PClr[p.id].fg+"44", fontSize:8 }}>{d.appearances}r avg</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Top 3 left on the board */}
          {analysis.top3Available?.length > 0 && (
            <div style={{
              marginTop:8, background:C.card, borderRadius:r.md, padding:"12px 16px",
              border:`1px solid ${C.border}`,
            }}>
              <div style={{ color:C.muted, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:1.5, marginBottom:10 }}>
                🔥 Best Drivers Left on the Board
              </div>
              {analysis.top3Available.map((d, i) => (
                <div key={d.name} style={{
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"8px 0",
                  borderBottom: i < analysis.top3Available.length - 1 ? `1px solid ${C.border}` : "none",
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{
                      width:24, height:24, borderRadius:"50%", flexShrink:0,
                      background: i === 0 ? C.accent+"22" : "transparent",
                      border:`1px solid ${i === 0 ? C.accent : C.border}`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontFamily:"'Oswald',sans-serif", fontSize:12, fontWeight:700,
                      color: i === 0 ? C.accent : C.muted,
                    }}>{i + 1}</div>
                    <div>
                      <div style={{ color: i === 0 ? C.text : C.textDim, fontWeight: i === 0 ? 700 : 400, fontSize:13 }}>
                        {d.name}
                      </div>
                      <div style={{ color:C.muted, fontSize:10, marginTop:1 }}>
                        {d.appearances} race{d.appearances!==1?"s":""} at {TTL[analysis.trackType]}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{
                      fontFamily:"'Oswald',sans-serif", fontWeight:900,
                      fontSize: i === 0 ? 24 : 18,
                      color: i === 0 ? C.accent : C.text,
                    }}>
                      {d.avgScore}
                    </div>
                    <div style={{ color:C.muted, fontSize:9, textTransform:"uppercase" }}>avg pts</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No track data yet */}
      {draftComplete && !analysis && (
        <div style={{
          marginTop:16, background:C.card, borderRadius:r.md, padding:"14px 18px",
          border:`1px solid ${C.border}`, color:C.dim, fontSize:13, textAlign:"center",
        }}>
          📊 Lineup analysis will be available once we have results from this track type.
        </div>
      )}
    </div>
  );
}
