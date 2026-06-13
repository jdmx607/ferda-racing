import { useState, useMemo, useEffect } from "react";
import { C, PClr, TTC, TTL, r, shadow } from "../theme";
import { PLAYERS, PNAME, SCHEDULE, TRACK_MULTS } from "../constants";
import { generateFullRecap, generateWeekPreview, getSeasonStorylines } from "../engine/narrative";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function posColor(pos) {
  return pos === 1 ? "#f59e0b" : pos === 2 ? "#94a3b8" : pos === 3 ? "#cd7f32" : "#ef4444";
}

function PidChip({ pid }) {
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:4, padding:"2px 8px",
      background:PClr[pid].bg, borderRadius:r.pill,
      border:`1px solid ${PClr[pid].bg==="#000000"?C.border:PClr[pid].bg+"55"}`,
    }}>
      <div style={{ width:6, height:6, borderRadius:"50%", background:PClr[pid].fg }}/>
      <span style={{ color:PClr[pid].fg, fontSize:10, fontWeight:700 }}>{PNAME[pid]}</span>
    </span>
  );
}

// ─── Section: Race Recap ──────────────────────────────────────────────────────

function RecapCard({ recap }) {
  if (!recap) return (
    <div style={{ background:C.card, borderRadius:r.lg, padding:"40px 32px", textAlign:"center", border:`1px solid ${C.border}` }}>
      <div style={{ color:C.muted, fontSize:14 }}>No scored weeks yet</div>
    </div>
  );

  const { weekWinner, weekLoser, weekStandings, marginOfVictory,
          raceWinner, raceWinnerPickers, topDrivers,
          mvp, biggestMiss, bestPickedDriver, mulliganReport } = recap;

  const maxScore = weekStandings[0]?.total || 1;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

      {/* ── Week header ──────────────────────────────────────────────── */}
      <div style={{
        background:"linear-gradient(135deg, #1a1000, #0a0e17)",
        borderRadius:r.lg, padding:"18px 20px",
        border:`1px solid ${C.accent}44`,
        boxShadow:shadow.glow(C.accent),
      }}>
        <div style={{ color:C.accent, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:4 }}>
          Race Recap — W{recap.week}
        </div>
        <div style={{ color:C.text, fontFamily:"'Oswald',sans-serif", fontSize:22, fontWeight:900, letterSpacing:1 }}>
          {recap.raceName}
        </div>
        <div style={{ color:C.dim, fontSize:13, marginTop:3 }}>
          @ {recap.track} · {recap.date} ·{" "}
          <span style={{ color:TTC[recap.trackType], fontWeight:700 }}>{TTL[recap.trackType]} ×{TRACK_MULTS[recap.trackType]}</span>
          {recap.threeStages && <span style={{ color:C.purple, marginLeft:8, fontWeight:700 }}>3 STAGES</span>}
        </div>
      </div>

      {/* ── Week standings ───────────────────────────────────────────── */}
      <div style={{ background:C.card, borderRadius:r.lg, padding:16, border:`1px solid ${C.border}` }}>
        <div style={{ color:C.muted, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>
          Final Standings
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {weekStandings.map(s => {
            const barW = maxScore > 0 ? (s.total / maxScore) * 100 : 0;
            return (
              <div key={s.pid}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:3 }}>
                  <span style={{
                    fontFamily:"'Oswald',sans-serif", fontSize:14, fontWeight:900,
                    color:posColor(s.position), width:18, textAlign:"center", flexShrink:0,
                  }}>
                    {s.weeklyWin ? "👑" : s.position}
                  </span>
                  <div style={{
                    width:28, height:28, borderRadius:"50%", flexShrink:0,
                    background:PClr[s.pid].bg, border:`2px solid ${PClr[s.pid].fg}44`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontFamily:"'Oswald',sans-serif", fontSize:12, fontWeight:900,
                    color:PClr[s.pid].fg,
                  }}>{PNAME[s.pid][0]}</div>
                  <span style={{ color:PClr[s.pid].fg === "#AA0000" ? C.text : PClr[s.pid].fg, fontWeight:700, fontSize:14, flex:1 }}>
                    {PNAME[s.pid]}
                    {s.weeklyWin && <span style={{ color:C.accent, fontSize:10, marginLeft:6 }}>+25 PP</span>}
                  </span>
                  <span style={{
                    fontFamily:"'Oswald',sans-serif", fontSize:18, fontWeight:900,
                    color:posColor(s.position),
                  }}>{s.total}</span>
                </div>
                <div style={{ marginLeft:56, height:4, background:C.border, borderRadius:r.pill, overflow:"hidden" }}>
                  <div style={{
                    height:"100%", width:`${barW}%`,
                    background:posColor(s.position), opacity:0.7,
                    transition:"width 0.6s ease",
                  }}/>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ color:C.muted, fontSize:11, marginTop:10 }}>
          Margin of victory: <span style={{ color:C.text, fontWeight:700 }}>{marginOfVictory} pts</span>
        </div>
      </div>

      {/* ── The story ────────────────────────────────────────────────── */}
      <div style={{ background:C.card, borderRadius:r.lg, padding:16, border:`1px solid ${C.border}` }}>
        <div style={{ color:C.muted, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:12 }}>
          The Story
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>

          {/* Race winner */}
          {raceWinner && (
            <div style={{ display:"flex", gap:10 }}>
              <span style={{ fontSize:18, flexShrink:0 }}>🏁</span>
              <div style={{ color:C.textDim, fontSize:13, lineHeight:1.6 }}>
                <span style={{ color:C.text, fontWeight:700 }}>{raceWinner}</span> won the race.{" "}
                {raceWinnerPickers.length > 0 ? (
                  <>Picked by {raceWinnerPickers.map((pid, i) => (
                    <span key={pid}><PidChip pid={pid} />{i < raceWinnerPickers.length - 1 ? " " : ""}</span>
                  ))} — that's the race-winner pick bonus.</>
                ) : (
                  <span style={{ color:C.red }}>Nobody had them in their lineup.</span>
                )}
              </div>
            </div>
          )}

          {/* MVP driver */}
          {mvp && (
            <div style={{ display:"flex", gap:10 }}>
              <span style={{ fontSize:18, flexShrink:0 }}>⭐</span>
              <div style={{ color:C.textDim, fontSize:13, lineHeight:1.6 }}>
                <span style={{ color:C.accent, fontWeight:700 }}>Driver of the Week:</span>{" "}
                <span style={{ color:C.text, fontWeight:700 }}>{mvp.name}</span> scored{" "}
                <span style={{ color:C.accent, fontWeight:700 }}>{mvp.total} pts</span>.{" "}
                {bestPickedDriver && bestPickedDriver.name === mvp.name ? (
                  <>Picked by {bestPickedDriver.pickedBy.map((pid, i) => (
                    <span key={pid}><PidChip pid={pid} />{i < bestPickedDriver.pickedBy.length - 1 ? " " : ""}</span>
                  ))} — they cashed in.</>
                ) : (
                  <span style={{ color:C.red }}>Nobody drafted them. 😤</span>
                )}
              </div>
            </div>
          )}

          {/* Biggest miss */}
          {biggestMiss && biggestMiss.name !== mvp?.name && (
            <div style={{ display:"flex", gap:10 }}>
              <span style={{ fontSize:18, flexShrink:0 }}>😤</span>
              <div style={{ color:C.textDim, fontSize:13, lineHeight:1.6 }}>
                <span style={{ color:C.text, fontWeight:700 }}>{biggestMiss.name}</span> scored{" "}
                <span style={{ color:C.red, fontWeight:700 }}>{biggestMiss.total} pts</span> and was left on the board by everyone.
              </div>
            </div>
          )}

          {/* Winner storyline */}
          {weekWinner && (
            <div style={{ display:"flex", gap:10 }}>
              <span style={{ fontSize:18, flexShrink:0 }}>👑</span>
              <div style={{ color:C.textDim, fontSize:13, lineHeight:1.6 }}>
                <PidChip pid={weekWinner.pid} /> wins W{recap.week} with{" "}
                <span style={{ color:C.text, fontWeight:700 }}>{weekWinner.total} pts</span> — earns +25 playoff points.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Top driver performances ───────────────────────────────────── */}
      <div style={{ background:C.card, borderRadius:r.lg, padding:16, border:`1px solid ${C.border}` }}>
        <div style={{ color:C.muted, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>
          Top Drivers This Week
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          {topDrivers.slice(0,5).map((d, i) => {
            const allPicks = data => {
              const key = "w" + recap.week;
              const m   = {};
              Object.entries(data.picks?.[key] || {}).forEach(([pid, picks]) => {
                (picks||[]).forEach(pk => {
                  if (pk.driver) {
                    if (!m[pk.driver]) m[pk.driver] = [];
                    m[pk.driver].push(pid);
                  }
                });
              });
              return m;
            };
            return (
              <div key={d.name} style={{
                display:"flex", alignItems:"center", gap:10, padding:"8px 12px",
                background:i===0 ? C.accent+"0f" : "transparent",
                borderRadius:r.sm, border:`1px solid ${i===0?C.accent+"33":C.border+"44"}`,
              }}>
                <span style={{
                  fontFamily:"'Oswald',sans-serif", fontSize:14, fontWeight:900,
                  color:i===0?C.accent:C.muted, width:20, flexShrink:0,
                }}>
                  {i+1}
                </span>
                <span style={{ color:C.text, fontWeight:700, fontSize:13, flex:1 }}>
                  {d.name}{i===0&&" 👑"}
                </span>
                <span style={{
                  fontFamily:"'Oswald',sans-serif", fontSize:18, fontWeight:900,
                  color:i===0?C.accent:C.green,
                }}>
                  +{d.total}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Mulligan report ───────────────────────────────────────────── */}
      {mulliganReport.length > 0 && (
        <div style={{ background:C.card, borderRadius:r.lg, padding:16, border:`1px solid ${C.border}` }}>
          <div style={{ color:C.muted, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>
            Mulligan Report
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {mulliganReport.map((m, i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                <PidChip pid={m.pid} />
                {m.replacedDriver && (
                  <span style={{ color:C.red, fontSize:12 }}>OUT: {m.replacedDriver}</span>
                )}
                <span style={{ color:C.dim }}>→</span>
                <span style={{ color:C.green, fontSize:12, fontWeight:700 }}>IN: {m.replacement}</span>
                <span style={{ color:C.text, fontSize:12 }}>
                  {m.newScore != null ? `(${m.newScore} pts)` : ""}
                </span>
                {m.netGain != null && (
                  <span style={{
                    fontSize:10, fontWeight:700, padding:"1px 6px", borderRadius:r.pill,
                    color:m.helped ? C.green : C.red,
                    background:m.helped ? C.green+"22" : C.red+"22",
                  }}>
                    {m.helped ? "+" : ""}{m.netGain} net
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: Week Preview ────────────────────────────────────────────────────

function PreviewCard({ preview }) {
  if (!preview) return null;

  const { raceName, track, trackType, date, draftOrder,
          trackStats, racesOfType, pressureNarratives, cumStandings } = preview;

  const topPicks = trackStats.slice(0, 6);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

      {/* ── Race header ──────────────────────────────────────────────── */}
      <div style={{
        background:"linear-gradient(135deg, #001a10, #0a0e17)",
        borderRadius:r.lg, padding:"18px 20px",
        border:`1px solid ${TTC[trackType]}44`,
        boxShadow:shadow.glow(TTC[trackType]),
      }}>
        <div style={{ color:TTC[trackType], fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:4 }}>
          Up Next — W{preview.week}
        </div>
        <div style={{ color:C.text, fontFamily:"'Oswald',sans-serif", fontSize:22, fontWeight:900, letterSpacing:1 }}>
          {raceName}
        </div>
        <div style={{ color:C.dim, fontSize:13, marginTop:3 }}>
          @ {track} · {date} ·{" "}
          <span style={{ color:TTC[trackType], fontWeight:700 }}>{TTL[trackType]} ×{TRACK_MULTS[trackType]}</span>
        </div>
        {racesOfType > 0 && (
          <div style={{ color:C.muted, fontSize:11, marginTop:4 }}>
            {racesOfType} race{racesOfType>1?"s":""} at this track type scored this season
          </div>
        )}
      </div>

      {/* ── Draft order ──────────────────────────────────────────────── */}
      <div style={{ background:C.card, borderRadius:r.lg, padding:16, border:`1px solid ${C.border}` }}>
        <div style={{ color:C.muted, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>
          Draft Order (last week's loser picks first)
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {draftOrder.map((pid, i) => (
            <div key={pid} style={{
              flex:1, textAlign:"center", padding:"10px 6px",
              background:PClr[pid].bg, borderRadius:r.md,
              border:`1px solid ${i===0?C.accent+"66":PClr[pid].bg==="#000000"?C.border:PClr[pid].bg+"44"}`,
            }}>
              <div style={{ color:PClr[pid].fg+"77", fontSize:9, marginBottom:2 }}>#{i+1}</div>
              <div style={{
                color:PClr[pid].fg, fontFamily:"'Oswald',sans-serif",
                fontSize:13, fontWeight:700,
              }}>
                {PNAME[pid]}
              </div>
              {i===0 && (
                <div style={{ color:C.accent, fontSize:8, fontWeight:700, marginTop:2, letterSpacing:1 }}>FIRST PICK</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Top picks by track type ───────────────────────────────────── */}
      {topPicks.length > 0 && (
        <div style={{ background:C.card, borderRadius:r.lg, padding:16, border:`1px solid ${C.border}` }}>
          <div style={{ color:C.muted, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:4 }}>
            Best Drivers at {TTL[trackType]} Tracks This Season
          </div>
          <div style={{ color:C.muted, fontSize:10, marginBottom:10 }}>
            Average FERDA pts per {TTL[trackType]} race
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            {topPicks.map((s, i) => {
              const maxAvg = topPicks[0]?.avgScore || 1;
              return (
                <div key={s.name} style={{
                  display:"flex", alignItems:"center", gap:10, padding:"7px 10px",
                  background:i===0?C.accent+"0f":"transparent",
                  borderRadius:r.sm,
                  border:`1px solid ${i===0?C.accent+"33":C.border+"33"}`,
                }}>
                  <span style={{
                    fontFamily:"'Oswald',sans-serif", fontSize:13, fontWeight:900,
                    color:i===0?C.accent:C.muted, width:20, flexShrink:0,
                  }}>{i+1}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:C.text, fontWeight:700, fontSize:13 }}>{s.name}</div>
                    <div style={{ height:3, background:C.border, borderRadius:r.pill, marginTop:3, maxWidth:160 }}>
                      <div style={{
                        height:"100%",
                        width:`${(s.avgScore/maxAvg)*100}%`,
                        background:i===0?C.accent:TTC[trackType],
                        borderRadius:r.pill, opacity:0.7,
                      }}/>
                    </div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0 }}>
                    <div style={{
                      fontFamily:"'Oswald',sans-serif", fontSize:15, fontWeight:900,
                      color:i===0?C.accent:C.text,
                    }}>{s.avgScore}</div>
                    <div style={{ color:C.muted, fontSize:9 }}>{s.appearances} race{s.appearances>1?"s":""}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Standings pressure ────────────────────────────────────────── */}
      <div style={{ background:C.card, borderRadius:r.lg, padding:16, border:`1px solid ${C.border}` }}>
        <div style={{ color:C.muted, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:12 }}>
          Stakes This Week
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {pressureNarratives.map((n, i) => (
            <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
              <PidChip pid={n.pid} />
              <span style={{ color:C.textDim, fontSize:13, lineHeight:1.5 }}>{n.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Section: Season Storylines ───────────────────────────────────────────────

function StorylinesPanel({ storylines }) {
  if (!storylines.length) return (
    <div style={{ color:C.muted, textAlign:"center", padding:32 }}>No storylines yet — check back after a few races.</div>
  );
  const high   = storylines.filter(s => s.weight === "high");
  const others = storylines.filter(s => s.weight !== "high");
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {[...high, ...others].map((s, i) => (
        <div key={i} style={{
          display:"flex", gap:12, padding:"12px 14px",
          background:s.weight==="high" ? C.card : "transparent",
          borderRadius:r.md,
          border:`1px solid ${s.weight==="high" ? C.border : "transparent"}`,
          alignItems:"flex-start",
        }}>
          <span style={{ fontSize:20, flexShrink:0 }}>{s.icon}</span>
          <span style={{
            color:s.weight==="high" ? C.text : C.textDim,
            fontSize:13, lineHeight:1.6,
            fontWeight:s.weight==="high" ? 600 : 400,
          }}>
            {s.text}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Section: NASCAR News (Jayski) ───────────────────────────────────────────

function NascarNews() {
  const [items,     setItems    ] = useState([]);
  const [loading,   setLoading  ] = useState(true);
  const [error,     setError    ] = useState(null);
  const [source,    setSource   ] = useState("");
  const [fetchedAt, setFetchedAt] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jayski");
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setItems(json.items || []);
      setSource(json.source || "");
      setFetchedAt(Date.now());
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const fmtDate = (str) => {
    if (!str) return "";
    try {
      return new Date(str).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
    } catch { return str; }
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div style={{ color:C.muted, fontSize:11 }}>
          Jayski.com · NASCAR news
          {source && <span style={{ marginLeft:6, opacity:0.6 }}>via {source}</span>}
        </div>
        <button
          onClick={load} disabled={loading}
          style={{
            padding:"5px 12px", borderRadius:r.pill, border:`1px solid ${C.border}`,
            background:"transparent", color:loading ? C.muted : C.dim,
            fontSize:11, cursor:loading ? "default" : "pointer", fontFamily:"inherit",
          }}
        >
          {loading ? "Loading…" : "↻ Refresh"}
        </button>
      </div>

      {loading && !items.length && (
        <div style={{ textAlign:"center", color:C.muted, padding:"40px 0", fontSize:13 }}>
          Fetching Jayski…
        </div>
      )}

      {error && (
        <div style={{
          background:C.card, borderRadius:r.md, padding:"12px 16px",
          border:`1px solid ${C.red}44`, color:C.red, fontSize:13, marginBottom:12,
        }}>
          Couldn't load news: {error}
          <button onClick={load} style={{ marginLeft:12, color:C.accent, background:"none", border:"none", cursor:"pointer", fontSize:13 }}>
            Retry
          </button>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {items.map((item, i) => (
          <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration:"none" }}>
            <div style={{
              background:C.card, borderRadius:r.md, padding:"12px 14px",
              border:`1px solid ${C.border}`, transition:"border-color 0.12s",
            }}>
              <div style={{ color:C.text, fontWeight:600, fontSize:13, lineHeight:1.4, marginBottom: item.excerpt ? 5 : 0 }}>
                {item.title}
              </div>
              {item.excerpt && (
                <div style={{ color:C.textDim, fontSize:12, lineHeight:1.5, marginBottom:5 }}>
                  {item.excerpt}
                </div>
              )}
              {item.date && (
                <div style={{ color:C.muted, fontSize:11 }}>{fmtDate(item.date)}</div>
              )}
            </div>
          </a>
        ))}
      </div>

      {!loading && !error && items.length > 0 && (
        <div style={{ textAlign:"center", marginTop:12 }}>
          <a href="https://www.jayski.com" target="_blank" rel="noopener noreferrer"
            style={{ color:C.muted, fontSize:11, textDecoration:"none" }}>
            More at jayski.com →
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Main FeedTab ─────────────────────────────────────────────────────────────

const SECTIONS = [
  { id:"recap",      label:"Last Race Recap"   },
  { id:"preview",    label:"Next Race Preview"  },
  { id:"news",       label:"Jayski News"         },
  { id:"storylines", label:"Season Storylines"  },
  { id:"archive",    label:"Browse Recaps"      },
];

export function FeedTab({ data }) {
  const [section,    setSection]    = useState("recap");
  const [archiveWeek,setArchiveWeek]= useState(null);

  // Find last scored week and next race
  const scoredWeeks = Object.keys(data.results || {})
    .filter(k => data.results[k].scored && data.results[k].raw?.drivers)
    .map(k => parseInt(k.replace("w","")))
    .sort((a,b) => a-b);
  const lastWeek = scoredWeeks[scoredWeeks.length - 1] || null;
  const nextWeek = lastWeek ? lastWeek + 1 : 1;

  // Compute the selected recap week
  const recapWeek = section === "archive" ? (archiveWeek || lastWeek) : lastWeek;

  const recap      = useMemo(() => recapWeek ? generateFullRecap(recapWeek, data) : null, [recapWeek, data]);
  const preview    = useMemo(() => generateWeekPreview(nextWeek, data), [nextWeek, data]);
  const storylines = useMemo(() => getSeasonStorylines(data), [data]);

  // We need to pass data to RecapCard's top drivers section
  const recapWithData = recap ? { ...recap } : null;

  return (
    <div style={{ padding:20, maxWidth:760, margin:"0 auto", position:"relative", zIndex:1 }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom:20 }}>
        <h2 style={{ color:C.text, fontFamily:"'Oswald',sans-serif", fontSize:26, letterSpacing:1, margin:0 }}>
          Feed
        </h2>
        <div style={{ color:C.dim, fontSize:13, marginTop:4 }}>
          Race recaps · Week previews · Season storylines
        </div>
      </div>

      {/* ── Section tabs ──────────────────────────────────────────────────── */}
      <div style={{ display:"flex", gap:4, marginBottom:20, borderBottom:`1px solid ${C.border}`, paddingBottom:12, flexWrap:"wrap" }}>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{
            padding:"7px 14px", borderRadius:r.pill,
            border:`1px solid ${section===s.id ? C.accent : C.border}`,
            background:section===s.id ? C.accent : "transparent",
            color:section===s.id ? "#000" : C.dim,
            fontSize:11, fontWeight:700, cursor:"pointer",
            fontFamily:"'Oswald',sans-serif", letterSpacing:1,
            transition:"all 0.12s ease",
          }}>{s.label}</button>
        ))}
      </div>

      {/* ── Archive week selector ─────────────────────────────────────────── */}
      {section === "archive" && (
        <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:14 }}>
          {scoredWeeks.map(w => (
            <button key={w} onClick={() => setArchiveWeek(w)} style={{
              padding:"5px 10px", borderRadius:r.pill,
              border:`1px solid ${archiveWeek===w||(!archiveWeek&&w===lastWeek) ? C.accent : C.border}`,
              background:archiveWeek===w||(!archiveWeek&&w===lastWeek) ? C.accent : "transparent",
              color:archiveWeek===w||(!archiveWeek&&w===lastWeek) ? "#000" : C.dim,
              fontSize:11, fontWeight:700, cursor:"pointer",
              fontFamily:"'Oswald',sans-serif",
              transition:"all 0.12s ease",
            }}>W{w}</button>
          ))}
        </div>
      )}

      {/* ── Content ───────────────────────────────────────────────────────── */}
      {(section==="recap" || section==="archive") && <RecapCard recap={recapWithData} />}
      {section==="preview"    && (preview ? <PreviewCard preview={preview} /> : (
        <div style={{ color:C.muted, textAlign:"center", padding:40 }}>No upcoming race data available</div>
      ))}
      {section==="news"       && <NascarNews />}
      {section==="storylines" && <StorylinesPanel storylines={storylines} />}
    </div>
  );
}
