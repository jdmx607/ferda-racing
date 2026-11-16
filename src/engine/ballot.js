// ─── Offseason rulebook ballot (pure) ────────────────────────────────────────
// Stored on the league doc as data.ballot = { season, proposals:[…] }.
// Every manager can propose and vote; 3 of 4 approvals pass a rule, 2 vetoes kill
// it (3 approvals become impossible). Proposals by the reigning champion are
// flagged as the "Winner Makes New Rule" pick.

import { PLAYERS } from "../constants.js";

export const PASS_VOTES = 3;
export const BALLOT_CATEGORIES = ["Scoring", "Track multipliers", "Mulligans", "Draft", "Bonus drivers", "Other"];

export const emptyBallot = season => ({ season, proposals: [] });

export function addProposal(ballot, { by, text, category = "Other", now = Date.now() }) {
  const clean = String(text || "").trim().slice(0, 280);
  if (!by || !clean) return ballot;
  const id = `${now}-${by}`;
  return { ...ballot, proposals: [...(ballot?.proposals || []), { id, by, text: clean, category, createdAt: new Date(now).toISOString(), votes: { [by]: "approve" } }] };
}

/** Cast / change / clear (same vote again) a manager's vote. */
export function castVote(ballot, id, pid, vote) {
  return {
    ...ballot,
    proposals: (ballot?.proposals || []).map(p => {
      if (p.id !== id) return p;
      const votes = { ...(p.votes || {}) };
      if (votes[pid] === vote) delete votes[pid]; else votes[pid] = vote;
      return { ...p, votes };
    }),
  };
}

/** Authors can withdraw their own proposal; the commissioner can remove any. */
export function removeProposal(ballot, id, pid, isCommish = false) {
  return { ...ballot, proposals: (ballot?.proposals || []).filter(p => !(p.id === id && (p.by === pid || isCommish))) };
}

export function tally(proposal, players = PLAYERS) {
  const v = proposal?.votes || {};
  const approve = players.filter(p => v[p.id] === "approve").length;
  const veto = players.filter(p => v[p.id] === "veto").length;
  const pending = players.length - approve - veto;
  const status = approve >= PASS_VOTES ? "approved" : veto > players.length - PASS_VOTES ? "vetoed" : "open";
  return { approve, veto, pending, status };
}
