// NASCAR Data Service
// ALL external calls route through /api/nascar (Vercel proxy)

const PROXY = "/api/nascar";

// Basic fetch — returns null on any failure
async function tryFetch(url) {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch { return null; }
}

// Diagnostic fetch — returns { ok, data, status, errorBody } so we can surface real errors
async function diagFetch(url) {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    let body;
    try { body = await res.json(); } catch { body = null; }
    if (!res.ok) return { ok: false, status: res.status, errorBody: body, data: null };
    return { ok: true, status: res.status, data: body, errorBody: null };
  } catch (e) {
    return { ok: false, status: 0, errorBody: null, data: null, networkError: e.message };
  }
}

function sdUrl(path) {
  return `${PROXY}?source=sportsdata&path=${encodeURIComponent(path)}`;
}
function cacherUrl(path) {
  return `${PROXY}?path=${encodeURIComponent(path)}`;
}
// Live feeds: cf.nascar.com/live/feeds/* (updated every second during a race)
function liveUrl(path) {
  return `${PROXY}?source=nascar-live&path=${encodeURIComponent(path)}`;
}

function carToDriver(carNo, firstName, lastName) {
  const raw = String(carNo || "");
  const num = raw.replace(/^0+/, "") || raw;
  const specials = {
    "33":"#33 Austin Hill / Jesse Love","66":"#66 Various",
    "78":"#78 BJ McLeod / Daniel Dye / Katherine Legge",
  };
  if (raw === "01" || raw === "001") return "#01 Corey LaJoie";
  if (specials[num]) return specials[num];
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return `#${num} ${name}`;
}

// ─── PROJECTIONS (SportsDataIO via proxy) ────────────────────────────────────

