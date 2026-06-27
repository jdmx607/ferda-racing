import { useMemo } from "react";
import { C, PClr, r, shadow } from "../theme";
import { PLAYERS, PNAME, PLAYOFF_START_WEEK, REG_SEASON_CHAMP_BONUS } from "../constants";

function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ height:4, background:"rgba(0,0,0,0.3)", borderRadius:r.pill, overflow:"hidden" }}>
      <div style={{
        height:"100%", width:`${pct}%`,
        background:color, opacity:0.8,
        borderRadius:r.pill, transition:"width 0.8s ease",
      }}/>
    </div>
  );
}

export function PlayoffsTab({ data }) {
  const scored        = Object.keys(data.results || {}).length;
  const weeksLeft     = Math.max(0, PLAYOFF_START_WEEK - 1 - scored);
  const playoffsStarted = scored >= PLAYOFF_START_WEEK;

  const regStandings = PLAYERS.map(p => ({ id:p.id, pts:data.meta.standings[p.id]||0 })).sort((a,b) => b.pts-a.pts);
  const regLeader    = regStandings[0]?.id;
  const isTied       = regStandings[0]?.pts === regStandings[1]?.pts;

  const iscChamp = data.iscBracket?.results?.CHAMP;

  const ps = useMemo(() => PLAYERS.map(p => {
    const pp         = data.meta.playoffPts[p.id] || 0;
    const champBonus = (p.id === regLeader && !isTied) ? REG_SEASON_CHAMP_BONUS : 0;
    const iscBonus   = iscChamp && data.iscBracket?.picks?.[p.id]?.CHAMP === iscChamp ? 25 : 0;
    return {
      ...p,
      pp, champBonus, iscBonus,
      total: 1000 + pp + champBonus,
      wins:  Object.values(data.results || {}).filter(r => r.scored?.[p.id]?.weeklyWin).length,
      regPts: data.meta.standings[p.id] || 0,
    };
  }).sort((a,b) => b.total - a.total), [data, regLeader, isTied, iscChamp]);

  const maxTotal = ps[0]?.total || 1;

  return (
    <div style={{ padding:20, maxWidth:900, margin:"0 auto", position:"relative", zIndex:1 }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom:20 }}>
        <h2 style={{ color:C.text, fontFamily:"'Oswald',sans-serif", fontSize:26, letterSpacing:1, marginBottom:4, margin:0 }}>
          Playoff Picture
        </h2>
        <div style={{ color:C.dim, fontSize:13, marginTop:6 }}>
          {playoffsStarted
            ? "The Chase is live — scoring through W36 (Homestead)"
            : `${scored} races complete · ${weeksLeft} regular-season race${weeksLeft !== 1 ? "s" : ""} remain`}
        </div>
      </div>

      {/* ── Rules callout ───────────────────────────────────────────────────── */}
      <div style={{
        background:C.card, borderRadius:r.md, padding:"14px 16px", marginBottom:20,
        border:`1px solid ${C.border}`,
        display:"flex", flexWrap:"wrap", gap:16, alignItems:"flex-start",
      }}>
        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ color:C.accent, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:4 }}>
            How It Works
          </div>
          <div style={{ color:C.dim, fontSize:12, lineHeight:1.7 }}>
            Everyone resets to <span style={{ color:C.text, fontWeight:700 }}>1,000</span> base at W{PLAYOFF_START_WEEK} (Darlington).
            Weekly wins (+25) and bonus pts carry over.
          </div>
        </div>
        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ color:C.accent, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:4 }}>
            Champ Bonus
          </div>
          {isTied
            ? <div style={{ color:"#f59e0b", fontSize:12 }}>⚠️ Tied at the top — no bonus until the lead is broken</div>
            : <div style={{ color:C.dim, fontSize:12, lineHeight:1.7 }}>
                Regular-season leader earns <span style={{ color:C.accent, fontWeight:700 }}>+{REG_SEASON_CHAMP_BONUS} bonus pts</span>{" "}
                entering the Chase.{" "}
                {!playoffsStarted && regLeader && (
                  <span style={{ color:C.text }}>
                    Currently: <span style={{ color:C.accent, fontWeight:700 }}>{PNAME[regLeader]}</span>
                    {" "}{playoffsStarted ? "(applied)" : "(projected)"}
                  </span>
                )}
              </div>
          }
        </div>
      </div>

      {/* ── Chase standings ─────────────────────────────────────────────────── */}
      <div style={{ display:"grid", gap:12 }}>
        {ps.map((p, i) => {
          const isFirst = i === 0;
          return (
            <div key={p.id} style={{
              background:PClr[p.id].bg, borderRadius:r.lg,
              border:`2px solid ${isFirst ? C.accent : PClr[p.id].bg==="#000000" ? C.border : PClr[p.id].bg+"66"}`,
              overflow:"hidden",
              boxShadow:isFirst ? shadow.glow(C.accent) : shadow.card,
            }}>

              {/* Main row */}
              <div style={{ padding:"16px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  {/* Rank circle */}
                  <div style={{
                    width:44, height:44, borderRadius:"50%", flexShrink:0,
                    background:PClr[p.id].fg, color:PClr[p.id].bg,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontFamily:"'Oswald',sans-serif", fontSize:20, fontWeight:900,
                  }}>
                    {i + 1}
                  </div>
                  <div>
                    <div style={{
                      color:PClr[p.id].fg, fontFamily:"'Oswald',sans-serif",
                      fontSize:22, fontWeight:900, letterSpacing:1, lineHeight:1,
                      display:"flex", alignItems:"center", gap:8,
                    }}>
                      {(p.id === "rich" ? "Dickie Doo" : p.name).toUpperCase()}
                      {p.champBonus > 0 && (
                        <span style={{
                          fontSize:10, fontWeight:700, letterSpacing:1.5,
                          color:C.accent, background:C.accent+"22",
                          padding:"2px 8px", borderRadius:r.pill,
                          border:`1px solid ${C.accent}55`,
                        }}>👑 CHAMP</span>
                      )}
                      {p.iscBonus > 0 && (
                        <span style={{
                          fontSize:10, fontWeight:700, letterSpacing:1.5,
                          color:"#8b5cf6", background:"#8b5cf622",
                          padding:"2px 8px", borderRadius:r.pill,
                          border:"1px solid #8b5cf655",
                        }}>🏁 ISC +25</span>
                      )}
                    </div>
                    <div style={{ color:PClr[p.id].fg+"77", fontSize:11, marginTop:3 }}>
                      {p.wins} weekly win{p.wins !== 1 ? "s" : ""} · {p.regPts.toLocaleString()} reg-season pts
                    </div>
                  </div>
                </div>

                {/* Chase total */}
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{
                    fontFamily:"'Oswald',sans-serif", fontSize:40, fontWeight:900, lineHeight:1,
                    color:isFirst ? C.accent : PClr[p.id].fg,
                  }}>
                    {p.total.toLocaleString()}
                  </div>
                  <div style={{ color:PClr[p.id].fg+"55", fontSize:9, textTransform:"uppercase", letterSpacing:1 }}>
                    chase pts
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ padding:"0 20px 4px" }}>
                <ProgressBar value={p.total} max={maxTotal} color={isFirst ? C.accent : PClr[p.id].fg} />
              </div>

              {/* Breakdown tiles */}
              <div style={{ padding:"10px 16px 14px", display:"flex", gap:8, flexWrap:"wrap" }}>
                {[
                  { label:"Base",         value:1000,          col:PClr[p.id].fg+"88" },
                  { label:"Playoff Pts",  value:`+${p.pp}`,    col:C.accent           },
                  ...(p.champBonus > 0
                    ? [{ label:"Champ Bonus", value:`+${p.champBonus}`, col:C.accent }]
                    : []),
                  ...(p.iscBonus > 0
                    ? [{ label:"ISC Bonus", value:"+25", col:"#8b5cf6" }]
                    : []),
                  { label:"Reg Season",   value:p.regPts.toLocaleString(), col:PClr[p.id].fg+"66" },
                ].map(({ label, value, col }) => (
                  <div key={label} style={{
                    background:"rgba(0,0,0,0.2)", borderRadius:r.sm,
                    padding:"7px 12px", flex:"1 1 70px",
                  }}>
                    <div style={{ color:col, fontSize:9, textTransform:"uppercase", letterSpacing:1, marginBottom:2 }}>{label}</div>
                    <div style={{
                      color:col, fontFamily:"'Oswald',sans-serif",
                      fontSize:16, fontWeight:700,
                    }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer note ─────────────────────────────────────────────────────── */}
      <div style={{
        marginTop:20, background:C.card, borderRadius:r.md,
        padding:"12px 16px", border:`1px solid ${C.border}`,
        color:C.dim, fontSize:12, lineHeight:1.7,
      }}>
        The Chase begins <strong style={{ color:C.text }}>Week {PLAYOFF_START_WEEK}</strong> at Darlington.
        All players reset to 1,000 + playoff pts + champion bonus, then regular scoring continues through
        <strong style={{ color:C.text }}> Week 36 at Homestead</strong>.
      </div>
    </div>
  );
}
