import { useState, useMemo } from "react";
import { C, PClr, TTC, TTL, r, shadow } from "../theme";
import { PNAME, SCHEDULE, TRACK_MULTS, isMemorial } from "../constants";
import { getWeekTopDrivers, generateWeekRecap } from "../engine/stats";

const BONUS_CHIP = {
  "Top 5":    "#10b981", "Top 10":   "#10b981",
  "Pole":     "#f59e0b", "S1 Win":   "#f59e0b", "S2 Win": "#f59e0b", "S3 Win": "#f59e0b",
  "Fast Lap": "#8b5cf6", "Most Led": "#3b82f6",
  "SWEEP!":   "#f59e0b", "Led a lap":"#475569",
  "DNF":      "#94a3b8", "DQ":       "#ef4444",
};

function ScoreChip({ label, pts }) {
  const col = BONUS_CHIP[label] || (pts > 0 ? "#10b981" : pts < 0 ? "#ef4444" : "#475569");
  const short = label === "SWEEP!" ? "💫 SWEEP" : label;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:3,
      fontSize:9, fontWeight:700, letterSpacing:0.5,
      color:col, background:col+"20",
      padding:"2px 6px", borderRadius:r.pill,
      border:`1px solid ${col}44`,
    }}>
      {short}
      {pts !== 0 && <span style={{ opacity:0.85 }}>{pts > 0 ? "+" : ""}{pts}</span>}
    </span>
  );
}

function DriverResultRow({ d, playerBg, playerFg }) {
  const isNeg = d.total < 0;
  const isBig = d.total >= 40;
  return (
    <div style={{
      padding:"10px 12px",
      background: playerBg === "#000000" ? "#111827" : "rgba(0,0,0,0.2)",
      borderRadius:r.sm,
      borderLeft:`3px solid ${isBig ? "#f59e0b88" : d.total > 0 ? playerFg+"44" : "#ef444444"}`,
      display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8,
    }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
          <span style={{
            color:d.dnr ? playerFg+"55" : playerFg,
            fontWeight:700, fontSize:13,
            fontFamily:"'Barlow Condensed',sans-serif",
          }}>
            {d.driver}
            {isMemorial(d.driver) && " 🕊️"}
            {d.isMulligan && <span style={{ fontSize:9, color:"#f59e0b", marginLeft:4 }}>MULL</span>}
            {d.dnr && <span style={{ fontSize:9, color:playerFg+"66", marginLeft:4 }}>DNR</span>}
          </span>
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginTop:4 }}>
          {(d.breakdown || []).map((b, i) => <ScoreChip key={i} label={b.label} pts={b.pts} />)}
        </div>
      </div>
      <div style={{
        fontFamily:"'Oswald',sans-serif", fontSize:22, fontWeight:900,
        color: d.total >= 0 ? (isBig ? "#f59e0b" : "#10b981") : "#ef4444",
        lineHeight:1, flexShrink:0,
      }}>
        {d.total > 0 ? "+" : ""}{d.total}
      </div>
    </div>
  );
}

