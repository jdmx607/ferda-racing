import { useState } from "react";
import { C, PClr, r, shadow } from "../theme";
import { PLAYERS, PNAME } from "../constants";
import { saveLeagueData } from "../firebase";

// ── 2026 NASCAR In-Season Challenge bracket ───────────────────────────────────

const R1 = [
  // Left side (seeds 1,4,5,8,9,12,13,16 and their opponents)
  { id:"L1A", s1:1,  d1:"#45 Tyler Reddick",       s2:32, d2:"#48 Alex Bowman"           },
  { id:"L1B", s1:16, d1:"#2 Austin Cindric",        s2:17, d2:"#6 Brad Keselowski"        },
  { id:"L1C", s1:8,  d1:"#7 Daniel Suarez",         s2:25, d2:"#34 Todd Gilliland"        },
  { id:"L1D", s1:9,  d1:"#77 Carson Hocevar",       s2:24, d2:"#38 Zane Smith"            },
  { id:"L1E", s1:12, d1:"#19 Chase Briscoe",        s2:21, d2:"#16 AJ Allmendinger"       },
  { id:"L1F", s1:5,  d1:"#54 Ty Gibbs",             s2:28, d2:"#3 Austin Dillon"          },
  { id:"L1G", s1:13, d1:"#23 Bubba Wallace",        s2:20, d2:"#71 Michael McDowell"      },
  { id:"L1H", s1:4,  d1:"#9 Chase Elliott",         s2:29, d2:"#4 Noah Gragson"           },
  // Right side (seeds 2,3,6,7,10,11,14,15 and their opponents)
  { id:"R1A", s1:2,  d1:"#11 Denny Hamlin",         s2:31, d2:"#10 Ty Dillon"             },
  { id:"R1B", s1:15, d1:"#43 Erik Jones",           s2:18, d2:"#22 Joey Logano"           },
  { id:"R1C", s1:7,  d1:"#17 Chris Buescher",       s2:26, d2:"#42 John Hunter Nemechek"  },
  { id:"R1D", s1:10, d1:"#20 Christopher Bell",     s2:23, d2:"#1 Ross Chastain"          },
  { id:"R1E", s1:11, d1:"#24 William Byron",        s2:22, d2:"#47 Ricky Stenhouse Jr"    },
  { id:"R1F", s1:6,  d1:"#5 Kyle Larson",           s2:27, d2:"#35 Riley Herbst"          },
  { id:"R1G", s1:14, d1:"#97 Shane Van Gisbergen",  s2:19, d2:"#60 Ryan Preece"           },
  { id:"R1H", s1:3,  d1:"#12 Ryan Blaney",          s2:30, d2:"#21 Josh Berry"            },
];

// Which two matchups feed into each subsequent-round matchup
const FEEDS = {
  L2A:["L1A","L1B"], L2B:["L1C","L1D"], L2C:["L1E","L1F"], L2D:["L1G","L1H"],
  R2A:["R1A","R1B"], R2B:["R1C","R1D"], R2C:["R1E","R1F"], R2D:["R1G","R1H"],
  L3A:["L2A","L2B"], L3B:["L2C","L2D"],
  R3A:["R2A","R2B"], R3B:["R2C","R2D"],
  L4A:["L3A","L3B"], R4A:["R3A","R3B"],
  CHAMP:["L4A","R4A"],
};

const ROUNDS = [
  { id:"r1", label:"R1",  full:"Challenge Round 1", track:"Sonoma",          ids:R1.map(m=>m.id) },
  { id:"r2", label:"R2",  full:"Challenge Round 2", track:"Chicagoland",     ids:["L2A","L2B","L2C","L2D","R2A","R2B","R2C","R2D"] },
  { id:"r3", label:"R3",  full:"Challenge Round 3", track:"EchoPark",        ids:["L3A","L3B","R3A","R3B"] },
  { id:"r4", label:"R4",  full:"Challenge Round 4", track:"N. Wilkesboro",   ids:["L4A","R4A"] },
  { id:"r5", label:"🏆",  full:"Champions Round",   track:"Indianapolis",    ids:["CHAMP"] },
];

// Downstream dependency map — changing X invalidates all matchups in DOWNSTREAM[X]
const DOWNSTREAM = {};
for (const m of R1) DOWNSTREAM[m.id] = [];
for (const id of Object.keys(FEEDS)) if (!DOWNSTREAM[id]) DOWNSTREAM[id] = [];
for (const [child, parents] of Object.entries(FEEDS)) {
  for (const p of parents) DOWNSTREAM[p].push(child);
}

