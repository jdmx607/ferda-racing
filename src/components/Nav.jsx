import { useState, useEffect } from "react";
import { PClr, r } from "../theme";
import { PLAYERS, PNAME, ACTIVE_PICKS, PLAYOFF_START_WEEK, SCHEDULE } from "../constants";

function isChaseLive(data) {
  return Object.keys(data?.results || {}).length >= PLAYOFF_START_WEEK;
}
import { getDraftOrder, buildSnakeOrder } from "../engine/draft";
import { storeFor } from "../engine/events";
import { weekName } from "../exhibitions";
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
  Feed: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="19" r="2"/>
      <path d="M4 11a9 9 0 0 1 9 9h-3a6 6 0 0 0-6-6v-3z"/>
      <path d="M4 5a15 15 0 0 1 15 15h-3A12 12 0 0 0 4 8V5z"/>
    </svg>
  ),
  News: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="4" width="16" height="16" rx="2"/>
      <path d="M8 9h8M8 12.5h8M8 16h5" strokeLinecap="round"/>
    </svg>
  ),
  Stats: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="13" width="4" height="7" rx="1"/>
      <rect x="10" y="8" width="4" height="12" rx="1"/>
      <rect x="16" y="4" width="4" height="16" rx="1"/>
    </svg>
  ),
  History: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="13" r="8"/>
      <path d="M12 9v4l3 2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 6l2.5 1M2.5 3.5L4 6" strokeLinecap="round"/>
    </svg>
  ),
  Chase: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 4h10v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5V4z"/>
      <path d="M5 5H3v2a4 4 0 0 0 4 4V9a2 2 0 0 1-2-2V5zM19 5h2v2a4 4 0 0 1-4 4V9a2 2 0 0 0 2-2V5z"/>
      <rect x="10.5" y="12" width="3" height="4"/>
      <rect x="7" y="17" width="10" height="3" rx="1"/>
    </svg>
  ),
  ISC: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="3" width="1.6" height="18"/>
      <path d="M5.6 4h11l-3 3.5 3 3.5h-11z"/>
    </svg>
  ),
  Lineups: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="5" y="3.5" width="14" height="17" rx="2"/>
      <path d="M9 3.5v-1a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" strokeLinecap="round"/>
      <path d="M8 10h8M8 13.5h8M8 17h5" strokeLinecap="round"/>
    </svg>
  ),
  Schedule: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="5" width="16" height="15" rx="2"/>
      <path d="M4 9.5h16M8 3v3M16 3v3" strokeLinecap="round"/>
    </svg>
  ),
  Drivers: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8.5"/>
      <circle cx="12" cy="12" r="2"/>
      <path d="M12 14v6.5M10.2 11L3.7 9.5M13.8 11l6.5-1.5" strokeLinecap="round"/>
    </svg>
  ),
  Mulligans: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 8a7.5 7.5 0 1 0 1.5 4.5" strokeLinecap="round"/>
      <path d="M19 3v5h-5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Rules: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 6c-1.5-1.2-4-1.7-7-1.2v13.4c3-0.5 5.5 0 7 1.2 1.5-1.2 4-1.7 7-1.2V4.8c-3-0.5-5.5 0-7 1.2z" strokeLinejoin="round"/>
      <path d="M12 6v13.4"/>
    </svg>
  ),
  Settings: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm8.3 3.5c0 .4 0 .8-.1 1.2l2 1.5-2 3.4-2.3-.9c-.6.5-1.3.9-2 1.2L15.5 21h-3l-.4-2.6c-.7-.3-1.4-.7-2-1.2l-2.3.9-2-3.4 2-1.5c-.1-.4-.1-.8-.1-1.2s0-.8.1-1.2l-2-1.5 2-3.4 2.3.9c.6-.5 1.3-.9 2-1.2L12.5 3h3l.4 2.6c.7.3 1.4.7 2 1.2l2.3-.9 2 3.4-2 1.5c.1.4.1.8.1 1.2z"/>
    </svg>
  ),
  Commissioner: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l7 3v6c0 5-3 8.5-7 11-4-2.5-7-6-7-11V5l7-3z"/>
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

// ── Status banner (draft turn) — flat, with a left tone bar ──────────────────
// tone: go = your turn · caution = you're up next · stop = waiting · done = settled
function Banner({ flag, text, onClick }) {
  const tone = { green:"go", white:"go", yellow:"caution", red:"stop", checkered:"done" }[flag] || "done";
  return (
    <div className="status-banner" data-tone={tone} onClick={onClick}
         style={{ cursor:onClick ? "pointer" : "default" }} role={onClick ? "button" : "status"}>
      <span style={{ flex:1, minWidth:0 }}>{text}</span>
      {onClick && <span style={{ color:"var(--text-2)", fontSize:12 }}>→</span>}
    </div>
  );
}

