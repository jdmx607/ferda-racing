import { useState, useEffect } from "react";
import { loadLeagueData, saveLeagueData, subscribeToLeagueData, loadLocalBackup, isFirebaseReady, ensureActiveSeason } from "../firebase";
import { buildInitialData } from "../engine/scoring";
import { buildSeasonSeed } from "../engine/rollover";
import { ACTIVE_SEASON } from "../constants";
import { FIRST_APP_SEASON } from "../seasons";

// Manages the single Firestore document for the league.
// Falls back to localStorage if Firebase is unavailable.
// Returns setData so callers can optimistically update state before saving.
export function useLeagueData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState("connecting");

  useEffect(() => {
    let unsub = null;
    (async () => {
      try {
        let d = await loadLeagueData();
        if (d) {
          setDbStatus("connected");
        } else if (ACTIVE_SEASON > FIRST_APP_SEASON) {
          // New season: create its document from last season's (clean slate + carried-over
          // player settings) and archive the old one. Never seeds from the 2026 history.
          d = await ensureActiveSeason();
          if (d) setDbStatus("connected");
        }
        if (!d) {
          d = loadLocalBackup();
          if (d) setDbStatus("offline");
        }
        if (!d) {
          if (ACTIVE_SEASON > FIRST_APP_SEASON) {
            // Couldn't reach the database to confirm the season's state: run on an empty
            // season in memory and DON'T write it (that could overwrite a real document).
            d = buildSeasonSeed(null, ACTIVE_SEASON);
            setDbStatus("offline");
          } else {
            d = buildInitialData();
            setDbStatus(isFirebaseReady() ? "new" : "offline");
            await saveLeagueData(d);
          }
        }
        setData(d);
        setLoading(false);
        unsub = subscribeToLeagueData(u => { setData(u); setDbStatus("connected"); });
      } catch (e) {
        console.error("Startup error:", e);
        setData(loadLocalBackup() || buildInitialData());
        setLoading(false);
        setDbStatus("offline");
      }
    })();
    return () => { if (unsub) unsub(); };
  }, []);

  return { data, setData, loading, dbStatus };
}
