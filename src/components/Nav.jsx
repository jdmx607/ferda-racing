import { useState, useEffect } from "react";
import { C, PClr, r } from "../theme";
import { PLAYERS, PNAME, ACTIVE_PICKS } from "../constants";
import { getDraftOrder, buildSnakeOrder } from "../engine/draft";
import { FerdaLogo } from "./FerdaLogo";

// ── Responsive hook ───────────────────────────────────────────────────────────
function useMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < 640
  );
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return isMobile;
}

// ── SVG icons (no icon library needed) ───────────────────────────────────────
const Icon = {
  Home: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
    </svg>
  ),
  Draft: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
    </svg>
  ),
  Live: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="4"/>
      <path d="M6.34 6.34a8 8 0 0 0 0 11.32M17.66 6.34a8 8 0 0 1 0 11.32" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    </svg>
  ),
  Results: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/>
    </svg>
  ),
  More: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5"  cy="12" r="2"/>
      <circle cx="12" cy="12" r="2"/>
      <circle cx="19" cy="12" r="2"/>
    </svg>
  ),
};

// ── Flag banner (used by both nav types) ──────────────────────────────────────
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
      cursor:onClick?"pointer":"default",
      display:"flex", alignItems:"center", justifyContent:"center", gap:10,
      borderBottom:"2px solid rgba(0,0,0,0.3)",
      position:"relative", zIndex:1,
      animation:flag==="green"?"pulse 2s infinite":"none",
    }}>
      <span style={{ fontSize:20 }}>{f.icon}</span>
      <span style={{
        background:flag==="checkered"?"rgba(0,0,0,0.6)":"transparent",
        padding:flag==="checkered"?"4px 10px":0,
        borderRadius:6,
      }}>{text}</span>
      {onClick&&<span style={{ fontSize:11, opacity:0.7, marginLeft:4 }}>→</span>}
    </div>
  );
}

export function FlagBanner({ user, data, currentWeek, onGoTo }) {
  if (!user || !data) return null;
  const draftKey      = "w" + currentWeek;
  const draftState    = data.drafts?.[draftKey] || [];
  const draftOrder    = getDraftOrder(data, currentWeek);
  const snakeSequence = buildSnakeOrder(draftOrder);
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
    return <Banner flag={lastRound?"white":"green"} text={lastRound?"FINAL ROUND — Your pick!":"Your turn to pick!"} onClick={() => onGoTo("draft")} />;
  if (nextTurn?.pid === user.id)
    return <Banner flag="yellow" text={`You're up next after ${PNAME[currentTurn.pid]}`} />;
  return <Banner flag="red" text={`Waiting on ${PNAME[currentTurn.pid]} to pick`} />;
}

// ── Desktop horizontal nav (unchanged from before) ────────────────────────────
function DesktopNav({ player, tab, setTab, onLogout }) {
  const clr = PClr[player.id];
  const tabs = [
    { id:"welcome",      l:"Home"        },
    { id:"draft",        l:"Draft"       },
    { id:"lineups",      l:"Lineups"     },
    { id:"mulligans",    l:"Mulligans"   },
    { id:"live",         l:"🔴 Live"     },
    { id:"results",      l:"Results"     },
    { id:"feed",         l:"Feed"        },
    { id:"news",         l:"News"        },
    { id:"stats",        l:"Stats"       },
    { id:"history",      l:"History"     },
    { id:"playoffs",     l:"Playoffs"    },
    { id:"schedule",     l:"Schedule"    },
    { id:"rules",        l:"Rules"       },
    { id:"settings",     l:"Settings"    },
  ];
  if (player.id === "justin") tabs.push({ id:"commissioner", l:"COMMISH", red:true });

  return (
    <nav style={{
      background:"rgba(0,0,0,0.92)", backdropFilter:"blur(12px)",
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
                padding:"6px 8px", borderRadius:r.sm,
                border:isRed ? `1px solid ${isActive?"#ef4444":"#ef444466"}` : "none",
                background:isActive ? (isRed?"#ef4444":C.accent+"22") : "transparent",
                color:isActive ? (isRed?"#fff":C.accent) : (isRed?"#ef4444":C.dim),
                fontFamily:"'Barlow Condensed',sans-serif",
                fontSize:11, fontWeight:isActive?700:600,
                cursor:"pointer", letterSpacing:1, textTransform:"uppercase",
                whiteSpace:"nowrap",
                borderBottom:isActive&&!isRed?`2px solid ${C.accent}`:"2px solid transparent",
                transition:"all 0.12s ease",
              }}>{t.l}</button>
            );
          })}
        </div>
      </div>
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
          }}>{player.name[0].toUpperCase()}</div>
          <span style={{ color:clr.fg, fontSize:11, fontWeight:700 }}>{player.name}</span>
        </div>
        <button onClick={onLogout} style={{
          padding:"4px 8px", borderRadius:r.sm,
          border:`1px solid ${C.border}`,
          background:"transparent", color:C.muted,
          fontFamily:"inherit", fontSize:10, cursor:"pointer",
        }}>Out</button>
      </div>
    </nav>
  );
}

