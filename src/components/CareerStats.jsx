import { useMemo, useState } from "react";
import { PClr } from "../theme";
import { PNAME } from "../constants";
import { CHAMPION_HISTORY } from "../championsHistory";
import { CAREER_STATS, LEAGUE_RACES, RECORD_BOOK } from "../careerStats";
import { getCareerCards, sortCareer, getEra, getRecordBook } from "../engine/career";
import { TrophyIcon, FlagIcon } from "./hofIcons";

const SORTS = [
  ["wins", "Wins"], ["winPct", "Win %"], ["podiumPct", "Podium %"], ["titles", "Titles"],
];

const FINISH_COLS = [
  { key: "first",  tone: "gold",   label: "1ST (WINS)" },
  { key: "second", tone: "silver", label: "2ND" },
  { key: "third",  tone: "bronze", label: "3RD" },
  { key: "fourth", tone: "fourth", label: "4TH" },
];
const BAR_TONES = ["gold", "silver", "bronze", "fourth"];

function CareerCard({ c }) {
  const span = `${c.firstYear}–${c.lastYear}`;
  const barLabel = FINISH_COLS.map((f, i) => `${f.label.replace(" (WINS)", "")} ${c.bar[i]}`).join(", ");
  return (
    <article className="cs-card">
      <header className="cs-head">
        <span className="dot" style={{ background: PClr[c.id].accent, width: 8, height: 8 }} />
        <h3 className="cs-name">{PNAME[c.id]}</h3>
        <span className="cs-span num">{span}</span>
        {c.joinedLate && <span className="cs-join">Joined {c.firstYear}</span>}
        <span className="cs-races num">{c.races} races</span>
      </header>

      <div className="cs-rings">
        <span className={`cs-pill${c.titles.overall > 0 ? " gold" : ""}`}><TrophyIcon /><b className="num">{c.titles.overall}</b> Overall</span>
        <span className="cs-pill"><FlagIcon /><b className="num">{c.titles.regularSeason}</b> Reg. Season</span>
      </div>
      {(c.titles.overallYears.length > 0 || c.titles.regularSeasonYears.length > 0) && (
        <div className="cs-years num">
          {c.titles.overallYears.length > 0 && <span><i>Overall</i> {c.titles.overallYears.join(" · ")}</span>}
          {c.titles.regularSeasonYears.length > 0 && <span><i>Reg. Season</i> {c.titles.regularSeasonYears.join(" · ")}</span>}
        </div>
      )}

      <div className="cs-grid">
        {FINISH_COLS.map(f => (
          <div key={f.key} className={`cs-box ${f.tone}`}>
            <div className="n num">{c.finishes[f.key]}</div>
            <div className="l">{f.label}</div>
          </div>
        ))}
      </div>

      <div className="cs-bar" role="img" aria-label={`Career finishes: ${barLabel}`}>
        {c.bar.map((n, i) => <span key={i} className={BAR_TONES[i]} style={{ flexGrow: n }} />)}
      </div>
      <div className="cs-rates">
        <div><span className="num">{c.winPct}%</span><small>Win %</small></div>
        <div><span className="num">{c.podiumPct}%</span><small>Top-3 Podium %</small></div>
      </div>

      <footer className="cs-mile"><span aria-hidden="true">★</span> {c.milestone}</footer>
    </article>
  );
}

/** "All-Time Career Stats": era banner, sortable career cards, FRL record book. */
export function CareerStats() {
  const [sort, setSort] = useState("wins");

  const cards = useMemo(() => getCareerCards(CAREER_STATS, CHAMPION_HISTORY), []);
  const sorted = useMemo(() => sortCareer(cards, sort), [cards, sort]);
  const era = useMemo(() => getEra(CHAMPION_HISTORY, LEAGUE_RACES), []);
  const records = useMemo(() => getRecordBook(cards, CHAMPION_HISTORY, RECORD_BOOK), [cards]);

  return (
    <>
      <div className="cs-era num">
        <span>EST. {era.est}</span><i>•</i>
        <span>{era.seasons} SEASONS</span><i>•</i>
        <span>{era.races} RACES COMPLETED</span>
      </div>

      <section>
        <div className="sec-head" style={{ margin: "2px 2px 8px" }}>
          <span className="label">Career leaderboard</span>
          <span className="cs-sortnote">Sort by</span>
        </div>
        <div className="seg cs-sort" role="group" aria-label="Sort career leaderboard">
          {SORTS.map(([k, label]) => (
            <button key={k} aria-pressed={sort === k} onClick={() => setSort(k)}>{label}</button>
          ))}
        </div>
        <div className="cs-list">
          {sorted.map(c => <CareerCard key={c.id} c={c} />)}
        </div>
        <p className="cs-foot">
          Win % and Podium % are measured against each player's own races, so Rich's rates
          (joined {cards.find(c => c.joinedLate)?.firstYear}) compare fairly with the 2019 founders.
        </p>
      </section>

      <section>
        <div className="sec-head" style={{ margin: "2px 2px 8px" }}>
          <span className="label">FRL all-time records</span>
        </div>
        <div className="cs-records">
          {records.map(r => (
            <div key={r.key} className="cs-rec">
              <div className="l">{r.label}</div>
              <div className="who">
                <span className="dot" style={{ background: PClr[r.pid].accent, width: 6, height: 6 }} />
                {PNAME[r.pid]}
              </div>
              <div className="v num">{r.value}</div>
              <div className="s num">{r.sub}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
