import { useState, useEffect, useRef } from "react";
import { PClr } from "../theme";
import { PNAME } from "../constants";
import { paintFor } from "../driverPaint";
import { lastNameOf } from "../engine/draftBoard";
import { fmtLapTime, fmtPts, getFastestLap } from "../engine/liveBoard";

export const accentOf = pid => PClr[pid]?.accent || "var(--text-2)";

const lapFmt = secs => {
  if (!secs || secs <= 0) return "—";
  return secs >= 60 ? `${Math.floor(secs / 60)}:${(secs % 60).toFixed(3).padStart(6, "0")}` : secs.toFixed(3);
};

// ── Lap / stage / fastest-lap status row ─────────────────────────────────────
export function StatusRow({ timing, stage, rows, liveStatus }) {
  const fl = getFastestLap(timing?.vehicles);
  const flRow = fl && rows.find(r => r.num === fl.carNumber);
  const owner = flRow?.owners[0];
  const tint = owner ? accentOf(owner) : null;
  const hasLaps = timing?.lapsInRace > 0;

  return (
    <div className="lv-status">
      <div className="lv-lap">
        {hasLaps ? (
          <>
            <span className="label">Lap</span>
            <b className="num">{timing.lapNumber}</b>
            <small className="num">/ {timing.lapsInRace}</small>
          </>
        ) : (
          <span className="label">{liveStatus || "Live"}</span>
        )}
      </div>
      {stage && <div className="lv-stage num">{stage.label}</div>}
      {fl && (
        <div className="lv-fl num" style={tint ? { "--c": tint } : undefined} title={owner ? `Drafted by ${PNAME[owner]}` : "Fastest lap — undrafted"}>
          <span aria-hidden="true">⚡</span> #{fl.carNumber} {lastNameOf(fl.driver)} <i>•</i> {fmtLapTime(fl.time)}
        </div>
      )}
    </div>
  );
}

