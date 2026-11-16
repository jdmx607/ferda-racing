import { PClr } from "../theme";
import { PNAME } from "../constants";
import { formatGmDelta, pickLabel } from "../utils/gmRating";

const accentOf = pid => PClr[pid]?.accent || "var(--text-2)";
const f1 = v => (Math.round((v || 0) * 10) / 10).toFixed(1);
const signed = v => (v > 0 ? "+" : v < 0 ? "−" : "") + f1(Math.abs(v));

export const PILLARS = [
  { key: "vopeScore", label: "Draft VOPE" },
  { key: "scouting",  label: "Scouting IQ" },
  { key: "execution", label: "Clean Floor" },
  { key: "finish",    label: "Finish" },
];

export const MODES = [
  { id: "rolling", label: "Rolling 4-Race Form" },
  { id: "season",  label: "Full Season GM Avg" },
];

export function TierBadge({ tier }) {
  return <span className="gm-tier" data-tone={tier.tone}>{tier.label}</span>;
}

export function GmDelta({ delta }) {
  return <span className={"gm-delta num " + (delta > 0 ? "up" : delta < 0 ? "dn" : "eq")}>{formatGmDelta(delta)}</span>;
}

/** "💎 Best value: #54 Ty Gibbs (Pick #17 • R5) → +19.5 over expectation" */
export function BestValueLine({ bv, prefix = "Best value" }) {
  if (!bv) return null;
  return (
    <div className="gm-bv" title={`${bv.driver}: ${f1(bv.pts)} pts, ${signed(bv.delta)} vs pick expectation`}>
      <span aria-hidden="true">💎</span>
      <span className="t">{prefix}: <b>{bv.driver}</b> <span className="num">({pickLabel(bv.k, bv.round)})</span></span>
      <span className={"num d " + (bv.delta >= 0 ? "up" : "dn")}>→ {signed(bv.delta)}{bv.delta >= 0 ? " over" : " vs"} expectation</span>
    </div>
  );
}

/** Ranked GM table: rank, delta, colour bar, rating, tier badge, 4-pillar mini bars. */
export function GmBoard({ gm, mode = "rolling", onMode, intro = true }) {
  const rows = (gm?.managers || []).slice().sort((a, b) =>
    mode === "season" ? a.seasonRank - b.seasonRank : a.rank - b.rank);
  if (!rows.length) return <div className="st-empty">No graded race weeks yet.</div>;
  return (
    <div className="gm">
      {onMode && (
        <div className="seg gm-mode" role="group" aria-label="Rating window">
          {MODES.map(m => (
            <button key={m.id} aria-pressed={mode === m.id} onClick={() => onMode(m.id)}>{m.label}</button>
          ))}
        </div>
      )}
      {intro && (
        <p className="gm-intro">
          <b>Pit-Box GM Rating</b> grades the front office each race: draft value over pick
          expectation <span className="num">40%</span>, scouting IQ <span className="num">25%</span>,
          clean floor <span className="num">20%</span>, weekly finish <span className="num">15%</span>.
          {mode === "rolling" ? <> Rolling form weights the last 4 races <span className="num">40/30/20/10</span>.</> : " Season view averages every graded race."}
        </p>
      )}
      <div className="gm-list">
        {rows.map(m => {
          const season = mode === "season";
          const rating = season ? m.season : m.rolling;
          const tier = season ? m.seasonTier : m.tier;
          const rank = season ? m.seasonRank : m.rank;
          const delta = season ? m.seasonDelta : m.delta;
          const pillars = season ? m.seasonPillars : m.rollingPillars;
          return (
            <div key={m.id} className="gm-row" style={{ "--c": accentOf(m.id) }}>
              <div className="gm-top">
                <span className="gm-rank num">{rank}</span>
                <GmDelta delta={delta} />
                <span className="gm-name">{PNAME[m.id]}</span>
                <TierBadge tier={tier} />
                <span className="gm-val num">{f1(rating)}</span>
              </div>
              <div className="gm-pillars">
                {PILLARS.map(p => (
                  <div key={p.key} className="gm-pill" title={`${p.label}: ${f1(pillars[p.key])} / 100`}>
                    <span className="lb">{p.label}</span>
                    <span className="bar"><i style={{ width: `${Math.max(0, Math.min(100, pillars[p.key]))}%` }} /></span>
                    <span className="v num">{Math.round(pillars[p.key])}</span>
                  </div>
                ))}
              </div>
              {m.last?.bestValue && <BestValueLine bv={m.last.bestValue} prefix={`W${m.last.week} best value`} />}
              <div className="gm-foot num">{m.races} race{m.races === 1 ? "" : "s"} graded · last week {f1(m.last?.gm)} GM</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