function clearDown(id, obj) {
  for (const child of DOWNSTREAM[id] || []) {
    delete obj[child];
    clearDown(child, obj);
  }
}

// Get the two participants for a matchup from a given state dict (picks or results)
function getParts(id, state) {
  const r1m = R1.find(m => m.id === id);
  if (r1m) return [{d:r1m.d1, s:r1m.s1}, {d:r1m.d2, s:r1m.s2}];
  const [a, b] = FEEDS[id] || [];
  return [{d:state[a]||null, s:null}, {d:state[b]||null, s:null}];
}

// Scoring: R1=1pt, R2=2pts, R3=4pts, R4=8pts, Champion=25pts
const RND_PTS = { r1:1, r2:2, r3:4, r4:8 };
function calcScore(picks, results) {
  if (!results || !picks) return 0;
  let tot = 0;
  for (const rnd of ROUNDS.slice(0, -1)) {
    const w = RND_PTS[rnd.id] || 0;
    for (const id of rnd.ids) {
      if (results[id] && picks[id] === results[id]) tot += w;
    }
  }
  if (results.CHAMP && picks.CHAMP === results.CHAMP) tot += 25;
  return tot;
}

// ── Matchup card ──────────────────────────────────────────────────────────────
function MatchupCard({ id, picks, results, onPick, locked }) {
  const parts  = getParts(id, picks);
  const chosen = picks[id] || null;
  const actual = results?.[id] || null;
  const bothKnown = parts[0]?.d && parts[1]?.d;

  return (
    <div style={{
      background:C.card, borderRadius:r.md, overflow:"hidden",
      border:`1px solid ${actual ? "#10b98133" : C.border}`,
      marginBottom:6,
    }}>
      {!bothKnown ? (
        <div style={{ padding:"8px 10px", color:C.muted, fontSize:10, fontStyle:"italic" }}>
          Complete earlier rounds first
        </div>
      ) : parts.map(({d, s}, i) => {
        const isPicked  = chosen === d;
        const isCorrect = !!actual && actual === d && chosen === d;
        const isWrong   = !!actual && actual !== d && chosen === d;
        const isActual  = !!actual && actual === d;
        const canClick  = !locked && !actual && bothKnown;

        let leftBorder = "3px solid transparent";
        let bg = "transparent";
        let fg = C.dim;

        if (isPicked && !actual) { leftBorder=`3px solid ${C.accent}`; bg=C.accent+"18"; fg=C.accent; }
        if (isCorrect) { leftBorder="3px solid #10b981"; bg="#10b98118"; fg="#10b981"; }
        if (isWrong)   { leftBorder="3px solid #ef4444"; bg="#ef444418"; fg="#ef4444"; }
        if (isActual && !isPicked) fg="#10b98166";

        return (
          <button key={i} onClick={() => canClick && onPick(id, d)} style={{
            width:"100%", display:"flex", alignItems:"center", gap:6,
            padding:"8px 10px",
            background:bg,
            border:"none", borderTop:i>0?`1px solid ${C.border}22`:"none",
            borderLeft:leftBorder,
            cursor:canClick?"pointer":"default", textAlign:"left",
          }}>
            {s !== null && (
              <span style={{ color:C.muted, fontSize:9, fontWeight:700, width:14, flexShrink:0, textAlign:"right" }}>
                {s}
              </span>
            )}
            <span style={{
              color:fg, fontSize:11, fontWeight:isPicked||isActual?700:400,
              flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
            }}>{d}</span>
            <span style={{ fontSize:9, flexShrink:0 }}>
              {isCorrect && <span style={{color:"#10b981"}}>✓</span>}
              {isWrong   && <span style={{color:"#ef4444"}}>✗</span>}
              {isPicked && !actual && <span style={{color:C.accent}}>●</span>}
              {isActual && !isPicked && <span style={{color:"#10b98166"}}>WIN</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function ISCTab({ data, setData, user }) {
  const [view,   setView  ] = useState("bracket");
  const [round,  setRound ] = useState("r1");
  const [saving, setSaving] = useState(false);

  const isc      = data.iscBracket || {};
  const myPicks  = isc.picks?.[user?.id] || {};
  const results  = isc.results || {};
  const locked   = !!isc.locked;
  const isCommish = user?.id === "justin";
  const champion  = results.CHAMP || null;

  async function save(newData) {
    setData(newData);
    setSaving(true);
    try { await saveLeagueData(newData); } finally { setSaving(false); }
  }

  async function pick(matchupId, driver) {
    const newPicks = { ...myPicks, [matchupId]: driver };
    clearDown(matchupId, newPicks);
    save({ ...data, iscBracket: { ...isc, picks: { ...isc.picks, [user.id]: newPicks } } });
  }

  async function setResult(matchupId, driver) {
    const newResults = { ...results, [matchupId]: driver };
    clearDown(matchupId, newResults);
    save({ ...data, iscBracket: { ...isc, results: newResults } });
  }

  async function clearResult(matchupId) {
    const newResults = { ...results };
    delete newResults[matchupId];
    clearDown(matchupId, newResults);
    save({ ...data, iscBracket: { ...isc, results: newResults } });
  }

  async function toggleLock() {
    save({ ...data, iscBracket: { ...isc, locked: !locked } });
  }

  const activeRound = ROUNDS.find(rd => rd.id === round);
  const leftIds  = activeRound?.ids.filter(id => !id.startsWith("R")) || [];
  const rightIds = activeRound?.ids.filter(id =>  id.startsWith("R")) || [];

  const scores = PLAYERS
    .map(p => ({
      ...p,
      score: calcScore(isc.picks?.[p.id] || {}, results),
      champ: isc.picks?.[p.id]?.CHAMP || null,
    }))
    .sort((a, b) => b.score - a.score);

  return (
    <div style={{ padding:20, maxWidth:900, margin:"0 auto", position:"relative", zIndex:1 }}>

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom:20 }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
          <div>
            <h2 style={{ color:C.text, fontFamily:"'Oswald',sans-serif", fontSize:26, letterSpacing:1, margin:0 }}>
              In-Season Challenge
            </h2>
            <div style={{ color:C.dim, fontSize:13, marginTop:4 }}>
              32-driver bracket · Correct champion pick = +25 fantasy pts
            </div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            {saving && <span style={{ color:C.muted, fontSize:11 }}>Saving…</span>}
            {locked && (
              <span style={{
                padding:"4px 10px", borderRadius:r.pill,
                background:"#f59e0b22", border:`1px solid #f59e0b44`,
                color:"#f59e0b", fontSize:10, fontWeight:700,
              }}>🔒 LOCKED</span>
            )}
            {champion && (
              <div style={{
                padding:"6px 14px", borderRadius:r.pill,
                background:C.accent+"22", border:`1px solid ${C.accent}55`,
                color:C.accent, fontSize:12, fontWeight:700,
              }}>🏆 {champion}</div>
            )}
          </div>
        </div>
      </div>

      {/* ── View tabs ─────────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", gap:4, marginBottom:20, borderBottom:`1px solid ${C.border}`, paddingBottom:12, flexWrap:"wrap" }}>
        {[
          { id:"bracket",   label:"My Bracket"   },
          { id:"standings", label:"Standings"     },
          ...(isCommish ? [{ id:"admin", label:"🔑 Results" }] : []),
        ].map(v => (
          <button key={v.id} onClick={() => setView(v.id)} style={{
            padding:"7px 14px", borderRadius:r.pill,
            border:`1px solid ${view===v.id ? C.accent : C.border}`,
            background:view===v.id ? C.accent : "transparent",
            color:view===v.id ? "#000" : C.dim,
            fontSize:11, fontWeight:700, cursor:"pointer",
            fontFamily:"'Oswald',sans-serif", letterSpacing:1,
          }}>{v.label}</button>
        ))}
      </div>

      {/* ── MY BRACKET ────────────────────────────────────────────────────────── */}
      {view === "bracket" && (
        <div>
          {/* Round selector */}
          <div style={{ display:"flex", gap:4, marginBottom:14, overflowX:"auto", paddingBottom:4 }}>
            {ROUNDS.map(rnd => {
              const done = rnd.ids.every(id => myPicks[id]);
              return (
                <button key={rnd.id} onClick={() => setRound(rnd.id)} style={{
                  padding:"8px 12px", borderRadius:r.md, whiteSpace:"nowrap", flexShrink:0,
                  border:`1px solid ${round===rnd.id ? C.accent : C.border}`,
                  background:round===rnd.id ? C.card : "transparent",
                  color:round===rnd.id ? C.text : C.muted,
                  fontSize:11, fontWeight:700, cursor:"pointer",
                  fontFamily:"'Oswald',sans-serif", position:"relative",
                }}>
                  <div>{rnd.label}</div>
                  <div style={{ color:C.dim, fontSize:9, fontWeight:400, marginTop:1 }}>{rnd.track}</div>
                  {done && (
                    <span style={{
                      position:"absolute", top:4, right:4,
                      width:5, height:5, borderRadius:"50%", background:"#10b981",
                    }}/>
                  )}
                </button>
              );
            })}
          </div>

          {/* Round info bar */}
          <div style={{
            padding:"10px 14px", marginBottom:12,
            background:C.card, borderRadius:r.md, border:`1px solid ${C.border}`,
            display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8,
          }}>
            <div>
              <span style={{ color:C.accent, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:2 }}>
                {activeRound?.full}
              </span>
              <span style={{ color:C.muted, fontSize:11, marginLeft:10 }}>@ {activeRound?.track}</span>
            </div>
            <span style={{ color:C.muted, fontSize:11 }}>
              {activeRound?.ids.filter(id => myPicks[id]).length} / {activeRound?.ids.length} picked
            </span>
          </div>

          {locked && (
            <div style={{
              padding:"10px 14px", marginBottom:12,
              background:"#f59e0b15", borderRadius:r.md, border:`1px solid #f59e0b33`,
              color:"#f59e0b", fontSize:12, textAlign:"center",
            }}>
              🔒 Bracket is locked — picks are final.
            </div>
          )}

          {/* Matchup grid */}
          {round === "r5" ? (
            <div style={{ maxWidth:420, margin:"0 auto" }}>
              <div style={{ color:C.muted, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:8, textAlign:"center" }}>
                🏆 Pick the Champion
              </div>
              <MatchupCard id="CHAMP" picks={myPicks} results={results} onPick={pick} locked={locked} />
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div>
                <div style={{ color:C.muted, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>
                  Left Bracket
                </div>
                {leftIds.map(id => (
                  <MatchupCard key={id} id={id} picks={myPicks} results={results} onPick={pick} locked={locked} />
                ))}
              </div>
              <div>
                <div style={{ color:C.muted, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>
                  Right Bracket
                </div>
                {rightIds.map(id => (
                  <MatchupCard key={id} id={id} picks={myPicks} results={results} onPick={pick} locked={locked} />
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop:16, color:C.dim, fontSize:10, textAlign:"center" }}>
            Click a driver to advance them. Changing an earlier pick clears downstream selections.
          </div>
        </div>
      )}

      {/* ── STANDINGS ──────────────────────────────────────────────────────────── */}
      {view === "standings" && (
        <div>
          {/* Champion pick comparison card */}
          <div style={{
            background:C.card, borderRadius:r.md, padding:"14px 16px", marginBottom:16,
            border:`1px solid ${C.border}`,
          }}>
            <div style={{ color:C.muted, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>
              Champion Picks
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {PLAYERS.map(p => {
                const champ   = isc.picks?.[p.id]?.CHAMP || null;
                const correct = champion && champ === champion;
                return (
                  <div key={p.id} style={{
                    flex:"1 1 110px", padding:"10px 12px",
                    background:PClr[p.id].bg, borderRadius:r.md,
                    border:`2px solid ${correct ? "#10b981" : PClr[p.id].bg==="#000000"?C.border:PClr[p.id].bg+"44"}`,
                  }}>
                    <div style={{ color:PClr[p.id].fg, fontSize:10, fontWeight:700, marginBottom:4 }}>
                      {PNAME[p.id]}
                    </div>
                    <div style={{ color:correct ? "#10b981" : PClr[p.id].fg+"99", fontSize:11, fontWeight:correct?700:400 }}>
                      {champ || <span style={{fontStyle:"italic", fontSize:10}}>Not picked yet</span>}
                    </div>
                    {correct && <div style={{ color:"#10b981", fontSize:9, marginTop:3 }}>🎯 +25 pts</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Player standings */}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {scores.map((p, i) => {
              const correctChamp = champion && p.champ === champion;
              return (
                <div key={p.id} style={{
                  background:PClr[p.id].bg, borderRadius:r.lg, overflow:"hidden",
                  border:`2px solid ${i===0 ? C.accent : PClr[p.id].bg==="#000000" ? C.border : PClr[p.id].bg+"66"}`,
                  boxShadow:i===0 ? shadow.glow(C.accent) : shadow.card,
                }}>
                  <div style={{ padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{
                        width:36, height:36, borderRadius:r.md, flexShrink:0,
                        background:PClr[p.id].fg+"22", border:`2px solid ${PClr[p.id].fg}44`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontFamily:"'Oswald',sans-serif", fontSize:18, fontWeight:900, color:PClr[p.id].fg,
                      }}>{i+1}</div>
                      <div>
                        <div style={{ color:PClr[p.id].fg, fontFamily:"'Oswald',sans-serif", fontSize:18, fontWeight:900, lineHeight:1 }}>
                          {PNAME[p.id].toUpperCase()}
                        </div>
                        <div style={{ color:PClr[p.id].fg+"77", fontSize:10, marginTop:3 }}>
                          Pick: <span style={{
                            fontWeight:700,
                            color: correctChamp ? "#10b981" : !champion ? PClr[p.id].fg+"88" : "#ef444499",
                          }}>
                            {p.champ || "—"}
                          </span>
                          {correctChamp && " 🎯 +25 pts"}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{
                        fontFamily:"'Oswald',sans-serif", fontSize:34, fontWeight:900, lineHeight:1,
                        color: p.score > 0 ? C.accent : PClr[p.id].fg,
                      }}>{p.score}</div>
                      <div style={{ color:PClr[p.id].fg+"44", fontSize:9, textTransform:"uppercase" }}>ISC pts</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop:14, textAlign:"center", color:C.muted, fontSize:10 }}>
            R1: 1 pt · R2: 2 pts · R3: 4 pts · R4: 8 pts · Champion: 25 pts
          </div>
        </div>
      )}

      {/* ── ADMIN: ENTER RESULTS (commissioner only) ──────────────────────────── */}
      {view === "admin" && isCommish && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:8 }}>
            <div style={{ color:C.dim, fontSize:13 }}>
              Click the actual winner of each matchup. Enter rounds in order — results cascade forward.
            </div>
            <button onClick={toggleLock} style={{
              padding:"7px 14px", borderRadius:r.pill,
              border:`1px solid ${locked ? "#10b981" : "#f59e0b"}`,
              background:locked ? "#10b98122" : "#f59e0b22",
              color:locked ? "#10b981" : "#f59e0b",
              fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
            }}>
              {locked ? "🔓 Unlock Bracket" : "🔒 Lock Bracket"}
            </button>
          </div>

          {ROUNDS.map(rnd => (
            <div key={rnd.id} style={{ marginBottom:20 }}>
              <div style={{ color:C.accent, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>
                {rnd.full} — {rnd.track}
              </div>
              {rnd.ids.map(id => {
                // Use results (not player picks) to determine later-round participants
                const parts  = getParts(id, results);
                const actual = results[id] || null;
                const ready  = parts[0]?.d && parts[1]?.d;

                return (
                  <div key={id} style={{
                    background:C.card, borderRadius:r.md, padding:"10px 14px",
                    border:`1px solid ${actual ? "#10b98133" : C.border}`,
                    marginBottom:6,
                    display:"flex", alignItems:"center", gap:10, flexWrap:"wrap",
                  }}>
                    <span style={{ color:C.muted, fontSize:9, fontWeight:700, width:40, flexShrink:0 }}>{id}</span>
                    {!ready && (
                      <span style={{ color:C.muted, fontSize:11, fontStyle:"italic" }}>
                        Enter earlier rounds first
                      </span>
                    )}
                    {parts.map(({d}, i) => {
                      if (!d) return null;
                      const isActual = actual === d;
                      return (
                        <button key={i} onClick={() => setResult(id, d)} style={{
                          padding:"5px 14px", borderRadius:r.pill,
                          border:`1px solid ${isActual ? "#10b981" : C.border}`,
                          background:isActual ? "#10b98122" : "transparent",
                          color:isActual ? "#10b981" : C.dim,
                          fontSize:12, fontWeight:isActual?700:400,
                          cursor:"pointer", fontFamily:"inherit",
                        }}>{d}</button>
                      );
                    })}
                    {actual && (
                      <button onClick={() => clearResult(id)} style={{
                        marginLeft:"auto", padding:"3px 8px", borderRadius:r.pill,
                        border:`1px solid #ef444433`, background:"transparent",
                        color:"#ef444466", fontSize:10, cursor:"pointer", fontFamily:"inherit",
                      }}>✕ Clear</button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
