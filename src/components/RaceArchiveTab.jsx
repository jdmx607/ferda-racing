import { useEffect, useMemo, useState } from "react";
import { PClr } from "../theme";
import { PNAME, ACTIVE_SEASON } from "../constants";
import { appSeasons } from "../seasons";
import { loadSeasonDoc } from "../firebase";
import { buildTrackIndex, raceDetail, trackSummary } from "../engine/raceArchive";
import { currentTrack } from "../engine/cheatSheet";
import { lastNameOf } from "../engine/draftBoard";
import { DISCIPLINE } from "../trackDiscipline";
import { TrackGlyph, DisciplineBadge, auraProps } from "./TrackIdentity";

const accentOf = pid => PClr[pid]?.accent || "var(--text-2)";
const f1 = n => (n == null ? "—" : (Math.round(n * 10) / 10).toFixed(1));
const short = name => lastNameOf(String(name).replace(/^#\S+\s+/, ""));

function OwnerDots({ owners }) {
  if (!owners.length) return <span className="ra-nobody">nobody had him</span>;
  return (
    <span className="ra-owners">
      {owners.map(p => <span key={p} style={{ "--c": accentOf(p) }}><i />{PNAME[p]}</span>)}
    </span>
  );
}

function DriverChip({ d }) {
  const moved = d.start != null && d.finish != null ? d.start - d.finish : null;
  return (
    <div className={"ra-dr" + (d.dnr ? " out" : "")}>
      <span className="ra-dr-num num">{d.num || "—"}</span>
      <span className="ra-dr-mid">
        <span className="ra-dr-name">{short(d.driver)}</span>
        <span className="ra-dr-meta num">
          {d.dnr ? "Did not race"
            : d.finish != null ? <>P{d.start ?? "—"} → <b className={moved > 0 ? "up" : moved < 0 ? "down" : ""}>P{d.finish}</b>{d.lapsLed ? ` · ${d.lapsLed} led` : ""}{d.dnf ? " · out" : ""}</>
            : "—"}
        </span>
        {(d.pick || d.mulligan || d.garage) && (
          <span className="ra-dr-tags">
            {d.pick && <span className="ra-tag num">R{d.pick.round} · #{d.pick.overall}</span>}
            {d.mulligan && <span className="ra-tag mull">MULLIGAN</span>}
            {d.garage && <span className="ra-tag">GARAGE</span>}
          </span>
        )}
      </span>
      <b className="ra-dr-pts num">{d.dnr ? "DNR" : f1(d.total)}</b>
    </div>
  );
}

function RaceCard({ race, doc, open, onToggle, me }) {
  const detail = useMemo(() => (open ? raceDetail(doc, race) : null), [open, doc, race]);
  const top = race.scores[0];
  return (
    <article className={"ra-race" + (open ? " open" : "")}>
      <button className="ra-race-main" onClick={onToggle} aria-expanded={open}>
        <span className="ra-yr num">{race.year}</span>
        <span className="ra-mid">
          <span className="ra-name">{race.race}{race.ex && <em> · exhibition</em>}</span>
          <span className="ra-date num">{race.ex ? "Exhibition" : `Week ${race.w}`} · {race.date}</span>
        </span>
        <span className="ra-win" style={{ "--c": accentOf(top.pid) }}>
          <span className="nm"><i />{PNAME[top.pid]}</span>
          <span className="sc num">{f1(top.total)}{race.margin != null ? ` · +${f1(race.margin)}` : ""}</span>
        </span>
      </button>

      {open && detail && (
        <div className="ra-detail">
          <div className="ra-h">How everyone scored</div>
          {detail.managers.map(m => (
            <div key={m.pid} className={"ra-mgr" + (m.pid === me ? " me" : "")} style={{ "--c": accentOf(m.pid) }}>
              <div className="ra-mgr-hd">
                <span className="rk num">{m.rank}</span><i className="dot" /><b>{PNAME[m.pid]}</b>
                {m.pid === me && <span className="ra-you">YOU</span>}
                <span className="tot num">{f1(m.total)}</span>
              </div>
              <div className="ra-drs">
                {m.drivers.length ? m.drivers.map(d => <DriverChip key={d.driver} d={d} />) : <span className="ra-none">No lineup recorded</span>}
              </div>
            </div>
          ))}

          {detail.results.length > 0 && (
            <>
              <div className="ra-h">How the race finished <span className="num">top {detail.results.length}</span></div>
              <ol className="ra-fin">
                {detail.results.map(r => (
                  <li key={r.num + r.name}>
                    <span className="pos num">P{r.finish}</span>
                    <span className="n"><b className="num">{r.num && `#${r.num}`}</b> {short(r.name)}{r.dnf ? " · out" : ""}</span>
                    <OwnerDots owners={r.owners} />
                    <span className="fp num">{f1(r.fantasy)}</span>
                  </li>
                ))}
              </ol>
              {detail.gotAway && (
                <div className="ra-away">
                  The one that got away: <b>{short(detail.gotAway.name)}</b> finished P{detail.gotAway.finish} for{" "}
                  <b className="num">{f1(detail.gotAway.fantasy)}</b> fantasy points — and nobody drafted him.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </article>
  );
}

/** Track-by-track history of the league: every race at a venue, who drafted whom, and how it paid off. */
export function RaceArchiveTab({ data, currentWeek, player, setTab, simple = false }) {
  const [docs, setDocs] = useState({ [ACTIVE_SEASON]: data });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [slug, setSlug] = useState(null);
  const [open, setOpen] = useState({});

  // Past seasons come from the archive (read-only); the active season is the live doc.
  useEffect(() => {
    let alive = true;
    const past = appSeasons().filter(y => y !== ACTIVE_SEASON);
    setLoading(past.length > 0); setFailed(false);
    Promise.all(past.map(y => loadSeasonDoc(y).then(d => [y, d]))).then(pairs => {
      if (!alive) return;
      const next = { [ACTIVE_SEASON]: data };
      pairs.forEach(([y, d]) => { if (d) next[y] = d; });
      setDocs(next); setLoading(false);
      setFailed(pairs.some(([, d]) => !d));
    });
    return () => { alive = false; };
  }, [data]);

  const index = useMemo(() => buildTrackIndex(docs), [docs]);
  // Open on the track the league is on now if it has history; otherwise the busiest venue.
  const nowSlug = currentTrack(currentWeek)?.slug;
  const cur = slug || nowSlug;

  const selected = index.find(t => t.slug === cur) || index[0] || null;
  const summary = useMemo(() => (selected ? trackSummary(selected.races) : null), [selected]);
  const years = selected ? [...new Set(selected.races.map(r => r.year))] : [];
  const accent = selected ? DISCIPLINE[selected.ty]?.accent : null;
  const me = player?.id;

  return (
    <div className={"ra" + (simple ? " ra-simple" : "")} style={accent ? { "--td": accent } : undefined}>
      <header className="ra-head">
        <h2>Race Archive</h2>
        <span className="ra-sub">Every time we raced here — who picked who, who won</span>
      </header>

      {loading && <div className="ra-note" role="status">Loading past seasons…</div>}
      {!loading && failed && <div className="ra-note err" role="alert">Some past seasons couldn't be loaded — check your connection and reopen this tab.</div>}
      {!loading && index.length === 0 && <div className="ra-note">No races have been scored yet. Once a race is in the books it shows up here.</div>}

      {selected && (
        <>
          <label className="ra-sel">
            <span>Track</span>
            <select value={selected.slug} onChange={e => { setSlug(e.target.value); setOpen({}); }} aria-label="Choose a track">
              {index.map(t => <option key={t.slug} value={t.slug}>{t.track} — {t.races.length} race{t.races.length === 1 ? "" : "s"}</option>)}
            </select>
          </label>

          <section className="ra-hero" {...auraProps(selected.ty)}>
            <div className="ra-hero-top">
              <div className="td-slot"><TrackGlyph ty={selected.ty} /></div>
              <div className="ra-hero-mid">
                <h3>{selected.track}</h3>
                <div className="ra-badges"><DisciplineBadge ty={selected.ty} /><span>{DISCIPLINE[selected.ty]?.label}</span></div>
                <div className="ra-spec num">{selected.races.length} race{selected.races.length === 1 ? "" : "s"} · {years.length} season{years.length === 1 ? "" : "s"} ({years[years.length - 1]}{years.length > 1 ? `–${years[0]}` : ""})</div>
              </div>
            </div>

            {summary && (
              <div className="ra-sum">
                {summary.perManager.filter(m => m.races > 0).sort((a, b) => b.wins - a.wins || (b.avg ?? 0) - (a.avg ?? 0)).map(m => (
                  <div key={m.pid} className={"ra-sum-row" + (m.pid === me ? " me" : "")} style={{ "--c": accentOf(m.pid) }}>
                    <span className="nm"><i />{PNAME[m.pid]}{m.pid === me && <span className="ra-you">YOU</span>}</span>
                    <span className="st num"><b>{m.wins}</b> win{m.wins === 1 ? "" : "s"}</span>
                    <span className="st num"><b>{f1(m.avg)}</b> avg</span>
                    <span className="st num">best <b>{f1(m.best?.total)}</b></span>
                    {m.topPicks.length > 0 && (
                      <span className="picks">Likes: {m.topPicks.map(p => `${short(p.name)}${p.count > 1 ? ` ×${p.count}` : ""}`).join(", ")}</span>
                    )}
                  </div>
                ))}
                {(summary.bestDriver || summary.hotSeat) && (
                  <div className="ra-facts">
                    {summary.bestDriver && <span>Best driver here: <b>{short(summary.bestDriver.name)}</b> <b className="num">{f1(summary.bestDriver.total)}</b> ({summary.bestDriver.year}{summary.bestDriver.pids.length ? ` · ${summary.bestDriver.pids.map(p => PNAME[p]).join(" & ")}` : ""})</span>}
                    {summary.hotSeat && <span>League favourite: <b>{short(summary.hotSeat.name)}</b> (picked {summary.hotSeat.count}×)</span>}
                  </div>
                )}
              </div>
            )}

            {setTab && (
              <button className="ra-link" onClick={() => setTab("cheatsheet")}>Ferda Tips for {selected.track} →</button>
            )}
          </section>

          <div className="ra-races">
            {selected.races.map(rc => (
              <RaceCard key={rc.year + "-" + rc.w} race={rc} doc={docs[rc.year]} me={me}
                        open={!!open[rc.year + "-" + rc.w]}
                        onToggle={() => setOpen(o => ({ ...o, [rc.year + "-" + rc.w]: !o[rc.year + "-" + rc.w] }))} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
