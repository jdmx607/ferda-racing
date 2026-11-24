import { useEffect, useState } from "react";

// One fetch per file per session. Sheets are static JSON refreshed weekly (see
// scripts/update_cheat_sheets.py); the service worker keeps a copy for offline use.
const cache = new Map();
const base = () => (import.meta.env?.BASE_URL || "/").replace(/\/?$/, "/");

function load(path) {
  if (!cache.has(path)) {
    cache.set(path, fetch(base() + path, { cache: "no-cache" }).then(res => {
      if (!res.ok) throw new Error(`${path}: ${res.status}`);
      return res.json();
    }).catch(err => { cache.delete(path); throw err; }));
  }
  return cache.get(path);
}

function useJson(path) {
  const [state, setState] = useState({ path: null, data: null, error: null });
  useEffect(() => {
    if (!path) return undefined;
    let alive = true;
    load(path).then(data => alive && setState({ path, data, error: null }))
              .catch(error => alive && setState({ path, data: null, error }));
    return () => { alive = false; };
  }, [path]);
  const ready = state.path === path;
  return { data: ready ? state.data : null, error: ready ? state.error : null, loading: !!path && !ready };
}

/** The sheet for one track slug ("daytona"), or null while loading / on error. */
export const useCheatSheet = slug => useJson(slug ? `data/cheat_sheets/${slug}.json` : null);

/** Index of every track + the weights/tier legend. */
export const useTracksMaster = () => useJson("data/tracks_master.json");
