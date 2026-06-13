import { useState } from "react";
import { DRIVERS, DRIVER_INFO, MAKE_COLORS } from "../constants";

const KYLE_QUOTES = [
  "I hate second place. There's nothing good about it.",
  "My goal every single weekend is a win — not a top five, not a top ten. A win.",
  "You can call me whatever you want. I'll let the trophy do the talking.",
  "Racing is everything to me. I grew up wanting to be the best, and I still do.",
  "Nothing feels worse than being the fastest car all weekend and not winning.",
  "I've always believed I was the best. In this sport, you have to.",
  "The checkered flag is the only flag that matters to me.",
  "If I'm not trying to win, I'm wasting everyone's time.",
  "Pressure doesn't rattle me — that's when I'm at my best.",
  "When I get in that race car, the whole world goes away. It's just me and the track.",
  "Winning is a habit. So is losing. I only practice one of them.",
  "Hard work is table stakes. Wanting it more than everyone else — that's the difference.",
  "I grew up watching NASCAR and I knew that's what I was going to do. There was never another option.",
  "Championships are won on the days you don't feel like it.",
  "Some people race for fun. I race to win.",
];

const BACKDROP_DRIVERS = DRIVERS.filter(
  d => !d.includes("/") && !d.includes("Various") && d !== "#8 Kyle Busch"
);

export function FerdaLogo({ size = "large" }) {
  const lg = size === "large";
  const fs = lg ? 52 : 22;
  const sh = lg ? 40 : 16;
  const sw = lg ? 4 : 2;
  const gap = lg ? 3 : 1.5;
  const stripeColors = ["#ffcf00", "#ff0000", "#ff0000", "#0077c8", "#0077c8"];
  return (
    <div style={{ display:"inline-flex", alignItems:"center", gap: lg ? 4 : 2 }}>
      <div style={{ display:"flex", gap, transform:"skewX(-12deg)" }}>
        {stripeColors.map((c, i) => (
          <div key={i} style={{ width:sw, height:sh, background:c, borderRadius:1 }} />
        ))}
      </div>
      <span style={{
        fontFamily:"'Oswald',sans-serif", fontSize:fs, fontWeight:900, fontStyle:"italic",
        color:"#ffffff", letterSpacing: lg ? 4 : 2, lineHeight:1, transform:"skewX(-6deg)",
      }}>FERDA</span>
    </div>
  );
}

export function MemorialBackdrop() {
  const [info] = useState(() => {
    const d = BACKDROP_DRIVERS[Math.floor(Math.random() * BACKDROP_DRIVERS.length)];
    const num  = d.match(/^#(\S+)/)?.[1] ?? "?";
    const make = DRIVER_INFO[d]?.make ?? "Chevy";
    const name = d.replace(/^#\S+\s+/, "");
    const team = DRIVER_INFO[d]?.team ?? "";
    return { num, name, team, color: MAKE_COLORS[make] ?? "#ffffff" };
  });
  const [quote] = useState(() => KYLE_QUOTES[Math.floor(Math.random() * KYLE_QUOTES.length)]);

  const vw = info.num.length === 1 ? 200 : 380;
  const cx = vw / 2;

  return (
    <div aria-hidden style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none", overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%" }}>
        <svg viewBox={`0 0 ${vw} 280`} style={{ width:"min(70vw,520px)", opacity:0.05 }} xmlns="http://www.w3.org/2000/svg">
          <text x={cx} y="240" textAnchor="middle" fontFamily="'Oswald',sans-serif"
            fontSize="260" fontWeight="900" fontStyle="italic"
            fill="none" stroke={info.color} strokeWidth="6">
            {info.num}
          </text>
        </svg>
      </div>
      <div style={{
        position:"absolute", bottom:98, left:0, right:0,
        textAlign:"center", color:"rgba(255,255,255,0.05)",
        fontSize:10, letterSpacing:3, textTransform:"uppercase",
        fontFamily:"'Oswald',sans-serif",
      }}>
        #{info.num} · {info.name} · {info.team}
      </div>
      <div style={{
        position:"absolute", bottom:75, left:0, right:0,
        textAlign:"center", color:"rgba(255,255,255,0.06)",
        fontSize:10, fontStyle:"italic", padding:"0 12%", lineHeight:1.5,
        fontFamily:"'Barlow Condensed',sans-serif",
      }}>
        "{quote}"
        <span style={{ fontSize:8, fontStyle:"normal", letterSpacing:1.5, marginLeft:6 }}>
          — KYLE BUSCH, 1985–2026
        </span>
      </div>
    </div>
  );
}
