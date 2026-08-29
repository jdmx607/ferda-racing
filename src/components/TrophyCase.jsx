import { useMemo } from "react";
import { C, PClr, r } from "../theme";
import { PNAME, MAX_MULLIGANS } from "../constants";
import { getAchievements } from "../engine/history";
import { getSeasonAwards, getSeasonRecords } from "../engine/stats";

// Per-player profile modal — pulls together achievements, season awards, and
// key stats into one card. Opened by clicking a player's name/avatar.
export function TrophyCaseModal({ pid, data, onClose }) {
  const clr = PClr[pid];

  const achv    = useMemo(() => getAchievements(data)[pid] || { unlocked: [], stats: {} }, [data, pid]);
  const awards  = useMemo(() => getSeasonAwards(data), [data]);
  const records = useMemo(() => getSeasonRecords(data), [data]);

  const wonAwards = [];
  if (awards?.consistencyKing?.pid === pid) wonAwards.push({ icon: "🎯", label: "Consistency King" });
  if (awards?.eyeOfTiger?.pid === pid)      wonAwards.push({ icon: "👁️", label: "Eye of the Tiger" });
  if (awards?.bestMulligan?.pid === pid)    wonAwards.push({ icon: "🔀", label: "Best Mulligan" });
  if (awards?.biggestBust?.pid === pid)     wonAwards.push({ icon: "💩", label: "Biggest Bust" });

  const mullLeft     = MAX_MULLIGANS - (data.meta.mulligansUsed?.[pid] || 0);
  const standingsPts = data.meta.standings?.[pid] || 0;
  const wins          = achv.stats.wins || 0;
  const bestWeek       = achv.stats.bestWeekScore || 0;
  const curStreak      = records.currentStreaks?.[pid] || 0;

  return (
    <div
      style={{ position:"fixed", inset:0, zIndex:210, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.85)", padding:16 }}
      onClick={onClose}
    >
      <div
        style={{
          background:clr.bg, borderRadius:20, padding:"28px 24px", maxWidth:420, width:"100%",
          maxHeight:"85vh", overflowY:"auto",
          border:`3px solid ${clr.fg}55`, boxShadow:`0 0 60px ${clr.fg}33`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <div>
            <div style={{ color:clr.fg+"88", fontSize:11, letterSpacing:2, textTransform:"uppercase" }}>Trophy Case</div>
            <div style={{ color:clr.fg, fontFamily:"'Oswald',sans-serif", fontSize:28, fontWeight:900 }}>{PNAME[pid]}</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:clr.fg+"88", fontSize:20, cursor:"pointer", lineHeight:1 }}>✕</button>
        </div>

        {/* Quick stat row */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:20 }}>
          {[
            { v:standingsPts.toLocaleString(), l:"Points" },
            { v:wins,      l:"Wins" },
            { v:bestWeek,  l:"Best Wk" },
            { v:mullLeft,  l:"Mulls Left" },
          ].map(t => (
            <div key={t.l} style={{ background:"rgba(0,0,0,0.2)", borderRadius:r.md, padding:"8px 6px", textAlign:"center" }}>
              <div style={{ color:clr.fg, fontFamily:"'Oswald',sans-serif", fontSize:18, fontWeight:900 }}>{t.v}</div>
              <div style={{ color:clr.fg+"66", fontSize:8, textTransform:"uppercase", letterSpacing:0.5 }}>{t.l}</div>
            </div>
          ))}
        </div>

        {curStreak > 0 && (
          <div style={{
            background:"#10b98118", border:"1px solid #10b98144", borderRadius:r.md,
            padding:"8px 12px", marginBottom:16, color:"#10b981", fontSize:12, fontWeight:700, textAlign:"center",
          }}>
            🔥 On a {curStreak}-week winning streak
          </div>
        )}

        {wonAwards.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <div style={{ color:clr.fg+"77", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1.5, marginBottom:8 }}>
              Season Awards
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {wonAwards.map(a => (
                <span key={a.label} style={{
                  background:"rgba(0,0,0,0.2)", border:`1px solid ${clr.fg}33`, borderRadius:r.pill,
                  padding:"4px 10px", fontSize:11, color:clr.fg, fontWeight:700,
                }}>
                  {a.icon} {a.label}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <div style={{ color:clr.fg+"77", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1.5, marginBottom:8 }}>
            Achievements ({achv.unlocked.length})
          </div>
          {achv.unlocked.length === 0 ? (
            <div style={{ color:clr.fg+"44", fontSize:12, fontStyle:"italic" }}>None unlocked yet</div>
          ) : (
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {achv.unlocked.map(a => (
                <div key={a.id} title={typeof a.statLine === "function" ? a.statLine(achv.stats) : a.desc()} style={{
                  background:"rgba(0,0,0,0.2)", border:`1px solid ${clr.fg}22`,
                  borderRadius:r.md, padding:"8px 12px",
                  display:"flex", alignItems:"center", gap:8, minWidth:130,
                }}>
                  <span style={{ fontSize:18 }}>{a.icon}</span>
                  <div>
                    <div style={{ color:clr.fg, fontWeight:700, fontSize:11 }}>{a.label}</div>
                    <div style={{ color:clr.fg+"77", fontSize:9 }}>
                      {typeof a.statLine === "function" ? a.statLine(achv.stats) : a.desc()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
