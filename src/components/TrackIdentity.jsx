import { DISCIPLINE, multLabel, trackSpecTag } from "../trackDiscipline";

/**
 * Custom 48×48 track silhouettes, drawn in the discipline accent
 * (2px stroke, subtle inner fill):
 *   ST  tight paperclip bullring with highlighted braking-zone arcs
 *   RC  winding left/right circuit with a start/finish line
 *   INT sweeping D-shaped oval with a high-groove racing line
 *   SS  wide tri-oval with three parallel drafting lines
 */
export function TrackGlyph({ ty, size = 48, title }) {
  const d = DISCIPLINE[ty];
  const c = d?.accent || "currentColor";
  const common = { fill: "none", stroke: c, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  const fill = { fill: c, fillOpacity: 0.1, stroke: "none" };
  let body;
  switch (ty) {
    case "short_track":
      body = <>
        <path d="M17 14 H31 A10 10 0 0 1 31 34 H17 A10 10 0 0 1 17 14 Z" {...fill} />
        <path d="M17 14 H31 A10 10 0 0 1 31 34 H17 A10 10 0 0 1 17 14 Z" {...common} strokeOpacity="0.55" />
        <path d="M31 14 A10 10 0 0 1 31 34" {...common} strokeWidth={3} />
        <path d="M17 34 A10 10 0 0 1 17 14" {...common} strokeWidth={3} />
        <path d="M19 20 H29 A4 4 0 0 1 29 28 H19 A4 4 0 0 1 19 20 Z" {...common} strokeWidth={1.2} strokeOpacity="0.4" />
      </>;
      break;
    case "road_course":
      body = <>
        <path d="M9 31 C8 22 13 15 19 17 C24 19 23 26 28 26 C33 26 33 16 38 15 C42 14 43 22 41 28 C39 34 33 37 25 37 H15 C11 37 9 35 9 31 Z" {...fill} />
        <path d="M9 31 C8 22 13 15 19 17 C24 19 23 26 28 26 C33 26 33 16 38 15 C42 14 43 22 41 28 C39 34 33 37 25 37 H15 C11 37 9 35 9 31 Z" {...common} />
        <path d="M20 34.5 V39.5" {...common} strokeWidth={2.4} />
        <path d="M22 34.5 V39.5" stroke={c} strokeWidth={2.4} strokeDasharray="1.25 1.25" />
      </>;
      break;
    case "intermediate":
      body = <>
        <path d="M17 11 H29 A13 13 0 0 1 29 37 H17 C10 33 8 27 8 24 C8 21 10 15 17 11 Z" {...fill} />
        <path d="M17 11 H29 A13 13 0 0 1 29 37 H17 C10 33 8 27 8 24 C8 21 10 15 17 11 Z" {...common} />
        <path d="M18 14.5 H29 A9.5 9.5 0 0 1 29 33.5 H18" {...common} strokeWidth={1.3} strokeOpacity="0.55" strokeDasharray="2.5 2" />
      </>;
      break;
    case "superspeedway":
      body = <>
        <path d="M8 27 C5 19 11 11 24 11 C37 11 43 19 40 27 L24 37 Z" {...fill} />
        <path d="M8 27 C5 19 11 11 24 11 C37 11 43 19 40 27 L24 37 Z" {...common} />
        <path d="M14 16.5 H34 M13 20 H35 M14 23.5 H34" {...common} strokeWidth={1.3} strokeOpacity="0.7" strokeDasharray="3 2" />
      </>;
      break;
    default:
      body = <>
        <rect x="6" y="14" width="36" height="20" rx="10" {...common} strokeOpacity="0.5" />
      </>;
  }
  return (
    <svg className="td-glyph" width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={title || d?.label || "Track"}>
      {body}
    </svg>
  );
}

/** Coloured discipline + multiplier pill: "INT ×0.5" */
export function DisciplineBadge({ ty }) {
  const d = DISCIPLINE[ty];
  if (!d) return null;
  return <span className="td-badge num" style={{ "--td": d.accent }} title={`${d.label} — laps led × ${multLabel(ty).split("×")[1]}`}>{multLabel(ty)}</span>;
}

/** Subtitle row: Track · [INT ×0.5] · 1.5 MI OVAL • TIRE WEAR */
export function TrackSpecLine({ ty, track, children, className = "" }) {
  const d = DISCIPLINE[ty];
  return (
    <div className={"td-line " + className} style={d ? { "--td": d.accent } : undefined}>
      {track && <span className="td-track">{track}</span>}
      <DisciplineBadge ty={ty} />
      {d && <span className="td-spec num">{trackSpecTag(ty, track)}</span>}
      {children}
    </div>
  );
}

/** Props for a header that wears the discipline aura (8% radial glow + accent var). */
export const auraProps = ty => {
  const d = DISCIPLINE[ty];
  return d ? { "data-td": ty, style: { "--td": d.accent } } : {};
};
