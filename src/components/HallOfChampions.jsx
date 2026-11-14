import { Fragment, useMemo, useState } from "react";
import { PClr } from "../theme";
import { PNAME } from "../constants";
import { CHAMPION_HISTORY } from "../championsHistory";
import {
  newestFirst, wonTitle, wonAnyTitle, getTitleTally, seasonBadges,
  getOverallRuns, runLabel, getReigning,
} from "../engine/champions";
import { TrophyIcon, FlagIcon } from "./hofIcons";
import { CareerStats } from "./CareerStats";

/** Hall of Champions screen: segmented toggle between the plaques and the career telemetry. */
export function HallOfChampions({ setTab }) {
  const [view, setView] = useState("hall");                    // "hall" | "career"
  return (
    <div className="hof">
      <div className="hof-top">
        <button className="link-btn" onClick={() => setTab("welcome")}>← Home</button>
        <span className="label">{view === "hall" ? "Hall of Champions" : "All-Time League History"}</span>
      </div>
      <div className="seg hof-seg" role="group" aria-label="Hall of Champions view">
        <button aria-pressed={view === "hall"} onClick={() => setView("hall")}>Hall of Champions</button>
        <button aria-pressed={view === "career"} onClick={() => setView("career")}>All-Time Career Stats</button>
      </div>
      {view === "hall" ? <ChampionsTimeline /> : <CareerStats />}
    </div>
  );
}

/**
 * Reigning-champion plaque, all-time hardware strip (tap a player to filter), and the
 * 2026→2019 heritage timeline with sweep / split / streak callouts.
 */
function ChampionsTimeline() {
  const [filter, setFilter] = useState(null);                 // player id or null

  const history  = CHAMPION_HISTORY;
  const seasons  = useMemo(() => newestFirst(history), [history]);
  const tally    = useMemo(() => getTitleTally(history), [history]);
  const reigning = useMemo(() => getReigning(history), [history]);
  const runs     = useMemo(() => getOverallRuns(history), [history]);
  const runEndingIn = useMemo(() => Object.fromEntries(runs.map(r => [r.endYear, r])), [runs]);

  const visible = filter ? seasons.filter(s => wonAnyTitle(s, filter)) : seasons;

  return (
    <>
      {/* ── 1. Reigning champion plaque ─────────────────────────────────── */}
      {reigning && (
        <section className="hof-hero">
          <div className="hof-glow" />
          <div className="hof-trophy"><TrophyIcon /></div>
          <span className="hof-pill">
            REIGNING CHAMPION{reigning.dynasty ? ` • ${reigning.dynasty}` : ""}
          </span>
          <div className="hof-season num">{reigning.season.year} FERDA CHAMPION</div>
          <div className="hof-champ">{PNAME[reigning.pid]}</div>
          {(reigning.season.notes || reigning.season.margin != null) && (
            <div className="hof-stats num">
              {reigning.season.notes || `Won by ${reigning.season.margin}`}
            </div>
          )}
        </section>
      )}

      {/* ── 2. All-time dynasty hardware strip (also the filter) ────────── */}
      <section>
        <div className="sec-head" style={{ margin: "2px 2px 8px" }}>
          <span className="label">All-time hardware</span>
          <button className="hof-reset" aria-pressed={!filter} onClick={() => setFilter(null)}>All seasons</button>
        </div>
        <div className="hof-tally" role="group" aria-label="Filter seasons by player">
          {tally.map(t => (
            <button
              key={t.id} className="hof-t" aria-pressed={filter === t.id}
              onClick={() => setFilter(filter === t.id ? null : t.id)}
            >
              <div className="nm">{PNAME[t.id]}</div>
              <div className="n num">{t.overall}</div>
              <div className="l">Overall</div>
              <div className="rs"><b className="num">{t.regularSeason}</b> Reg. Season</div>
            </button>
          ))}
        </div>
      </section>

      {/* ── 3. Chronological timeline ───────────────────────────────────── */}
      <section>
        <div className="sec-head" style={{ margin: "2px 2px 8px" }}>
          <span className="label">{filter ? `${PNAME[filter]}'s titles` : "Championship timeline"}</span>
          <span className="num" style={{ fontSize: 11, color: "var(--text-3)" }}>
            {visible.length} season{visible.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="hof-list">
          {visible.map(s => {
            const b   = seasonBadges(s);
            const ov  = filter ? wonTitle(s, filter).overall : false;
            const rs  = filter ? wonTitle(s, filter).regularSeason : false;
            const run = runEndingIn[s.year];
            const note = s.notes || (s.margin != null ? `Won by ${s.margin}` : "");
            const noteIsTag = b.inaugural && /inaugural/i.test(note);     // the badge already says it
            return (
              <Fragment key={s.year}>
                {run && <div className="hof-streak">{runLabel(run)}</div>}
                <article className={`hof-card${b.sweep ? " sweep" : ""}`}>
                  <div className="hof-yr num">{s.year}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className={`hof-ov${ov ? " won" : ""}`}>
                      <TrophyIcon />
                      <span className="nm">{PNAME[s.overall]}</span>
                      <span className="dot" style={{ background: PClr[s.overall].accent, width: 6, height: 6 }} />
                    </div>
                    <div className={`hof-rs${rs ? " won" : ""}`}>
                      <FlagIcon />
                      <span className="nm">{PNAME[s.regularSeason]}</span>
                      <small>Reg. season</small>
                    </div>

                    {(b.sweep || b.split || b.inaugural) && (
                      <div className="hof-badges">
                        {b.sweep    && <span className="hof-badge sweep">UNDISPUTED SWEEP</span>}
                        {b.split    && <span className="hof-badge split">◐ SPLIT CROWN</span>}
                        {b.inaugural && <span className="hof-badge inaug">INAUGURAL SEASON</span>}
                      </div>
                    )}
                    {note && !noteIsTag && <div className="hof-note num">{note}</div>}
                  </div>
                </article>
              </Fragment>
            );
          })}
        </div>
      </section>
    </>
  );
}