export async function fetchDriverProjections(week) {
  // Step 1: Get 2026 race schedule
  const schedResult = await diagFetch(sdUrl("/Races/2026"));

  if (!schedResult.ok) {
    // Build a helpful message showing exactly what failed
    let detail = "";
    if (schedResult.networkError) {
      detail = `Network error: ${schedResult.networkError}`;
    } else if (schedResult.status === 401 || schedResult.status === 403) {
      detail = `API key rejected (HTTP ${schedResult.status}). The SportsDataIO trial may have expired or the key may not cover NASCAR. Log in to sportsdata.io and check your subscription.`;
    } else if (schedResult.status === 404) {
      detail = `Endpoint not found (HTTP 404). The API URL may have changed.`;
    } else if (schedResult.errorBody?.error) {
      detail = `Proxy error: ${schedResult.errorBody.error}`;
    } else {
      detail = `HTTP ${schedResult.status || "unknown"} from SportsDataIO.`;
    }
    return { ok: false, apiWorking: false, error: detail };
  }

  const races = schedResult.data;
  if (!Array.isArray(races)) {
    return { ok: false, apiWorking: true, error: "SportsDataIO returned unexpected data format for race schedule." };
  }

  // Step 2: Find the Cup race for this week
  const cup = races
    .filter(r => r.PointsRace !== false &&
      (r.SeriesID === 100 || r.SeriesID === 1 || String(r.Series || "").includes("Cup")))
    .sort((a, b) => new Date(a.Day || a.Date || 0) - new Date(b.Day || b.Date || 0));

  const race = cup[week - 1];
  if (!race) {
    return {
      ok: false, apiWorking: true,
      error: `No Cup Series race found for Week ${week}. Schedule returned ${races.length} total races, ${cup.length} Cup races.`,
    };
  }

  const raceId = race.RaceID || race.RaceId;

  // Step 3: Fetch projections for this race
  const projResult = await diagFetch(sdUrl(`/DriverRaceProjections/${raceId}`));

  if (!projResult.ok) {
    if (projResult.status === 404) {
      return {
        ok: false, apiWorking: true,
        error: `No projections yet for Week ${week} (${race.Name}, race ID ${raceId}). They typically post Thu/Fri before the race.`,
        raceName: race.Name, raceId,
      };
    }
    return {
      ok: false, apiWorking: true,
      error: `Projections request failed (HTTP ${projResult.status}). ${projResult.errorBody?.error || ""}`,
      raceName: race.Name, raceId,
    };
  }

  const projections = projResult.data;
  if (!Array.isArray(projections) || projections.length === 0) {
    return {
      ok: false, apiWorking: true,
      error: `Projections not available yet for ${race.Name} (race ID ${raceId}).`,
      raceName: race.Name, raceId,
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

// ─── LIVE DATA (SportsDataIO via proxy) ─────────────────────────────────────

async function getSportsDataRace(week) {
  const data = await tryFetch(sdUrl("/Races/2026"));
  if (!data || !Array.isArray(data)) return null;
  const cup = data
    .filter(r => r.PointsRace !== false &&
      (r.SeriesID === 100 || r.SeriesID === 1 || String(r.Series || "").includes("Cup")))
    .sort((a, b) => new Date(a.Day || a.Date || 0) - new Date(b.Day || b.Date || 0));
  return cup[week - 1] || null;
}

export async function fetchLiveRaceData(week) {
  // Try SportsDataIO first (real-time, 30s updates) — requires paid Discovery Lab key
  const sdResult = await diagFetch(sdUrl("/Races/2026"));
  if (sdResult.ok && Array.isArray(sdResult.data)) {
    const cup = sdResult.data
      .filter(r => r.PointsRace !== false &&
        (r.SeriesID===100||r.SeriesID===1||String(r.Series||"").includes("Cup")))
      .sort((a,b)=>new Date(a.Day||a.Date||0)-new Date(b.Day||b.Date||0));
    const race = cup[week-1];
    if (race) {
      const raceId = race.RaceID||race.RaceId;
      const resultsResult = await diagFetch(sdUrl(`/RaceResults/${raceId}`));
      if (resultsResult.ok) {
        const raceObj = Array.isArray(resultsResult.data) ? resultsResult.data[0] : resultsResult.data;
        const rawResults = raceObj?.DriverRaceResults||raceObj?.Results||[];
        if (rawResults.length) {
          let mostLapsLedName=null, maxLaps=0;
          const drivers = rawResults.map(r=>{
            const carNo=String(r.Number||r.CarNumber||"");
            const fullName=r.Name||r.Driver||"";
            const parts=fullName.trim().split(" ");
            const name=carToDriver(carNo,parts.slice(0,-1).join(" "),parts[parts.length-1]||"");
            const finish=parseInt(r.FinishPosition||r.Position||0);
            const start=parseInt(r.StartPosition||0);
            const lapsLed=parseInt(r.LapsLed||0);
            const status=(r.Status||"").toLowerCase();
            const dnf=status.includes("accident")||status.includes("engine")||status.includes("out");
            if(lapsLed>maxLaps){maxLaps=lapsLed;mostLapsLedName=name;}
            return { name,finish,qualPos:start,lapsLed,
              stage1:parseInt(r.Stage1FinishPosition||0), stage2:parseInt(r.Stage2FinishPosition||0), stage3:0,
              pole:start===1, stageWin1:parseInt(r.Stage1FinishPosition||0)===1,
              stageWin2:parseInt(r.Stage2FinishPosition||0)===1, stageWin3:false,
              fastestLap:false, mostLapsLed:false, dnf, dq:status.includes("dq") };
          }).filter(d=>d.finish>0).sort((a,b)=>a.finish-b.finish);
          if(mostLapsLedName){const d=drivers.find(x=>x.name===mostLapsLedName);if(d)d.mostLapsLed=true;}
          return { ok:true,drivers,threeStages:false,
            raceName:raceObj?.Name||race?.Name||`Week ${week}`,
            isLive:raceObj?.IsStarted&&!raceObj?.IsOver, isOver:!!raceObj?.IsOver,
            note:"Live · SportsDataIO · updates every 30s", source:"SportsDataIO" };
        }
      }
    }
  }

  // Fallback: NASCAR cacher feed — updates at stage breaks and race end (free, no key)
  const cacherRaceId = getCacherRaceId(week);
  if (!cacherRaceId) return { ok:false, error:"Race ID unknown for this week." };
  const data = await tryFetch(cacherUrl(`/2026/1/${cacherRaceId}/weekend-feed.json`));
  if (!data) return { ok:false, error:"No live data available. Race may not have started." };

  const raceResults = data?.race_results||[];
  if (!raceResults.length) return { ok:false, error:"Race hasn't started or data isn't available yet." };

  const stageMap = parseStages(data);
  const lapsLedTotals={};
  (data?.lead_changes||[]).forEach(lc=>{
    const n=carToDriver(lc.car_number||"",lc.driver_first_name||"",lc.driver_last_name||"");
    lapsLedTotals[n]=(lapsLedTotals[n]||0)+(lc.laps_led||0);
  });
  let mostLapsLedDriver=null,maxLL=0;
  const drivers=raceResults.map(r=>{
    const name=carToDriver(r.car_number||"",r.driver_first_name||"",r.driver_last_name||"");
    const finish=parseInt(r.finishing_position||0),start=parseInt(r.starting_position||0);
    const lapsLed=lapsLedTotals[name]||parseInt(r.Laps_Led||0);
    const status=(r.status||"").toLowerCase();
    if(lapsLed>maxLL){maxLL=lapsLed;mostLapsLedDriver=name;}
    const stages=stageMap[name]||{};
    return { name,finish,qualPos:start,lapsLed,
      stage1:stages.stage1||0,stage2:stages.stage2||0,stage3:stages.stage3||0,
      pole:start===1,stageWin1:!!stages.stageWin1,stageWin2:!!stages.stageWin2,
      stageWin3:!!stages.stageWin3,fastestLap:false,mostLapsLed:false,
      dnf:status==="out"||status.includes("accident"),dq:status.includes("dq") };
  }).filter(d=>d.finish>0).sort((a,b)=>a.finish-b.finish);
  if(mostLapsLedDriver){const d=drivers.find(x=>x.name===mostLapsLedDriver);if(d)d.mostLapsLed=true;}
  return { ok:true,drivers,threeStages:(data?.weekend_stage_results||[]).some(s=>s.stage_number>=3),
    raceName:data?.race_name||`Week ${week}`,isLive:true,
    note:"Stage-break updates via NASCAR.com (free) — upgrade to Discovery Lab for 30s live updates",
    source:"NASCAR Cacher" };
}

// ─── POST-RACE DATA (NASCAR cacher via proxy) ────────────────────────────────

// All 36 Cup Series points-race IDs for 2026, confirmed from
// https://cf.nascar.com/cacher/2026/race_list_basic.json (series_1, race_type_id=1)
const CACHER_RACE_IDS = {
   1:5596,  2:5597,  3:5598,  4:5599,  5:5600,  6:5603,  7:5602,  8:5604,
   9:5607, 10:5605, 11:5606, 12:5621, 13:5610, 14:5611, 15:5612, 16:5614,
  17:5613, 18:5617, 19:5616, 20:5615, 21:5618, 22:5619, 23:5620, 24:5622,
  25:5627, 26:5623, 27:5624, 28:5625, 29:5626, 30:5628, 31:5630, 32:5629,
  33:5633, 34:5631, 35:5632, 36:5601,
};

function getCacherRaceId(week) {
  return CACHER_RACE_IDS[week] ?? null;
}

export async function fetchLapTimes(week) {
  const raceId = getCacherRaceId(week);
  if (!raceId) return { ok:false, error:`Race ID not found for week ${week}` };
  const raw = await tryFetch(cacherUrl(`/2026/1/${raceId}/lap-times.json`));
  if (!raw?.laps) return { ok:false, error:"Lap time data not available yet." };
  return {
    ok: true,
    drivers: raw.laps.map(d => ({
      carNumber: d.Number,
      name:      d.FullName,
      make:      d.Manufacturer,
      finalPos:  d.RunningPos,
      laps: d.Laps
        .filter(l => l.LapTime != null && l.LapTime > 0)
        .map(l => ({ lap:l.Lap, time:l.LapTime, speed:parseFloat(l.LapSpeed)||0, pos:l.RunningPos })),
    })).sort((a, b) => a.finalPos - b.finalPos),
  };
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

// ── Live-feed post-race scoring ───────────────────────────────────────────────
// Uses three NASCAR live endpoints (no race ID needed — always current race):
//   live-feed.json       → positions, laps led, best lap times (1-second updates)
//   live-points.json     → is_fastest_lap_point, stage_N_winner flags
//   live-stage-points.json → stage finish positions per driver
//
// These are available IMMEDIATELY after the checkered flag, vs. weekend-feed
// which can take 30-60 min to populate.

const FLAG_NAMES = { 0:"None", 1:"Green", 2:"Yellow", 3:"Red", 4:"White", 5:"Checkered" };

export async function fetchPostRaceFromLive() {
  // Fetch all three live endpoints in parallel
  const [liveFeed, livePoints, stagePoints] = await Promise.all([
    tryFetch(liveUrl("live-feed.json")),
    tryFetch(liveUrl("live-points.json")),
    tryFetch(liveUrl("live-stage-points.json")),
  ]);

  // Guard: live feed must respond
  if (!liveFeed) return { ok: false, error: "NASCAR live feed is not responding. Check your connection or try again." };

  // Guard: must be a race session (not practice/qualifying)
  const runType = liveFeed.run_type;
  if (runType !== 3) {
    const types = { 1: "Practice", 2: "Qualifying" };
    return { ok: false, error: `Live feed shows a ${types[runType] || "non-race"} session ("${liveFeed.run_name}"), not a race. Try after the race starts.` };
  }

  // Guard: race must be finished.
  // flag_state 5 = checkered flag. However, NASCAR resets flag_state to 0 within a few
  // minutes of the checkered flag, while laps_to_go stays at 0. Accept either condition
  // so we can score immediately after the race even if the flag state has already reset.
  const flagState = liveFeed.flag_state;
  const lapsLeft  = liveFeed.laps_to_go ?? liveFeed.laps_remaining ?? null;
  const raceOver  = flagState === 5 || lapsLeft === 0;

  if (!raceOver) {
    return {
      ok: false,
      error: `Race still in progress — ${lapsLeft ?? "?"} laps to go · Flag: ${FLAG_NAMES[flagState] ?? flagState}`,
      raceInProgress: true,
      lapsToGo: lapsLeft,
      flagState,
    };
  }

  const vehicles    = liveFeed.vehicles    || [];
  const totalLaps   = liveFeed.lap_number  || 0;

  // ── Build car-number → standardised name map from live feed ───────────────
  const carMap = {};
  for (const v of vehicles) {
    const d = v.driver || {};
    carMap[String(v.vehicle_number)] = carToDriver(v.vehicle_number, d.first_name || "", d.last_name || "");
  }

  // ── Stage positions from live-stage-points ─────────────────────────────────
  // Shape: [{stage_number, results:[{position, vehicle_number, full_name}]}]
  const stagePosMap = {};   // name → { stage1, stage2, stage3 }
  if (Array.isArray(stagePoints)) {
    for (const stage of stagePoints) {
      const sn = stage.stage_number;
      for (const r of (stage.results || [])) {
        const name = carMap[String(r.vehicle_number)] || `#${r.vehicle_number} ${r.full_name || ""}`.trim();
        if (!stagePosMap[name]) stagePosMap[name] = {};
        stagePosMap[name][`stage${sn}`] = r.position || 0;
      }
    }
  }

  // ── Stage wins + fastest lap from live-points ──────────────────────────────
  // Shape: [{car_number, first_name, last_name, is_fastest_lap_point,
  //          stage_1_winner, stage_2_winner, stage_3_winner, ...}]
  const stageWinMap  = {};  // name → { stageWin1, stageWin2, stageWin3 }
  let   fastestLapDriver = null;
  let   threeStages = false;

  if (Array.isArray(livePoints)) {
    for (const p of livePoints) {
      const name = carToDriver(p.car_number, p.first_name || "", p.last_name || "");
      stageWinMap[name] = {
        stageWin1: !!p.stage_1_winner,
        stageWin2: !!p.stage_2_winner,
        stageWin3: !!p.stage_3_winner,
      };
      if (p.is_fastest_lap_point) fastestLapDriver = name;
      if ((p.stage_3_points ?? 0) > 0 || p.stage_3_winner) threeStages = true;
    }
  }

  // ── Build driver results from live feed ────────────────────────────────────
  let mostLapsLedDriver = null, maxLL = 0;

  const drivers = vehicles.map(v => {
    const d      = v.driver || {};
    const name   = carToDriver(v.vehicle_number, d.first_name || "", d.last_name || "");
    const finish = v.running_position  || 99;
    const start  = v.starting_position || 99;

    // Laps led: array of {start_lap, end_lap} segments
    const lapsLedArr = Array.isArray(v.laps_led) ? v.laps_led : [];
    const lapsLed    = lapsLedArr.reduce((sum, seg) =>
      sum + ((seg.end_lap || 0) - (seg.start_lap || 0) + 1), 0
    );

    if (lapsLed > maxLL) { maxLL = lapsLed; mostLapsLedDriver = name; }

    // DNF: not running (status !== 1) and significantly fewer laps than winner
    const dnf = v.status !== 1 && (v.laps_completed || 0) < totalLaps * 0.9;

    const stages = stagePosMap[name] || {};
    const wins   = stageWinMap[name] || {};

    return {
      name, finish, qualPos: start, lapsLed, dnf, dq: false,
      stage1: stages.stage1 || 0,
      stage2: stages.stage2 || 0,
      stage3: stages.stage3 || 0,
      pole:      start === 1,
      stageWin1: !!wins.stageWin1,
      stageWin2: !!wins.stageWin2,
      stageWin3: !!wins.stageWin3,
      fastestLap:  false,   // set below
      mostLapsLed: false,   // set below
      // Keep raw timing for fallback fastest-lap detection
      _bestLapTime:  v.best_lap_time  || 0,
      _bestLapSpeed: v.best_lap_speed || 0,
    };
  }).filter(d => d.finish > 0).sort((a, b) => a.finish - b.finish);

  // Guard: if the live feed cleared all positions post-race, don't return empty data.
  // The caller will fall through to the cacher or manual results.
  if (drivers.length === 0) {
    return { ok: false, error: "Live feed has no driver positions. Feed data may have cleared post-race — try the Cacher source." };
  }

  // Mark most laps led
  if (mostLapsLedDriver) {
    const d = drivers.find(x => x.name === mostLapsLedDriver);
    if (d) d.mostLapsLed = true;
  }

  // Mark fastest lap (live-points is authoritative; fall back to best_lap_time)
  let fastestLapAutoDetected = false;
  if (fastestLapDriver) {
    const d = drivers.find(x => x.name === fastestLapDriver);
    if (d) { d.fastestLap = true; fastestLapAutoDetected = true; }
  } else {
    // Fallback: driver with lowest best_lap_time (> 0)
    let bestTime = Infinity;
    for (const d of drivers) {
      if (d._bestLapTime > 0 && d._bestLapTime < bestTime) {
        bestTime = d._bestLapTime; fastestLapDriver = d.name;
      }
    }
    if (fastestLapDriver) {
      const d = drivers.find(x => x.name === fastestLapDriver);
      if (d) { d.fastestLap = true; fastestLapAutoDetected = true; }
    }
  }

  const stageWinners = [1, 2, ...(threeStages ? [3] : [])].map(n => ({
    stage: n, driver: drivers.find(d => d[`stageWin${n}`])?.name || null,
  }));

  return {
    ok: true,
    source:   "NASCAR Live Feed",
    drivers,
    threeStages,
    stageWinners,
    raceName:   liveFeed.run_name   || "Race",
    trackName:  liveFeed.track_name || "",
    winner:     drivers[0]?.name    || null,
    poleSitter: drivers.find(d => d.pole)?.name || null,
    mostLapsLedDriver,
    fastestLapDriver,
    fastestLapAutoDetected,
    driverCount: drivers.length,
    raceComplete: true,
    // Extra context for the UI
    totalLaps,
    raceId: liveFeed.race_id,
  };
}

// ── Fastest-lap auto-detection ────────────────────────────────────────────────
// The cacher exposes individual lap timing in a few possible shapes.
// We try all known field names; lower time wins, higher speed wins.
function detectFastestLapDriver(raceResults) {
  let fastestByTime = null, bestTime = Infinity;
  let fastestBySpeed = null, bestSpeed = 0;

  for (const r of raceResults) {
    // Lap-time fields (seconds — lower is better)
    const t = parseFloat(
      r.best_lap_time ?? r.bestLapTime ?? r.BestLapTime ??
      r.fastest_lap_time ?? r.fastestLapTime ?? 0
    );
    // Speed fields (MPH — higher is better)
    const s = parseFloat(
      r.best_lap_speed ?? r.bestLapSpeed ?? r.BestLapSpeed ??
      r.fastest_lap_speed ?? r.fastestLapSpeed ?? 0
    );

    if (t > 0 && t < bestTime) { bestTime = t; fastestByTime = r; }
    if (s > bestSpeed)          { bestSpeed = s; fastestBySpeed = r; }
  }

  const winner = fastestByTime ?? fastestBySpeed;
  if (!winner) return null;
  return carToDriver(winner.car_number ?? "", winner.driver_first_name ?? "", winner.driver_last_name ?? "");
}

// ── Manually-entered results for weeks where APIs were unavailable ─────────────
// Format matches live feed output. Add an entry here whenever both sources fail.
// Stage 1 Top 10: 45,54,77,9,23,38,5,17,35,7  Stage 2 Top 10: 9,43,7,5,24,20,77,11,22,38
// Laps led from official lead-changes: Elliott 67, Hamlin 40, Reddick 33, Hocevar 27,
//   Suarez 10, Byron 7, Gibbs 6, Larson 4, Wallace 3, Chastain 1.
const MANUAL_RESULTS = {
  15: {
    ok: true, source: "Manual Entry",
    raceName: "FireKeepers Casino 400", trackName: "Michigan International Speedway",
    winner: "#11 Denny Hamlin", poleSitter: "#11 Denny Hamlin",
    mostLapsLedDriver: "#9 Chase Elliott", fastestLapDriver: "#77 Carson Hocevar",
    fastestLapAutoDetected: true, threeStages: false, driverCount: 37, raceComplete: true,
    stageWinners: [
      { stage:1, driver:"#45 Tyler Reddick" },
      { stage:2, driver:"#9 Chase Elliott" },
    ],
    drivers: [
      {name:"#11 Denny Hamlin",       finish:1, qualPos:1,  stage1:0,  stage2:8,  lapsLed:40, pole:true,  stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
      {name:"#43 Erik Jones",         finish:2, qualPos:10, stage1:0,  stage2:2,  lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
      {name:"#23 Bubba Wallace",      finish:3, qualPos:13, stage1:5,  stage2:0,  lapsLed:3,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
      {name:"#5 Kyle Larson",         finish:4, qualPos:7,  stage1:7,  stage2:4,  lapsLed:4,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
      {name:"#77 Carson Hocevar",     finish:5, qualPos:2,  stage1:3,  stage2:7,  lapsLed:27, pole:false, stageWin1:false,stageWin2:false,fastestLap:true, mostLapsLed:false,dnf:false,dq:false},
      {name:"#7 Daniel Suarez",       finish:6, qualPos:11, stage1:10, stage2:3,  lapsLed:10, pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
      {name:"#22 Joey Logano",        finish:7, qualPos:18, stage1:0,  stage2:9,  lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
      {name:"#12 Ryan Blaney",        finish:8, qualPos:19, stage1:0,  stage2:0,  lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
      {name:"#17 Chris Buescher",     finish:9, qualPos:14, stage1:8,  stage2:0,  lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
      {name:"#19 Chase Briscoe",      finish:10,qualPos:5,  stage1:0,  stage2:0,  lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
      {name:"#2 Austin Cindric",      finish:11,qualPos:31, stage1:0,  stage2:0,  lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
      {name:"#41 Cole Custer",        finish:12,qualPos:15, stage1:0,  stage2:0,  lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
      {name:"#35 Riley Herbst",       finish:13,qualPos:12, stage1:9,  stage2:0,  lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
      {name:"#42 John Hunter Nemechek",finish:14,qualPos:17,stage1:0,  stage2:0,  lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
      {name:"#21 Josh Berry",         finish:15,qualPos:37, stage1:0,  stage2:0,  lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
      {name:"#1 Ross Chastain",       finish:16,qualPos:32, stage1:0,  stage2:0,  lapsLed:1,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
      {name:"#16 AJ Allmendinger",    finish:17,qualPos:25, stage1:0,  stage2:0,  lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
      {name:"#24 William Byron",      finish:18,qualPos:9,  stage1:0,  stage2:5,  lapsLed:7,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
      {name:"#48 Alex Bowman",        finish:19,qualPos:29, stage1:0,  stage2:0,  lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
      {name:"#33 Austin Hill / Jesse Love",finish:20,qualPos:28,stage1:0,stage2:0,lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
      {name:"#44 JJ Yeley / Joey Gase",finish:21,qualPos:36,stage1:0, stage2:0,  lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
      {name:"#34 Todd Gilliland",     finish:22,qualPos:35, stage1:0,  stage2:0,  lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
      {name:"#51 Cody Ware",          finish:23,qualPos:33, stage1:0,  stage2:0,  lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
      {name:"#10 Ty Dillon",          finish:24,qualPos:24, stage1:0,  stage2:0,  lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
      {name:"#54 Ty Gibbs",           finish:25,qualPos:4,  stage1:2,  stage2:0,  lapsLed:6,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
      {name:"#71 Michael McDowell",   finish:26,qualPos:20, stage1:0,  stage2:0,  lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:true, dq:false},
      {name:"#4 Noah Gragson",        finish:27,qualPos:22, stage1:0,  stage2:0,  lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:true, dq:false},
      {name:"#60 Ryan Preece",        finish:28,qualPos:27, stage1:0,  stage2:0,  lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:true, dq:false},
      {name:"#47 Ricky Stenhouse Jr", finish:29,qualPos:23, stage1:0,  stage2:0,  lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:true, dq:false},
      {name:"#97 Shane Van Gisbergen",finish:30,qualPos:30, stage1:0,  stage2:0,  lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:true, dq:false},
      {name:"#20 Christopher Bell",   finish:31,qualPos:8,  stage1:0,  stage2:6,  lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:true, dq:false},
      {name:"#9 Chase Elliott",       finish:32,qualPos:6,  stage1:4,  stage2:1,  lapsLed:67, pole:false, stageWin1:false,stageWin2:true, fastestLap:false,mostLapsLed:true, dnf:true, dq:false},
      {name:"#38 Zane Smith",         finish:33,qualPos:16, stage1:6,  stage2:10, lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:true, dq:false},
      {name:"#6 Brad Keselowski",     finish:34,qualPos:26, stage1:0,  stage2:0,  lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:true, dq:false},
      {name:"#45 Tyler Reddick",      finish:35,qualPos:3,  stage1:1,  stage2:0,  lapsLed:33, pole:false, stageWin1:true, stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:true, dq:false},
      {name:"#3 Austin Dillon",       finish:36,qualPos:21, stage1:0,  stage2:0,  lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:true, dq:false},
      {name:"#88 Connor Zilisch",     finish:37,qualPos:34, stage1:0,  stage2:0,  lapsLed:0,  pole:false, stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:true, dq:false},
    ],
  },
};

// ── fetchNASCARResults — try live feed first, fall back to weekend-feed ────────
// Strategy:
//   1. Hit live-feed.json. If race is over (flag_state=5) → use live data (fastest)
//   2. If race still in progress → return "in progress" error (don't try cacher)
//   3. If live feed is unavailable (no race active) → fall back to weekend-feed cacher
export async function fetchNASCARResults(week) {
  // ── Attempt 1: live feeds (immediate post-race data) ──────────────────────
  const liveResult = await fetchPostRaceFromLive();
  if (liveResult.ok) return liveResult;                         // ✓ race just ended, use this
  if (liveResult.raceInProgress) return liveResult;             // race not over yet, stop here

  // ── Attempt 2: weekend-feed cacher (populated 30-60 min after race) ───────
  const raceId = await getCacherRaceId(week);
  const data   = raceId ? await tryFetch(cacherUrl(`/2026/1/${raceId}/weekend-feed.json`)) : null;
  const raceResults = data?.race_results || [];

  if (!raceResults.length) {
    // ── Attempt 3: manually-entered results for specific weeks ───────────
    if (MANUAL_RESULTS[week]) return MANUAL_RESULTS[week];
    const why = raceId
      ? `no results in cacher (race ID ${raceId})`
      : `race ID not found for Week ${week}`;
    return {
      ok: false,
      error: `No post-race data available.\n\nLive feed: ${liveResult.error}\nCacher: ${why}.\n\nTry again in a few minutes, or use Manual Entry.`,
    };
  }

  const stageMap = parseStages(data);

  // Laps led from lead_changes array (more accurate than per-driver totals)
  const lapsLedTotals = {};
  (data?.lead_changes || []).forEach(lc => {
    const n = carToDriver(lc.car_number || "", lc.driver_first_name || "", lc.driver_last_name || "");
    lapsLedTotals[n] = (lapsLedTotals[n] || 0) + (lc.laps_led || 0);
  });

  let mostLapsLedDriver = null, maxLL = 0;
  const drivers = raceResults.map(r => {
    const name = carToDriver(r.car_number || "", r.driver_first_name || "", r.driver_last_name || "");
    const finish = parseInt(r.finishing_position || 0);
    const start  = parseInt(r.starting_position  || 0);
    const lapsLed = lapsLedTotals[name] || parseInt(r.Laps_Led || 0);
    const status  = (r.status || "").toLowerCase();
    const dnf = status === "out" || status.includes("accident");
    const dq  = status.includes("dq");
    if (lapsLed > maxLL) { maxLL = lapsLed; mostLapsLedDriver = name; }
    const stages = stageMap[name] || {};
    return {
      name, finish, qualPos: start, lapsLed,
      stage1: stages.stage1||0, stage2: stages.stage2||0, stage3: stages.stage3||0,
      pole: start === 1,
      stageWin1: !!stages.stageWin1, stageWin2: !!stages.stageWin2, stageWin3: !!stages.stageWin3,
      fastestLap: false, mostLapsLed: false, dnf, dq,
      // Preserve raw timing for debugging
      _rawBestLapTime:  r.best_lap_time  ?? r.bestLapTime  ?? null,
      _rawBestLapSpeed: r.best_lap_speed ?? r.bestLapSpeed ?? null,
    };
  }).filter(d => d.finish > 0).sort((a, b) => a.finish - b.finish);

  if (mostLapsLedDriver) {
    const d = drivers.find(x => x.name === mostLapsLedDriver);
    if (d) d.mostLapsLed = true;
  }

  // Auto-detect fastest lap — marks driver if timing data is available
  const fastestLapDriver = detectFastestLapDriver(raceResults);
  const fastestLapAutoDetected = !!fastestLapDriver;
  if (fastestLapDriver) {
    const d = drivers.find(x => x.name === fastestLapDriver);
    if (d) d.fastestLap = true;
  }

  const threeStages = (data?.weekend_stage_results || []).some(s => s.stage_number >= 3);
  const stageWinners = [1, 2, ...(threeStages ? [3] : [])].map(n => {
    const winner = drivers.find(d => d[`stageWin${n}`]);
    return { stage: n, driver: winner?.name || null };
  });

  return {
    ok: true, drivers, threeStages, stageWinners,
    raceName:    data?.race_name  || `Week ${week}`,
    trackName:   data?.track_name || "",
    poleSitter:  drivers.find(d => d.pole)?.name       || null,
    winner:      drivers.find(d => d.finish === 1)?.name || null,
    mostLapsLedDriver,
    fastestLapDriver,
    fastestLapAutoDetected,
    driverCount: drivers.length,
    source: "NASCAR Cacher",
  };
}
