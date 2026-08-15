import { useState, useEffect, useMemo } from "react";
import { C, PClr, r, shadow } from "../theme";
import { PLAYERS, PNAME } from "../constants";
import { buildActivityFeed } from "../engine/activity";

// Only shows once there's genuinely room for it beside the centered 900px
// tab column — narrower and it'd overlap content instead of filling margin.
function useWideDesktop() {
  const [wide, setWide] = useState(
    typeof window !== "undefined" && window.innerWidth >= 1400
  );
  useEffect(() => {
    const h = () => setWide(window.innerWidth >= 1400);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return wide;
}

export function RightRail({ data }) {
  const wide = useWideDesktop();

  const standings = useMemo(() =>
    PLAYERS.map(p => ({ id: p.id, pts: data?.meta?.standings?.[p.id] || 0 }))
      .sort((a, b) => b.pts - a.pts),
    [data]
  );

  const feed = useMemo(() => buildActivityFeed(data), [data]);

  if (!wide || !data) return null;

  return (
    <div style={{
      position: "fixed", top: 70, right: 24, width: 290, zIndex: 10,
      display: "flex", flexDirection: "column", gap: 14,
      maxHeight: "calc(100vh - 100px)", overflowY: "auto",
    }}>
      {/* ── Standings snapshot ────────────────────────────────────────────── */}
      <div style={{ background: C.card, borderRadius: r.lg, padding: 16, border: `1px solid ${C.border}`, boxShadow: shadow.card }}>
        <div style={{ color: C.accent, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>
          Standings
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {standings.map((s, i) => (
            <div key={s.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "6px 10px", background: PClr[s.id].bg, borderRadius: r.sm,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: PClr[s.id].fg + "88", fontSize: 10, fontWeight: 700, width: 14 }}>{i + 1}</span>
                <span style={{ color: PClr[s.id].fg, fontSize: 12, fontWeight: 700 }}>{PNAME[s.id]}</span>
              </div>
              <span style={{ color: PClr[s.id].fg, fontFamily: "'Oswald',sans-serif", fontSize: 14, fontWeight: 900 }}>
                {s.pts.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Recent activity ───────────────────────────────────────────────── */}
      <div style={{ background: C.card, borderRadius: r.lg, padding: 16, border: `1px solid ${C.border}`, boxShadow: shadow.card }}>
        <div style={{ color: C.accent, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, marginBottom: 10 }}>
          Recent Activity
        </div>
        {feed.length === 0 ? (
          <div style={{ color: C.muted, fontSize: 12, textAlign: "center", padding: "12px 0" }}>
            Nothing yet this season.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {feed.map((ev, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ fontSize: 13, flexShrink: 0, lineHeight: 1.4 }}>{ev.icon}</span>
                <span style={{ color: C.textDim, fontSize: 11.5, lineHeight: 1.5 }}>{ev.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
