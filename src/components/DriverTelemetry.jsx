import { DRIVER_INFO, MAKE_COLORS } from "../constants";
import { splitDriver } from "../engine/draftBoard";
import { paintFor } from "../driverPaint";

// Small driver bits shared by several screens. The full telemetry sheet is DriverTelemetryCard.

/** Scouting pill (PD UPSIDE / TO THE REAR / PLAYOFF). */
export function ScoutTag({ tag }) {
  return (
    <span className="sc-tag" data-tone={tag.tone} title={tag.hint}>
      {tag.id === "playoff" && <svg width="9" height="10" viewBox="0 0 10 12" aria-hidden="true"><path d="M5 0l5 2v4c0 3-2.2 5.2-5 6C2.2 11.2 0 9 0 6V2z" fill="currentColor" /></svg>}
      {tag.label}
    </span>
  );
}

export function ScoutTags({ tags }) {
  if (!tags?.length) return null;
  return <span className="sc-tags">{tags.map(t => <ScoutTag key={t.id} tag={t} />)}</span>;
}

/** 36×36 number badge with a 3px paint-scheme bar. */
export function NumBadge({ driver }) {
  const { num } = splitDriver(driver);
  return <span className="st-badge num" style={{ "--paint": paintFor(driver) }}>{num || "—"}</span>;
}

export function MakeTeam({ driver }) {
  const info = DRIVER_INFO[driver] || {};
  if (!info.make && !info.team) return null;
  return (
    <span className="st-mt">
      {info.make && <b style={{ color: MAKE_COLORS[info.make] || "var(--text-2)" }}>{info.make}</b>}
      {info.make && info.team && " • "}
      {info.team}
    </span>
  );
}
