import { TTL } from "../theme";
import { TRACK_MULTS } from "../constants";

// Faint placeholder until real monochrome track outlines / logos are supplied.
function TrackPlaceholder() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5" aria-hidden="true">
      <rect x="6" y="14" width="52" height="36" rx="18" />
      <rect x="18" y="24" width="28" height="16" rx="8" />
    </svg>
  );
}

/**
 * Compact race header. The 64×64 left slot is reserved for a monochrome track
 * outline / logo: pass `trackArt` (an <img>, <svg> or any node) to fill it.
 */
export function RaceHeader({
  title, track, trackType, stage, lap, laps, live = false, trackArt, right,
}) {
  const meta = [
    track,
    trackType && `${TTL[trackType]} ×${TRACK_MULTS[trackType]}`,
  ].filter(Boolean).join(" · ");

  return (
    <header className="race-header">
      <div className="track-slot">{trackArt || <TrackPlaceholder />}</div>

      <div style={{ minWidth: 0 }}>
        <div className="race-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {live && <span className="live-dot" aria-label="Live" />}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
        </div>
        <div className="race-meta">{meta}</div>
        {stage != null && <div className="race-meta num" style={{ marginTop: 2 }}>Stage {stage}</div>}
      </div>

      <div className="race-stats">
        {laps > 0 ? (
          <>
            <div className="label" style={{ marginBottom: 3 }}>Lap</div>
            <div className="lap num">{lap}<small> / {laps}</small></div>
          </>
        ) : right}
      </div>
    </header>
  );
}
