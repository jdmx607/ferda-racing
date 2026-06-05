import { PLAYERS, ACTIVE_PICKS, PICKS_PER_WEEK, GARAGE_PICK_ENABLED } from "../constants.js";

export function getDraftOrder(data, currentWeek) {
  const prev = data.results?.["w" + (currentWeek - 1)];
  if (!prev?.scored) return PLAYERS.map(p => p.id);
  return PLAYERS.map(p => ({ id: p.id, score: prev.scored[p.id]?.total || 0 }))
    .sort((a, b) => a.score - b.score)
    .map(s => s.id);
}

export function buildSnakeOrder(order) {
  const seq = [];
  const rounds = GARAGE_PICK_ENABLED ? PICKS_PER_WEEK : ACTIVE_PICKS;
  for (let r = 0; r < rounds; r++) {
    order.forEach(pid => seq.push({ pid, round: r + 1 }));
  }
  return seq;
}
