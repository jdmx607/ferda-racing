import { useMemo, useState, useEffect } from "react";
import { C, PClr, TTC, TTL, r, shadow, sp } from "../theme";
import { PLAYERS, PNAME, SCHEDULE, MAX_MULLIGANS, TRACK_MULTS } from "../constants";

const MONTH_IDX = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};

function getRaceMs(dateStr) {
  if (!dateStr) return null;
  const [mon, day] = dateStr.split(" ");
  if (!MONTH_IDX.hasOwnProperty(mon)) return null;
  // Races typically start ~2:30 PM ET
  return new Date(2026, MONTH_IDX[mon], parseInt(day), 14, 30, 0).getTime();
}

function Countdown({ raceDate, trackType }) {
  const [diff, setDiff] = useState(() => getRaceMs(raceDate) - Date.now());

  useEffect(() => {
    const id = setInterval(() => setDiff(getRaceMs(raceDate) - Date.now()), 1000);
    return () => clearInterval(id);
  }, [raceDate]);

  if (diff <= 0) return null;

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const col = TTC[trackType] || C.accent;

  return (
    <div style={{ display:"flex", gap:8, alignItems:"center", justifyContent:"center", marginTop:12 }}>
      {[{v:d,l:"D"},{v:h,l:"H"},{v:m,l:"M"},{v:s,l:"S"}].map(({v,l}) => (
        <div key={l} style={{ textAlign:"center" }}>
          <div style={{
            background:col+"18", border:`1px solid ${col}44`,
            borderRadius:r.md, padding:"8px 10px", minWidth:44,
          }}>
            <div style={{
              fontFamily:"'Oswald',sans-serif", fontSize:22, fontWeight:900,
              color:col, lineHeight:1,
            }}>
              {String(v).padStart(2,"0")}
            </div>
          </div>
          <div style={{ color:C.muted, fontSize:9, fontWeight:700, letterSpacing:1, marginTop:3 }}>{l}</div>
        </div>
      ))}
    </div>
  );
}

function StatTile({ value, label, color, bg, small }) {
  return (
    <div style={{
      background:bg || "rgba(0,0,0,0.25)", borderRadius:r.md,
      padding: small ? "8px 12px" : "10px 16px",
      flex:1, minWidth:70, textAlign:"center",
    }}>
      <div style={{
        color:color, fontFamily:"'Oswald',sans-serif",
        fontSize:small ? 20 : 26, fontWeight:700, lineHeight:1,
      }}>
        {value}
      </div>
      <div style={{
        color:"rgba(255,255,255,0.4)", fontSize:9,
        textTransform:"uppercase", letterSpacing:1, marginTop:3,
      }}>
        {label}
      </div>
    </div>
  );
}