export function FlagBanner({ user, data, currentWeek, onGoTo }) {
  if (!user || !data) return null;
  if (!SCHEDULE.some(s => s.w === currentWeek)) return null; // season over
  const draftKey      = "w" + currentWeek;
  const src           = storeFor(data, currentWeek);
  const draftState    = src.drafts?.[draftKey] || [];
  const draftOrder    = getDraftOrder(data, currentWeek);
  const snakeSequence = buildSnakeOrder(draftOrder);
  const currentPickNum = draftState.length;
  const draftComplete  = currentPickNum >= snakeSequence.length;
  const savedPicks     = src.picks?.[draftKey] || {};
  const hasSavedPicks  = Object.values(savedPicks).some(p => p && p.length > 0);
  const hasScored      = !!(src.results?.[draftKey]?.scored);

  if (draftState.length === 0 && !hasSavedPicks && !hasScored) {
    const opensAt = src.draftSchedule?.[draftKey]?.opensAt;
    if (opensAt && Date.now() < new Date(opensAt).getTime()) return null; // draft not open yet
    const firstUp = snakeSequence[0]?.pid;
    if (firstUp === user.id)
      return <Banner flag="green" text={`Your turn to pick first for ${weekName(currentWeek)}!`} onClick={() => onGoTo("draft")} />;
    return null;
  }
  if (hasScored)
    return <Banner flag="checkered" text={`${weekName(currentWeek)} is complete. Results posted.`} onClick={() => onGoTo("results")} />;
  if (draftComplete || (hasSavedPicks && draftState.length === 0))
    return <Banner flag="checkered" text={`All picks locked for ${weekName(currentWeek)}. Race day!`} onClick={() => onGoTo("lineups")} />;

  const currentTurn = snakeSequence[currentPickNum];
  const nextTurn    = snakeSequence[currentPickNum + 1];
  const lastRound   = currentTurn?.round === ACTIVE_PICKS;

  if (currentTurn?.pid === user.id)
    return <Banner flag={lastRound?"white":"green"} text={lastRound?"FINAL ROUND — Your pick!":"Your turn to pick!"} onClick={() => onGoTo("draft")} />;
  if (nextTurn?.pid === user.id)
    return <Banner flag="yellow" text={`You're up next after ${PNAME[currentTurn.pid]}`} />;
  return <Banner flag="red" text={`Waiting on ${PNAME[currentTurn.pid]} to pick`} />;
}

// ── Desktop top nav — flat, text tabs with an underline for the active one ────
function DesktopNav({ player, tab, setTab, onLogout, data }) {
  const chaseLive = isChaseLive(data);
  const tabs = [
    { id:"welcome",      l:"Home"        },
    { id:"live",         l:"Live"        },
    { id:"draft",        l:"Draft"       },
    { id:"lineups",      l:"Lineups"     },
    { id:"results",      l:"Results"     },
    { id:"feed",         l:"Feed"        },
    { id:"news",         l:"News"        },
    { id:"stats",        l:"Stats"       },
    { id:"history",      l:"History"     },
    { id:"playoffs",     l:"The Chase", strong:chaseLive },
    { id:"isc",          l:"ISC"         },
    { id:"schedule",     l:"Schedule"    },
    { id:"drivers",      l:"Drivers"     },
    { id:"mulligans",    l:"Mulligans"   },
    { id:"rules",        l:"Rules"       },
    { id:"settings",     l:"Settings"    },
  ];
  if (player.id === "justin") tabs.push({ id:"commissioner", l:"Commish" });

  return (
    <nav style={{
      background:"var(--bg)", borderBottom:"1px solid var(--border)",
      display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"0 14px", height:52,
      position:"sticky", top:0, zIndex:100, overflowX:"auto",
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <FerdaLogo size="small" />
        <div style={{ display:"flex", gap:2 }}>
          {tabs.map(t => {
            const isActive = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} aria-current={isActive ? "page" : undefined} style={{
                padding:"6px 9px", border:"none", background:"transparent", cursor:"pointer",
                color:isActive ? "var(--text)" : "var(--text-2)",
                fontSize:12.5, fontWeight:isActive || t.strong ? 700 : 500,
                whiteSpace:"nowrap",
                borderBottom:`2px solid ${isActive ? "var(--text)" : "transparent"}`,
                transition:"color .12s",
              }}>{t.l}</button>
            );
          })}
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0, marginLeft:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12.5, fontWeight:600 }}>
          <span className="dot" style={{ background:PClr[player.id].accent }} />
          {player.name}
        </div>
        <button onClick={onLogout} style={{
          padding:"4px 10px", borderRadius:r.sm, border:"1px solid var(--border)",
          background:"transparent", color:"var(--text-2)", fontSize:11.5, cursor:"pointer",
        }}>Sign out</button>
      </div>
    </nav>
  );
}

