import { useCallback, useEffect, useState } from "react";
import { ACTIVE_SEASON } from "../constants";
import { appSeasons } from "../seasons";
import { loadSeasonDoc } from "../firebase";
import { isSimplified } from "../engine/simple";

/**
 * Open/close state for the Driver Telemetry Card on one screen.
 *   const card = useDriverCard(player, data);
 *   <div {...tapProps(card.open, driver)}>…</div>        ← the row's tappable area
 *   <DriverTelemetryCard name={card.name} onClose={card.close} … />
 *
 * Simplified Mode (Big Monroe's ultra-simple app) never gets the dense telemetry card:
 * `open` is null there, so rows render as plain, non-interactive text.
 */
export function useDriverCard(player, data) {
  const [name, setName] = useState(null);
  const enabled = !(player?.id && isSimplified(player.id, data?.playerSettings));
  const open = useCallback(driver => setName(driver), []);
  const close = useCallback(() => setName(null), []);
  return { name: enabled ? name : null, open: enabled ? open : null, close, enabled };
}

/**
 * Spread onto the part of a row that should open the card. Anything NOT spread
 * (the far-right DRAFT / QUEUE button, an expand chevron) keeps its own 1-tap action.
 */
export function tapProps(open, driver, label) {
  if (!open) return {};
  return {
    role: "button", tabIndex: 0, "data-dtc": "",
    "aria-label": label || `${String(driver).replace(/^#\S+\s+/, "")} telemetry`,
    onClick: () => open(driver),
    onKeyDown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(driver); } },
  };
}

/** Frozen past-season documents ({ [year]: doc }) — exact FERDA points for old races at a track. */
export function useArchivedSeasons(enabled = true) {
  const [docs, setDocs] = useState({});
  useEffect(() => {
    if (!enabled) return undefined;
    const past = appSeasons().filter(y => y !== ACTIVE_SEASON);
    if (!past.length) return undefined;
    let alive = true;
    Promise.all(past.map(y => loadSeasonDoc(y).then(d => [y, d]))).then(pairs => {
      if (!alive) return;
      const next = {};
      pairs.forEach(([y, d]) => { if (d) next[y] = d; });
      setDocs(next);
    });
    return () => { alive = false; };
  }, [enabled]);
  return docs;
}
