import { useMemo, useState } from "react";
import { C, PClr, r, shadow } from "../theme";
import { PLAYERS, PNAME, DRIVERS, PLAYOFF_START_WEEK, REG_SEASON_CHAMP_BONUS, isMemorial } from "../constants";
import { getDriverSeasonStats } from "../engine/stats";

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

const selectStyle = {
  padding:"8px 12px", borderRadius:r.sm,
  border:`1px solid ${C.border}`, background:C.input,
  color:C.text, fontSize:12, fontFamily:"inherit", outline:"none",
};

// ── Playoff Field admin (commissioner-only) ─────────────────────────────────
function FieldAdmin({ fieldDrivers, eliminated, onSave }) {
  const [addDriver, setAddDriver] = useState("");
  const availableToAdd = DRIVERS.filter(d => !fieldDrivers.includes(d) && !isMemorial(d));

  const add = () => {
    if (!addDriver) return;
    onSave({ drivers: [...fieldDrivers, addDriver], eliminated });
    setAddDriver("");
  };
  const remove = (d) => {
    const ne = { ...eliminated }; delete ne[d];
    onSave({ drivers: fieldDrivers.filter(x => x !== d), eliminated: ne });
  };
  const toggle = (d) => {
    onSave({ drivers: fieldDrivers, eliminated: { ...eliminated, [d]: !eliminated[d] } });
  };

  return (
    <div style={{ background:C.card, borderRadius:r.md, padding:"14px 16px", marginBottom:16, border:`1px solid ${C.border}` }}>
      <div style={{ color:C.muted, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>
        🔑 Manage Playoff Field
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:fieldDrivers.length?12:0, flexWrap:"wrap" }}>
        <select value={addDriver} onChange={e => setAddDriver(e.target.value)} style={{ ...selectStyle, flex:"1 1 200px" }}>
          <option value="">Add driver to field…</option>
          {availableToAdd.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <button onClick={add} disabled={!addDriver} style={{
          padding:"8px 16px", borderRadius:r.sm, border:`1px solid ${C.gold}66`,
          background:C.gold+"18", color:C.gold, fontSize:12, fontWeight:700,
          cursor:addDriver?"pointer":"default", fontFamily:"inherit", opacity:addDriver?1:0.5,
        }}>+ Add</button>
      </div>
      {fieldDrivers.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          {fieldDrivers.map(d => {
            const isOut = !!eliminated[d];
            return (
              <div key={d} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 10px", background:C.bg, borderRadius:r.sm }}>
                <span style={{ flex:1, fontSize:12, color:isOut ? "#ef4444" : C.text, textDecoration:isOut?"line-through":"none" }}>{d}</span>
                <button onClick={() => toggle(d)} style={{
                  padding:"3px 10px", borderRadius:r.pill,
                  border:`1px solid ${isOut ? "#10b981" : "#ef4444"}`,
                  background:isOut ? "#10b98122" : "#ef444422",
                  color:isOut ? "#10b981" : "#ef4444",
                  fontSize:10, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                }}>{isOut ? "Reinstate" : "Eliminate"}</button>
                <button onClick={() => remove(d)} style={{
                  padding:"3px 8px", borderRadius:r.pill, border:"1px solid #ef444433",
                  background:"transparent", color:"#ef444466", fontSize:10, cursor:"pointer", fontFamily:"inherit",
                }}>✕</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Playoff Field board + our-picks cross-reference ─────────────────────────
function PlayoffField({ data, user, currentWeek, onSaveChaseField }) {
  const isCommish   = user?.id === "justin";
  const chaseField  = data.chaseField || { drivers:[], eliminated:{} };
  const fieldDrivers = chaseField.drivers || [];
  const eliminated  = chaseField.eliminated || {};

  const driverStats = useMemo(() => getDriverSeasonStats(data), [data]);
  const ptsByDriver = useMemo(() => {
    const m = {};
    driverStats.forEach(s => { m[s.name] = s.totalFerdaPts; });
    return m;
  }, [driverStats]);

  const sortedField = useMemo(() =>
    [...fieldDrivers].sort((a, b) => (ptsByDriver[b] || 0) - (ptsByDriver[a] || 0)),
    [fieldDrivers, ptsByDriver]
  );

  const chaseWeeks = [];
  for (let w = PLAYOFF_START_WEEK; w <= 36; w++) {
    const hasPicks = data.picks?.["w"+w] && Object.values(data.picks["w"+w]).some(pk => pk?.length > 0);
    const hasDraft = data.drafts?.["w"+w]?.length > 0;
    if (hasPicks || hasDraft || w === currentWeek) chaseWeeks.push(w);
  }
  const [pickWeek, setPickWeek] = useState(
    chaseWeeks.includes(currentWeek) ? currentWeek : (chaseWeeks[chaseWeeks.length - 1] || PLAYOFF_START_WEEK)
  );
  const weekPicks = data.picks?.["w" + pickWeek] || {};
  const anyPicks  = Object.values(weekPicks).some(pk => pk?.length > 0);

  return (
    <div>
      {isCommish && <FieldAdmin fieldDrivers={fieldDrivers} eliminated={eliminated} onSave={onSaveChaseField} />}

      {/* Solid black board — gold for active, red for eliminated */}
      <div style={{ background:"#000", borderRadius:r.lg, padding:20, border:`1px solid ${C.gold}33`, marginBottom:20 }}>
        <div style={{ color:C.gold, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:14, textAlign:"center" }}>
          🏆 Playoff Field
        </div>
        {sortedField.length === 0 ? (
          <div style={{ color:C.muted, textAlign:"center", padding:24, fontSize:13 }}>
            No playoff field set yet{isCommish ? " — add drivers above once the field is finalized." : "."}
          </div>
        ) : (
          <div style={{ display:"grid", gap:6 }}>
            {sortedField.map((d, i) => {
              const isOut = !!eliminated[d];
              const pts = ptsByDriver[d] || 0;
              return (
                <div key={d} style={{
                  display:"flex", alignItems:"center", gap:10, padding:"9px 12px",
                  background: isOut ? "rgba(239,68,68,0.06)" : "rgba(255,215,0,0.06)",
                  borderRadius:r.sm,
                  borderLeft:`3px solid ${isOut ? "#ef4444" : C.gold}`,
                  opacity: isOut ? 0.55 : 1,
                }}>
                  <span style={{ color:isOut ? "#ef444488" : C.gold+"88", fontSize:11, fontWeight:700, width:20, flexShrink:0 }}>{i+1}</span>
                  <span style={{
                    flex:1, fontSize:14, fontWeight:700,
                    color: isOut ? "#ef4444" : C.gold,
                    textDecoration: isOut ? "line-through" : "none",
                  }}>{d}</span>
                  <span style={{ fontFamily:"'Oswald',sans-serif", fontSize:15, fontWeight:700, color:isOut ? "#ef444488" : C.gold, flexShrink:0 }}>
                    {pts}
                  </span>
                  {isOut && <span style={{ fontSize:9, color:"#ef4444", fontWeight:700, letterSpacing:1, flexShrink:0 }}>OUT</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Our picks — gold if chase driver, green if not */}
      <div style={{ color:C.dim, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>
        Our Picks · <span style={{ color:C.gold }}>Gold = Chase Driver</span> · <span style={{ color:"#10b981" }}>Green = Non-Chase</span>
      </div>
      {chaseWeeks.length > 0 && (
        <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:14 }}>
          {chaseWeeks.map(w => (
            <button key={w} onClick={() => setPickWeek(w)} style={{
              padding:"5px 10px", borderRadius:r.pill,
              border:`1px solid ${pickWeek === w ? C.gold : C.border}`,
              background:pickWeek === w ? C.gold : "transparent",
              color:pickWeek === w ? "#000" : C.dim,
              fontSize:11, fontWeight:700, cursor:"pointer",
              fontFamily:"'Oswald',sans-serif", letterSpacing:1,
            }}>W{w}</button>
          ))}
        </div>
      )}

      {!anyPicks ? (
        <div style={{ background:C.card, borderRadius:r.xl, padding:"40px 24px", border:`1px solid ${C.border}`, textAlign:"center", color:C.dim, fontSize:13 }}>
          No picks for Week {pickWeek} yet.
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12 }}>
          {PLAYERS.map(p => {
            const picks = (weekPicks[p.id] || []).map(pk => pk.driver);
            return (
              <div key={p.id} style={{
                background:PClr[p.id].bg, borderRadius:r.lg,
                border:`2px solid ${PClr[p.id].bg==="#000000" ? C.border : PClr[p.id].bg+"66"}`,
                overflow:"hidden",
              }}>
                <div style={{
                  padding:"10px 14px", borderBottom:`1px solid ${PClr[p.id].bg==="#000000" ? C.border : "rgba(0,0,0,0.2)"}`,
                  color:PClr[p.id].fg, fontFamily:"'Oswald',sans-serif", fontWeight:900, fontSize:15,
                }}>
                  {PNAME[p.id].toUpperCase()}
                </div>
                <div style={{ padding:"8px 10px", display:"flex", flexDirection:"column", gap:3 }}>
                  {picks.length === 0
                    ? <div style={{ color:PClr[p.id].fg+"44", fontSize:12, fontStyle:"italic", textAlign:"center", padding:8 }}>No picks</div>
                    : picks.map((d, i) => {
                        const inField = fieldDrivers.includes(d);
                        const col = inField ? C.gold : "#10b981";
                        return (
                          <div key={i} style={{
                            display:"flex", alignItems:"center", gap:8, padding:"6px 10px",
                            background:"rgba(0,0,0,0.15)", borderRadius:r.sm, borderLeft:`2px solid ${col}66`,
                          }}>
                            <span style={{ fontSize:12, fontWeight:700, color:col, flex:1 }}>{d}</span>
                          </div>
                        );
                      })
                  }
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function PlayoffsTab({ data, user, currentWeek, onSaveChaseField }) {
  const [view, setView] = useState("standings");
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
  // Gold theme kicks in once the Chase actually starts — plain amber accent until then
  const theme = playoffsStarted ? C.gold : C.accent;

  return (
    <div style={{ padding:20, maxWidth:900, margin:"0 auto", position:"relative", zIndex:1 }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom:20 }}>
        <h2 style={{
          color:playoffsStarted ? C.gold : C.text, fontFamily:"'Oswald',sans-serif",
          fontSize:26, letterSpacing:1, marginBottom:4, margin:0,
          textShadow:playoffsStarted ? `0 0 16px ${C.gold}55` : "none",
        }}>
          {playoffsStarted ? "🏆 THE CHASE" : "THE CHASE"}
        </h2>
        <div style={{ color:C.dim, fontSize:13, marginTop:6 }}>
          {playoffsStarted
            ? "The Chase is live — scoring through W36 (Homestead)"
            : `${scored} races complete · ${weeksLeft} regular-season race${weeksLeft !== 1 ? "s" : ""} remain`}
        </div>
      </div>

      {/* ── View tabs ─────────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", gap:4, marginBottom:20, borderBottom:`1px solid ${C.border}`, paddingBottom:12 }}>
        {[
          { id:"standings", label:"Fantasy Standings" },
          { id:"field",     label:"Playoff Field"      },
        ].map(v => (
          <button key={v.id} onClick={() => setView(v.id)} style={{
            padding:"7px 14px", borderRadius:r.pill,
            border:`1px solid ${view===v.id ? theme : C.border}`,
            background:view===v.id ? theme : "transparent",
            color:view===v.id ? "#000" : C.dim,
            fontSize:11, fontWeight:700, cursor:"pointer",
            fontFamily:"'Oswald',sans-serif", letterSpacing:1,
          }}>{v.label}</button>
        ))}
      </div>

      {view === "field" && (
        <PlayoffField data={data} user={user} currentWeek={currentWeek} onSaveChaseField={onSaveChaseField} />
      )}

      {view === "standings" && (
      <>
      {/* ── Rules callout ───────────────────────────────────────────────────── */}
      <div style={{
        background:C.card, borderRadius:r.md, padding:"14px 16px", marginBottom:20,
        border:`1px solid ${playoffsStarted ? C.gold+"33" : C.border}`,
        display:"flex", flexWrap:"wrap", gap:16, alignItems:"flex-start",
      }}>
        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ color:theme, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:4 }}>
            How It Works
          </div>
          <div style={{ color:C.dim, fontSize:12, lineHeight:1.7 }}>
            Everyone resets to <span style={{ color:C.text, fontWeight:700 }}>1,000</span> base at W{PLAYOFF_START_WEEK} (Darlington).
            Weekly wins (+25) and bonus pts carry over.
          </div>
        </div>
        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ color:theme, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:4 }}>
            Champ Bonus
          </div>
          {isTied
            ? <div style={{ color:"#f59e0b", fontSize:12 }}>⚠️ Tied at the top — no bonus until the lead is broken</div>
            : <div style={{ color:C.dim, fontSize:12, lineHeight:1.7 }}>
                Regular-season leader earns <span style={{ color:theme, fontWeight:700 }}>+{REG_SEASON_CHAMP_BONUS} bonus pts</span>{" "}
                entering the Chase.{" "}
                {!playoffsStarted && regLeader && (
                  <span style={{ color:C.text }}>
                    Currently: <span style={{ color:theme, fontWeight:700 }}>{PNAME[regLeader]}</span>
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
              border:`2px solid ${isFirst ? theme : PClr[p.id].bg==="#000000" ? C.border : PClr[p.id].bg+"66"}`,
              overflow:"hidden",
              boxShadow:isFirst ? shadow.glow(theme) : shadow.card,
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
                          color:theme, background:theme+"22",
                          padding:"2px 8px", borderRadius:r.pill,
                          border:`1px solid ${theme}55`,
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
                    color:isFirst ? theme : PClr[p.id].fg,
                    textShadow:isFirst && playoffsStarted ? `0 0 12px ${C.gold}66` : "none",
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
                <ProgressBar value={p.total} max={maxTotal} color={isFirst ? theme : PClr[p.id].fg} />
              </div>

              {/* Breakdown tiles */}
              <div style={{ padding:"10px 16px 14px", display:"flex", gap:8, flexWrap:"wrap" }}>
                {[
                  { label:"Base",         value:1000,          col:PClr[p.id].fg+"88" },
                  { label:"Playoff Pts",  value:`+${p.pp}`,    col:theme              },
                  ...(p.champBonus > 0
                    ? [{ label:"Champ Bonus", value:`+${p.champBonus}`, col:theme }]
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
      </>
      )}
    </div>
  );
}
