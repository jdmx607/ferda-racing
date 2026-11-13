import { useEffect, useRef, useState } from "react";
import { DRIVER_INFO } from "../constants";
import { carNumber, paintFor } from "../driverPaint";

/**
 * Compact full-width driver card.
 *   [40×40 badge] [name / make · P3 • Start P8] [live points / position delta pill]
 * A 3px bar on the left edge carries the driver's paint scheme, and the card
 * flashes a soft green pulse whenever `points` goes up.
 *
 * `badge` replaces the italic number — pass an <img> / <svg> for official number
 * art; the 40×40 slot clips + contains it so row height and padding never change.
 */
export function DriverCard({
  driver, points = 0, startPos, currentPos, dnf = false, dnr = false,
  mulligan = false, breakdown, badge, tag,
}) {
  const info = DRIVER_INFO[driver] || {};
  const num  = carNumber(driver);
  const name = String(driver || "").replace(/^#\S+\s*/, "");

  // pulse on score increase (skip the very first render)
  const prev = useRef(points);
  const [gain, setGain] = useState(false);
  useEffect(() => {
    if (points > prev.current) {
      setGain(true);
      const t = setTimeout(() => setGain(false), 1500);
      prev.current = points;
      return () => clearTimeout(t);
    }
    prev.current = points;
  }, [points]);

  const hasPos   = Number.isFinite(currentPos) && currentPos > 0;
  const hasStart = Number.isFinite(startPos) && startPos > 0;
  const delta    = hasPos && hasStart ? startPos - currentPos : null;

  const posText = [
    hasPos && `P${currentPos}`,
    hasStart && `Start P${startPos}`,
  ].filter(Boolean).join(" • ");
  const meta = [info.make, posText, !posText && info.team].filter(Boolean).join(" · ");

  const ptsClass = points > 0 ? "var(--go)" : points < 0 ? "var(--stop)" : "var(--text-2)";
  const chips = (breakdown || []).filter(b => b.pts !== 0);

  return (
    <div
      className={`dc${gain ? " is-gain" : ""}${dnr ? " is-out" : ""}`}
      style={{ "--paint": paintFor(driver) }}
    >
      <div className="dc-badge">
        {badge || <span className="dc-num num">{num || "—"}</span>}
      </div>

      <div style={{ minWidth: 0 }}>
        <div className="dc-name">
          {tag && <span style={{ color: "var(--text-3)", fontWeight: 600, marginRight: 6 }} className="num">{tag}</span>}
          {name}
        </div>
        <div className="dc-meta num">{meta || "—"}</div>
        {(chips.length > 0 || mulligan) && !dnr && (
          <div className="dc-chips">
            {mulligan && <span className="chip">MULL</span>}
            {chips.map((b, i) => (
              <span key={i} className={`chip num ${b.pts > 0 ? "up" : "down"}`}>
                {b.label} {b.pts > 0 ? "+" : ""}{b.pts}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="dc-right">
        <div className="dc-pts num" style={{ color: ptsClass }}>
          {points > 0 ? "+" : ""}{points}
        </div>
        {dnr ? <span className="pill">DNR</span>
          : dnf ? <span className="pill down">DNF</span>
          : delta != null ? (
              <span className={`pill num ${delta > 0 ? "up" : delta < 0 ? "down" : ""}`}>
                {delta > 0 ? "+" : ""}{delta} POS
              </span>
            )
          : null}
      </div>
    </div>
  );
}
