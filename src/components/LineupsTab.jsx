import { useState } from "react";
import { C, PClr, TTC, TTL, r, shadow } from "../theme";
import { PLAYERS, PNAME, SCHEDULE, ACTIVE_PICKS, MAX_MULLIGANS, TRACK_MULTS, isMemorial } from "../constants";

export function LineupsTab({ data, currentWeek }) {
  const [week, setWeek] = useState(currentWeek);
  const weekInfo    = SCHEDULE.find(s => s.w === week);
  const draftState  = data.drafts?.["w" + week] || [];
  const savedPicks  = data.picks?.["w" + week] || {};
  const hasScored   = !!(data.results?.["w" + week]?.scored);
  const scored      = data.results?.["w" + week]?.scored;

  const lineups = {};
  PLAYERS.forEach(p => { lineups[p.id] = []; });
  if (draftState.length > 0) {
    draftState.forEach(d => { if (lineups[d.pid]) lineups[d.pid].push(d.driver); });
  } else {
    PLAYERS.forEach(p => { lineups[p.id] = (savedPicks[p.id] || []).map(pk => pk.driver); });
  }

  const mullPicks = {};
  PLAYERS.forEach(p => {
    mullPicks[p.id] = (savedPicks[p.id] || []).filter(pk => pk.mulligan).map(pk => pk.driver);
  });

  const hasLineups  = PLAYERS.some(p => lineups[p.id].length > 0);
  const allComplete = PLAYERS.every(p => lineups[p.id].length >= ACTIVE_PICKS);

  // Build week list — only weeks with data or current
  const allWeeks = [];
  for (let w = 1; w <= 36; w++) {
    const hd = data.drafts?.["w"+w]?.length > 0;
    const hp = data.picks?.["w"+w] && Object.values(data.picks["w"+w]).some(pk => pk && pk.length > 0);
    if (hd || hp || w === currentWeek) allWeeks.push(w);
  }

  return (
    <div style={{ padding:20, maxWidth:900, margin:"0 auto", position:"relative", zIndex:1 }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
        <h2 style={{ color:C.text, fontFamily:"'Oswald',sans-serif", fontSize:26, letterSpacing:1, margin:0 }}>
          Lineups
        </h2>
        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
          {allWeeks.map(w => (
            <button key={w} onClick={() => setWeek(w)} style={{
              padding:"5px 10px", borderRadius:r.pill,
              border:`1px solid ${week === w ? C.accent : C.border}`,
              background:week === w ? C.accent : "transparent",
              color:week === w ? "#000" : C.dim,
              fontSize:11, fontWeight:700, cursor:"pointer",
              fontFamily:"'Oswald',sans-serif", letterSpacing:1,
              transition:"all 0.12s ease",
            }}>W{w}</button>
          ))}
        </div>
      </div>

      {/* ── Week info bar ────────────────────────────────────────────────────── */}
      {weekInfo && (
        <div style={{
          background:C.card, borderRadius:r.md, padding:"10px 16px", marginBottom:16,
          border:`1px solid ${C.border}`,
          display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8,
        }}>
          <div>
            <span style={{ color:C.text, fontWeight:700, fontSize:15 }}>{weekInfo.r}</span>
            <span style={{ color:C.dim, fontSize:12, marginLeft:8 }}>@ {weekInfo.t}</span>
          </div>
          <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
            <span style={{
              fontSize:11, fontWeight:700,
              color:TTC[weekInfo.ty], background:TTC[weekInfo.ty]+"18",
              padding:"3px 10px", borderRadius:r.pill, border:`1px solid ${TTC[weekInfo.ty]}44`,
            }}>
              {TTL[weekInfo.ty]} ×{TRACK_MULTS[weekInfo.ty]}
            </span>
            {hasScored && (
              <span style={{
                fontSize:10, fontWeight:700, color:"#10b981",
                background:"#10b98122", padding:"3px 8px", borderRadius:r.pill,
                border:"1px solid #10b98144", letterSpacing:1,
              }}>✓ SCORED</span>
            )}
            {!hasScored && allComplete && (
              <span style={{
                fontSize:10, fontWeight:700, color:C.accent,
                background:C.accent+"22", padding:"3px 8px", borderRadius:r.pill,
                border:`1px solid ${C.accent}44`, letterSpacing:1,
              }}>PICKS LOCKED</span>
            )}
            {!hasScored && !allComplete && hasLineups && (
              <span style={{
                fontSize:10, fontWeight:700, color:C.blue,
                background:C.blue+"22", padding:"3px 8px", borderRadius:r.pill,
                border:`1px solid ${C.blue}44`, letterSpacing:1,
              }}>DRAFT IN PROGRESS</span>
            )}
          </div>
        </div>
      )}

      {/* ── Lineup grid ─────────────────────────────────────────────────────── */}
      {!hasLineups
        ? (
          <div style={{
            background:C.card, borderRadius:r.xl, padding:"48px 32px",
            border:`1px solid ${C.border}`, textAlign:"center",
          }}>
            <div style={{ color:C.dim, fontSize:14 }}>No picks yet for Week {week}</div>
          </div>
        )
        : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12 }}>
            {PLAYERS.map(p => {
              const picks    = lineups[p.id] || [];
              const mulls    = mullPicks[p.id] || [];
              const mulLeft  = MAX_MULLIGANS - (data.meta.mulligansUsed[p.id] || 0);
              const mullCol  = mulLeft <= 1 ? "#ef4444" : mulLeft <= 5 ? "#f59e0b" : "#10b981";
              // If scored, get per-driver scores
              const driverScores = scored?.[p.id]?.drivers || [];

              return (
                <div key={p.id} style={{
                  background:PClr[p.id].bg, borderRadius:r.lg,
                  border:`2px solid ${PClr[p.id].bg==="#000000" ? C.border : PClr[p.id].bg+"66"}`,
                  overflow:"hidden",
                  boxShadow:shadow.card,
                }}>
                  {/* Player header */}
                  <div style={{
                    padding:"12px 14px",
                    borderBottom:`1px solid ${PClr[p.id].bg==="#000000" ? C.border : "rgba(0,0,0,0.2)"}`,
                    display:"flex", alignItems:"center", justifyContent:"space-between",
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{
                        width:34, height:34, borderRadius:"50%",
                        background:PClr[p.id].fg, color:PClr[p.id].bg,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontFamily:"'Oswald',sans-serif", fontSize:16, fontWeight:900,
                        flexShrink:0,
                      }}>
                        {PNAME[p.id][0]}
                      </div>
                      <div>
                        <div style={{
                          color:PClr[p.id].fg, fontFamily:"'Oswald',sans-serif",
                          fontSize:17, fontWeight:900, letterSpacing:0.5,
                        }}>
                          {PNAME[p.id].toUpperCase()}
                        </div>
                        <div style={{ color:PClr[p.id].fg+"66", fontSize:10 }}>
                          {picks.length}/{ACTIVE_PICKS} drivers ·{" "}
                          <span style={{ color:mullCol, fontWeight:700 }}>M:{mulLeft}</span>
                        </div>
                      </div>
                    </div>
                    {/* Week total if scored */}
                    {hasScored && scored?.[p.id] && (
                      <div style={{ textAlign:"right" }}>
                        <div style={{
                          fontFamily:"'Oswald',sans-serif", fontSize:22, fontWeight:900,
                          color:scored[p.id].weeklyWin ? C.accent : PClr[p.id].fg,
                          lineHeight:1,
                        }}>
                          {scored[p.id].weeklyWin && "👑 "}{scored[p.id].total}
                        </div>
                        <div style={{ color:PClr[p.id].fg+"55", fontSize:9, textTransform:"uppercase" }}>pts</div>
                      </div>
                    )}
                  </div>

                  {/* Driver list */}
                  <div style={{ padding:"8px 10px", display:"flex", flexDirection:"column", gap:3 }}>
                    {picks.length === 0
                      ? <div style={{ color:PClr[p.id].fg+"44", fontSize:12, fontStyle:"italic", textAlign:"center", padding:10 }}>
                          Waiting to pick…
                        </div>
                      : picks.map((driver, i) => {
                          const isMull  = mulls.includes(driver);
                          const dScore  = driverScores.find(d => d.driver === driver);
                          return (
                            <div key={i} style={{
                              display:"flex", alignItems:"center", gap:8, padding:"7px 10px",
                              background:PClr[p.id].bg==="#000000"
                                ? "rgba(255,255,255,0.05)"
                                : "rgba(0,0,0,0.15)",
                              borderRadius:r.sm,
                              borderLeft:`2px solid ${isMull ? "#f59e0b66" : PClr[p.id].fg+"22"}`,
                            }}>
                              <span style={{
                                fontSize:9, color:PClr[p.id].fg+"55",
                                fontWeight:700, width:22, flexShrink:0,
                              }}>R{i+1}</span>
                              <span style={{
                                fontSize:12, color:PClr[p.id].fg,
                                fontWeight:600, flex:1, lineHeight:1.2,
                              }}>
                                {driver}
                                {isMemorial(driver) && " 🕊️"}
                              </span>
                              <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
                                {isMull && (
                                  <span style={{
                                    fontSize:8, fontWeight:700, color:"#f59e0b",
                                    background:"#f59e0b22", padding:"1px 5px", borderRadius:r.pill,
                                  }}>MULL</span>
                                )}
                                {dScore != null && (
                                  <span style={{
                                    fontFamily:"'Oswald',sans-serif", fontSize:14, fontWeight:700,
                                    color:dScore.total > 0 ? "#10b981" : dScore.total < 0 ? "#ef4444" : PClr[p.id].fg+"88",
                                  }}>
                                    {dScore.total > 0 ? "+" : ""}{dScore.total}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                    }
                  </div>
                </div>
              );
            })}
          </div>
        )
      }
    </div>
  );
}
