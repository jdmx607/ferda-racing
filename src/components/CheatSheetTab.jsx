import { useMemo, useState } from "react";
import { PNAME } from "../constants";
import { SIGNATURE } from "../theme";
import { paintFor } from "../driverPaint";
import { useScouting } from "../hooks/useScouting";
import { useCheatSheet, useTracksMaster } from "../hooks/useCheatSheet";
import {
  TIERS, SORTS, seasonTracks, currentTrack, ownersFor, buildRows, sortRows, groupByTier, logSummary, sheetSubtitle,
} from "../engine/cheatSheet";
import { TrackGlyph, DisciplineBadge, auraProps } from "./TrackIdentity";
import { DISCIPLINE } from "../trackDiscipline";
import { weekName } from "../exhibitions";

const fmtP = v => (v == null ? "—" : `P${Number(v).toFixed(1)}`);
const fmtN = (v, d = 1) => (v == null ? "—" : Number(v).toFixed(d));
const fmtPct = v => (v == null ? "—" : `${Number(v).toFixed(1)}%`);

/** Who has this driver this week: a manager-coloured dot + name. */
function OwnerTag({ owner, mine }) {
  if (!owner) return null;
  const col = SIGNATURE[owner] || "#949BA8";
  return (
    <span className={"ct-owner" + (mine ? " mine" : "")} style={{ "--oc": col }} title={`Drafted by ${PNAME[owner] || owner}`}>
      <i aria-hidden="true" />{mine ? "On your roster" : `${PNAME[owner] || owner} has him`}
    </span>
  );
}

function Stat({ label, value, active }) {
  return <span className={"ct-stat" + (active ? " on" : "")}><i>{label}</i><b className="num">{value}</b></span>;
}

