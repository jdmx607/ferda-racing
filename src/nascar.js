// NASCAR Data Service
// Uses the free cf.nascar.com/cacher JSON feeds — no API key required.
// Field names and race IDs verified against the live feed.

const CACHER_BASE = "https://cf.nascar.com/cacher/2026";
const PROXY_BASE = "/api/nascar"; // Vercel serverless CORS proxy

// Confirmed race IDs for 2026 Cup Series (series_id = 1)
// Verified against live feed by the API integration chat
const RACE_IDS = {
  1: 5596,   // Daytona 500
  2: 5597,   // Atlanta
  3: 5598,   // COTA
  4: 5599,   // Phoenix
  5: 5600,   // Las Vegas
  6: 5603,   // Darlington
  7: 5602,   // Martinsville
  8: 5604,   // Bristol
  9: 5607,   // Kansas
  10: 5605,  // Talladega
  11: 5606,  // Texas (race_id assigned as Dover slot but ran at Texas)
  12: 5621,  // Watkins Glen
  13: 5610,  // Charlotte
  // Weeks 14-36: will be fetched dynamically from schedule endpoint
};

// Map NASCAR car numbers → FERDA driver name format
function carToDriver(carNo, firstName, lastName) {
  const num = String(parseInt(carNo) || carNo).replace(/^0+/, "") || carNo;
  const specials = {
    "33": "#33 Austin Hill / Will Brown",
    "66": "#66 Various",
    "78": "#78 BJ McLeod",
  };
  if (specials[num]) return specials[num];
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return `#${num} ${name}`;
}

async function tryFetch(url) {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return null;
  }
}

// Get race ID for a given week — uses hardcoded map first, falls back to schedule
async function getRaceId(week) {
  if (RACE_IDS[week]) return RACE_IDS[week];
  // Try schedule endpoint for weeks beyond 13
  const schedule = await tryFetch(`${CACHER_BASE}/race_list_basic.json`)
    || await tryFetch(`${PROXY_BASE}?path=/2026/race_list_basic.json`);
  if (schedule?.series_1) {
    // Filter out exhibition races (race_type_id: 2)
    const pointsRaces = schedule.series_1.filter(r => r.race_type_id !== 2);
    const race = pointsRaces[week - 1];
    if (race?.race_id) return race.race_id;
  }
  return week; // fallback: use week number as race ID
}

// Parse stage results from the feed
function parseStages(weekendData) {
  // Confirmed field: weekend_stage_results with stage_number
  const stageResults = weekendData?.weekend_stage_results || weekendData?.StageResults || [];
  const stageMap = {}; // { driverName: { stage1, stage2, stage3, stageWin1, stageWin2, stageWin3 } }
  const stageWinners = {};

  stageResults.forEach(entry => {
    const stageNum = entry.stage_number || entry.StageNumber || 1;
    const pos = entry.finishing_position || entry.RunningPos || 0;
    const car = entry.car_number || entry.CarNo || "";
    const first = entry.driver_first_name || entry.FirstName || "";
    const last = entry.driver_last_name || entry.LastName || "";
    const name = carToDriver(car, first, last);

    if (!stageMap[name]) stageMap[name] = {};
    stageMap[name][`stage${stageNum}`] = pos;
    if (pos === 1) {
      stageMap[name][`stageWin${stageNum}`] = true;
      stageWinners[stageNum] = name;
    }
  });

  return { stageMap, stageWinners };
}

