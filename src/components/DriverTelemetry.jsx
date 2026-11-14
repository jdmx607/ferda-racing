import { useMemo } from "react";
import { PClr, TTC, TTL } from "../theme";
import { PNAME, DRIVER_INFO, MAKE_COLORS } from "../constants";
import { TRACK_TYPES, getDriverProfile } from "../engine/statsView";
import { ARCHETYPE } from "../engine/scouting";
import { splitDriver } from "../engine/draftBoard";
import { paintFor } from "../driverPaint";
import { BottomSheet } from "./BottomSheet";

const accentOf = pid => PClr[pid]?.accent || "var(--text-2)";
const f1 = v => (Math.round((v || 0) * 10) / 10).toFixed(1);
const signed = v => (v > 0 ? "+" : "") + (Math.round(v * 10) / 10);

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

function Sec({ title, note }) {
  return (
    <div className="st-sec">
      <span className="label">{title}</span>
      {note && <span className="st-sec-note">{note}</span>}
    </div>
  );
}

/**
 * Driver telemetry: totals, scouting tags, track-package form, track-type splits,
 * top drafters and the full season race log.
 *   scout (optional) = { ty, form: {races, avgFinish, finishes}|null, tags, toRear,
 *                        canToggleRear, onToggleRear }
 */
export function DriverTelemetry({ data, name, scout }) {
  const p = useMemo(() => (name ? getDriverProfile(data, name) : null), [data, name]);
  if (!p) return null;
  const form = scout?.form;
  return (
    <div className="st-sheet">
      <div className="st-sheet-top">
        <NumBadge driver={name} />
        <div className="mid">
          <div className="nm">{splitDriver(name).name}</div>
          <div className="sub"><MakeTeam driver={name} /></div>
        </div>
      </div>

      {scout?.tags?.length > 0 && <div className="sc-sheet-tags"><ScoutTags tags={scout.tags} /></div>}

      <div className="st-kpis">
        <div><span className="num">{f1(p.total)}</span><small>Total</small></div>
        <div><span className="num">{f1(p.avg)}</span><small>Avg</small></div>
        <div><span className="num">{f1(p.best)}</span><small>Best</small></div>
        <div><span className="num">{p.races}</span><small>Races</small></div>
      </div>

      {scout?.ty && (
        <>
          <Sec title={`Track form · ${ARCHETYPE[scout.ty]}`} note="last 5 races there" />
          <div className="sc-form">
            <div className="avg"><span className="num">{form ? `P${f1(form.avgFinish)}` : "—"}</span><small>avg finish</small></div>
            <div className="fins">
              {form ? form.finishes.map((f, i) => (
                <span key={i} className={"num" + (f <= 5 ? " t5" : f <= 10 ? " t10" : "")}>P{f}</span>
              )) : <span className="none">No {ARCHETYPE[scout.ty].toLowerCase()} starts yet</span>}
            </div>
          </div>
        </>
      )}

      {scout?.canToggleRear && (
        <button className={"sc-rear-btn" + (scout.toRear ? " on" : "")} onClick={scout.onToggleRear} aria-pressed={!!scout.toRear}>
          <span className="t">{scout.toRear ? "✓ Sent to the rear this week" : "Send to the rear this week"}</span>
          <span className="h">Commissioner · failed inspection / backup car</span>
        </button>
      )}

      <Sec title="Track-type splits" note="avg FERDA pts" />
      <div className="st-splits">
        {TRACK_TYPES.map(ty => (
          <div key={ty} className={"st-split" + (scout?.ty === ty ? " cur" : "")}>
            <span className="ty num" style={{ color: TTC[ty] }}>{TTL[ty]}</span>
            <span className="v num">{p.splits[ty].avg == null ? "—" : f1(p.splits[ty].avg)}</span>
            <span className="r num">{p.splits[ty].races} race{p.splits[ty].races === 1 ? "" : "s"}</span>
          </div>
        ))}
      </div>

      <Sec title="Drafted most by" />
      {p.drafters.length === 0 ? (
        <div className="st-note" style={{ marginBottom: 14 }}>Never drafted this season.</div>
      ) : (
        <div className="st-drafters">
          {p.drafters.map((d, i) => (
            <div key={d.pid} className={"st-drafter" + (i === 0 ? " top" : "")} style={{ "--c": accentOf(d.pid) }}>
              <span className="dot" />
              <span className="nm">{PNAME[d.pid]}</span>
              <span className="num">{d.count}×</span>
              <span className="num sh">{d.share}%</span>
            </div>
          ))}
        </div>
      )}

      <Sec title="Season race log" note={`${p.log.length} races`} />
      {p.log.length === 0 ? <div className="st-note">No scored races yet.</div> : (
        <div className="st-log">
          {p.log.map(r => (
            <div key={r.week} className="st-log-row">
              <span className="w num">W{r.week}</span>
              <span className="ty num" style={{ color: TTC[r.ty] }}>{TTL[r.ty]}</span>
              <span className="rc">{r.track}</span>
              <span className="fin num">{r.dnf ? <em>DNF</em> : `P${r.finish}`}</span>
              <span className="by">{r.pickedBy.map(pid => <i key={pid} style={{ background: accentOf(pid) }} title={PNAME[pid]} />)}</span>
              <span className="pt num">{signed(r.pts)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Half-screen drawer wrapper. */
export function DriverDrawer({ data, name, onClose, scout }) {
  return (
    <BottomSheet open={!!name} onClose={onClose} title="Driver telemetry">
      {name && <DriverTelemetry data={data} name={name} scout={scout} />}
    </BottomSheet>
  );
}