/** Race-by-race Next Gen log, newest first. */
function TrackLog({ row, sheet }) {
  const sum = logSummary(row.log);
  if (!sum) {
    return <div className="ct-log-empty">No Next Gen starts at {sheet.track} yet — this score comes from how {row.name.split(" ").slice(-1)[0]} runs on other {DISCIPLINE[sheet.discipline]?.label.toLowerCase()} tracks.</div>;
  }
  return (
    <div className="ct-log">
      <div className="ct-log-sum num">
        Avg start <b>P{sum.avgStart.toFixed(1)}</b> → avg finish <b>P{sum.avgFinish.toFixed(1)}</b>
        <span> · {sum.starts} start{sum.starts === 1 ? "" : "s"}{sum.wins ? ` · ${sum.wins} win${sum.wins === 1 ? "" : "s"}` : ""} · {sum.led} laps led</span>
      </div>
      <table className="ct-table num">
        <thead><tr><th>Year</th><th>Race</th><th>Start</th><th>Finish</th><th>Led</th><th>Rtg</th></tr></thead>
        <tbody>
          {row.log.map(r => {
            const out = r.status && r.status !== "running";
            const gain = r.start - r.finish;
            return (
              <tr key={r.season + "-" + r.race} className={r.win ? "win" : ""}>
                <td>{r.season}</td>
                <td className="rn" title={r.name}>{r.name.replace(/^NASCAR Cup Series\s*/i, "").replace(/\s+presented by.*/i, "") || r.name}{out && <em> · {r.status}</em>}</td>
                <td>P{r.start}</td>
                <td className={"fin" + (gain > 0 ? " up" : gain < 0 ? " down" : "")}>{r.win ? "★ " : ""}P{r.finish}</td>
                <td>{r.led || "—"}</td>
                <td>{r.rating != null ? r.rating.toFixed(0) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DriverCard({ row, sheet, sortKey, mineId, simple }) {
  const [open, setOpen] = useState(false);
  const tier = row.tier ? TIERS[row.tier] : null;
  const s = row.stats;
  const id = "ct-log-" + row.key;
  return (
    <li className={"ct-card" + (open ? " open" : "") + (row.owner ? " taken" : "")} style={{ "--paint": paintFor(row.driver), "--tc": tier?.color || "#6B7280" }}>
      <button className="ct-head" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}
              aria-label={`${row.name}, ${tier ? tier.label : "no data"}${row.composite != null ? `, score ${Math.round(row.composite)}` : ""}. ${open ? "Hide" : "Show"} track log`}>
        <span className="ct-num num">{row.num || "—"}</span>
        <span className="ct-mid">
          <span className="ct-name">{row.name}</span>
          <span className="ct-sub">{[row.team, row.make].filter(Boolean).join(" · ") || "—"}</span>
          {!simple && s && (
            <span className="ct-stats">
              <Stat label="Avg Fin" value={fmtP(s.avgFinish)} active={sortKey === "avgFinish"} />
              <Stat label="Rating" value={fmtN(s.rating)} active={sortKey === "rating"} />
              <Stat label="Led" value={fmtPct(s.ledPct)} active={sortKey === "ledPct"} />
              <Stat label="Disc Avg" value={fmtP(s.disciplineAvg)} active={sortKey === "disciplineAvg"} />
              <Stat label="Starts" value={s.starts} />
            </span>
          )}
          {simple && s && (
            <span className="ct-simple-line num">{s.starts ? `Averages P${fmtN(s.avgFinish)} here (${s.starts} races)` : "Never raced here in this car"}</span>
          )}
          {(row.tags.length > 0 || row.placeDiffTarget || row.start != null) && (
            <span className="ct-tags">
              {row.start != null && <span className="ct-tag start num">Starts P{row.start}</span>}
              {row.placeDiffTarget && <span className="ct-tag target">Place-Diff Target</span>}
              {row.tags.map(t => <span key={t} className="ct-tag">{t}</span>)}
            </span>
          )}
          <OwnerTag owner={row.owner} mine={row.owner && row.owner === mineId} />
        </span>
        <span className="ct-score" aria-hidden="true">
          {simple
            ? <b className="ct-plain">{tier ? tier.plain : "No Data"}</b>
            : <><b className="num">{row.composite != null ? Math.round(row.composite) : "—"}</b><i>{tier ? tier.short : "NEW"}</i></>}
          <span className="ct-chev">{open ? "▾" : "▸"}</span>
        </span>
      </button>
      {open && <div id={id} className="ct-drawer"><TrackLog row={row} sheet={sheet} /></div>}
    </li>
  );
}

export function CheatSheetTab({ data, currentWeek, player, simple = false, onBack }) {
  const tracks = useMemo(() => seasonTracks(), []);
  const now = useMemo(() => currentTrack(currentWeek), [currentWeek]);
  const [picked, setPicked] = useState(null);
  const slug = picked || now?.slug || tracks[0]?.slug;
  const isNow = slug === now?.slug;

  const master = useTracksMaster().data;
  const { data: sheet, loading, error } = useCheatSheet(slug);
  const sc = useScouting(data || {}, currentWeek, { enabled: isNow });

  const [tierFilter, setTierFilter] = useState(0);        // 0 = all
  const [sortKey, setSortKey] = useState("composite");
  const [flat, setFlat] = useState(false);
  const [hideTaken, setHideTaken] = useState(false);

  const owners = useMemo(() => (isNow ? ownersFor(data, currentWeek) : {}), [data, currentWeek, isNow]);
  const rows = useMemo(
    () => buildRows(sheet, { owners, grid: isNow ? sc.grid || {} : {} }),
    [sheet, owners, isNow, sc.grid]
  );
  const counts = useMemo(() => {
    const c = { 0: rows.length };
    rows.forEach(r => { if (r.tier) c[r.tier] = (c[r.tier] || 0) + 1; });
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    let list = rows;
    if (tierFilter) list = list.filter(r => r.tier === tierFilter);
    if (hideTaken) list = list.filter(r => !r.owner);
    return sortRows(list, sortKey);
  }, [rows, tierFilter, hideTaken, sortKey]);
  const groups = useMemo(() => groupByTier(visible), [visible]);

  const ty = sheet?.discipline || tracks.find(t => t.slug === slug)?.ty;
  const accent = DISCIPLINE[ty]?.accent;
  const trackName = sheet?.track || tracks.find(t => t.slug === slug)?.track || "";
  const mineId = player?.id;
  const takenCount = rows.filter(r => r.owner).length;

  return (
    <div className={"ct" + (simple ? " ct-simple" : "")} style={accent ? { "--td": accent } : undefined}>
      {onBack && <button className="ct-back" onClick={onBack}>← Back to Make Picks</button>}

      {/* ── header card ── */}
      <header className="ct-hero" {...auraProps(ty)}>
        <div className="ct-hero-top">
          <div className="td-slot ct-glyph"><TrackGlyph ty={ty} /></div>
          <div className="ct-hero-mid">
            <div className="ct-kicker">{isNow && now ? `${weekName(now.week)} · ${now.race}` : "Ferda Tips"}</div>
            <h1 className="ct-title">{trackName || "Ferda Tips"}</h1>
            <div className="ct-badges">
              {ty && <DisciplineBadge ty={ty} />}
              {ty && <span className="ct-disc">{DISCIPLINE[ty].label}</span>}
            </div>
          </div>
        </div>
        {sheet && <div className="ct-spec num">{sheetSubtitle(sheet)}</div>}

        {sheet?.topPerformers?.length > 0 && (
          <div className="ct-top">
            <div className="ct-top-h">Best Next Gen record here</div>
            <ol>
              {sheet.topPerformers.map((p, i) => (
                <li key={p.key}>
                  <b className="num">{i + 1}</b>
                  <span className="n">{p.name}</span>
                  <span className="m num">P{p.avgFinish.toFixed(1)} avg{p.wins ? ` · ${p.wins}W` : ""}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="ct-pick-row">
          <label className="ct-sel">
            <span>Track</span>
            <select value={slug} onChange={e => setPicked(e.target.value === now?.slug ? null : e.target.value)} aria-label="Choose a track">
              {tracks.map(t => <option key={t.slug} value={t.slug}>{t.track}{t.slug === now?.slug ? "  (this week)" : ""}</option>)}
            </select>
          </label>
          {!isNow && now && <button className="ct-reset" onClick={() => setPicked(null)}>This week's track</button>}
        </div>
      </header>

      {loading && <div className="ct-note" role="status">Loading Ferda Tips…</div>}
      {error && <div className="ct-note err" role="alert">Ferda Tips for this track aren't available right now. Check your connection and try again.</div>}

      {sheet && (
        <>
          {/* ── controls ── */}
          <div className="ct-controls">
            <div className="ct-chips" role="group" aria-label="Filter by tier">
              <button aria-pressed={tierFilter === 0} onClick={() => setTierFilter(0)}>All <span className="num">{counts[0] || 0}</span></button>
              {[1, 2, 3, 4].map(t => (
                <button key={t} aria-pressed={tierFilter === t} style={{ "--tc": TIERS[t].color }} onClick={() => setTierFilter(tierFilter === t ? 0 : t)}>
                  {simple ? TIERS[t].plain : TIERS[t].short} <span className="num">{counts[t] || 0}</span>
                </button>
              ))}
            </div>
            {!simple && (
              <div className="ct-row2">
                <label className="ct-sel inline">
                  <span>Sort</span>
                  <select value={sortKey} onChange={e => setSortKey(e.target.value)} aria-label="Sort drivers by">
                    {SORTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </label>
                <div className="seg ct-seg" role="group" aria-label="Layout">
                  <button aria-pressed={!flat} onClick={() => setFlat(false)}>By Tier</button>
                  <button aria-pressed={flat} onClick={() => setFlat(true)}>Flat</button>
                </div>
              </div>
            )}
            {isNow && takenCount > 0 && (
              <label className="ct-check">
                <input type="checkbox" checked={hideTaken} onChange={e => setHideTaken(e.target.checked)} />
                <span>Hide drivers already drafted this week ({takenCount})</span>
              </label>
            )}
          </div>

          {/* ── driver cards ── */}
          {visible.length === 0 && <div className="ct-note">No drivers match these filters.</div>}
          {(flat && !simple) ? (
            <ul className="ct-list">
              {visible.map(r => <DriverCard key={r.key} row={r} sheet={sheet} sortKey={sortKey} mineId={mineId} simple={simple} />)}
            </ul>
          ) : groups.filter(g => g.rows.length).map(g => {
            const t = g.tier ? TIERS[g.tier] : null;
            return (
              <section key={g.tier ?? "none"} className="ct-group" style={{ "--tc": t?.color || "#6B7280" }}>
                <h2 className="ct-group-h">
                  <i aria-hidden="true" />
                  <span>{t ? (simple ? t.plain : `Tier ${g.tier} · ${t.label}`) : "No Next Gen data yet"}</span>
                  <em className="num">{g.rows.length}</em>
                </h2>
                <ul className="ct-list">
                  {g.rows.map(r => <DriverCard key={r.key} row={r} sheet={sheet} sortKey={sortKey} mineId={mineId} simple={simple} />)}
                </ul>
              </section>
            );
          })}

          {/* ── how it works ── */}
          <details className="ct-how">
            <summary>How the score works</summary>
            <p>
              Each driver's <b>composite (0–100)</b> compares them with the full-time field using Next Gen results only
              ({master?.nextGenSince || 2022}+): <b>30%</b> average finish, <b>35%</b> driver rating, <b>20%</b> laps-led potential and
              <b> 15%</b> how they run on every {DISCIPLINE[ty]?.label.toLowerCase() || "similar"} track. This and last season count fully,
              two seasons ago 75%, older 50%. Drivers with few starts here lean on their record at similar tracks.
            </p>
            <p>
              <b>Tiers:</b> Elite / Dominator (85+), Top-10 Contender (65+), Place-Diff / Value (40+), Fade / High Risk (below). A big
              gain-spots average lifts a low score to Value; wrecking in 40%+ of starts drops a driver a tier.
              <b> Place-Diff Target</b> = starts 20th or worse with Tier 1–2 speed.
            </p>
            {master?.dataThrough && (
              <p className="ct-asof num">
                Data through {master.dataThrough.season} race {master.dataThrough.race} ({master.dataThrough.track}) · refreshed {master.generatedAt}
                {" · "}source: {master.source}
              </p>
            )}
          </details>
        </>
      )}
    </div>
  );
}