// Main export: fetch and transform NASCAR feed for a given week
export async function fetchNASCARResults(week) {
  const raceId = await getRaceId(week);
  const feedUrl = `${CACHER_BASE}/1/${raceId}/weekend-feed.json`;
  const proxyUrl = `${PROXY_BASE}?path=/2026/1/${raceId}/weekend-feed.json`;

  const data = await tryFetch(feedUrl) || await tryFetch(proxyUrl);

  if (!data) {
    return {
      ok: false,
      error: `Could not load data for Week ${week} (race ID ${raceId}). Race may not have run yet or the feed may be unavailable.`,
    };
  }

  // Confirmed field names from feed verification
  const raceResults = data?.race_results || data?.RaceResults || [];

  if (!raceResults.length) {
    return {
      ok: false,
      error: `Feed loaded but no results found for Week ${week}. Race may still be in progress.`,
    };
  }

  const { stageMap, stageWinners } = parseStages(data);
  const totalLaps = data?.number_of_race_laps || data?.TotalLaps || 0;

  // Build laps led totals from lead changes
  const lapsLedTotals = {};
  (data?.lead_changes || []).forEach(lc => {
    const car = lc.car_number || lc.CarNo || "";
    const first = lc.driver_first_name || lc.FirstName || "";
    const last = lc.driver_last_name || lc.LastName || "";
    const name = carToDriver(car, first, last);
    const laps = lc.laps_led || lc.LapsLed || 0;
    lapsLedTotals[name] = (lapsLedTotals[name] || 0) + laps;
  });

  let mostLapsLedDriver = null;
  let maxLapsLed = 0;

  const drivers = raceResults.map(r => {
    // Confirmed field names
    const carNo = r.car_number || r.CarNo || r.Number || "";
    const first = r.driver_first_name || r.FirstName || "";
    const last = r.driver_last_name || r.LastName || "";
    const name = carToDriver(carNo, first, last);

    const finish = parseInt(r.finishing_position || r.RunningPos || 0);
    const start = parseInt(r.starting_position || r.StartPos || 0);
    const lapsLed = lapsLedTotals[name] || parseInt(r.Laps_Led || r.LapsLed || 0);
    const status = (r.status || r.Status || "").toLowerCase();
    const lapsComp = parseInt(r.laps_completed || r.Laps || 0);
    const dnf = status === "out" || status.includes("accident") || status.includes("engine")
      || (totalLaps > 0 && lapsComp < totalLaps * 0.5 && status !== "running");
    const dq = status.includes("dq") || status.includes("disqualified");
    const ineligible = r.points_eligible === false || r.Ineligible === true;

    if (start === 1) { /* pole flagged below */ }
    if (lapsLed > maxLapsLed) { maxLapsLed = lapsLed; mostLapsLedDriver = name; }

    const stages = stageMap[name] || {};

    return {
      name, finish, qualPos: start, lapsLed,
      stage1: stages.stage1 || 0,
      stage2: stages.stage2 || 0,
      stage3: stages.stage3 || 0,
      pole: start === 1,
      stageWin1: !!stages.stageWin1,
      stageWin2: !!stages.stageWin2,
      stageWin3: !!stages.stageWin3,
      fastestLap: false, // NOT in feed — enter manually
      mostLapsLed: false, // set after loop
      dnf, dq, ineligible,
    };
  }).filter(d => d.finish > 0).sort((a, b) => a.finish - b.finish);

  // Flag most laps led
  if (mostLapsLedDriver) {
    const d = drivers.find(x => x.name === mostLapsLedDriver);
    if (d) d.mostLapsLed = true;
  }

  const numStages = Object.keys(stageWinners).length;
  const threeStages = numStages >= 3;
  const raceName = data?.race_name || `Week ${week}`;
  const trackName = data?.track_name || "";

  return {
    ok: true, drivers, threeStages, raceName, trackName,
    stageWinners,
    poleSitter: drivers.find(d => d.pole)?.name || null,
    mostLapsLedDriver,
    driverCount: drivers.length,
    note: `✓ ${drivers.length} drivers loaded. Fastest lap not in feed — check manually before scoring.`,
  };
}

// Check current race status from the feed
export async function getRaceStatus() {
  const data = await tryFetch(`${CACHER_BASE}/race_list/latest_completed.json`)
    || await tryFetch(`${PROXY_BASE}?path=/2026/race_list/latest_completed.json`);
  if (!data) return { status: "unknown", latestRace: 0 };
  const raceNo = data?.race_no || data?.RaceNo || 0;
  return { status: "ok", latestRace: raceNo };
}

// Live polling: fetch in-progress race data (positions may be provisional)
export async function fetchLiveRaceData(week) {
  const result = await fetchNASCARResults(week);
  result.isLive = true;
  result.fetchTime = new Date().toISOString();
  return result;
}
