// 4px full-width race-state bar. Sits directly under the RaceHeader and fades
// between states: green · yellow (caution) · red · checkered (final lap) · none.

const LABEL = {
  green: "Green flag", yellow: "Caution", red: "Red flag",
  checkered: "Final lap", none: "No live race",
};

export function FlagStrip({ state = "none" }) {
  return (
    <div className="flag-strip" data-state={state} role="status" aria-label={LABEL[state] || LABEL.none} />
  );
}

/**
 * Map live feeds to a strip state.
 * timing  — useLiveTiming() result ({ flagState 0-5, lapNumber, lapsInRace })
 * raceInfo — useLivePolling() raceInfo ({ isLive, isOver })
 * NASCAR flag_state: 1 green · 2 caution · 3 red · 4 white (final lap) · 5 checkered
 */
export function raceFlagState(timing, raceInfo) {
  if (raceInfo?.isOver) return "checkered";
  if (timing) {
    const fs = timing.flagState;
    if (fs === 5 || fs === 4) return "checkered";          // white flag = final lap
    if (timing.lapsInRace > 0 && timing.lapNumber >= timing.lapsInRace) return "checkered";
    if (fs === 2) return "yellow";
    if (fs === 3) return "red";
    if (fs === 1) return "green";
  }
  return raceInfo?.isLive ? "green" : "none";
}
