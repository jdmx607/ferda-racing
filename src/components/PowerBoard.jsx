import { PClr } from "../theme";
import { PNAME } from "../constants";
import { formatRankDelta } from "../engine/power";

/** Rank-change badge: "▲ +1" (green), "▼ -1" (red) or "—". */
export function RankDelta({ delta, className = "" }) {
  const cls = delta > 0 ? "trend-up" : delta < 0 ? "trend-down" : "trend-flat";
  return <span className={`num ${cls} ${className}`} style={{ fontWeight: 700 }}>{formatRankDelta(delta)}</span>;
}

/**
 * Full Power Rankings: every player ranked by PWR, with rank change, the 4-race
 * weighted breakdown (Points · Top-10s · Wins · Mulligans) and the form insight.
 * Used by the Home "Full Rankings" drawer and the Stats tab.
 */
export function PowerBoard({ rankings, intro = true }) {
  if (!rankings.length) {
    return <div style={{ color: "var(--text-3)", textAlign: "center", padding: 32, fontSize: 13 }}>No scored weeks yet.</div>;
  }
  return (
    <div>
      {intro && (
        <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.55, marginBottom: 12 }}>
          <strong style={{ color: "var(--text)" }}>PWR</strong> is a 0–100 momentum rating: each race's performance
          (points + Top-10 drivers − wrecks + week placement − Mulligans), weighted{" "}
          <span className="num">40 / 30 / 20 / 10</span> over the last 4 races. <span className="num">250 = 100.0</span>.
        </div>
      )}
      <div style={{ display: "grid", gap: 8 }}>
        {rankings.map(p => (
          <div key={p.id} className="pwr-row">
            <div className="pwr-top">
              <span className="num label" style={{ width: 14 }}>{p.rank}</span>
              <span className="dot" style={{ background: PClr[p.id].accent }} />
              <span style={{ fontSize: 14.5, fontWeight: 700, minWidth: 0 }}>{PNAME[p.id]}</span>
              <RankDelta delta={p.delta} className="pwr-delta" />
              <span className="pwr-val num">
                <small>PWR</small>{p.pwr.toFixed(1)}
              </span>
            </div>
            <div className="pwr-insight">{p.insight}</div>
            <div className="pwr-chips">
              <span className="chip num" title="Recency-weighted average points per race">PTS {p.breakdown.points}</span>
              <span className="chip num" title="Top-10 finishing drivers in the window">T10 {p.breakdown.top10}</span>
              <span className="chip num" title="Weekly wins in the window">W {p.breakdown.wins}</span>
              <span className="chip num" title="Mulligans used in the window">M {p.breakdown.mulligans}</span>
              <span className="pwr-races num">{p.breakdown.races} race{p.breakdown.races === 1 ? "" : "s"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
