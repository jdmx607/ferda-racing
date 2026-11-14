import { TTL, TTC } from "../theme";
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
 * Compact race header. The 48×48 left slot is reserved for a monochrome track
 * outline / logo: pass `trackArt` (an <img>, <svg> or any node) to fill it.
 * The track multiplier shows as a badge ("INT ×0.5") next to the track name.
 */
export function RaceHeader({
  title, track, trackType, stage, live = false, trackArt, right,
}) {
  return (
    <header className="race-header">
      <div className="track-slot">{trackArt || <TrackPlaceholder />}</div>

      <div style={{ minWidth: 0 }}>
        <div className="race-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {live && <span className="live-dot" aria-label="Live" />}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
        </div>
        <div className="race-meta rh-meta">
          {track && <span className="rh-track">{track}</span>}
          {trackType && TTL[trackType] && (
            <span className="rh-badge num" style={{ color: TTC[trackType] }} title={`${trackType.replace("_", " ")} track multiplier`}>
              {TTL[trackType]} ×{TRACK_MULTS[trackType]}
            </span>
          )}
        </div>
        {stage != null && <div className="race-meta num" style={{ marginTop: 2 }}>Stage {stage}</div>}
      </div>

      {right && <div className="race-stats">{right}</div>}
    </header>
  );
}
