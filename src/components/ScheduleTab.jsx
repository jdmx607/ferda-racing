import { useState } from "react";
import { C, TTC, TTL, r } from "../theme";
import { SCHEDULES, ACTIVE_SEASON, PLAYOFF_START_WEEK, TRACK_MULTS } from "../constants";
import { isScored, getCurrentWeek } from "../engine/events";
import { weekLabel, weekName } from "../exhibitions";

const EXHIBITION_NOTE = {
  clash:   "Exhibition — not in the standings. Its result sets the Week 1 draft order. No mulligans.",
  allstar: "Exhibition — not in the standings. Playoff bonus: 125 / 50 / 10 / 0 pts for 1st–4th. No mulligans.",
};

export function ScheduleTab({ data }) {
  const [season, setSeason] = useState(ACTIVE_SEASON);
  const schedule  = SCHEDULES[season];
  const isActive  = season === ACTIVE_SEASON;          // other seasons are a read-only preview
  const raceCount = schedule.filter(s => !s.ex).length; // exhibitions aren't part of the 36

  const scored      = new Set(isActive ? schedule.filter(s => isScored(data, s.w)).map(s => s.w) : []);
  const pointsDone  = schedule.filter(s => !s.ex && scored.has(s.w)).length;
  const nextWeek    = isActive ? getCurrentWeek(data) : null;

  return (
    <div style={{ padding:20, maxWidth:760, margin:"0 auto", position:"relative", zIndex:1 }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:8 }}>
        <h2 style={{ color:C.text, fontFamily:"'Oswald',sans-serif", fontSize:26, letterSpacing:1, margin:0 }}>
          {season} Schedule
        </h2>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {Object.entries(TTC).map(([ty, col]) => (
            <span key={ty} style={{
              fontSize:10, fontWeight:700,
              color:col, background:col+"18",
              padding:"3px 10px", borderRadius:r.pill,
              border:`1px solid ${col}44`, letterSpacing:1,
            }}>
              {TTL[ty]} ×{TRACK_MULTS[ty]}
            </span>
          ))}
        </div>
      </div>

      {/* ── Season switch ───────────────────────────────────────────────────── */}
      <div style={{ display:"flex", gap:6, marginBottom:16 }}>
        {Object.keys(SCHEDULES).map(y => (
          <button key={y} onClick={() => setSeason(Number(y))} style={{
            padding:"6px 14px", borderRadius:r.pill,
            border:`1px solid ${season === Number(y) ? C.accent : C.border}`,
            background:season === Number(y) ? C.accent : "transparent",
            color:season === Number(y) ? "#000" : C.dim,
            fontSize:11, fontWeight:700, cursor:"pointer",
            fontFamily:"'Oswald',sans-serif", letterSpacing:1,
          }}>{y}{Number(y) === ACTIVE_SEASON ? " · current" : " · preview"}</button>
        ))}
      </div>

      {/* ── Progress bar ────────────────────────────────────────────────────── */}
      {isActive ? (
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
            <span style={{ color:C.dim, fontSize:11 }}>{pointsDone} races complete</span>
            <span style={{ color:C.dim, fontSize:11 }}>{raceCount - pointsDone} remaining</span>
          </div>
          <div style={{ height:6, background:C.border, borderRadius:r.pill, overflow:"hidden" }}>
            <div style={{
              height:"100%", width:`${(pointsDone / raceCount) * 100}%`,
              background:`linear-gradient(90deg,${C.green},${C.accent})`,
              borderRadius:r.pill, transition:"width 0.8s ease",
            }}/>
          </div>
        </div>
      ) : (
        <div style={{
          marginBottom:20, padding:"10px 14px", borderRadius:r.md,
          background:C.card, border:`1px solid ${C.border}`, color:C.dim, fontSize:12, lineHeight:1.6,
        }}>
          Preview of the {season} season — {raceCount} points races plus the Clash and All-Star Race
          (exhibitions, marked ★). The app switches to this schedule when the {season} season starts.
        </div>
      )}

      {/* ── Race list ───────────────────────────────────────────────────────── */}
      <div style={{ display:"grid", gap:3 }}>
        {schedule.map(s => {
          const isDone    = scored.has(s.w);
          const isNext    = s.w === nextWeek;
          const isPlayoff = s.w === PLAYOFF_START_WEEK;
          const isEx      = !!s.ex;
          const col       = TTC[s.ty];

          return (
            <div key={s.w}>
              {isPlayoff && (
                <div style={{
                  display:"flex", alignItems:"center", gap:10, margin:"10px 0 6px",
                }}>
                  <div style={{ flex:1, height:1, background:`linear-gradient(90deg,transparent,${C.accent})` }}/>
                  <span style={{
                    color:C.accent, fontSize:10, fontWeight:700,
                    letterSpacing:2, textTransform:"uppercase",
                    padding:"3px 12px", borderRadius:r.pill,
                    background:C.accent+"15", border:`1px solid ${C.accent}44`,
                  }}>
                    🏆 PLAYOFFS BEGIN
                  </span>
                  <div style={{ flex:1, height:1, background:`linear-gradient(90deg,${C.accent},transparent)` }}/>
                </div>
              )}

              <div style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"9px 14px", borderRadius:r.sm,
                background: isNext ? C.accent+"0f" : isEx ? C.gold+"0a" : isDone ? "transparent" : C.card,
                border:`1px solid ${isNext ? C.accent+"44" : isEx ? C.gold+"44" : isDone ? C.border+"55" : C.border}`,
                opacity: isDone ? 0.6 : 1,
                transition:"all 0.12s ease",
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, flex:1, minWidth:0 }}>
                  {/* Status indicator */}
                  <div style={{
                    width:44, flexShrink:0, textAlign:"center",
                    fontFamily:"'Oswald',sans-serif", fontSize:11, fontWeight:700,
                    color: isDone ? C.green : isNext ? C.accent : isEx ? C.gold : C.muted,
                  }}>
                    {isDone ? "✓" : isEx ? `★ ${weekLabel(s.w)}` : `W${s.w}`}
                  </div>

                  {/* Race name */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{
                      color: isDone ? C.dim : isNext ? C.text : C.textDim,
                      fontSize:13, fontWeight:700,
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                    }}>
                      {!isDone && <span style={{ color:C.muted, fontWeight:400 }}>{weekName(s.w)} — </span>}
                      {s.r}
                    </div>
                    <div style={{ color:C.muted, fontSize:11, marginTop:1 }}>
                      @ {s.t}{isEx && <span style={{ color:C.gold }}> · {EXHIBITION_NOTE[s.ex]}</span>}
                    </div>
                  </div>
                </div>

                {/* Right side: date + track type badge */}
                <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0, marginLeft:8 }}>
                  <span style={{ color:C.muted, fontSize:10 }}>{s.d}</span>
                  <span style={{
                    fontSize:9, fontWeight:700, letterSpacing:1,
                    color:col, background:col+"18",
                    padding:"2px 7px", borderRadius:r.pill,
                    border:`1px solid ${col}33`,
                  }}>
                    {TTL[s.ty]}
                  </span>
                  {isNext && (
                    <span style={{
                      fontSize:9, fontWeight:700, letterSpacing:1,
                      color:C.accent, background:C.accent+"20",
                      padding:"2px 7px", borderRadius:r.pill,
                      border:`1px solid ${C.accent}55`,
                    }}>NEXT</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
