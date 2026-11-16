import { useState } from "react";
import { TTC } from "../theme";
import { ACTIVE_SEASON } from "../constants";
import { RuleBallot } from "./RuleBallot";

// Each rule: title, category, plain-language text and (optionally) a badge grid
// so the numbers can be scanned in two seconds mid-race. `note` sits under a grid.
const RULES = [
  // ── Race scoring ───────────────────────────────────────────────────────────
  { cat:"race", t:"Finish Points",
    grid:[["P1","55"],["P2","35"],["P3","34"],["P4–P35","−1 / spot"],["P36","1"],["P37–40","1"]],
    c:"P1: 55, P2: 35, then P3: 34 decreasing by 1 to P36: 1. P37-40: 1 each." },
  { cat:"race", t:"Top Finish Bonus", grid:[["Top 5","+2"],["Top 10","+1"]],
    c:"Top 5 finish: +2 bonus pts. Top 10 finish: +1 bonus pt." },
  { cat:"race", t:"Stage Points",
    grid:[["1st","10"],["2nd","9"],["3rd","8"],["4th","7"],["5th","6"],["6th","5"],["7th","4"],["8th","3"],["9th","2"],["10th","1"]], dense:true,
    c:"Top 10 each stage: 1st=10, 2nd=9... 10th=1. The Coca-Cola 600 has 3 stages." },
  { cat:"race", t:"Laps Led", track:true, quad:true,
    grid:[["SS","×1.0","superspeedway"],["INT","×0.5","intermediate"],["ST","×0.2","short_track"],["RC","×1.5","road_course"]],
    note:"Points per lap led × the track multiplier." },
  { cat:"race", t:"Net Position", grid:[["Per spot","±1"],["Cap","±10"]],
    c:"+/-1 pt per spot gained/lost (qualifying to finish). Capped at +/-10." },
  { cat:"race", t:"Bonuses",
    grid:[["Pole","+5"],["Stage Win","+2.5"],["Fastest Lap","+1"],["Most Laps","+5"],["Led a Lap","+0.5"],["Sweep","+12.5"]],
    note:"Stage Win is per stage. Led a Lap is per driver. Sweep = Pole + all stage wins." },
  { cat:"race", t:"DNF / DQ", grid:[["DNF","scores"],["DQ","−5"]],
    c:"DNF drivers score normally — finish position, net position, and any stage points earned still apply. DQ = -5 points total." },

  // ── Draft & mulligans ──────────────────────────────────────────────────────
  { cat:"draft", t:"Draft System", grid:[["Rounds","5"],["Order","Reverse"],["Snake","No"]],
    c:"Draft each week. Last week's loser picks first, winner picks last. Same order all 5 rounds." },
  { cat:"draft", t:"Mulligans", grid:[["Per season","10"],["2027 bonus","+2"]],
    c:"10 per season, usable in regular-season and playoff weeks only (never in the Clash or All-Star Race). 2027: go the whole regular season without using one and you earn 2 bonus mulligans for the playoffs. Replacement driver earns finish position points ONLY." },
  { cat:"draft", t:"W27 Draft Order",
    c:"One-time exception: Week 27's draft order is the INVERSE of the Chase-entering standings — whoever leads picks last, last place picks first. W28 onward reverts to the normal 'last week's loser picks first' rule." },

  // ── Playoffs & ISC ─────────────────────────────────────────────────────────
  { cat:"playoffs", t:"Weekly Win", grid:[["Weekly win","+25 PO"]],
    c:"Highest scorer earns 25 playoff points. Tiebreak: had the race winner, then highest single-driver score." },
  { cat:"playoffs", t:"Champ Bonus",
    c:"Regular-season leader (by total pts, weeks 1-26) earns a bonus entering the Chase: 90% of the league's average weekly score across the regular season. Ties earn no bonus until broken." },
  { cat:"playoffs", t:"The Chase (W27+)", grid:[["Reset base","1,000"]],
    c:"Everyone resets to 1,000 base + their accumulated regular-season bonus/win pts + the champ bonus (leader only). That becomes the anchor — every Chase week's FULL score (not just bonus points) adds on top, same as a regular week." },
  { cat:"playoffs", t:"GOLDEN Rule", grid:[["Golden win","+5"]],
    c:"Chase weeks only: +5 bonus pts when your picked driver wins the race AND is in the real NASCAR playoff field (see THE CHASE → Playoff Field)." },
  { cat:"playoffs", t:"In-Season Challenge (ISC)",
    grid:[["R1","1"],["R2","2"],["R3","4"],["R4","8"],["Champion","+25"]],
    c:"Pick NASCAR's 32-driver In-Season Challenge bracket. Each correct pick scores bracket points (R1 1, R2 2, R3 4, R4 8); calling the champion is worth +25 fantasy pts." },
  { cat:"playoffs", t:"Exhibitions (2027)", grid:[["1st","125"],["2nd","50"],["3rd","10"],["4th","0"]],
    c:"The Clash (season opener) and the All-Star Race are exhibitions: picks are made, but they never count in the standings. The Clash result sets the Week 1 draft order (last place picks first). The All-Star Race pays playoff points by finish: 1st = 125, 2nd = 50, 3rd = 10, 4th = 0." },
];

const CATS = [
  { id:"race",     label:"Race Scoring" },
  { id:"draft",    label:"Draft & Mulligans" },
  { id:"playoffs", label:"Playoffs & ISC" },
];

function BadgeGrid({ rule }) {
  return (
    <div className={"rl-grid" + (rule.dense ? " dense" : "") + (rule.quad ? " quad" : "")}>
      {rule.grid.map(([k, v, ty]) => (
        <span key={k} className="rl-b" style={ty ? { "--c": TTC[ty] } : undefined}>
          <span className="k">{k}</span>
          <span className="v num">{v}</span>
        </span>
      ))}
    </div>
  );
}

export function RulesTab({ data, player, onBallotChange }) {
  const [cat, setCat] = useState("race");
  const [view, setView] = useState("rules");
  const rules = RULES.filter(r => r.cat === cat);
  const open = (data?.ballot?.season === ACTIVE_SEASON + 1 ? data.ballot.proposals : []).length;
  return (
    <div className="rl">
      <h2 className="rl-h">Scoring Rules</h2>
      <div className="seg rl-view" role="tablist" aria-label="Rules view">
        <button role="tab" aria-selected={view === "rules"} aria-pressed={view === "rules"} onClick={() => setView("rules")}>Rulebook</button>
        <button role="tab" aria-selected={view === "ballot"} aria-pressed={view === "ballot"} onClick={() => setView("ballot")}>
          {ACTIVE_SEASON + 1} Ballot{open > 0 && <span className="num"> {open}</span>}
        </button>
      </div>
      {view === "ballot" ? <RuleBallot data={data} player={player} onBallotChange={onBallotChange} /> : <>
      <div className="seg rl-seg" role="tablist" aria-label="Rule category">
        {CATS.map(c => (
          <button key={c.id} role="tab" aria-selected={cat === c.id} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="rl-list">
        {rules.map(r => (
          <section key={r.t} className="rl-card">
            <h3>{r.t}</h3>
            {r.grid && <BadgeGrid rule={r} />}
            {r.note && <p className="rl-note">{r.note}</p>}
            {r.c && <p className="rl-c">{r.c}</p>}
          </section>
        ))}
      </div>
      </>}
    </div>
  );
}
