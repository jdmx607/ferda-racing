import { useState, useEffect } from "react";
import { loadLeagueData, saveLeagueData, subscribeToLeagueData, loadLocalBackup, isFirebaseReady } from "../firebase";
import { buildInitialData } from "../engine/scoring";

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
        } else {
          d = loadLocalBackup();
          if (d) setDbStatus("offline");
        }
        if (!d) {
          d = buildInitialData();
          setDbStatus(isFirebaseReady() ? "new" : "offline");
          await saveLeagueData(d);
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
