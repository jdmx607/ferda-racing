import { useState, useEffect } from "react";

const PROXY    = "/api/nascar";
const POLL_MS  = 30_000;

const FLAG_NAME  = { 0:"No Race", 1:"Green", 2:"Caution", 3:"Red Flag", 4:"White", 5:"Checkered" };
const FLAG_COLOR = { 0:"#64748b", 1:"#10b981", 2:"#f59e0b", 3:"#ef4444", 4:"#e2e8f0", 5:"#f1f5f9" };

export function useLiveTiming(data) {
  const [timing, setTiming] = useState(null);

  useEffect(() => {
    if (!data?.liveRace?.active) { setTiming(null); return; }

    async function poll() {
      try {
        const url = `${PROXY}?source=nascar-live&path=${encodeURIComponent("live-feed.json")}`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) return;
        const feed = await res.json();
        if (!feed.vehicles?.length) return;

        const vehicles = [...feed.vehicles]
          .sort((a, b) => (a.running_position || 99) - (b.running_position || 99))
          .map(v => ({
            position:  v.running_position || 0,
            carNumber: String(v.vehicle_number || ""),
            driver:    v.driver
              ? [v.driver.first_name, v.driver.last_name].filter(Boolean).join(" ")
              : String(v.vehicle_number),
            lastLap:   parseFloat(v.last_lap_time)  || 0,
            bestLap:   parseFloat(v.best_lap_time)  || 0,
            lastSpeed: parseFloat(v.last_lap_speed) || 0,
            lapsLed:   parseInt(v.laps_led)         || 0,
            lapsComp:  parseInt(v.laps_completed)   || 0,
            delta:     parseFloat(v.delta)          || 0,
            isOnTrack: v.is_on_track !== false,
            pitStops:  (v.pit_stops || []).length,
          }));

        const fs = parseInt(feed.flag_state) || 0;
        setTiming({
          vehicles,
          lapNumber:   parseInt(feed.lap_number)             || 0,
          lapsInRace:  parseInt(feed.laps_in_race)           || 0,
          lapsToGo:    parseInt(feed.laps_to_go)             || 0,
          flagState:   fs,
          flagName:    FLAG_NAME[fs]  ?? "Unknown",
          flagColor:   FLAG_COLOR[fs] ?? "#64748b",
          stage:       feed.stage || null,
          cautions:    feed.number_of_caution_segments || 0,
          leadChanges: feed.number_of_lead_changes     || 0,
          updatedAt:   Date.now(),
        });
      } catch (_) { /* silent — scoring still works */ }
    }

    poll();
    const t = setInterval(poll, POLL_MS);
    return () => clearInterval(t);
  }, [data?.liveRace?.active, data?.liveRace?.week]);

  return timing;
}
