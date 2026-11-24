import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PClr, TTC, TTL } from "../theme";
import { PNAME, ACTIVE_SEASON, DRIVER_INFO } from "../constants";
import { nameKey } from "../driverKey";
import { paintFor, carNumber } from "../driverPaint";
import { DISCIPLINE, multLabel } from "../trackDiscipline";
import { ARCHETYPE } from "../engine/scouting";
import { splitDriver } from "../engine/draftBoard";
import { getDriverProfile } from "../engine/statsView";
import {
  weekContext, ownership, startFor, leagueRacesAt, trackHistory, disciplineProfile, recentForm, pickCta, signed,
} from "../engine/telemetryCard";
import { useScouting } from "../hooks/useScouting";
import { useCheatSheet } from "../hooks/useCheatSheet";
import { useArchivedSeasons } from "../hooks/useDriverCard";
import { haptic } from "../utils/haptics";
import { MakeTeam, ScoutTags } from "./DriverTelemetry";

const accentOf = pid => PClr[pid]?.accent || "var(--text-2)";
const f1 = v => (Math.round((v || 0) * 10) / 10).toFixed(1);
const SLIDE_MS = 300;

/** Keep the last driver mounted while the sheet slides away. */
function useSlide(value) {
  const [held, setHeld] = useState(value);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (value) { setHeld(value); setVisible(true); return undefined; }   // the sheet is always mounted closed, so this transitions in
    setVisible(false);
    const t = setTimeout(() => setHeld(null), SLIDE_MS);
    return () => clearTimeout(t);
  }, [value]);
  return { held, visible };
}

// ── Module A · identity + weekend status ─────────────────────────────────────
function Ownership({ own }) {
  if (own.status === "drafted") {
    return (
      <div className="dtc-own" data-status="drafted">
        <span className="k">DRAFTED BY</span>
        {own.owners.map(pid => (
          <span key={pid} className="who"><i style={{ background: accentOf(pid) }} />{PNAME[pid].toUpperCase()}</span>
        ))}
      </div>
    );
  }
  const text = { available: "AVAILABLE", undrafted: "UNDRAFTED", memorial: "🕊️ IN MEMORIAM" }[own.status];
  return <div className="dtc-own" data-status={own.status}><span className="k">{text}</span></div>;
}

function Stat({ label, value, sub, tone }) {
  return (
    <div className="dtc-stat" data-tone={tone}>
      <span className="v num">{value}</span>
      <span className="l">{label}</span>
      {sub && <span className="s">{sub}</span>}
    </div>
  );
}

