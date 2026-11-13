import { useState } from "react";
import { C, PClr } from "../theme";
import { PLAYERS, SCHEDULE, ACTIVE_SEASON } from "../constants";
import { getCurrentWeek } from "../engine/events";
import { formatRaceShort } from "../engine/racetime";
import { useRaceTimes } from "../hooks/useNascarFeeds";
import { FerdaLogo } from "./FerdaLogo";

export function getLastWeekResults(data) {
  const weeks=Object.keys(data.results||{}).map(k=>parseInt(k.replace("w",""))).sort((a,b)=>b-a);
  if(!weeks.length) return null;
  const key="w"+weeks[0];
  const scored=data.results[key]?.scored;
  if(!scored) return null;
  const sorted=Object.entries(scored).sort((a,b)=>b[1].total-a[1].total);
  return { week:weeks[0], winner:sorted[0]?.[0], loser:sorted[sorted.length-1]?.[0], scores:scored };
}

export function RichRoastModal({onDismiss}) {
  return (<div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.9)"}} onClick={onDismiss}>
    <div style={{background:"#1a1a1a",borderRadius:20,padding:"48px 32px",maxWidth:340,width:"90vw",textAlign:"center",border:"3px solid "+C.red,boxShadow:"0 0 60px "+C.red+"66"}} onClick={e=>e.stopPropagation()}>
      <div style={{fontSize:72,marginBottom:16}}>💩</div>
      <div style={{color:C.red,fontFamily:"var(--font-sans)",fontSize:32,fontWeight:900,letterSpacing:2,marginBottom:24}}>YOU SUCK</div>
      <button onClick={onDismiss} style={{width:"100%",padding:"12px 0",borderRadius:10,border:"none",background:C.red,color:"#fff",fontFamily:"var(--font-sans)",fontSize:15,fontWeight:700,letterSpacing:2,textTransform:"uppercase",cursor:"pointer"}}>fine</button>
    </div>
  </div>);
}

export function WinnerModal({player, data, onDismiss}) {
  const last=getLastWeekResults(data);
  if(!last||last.winner!==player.id) return null;
  const raceInfo=SCHEDULE.find(s=>s.w===last.week);
  return (<div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.85)"}} onClick={onDismiss}>
    <div style={{background:PClr[player.id].bg,borderRadius:20,padding:"40px 32px",maxWidth:340,width:"90vw",textAlign:"center",border:"3px solid "+C.accent,boxShadow:"0 0 60px "+C.accent+"66"}} onClick={e=>e.stopPropagation()}>
      <div style={{fontSize:64,marginBottom:12}}>🏆</div>
      <div style={{color:C.accent,fontFamily:"var(--font-sans)",fontSize:13,letterSpacing:3,textTransform:"uppercase",marginBottom:4}}>Weekly Winner</div>
      <div style={{color:PClr[player.id].fg,fontFamily:"var(--font-sans)",fontSize:36,fontWeight:900,marginBottom:4}}>{player.name}</div>
      {raceInfo&&<div style={{color:PClr[player.id].fg+"88",fontSize:13,marginBottom:4}}>{raceInfo.r}</div>}
      <div style={{color:C.accent,fontFamily:"var(--font-sans)",fontSize:20,fontWeight:700,marginBottom:4}}>+25 Playoff Points</div>
      <div style={{color:PClr[player.id].fg+"66",fontSize:12,marginBottom:24}}>{last.scores[player.id]?.total} pts scored</div>
      <button onClick={onDismiss} style={{width:"100%",padding:"12px 0",borderRadius:10,border:"none",background:C.accent,color:"#000",fontFamily:"var(--font-sans)",fontSize:15,fontWeight:700,letterSpacing:2,textTransform:"uppercase",cursor:"pointer"}}>LET'S RACE 🏁</button>
    </div>
  </div>);
}

// ── Login / "Pit Pass" screen ─────────────────────────────────────────────────
const LAST_PLAYER_KEY = "ferda:lastPlayer";

function readLastPlayer() {
  try {
    const id = localStorage.getItem(LAST_PLAYER_KEY);
    return PLAYERS.some(p => p.id === id) ? id : null;
  } catch { return null; }
}
function saveLastPlayer(id) {
  try { localStorage.setItem(LAST_PLAYER_KEY, id); } catch { /* private mode etc. */ }
}

