import { C, PClr, TTC, TTL, rankColor, shadow, r } from "../theme";
import { PLAYERS, SCHEDULE, DRIVER_INFO, MAKE_COLORS, TRACK_MULTS } from "../constants";

// Breakdown labels → short display text + color hint
const CHIP_MAP = {
  "Top 5":    { short:"T5",   col:"#10b981" },
  "Top 10":   { short:"T10",  col:"#10b981" },
  "Pole":     { short:"POLE", col:"#f59e0b" },
  "S1 Win":   { short:"S1W",  col:"#f59e0b" },
  "S2 Win":   { short:"S2W",  col:"#f59e0b" },
  "S3 Win":   { short:"S3W",  col:"#f59e0b" },
  "Fast Lap": { short:"FL",   col:"#8b5cf6" },
  "Most Led": { short:"ML",   col:"#3b82f6" },
  "SWEEP!":   { short:"💫",   col:"#f59e0b" },
  "DQ":       { short:"DQ",   col:"#ef4444" },
  "DNF":      { short:"DNF",  col:"#94a3b8" },
};

function BreakdownChips({ breakdown, fg }) {
  const chips = (breakdown || []).filter(b => {
    if (b.pts === 0 && !CHIP_MAP[b.label]) return false;
    return true;
  });
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginTop:3 }}>
      {chips.map((b, i) => {
        const map = CHIP_MAP[b.label];
        const col = map?.col || (b.pts > 0 ? "#10b981" : b.pts < 0 ? "#ef4444" : "#475569");
        const short = map?.short || b.label;
        return (
          <span key={i} style={{
            fontSize:9, fontWeight:700, letterSpacing:0.5,
            color:col, background:col+"22",
            padding:"2px 5px", borderRadius:r.pill,
            border:`1px solid ${col}44`,
          }}>
            {short}{b.pts !== 0 ? ` ${b.pts > 0 ? "+" : ""}${b.pts}` : ""}
          </span>
        );
      })}
    </div>
  );
}

function DriverRow({ d, mullPicks, playerBg, playerFg }) {
  const isMull = mullPicks.includes(d.driver);
  const info = DRIVER_INFO[d.driver] || {};
  const score = d.total;
  const scoreColor = score > 0 ? "#10b981" : score < 0 ? "#ef4444" : playerFg + "88";

  return (
    <div style={{
      display:"flex", alignItems:"flex-start", justifyContent:"space-between",
      padding:"8px 12px",
      background: playerBg === "#000000" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.18)",
      borderRadius:r.sm,
      borderLeft: `2px solid ${score > 30 ? "#f59e0b66" : score > 0 ? playerFg+"33" : "#ef444433"}`,
    }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <span style={{
            fontSize:13, fontWeight:700,
            color: d.dnr ? playerFg+"55" : playerFg,
            fontFamily:"'Barlow Condensed',sans-serif",
          }}>
            {d.driver}
            {isMull && <span style={{ fontSize:9, color:"#f59e0b", marginLeft:4 }}>MULL</span>}
            {d.dnr && <span style={{ fontSize:9, color:playerFg+"66", marginLeft:4 }}>DNR</span>}
          </span>
        </div>
        {info.team && (
          <div style={{ fontSize:9, color:playerFg+"55", marginTop:1 }}>
            {info.team}
            {info.make && <span style={{ color:MAKE_COLORS[info.make], marginLeft:4, fontWeight:700 }}>{info.make}</span>}
          </div>
        )}
        {!d.dnr && <BreakdownChips breakdown={d.breakdown} fg={playerFg} />}
      </div>
      <div style={{ textAlign:"right", marginLeft:8, flexShrink:0 }}>
        <div style={{
          fontFamily:"'Oswald',sans-serif", fontSize:20, fontWeight:700,
          color: scoreColor,
          lineHeight:1,
        }}>
          {score > 0 ? "+" : ""}{score}
        </div>
        <div style={{ fontSize:9, color:playerFg+"55", marginTop:2 }}>pts</div>
      </div>
    </div>
  );
}

function GapBanner({ gap }) {
  if (gap <= 0) return null;
  return (
    <div style={{
      textAlign:"center", padding:"6px 0",
      color:C.muted, fontSize:11, fontWeight:600, letterSpacing:1.5,
      fontFamily:"'Oswald',sans-serif",
    }}>
      ▲ GAP: +{gap.toFixed(1)} pts ahead
    </div>
  );
}

