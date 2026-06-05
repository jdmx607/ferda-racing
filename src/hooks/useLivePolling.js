import { useState, useEffect } from "react";
import { fetchLiveRaceData } from "../nascar";
import { scoreWeekFull } from "../engine/scoring";
import { PLAYERS } from "../constants";

const LIVE_POLL_INTERVAL = 30000;

export function useLivePolling(data) {
  const [liveScores, setLiveScores] = useState(null);
  const [liveStatus, setLiveStatus] = useState("");
  const [raceInfo, setRaceInfo] = useState(null);

  useEffect(() => {
    if (!data?.liveRace?.active) {
      setLiveScores(null);
      setLiveStatus("");
      setRaceInfo(null);
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
        setRaceInfo({
          raceName: result.raceName || null,
          source: result.source || "NASCAR.com",
          note: result.note || null,
          isLive: result.isLive !== false,
          isOver: !!result.isOver,
        });
        const now = new Date();
        setLiveStatus(`Live · ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
      } catch (e) {
        console.error("Live poll error:", e);
      }
    };

    poll();
    timer = setInterval(poll, LIVE_POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [data?.liveRace?.active, data?.liveRace?.week]);

  return { liveScores, liveStatus, raceInfo };
}