export function ResultsTab({ data }) {
  const weeks = Object.keys(data.results || {})
    .map(k => parseInt(k.replace("w","")))
    .sort((a, b) => b - a);
  const [week, setWeek] = useState(weeks[0] || 1);

  const wr       = data.results?.["w" + week];
  const weekInfo = SCHEDULE.find(s => s.w === week);
  const sorted   = wr?.scored ? Object.entries(wr.scored).sort((a, b) => b[1].total - a[1].total) : [];
  const winner   = sorted[0]?.[0];
  const loser    = sorted[sorted.length - 1]?.[0];

  // Top performers (all drivers, not just picked ones)
  const topDrivers = useMemo(() => {
    if (!wr?.raw?.drivers) return [];
    return getWeekTopDrivers(wr.raw, week, 5);
  }, [wr, week]);

  // Who picked each driver this week
  const weekPicks = data.picks?.["w" + week] || {};
  const pickerMap = useMemo(() => {
    const m = {};
    Object.entries(weekPicks).forEach(([pid, picks]) => {
      (picks || []).forEach(pk => {
        if (pk.driver) {
          if (!m[pk.driver]) m[pk.driver] = [];
          m[pk.driver].push(pid);
        }
      });
    });
    return m;
  }, [weekPicks]);

  // Recap blurb
  const recap = useMemo(() => {
    if (!wr?.scored || !wr?.raw) return null;
    return generateWeekRecap(week, wr.scored, wr.raw);
  }, [wr, week]);

  return (
    <div style={{ padding:20, maxWidth:900, margin:"0 auto", position:"relative", zIndex:1 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:12 }}>
        <h2 style={{ color:C.text, fontFamily:"'Oswald',sans-serif", fontSize:26, margin:0, letterSpacing:1 }}>
          Results
        </h2>
        {/* Week chips — scrollable row */}
        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
          {weeks.map(w => (
            <button key={w} onClick={() => setWeek(w)} style={{
              padding:"5px 10px", borderRadius:r.pill,
              border:`1px solid ${week === w ? C.accent : C.border}`,
              background: week === w ? C.accent : "transparent",
              color: week === w ? "#000" : C.dim,
              fontSize:11, fontWeight:700, cursor:"pointer",
              fontFamily:"'Oswald',sans-serif", letterSpacing:1,
              transition:"all 0.15s ease",
            }}>
              W{w}
            </button>
          ))}
        </div>
      </div>

      {/* ── Track info bar ─────────────────────────────────────────────────── */}
      {weekInfo && (
        <div style={{
          background:C.card, borderRadius:r.md, padding:"12px 16px", marginBottom:16,
          border:`1px solid ${TTC[weekInfo.ty]}44`,
          display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8,
        }}>
          <div>
            <div style={{ color:C.text, fontWeight:700, fontSize:16 }}>{weekInfo.r}</div>
            <div style={{ color:C.dim, fontSize:12, marginTop:2 }}>@ {weekInfo.t}</div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            {wr?.raw?.threeStages && (
              <span style={{
                fontSize:10, fontWeight:700, color:C.purple,
                background:C.purple+"22", padding:"3px 8px", borderRadius:r.pill,
                border:`1px solid ${C.purple}44`, letterSpacing:1,
              }}>
                3 STAGES
              </span>
            )}
            <span style={{
              fontSize:11, fontWeight:700,
              color:TTC[weekInfo.ty], background:TTC[weekInfo.ty]+"18",
              padding:"4px 10px", borderRadius:r.pill,
              border:`1px solid ${TTC[weekInfo.ty]}44`,
            }}>
              {TTL[weekInfo.ty]} ×{TRACK_MULTS[weekInfo.ty]}
            </span>
          </div>
        </div>
      )}

      {/* ── Result cards ───────────────────────────────────────────────────── */}
      {sorted.length === 0
        ? <div style={{ color:C.dim, textAlign:"center", padding:48, fontSize:14 }}>No results for this week</div>
        : <div style={{ display:"grid", gap:12 }}>
            {sorted.map(([pid, ps], idx) => {
              const isWinner = idx === 0 && sorted.length > 1;
              const isLoser  = idx === sorted.length - 1 && sorted.length === 4;
              return (
                <div key={pid} style={{
                  background:PClr[pid].bg, borderRadius:r.lg,
                  border:`2px solid ${isWinner ? "#f59e0b" : PClr[pid].bg==="#000000" ? C.border : PClr[pid].bg+"66"}`,
                  overflow:"hidden",
                  boxShadow: isWinner ? `0 0 20px #f59e0b44` : shadow.card,
                }}>

                  {/* Player header */}
                  <div style={{ padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{
                        fontSize:24, width:32, textAlign:"center", flexShrink:0,
                      }}>
                        {isWinner ? "👑" : isLoser ? "💩" : ""}
                      </div>
                      <div>
                        <div style={{
                          color:PClr[pid].fg, fontFamily:"'Oswald',sans-serif",
                          fontSize:22, fontWeight:900, letterSpacing:1, lineHeight:1,
                        }}>
                          {PNAME[pid].toUpperCase()}
                        </div>
                        <div style={{ display:"flex", gap:6, marginTop:4, flexWrap:"wrap" }}>
                          {ps.weeklyWin && (
                            <span style={{
                              fontSize:9, fontWeight:700, color:C.accent,
                              background:C.accent+"22", padding:"2px 8px", borderRadius:r.pill,
                              border:`1px solid ${C.accent}44`, letterSpacing:1,
                            }}>
                              WEEKLY WIN +25 PO
                            </span>
                          )}
                          {ps.bonusPoints > 0 && (
                            <span style={{
                              fontSize:9, color:C.dim,
                              padding:"2px 6px", borderRadius:r.pill,
                            }}>
                              {ps.bonusPoints} bonus pts
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{
                        fontFamily:"'Oswald',sans-serif", fontSize:40, fontWeight:900, lineHeight:1,
                        color: isWinner ? C.accent : PClr[pid].fg,
                      }}>
                        {ps.total}
                      </div>
                      <div style={{ color:PClr[pid].fg+"55", fontSize:9, textTransform:"uppercase", letterSpacing:1 }}>pts</div>
                    </div>
                  </div>

                  {/* Driver rows */}
                  {ps.drivers && ps.drivers.length > 0 && (
                    <div style={{
                      padding:"0 10px 10px",
                      display:"flex", flexDirection:"column", gap:4,
                    }}>
                      {ps.drivers
                        .slice()
                        .sort((a, b) => b.total - a.total)
                        .map(d => (
                          <DriverResultRow
                            key={d.driver}
                            d={d}
                            playerBg={PClr[pid].bg}
                            playerFg={PClr[pid].fg}
                          />
                        ))
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>
      }

      {/* ── Recap blurb ─────────────────────────────────────────────────────── */}
      {recap && (
        <div style={{
          marginTop:16, background:C.card, borderRadius:r.md, padding:"12px 16px",
          border:`1px solid ${C.border}`,
          color:C.dim, fontSize:13, lineHeight:1.6,
        }}>
          <span style={{ color:C.accent, fontWeight:700 }}>W{week} recap —</span>{" "}
          <span style={{ color:C.text, fontWeight:700 }}>{PNAME[recap.winnerPid]}</span>{" "}
          wins with <span style={{ color:C.text, fontWeight:700 }}>{recap.winnerScore} pts</span>
          {recap.hadWinner && <span> (had race winner {recap.raceWinner})</span>}.{" "}
          {recap.mvpDriver && (
            <>
              <span style={{ color:C.text }}>{recap.mvpDriver}</span>{" "}
              scored <span style={{ color:recap.mvpWasPicked ? C.green : C.red, fontWeight:700 }}>{recap.mvpScore} pts</span>{" "}
              — {recap.mvpWasPicked
                ? <span style={{ color:C.green }}>someone cashed in ✓</span>
                : <span style={{ color:C.red }}>nobody had them 😤</span>
              }.
            </>
          )}
        </div>
      )}

      {/* ── Top performers this week ─────────────────────────────────────────── */}
      {topDrivers.length > 0 && (
        <div style={{ marginTop:16 }}>
          <div style={{
            color:C.textDim, fontSize:11, fontWeight:700,
            textTransform:"uppercase", letterSpacing:2, marginBottom:10,
          }}>
            Top Performers This Week
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            {topDrivers.map((d, i) => {
              const pickers   = pickerMap[d.name] || [];
              const wasPicked = pickers.length > 0;
              return (
                <div key={d.name} style={{
                  display:"flex", alignItems:"center", gap:10, padding:"9px 14px",
                  background: i === 0 ? C.accent+"0f" : C.card,
                  borderRadius:r.sm,
                  border:`1px solid ${i === 0 ? C.accent+"44" : wasPicked ? C.border : C.red+"22"}`,
                }}>
                  <span style={{
                    color:i === 0 ? C.accent : C.muted,
                    fontFamily:"'Oswald',sans-serif", fontSize:13, fontWeight:700, width:24, flexShrink:0,
                  }}>{i + 1}</span>
                  <span style={{ color:C.text, fontWeight:700, fontSize:13, flex:1 }}>
                    {d.name}
                    {i === 0 && <span style={{ marginLeft:6, fontSize:11 }}>👑</span>}
                  </span>
                  <span style={{
                    fontFamily:"'Oswald',sans-serif", fontSize:18, fontWeight:900,
                    color:i === 0 ? C.accent : C.text, flexShrink:0,
                  }}>+{d.total}</span>
                  {wasPicked ? (
                    <div style={{ display:"flex", gap:3, flexShrink:0 }}>
                      {pickers.map(pid => (
                        <div key={pid} style={{
                          width:20, height:20, borderRadius:"50%",
                          background:PClr[pid].fg, border:`2px solid ${PClr[pid].bg === "#000000" ? "#ffffff33" : PClr[pid].bg}`,
                          title:PNAME[pid],
                        }}/>
                      ))}
                    </div>
                  ) : (
                    <span style={{
                      fontSize:9, fontWeight:700, color:C.red,
                      background:C.red+"18", padding:"2px 7px", borderRadius:r.pill,
                      border:`1px solid ${C.red}33`, flexShrink:0, letterSpacing:0.5,
                    }}>MISSED 😤</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
