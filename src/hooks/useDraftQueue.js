import { useState, useEffect, useCallback } from "react";
import { toggleQueue, moveToTop } from "../engine/draftBoard";

// "My Queue" — a manager's private pre-draft watchlist for one event. It's a
// per-viewer convenience (like a remembered tab), so it lives in this device's
// localStorage and never touches the league doc or the draft/pick bindings.
// Every storage call is guarded: private windows / blocked storage just mean the
// queue lasts until the page is closed.

const keyFor = (pid, week) => `ferda-draft-queue:${pid}:${week}`;

function read(key) {
  try {
    const v = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(v) ? v.filter(x => typeof x === "string") : [];
  } catch { return []; }
}
function write(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

export function useDraftQueue(pid, week) {
  const key = keyFor(pid, week);
  const [queue, setQueue] = useState(() => read(key));

  // switching player / event → load that queue
  useEffect(() => { setQueue(read(key)); }, [key]);

  const update = useCallback(fn => {
    setQueue(q => { const next = fn(q); write(key, next); return next; });
  }, [key]);

  return {
    queue,
    toggle:  useCallback(d => update(q => toggleQueue(q, d)), [update]),
    toTop:   useCallback(d => update(q => moveToTop(q, d)), [update]),
    remove:  useCallback(d => update(q => q.filter(x => x !== d)), [update]),
    clear:   useCallback(() => update(() => []), [update]),
    /** replace the stored list (used to drop drivers that were drafted) */
    replace: useCallback(next => update(() => next), [update]),
  };
}
