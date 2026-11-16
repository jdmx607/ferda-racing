import { TrackGlyph, TrackSpecLine, auraProps } from "./TrackIdentity";

/**
 * Compact race header with discipline identity: 48×48 track silhouette in the
 * discipline accent, a subtle accent aura, and the Track · [INT ×0.5] · spec line.
 * Pass `trackArt` to override the silhouette (e.g. an official track logo).
 */
export function RaceHeader({
  title, track, trackType, stage, live = false, trackArt, right,
}) {
  return (
    <header className="race-header" {...auraProps(trackType)}>
      <div className="track-slot td-slot">{trackArt || <TrackGlyph ty={trackType} />}</div>

      <div style={{ minWidth: 0 }}>
        <div className="race-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {live && <span className="live-dot" aria-label="Live" />}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
        </div>
        <TrackSpecLine ty={trackType} track={track} className="race-meta" />
        {stage != null && <div className="race-meta num" style={{ marginTop: 2 }}>Stage {stage}</div>}
      </div>

      {right && <div className="race-stats">{right}</div>}
    </header>
  );
}
