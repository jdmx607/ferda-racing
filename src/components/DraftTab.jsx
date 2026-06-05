import { useState, useMemo } from "react";
import { C, PClr, PC, TTC, TTL, r, shadow } from "../theme";
import { PLAYERS, PNAME, SCHEDULE, DRIVERS, DRIVER_INFO, MAKE_COLORS, ACTIVE_PICKS, TRACK_MULTS, isMemorial } from "../constants";
import { getDraftOrder, buildSnakeOrder } from "../engine/draft";

const MAKE_BADGE = { Chevy:"#b8b8b8", Ford:"#4a90e2", Toyota:"#eb0a1e" };

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

export function DraftTab({ player, data, onDraftPick, onUndoDraft, currentWeek }) {
  const [search,  setSearch]  = useState("");
  const [undoMsg, setUndoMsg] = useState("");

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

  const handlePick = (driver) => {
    if (!isMyTurn || draftComplete || isMemorial(driver)) return;
    if (!window.confirm(`Lock in ${driver}?`)) return;
    onDraftPick(currentWeek, player.id, driver, currentPickNum);
    setSearch("");
  };

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
            <div style={{ color:C.dim, fontSize:12 }}>
              Waiting for <span style={{ color:PC[currentTurn?.pid], fontWeight:700 }}>{PNAME[currentTurn?.pid]}</span>…
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
    </div>
  );
}
