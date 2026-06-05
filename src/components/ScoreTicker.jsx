import { C, PClr } from "../theme";
import { PNAME, SCHEDULE } from "../constants";

// Horizontal scrolling live score ticker — shown below the nav during active races.
// Displays player standings + top-scoring drivers this race.

function TickerItem({ children, accent }) {
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:6,
      padding:"0 16px",
      borderRight:`1px solid rgba(255,255,255,0.12)`,
      color: accent ? "#f59e0b" : "rgba(255,255,255,0.85)",
      whiteSpace:"nowrap",
    }}>
      {children}
    </span>
  );
}

export function ScoreTicker({ data, liveScores, liveStatus, raceInfo }) {
  if (!data?.liveRace?.active || !liveScores) return null;

  const week     = data.liveRace.week;
  const weekInfo = SCHEDULE.find(s => s.w === week);

  // Sort players by live race pts
  const ranked = Object.entries(liveScores)
    .sort((a, b) => b[1].total - a[1].total);

  // Collect top-scoring drivers across all lineups
  const allDrivers = [];
  ranked.forEach(([pid, s]) => {
    (s.drivers || []).forEach(d => {
      if (!d.dnr && d.total !== 0) {
        allDrivers.push({ ...d, pid });
      }
    });
  });
  allDrivers.sort((a, b) => b.total - a.total);
  const topDrivers = allDrivers.slice(0, 6);

  // Build the ticker items — duplicated for seamless infinite scroll
  const items = [
    <TickerItem key="live-label" accent>
      <span style={{
        width:8, height:8, borderRadius:"50%", background:"#ef4444", flexShrink:0,
        animation:"livePulse 1.5s ease-in-out infinite", display:"inline-block",
      }}/>
      {raceInfo?.raceName || weekInfo?.r || `W${week}`}
    </TickerItem>,

    ...ranked.map(([pid, s], i) => (
      <TickerItem key={`p-${pid}`}>
        <span style={{
          fontFamily:"'Oswald',sans-serif", fontSize:12, fontWeight:700,
          color:"rgba(255,255,255,0.45)",
        }}>
          {i + 1}
        </span>
        <span style={{
          width:10, height:10, borderRadius:"50%",
          background:PClr[pid].fg, flexShrink:0, display:"inline-block",
        }}/>
        <span style={{
          fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:13,
          color:PClr[pid].fg,
        }}>
          {PNAME[pid]}
        </span>
        <span style={{
          fontFamily:"'Oswald',sans-serif", fontWeight:900, fontSize:14,
          color: s.total > 0 ? "#10b981" : s.total < 0 ? "#ef4444" : "rgba(255,255,255,0.6)",
        }}>
          {s.total > 0 ? "+" : ""}{s.total}
        </span>
      </TickerItem>
    )),

    <TickerItem key="divider" accent>·</TickerItem>,

    ...topDrivers.map((d, i) => (
      <TickerItem key={`d-${d.driver}-${i}`}>
        <span style={{
          width:8, height:8, borderRadius:"50%",
          background:PClr[d.pid].fg, flexShrink:0, display:"inline-block",
          opacity:0.7,
        }}/>
        <span style={{
          fontFamily:"'Barlow Condensed',sans-serif", fontSize:12,
          color:"rgba(255,255,255,0.7)",
        }}>
          {d.driver}
        </span>
        <span style={{
          fontFamily:"'Oswald',sans-serif", fontWeight:700, fontSize:13,
          color: d.total > 0 ? "#10b981" : "#ef4444",
        }}>
          {d.total > 0 ? "+" : ""}{d.total}
        </span>
      </TickerItem>
    )),

    <TickerItem key="ts">
      <span style={{ color:"rgba(255,255,255,0.35)", fontSize:10 }}>{liveStatus}</span>
    </TickerItem>,
  ];

  // Duplicate content for seamless loop
  const allItems = [...items, ...items];

  const tickerWidth = (items.length * 160) + "px"; // approx per item

  return (
    <div style={{
      background:"linear-gradient(90deg, #1a0000, #0a0e17 30%, #0a0e17 70%, #1a0000)",
      borderBottom:`1px solid #ef444433`,
      height:36, overflow:"hidden",
      position:"relative", zIndex:99,
    }}>
      {/* Fade masks on edges */}
      <div style={{
        position:"absolute", left:0, top:0, bottom:0, width:60, zIndex:2,
        background:"linear-gradient(90deg, #0a0e17, transparent)",
        pointerEvents:"none",
      }}/>
      <div style={{
        position:"absolute", right:0, top:0, bottom:0, width:60, zIndex:2,
        background:"linear-gradient(270deg, #0a0e17, transparent)",
        pointerEvents:"none",
      }}/>

      {/* Scrolling content */}
      <div style={{
        display:"inline-flex", alignItems:"center", height:"100%",
        animation:`tickerScroll ${items.length * 4}s linear infinite`,
        willChange:"transform",
      }}>
        {allItems}
      </div>

      <style>{`
        @keyframes tickerScroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes livePulse {
          0%, 100% { opacity:1; transform:scale(1); }
          50%       { opacity:0.3; transform:scale(1.4); }
        }
      `}</style>
    </div>
  );
}