// Live stage/lap if a race is running, otherwise the next event ("NEXT: CHARLOTTE • SUN 2:30 PM ET").
// Start time comes from NASCAR's race list; 2:00 PM ET placeholder until it's announced.
function raceStatus(data, timing, times) {
  if (!data) return null;
  if (data.liveRace?.active) {
    const wk = SCHEDULE.find(s => s.w === data.liveRace.week);
    const parts = [
      "LIVE",
      wk?.t?.toUpperCase(),
      timing?.stage?.stage_num != null && `STAGE ${timing.stage.stage_num}`,
      timing?.lapsInRace > 0 && `LAP ${timing.lapNumber}/${timing.lapsInRace}`,
    ].filter(Boolean);
    return { live: true, text: parts.join(" • ") };
  }
  const next = SCHEDULE.find(s => s.w === getCurrentWeek(data));
  if (!next) return { text: `${ACTIVE_SEASON} SEASON COMPLETE` };
  const when = formatRaceShort(next, times);
  return { text: `NEXT: ${next.t.toUpperCase()}${when ? ` • ${when}` : ""}` };
}

const initialsOf = name => name.split(/\s+/).map(w => w[0]).join("").toUpperCase();

export function LoginScreen({ onLogin, data, timing }) {
  const [sel, setSel] = useState(readLastPlayer);   // remembered profile is pre-selected
  const [pw, setPw]   = useState("");
  const [err, setErr] = useState("");

  const raceTimes = useRaceTimes();
  const status = raceStatus(data, timing, raceTimes);
  const standings = data?.meta?.standings || {};
  const rankOf = id => 1 + PLAYERS.filter(p => (standings[p.id] || 0) > (standings[id] || 0)).length;

  const pick = id => { setSel(id); setErr(""); saveLastPlayer(id); };
  const go = () => {
    const p = PLAYERS.find(x => x.id === sel);
    if (!p) return;
    if (!pw) { setErr("Enter your password"); return; }
    if (pw === p.password) onLogin(p); else setErr("Wrong password");
  };

  return (
    <div className="login">
      {/* ── Top zone: branding + race status ─────────────────────────────── */}
      <header className="login-top">
        <FerdaLogo size="large" />
        <div className="login-sub">Racing League</div>
        {status && (
          <div className="login-pill num">
            {status.live && <span className="live-dot" />}
            {status.text}
          </div>
        )}
      </header>

      {/* ── Middle zone: pit pass player grid ────────────────────────────── */}
      <main className="login-mid">
        <div className="label" style={{ marginBottom: 10 }}>Select player</div>
        <div className="pp-grid" role="radiogroup" aria-label="Select player">
          {PLAYERS.map(p => {
            const active = sel === p.id;
            const pts = standings[p.id];
            return (
              <button
                key={p.id} type="button" role="radio" aria-checked={active}
                className={`pp-card${active ? " is-active" : ""}`}
                onClick={() => pick(p.id)}
              >
                <span className="pp-badge num">{initialsOf(p.name)}</span>
                <span className="pp-text">
                  <span className="pp-name">{p.name}</span>
                  <span className="pp-meta num">
                    {pts != null ? `P${rankOf(p.id)} • ${Math.round(pts).toLocaleString()} PTS` : "—"}
                  </span>
                </span>
                {active && <span className="pp-dot" style={{ background: PClr[p.id].accent }} />}
              </button>
            );
          })}
        </div>

        <input
          className="login-input" type="password" value={pw}
          disabled={!sel}
          autoComplete="current-password"
          placeholder={sel ? "Password" : "Select a player first"}
          onChange={e => { setPw(e.target.value); setErr(""); }}
          onKeyDown={e => e.key === "Enter" && go()}
        />
        <div className="login-err" role="alert">{err}</div>

        <button type="button" className={`login-cta${sel ? " is-ready" : ""}`} disabled={!sel} onClick={go}>
          Enter garage
        </button>
      </main>

      {/* ── Bottom zone: tribute ─────────────────────────────────────────── */}
      <footer className="login-foot">
        <div className="login-quote">Do It For Dale, Be Like Biff, Race Like Rowdy</div>
        <div className="login-attrib num">3:16:8</div>
      </footer>
    </div>
  );
}
