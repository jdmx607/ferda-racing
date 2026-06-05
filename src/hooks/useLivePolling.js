import { useState, useEffect } from "react";
import { fetchLiveRaceData } from "../nascar";
import { scoreWeekFull } from "../engine/scoring";
import { PLAYERS } from "../constants";

const LIVE_POLL_INTERVAL = 30000; // 30 seconds — same cadence as NASCAR Race Center

// Polls the NASCAR live feed every 30s when data.liveRace.active is true.
// Scores the current week's picks provisionally against live positions.
// Clears liveScores automatically when the race is deactivated.
export function useLivePolling(data) {
  const [liveScores, setLiveScores] = useState(null);
  const [liveStatus, setLiveStatus] = useState("");

  useEffect(() => {
    if (!data?.liveRace?.active) {
      setLiveScores(null);
      setLiveStatus("");
      return;
    }
    const week = data.liveRace.week;
    let timer;

    const poll = async () => {
      try {
        const result = await fetchLiveRaceData(week);
        if (!result.ok) return;
        const wp = data.picks?.["w" + week] || {};
        const mo = {};
        PLAYERS.forEach(p => {
          mo[p.id] = (wp[p.id] || []).filter(pk => pk.mulligan).map(pk => ({ week, driver: pk.driver }));
        });
        const scored = scoreWeekFull(wp, { drivers: result.drivers, threeStages: result.threeStages }, week, mo);
        setLiveScores(scored);
        const now = new Date();
        setLiveStatus(`Live · ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
      } catch (e) {
        console.error("Live poll error:", e);
      }
    };

    poll(); // immediate first fetch on activation
    timer = setInterval(poll, LIVE_POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [data?.liveRace?.active, data?.liveRace?.week]);

  return { liveScores, liveStatus };
}