// ── Mobile bottom nav — thumb-reachable, safe-area aware ──────────────────────
const PRIMARY_TABS = [
  { id:"welcome", label:"Home",    Icon:Icon.Home    },
  { id:"live",    label:"Live",    Icon:Icon.Live    },
  { id:"draft",   label:"Draft",   Icon:Icon.Draft   },
  { id:"results", label:"Results", Icon:Icon.Results },
];

const MORE_TABS = [
  { id:"feed",         label:"Feed",       Icon:Icon.Feed       },
  { id:"news",         label:"News",       Icon:Icon.News       },
  { id:"stats",        label:"Stats",      Icon:Icon.Stats      },
  { id:"history",      label:"History",    Icon:Icon.History    },
  { id:"playoffs",     label:"The Chase",  Icon:Icon.Chase      },
  { id:"isc",          label:"ISC",        Icon:Icon.ISC        },
  { id:"lineups",      label:"Lineups",    Icon:Icon.Lineups    },
  { id:"schedule",     label:"Schedule",   Icon:Icon.Schedule   },
  { id:"drivers",      label:"Drivers",    Icon:Icon.Drivers    },
  { id:"mulligans",    label:"Mulligans",  Icon:Icon.Mulligans  },
  { id:"rules",        label:"Rules",      Icon:Icon.Rules      },
  { id:"settings",     label:"Settings",   Icon:Icon.Settings   },
];

function MobileNav({ player, tab, setTab, onLogout }) {
  const [showMore, setShowMore] = useState(false);
  const isInMore = [...MORE_TABS, { id:"commissioner" }].some(t => t.id === tab);
  const moreTabs = player.id === "justin"
    ? [...MORE_TABS, { id:"commissioner", label:"Commish", Icon:Icon.Commissioner }]
    : MORE_TABS;

  const goTo = (id) => { setTab(id); setShowMore(false); };

  return (
    <>
      {showMore && <div className="sheet-scrim" onClick={() => setShowMore(false)} />}

      <div className="sheet" style={{ transform:showMore ? "translateY(0)" : "translateY(120%)", visibility:showMore ? "visible" : "hidden" }}>
        <div style={{ width:36, height:4, borderRadius:r.pill, background:"var(--border-strong)", margin:"0 auto 14px" }}/>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, padding:"0 4px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:14, fontWeight:600 }}>
            <span className="dot" style={{ background:PClr[player.id].accent }} />
            {player.name}
          </div>
          <button onClick={onLogout} style={{
            padding:"8px 14px", minHeight:36, borderRadius:r.pill, border:"1px solid var(--border)",
            background:"transparent", color:"var(--text-2)", fontSize:12, cursor:"pointer",
          }}>Sign out</button>
        </div>

        <div className="sheet-grid">
          {moreTabs.map(t => {
            const TabIcon = t.Icon;
            return (
              <button key={t.id} onClick={() => goTo(t.id)} aria-current={tab === t.id ? "page" : undefined}>
                {TabIcon && <TabIcon/>}
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <nav className="bnav" aria-label="Primary">
        {PRIMARY_TABS.map(({ id, label, Icon: TabIcon }) => (
          <button key={id} onClick={() => goTo(id)} aria-current={tab === id ? "page" : undefined}>
            <TabIcon/>
            <span>{label}</span>
          </button>
        ))}
        <button onClick={() => setShowMore(s => !s)} aria-current={(showMore || isInMore) ? "page" : undefined} aria-expanded={showMore}>
          <Icon.More/>
          <span>More</span>
        </button>
      </nav>
    </>
  );
}

// ── Exported Nav (picks desktop vs. mobile automatically) ─────────────────────
export function Nav({ player, tab, setTab, onLogout, data }) {
  const isMobile = useMobile();
  return isMobile
    ? <MobileNav  player={player} tab={tab} setTab={setTab} onLogout={onLogout}/>
    : <DesktopNav player={player} tab={tab} setTab={setTab} onLogout={onLogout} data={data}/>;
}
