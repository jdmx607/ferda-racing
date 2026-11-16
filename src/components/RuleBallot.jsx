import { useState } from "react";
import { PClr } from "../theme";
import { PLAYERS, PNAME, ACTIVE_SEASON } from "../constants";
import { CHAMPION_HISTORY } from "../championsHistory";
import { newestFirst } from "../engine/champions";
import { BALLOT_CATEGORIES, PASS_VOTES, addProposal, castVote, removeProposal, tally, emptyBallot } from "../engine/ballot";
import { haptic } from "../utils/haptics";

const accentOf = pid => PClr[pid]?.accent || "var(--text-2)";
const STATUS = { approved: "APPROVED", vetoed: "VETOED", open: "OPEN" };

/**
 * Offseason "Winner Makes New Rule" ballot. Everyone proposes and votes; 3 of 4
 * approvals pass a rule. The reigning champion's proposals are flagged.
 */
export function RuleBallot({ data, player, onBallotChange }) {
  const season = ACTIVE_SEASON + 1;
  const ballot = data?.ballot?.season === season ? data.ballot : emptyBallot(season);
  const champ = newestFirst(CHAMPION_HISTORY)[0]?.overall;
  const isCommish = player?.id === "justin";
  const [text, setText] = useState("");
  const [cat, setCat] = useState(BALLOT_CATEGORIES[0]);
  const [busy, setBusy] = useState(false);

  const save = async fn => {
    if (!onBallotChange || busy) return;
    setBusy(true);
    try { await onBallotChange(b => fn(b?.season === season ? b : emptyBallot(season))); }
    finally { setBusy(false); }
  };
  const post = async () => {
    if (!text.trim() || !player) return;
    await save(b => addProposal(b, { by: player.id, text, category: cat }));
    setText(""); haptic(15);
  };

  const proposals = [...ballot.proposals].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  return (
    <div className="bl">
      <div className="bl-intro">
        <b>{season} Rulebook Ballot</b> — post a rule change and vote. <span className="num">{PASS_VOTES}</span> of 4 approvals
        pass it into the {season} rulebook. {champ && <>Reigning champ <span style={{ color: accentOf(champ), fontWeight: 700 }}>{PNAME[champ]}</span>'s proposals carry the 👑 Winner's Rule tag.</>}
      </div>

      {player && (
        <div className="bl-new">
          <select value={cat} onChange={e => setCat(e.target.value)} aria-label="Category">
            {BALLOT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <textarea value={text} maxLength={280} rows={3} onChange={e => setText(e.target.value)}
                    placeholder="e.g. Road course laps led ×2.0 instead of ×1.5" aria-label="Proposal" />
          <div className="bl-new-foot">
            <span className="num">{text.trim().length}/280</span>
            <button onClick={post} disabled={!text.trim() || busy}>Post proposal</button>
          </div>
        </div>
      )}

      {proposals.length === 0 ? <div className="bl-empty">No proposals yet — the floor is open.</div> : (
        <div className="bl-list">
          {proposals.map(p => {
            const t = tally(p);
            const mine = p.votes?.[player?.id];
            return (
              <article key={p.id} className="bl-card" data-status={t.status} style={{ "--c": accentOf(p.by) }}>
                <div className="bl-top">
                  <span className="bl-cat">{p.category}</span>
                  {p.by === champ && <span className="bl-crown">👑 WINNER'S RULE</span>}
                  <span className="bl-status" data-status={t.status}>{STATUS[t.status]}</span>
                </div>
                <p className="bl-text">{p.text}</p>
                <div className="bl-by"><i className="dot" />{PNAME[p.by]}</div>
                <div className="bl-tally">
                  {PLAYERS.map(m => {
                    const v = p.votes?.[m.id];
                    return (
                      <span key={m.id} className="bl-v" data-v={v || "pending"} style={{ "--m": accentOf(m.id) }} title={`${m.name}: ${v || "no vote yet"}`}>
                        <i />{m.name.split(" ").map(w => w[0]).join("")}<b>{v === "approve" ? "✓" : v === "veto" ? "✕" : "·"}</b>
                      </span>
                    );
                  })}
                  <span className="bl-count num">{t.approve}–{t.veto}</span>
                </div>
                {player && (
                  <div className="bl-act">
                    <button aria-pressed={mine === "approve"} className="ap" disabled={busy} onClick={() => save(b => castVote(b, p.id, player.id, "approve"))}>APPROVE</button>
                    <button aria-pressed={mine === "veto"} className="vt" disabled={busy} onClick={() => save(b => castVote(b, p.id, player.id, "veto"))}>VETO</button>
                    {(p.by === player.id || isCommish) && (
                      <button className="rm" disabled={busy} onClick={() => { if (window.confirm("Remove this proposal?")) save(b => removeProposal(b, p.id, player.id, isCommish)); }}>Remove</button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
