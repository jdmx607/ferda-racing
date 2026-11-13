import { useState, useEffect } from "react";
import { fetchRaceStartTimes, fetchDriverStandings } from "../nascar";
import { ACTIVE_SEASON } from "../constants";

// Shared, cached lookups — every component that asks gets the same single request.

let timesPromise = null;
/** { "YYYY-MM-DD": "HH:MM" } (Eastern) of real race start times; {} until/unless NASCAR publishes them. */
export function useRaceTimes() {
  const [times, setTimes] = useState({});
  useEffect(() => {
    let alive = true;
    if (!timesPromise) timesPromise = fetchRaceStartTimes(ACTIVE_SEASON).catch(() => ({}));
    timesPromise.then(t => { if (alive) setTimes(t); });
    return () => { alive = false; };
  }, []);
  return times;
}

const STANDINGS_TTL = 2 * 60 * 1000;
let standingsCache = { at: 0, value: null, promise: null };
function loadStandings() {
  const now = Date.now();
  if (standingsCache.value && now - standingsCache.at < STANDINGS_TTL) return Promise.resolve(standingsCache.value);
  if (!standingsCache.promise) {
    standingsCache.promise = fetchDriverStandings()
      .then(v => { standingsCache = { at: Date.now(), value: v, promise: null }; return v; })
      .catch(() => { standingsCache.promise = null; return null; });
  }
  return standingsCache.promise;
}

/** Forget cached feed results (tests / manual refresh). */
export function resetNascarFeedCaches() {
  timesPromise = null;
  standingsCache = { at: 0, value: null, promise: null };
}

/** Official NASCAR driver standings ({ drivers, raceId }) or null while loading / unavailable. */
export function useDriverStandings(enabled = true) {
  const [standings, setStandings] = useState(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadStandings().then(v => { if (alive) setStandings(v); });
    return () => { alive = false; };
  }, [enabled]);
  return standings;
}
