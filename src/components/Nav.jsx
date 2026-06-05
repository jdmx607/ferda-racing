import { C, PClr, r } from "../theme";
import { PLAYERS, PNAME, ACTIVE_PICKS } from "../constants";
import { getDraftOrder, buildSnakeOrder } from "../engine/draft";
import { FerdaLogo } from "./FerdaLogo";

function Banner({ flag, text, onClick }) {
  const flags = {
    green:    { bg:"#10b981", fg:"#000", icon:"🟢" },
    yellow:   { bg:"#fbbf24", fg:"#000", icon:"🟡" },
    red:      { bg:"#dc2626", fg:"#fff", icon:"🔴" },
    white:    { bg:"#f8fafc", fg:"#000", icon:"⚪" },
    checkered:{ bg:"#1f2937", fg:"#fff", icon:"🏁" },
  };
  const f = flags[flag];
  const bg = flag === "checkered"
    ? "repeating-linear-gradient(45deg,#1f2937 0,#1f2937 10px,#f8fafc 10px,#f8fafc 20px)"
    : f.bg;
  return (
    <div onClick={onClick} style={{
      background:bg, color:f.fg,
      padding:"10px 16px", textAlign:"center",
      fontFamily:"'Oswald',sans-serif", fontWeight:700, fontSize:14,
      letterSpacing:1, textTransform:"uppercase",
      cursor:onClick ? "pointer" : "default",
      display:"flex", alignItems:"center", justifyContent:"center", gap:10,
      borderBottom:"2px solid rgba(0,0,0,0.3)",
      position:"relative", zIndex:1,
      animation:flag==="green" ? "pulse 2s infinite" : "none",
    }}>
      <span style={{ fontSize:20 }}>{f.icon}</span>
      <span style={{
        background:flag==="checkered" ? "rgba(0,0,0,0.6)" : "transparent",
        padding:flag==="checkered" ? "4px 10px" : 0,
        borderRadius:6,
      }}>
        {text}
      </span>
      {onClick && <span style={{ fontSize:11, opacity:0.7, marginLeft:4 }}>→</span>}
    </div>
  );
}

export function FlagBanner({ user, data, currentWeek, onGoTo }) {
  if (!user || !data) return null;
  const draftKey     = "w" + currentWeek;
  const draftState   = data.drafts?.[draftKey] || [];
  const draftOrder   = getDraftOrder(data, currentWeek);
  const snakeSequence= buildSnakeOrder(draftOrder);
  const currentPickNum = draftState.length;
  const draftComplete  = currentPickNum >= snakeSequence.length;
  const savedPicks     = data.picks?.[draftKey] || {};
  const hasSavedPicks  = Object.values(savedPicks).some(p => p && p.length > 0);
  const hasScored      = !!(data.results?.[draftKey]?.scored);

  if (draftState.length === 0 && !hasSavedPicks && !hasScored) {
    const firstUp = snakeSequence[0]?.pid;
    if (firstUp === user.id)
      return <Banner flag="green" text={`Your turn to pick first for Week ${currentWeek}!`} onClick={() => onGoTo("draft")} />;
    return null;
  }
  if (hasScored)
    return <Banner flag="checkered" text={`Week ${currentWeek} is complete. Results posted.`} onClick={() => onGoTo("results")} />;
  if (draftComplete || (hasSavedPicks && draftState.length === 0))
    return <Banner flag="checkered" text={`All picks locked for Week ${currentWeek}. Race day!`} onClick={() => onGoTo("lineups")} />;

  const currentTurn = snakeSequence[currentPickNum];
  const nextTurn    = snakeSequence[currentPickNum + 1];
  const lastRound   = currentTurn?.round === ACTIVE_PICKS;

  if (currentTurn?.pid === user.id)
    return <Banner flag={lastRound ? "white" : "green"} text={lastRound ? "FINAL ROUND — Your pick!" : "Your turn to pick!"} onClick={() => onGoTo("draft")} />;
  if (nextTurn?.pid === user.id)
    return <Banner flag="yellow" text={`You're up next after ${PNAME[currentTurn.pid]}`} />;
  return <Banner flag="red" text={`Waiting on ${PNAME[currentTurn.pid]} to pick`} />;
}

export function Nav({ player, tab, setTab, onLogout }) {
  const clr = PClr[player.id];

  const tabs = [
    { id:"welcome",      l:"Home"       },
    { id:"draft",        l:"Draft"      },
    { id:"lineups",      l:"Lineups"    },
    { id:"mulligans",    l:"Mulligans"  },
    { id:"live",         l:"🔴 Live"    },
    { id:"results",      l:"Results"    },
    { id:"stats",        l:"Stats"      },
    { id:"playoffs",     l:"Playoffs"   },
    { id:"projections",  l:"Projections"},
    { id:"schedule",     l:"Schedule"   },
    { id:"rules",        l:"Rules"      },
    { id:"settings",     l:"Settings"   },
  ];
  if (player.id === "justin")
    tabs.push({ id:"commissioner", l:"COMMISH", red:true });

  return (
    <nav style={{
      background:"rgba(0,0,0,0.92)",
      backdropFilter:"blur(12px)",
      borderBottom:`1px solid ${C.border}`,
      display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"0 12px", height:52,
      position:"sticky", top:0, zIndex:100,
      overflowX:"auto",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <FerdaLogo size="small" />
        <div style={{ display:"flex", gap:1 }}>
          {tabs.map(t => {
            const isActive = tab === t.id;
            const isRed    = !!t.red;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding:"6px 8px",
                borderRadius:r.sm,
                border:isRed ? `1px solid ${isActive ? "#ef4444" : "#ef444466"}` : "none",
                background: isActive ? (isRed ? "#ef4444" : C.accent+"22") : "transparent",
                color: isActive ? (isRed ? "#fff" : C.accent) : (isRed ? "#ef4444" : C.dim),
                fontFamily:"'Barlow Condensed',sans-serif",
                fontSize:11, fontWeight: isActive ? 700 : 600,
                cursor:"pointer", letterSpacing:1, textTransform:"uppercase",
                whiteSpace:"nowrap",
                borderBottom: isActive && !isRed ? `2px solid ${C.accent}` : "2px solid transparent",
                transition:"all 0.12s ease",
              }}>
                {t.l}
              </button>
            );
          })}
        </div>
      </div>

      {/* Player avatar chip */}
      <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0, marginLeft:8 }}>
        <div style={{
          background:clr.bg, border:`2px solid ${clr.fg}44`,
          borderRadius:r.pill, padding:"4px 12px",
          display:"flex", alignItems:"center", gap:6,
        }}>
          <div style={{
            width:18, height:18, borderRadius:"50%",
            background:clr.fg, color:clr.bg,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:10, fontWeight:900, fontFamily:"'Oswald',sans-serif",
            flexShrink:0,
          }}>
            {player.name[0].toUpperCase()}
          </div>
          <span style={{ color:clr.fg, fontSize:11, fontWeight:700, letterSpacing:0.5 }}>
            {player.name}
          </span>
        </div>
        <button onClick={onLogout} style={{
          padding:"4px 8px", borderRadius:r.sm,
          border:`1px solid ${C.border}`,
          background:"transparent", color:C.muted,
          fontFamily:"inherit", fontSize:10, cursor:"pointer",
        }}>
          Out
        </button>
      </div>
    </nav>
  );
}
