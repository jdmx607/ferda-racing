import { useMemo, useState } from "react";
import { C, PClr, TTC, TTL, r, shadow } from "../theme";
import { PLAYERS, PNAME, TRACK_MULTS } from "../constants";
import { getSeasonTimeline, getHeadToHead, getWeeklyFinishes, getAchievements } from "../engine/history";

// ── Helpers ───────────────────────────────────────────────────────────────────

function positionColor(pos) {
  return pos === 1 ? "#f59e0b" : pos === 2 ? "#94a3b8" : pos === 3 ? "#cd7f32" : "#ef4444";
}
function positionBg(pos) {
  return pos === 1 ? "#f59e0b20" : pos === 2 ? "#94a3b820" : pos === 3 ? "#cd7f3220" : "#ef444420";
}
function formIcon(pos) {
  return pos === 1 ? "W" : pos === 2 ? "2" : pos === 3 ? "3" : "L";
}

// ── Season Timeline ───────────────────────────────────────────────────────────

function SeasonTimeline({ timeline }) {
  const [hoverWeek, setHoverWeek] = useState(null);

  if (!timeline.length) return (
    <div style={{ color:C.muted, textAlign:"center", padding:32 }}>No scored weeks yet</div>
  );

  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"separate", borderSpacing:"0 3px", minWidth:580 }}>
        <thead>
          <tr>
            <th style={{ color:C.muted, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:1, textAlign:"left", padding:"4px 10px 8px", width:120 }}>Race</th>
            {PLAYERS.map(p => (
              <th key={p.id} style={{ color:PClr[p.id].fg, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:0.5, textAlign:"center", padding:"4px 8px 8px", minWidth:60 }}>
                <div style={{ display:"inline-flex", alignItems:"center", gap:4 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:PClr[p.id].fg }}/>
                  {PNAME[p.id]}
                </div>
              </th>
            ))}
            <th style={{ color:C.muted, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:1, textAlign:"left", padding:"4px 8px 8px" }}>MVP Driver</th>
          </tr>
        </thead>
        <tbody>
          {timeline.map(row => {
            const isHov = hoverWeek === row.week;
            return (
              <tr
                key={row.week}
                onMouseEnter={() => setHoverWeek(row.week)}
                onMouseLeave={() => setHoverWeek(null)}
                style={{ transition:"all 0.1s ease" }}
              >
                {/* Race info */}
                <td style={{
                  padding:"8px 10px", borderRadius:`${r.sm}px 0 0 ${r.sm}px`,
                  background: isHov ? C.cardAlt : C.card,
                  border:`1px solid ${isHov ? C.borderBright : C.border}`,
                  borderRight:"none",
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                    <span style={{
                      fontFamily:"'Oswald',sans-serif", fontSize:11, fontWeight:700,
                      color:C.muted, width:24, flexShrink:0,
                    }}>W{row.week}</span>
                    <div>
                      <div style={{ color:C.text, fontSize:12, fontWeight:700, lineHeight:1.2 }}
                        title={row.raceName}
                      >
                        {row.track}
                      </div>
                      <span style={{
                        fontSize:8, fontWeight:700, letterSpacing:0.5,
                        color:TTC[row.trackType], background:TTC[row.trackType]+"18",
                        padding:"1px 4px", borderRadius:r.pill,
                      }}>
                        {TTL[row.trackType]}×{TRACK_MULTS[row.trackType]}
                      </span>
                    </div>
                  </div>
                </td>

                {/* Per-player scores */}
                {PLAYERS.map(p => {
                  const s = row.scores[p.id];
                  if (!s) return <td key={p.id} style={{ background:isHov?C.cardAlt:C.card, border:`1px solid ${isHov?C.borderBright:C.border}`, borderLeft:"none", borderRight:"none" }}/>;
                  return (
                    <td key={p.id} style={{
                      padding:"8px 6px", textAlign:"center",
                      background:isHov ? C.cardAlt : s.weeklyWin ? C.accent+"10" : C.card,
                      border:`1px solid ${isHov?C.borderBright:C.border}`,
                      borderLeft:"none", borderRight:"none",
                    }}>
                      <div style={{
                        display:"inline-flex", flexDirection:"column", alignItems:"center",
                        gap:2,
                      }}>
                        <span style={{
                          fontFamily:"'Oswald',sans-serif", fontSize:14, fontWeight:900,
                          color: positionColor(s.position),
                        }}>
                          {s.total}
                        </span>
                        <span style={{
                          fontSize:9, fontWeight:700,
                          color:positionColor(s.position),
                          background:positionBg(s.position),
                          padding:"1px 5px", borderRadius:r.pill,
                        }}>
                          {s.weeklyWin ? "👑" : `P${s.position}`}
                        </span>
                      </div>
                    </td>
                  );
                })}

                {/* MVP driver */}
                <td style={{
                  padding:"8px 10px", borderRadius:`0 ${r.sm}px ${r.sm}px 0`,
                  background:isHov ? C.cardAlt : C.card,
                  border:`1px solid ${isHov?C.borderBright:C.border}`,
                  borderLeft:"none",
                }}>
                  {row.mvp && (
                    <div>
                      <div style={{ color:C.text, fontSize:11, fontWeight:700 }}>
                        {row.mvp.name}
                      </div>
                      <div style={{ color:C.accent, fontFamily:"'Oswald',sans-serif", fontSize:11, fontWeight:700 }}>
                        +{row.mvp.score}
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Form Guide ────────────────────────────────────────────────────────────────

function FormGuide({ finishes }) {
  return (
    <div style={{ display:"grid", gap:10 }}>
      {PLAYERS.map(p => {
        const hist = (finishes[p.id] || []).sort((a,b) => a.week - b.week);
        const recent = hist.slice(-6);           // last 6 weeks
        const trend  = hist.slice(-1)[0]?.position || null;

        // Running total for sparkline concept
        const totalPts = hist.reduce((s, h) => s + h.score, 0);
        const avgPts   = hist.length ? Math.round(totalPts / hist.length) : 0;
        const wins     = hist.filter(h => h.weeklyWin).length;

        return (
          <div key={p.id} style={{
            background:PClr[p.id].bg, borderRadius:r.md,
            border:`1px solid ${PClr[p.id].bg==="#000000" ? C.border : PClr[p.id].bg+"55"}`,
            padding:"12px 14px",
            display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10,
          }}>
            {/* Player info */}
            <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:140 }}>
              <div style={{
                width:36, height:36, borderRadius:"50%", flexShrink:0,
                background:PClr[p.id].fg, color:PClr[p.id].bg,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontFamily:"'Oswald',sans-serif", fontSize:16, fontWeight:900,
              }}>
                {PNAME[p.id][0]}
              </div>
              <div>
                <div style={{ color:PClr[p.id].fg, fontFamily:"'Oswald',sans-serif", fontSize:16, fontWeight:900, letterSpacing:0.5 }}>
                  {PNAME[p.id]}
                </div>
                <div style={{ color:PClr[p.id].fg+"66", fontSize:10 }}>
                  {wins}W · avg {avgPts} pts/wk
                </div>
              </div>
            </div>

            {/* Form boxes */}
            <div style={{ display:"flex", gap:4, alignItems:"center" }}>
              <span style={{ color:PClr[p.id].fg+"55", fontSize:9, fontWeight:700, letterSpacing:1, textTransform:"uppercase", marginRight:4 }}>
                Last {recent.length}
              </span>
              {recent.map(h => (
                <div key={h.week} title={`W${h.week}: ${h.score} pts (P${h.position})`} style={{
                  width:28, height:28, borderRadius:r.sm,
                  background:positionBg(h.position),
                  border:`1.5px solid ${positionColor(h.position)}66`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontFamily:"'Oswald',sans-serif", fontSize:11, fontWeight:900,
                  color:positionColor(h.position),
                }}>
                  {formIcon(h.position)}
                </div>
              ))}
              {recent.length === 0 && (
                <span style={{ color:PClr[p.id].fg+"44", fontSize:11 }}>No results yet</span>
              )}
            </div>

            {/* Current position indicator */}
            {trend && (
              <div style={{
                width:36, height:36, borderRadius:"50%", flexShrink:0,
                background:positionBg(trend),
                border:`2px solid ${positionColor(trend)}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontFamily:"'Oswald',sans-serif", fontSize:16, fontWeight:900,
                color:positionColor(trend),
              }}>
                {trend}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Head-to-Head Matrix ───────────────────────────────────────────────────────

function HeadToHeadMatrix({ h2h }) {
  const ids = PLAYERS.map(p => p.id);

  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ borderCollapse:"separate", borderSpacing:4 }}>
        <thead>
          <tr>
            <th style={{ width:90 }}/>
            {PLAYERS.map(p => (
              <th key={p.id} style={{ padding:"6px 10px", textAlign:"center" }}>
                <div style={{
                  background:PClr[p.id].bg, color:PClr[p.id].fg,
                  padding:"4px 10px", borderRadius:r.md,
                  fontFamily:"'Oswald',sans-serif", fontSize:12, fontWeight:700, letterSpacing:0.5,
                  border:`1px solid ${PClr[p.id].bg==="#000000"?C.border:PClr[p.id].bg+"66"}`,
                }}>
                  {PNAME[p.id]}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PLAYERS.map(rowP => (
            <tr key={rowP.id}>
              {/* Row label */}
              <td style={{ padding:"4px 8px 4px 0", textAlign:"right" }}>
                <div style={{
                  background:PClr[rowP.id].bg, color:PClr[rowP.id].fg,
                  padding:"6px 10px", borderRadius:r.md,
                  fontFamily:"'Oswald',sans-serif", fontSize:12, fontWeight:700, letterSpacing:0.5,
                  border:`1px solid ${PClr[rowP.id].bg==="#000000"?C.border:PClr[rowP.id].bg+"66"}`,
                  textAlign:"center",
                }}>
                  {PNAME[rowP.id]}
                </div>
              </td>

              {PLAYERS.map(colP => {
                const isSelf = rowP.id === colP.id;
                const rec    = h2h[rowP.id]?.[colP.id];
                const totalGames = rec ? rec.wins + rec.losses + rec.ties : 0;
                const winRate = totalGames > 0 ? rec.wins / totalGames : 0;

                return (
                  <td key={colP.id} style={{ padding:4, textAlign:"center" }}>
                    <div style={{
                      width:64, height:52, borderRadius:r.sm,
                      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                      background: isSelf
                        ? C.border+"44"
                        : winRate > 0.6 ? "#10b98118" : winRate < 0.4 ? "#ef444418" : C.card,
                      border:`1px solid ${isSelf ? C.border+"44" : winRate > 0.6 ? "#10b98144" : winRate < 0.4 ? "#ef444444" : C.border}`,
                    }}>
                      {isSelf
                        ? <span style={{ color:C.muted, fontSize:16 }}>—</span>
                        : (
                          <>
                            <span style={{
                              fontFamily:"'Oswald',sans-serif", fontSize:18, fontWeight:900, lineHeight:1,
                              color: winRate > 0.5 ? C.green : winRate < 0.5 ? C.red : C.dim,
                            }}>
                              {rec?.wins ?? 0}-{rec?.losses ?? 0}
                            </span>
                            {rec?.ties > 0 && (
                              <span style={{ fontSize:9, color:C.muted }}>({rec.ties}T)</span>
                            )}
                            <span style={{ fontSize:9, color:C.muted, marginTop:2 }}>
                              {totalGames > 0 ? `${Math.round(winRate*100)}%` : "—"}
                            </span>
                          </>
                        )
                      }
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ color:C.muted, fontSize:10, marginTop:8 }}>
        Row beats column. Green = winning record, Red = losing record. Each week produces 6 head-to-head matchups.
      </div>
    </div>
  );
}

// ── Achievements ──────────────────────────────────────────────────────────────

function AchievementsPanel({ achievements }) {
  return (
    <div style={{ display:"grid", gap:14 }}>
      {PLAYERS.map(p => {
        const { unlocked, stats } = achievements[p.id] || { unlocked:[], stats:{} };
        return (
          <div key={p.id} style={{
            background:PClr[p.id].bg, borderRadius:r.lg,
            border:`1px solid ${PClr[p.id].bg==="#000000"?C.border:PClr[p.id].bg+"55"}`,
            overflow:"hidden",
          }}>
            {/* Player header */}
            <div style={{
              padding:"10px 16px",
              borderBottom:`1px solid ${PClr[p.id].bg==="#000000"?C.border:"rgba(0,0,0,0.2)"}`,
              display:"flex", alignItems:"center", justifyContent:"space-between",
            }}>
              <div style={{ color:PClr[p.id].fg, fontFamily:"'Oswald',sans-serif", fontSize:17, fontWeight:900, letterSpacing:0.5 }}>
                {PNAME[p.id].toUpperCase()}
              </div>
              <div style={{
                background:C.accent+"22", border:`1px solid ${C.accent}44`,
                borderRadius:r.pill, padding:"2px 10px",
                color:C.accent, fontSize:10, fontWeight:700, letterSpacing:1,
              }}>
                {unlocked.length} UNLOCKED
              </div>
            </div>

            {/* Badges */}
            <div style={{ padding:"10px 12px", display:"flex", flexWrap:"wrap", gap:8 }}>
              {unlocked.length === 0 ? (
                <span style={{ color:PClr[p.id].fg+"44", fontSize:12, fontStyle:"italic" }}>No achievements yet</span>
              ) : unlocked.map(a => (
                <div key={a.id} title={a.desc(stats[a.statKey] || 0)} style={{
                  background: PClr[p.id].bg==="#000000" ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.2)",
                  border:`1px solid ${PClr[p.id].fg}22`,
                  borderRadius:r.md, padding:"8px 12px",
                  display:"flex", alignItems:"center", gap:8,
                  minWidth:140,
                }}>
                  <span style={{ fontSize:20 }}>{a.icon}</span>
                  <div>
                    <div style={{ color:PClr[p.id].fg, fontWeight:700, fontSize:12 }}>{a.label}</div>
                    <div style={{ color:PClr[p.id].fg+"77", fontSize:9 }}>
                      {typeof a.statLine === "function" ? a.statLine(stats) : a.desc()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main HistoryTab ───────────────────────────────────────────────────────────

const SECTIONS = [
  { id:"timeline",     label:"Season Results"  },
  { id:"form",         label:"Form Guide"      },
  { id:"h2h",          label:"Head-to-Head"    },
  { id:"achievements", label:"Achievements"    },
];

export function HistoryTab({ data }) {
  const [section, setSection] = useState("timeline");

  const timeline    = useMemo(() => getSeasonTimeline(data),    [data]);
  const h2h         = useMemo(() => getHeadToHead(data),        [data]);
  const finishes    = useMemo(() => getWeeklyFinishes(data),    [data]);
  const achievements= useMemo(() => getAchievements(data),      [data]);

  const weeksScored = timeline.length;
  const totalWinner = Object.fromEntries(
    PLAYERS.map(p => [p.id, timeline.filter(r => r.scores[p.id]?.weeklyWin).length])
  );

  return (
    <div style={{ padding:20, maxWidth:960, margin:"0 auto", position:"relative", zIndex:1 }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom:20 }}>
        <h2 style={{ color:C.text, fontFamily:"'Oswald',sans-serif", fontSize:26, letterSpacing:1, margin:0 }}>
          Season History
        </h2>
        <div style={{ color:C.dim, fontSize:13, marginTop:6 }}>
          {weeksScored} races complete · 2026 FERDA Racing League
        </div>
      </div>

      {/* ── Quick win count strip ─────────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:20 }}>
        {PLAYERS.map(p => {
          const wins = totalWinner[p.id] || 0;
          return (
            <div key={p.id} style={{
              background:PClr[p.id].bg, borderRadius:r.md, padding:"10px 14px",
              border:`2px solid ${wins > 0 ? C.accent+"55" : PClr[p.id].bg==="#000000"?C.border:PClr[p.id].bg+"55"}`,
              textAlign:"center",
            }}>
              <div style={{
                fontFamily:"'Oswald',sans-serif", fontSize:28, fontWeight:900, lineHeight:1,
                color:wins > 0 ? C.accent : PClr[p.id].fg,
              }}>
                {wins}
              </div>
              <div style={{ color:PClr[p.id].fg+"88", fontSize:9, textTransform:"uppercase", letterSpacing:1, marginTop:3 }}>
                {PNAME[p.id]} Wins
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Section tabs ──────────────────────────────────────────────────── */}
      <div style={{ display:"flex", gap:4, marginBottom:20, borderBottom:`1px solid ${C.border}`, paddingBottom:12, flexWrap:"wrap" }}>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{
            padding:"7px 16px", borderRadius:r.pill,
            border:`1px solid ${section===s.id ? C.accent : C.border}`,
            background:section===s.id ? C.accent : "transparent",
            color:section===s.id ? "#000" : C.dim,
            fontSize:12, fontWeight:700, cursor:"pointer",
            fontFamily:"'Oswald',sans-serif", letterSpacing:1,
            transition:"all 0.12s ease",
          }}>{s.label}</button>
        ))}
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      {section === "timeline"     && <SeasonTimeline  timeline={timeline} />}
      {section === "form"         && <FormGuide       finishes={finishes} />}
      {section === "h2h"          && <HeadToHeadMatrix h2h={h2h} />}
      {section === "achievements" && <AchievementsPanel achievements={achievements} />}
    </div>
  );
}
