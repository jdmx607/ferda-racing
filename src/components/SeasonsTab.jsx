import { useEffect, useMemo, useState } from "react";
import { PClr } from "../theme";
import { PNAME, ACTIVE_SEASON } from "../constants";
import { appSeasons } from "../seasons";
import { loadSeasonDoc } from "../firebase";
import { seasonWeeks, seasonHighlights, seasonStandings, championsFor } from "../engine/archive";
import { lastNameOf } from "../engine/draftBoard";
import { DisciplineBadge } from "./TrackIdentity";

const accentOf = pid => PClr[pid]?.accent || "var(--text-2)";
const f1 = n => (Math.round(n * 10) / 10).toFixed(1);

function Driver({ d }) {
  const num = (String(d.driver).match(/^#(\S+)/) || [])[1];
  return (
    <span className={"sn-d" + (d.dnr ? " out" : "")}>
      {num && <b className="num">#{num}</b>} {lastNameOf(String(d.driver).replace(/^#\S+\s+/, ""))}
      <span className="num pt">{d.dnr ? "DNR" : f1(d.total)}</span>
    </span>
  );
}

function WeekRow({ w, open, onToggle }) {
  const top = w.scores[0];
  return (
    <div className={"sn-week" + (open ? " open" : "")}>
      <button className="sn-week-main" onClick={onToggle} aria-expanded={open}>
        <span className="wk num">{w.ex ? "EX" : `W${w.w}`}</span>
        <span className="mid">
          <span className="race">{w.race}</span>
          <span className="trk"><span>{w.track}</span><DisciplineBadge ty={w.ty} /></span>
        </span>
        <span className="win" style={{ "--c": accentOf(top.pid) }}>
          <span className="nm"><i className="dot" />{PNAME[top.pid]}</span>
          <span className="num sc">{f1(top.total)}</span>
        </span>
      </button>
      {open && (
        <div className="sn-detail">
          {w.scores.map((s, i) => (
            <div key={s.pid} className="sn-mgr" style={{ "--c": accentOf(s.pid) }}>
              <div className="hd"><span className="rk num">{i + 1}</span><i className="dot" /><b>{PNAME[s.pid]}</b><span className="num tot">{f1(s.total)}</span></div>
              <div className="drs">{s.drivers.length ? s.drivers.map(d => <Driver key={d.driver} d={d} />) : <span className="none">No lineup recorded</span>}</div>
            </div>
          ))}
          {w.mvp && (
            <div className="sn-mvp num">
              🏆 Top driver: <b>{w.mvp.name}</b> {f1(w.mvp.total)}
              {w.mvp.owners.length ? ` · ${w.mvp.owners.map(p => PNAME[p]).join(" & ")}` : " · undrafted"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Season archive: pick any season and browse its standings, records and every race, read-only. */
export function SeasonsTab({ data }) {
  const seasons = appSeasons();
  const [year, setYear] = useState(ACTIVE_SEASON);
  const [doc, setDoc] = useState(year === ACTIVE_SEASON ? data : null);
  const [state, setState] = useState("ready");           // ready | loading | missing
  const [open, setOpen] = useState({});

  useEffect(() => {
    setOpen({});
    if (year === ACTIVE_SEASON) { setDoc(data); setState("ready"); return; }
    let alive = true;
    setState("loading"); setDoc(null);
    loadSeasonDoc(year).then(d => { if (!alive) return; setDoc(d); setState(d ? "ready" : "missing"); });
    return () => { alive = false; };
  }, [year, data]);

  const weeks = useMemo(() => (doc ? seasonWeeks(doc, year) : []), [doc, year]);
  const hi = useMemo(() => seasonHighlights(weeks), [weeks]);
  const standings = useMemo(() => (doc && weeks.length ? seasonStandings(doc, weeks) : []), [doc, weeks]);
  const champs = championsFor(year);
  const isArchive = year !== ACTIVE_SEASON || !!doc?.archived;
  const maxTotal = standings[0]?.total || 1;

  return (
    <div className="sn">
      <header className="sn-head">
        <h2>Seasons</h2>
        <span className="sn-sub">Every season, saved</span>
      </header>

      <div className="sn-pills" role="tablist" aria-label="Season">
        {seasons.map(y => (
          <button key={y} role="tab" aria-selected={year === y} aria-pressed={year === y} onClick={() => setYear(y)}>
            {y}<small>{y === ACTIVE_SEASON ? "current" : "archive"}</small>
          </button>
        ))}
      </div>

      <div className="sn-banner" data-kind={isArchive ? "archive" : "live"}>
        <b className="num">{year} Season</b>
        <span>{isArchive ? "ARCHIVE · READ-ONLY" : "CURRENT SEASON"}</span>
      </div>

      {state === "loading" && <div className="sn-empty">Loading {year}…</div>}
      {state === "missing" && <div className="sn-empty">The {year} season couldn't be loaded. Check your connection and try again.</div>}

      {state === "ready" && weeks.length === 0 && (
        <div className="sn-empty">No races scored in {year} yet.</div>
      )}

      {state === "ready" && weeks.length > 0 && (
        <>
          {champs && (
            <section className="card sn-champ">
              <span className="label">{year} champion</span>
              <div className="nm" style={{ "--c": accentOf(champs.overall) }}><i className="dot" />{PNAME[champs.overall]}</div>
              <div className="sub">
                {champs.regularSeason !== champs.overall && <>Regular season: <b>{PNAME[champs.regularSeason]}</b> · </>}
                {champs.notes || (champs.margin ? `Won by ${champs.margin}` : "")}
              </div>
            </section>
          )}

          <section className="card sn-stand">
            <div className="st-sec"><span className="label">Final standings</span><span className="st-sec-note">Chase total</span></div>
            {standings.map((s, i) => (
              <div key={s.pid} className="sn-st" style={{ "--c": accentOf(s.pid) }}>
                <span className="rk num">{i + 1}</span>
                <span className="nm"><i className="dot" />{PNAME[s.pid]}</span>
                <span className="wins num">{s.wins}W</span>
                <span className="tot num">{s.total.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                <span className="bar" style={{ width: `${Math.max(0, Math.min(100, (s.total / maxTotal) * 100))}%` }} />
              </div>
            ))}
          </section>

          <section className="sn-recs">
            {hi.bestWeek && (
              <div className="sn-rec" style={{ "--c": accentOf(hi.bestWeek.pid) }}>
                <span className="lb">Best week</span>
                <span className="v num">{f1(hi.bestWeek.total)}</span>
                <span className="d">{PNAME[hi.bestWeek.pid]} · W{hi.bestWeek.w}</span>
              </div>
            )}
            {hi.bestDriver && (
              <div className="sn-rec" style={{ "--c": hi.bestDriver.owners[0] ? accentOf(hi.bestDriver.owners[0]) : "var(--text-3)" }}>
                <span className="lb">Best driver</span>
                <span className="v num">{f1(hi.bestDriver.total)}</span>
                <span className="d">{lastNameOf(String(hi.bestDriver.name).replace(/^#\S+\s+/, ""))} · W{hi.bestDriver.w}</span>
              </div>
            )}
            {hi.longestStreak && (
              <div className="sn-rec" style={{ "--c": accentOf(hi.longestStreak.pid) }}>
                <span className="lb">Win streak</span>
                <span className="v num">{hi.longestStreak.length}</span>
                <span className="d">{PNAME[hi.longestStreak.pid]}</span>
              </div>
            )}
          </section>

          <section>
            <div className="st-sec"><span className="label">Race by race</span><span className="st-sec-note num">{weeks.length} races · tap for lineups</span></div>
            <div className="sn-weeks">
              {weeks.map(w => (
                <WeekRow key={w.w} w={w} open={!!open[w.w]} onToggle={() => setOpen(o => ({ ...o, [w.w]: !o[w.w] }))} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
