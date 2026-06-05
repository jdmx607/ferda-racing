import { useState, useMemo } from "react";
import { C, PClr, TTC, TTL, r, shadow } from "../theme";
import { PLAYERS, PNAME, SCHEDULE, DRIVER_INFO, MAKE_COLORS } from "../constants";
import { getWeekTopDrivers, getDriverSeasonStats, getSeasonRecords } from "../engine/stats";

// ─── Sub-components ───────────────────────────────────────────────────────────

function PickerDots({ pickedBy }) {
  const pids = Object.keys(pickedBy || {});
  if (!pids.length) return null;
  return (
    <div style={{ display:"flex", gap:3, alignItems:"center" }}>
      {pids.map(pid => (
        <div key={pid} title={`Picked by ${PNAME[pid]} (${pickedBy[pid]}×)`} style={{
          width:14, height:14, borderRadius:"50%",
          background:PClr[pid].fg, border:`1.5px solid ${PClr[pid].bg === "#000000" ? "#ffffff33" : PClr[pid].bg}`,
          flexShrink:0,
        }}/>
      ))}
    </div>
  );
}

function MakeBadge({ driver }) {
  const info = DRIVER_INFO[driver] || {};
  if (!info.make) return null;
  return (
    <span style={{
      fontSize:8, fontWeight:700, letterSpacing:0.5,
      color:MAKE_COLORS[info.make], background:MAKE_COLORS[info.make]+"22",
      padding:"1px 5px", borderRadius:r.pill,
    }}>{info.make}</span>
  );
}

// ─── Section: Driver Season Leaderboard ───────────────────────────────────────

function DriverLeaderboard({ driverStats }) {
  const [sortBy, setSortBy] = useState("totalFerdaPts");
  const [showAll, setShowAll] = useState(false);

  const sortOptions = [
    { key:"totalFerdaPts", label:"Total Pts" },
    { key:"avgScore",      label:"Avg / Race" },
    { key:"bestScore",     label:"Best Race"  },
    { key:"pickCount",     label:"Times Picked" },
  ];

  const sorted = useMemo(() =>
    [...driverStats].sort((a, b) => b[sortBy] - a[sortBy]),
  [driverStats, sortBy]);

  const visible = showAll ? sorted : sorted.slice(0, 15);
  const max = sorted[0]?.[sortBy] || 1;

  return (
    <div>
      {/* Sort controls */}
      <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:12 }}>
        {sortOptions.map(o => (
          <button key={o.key} onClick={() => setSortBy(o.key)} style={{
            padding:"5px 12px", borderRadius:r.pill,
            border:`1px solid ${sortBy === o.key ? C.accent : C.border}`,
            background:sortBy === o.key ? C.accent : "transparent",
            color:sortBy === o.key ? "#000" : C.dim,
            fontSize:11, fontWeight:700, cursor:"pointer",
            fontFamily:"'Oswald',sans-serif", letterSpacing:1,
            transition:"all 0.12s ease",
          }}>{o.label}</button>
        ))}
      </div>

      {/* Table header */}
      <div style={{
        display:"grid", gridTemplateColumns:"28px 1fr 60px 60px 60px 50px",
        gap:8, padding:"6px 12px",
        color:C.muted, fontSize:9, fontWeight:700,
        textTransform:"uppercase", letterSpacing:1,
        borderBottom:`1px solid ${C.border}`,
      }}>
        <span>#</span><span>Driver</span>
        <span style={{textAlign:"right"}}>Total</span>
        <span style={{textAlign:"right"}}>Avg</span>
        <span style={{textAlign:"right"}}>Best</span>
        <span style={{textAlign:"right"}}>Picks</span>
      </div>

      {/* Rows */}
      {visible.map((s, i) => {
        const barW  = max > 0 ? (s[sortBy] / max) * 100 : 0;
        const info  = DRIVER_INFO[s.name] || {};
        return (
          <div key={s.name} style={{
            display:"grid", gridTemplateColumns:"28px 1fr 60px 60px 60px 50px",
            gap:8, padding:"8px 12px",
            background:i % 2 === 0 ? "transparent" : C.card+"44",
            borderBottom:`1px solid ${C.border}22`,
            alignItems:"center",
          }}>
            <span style={{ color:C.muted, fontSize:11, fontFamily:"'Oswald',sans-serif", fontWeight:700 }}>
              {i + 1}
            </span>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                <span style={{ color:C.text, fontSize:13, fontWeight:700 }}>{s.name}</span>
                <MakeBadge driver={s.name} />
                {s.neverPicked && (
                  <span style={{
                    fontSize:8, fontWeight:700, color:C.red,
                    background:C.red+"22", padding:"1px 5px", borderRadius:r.pill,
                  }}>UNDRAFTED</span>
                )}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:2 }}>
                {info.team && <span style={{ color:C.muted, fontSize:9 }}>{info.team}</span>}
                <PickerDots pickedBy={s.pickedBy} />
              </div>
              {/* Mini bar */}
              <div style={{ height:2, background:C.border, borderRadius:r.pill, marginTop:4, maxWidth:120 }}>
                <div style={{
                  height:"100%", width:`${barW}%`,
                  background:C.accent, borderRadius:r.pill,
                  opacity:0.7,
                }}/>
              </div>
            </div>
            <span style={{
              textAlign:"right", fontFamily:"'Oswald',sans-serif",
              fontSize:15, fontWeight:700,
              color:i === 0 ? C.accent : C.text,
            }}>{s.totalFerdaPts}</span>
            <span style={{
              textAlign:"right", fontFamily:"'Oswald',sans-serif",
              fontSize:13, color:C.textDim,
            }}>{s.avgScore}</span>
            <span style={{
              textAlign:"right", fontFamily:"'Oswald',sans-serif",
              fontSize:13,
              color:s.bestScore >= 80 ? C.accent : C.textDim,
            }}>{s.bestScore}</span>
            <span style={{
              textAlign:"right", fontSize:12, color:s.pickCount > 0 ? C.green : C.muted,
              fontWeight:700,
            }}>{s.pickCount}</span>
          </div>
        );
      })}

      {!showAll && sorted.length > 15 && (
        <button onClick={() => setShowAll(true)} style={{
          width:"100%", padding:"10px 0", marginTop:8,
          background:"transparent", border:`1px solid ${C.border}`,
          borderRadius:r.md, color:C.dim, fontSize:12,
          cursor:"pointer", fontFamily:"inherit",
        }}>
          Show all {sorted.length} drivers ↓
        </button>
      )}
    </div>
  );
}