export function WelcomeTab({ player, data, setTab, liveScores, liveStatus }) {
  const pid = player.id;
  const clr = PClr[pid];

  const standings = useMemo(() =>
    PLAYERS.map(p => ({
      ...p,
      pts:  data.meta.standings[p.id] || 0,
      pp:   data.meta.playoffPts[p.id] || 0,
      wins: Object.values(data.results || {}).filter(r => r.scored?.[p.id]?.weeklyWin).length,
      mullsLeft: MAX_MULLIGANS - (data.meta.mulligansUsed[p.id] || 0),
    })).sort((a, b) => b.pts - a.pts),
  [data]);

  const myStats  = standings.find(s => s.id === pid);
  const myRank   = standings.findIndex(s => s.id === pid) + 1;
  const maxPts   = standings[0]?.pts || 1;

  const lastWeekKey  = Object.keys(data.results || {}).map(k => parseInt(k.replace("w",""))).sort((a,b) => b-a)[0];
  const lastWeek     = lastWeekKey ? data.results["w"+lastWeekKey] : null;
  const lastRaceInfo = SCHEDULE.find(s => s.w === lastWeekKey);
  const nextRace     = SCHEDULE.find(s => !data.results?.["w"+s.w]);

  const isLive = data?.liveRace?.active && liveScores;
  const liveRanked = isLive
    ? PLAYERS.map(p => ({ id:p.id, live: liveScores[p.id]?.total || 0 })).sort((a,b) => b.live-a.live)
    : null;
  const myLiveRank = liveRanked?.findIndex(x => x.id === pid) + 1;

  const greetings = ["Welcome back","Good to see you","Ready to race","Eyes on the prize"];
  const greeting  = greetings[Math.floor(Date.now()/86400000) % greetings.length];

  const mullColor = myStats?.mullsLeft <= 1 ? C.red : myStats?.mullsLeft <= 5 ? "#f59e0b" : C.green;

  return (
    <div style={{ padding:20, maxWidth:900, margin:"0 auto", position:"relative", zIndex:1 }}>

      {/* ── Hero banner ────────────────────────────────────────────────────── */}
      <div style={{
        background:clr.bg,
        borderRadius:r.xl, padding:"24px 24px 20px", marginBottom:20,
        border:`2px solid ${clr.bg === "#000000" ? C.border : clr.bg+"88"}`,
        boxShadow:shadow.lg, overflow:"hidden", position:"relative",
      }}>
        {/* Subtle number watermark */}
        <div style={{
          position:"absolute", right:-20, top:-20,
          fontFamily:"'Oswald',sans-serif", fontSize:180, fontWeight:900,
          color:clr.fg, opacity:0.04, lineHeight:1, pointerEvents:"none",
          userSelect:"none",
        }}>
          {myRank}
        </div>

        <div style={{ color:clr.fg+"88", fontSize:12, textTransform:"uppercase", letterSpacing:3, marginBottom:4 }}>
          {greeting}
        </div>
        <div style={{ color:clr.fg, fontFamily:"'Oswald',sans-serif", fontSize:36, fontWeight:900, letterSpacing:2, lineHeight:1, marginBottom:16 }}>
          {player.name.toUpperCase()}
          {isLive && myLiveRank && (
            <span style={{
              marginLeft:12, fontSize:13, fontWeight:700, letterSpacing:2,
              color:C.red, background:C.red+"22",
              padding:"3px 10px", borderRadius:r.pill, verticalAlign:"middle",
              border:`1px solid ${C.red}44`,
            }}>
              🔴 P{myLiveRank} LIVE
            </span>
          )}
        </div>

        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <StatTile value={myStats?.pts?.toLocaleString() || 0} label="Points"       color={clr.fg} />
          <StatTile value={`#${myRank}`}                        label="Rank"          color={clr.fg} />
          <StatTile value={myStats?.wins || 0}                  label="Wins"          color={clr.fg} />
          <StatTile value={`+${myStats?.pp || 0}`}              label="Playoff"       color={C.accent} />
          <StatTile value={myStats?.mullsLeft ?? MAX_MULLIGANS} label="Mulligans"     color={mullColor} />
        </div>
      </div>

      {/* ── Live race widget ───────────────────────────────────────────────── */}
      {isLive && (
        <div style={{ marginBottom:20 }}>
          <div style={{
            background:"linear-gradient(90deg,#ef4444,#f59e0b)",
            borderRadius:r.md, padding:"10px 16px", marginBottom:8,
            display:"flex", justifyContent:"space-between", alignItems:"center",
            cursor:"pointer", boxShadow:shadow.md,
          }} onClick={() => setTab("live")}>
            <div style={{ color:"#000", fontWeight:900, fontFamily:"'Oswald',sans-serif", fontSize:15, letterSpacing:1 }}>
              🔴 RACE IN PROGRESS
            </div>
            <div style={{ color:"#000", fontSize:11, fontWeight:700 }}>{liveStatus} → View Live</div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
            {Object.entries(liveScores).sort((a,b) => b[1].total - a[1].total).map(([p2,s],i) => (
              <div key={p2} onClick={() => setTab("live")} style={{
                background:PClr[p2].bg, borderRadius:r.md, padding:"10px 14px",
                cursor:"pointer", border:`1px solid ${PClr[p2].bg==="#000000"?C.border:PClr[p2].bg+"66"}`,
                display:"flex", justifyContent:"space-between", alignItems:"center",
              }}>
                <span style={{ color:PClr[p2].fg, fontWeight:700, fontSize:14 }}>
                  {i===0 && "👑 "}{PNAME[p2]}
                </span>
                <span style={{
                  color:s.total>0?"#10b981":s.total<0?"#ef4444":PClr[p2].fg,
                  fontWeight:900, fontFamily:"'Oswald',sans-serif", fontSize:18,
                }}>
                  {s.total>0?"+":""}{s.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Next race + countdown ──────────────────────────────────────────── */}
      {nextRace && (
        <div style={{
          background:C.card, borderRadius:r.lg, marginBottom:20,
          border:`1px solid ${TTC[nextRace.ty]}44`,
          boxShadow:shadow.card, overflow:"hidden",
        }}>
          <div style={{
            background:TTC[nextRace.ty]+"18",
            padding:"12px 16px",
            display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8,
          }}>
            <div>
              <div style={{ color:TTC[nextRace.ty], fontSize:10, textTransform:"uppercase", letterSpacing:2, fontWeight:700, marginBottom:2 }}>
                Next Race — W{nextRace.w}
              </div>
              <div style={{ color:C.text, fontWeight:700, fontSize:16 }}>{nextRace.r}</div>
              <div style={{ color:C.dim, fontSize:12, marginTop:2 }}>
                {nextRace.t} · {nextRace.d} ·{" "}
                <span style={{ color:TTC[nextRace.ty], fontWeight:600 }}>
                  {TTL[nextRace.ty]} ×{TRACK_MULTS[nextRace.ty]}
                </span>
              </div>
            </div>
            <button
              onClick={() => setTab("draft")}
              style={{
                padding:"8px 18px", borderRadius:r.md,
                border:`1px solid ${TTC[nextRace.ty]}`, background:TTC[nextRace.ty]+"22",
                color:TTC[nextRace.ty], fontFamily:"'Oswald',sans-serif",
                fontSize:12, fontWeight:700, cursor:"pointer", letterSpacing:1, textTransform:"uppercase",
              }}
            >
              Draft →
            </button>
          </div>
          <div style={{ padding:"12px 16px" }}>
            <Countdown raceDate={nextRace.d} trackType={nextRace.ty} />
          </div>
        </div>
      )}

      {/* ── Season standings ───────────────────────────────────────────────── */}
      <div style={{ marginBottom:20 }}>
        <div style={{
          display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10,
        }}>
          <div style={{ color:C.textDim, fontSize:11, textTransform:"uppercase", letterSpacing:2, fontWeight:700 }}>
            Season Standings
          </div>
          <div style={{ color:C.muted, fontSize:11 }}>
            {Object.keys(data.results || {}).length} / 36 races
          </div>
        </div>

        <div style={{ display:"grid", gap:6 }}>
          {standings.map((p, i) => {
            const barW = maxPts > 0 ? (p.pts / maxPts) * 100 : 0;
            const isMe = p.id === pid;
            return (
              <div key={p.id} style={{
                background:PClr[p.id].bg, borderRadius:r.md,
                border:`2px solid ${isMe ? C.accent : PClr[p.id].bg === "#000000" ? C.border : PClr[p.id].bg+"55"}`,
                overflow:"hidden",
                boxShadow: isMe ? shadow.glow(C.accent) : "none",
              }}>
                <div style={{ padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{
                      width:28, height:28, borderRadius:"50%",
                      background:PClr[p.id].fg, color:PClr[p.id].bg,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontWeight:900, fontSize:13, fontFamily:"'Oswald',sans-serif",
                      flexShrink:0,
                    }}>
                      {i + 1}
                    </div>
                    <div>
                      <div style={{
                        color:PClr[p.id].fg, fontWeight:700, fontSize:15,
                        fontFamily:"'Barlow Condensed',sans-serif",
                      }}>
                        {p.name}
                        {isMe && <span style={{ color:C.accent, fontSize:10, marginLeft:6, fontWeight:700 }}>YOU</span>}
                      </div>
                      <div style={{ color:PClr[p.id].fg+"66", fontSize:10 }}>
                        {p.wins}W · +{p.pp} playoff
                        <span style={{ color:mullColor, marginLeft:6 }}>· M:{p.mullsLeft}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{
                      color:PClr[p.id].fg, fontFamily:"'Oswald',sans-serif",
                      fontSize:22, fontWeight:700, lineHeight:1,
                    }}>
                      {p.pts.toLocaleString()}
                    </div>
                    <div style={{ color:PClr[p.id].fg+"66", fontSize:9, textTransform:"uppercase" }}>pts</div>
                  </div>
                </div>
                {/* Points bar */}
                <div style={{ height:3, background:"rgba(0,0,0,0.3)" }}>
                  <div style={{
                    height:"100%", width:`${barW}%`,
                    background: isMe ? C.accent : PClr[p.id].fg,
                    opacity:0.6, transition:"width 0.8s ease",
                  }}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Last race recap ────────────────────────────────────────────────── */}
      {lastWeek && lastRaceInfo && (
        <div style={{
          background:C.card, borderRadius:r.lg, padding:16,
          border:`1px solid ${C.border}`, boxShadow:shadow.sm,
        }}>
          <div style={{ color:C.muted, fontSize:10, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>
            Last Race — W{lastWeekKey}
          </div>
          <div style={{ color:C.text, fontWeight:700, fontSize:15, marginBottom:2 }}>{lastRaceInfo.r}</div>
          <div style={{ color:C.dim, fontSize:12, marginBottom:10 }}>@ {lastRaceInfo.t}</div>
          <div style={{ display:"grid", gap:4 }}>
            {Object.entries(lastWeek.scored || {})
              .sort((a,b) => b[1].total - a[1].total)
              .map(([p2, s], i) => (
                <div key={p2} style={{
                  display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:"6px 10px",
                  background:PClr[p2].bg, borderRadius:r.sm,
                  border:`1px solid ${PClr[p2].bg==="#000000"?C.border:PClr[p2].bg+"44"}`,
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:13 }}>{i===0?"👑":i===3?"💩":"  "}</span>
                    <span style={{
                      color:PClr[p2].fg, fontWeight: s.weeklyWin ? 900 : 600, fontSize:14,
                      fontFamily:"'Barlow Condensed',sans-serif",
                    }}>
                      {PNAME[p2]}
                      {p2 === pid && <span style={{ color:C.accent, fontSize:10, marginLeft:6 }}>YOU</span>}
                    </span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    {s.weeklyWin && (
                      <span style={{
                        fontSize:9, fontWeight:700, color:C.accent,
                        background:C.accent+"22", padding:"2px 6px",
                        borderRadius:r.pill, letterSpacing:1,
                      }}>+25 PP</span>
                    )}
                    <span style={{
                      color:PClr[p2].fg, fontFamily:"'Oswald',sans-serif",
                      fontSize:18, fontWeight:700,
                    }}>
                      {s.total}
                    </span>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}