// ── Mobile bottom nav ─────────────────────────────────────────────────────────
const PRIMARY_TABS = [
  { id:"welcome", label:"Home",    Icon:Icon.Home    },
  { id:"draft",   label:"Draft",   Icon:Icon.Draft   },
  { id:"live",    label:"Live",    Icon:Icon.Live    },
  { id:"results", label:"Results", Icon:Icon.Results },
];

const MORE_TABS = [
  { id:"feed",         label:"Feed"        },
  { id:"news",         label:"News"        },
  { id:"stats",        label:"Stats"       },
  { id:"history",      label:"History"     },
  { id:"playoffs",     label:"Playoffs"    },
  { id:"lineups",      label:"Lineups"     },
  { id:"mulligans",    label:"Mulligans"   },
  { id:"schedule",     label:"Schedule"    },
  { id:"rules",        label:"Rules"       },
  { id:"settings",     label:"Settings"    },
];

function MobileNav({ player, tab, setTab, onLogout }) {
  const [showMore, setShowMore] = useState(false);
  const clr = PClr[player.id];
  const isInMore = [...MORE_TABS, { id:"commissioner" }].some(t => t.id === tab);
  const moreTabs = player.id === "justin"
    ? [...MORE_TABS, { id:"commissioner", label:"COMMISH" }]
    : MORE_TABS;

  const goTo = (id) => { setTab(id); setShowMore(false); };

  return (
    <>
      {/* ── More sheet overlay ───────────────────────────────────────────── */}
      {showMore && (
        <div
          onClick={() => setShowMore(false)}
          style={{
            position:"fixed", inset:0, zIndex:198,
            background:"rgba(0,0,0,0.6)", backdropFilter:"blur(4px)",
          }}
        />
      )}

      {/* ── More sheet content ───────────────────────────────────────────── */}
      <div style={{
        position:"fixed", bottom:64, left:0, right:0, zIndex:199,
        transform:showMore?"translateY(0)":"translateY(110%)",
        transition:"transform 0.28s cubic-bezier(0.4,0,0.2,1)",
        background:C.card,
        borderTop:`1px solid ${C.borderBright}`,
        borderRadius:"20px 20px 0 0",
        padding:"16px 12px 8px",
        boxShadow:"0 -8px 32px rgba(0,0,0,0.5)",
      }}>
        {/* Handle bar */}
        <div style={{
          width:36, height:4, borderRadius:r.pill,
          background:C.border, margin:"0 auto 16px",
        }}/>

        {/* Player chip + logout */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          marginBottom:16, padding:"0 4px",
        }}>
          <div style={{
            display:"flex", alignItems:"center", gap:8,
            background:clr.bg, borderRadius:r.pill, padding:"6px 14px",
            border:`1px solid ${clr.fg}33`,
          }}>
            <div style={{
              width:22, height:22, borderRadius:"50%",
              background:clr.fg, color:clr.bg,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:11, fontWeight:900, fontFamily:"'Oswald',sans-serif",
            }}>{player.name[0]}</div>
            <span style={{ color:clr.fg, fontWeight:700, fontSize:13 }}>{player.name}</span>
          </div>
          <button onClick={onLogout} style={{
            padding:"6px 14px", borderRadius:r.pill,
            border:`1px solid ${C.border}`, background:"transparent",
            color:C.muted, fontSize:12, cursor:"pointer", fontFamily:"inherit",
          }}>Sign Out</button>
        </div>

        {/* Tab grid */}
        <div style={{
          display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6,
          paddingBottom:8,
        }}>
          {moreTabs.map(t => {
            const isActive = tab === t.id;
            const isCommish = t.id === "commissioner";
            return (
              <button key={t.id} onClick={() => goTo(t.id)} style={{
                padding:"12px 8px", borderRadius:r.md,
                border:`1px solid ${isActive?(isCommish?"#ef4444":C.accent)+"66":C.border}`,
                background:isActive?(isCommish?"#ef444422":C.accent+"18"):"transparent",
                color:isActive?(isCommish?"#ef4444":C.accent):C.textDim,
                fontFamily:"'Barlow Condensed',sans-serif",
                fontSize:12, fontWeight:700, cursor:"pointer",
                letterSpacing:1, textTransform:"uppercase",
                textAlign:"center",
              }}>{t.label}</button>
            );
          })}
        </div>
      </div>

      {/* ── Bottom tab bar ───────────────────────────────────────────────── */}
      <nav style={{
        position:"fixed", bottom:0, left:0, right:0, zIndex:200,
        background:"rgba(0,0,0,0.95)", backdropFilter:"blur(16px)",
        borderTop:`1px solid ${C.border}`,
        display:"flex", alignItems:"stretch",
        height:64,
        paddingBottom:"env(safe-area-inset-bottom, 0px)",
      }}>
        {PRIMARY_TABS.map(({ id, label, Icon: TabIcon }) => {
          const isActive = tab === id;
          return (
            <button key={id} onClick={() => goTo(id)} style={{
              flex:1, display:"flex", flexDirection:"column",
              alignItems:"center", justifyContent:"center", gap:3,
              background:"transparent", border:"none",
              color:isActive ? C.accent : C.muted,
              cursor:"pointer", padding:"8px 0",
              transition:"all 0.12s ease",
            }}>
              <TabIcon/>
              <span style={{
                fontSize:9, fontWeight:700, letterSpacing:0.5,
                textTransform:"uppercase",
                color:isActive ? C.accent : C.muted,
              }}>{label}</span>
              {isActive && (
                <div style={{
                  position:"absolute", top:0, width:20, height:2,
                  background:C.accent, borderRadius:r.pill,
                }}/>
              )}
            </button>
          );
        })}

        {/* More button */}
        <button onClick={() => setShowMore(s => !s)} style={{
          flex:1, display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", gap:3,
          background:"transparent", border:"none",
          color:(showMore || isInMore) ? C.accent : C.muted,
          cursor:"pointer", padding:"8px 0",
          position:"relative",
        }}>
          <Icon.More/>
          <span style={{
            fontSize:9, fontWeight:700, letterSpacing:0.5,
            textTransform:"uppercase",
            color:(showMore || isInMore) ? C.accent : C.muted,
          }}>More</span>
          {isInMore && !showMore && (
            <div style={{
              width:5, height:5, borderRadius:"50%",
              background:C.accent,
              position:"absolute", top:8, right:"28%",
            }}/>
          )}
        </button>
      </nav>
    </>
  );
}

// ── Exported Nav (picks desktop vs. mobile automatically) ─────────────────────
export function Nav({ player, tab, setTab, onLogout }) {
  const isMobile = useMobile();
  return isMobile
    ? <MobileNav  player={player} tab={tab} setTab={setTab} onLogout={onLogout}/>
    : <DesktopNav player={player} tab={tab} setTab={setTab} onLogout={onLogout}/>;
}
