import { useEffect, useRef } from "react";
import { sweatSnapshot, diffSweatEvents } from "../engine/sweat";
import { pushToast, systemNotify, getAlertPrefs } from "../utils/toast";
import { haptic } from "../utils/haptics";

/**
 * App-wide "sweat alerts": diffs draft + live-race state every time it changes and
 * fires in-app toasts (and system notifications if enabled in Settings):
 * you're on the clock · owned stage winners · owned DNFs · 10-to-go points gap.
 * Read-only — the draft / scoring / polling hooks are untouched.
 */
export function useSweatAlerts({ user, data, currentWeek, raceInfo, liveScores, timing }) {
  const prev = useRef(null);
  const liveWeek = data?.liveRace?.active ? data.liveRace.week : null;

  useEffect(() => {
    if (!user || !data) return;
    const next = sweatSnapshot({ data, week: currentWeek, liveWeek, raceInfo, liveScores, timing });
    const events = diffSweatEvents(prev.current, next, { me: user.id });
    prev.current = next;
    if (!events.length) return;
    const prefs = getAlertPrefs();
    events.forEach(e => {
      if (prefs.inApp) pushToast({ title: e.title, body: e.body, tone: e.tone });
      systemNotify(e.title, e.body);
    });
    if (events.some(e => e.kind === "draft")) haptic([15, 60, 15]);
  }, [user, data, currentWeek, liveWeek, raceInfo, liveScores, timing]);
}