export function LiveTab({ data, liveScores, liveStatus, raceInfo, currentWeek }) {
  const isActive = !!(data?.liveRace?.active && liveScores);
  const week = data?.liveRace?.week || currentWeek;
  const weekInfo = SCHEDULE.find(s => s.w === week);
  const weekPicks = data?.picks?.["w" + week] || {};

  // ── Inactive state ─────────────────────────────────────────────────────────
  if (!isActive) return (
    <div style={{ padding:20, maxWidth:700, margin:"0 auto", position:"relative", zIndex:1 }}>
      <h2 style={{ color:C.text, fontFamily:"'Oswald',sans-serif", fontSize:26, marginBottom:16, letterSpacing:1 }}>
        Live Scoring
      </h2>
      <div style={{
        background:C.card, borderRadius:r.xl, padding:"48px 32px",
        border:`1px solid ${C.border}`, textAlign:"center",
        boxShadow:shadow.md,
      }}>
        <div style={{ fontSize:56, marginBottom:16 }}>🏁</div>
        <div style={{
          color:C.text, fontFamily:"'Oswald',sans-serif",
          fontSize:22, fontWeight:700, marginBottom:8, letterSpacing:1,
        }}>
          No Race In Progress
        </div>
        <div style={{ color:C.dim, fontSize:14, lineHeight:1.5 }}>
          Live scoring activates when the commissioner starts a race. Check back on race day!
        </div>
        {weekInfo && (
          <div style={{
            marginTop:20, padding:"12px 20px",
            background:C.accent+"15", border:`1px solid ${C.accent}44`,
            borderRadius:r.md, display:"inline-block",
          }}>
            <div style={{ color:C.accent, fontFamily:"'Oswald',sans-serif", fontSize:11, letterSpacing:2, marginBottom:4, textTransform:"uppercase" }}>Next Up</div>
            <div style={{ color:C.text, fontWeight:700, fontSize:16 }}>W{week} — {weekInfo.r}</div>
            <div style={{ color:C.dim, fontSize:13, marginTop:2 }}>
              {weekInfo.t} · {weekInfo.d} ·{" "}
              <span style={{ color:TTC[weekInfo.ty], fontWeight:600 }}>{TTL[weekInfo.ty]} ×{TRACK_MULTS[weekInfo.ty]}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ── Build ranked list ───────────────────────────────────────────────────────
  const ranked = PLAYERS.map(p => ({
    ...p,
    seasonPts:  data.meta.standings[p.id] || 0,
    livePts:    liveScores[p.id]?.total || 0,
    drivers:    liveScores[p.id]?.drivers || [],
    picks:      weekPicks[p.id] || [],
  })).sort((a, b) => b.livePts - a.livePts);

  const leader = ranked[0]?.livePts || 0;

  return (
    <div style={{ maxWidth:900, margin:"0 auto", position:"relative", zIndex:1 }}>

      {/* ── Race Header ──────────────────────────────────────────────────────── */}
      <div style={{
        background:"linear-gradient(135deg,#1a0505 0%,#0a0e17 60%)",
        borderBottom:`2px solid #ef4444`,
        padding:"16px 20px",
      }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {/* Pulsing live dot */}
            <div style={{ position:"relative", width:12, height:12, flexShrink:0 }}>
              <div style={{
                position:"absolute", inset:0, borderRadius:"50%",
                background:"#ef4444",
                animation:"livePulse 1.5s ease-in-out infinite",
              }}/>
            </div>
            <div>
              <div style={{
                color:"#fff", fontFamily:"'Oswald',sans-serif",
                fontSize:20, fontWeight:900, letterSpacing:2, lineHeight:1,
              }}>
                RACE IN PROGRESS
              </div>
              {weekInfo && (
                <div style={{ color:"#ffffff88", fontSize:12, marginTop:3 }}>
                  W{week} — {raceInfo?.raceName || weekInfo.r} &nbsp;·&nbsp; {weekInfo.t} &nbsp;·&nbsp;
                  <span style={{ color:TTC[weekInfo.ty], fontWeight:700 }}>{TTL[weekInfo.ty]} ×{TRACK_MULTS[weekInfo.ty]}</span>
                </div>
              )}
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ color:C.text, fontSize:12, fontWeight:600 }}>{liveStatus}</div>
            {raceInfo?.source && (
              <div style={{ color:C.muted, fontSize:10, marginTop:2 }}>{raceInfo.source}</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Ranked cards ─────────────────────────────────────────────────────── */}
      <div style={{ padding:"0 16px 24px" }}>
        {ranked.map((p, i) => {
          const rank = rankColor[i + 1] || rankColor[4];
          const mullPicks = (p.picks || []).filter(pk => pk.mulligan).map(pk => pk.driver);
          const bar = leader > 0 ? (p.livePts / leader) * 100 : 0;
          const gap = i > 0 ? ranked[i - 1].livePts - p.livePts : 0;
          const isLeading = i === 0;

          return (
            <div key={p.id}>
              {i > 0 && <GapBanner gap={gap} />}

              <div style={{
                background:PClr[p.id].bg,
                borderRadius:r.lg,
                border:`2px solid ${isLeading ? rank.fg : PClr[p.id].bg === "#000000" ? C.border : PClr[p.id].bg+"66"}`,
                overflow:"hidden",
                marginTop: i === 0 ? 20 : 4,
                boxShadow: isLeading ? shadow.glow(rank.fg) : shadow.card,
                transition:"all 0.3s ease",
              }}>

                {/* Player header */}
                <div style={{
                  padding:"14px 16px",
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  borderBottom:`1px solid ${PClr[p.id].bg === "#000000" ? C.border : "rgba(0,0,0,0.3)"}`,
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    {/* Rank badge */}
                    <div style={{
                      width:40, height:40, borderRadius:r.md,
                      background:rank.bg, border:`2px solid ${rank.fg}`,
                      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                      flexShrink:0,
                    }}>
                      <div style={{
                        fontFamily:"'Oswald',sans-serif", fontSize:20, fontWeight:900,
                        color:rank.fg, lineHeight:1,
                      }}>{i + 1}</div>
                    </div>
                    <div>
                      <div style={{
                        color:PClr[p.id].fg, fontFamily:"'Oswald',sans-serif",
                        fontSize:22, fontWeight:900, letterSpacing:1, lineHeight:1,
                      }}>
                        {p.name.toUpperCase()}
                        {isLeading && (
                          <span style={{
                            fontSize:10, fontWeight:700, letterSpacing:2,
                            color:rank.fg, background:rank.fg+"22",
                            padding:"2px 6px", borderRadius:r.pill,
                            marginLeft:8, verticalAlign:"middle",
                          }}>LEADING</span>
                        )}
                      </div>
                      <div style={{ color:PClr[p.id].fg+"66", fontSize:11, marginTop:2 }}>
                        Season: {p.seasonPts.toLocaleString()} pts
                      </div>
                    </div>
                  </div>

                  {/* Race score */}
                  <div style={{ textAlign:"right" }}>
                    <div style={{
                      fontFamily:"'Oswald',sans-serif", fontSize:38, fontWeight:900,
                      lineHeight:1,
                      color: p.livePts > 0 ? "#10b981" : p.livePts < 0 ? "#ef4444" : PClr[p.id].fg,
                    }}>
                      {p.livePts > 0 ? "+" : ""}{p.livePts}
                    </div>
                    <div style={{ color:PClr[p.id].fg+"66", fontSize:10, textTransform:"uppercase", letterSpacing:1 }}>
                      this race
                    </div>
                  </div>
                </div>

                {/* Score bar */}
                <div style={{ height:3, background:"rgba(0,0,0,0.3)" }}>
                  <div style={{
                    height:"100%", background:rank.fg,
                    width:`${Math.max(bar, leader > 0 ? 2 : 0)}%`,
                    transition:"width 0.6s ease",
                    opacity:0.8,
                  }}/>
                </div>

                {/* Drivers */}
                <div style={{ padding:"8px 10px", display:"flex", flexDirection:"column", gap:4 }}>
                  {p.drivers.length === 0
                    ? <div style={{ color:PClr[p.id].fg+"44", fontSize:12, fontStyle:"italic", textAlign:"center", padding:12 }}>No picks found</div>
                    : p.drivers
                        .slice()
                        .sort((a, b) => b.total - a.total)
                        .map(d => (
                          <DriverRow
                            key={d.driver}
                            d={d}
                            mullPicks={mullPicks}
                            playerBg={PClr[p.id].bg}
                            playerFg={PClr[p.id].fg}
                          />
                        ))
                  }
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity:1; transform:scale(1); }
          50% { opacity:0.4; transform:scale(1.3); }
        }
      `}</style>
    </div>
  );
}
