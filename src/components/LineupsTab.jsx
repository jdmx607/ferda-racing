import { useState } from "react";
import { C, PClr, TTC, TTL, r } from "../theme";
import { storeFor } from "../engine/events";
import { weekLabel, weekName } from "../exhibitions";
import { PLAYERS, PNAME, SCHEDULE, ACTIVE_PICKS, TRACK_MULTS } from "../constants";
import { getMulliganAllowance } from "../engine/mulligans";
import { DriverCard } from "./DriverCard";

export function LineupsTab({ data, currentWeek }) {
  const [week, setWeek] = useState(currentWeek);
  const weekInfo    = SCHEDULE.find(s => s.w === week);
  const src         = storeFor(data, week); // exhibitions keep their data separately
  const draftState  = src.drafts?.["w" + week] || [];
  const savedPicks  = src.picks?.["w" + week] || {};
  const hasScored   = !!(src.results?.["w" + week]?.scored);
  const scored      = src.results?.["w" + week]?.scored;
  const rawDrivers  = src.results?.["w" + week]?.raw?.drivers || [];

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
  SCHEDULE.forEach(({ w }) => { // schedule order puts the Clash / All-Star where they actually run
    const ws = storeFor(data, w);
    const hd = ws.drafts?.["w"+w]?.length > 0;
    const hp = ws.picks?.["w"+w] && Object.values(ws.picks["w"+w]).some(pk => pk && pk.length > 0);
    if (hd || hp || w === currentWeek) allWeeks.push(w);
  });

  return (
    <div style={{ padding:20, maxWidth:900, margin:"0 auto", position:"relative", zIndex:1 }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
        <h2 style={{ color:C.text, fontFamily:"var(--font-sans)", fontSize:26, letterSpacing:1, margin:0 }}>
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
              fontFamily:"var(--font-sans)", letterSpacing:1,
              transition:"all 0.12s ease",
            }}>{weekLabel(w)}</button>
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
          <div className="card" style={{ padding:"40px 24px", textAlign:"center" }}>
            <div style={{ color:C.dim, fontSize:14 }}>No picks yet for {weekName(week)}</div>
          </div>
        )
        : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(300px, 1fr))", gap:20, alignItems:"start" }}>
            {PLAYERS.map(p => {
              const picks    = lineups[p.id] || [];
              const mulls    = mullPicks[p.id] || [];
              const mulLeft  = getMulliganAllowance(data, p.id, currentWeek).remaining;
              const mullCol  = mulLeft <= 1 ? C.red : mulLeft <= 5 ? C.amber : C.dim;
              // If scored, get per-driver scores
              const driverScores = scored?.[p.id]?.drivers || [];

              return (
                <section key={p.id}>
                  {/* Player header */}
                  <div className="group-head" style={{ paddingTop:0 }}>
                    <div className="who">
                      <span className="dot" style={{ background:PClr[p.id].accent }} />
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:16, fontWeight:700, lineHeight:1.1 }}>{PNAME[p.id]}</div>
                        <div className="num" style={{ fontSize:11, color:C.dim, marginTop:2 }}>
                          {picks.length}/{ACTIVE_PICKS} drivers ·{" "}
                          <span style={{ color:mullCol, fontWeight:600 }}>M:{mulLeft}</span>
                        </div>
                      </div>
                    </div>
                    {/* Week total if scored */}
                    {hasScored && scored?.[p.id] && (
                      <div style={{ textAlign:"right" }}>
                        <div className="num" style={{
                          fontSize:22, fontWeight:700, lineHeight:1,
                          color:scored[p.id].total > 0 ? C.green : scored[p.id].total < 0 ? C.red : C.text,
                        }}>
                          {scored[p.id].total > 0 ? "+" : ""}{scored[p.id].total}
                        </div>
                        <div className="label" style={{ marginTop:3 }}>
                          {scored[p.id].weeklyWin ? "weekly win" : "pts"}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Driver list */}
                  <div className="stack">
                    {picks.length === 0
                      ? <div className="card" style={{ color:C.muted, fontSize:12, textAlign:"center", padding:14 }}>
                          Waiting to pick…
                        </div>
                      : picks.map((driver, i) => {
                          const dScore = driverScores.find(d => d.driver === driver);
                          const raw    = rawDrivers.find(d => d.name === driver)
                                      || rawDrivers.find(d => d.name?.startsWith(`${driver.split(" ")[0]} `));
                          return (
                            <DriverCard
                              key={i}
                              driver={driver}
                              tag={`R${i + 1}`}
                              points={dScore ? dScore.total : 0}
                              currentPos={raw?.finish}
                              startPos={raw?.qualPos}
                              dnf={!!raw?.dnf}
                              dnr={!!dScore?.dnr}
                              mulligan={mulls.includes(driver)}
                            />
                          );
                        })
                    }
                  </div>
                </section>
              );
            })}
          </div>
        )
      }
    </div>
  );
}