// ── Live 4-player standings ──────────────────────────────────────────────────
export function StandingsCard({ standings, rows, me }) {
  const [open, setOpen] = useState(null);
  return (
    <div className="card lv-stand" role="list" aria-label="Live league standings">
      {standings.map((s, i) => {
        const isOpen = open === s.id;
        const mine = rows.filter(r => r.owners.includes(s.id)).sort((a, b) => (b.pts ?? -999) - (a.pts ?? -999));
        const list = mine.length ? mine : s.drivers.map(d => ({ key: d.driver, num: (String(d.driver).match(/^#(\S+)/) || [])[1] || "", driver: String(d.driver).replace(/^#\S+\s*/, ""), pts: d.total, pos: null, dnr: d.dnr, name: d.driver }));
        return (
          <div key={s.id} role="listitem" className={"lv-st" + (isOpen ? " open" : "")} style={{ "--c": accentOf(s.id) }}>
            <button className="lv-st-row" onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen}>
              <span className="rk num">{i + 1}</span>
              <span className="dot" />
              <span className="nm">{s.name}{s.id === me && <em>YOU</em>}</span>
              <span className="back num">{i === 0 ? "LEAD" : `-${s.back.toFixed(1)}`}</span>
              <span className="pts num" style={{ color: s.pts > 0 ? "var(--go)" : s.pts < 0 ? "var(--stop)" : "var(--text)" }}>{fmtPts(s.pts)}</span>
              <span className="chev" aria-hidden="true">{isOpen ? "▲" : "▼"}</span>
              <span className="bar" style={{ width: `${s.pct}%` }} />
            </button>
            {isOpen && (
              <div className="lv-st-drivers">
                {list.length === 0 && <div className="lv-empty">No picks found</div>}
                {list.map(d => (
                  <div key={d.key} className={"lv-mini" + (d.dnr ? " out" : "")} style={{ "--paint": paintFor(d.name) }}>
                    <span className="n num">{d.num || "—"}</span>
                    <span className="nm">{lastNameOf(d.driver)}</span>
                    <span className="ps num">{d.dnr ? "DNR" : d.pos ? `P${d.pos}` : "—"}</span>
                    <span className="pt num">{d.pts == null ? "—" : fmtPts(d.pts)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Driver filter toggle ─────────────────────────────────────────────────────
export function FilterToggle({ filters, value, onChange, counts }) {
  return (
    <div className="seg lv-seg" role="group" aria-label="Driver filter">
      {filters.map(f => (
        <button key={f.id} aria-pressed={value === f.id} onClick={() => onChange(f.id)}>
          {f.label}{counts?.[f.id] != null && <span className="num"> {counts[f.id]}</span>}
        </button>
      ))}
    </div>
  );
}

// ── One driver telemetry row ─────────────────────────────────────────────────
export function DriverRow({ row }) {
  const [open, setOpen] = useState(false);

  // brief green pulse when this driver's score goes up (gains spots, leads a lap,
  // stage points…) or he moves forward in running order
  const prev = useRef({ pts: row.pts, pos: row.pos });
  const [gain, setGain] = useState(0);
  useEffect(() => {
    const p = prev.current;
    const up = (row.pts != null && p.pts != null && row.pts > p.pts) || (row.pos && p.pos && row.pos < p.pos);
    prev.current = { pts: row.pts, pos: row.pos };
    if (!up) return;
    setGain(g => g + 1);
    const t = setTimeout(() => setGain(0), 1500);
    return () => clearTimeout(t);
  }, [row.pts, row.pos]);

  const d = row.posDelta;
  const hasDetail = row.breakdown.length > 0 || row.bestLap > 0 || row.lastLap > 0;
  const ptsColor = row.pts == null ? "var(--text-3)" : row.pts > 0 ? "var(--go)" : row.pts < 0 ? "var(--stop)" : "var(--text-2)";

  return (
    <div
      className={"lv-row" + (gain ? " is-gain" : "") + (row.dnr ? " out" : "") + (open ? " open" : "")}
      style={{ "--paint": paintFor(row.name) }}
      key={gain /* restart the CSS animation on each gain */}
    >
      <div
        className="lv-row-main" role={hasDetail ? "button" : undefined} tabIndex={hasDetail ? 0 : undefined}
        aria-expanded={hasDetail ? open : undefined}
        onClick={() => hasDetail && setOpen(o => !o)}
        onKeyDown={e => { if (hasDetail && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setOpen(o => !o); } }}
      >
        <div className="lv-num num" aria-hidden="true">{row.num}</div>
        <div className="lv-mid">
          <div className="lv-l1">
            <span className="lv-name">{row.driver}</span>
            {row.owners.map(pid => (
              <span key={pid} className="lv-own" style={{ "--c": accentOf(pid) }}>{PNAME[pid].toUpperCase()}</span>
            ))}
            {row.mull && <span className="chip">MULL</span>}
          </div>
          <div className="lv-l2 num">
            {row.dnr ? <span>DID NOT RACE</span> : (
              <>
                <span className="p">{row.pos ? `P${row.pos}` : "—"}</span>
                {d != null && (
                  <span className={d > 0 ? "up" : d < 0 ? "dn" : "eq"}>{d > 0 ? `▲ +${d}` : d < 0 ? `▼ ${d}` : "— 0"}</span>
                )}
                {row.dnf ? <span className="dn">DNF</span>
                  : row.interval ? <span className={row.pit ? "pit" : ""}>{row.interval}</span> : null}
              </>
            )}
          </div>
        </div>
        <div className="lv-pts num" style={{ color: ptsColor }}>{row.pts == null ? "—" : fmtPts(row.pts)}</div>
      </div>

      {open && (
        <div className="lv-detail">
          {row.breakdown.length > 0 && (
            <div className="lv-chips">
              {row.breakdown.map((b, i) => (
                <span key={i} className={`chip num ${b.pts > 0 ? "up" : "down"}`}>{b.label} {b.pts > 0 ? "+" : ""}{b.pts}</span>
              ))}
            </div>
          )}
          <div className="lv-laps num">
            <span><i>Last</i>{lapFmt(row.lastLap)}</span>
            <span><i>Best</i>{lapFmt(row.bestLap)}</span>
            <span><i>MPH</i>{row.lastSpeed > 0 ? row.lastSpeed.toFixed(1) : "—"}</span>
            <span><i>Led</i>{row.lapsLed || "—"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function StageCutoff() {
  return <div className="lv-cutoff" role="separator"><span>STAGE POINTS CUTOFF</span></div>;
}

// ── Race control feed ────────────────────────────────────────────────────────
export function ControlFeed({ events, hasTiming }) {
  const fmtTime = ms => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <div className="card lv-feed">
      <div className="lv-feed-head">
        <span className="label">Race Control</span>
        <span className="num lv-feed-n">{events.length} event{events.length === 1 ? "" : "s"}</span>
      </div>
      <div className="lv-feed-list" role="log" aria-live="polite">
        {events.length === 0 ? (
          <div className="lv-empty">
            {hasTiming
              ? "No events yet — cautions, lead changes, stage breaks and fastest laps log here as they happen."
              : "Waiting for timing data…"}
          </div>
        ) : events.map(e => (
          <div key={e.id} className="lv-ev" data-tone={e.tone}>
            <span className="lap num">{e.lap ? `L${e.lap}` : "—"}</span>
            <span className="tick" aria-hidden="true" />
            <span className="tx">{e.text}</span>
            <span className="at num">{fmtTime(e.at)}</span>
          </div>
        ))}
      </div>
      <div className="lv-feed-foot">Checked every 30 seconds · events between checks are combined</div>
    </div>
  );
}

// ── Collapsed section ────────────────────────────────────────────────────────
export function Disclosure({ title, hint, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="lv-disc">
      <button className="lv-disc-btn" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="t">{title}</span>
        {hint && !open && <span className="h">{hint}</span>}
        <span className="chev" aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="lv-disc-body">{children}</div>}
    </div>
  );
}
