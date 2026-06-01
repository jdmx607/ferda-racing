// NASCAR Data Service
// ALL external calls route through /api/nascar (Vercel proxy) to avoid CORS.
// SportsDataIO key lives server-side only — never exposed in the browser bundle.

const PROXY = "/api/nascar";

async function tryFetch(url) {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch { return null; }
}

// Route a SportsDataIO path through the Vercel proxy
function sdUrl(path) {
  return `${PROXY}?source=sportsdata&path=${encodeURIComponent(path)}`;
}

// Route a NASCAR cacher path through the Vercel proxy
function cacherUrl(path) {
  return `${PROXY}?path=${encodeURIComponent(path)}`;
}

// ─── Driver name helpers ─────────────────────────────────────────────────────

function carToDriver(carNo, firstName, lastName) {
  const raw = String(carNo || "");
  const num = raw.replace(/^0+/, "") || raw;
  const specials = {
    "33": "#33 Austin Hill / Jesse Love",
    "66": "#66 Various",
    "78": "#78 BJ McLeod / Daniel Dye / Katherine Legge",
  };
  if (raw === "01" || raw === "001") return "#01 Corey LaJoie";
  if (specials[num]) return specials[num];
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return `#${num} ${name}`;
}

// ─── Shared: find SportsDataIO Cup race for a given week ─────────────────────

async function getSportsDataRace(week) {
  const races = await tryFetch(sdUrl("/Races/2026"));
  if (!races || !Array.isArray(races)) return null;
  const cup = races
    .filter(r => r.PointsRace !== false &&
      (r.SeriesID === 100 || r.SeriesID === 1 || String(r.Series || "").includes("Cup")))
    .sort((a, b) => new Date(a.Day || a.Date || 0) - new Date(b.Day || b.Date || 0));
  return cup[week - 1] || null;
}

// ─── LIVE DATA (SportsDataIO via proxy) ─────────────────────────────────────

export async function fetchLiveRaceData(week) {
  const race = await getSportsDataRace(week);
  if (!race) return { ok: false, error: "Could not find race schedule from SportsDataIO." };

  const raceId = race.RaceID || race.RaceId;
  const data = await tryFetch(sdUrl(`/RaceResults/${raceId}`));
  if (!data) return { ok: false, error: `No live results yet for race ID ${raceId}.` };

  const raceObj = Array.isArray(data) ? data[0] : data;
  const rawResults = raceObj?.DriverRaceResults || raceObj?.Results || [];
  if (!rawResults.length) return { ok: false, error: "No driver results yet — race may not have started." };

  let mostLapsLedName = null, maxLaps = 0;

  const drivers = rawResults.map(r => {
    const carNo = String(r.Number || r.CarNumber || r.Car || "");
    const fullName = r.Name || r.Driver || "";
    const parts = fullName.trim().split(" ");
    const first = parts.slice(0, -1).join(" ");
    const last = parts[parts.length - 1] || "";
    const name = carToDriver(carNo, first, last);
    const finish = parseInt(r.FinishPosition || r.Position || 0);
    const start = parseInt(r.StartPosition || 0);
    const lapsLed = parseInt(r.LapsLed || 0);
    const status = (r.Status || r.Reason || "").toLowerCase();
    const dnf = status.includes("accident") || status.includes("engine") || status.includes("out");
    const dq = status.includes("dq") || status.includes("disqualified");
    if (lapsLed > maxLaps) { maxLaps = lapsLed; mostLapsLedName = name; }
    const stage1 = parseInt(r.Stage1FinishPosition || r.Stage1Position || 0);
    const stage2 = parseInt(r.Stage2FinishPosition || r.Stage2Position || 0);
    return {
      name, finish, qualPos: start, lapsLed, stage1, stage2, stage3: 0,
      pole: start === 1, stageWin1: stage1 === 1, stageWin2: stage2 === 1, stageWin3: false,
      fastestLap: false, mostLapsLed: false, dnf, dq,
    };
  }).filter(d => d.finish > 0).sort((a, b) => a.finish - b.finish);

  if (mostLapsLedName) { const d = drivers.find(x => x.name === mostLapsLedName); if (d) d.mostLapsLed = true; }

  return {
    ok: true, drivers, threeStages: false,
    raceName: raceObj?.Name || race?.Name || `Week ${week}`,
    trackName: raceObj?.Track || race?.Track || "",
    isLive: raceObj?.IsStarted && !raceObj?.IsOver,
    isOver: !!raceObj?.IsOver,
    driverCount: drivers.length,
    note: "Live · updates every 30s",
    source: "SportsDataIO",
  };
}

// ─── POST-RACE DATA (NASCAR cacher via proxy) ────────────────────────────────

const CACHER_RACE_IDS = {
  1:5596,2:5597,3:5598,4:5599,5:5600,6:5603,7:5602,8:5604,
  9:5607,10:5605,11:5606,12:5621,13:5610,
};

