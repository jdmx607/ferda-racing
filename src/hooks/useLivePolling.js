import { useState, useEffect } from "react";
import { fetchLiveRaceData } from "../nascar";
import { scoreWeekFull } from "../engine/scoring";
import { storeFor } from "../engine/events";
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
        const wp = storeFor(data, week).picks?.["w" + week] || {};
        const mo = {};
        PLAYERS.forEach(p => {
          mo[p.id] = (wp[p.id] || []).filter(pk => pk.mulligan).map(pk => ({ week, driver: pk.driver }));
        });
        const scored = scoreWeekFull(wp, { drivers: result.drivers, threeStages: result.threeStages }, week, mo, data.chaseField?.drivers);
        setLiveScores(scored);
        setRaceInfo({
          raceName: result.raceName || null,
          source: result.source || "NASCAR.com",
          note: result.note || null,
          isLive: result.isLive !== false,
          isOver: !!result.isOver,
          lapsToGo: result.lapsToGo ?? null,
          // car number → { finish (current position), start, dnf } for the driver cards
          positions: Object.fromEntries((result.drivers || []).map(d => [
            (String(d.name).match(/^#(\S+)/) || [])[1] || d.name,
            { finish: d.finish, start: d.qualPos, dnf: !!d.dnf },
          ])),
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