// ─── Section: Weekly Top Performers ──────────────────────────────────────────

function WeeklyTopPerformers({ data }) {
  const weeks = Object.keys(data.results || {})
    .filter(k => data.results[k].raw?.drivers)
    .map(k => parseInt(k.replace("w","")))
    .sort((a,b) => b - a);

  const [week, setWeek] = useState(weeks[0] || 1);
  const wr = data.results?.["w" + week];

  const topDrivers = useMemo(() => {
    if (!wr?.raw) return [];
    return getWeekTopDrivers(wr.raw, week, 8);
  }, [wr, week]);

  // Build a set of drivers picked this week (for the "missed" indicator)
  const weekPicks  = data.picks?.["w" + week] || {};
  const pickerMap  = {};
  Object.entries(weekPicks).forEach(([pid, picks]) => {
    (picks || []).forEach(pk => {
      if (pk.driver) {
        if (!pickerMap[pk.driver]) pickerMap[pk.driver] = [];
        pickerMap[pk.driver].push(pid);
      }
    });
  });

  const weekInfo = SCHEDULE.find(s => s.w === week);
  const maxScore = topDrivers[0]?.total || 1;

  return (
    <div>
      {/* Week selector */}
      <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:14 }}>
        {weeks.map(w => (
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

      {/* Race context */}
      {weekInfo && (
        <div style={{
          color:C.dim, fontSize:12, marginBottom:10,
          display:"flex", gap:8, alignItems:"center", flexWrap:"wrap",
        }}>
          <span style={{ color:C.text, fontWeight:700 }}>{weekInfo.r}</span>
          <span>@ {weekInfo.t}</span>
          <span style={{ color:TTC[weekInfo.ty], fontWeight:700 }}>
            {TTL[weekInfo.ty]} ×
          </span>
        </div>
      )}

      {/* Driver rows */}
      <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
        {topDrivers.map((d, i) => {
          const pickers    = pickerMap[d.name] || [];
          const wasPicked  = pickers.length > 0;
          const barW       = maxScore > 0 ? (d.total / maxScore) * 100 : 0;
          const isMvp      = i === 0;
          return (
            <div key={d.name} style={{
              display:"flex", alignItems:"center", gap:10, padding:"10px 14px",
              background:isMvp ? C.accent+"10" : C.card,
              borderRadius:r.md,
              border:`1px solid ${isMvp ? C.accent+"44" : wasPicked ? C.border : C.red+"22"}`,
              boxShadow: isMvp ? shadow.glow(C.accent) : "none",
            }}>
              {/* Rank */}
              <div style={{
                width:28, height:28, borderRadius:"50%", flexShrink:0,
                background: isMvp ? C.accent : "rgba(255,255,255,0.06)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontFamily:"'Oswald',sans-serif", fontSize:13, fontWeight:900,
                color: isMvp ? "#000" : C.dim,
              }}>{i + 1}</div>

              {/* Name + bar */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                  <span style={{
                    color:isMvp ? C.accent : C.text,
                    fontWeight:700, fontSize:13,
                    fontFamily:"'Barlow Condensed',sans-serif",
                  }}>
                    {d.name}
                    {isMvp && <span style={{ marginLeft:6, fontSize:11 }}>👑 MVP</span>}
                  </span>
                  <MakeBadge driver={d.name} />
                </div>
                {/* Score bar */}
                <div style={{ height:3, background:C.border, borderRadius:r.pill, marginTop:4, maxWidth:200 }}>
                  <div style={{
                    height:"100%", width:`${barW}%`,
                    background: isMvp ? C.accent : C.green,
                    borderRadius:r.pill, opacity:0.8,
                  }}/>
                </div>
              </div>

              {/* Score */}
              <div style={{
                fontFamily:"'Oswald',sans-serif", fontSize:22, fontWeight:900,
                color: isMvp ? C.accent : C.text, flexShrink:0,
              }}>
                {d.total > 0 ? "+" : ""}{d.total}
              </div>

              {/* Picked / missed badge */}
              {wasPicked ? (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:3, flexShrink:0 }}>
                  {pickers.map(pid => (
                    <div key={pid} style={{
                      display:"flex", alignItems:"center", gap:4, padding:"2px 8px",
                      background:PClr[pid].bg, borderRadius:r.pill,
                      border:`1px solid ${PClr[pid].fg}44`,
                    }}>
                      <div style={{
                        width:8, height:8, borderRadius:"50%", background:PClr[pid].fg, flexShrink:0,
                      }}/>
                      <span style={{ color:PClr[pid].fg, fontSize:9, fontWeight:700 }}>
                        {PNAME[pid]}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <span style={{
                  fontSize:9, fontWeight:700, color:C.red,
                  background:C.red+"18", padding:"3px 8px", borderRadius:r.pill,
                  border:`1px solid ${C.red}33`, letterSpacing:0.5, flexShrink:0,
                }}>
                  MISSED 😤
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Section: Season Records ──────────────────────────────────────────────────

function SeasonRecords({ data, records }) {
  const { bestPlayerWeek, bestDriverPerf, winStreaks, currentStreaks } = records;

  const wins = Object.fromEntries(
    PLAYERS.map(p => [p.id, Object.values(data.results || {}).filter(r => r.scored?.[p.id]?.weeklyWin).length])
  );

  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:10 }}>

      {/* Best player week */}
      {bestPlayerWeek && (
        <div style={{
          background:PClr[bestPlayerWeek.pid].bg, borderRadius:r.lg,
          padding:"14px 16px", border:`2px solid ${C.accent}44`,
        }}>
          <div style={{ color:C.accent, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>
            🏆 Best Player Week
          </div>
          <div style={{
            color:PClr[bestPlayerWeek.pid].fg, fontFamily:"'Oswald',sans-serif",
            fontSize:28, fontWeight:900, lineHeight:1,
          }}>
            {bestPlayerWeek.score}
          </div>
          <div style={{ color:PClr[bestPlayerWeek.pid].fg+"88", fontSize:12, marginTop:4 }}>
            {PNAME[bestPlayerWeek.pid]} · W{bestPlayerWeek.week}
          </div>
          {bestPlayerWeek.race && (
            <div style={{ color:PClr[bestPlayerWeek.pid].fg+"55", fontSize:10, marginTop:2 }}>
              {bestPlayerWeek.race}
            </div>
          )}
        </div>
      )}

      {/* Best driver performance */}
      {bestDriverPerf && (
        <div style={{
          background:C.card, borderRadius:r.lg,
          padding:"14px 16px", border:`1px solid ${C.accent}44`,
        }}>
          <div style={{ color:C.accent, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>
            🚗 Best Driver Perf.
          </div>
          <div style={{
            color:C.text, fontFamily:"'Oswald',sans-serif",
            fontSize:24, fontWeight:900, lineHeight:1,
          }}>
            {bestDriverPerf.score}
          </div>
          <div style={{ color:C.textDim, fontSize:12, marginTop:4 }}>
            {bestDriverPerf.name} · W{bestDriverPerf.week}
          </div>
          <div style={{ marginTop:6 }}>
            {bestDriverPerf.pickedBy.length > 0 ? (
              <div style={{ display:"flex", gap:3 }}>
                {bestDriverPerf.pickedBy.map(pid => (
                  <span key={pid} style={{
                    fontSize:9, fontWeight:700, color:PClr[pid].fg,
                    background:PClr[pid].bg, padding:"2px 6px", borderRadius:r.pill,
                    border:`1px solid ${PClr[pid].fg}44`,
                  }}>{PNAME[pid]}</span>
                ))}
              </div>
            ) : (
              <span style={{ fontSize:9, color:C.red, fontWeight:700 }}>Not picked 😤</span>
            )}
          </div>
        </div>
      )}

      {/* Win counts */}
      {PLAYERS.map(p => (
        <div key={p.id} style={{
          background:PClr[p.id].bg, borderRadius:r.lg,
          padding:"14px 16px", border:`1px solid ${PClr[p.id].bg==="#000000" ? C.border : PClr[p.id].bg+"66"}`,
        }}>
          <div style={{ color:PClr[p.id].fg+"77", fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:6 }}>
            {PNAME[p.id]}
          </div>
          <div style={{
            color:PClr[p.id].fg, fontFamily:"'Oswald',sans-serif",
            fontSize:32, fontWeight:900, lineHeight:1,
          }}>
            {wins[p.id]}
            <span style={{ fontSize:14, fontWeight:400, color:PClr[p.id].fg+"77" }}> W</span>
          </div>
          <div style={{ color:PClr[p.id].fg+"66", fontSize:11, marginTop:4 }}>
            Best streak: {winStreaks[p.id]}
            {currentStreaks[p.id] > 0 && (
              <span style={{ color:C.green, marginLeft:6, fontWeight:700 }}>
                🔥 on {currentStreaks[p.id]}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main StatsTab ────────────────────────────────────────────────────────────

const SECTIONS = [
  { id:"leaderboard", label:"Driver Leaderboard" },
  { id:"weekly",      label:"Weekly Top Performers" },
  { id:"records",     label:"Season Records"   },
];

export function StatsTab({ data }) {
  const [section, setSection] = useState("leaderboard");

  const driverStats = useMemo(() => getDriverSeasonStats(data), [data]);
  const records     = useMemo(() => getSeasonRecords(data),     [data]);

  const scoredWeeks = Object.keys(data.results || {}).filter(k => data.results[k].raw?.drivers).length;

  return (
    <div style={{ padding:20, maxWidth:960, margin:"0 auto", position:"relative", zIndex:1 }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom:20 }}>
        <h2 style={{ color:C.text, fontFamily:"'Oswald',sans-serif", fontSize:26, letterSpacing:1, margin:0 }}>
          Stats
        </h2>
        <div style={{ color:C.dim, fontSize:13, marginTop:4 }}>
          {scoredWeeks} races · {driverStats.length} drivers tracked · FERDA scoring
        </div>
      </div>

      {/* ── Section tabs ──────────────────────────────────────────────────── */}
      <div style={{ display:"flex", gap:4, marginBottom:20, borderBottom:`1px solid ${C.border}`, paddingBottom:12 }}>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{
            padding:"8px 16px", borderRadius:r.pill,
            border:`1px solid ${section === s.id ? C.accent : C.border}`,
            background:section === s.id ? C.accent : "transparent",
            color:section === s.id ? "#000" : C.dim,
            fontSize:12, fontWeight:700, cursor:"pointer",
            fontFamily:"'Oswald',sans-serif", letterSpacing:1,
            transition:"all 0.12s ease",
          }}>{s.label}</button>
        ))}
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div style={{ background:C.card, borderRadius:r.lg, padding:16, border:`1px solid ${C.border}` }}>
        {section === "leaderboard" && <DriverLeaderboard driverStats={driverStats} />}
        {section === "weekly"      && <WeeklyTopPerformers data={data} />}
        {section === "records"     && <SeasonRecords data={data} records={records} />}
      </div>

      {/* ── Footnote ──────────────────────────────────────────────────────── */}
      <div style={{ color:C.muted, fontSize:10, marginTop:12, textAlign:"center" }}>
        All scores computed using FERDA rules (full scoring, not mulligan). "Times Picked" counts each pick across all 4 players.
      </div>
    </div>
  );
}