async function getCacherRaceId(week) {
  if (CACHER_RACE_IDS[week]) return CACHER_RACE_IDS[week];
  const schedule = await tryFetch(cacherUrl("/2026/race_list_basic.json"));
  if (schedule?.series_1) {
    const pts = schedule.series_1.filter(r => r.race_type_id !== 2);
    const r = pts[week - 1];
    if (r?.race_id) return r.race_id;
  }
  return week;
}

function parseStages(weekendData) {
  const stageMap = {};
  (weekendData?.weekend_stage_results || []).forEach(e => {
    const sn = e.stage_number || 1, pos = e.finishing_position || 0;
    const name = carToDriver(e.car_number || "", e.driver_first_name || "", e.driver_last_name || "");
    if (!stageMap[name]) stageMap[name] = {};
    stageMap[name][`stage${sn}`] = pos;
    if (pos === 1) stageMap[name][`stageWin${sn}`] = true;
  });
  return stageMap;
}

export async function fetchNASCARResults(week) {
  const raceId = await getCacherRaceId(week);
  const data = await tryFetch(cacherUrl(`/2026/1/${raceId}/weekend-feed.json`));
  if (!data) return { ok: false, error: `No post-race data for Week ${week} (ID ${raceId}).` };
  const raceResults = data?.race_results || [];
  if (!raceResults.length) return { ok: false, error: "Race results not available yet." };

  const stageMap = parseStages(data);
  const lapsLedTotals = {};
  (data?.lead_changes || []).forEach(lc => {
    const n = carToDriver(lc.car_number || "", lc.driver_first_name || "", lc.driver_last_name || "");
    lapsLedTotals[n] = (lapsLedTotals[n] || 0) + (lc.laps_led || 0);
  });

  let mostLapsLedDriver = null, maxLL = 0;
  const drivers = raceResults.map(r => {
    const name = carToDriver(r.car_number || "", r.driver_first_name || "", r.driver_last_name || "");
    const finish = parseInt(r.finishing_position || 0), start = parseInt(r.starting_position || 0);
    const lapsLed = lapsLedTotals[name] || parseInt(r.Laps_Led || 0);
    const status = (r.status || "").toLowerCase();
    const dnf = status === "out" || status.includes("accident");
    const dq = status.includes("dq");
    if (lapsLed > maxLL) { maxLL = lapsLed; mostLapsLedDriver = name; }
    const stages = stageMap[name] || {};
    return {
      name, finish, qualPos: start, lapsLed,
      stage1: stages.stage1 || 0, stage2: stages.stage2 || 0, stage3: stages.stage3 || 0,
      pole: start === 1, stageWin1: !!stages.stageWin1, stageWin2: !!stages.stageWin2,
      stageWin3: !!stages.stageWin3, fastestLap: false, mostLapsLed: false, dnf, dq,
    };
  }).filter(d => d.finish > 0).sort((a, b) => a.finish - b.finish);

  if (mostLapsLedDriver) { const d = drivers.find(x => x.name === mostLapsLedDriver); if (d) d.mostLapsLed = true; }
  const threeStages = (data?.weekend_stage_results || []).some(s => s.stage_number >= 3);
  return {
    ok: true, drivers, threeStages,
    raceName: data?.race_name || `Week ${week}`, trackName: data?.track_name || "",
    poleSitter: drivers.find(d => d.pole)?.name || null, mostLapsLedDriver, driverCount: drivers.length,
    note: `✓ ${drivers.length} drivers loaded. Enter fastest lap manually before scoring.`,
    source: "NASCAR Cacher",
  };
}

// ─── DRIVER PROJECTIONS (SportsDataIO via proxy) ─────────────────────────────

export async function fetchDriverProjections(week) {
  const race = await getSportsDataRace(week);
  if (!race) {
    return { ok: false, error: "Could not reach SportsDataIO. Check that Vercel is deployed with the latest api/nascar.js.", apiWorking: false };
  }

  const raceId = race.RaceID || race.RaceId;
  const projections = await tryFetch(sdUrl(`/DriverRaceProjections/${raceId}`));

  if (!projections || !Array.isArray(projections) || projections.length === 0) {
    return {
      ok: false,
      error: `No projections available for Week ${week} yet — they usually post Thursday or Friday before the race.`,
      apiWorking: true,
      raceName: race.Name || `Week ${week}`,
      raceId,
    };
  }

  const drivers = projections
    .filter(p => (p.ProjectedFantasyPoints || 0) > 0)
    .map(p => {
      const carNo = String(p.Number || p.CarNumber || "");
      const name = carToDriver(carNo, p.FirstName || "", p.LastName || "");
      return {
        name, carNo,
        projectedPts: Math.round((p.ProjectedFantasyPoints || 0) * 10) / 10,
        projectedStart: p.ProjectedStartPosition || p.StartPosition || 0,
        projectedFinish: p.ProjectedFinishPosition || 0,
        projectedLapsLed: Math.round(p.ProjectedLapsLed || 0),
      };
    })
    .sort((a, b) => b.projectedPts - a.projectedPts);

  return {
    ok: true, apiWorking: true, drivers,
    raceName: race.Name || `Week ${week}`, trackName: race.Track || "",
    raceId, source: "SportsDataIO",
  };
}