// ── The card's content (mounted only while a driver is open) ─────────────────
function CardBody({ data, name, week, player, mode, draft, captain, rear, onClose, bodyRef }) {
  const ctx = useMemo(() => weekContext(data, week), [data, week]);
  const { race } = ctx;
  const disc = DISCIPLINE[race.ty];
  const accent = disc?.accent || "var(--text-2)";
  const { num, name: nm } = splitDriver(name);
  const key = nameKey(name);

  const sc = useScouting(data, ctx.week, { enabled: !ctx.scored });
  const own = ownership(data, ctx.week, name);
  const start = startFor(data, ctx.week, name, sc.grid);
  const tags = ctx.scored ? [] : sc.tagsFor(name);

  // Module B: Next Gen history at this track + the league's own scored races (active + archived seasons)
  const sheet = useCheatSheet(race.slug);
  const archives = useArchivedSeasons();
  const history = useMemo(() => {
    const sheetLog = sheet.data?.drivers?.find(d => d.key === key)?.log || [];
    const league = leagueRacesAt({ [ACTIVE_SEASON]: data, ...archives }, race.slug, name);
    return trackHistory({ sheetLog, league, ty: race.ty });
  }, [sheet.data, archives, data, race.slug, race.ty, name, key]);

  const discipline = useMemo(() => disciplineProfile(data, name, race.ty), [data, name, race.ty]);
  const profile = useMemo(() => getDriverProfile(data, name), [data, name]);
  const form = useMemo(() => recentForm(profile.log, 5), [profile]);

  const [logOpen, setLogOpen] = useState(false);
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const logRef = useRef(null);

  const cta = pickCta({
    mode, status: own.status, owners: own.owners, me: player?.id, num, name: nm,
    draft, captain, logOpen,
  });

  const run = async () => {
    if (busy) return;
    if (cta.id === "draft") {
      setBusy(true);
      try { if ((await draft.onDraft(name)) !== false) onClose(); } finally { setBusy(false); }
    } else if (cta.id === "queue" || cta.id === "unqueue") {
      draft.onQueue(name); haptic(10);
    } else if (cta.id === "captain" || cta.id === "uncaptain") {
      captain.onToggle(name); haptic(10);
    } else {
      setLogOpen(o => !o);
    }
  };

  useEffect(() => {
    if (logOpen) logRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [logOpen]);

  const estimated = history?.estimated;
  const dTy = ARCHETYPE[race.ty] || "";

  return (
    <>
      <div className="dtc-body" ref={bodyRef}>
        {/* ── Module A — identity + weekend status ─────────────────────────── */}
        <header className="dtc-id" style={{ "--paint": paintFor(name) }}>
          <div className="dtc-badge" aria-hidden="true"><span className="hash">#</span><span className="n num">{num || carNumber(name) || "—"}</span></div>
          <div className="dtc-id-mid">
            <h2 className="dtc-name">{nm}</h2>
            <div className="dtc-sub"><MakeTeam driver={name} />{!DRIVER_INFO[name]?.team && !DRIVER_INFO[name]?.make && "—"}</div>
            <Ownership own={own} />
          </div>
        </header>

        <div className="dtc-pills" aria-label="Weekend status">
          {start != null
            ? <span className="dtc-pill num">Start P{start}</span>
            : !ctx.scored && <span className="dtc-pill dim num">Start TBD</span>}
          <ScoutTags tags={tags} />
          {captain?.isCaptain && <span className="dtc-pill gold num">CAPTAIN 1.25×</span>}
        </div>

        {rear?.can && (
          <button className={"sc-rear-btn" + (rear.on ? " on" : "")} onClick={rear.onToggle} aria-pressed={!!rear.on}>
            <span className="t">{rear.on ? "✓ Sent to the rear this week" : "Send to the rear this week"}</span>
            <span className="h">Commissioner · failed inspection / backup car</span>
          </button>
        )}

        {/* ── Module B — this track's history ──────────────────────────────── */}
        <section className="dtc-mod" style={{ "--ac": accent }} aria-label={`${race.track} history`}>
          <h3 className="dtc-h"><i aria-hidden="true" />{race.track} History</h3>
          <div className="dtc-stats3">
            <Stat label="AVG FINISH" value={history ? `P${f1(history.avgFinish)}` : sheet.loading ? "…" : "—"} />
            <Stat label="BEST FINISH" value={history ? `P${history.bestFinish}` : sheet.loading ? "…" : "—"} />
            <Stat label="AVG FRL PTS" value={history ? `${estimated ? "~" : ""}${f1(history.avgPts)}` : sheet.loading ? "…" : "—"} />
          </div>
          {history ? (
            <>
              <ul className="dtc-last3 num" aria-label="Last results here">
                {history.last3.map(r => (
                  <li key={r.year}>{r.year}: {r.dnf ? "DNF" : `P${r.finish}`} <span>({r.exact ? "" : "~"}{f1(r.pts)} pts)</span></li>
                ))}
              </ul>
              <div className="dtc-foot">
                {history.starts} start{history.starts === 1 ? "" : "s"} here
                {history.wins > 0 && ` · ${history.wins} win${history.wins === 1 ? "" : "s"}`}
                {estimated && " · ~ estimated (stage points aren't in the public data)"}
              </div>
            </>
          ) : (
            <div className="dtc-empty">{sheet.loading ? "Loading track history…" : "No Cup starts at this track yet."}</div>
          )}
          {sheet.error && !history && <div className="dtc-empty">Track history needs a connection the first time.</div>}
        </section>

        {/* ── Module C — discipline performance (season to date) ───────────── */}
        <section className="dtc-mod tint" style={{ "--ac": accent }} aria-label={`${dTy} performance`}>
          <h3 className="dtc-h"><i aria-hidden="true" />{disc?.label || dTy} Form <span className="ty num">{multLabel(race.ty)}</span></h3>
          {discipline.races > 0 ? (
            <div className="dtc-stats4">
              <Stat label="DISCIPLINE AVG FRL PTS" value={f1(discipline.avgPts)} />
              <Stat label="TOP-10 RATE" value={`${discipline.top10Rate}%`} />
              <Stat label="TOTAL LAPS LED" value={discipline.lapsLed.toLocaleString()} />
              <Stat
                label="DISCIPLINE RANK"
                value={discipline.rank ? `#${discipline.rank}` : "—"}
                sub={discipline.rank ? `in ${dTy} Scoring` : "needs 2 starts to rank"}
                tone={discipline.rank === 1 ? "gold" : undefined}
              />
            </div>
          ) : (
            <div className="dtc-empty">
              {discipline.racesHeld ? `Hasn't run a ${dTy.toLowerCase()} race this season.` : `No ${dTy.toLowerCase()} races scored yet this season.`}
            </div>
          )}
        </section>

        {/* ── Module D — recent form ───────────────────────────────────────── */}
        <section className="dtc-mod" aria-label="Recent form">
          <h3 className="dtc-h plain">Recent Form <small>last 5 · newest first</small></h3>
          {form.length ? (
            <>
              <div className="dtc-form">
                {form.map((p, i) => (
                  <button
                    key={p.week} className="dtc-fin num" data-tone={p.tone} title={p.detail}
                    aria-pressed={picked === i} aria-label={p.detail}
                    onClick={() => setPicked(picked === i ? null : i)}
                  >{p.label}</button>
                ))}
              </div>
              <div className="dtc-form-detail num" aria-live="polite">{picked != null ? form[picked].detail : "Tap a result for the details"}</div>
            </>
          ) : <div className="dtc-empty">No scored races this season yet.</div>}
        </section>

        {/* ── Season race log (inline, scrollable) ─────────────────────────── */}
        {cta.id !== "log" && profile.log.length > 0 && (
          <button className="dtc-link" onClick={() => setLogOpen(o => !o)} aria-expanded={logOpen}>
            Season race log · {profile.log.length} race{profile.log.length === 1 ? "" : "s"} {logOpen ? "▲" : "▼"}
          </button>
        )}
        {logOpen && (
          <div className="dtc-log" ref={logRef}>
            <div className="dtc-log-sum num">
              <span><b>{f1(profile.total)}</b> total</span><span><b>{f1(profile.avg)}</b> avg</span>
              <span><b>{f1(profile.best)}</b> best</span><span><b>{profile.races}</b> races</span>
            </div>
            {profile.drafters.length > 0 && (
              <div className="dtc-drafters">
                {profile.drafters.slice(0, 3).map(d => (
                  <span key={d.pid} className="num"><i style={{ background: accentOf(d.pid) }} />{PNAME[d.pid]} {d.count}× ({d.share}%)</span>
                ))}
              </div>
            )}
            {profile.log.length === 0 ? <div className="dtc-empty">No scored races yet.</div> : (
              <div className="dtc-logscroll" tabIndex={0} aria-label="Season race log">
                <div className="st-log">
                  {profile.log.map(r => (
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
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Sticky, context-aware call to action ─────────────────────────────── */}
      <footer className="dtc-cta">
        <button className="dtc-btn" data-kind={cta.id} onClick={run} disabled={busy} aria-expanded={cta.id === "log" ? logOpen : undefined}>
          {cta.label}
        </button>
      </footer>
    </>
  );
}

/**
 * The reusable Driver Telemetry Card: a frosted bottom sheet that slides over any screen.
 *   name      "#12 Ryan Blaney" (falsy = closed)        week     race week the card talks about
 *   mode      "draft" | "lineup" | "live" | "results" | "stats" | "drivers"  (picks the bottom button)
 *   draft     { myTurn, queued, onDraft(driver) → Promise<false|…>, onQueue(driver) }   Draft Room only
 *   captain   { isCaptain, onToggle(driver) }   pass once the captain rule exists
 *   rear      { can, on, onToggle }             commissioner "send to the rear"
 * Dismiss: backdrop tap, swipe down, ✕, or Escape. The page underneath never scrolls or resets.
 */
export function DriverTelemetryCard({ data, name, week, player, mode = "stats", draft, captain, rear, onClose }) {
  const { held, visible } = useSlide(name);
  const sheetRef = useRef(null);
  const bodyRef = useRef(null);
  const closeRef = useRef(null);
  const opener = useRef(null);

  // Escape closes; focus moves into the card and returns to the tapped row afterwards.
  useEffect(() => {
    if (!name) return undefined;
    opener.current = document.activeElement;
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      const el = opener.current;
      if (el && document.contains(el)) el.focus?.({ preventScroll: true });
    };
  }, [name, onClose]);

  // Once the sheet is actually visible (a hidden element can't take focus), move focus to ✕.
  useEffect(() => { if (visible) closeRef.current?.focus?.({ preventScroll: true }); }, [visible]);

  // Swipe down to dismiss — from the handle/header, or from the content when it is scrolled to the top.
  useEffect(() => {
    const el = sheetRef.current;
    if (!el || !held) return undefined;
    let y0 = null, dy = 0, t0 = 0, drag = false;
    const reset = () => { el.style.transition = ""; el.style.transform = ""; };
    const start = e => { if (e.touches.length === 1) { y0 = e.touches[0].clientY; t0 = Date.now(); dy = 0; drag = false; } };
    const move = e => {
      if (y0 == null) return;
      dy = e.touches[0].clientY - y0;
      if (!drag) {
        const inBody = bodyRef.current?.contains(e.target);
        if (dy > 2 && (!inBody || bodyRef.current.scrollTop <= 0)) { drag = true; el.style.transition = "none"; }
        else return;
      }
      if (e.cancelable) e.preventDefault();
      el.style.transform = `translateY(${Math.max(0, dy)}px)`;
    };
    const end = () => {
      if (y0 == null) return;
      const flick = dy / Math.max(1, Date.now() - t0);
      const dismiss = drag && (dy > 110 || (dy > 40 && flick > 0.6));
      y0 = null;
      if (!drag) return;
      drag = false;
      if (dismiss) { el.style.transition = ""; onClose(); setTimeout(reset, SLIDE_MS + 20); } else reset();
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start); el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end); el.removeEventListener("touchcancel", end);
    };
  }, [held, onClose]);

  const label = held ? `${splitDriver(held).name} telemetry` : "Driver telemetry";
  return createPortal(
    <>
      <div className={"dtc-scrim" + (visible ? " open" : "")} onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef} className={"dtc" + (visible ? " open" : "")} role="dialog" aria-modal="true"
        aria-label={label} aria-hidden={!visible}
      >
        <div className="dtc-top">
          <span className="dtc-grab" aria-hidden="true" />
          <button ref={closeRef} className="dtc-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {held && (
          <CardBody
            key={held} data={data} name={held} week={week} player={player} mode={mode}
            draft={draft} captain={captain} rear={rear} onClose={onClose} bodyRef={bodyRef}
          />
        )}
      </div>
    </>,
    document.body
  );
}
