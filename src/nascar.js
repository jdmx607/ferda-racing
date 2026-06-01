// NASCAR Data Service
// Live data: SportsDataIO (real-time, updates every 15-30s during races)
// Post-race data: cf.nascar.com/cacher (confirmed working, no key needed)

const SPORTSDATA_KEY = "bc0810a6cc664a83aa343c7ec4002b7e";
const SPORTSDATA_BASE = "https://api.sportsdata.io/v2/nascar/scores/json";
const CACHER_BASE = "https://cf.nascar.com/cacher/2026";
const PROXY_BASE = "/api/nascar";

// Hardcoded race IDs for post-race cacher fetch (weeks 1-13, verified)
const CACHER_RACE_IDS = {
  1:5596, 2:5597, 3:5598, 4:5599, 5:5600, 6:5603, 7:5602,
  8:5604, 9:5607, 10:5605, 11:5606, 12:5621, 13:5610,
};

async function tryFetch(url, opts={}) {
  try {
    const res = await fetch(url, { headers:{ Accept:"application/json" }, ...opts });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch { return null; }
}

// Map car number to FERDA driver format
function carToDriver(carNo, firstName, lastName) {
  const num = String(parseInt(carNo)||carNo).replace(/^0+/,"") || String(carNo);
  const specials = {
    "33":"#33 Austin Hill / Jesse Love","66":"#66 Various",
    "78":"#78 BJ McLeod / Daniel Dye / Katherine Legge",
    "1":"#1 Ross Chastain", // avoid #01 collision
  };
  // #01 is a separate car from #1
  if(String(carNo)==="01"||String(carNo)==="001") return "#01 Corey LaJoie";
  if(specials[num]) return specials[num];
  const name = [firstName,lastName].filter(Boolean).join(" ").trim();
  return `#${num} ${name}`;
}

// ─── LIVE DATA (SportsDataIO) ─────────────────────────────────────────────────
// Called every 30s during a live race via polling loop in App.jsx

export async function fetchLiveRaceData(week) {
  // Step 1: get all 2026 Cup races from SportsDataIO
  const races = await tryFetch(`${SPORTSDATA_BASE}/Races/2026?key=${SPORTSDATA_KEY}`);
  if (!races || !Array.isArray(races)) {
    return { ok:false, error:"SportsDataIO unreachable. Check API key or network." };
  }

  // Filter to Cup Series points races only (SeriesID 100 or 1 depending on version)
  // Sort by date, take the nth one for week
  const cup = races
    .filter(r => (r.SeriesID===100||r.SeriesID===1||String(r.Series||"").includes("Cup"))
      && r.PointsRace !== false)
    .sort((a,b)=> new Date(a.Day||a.Date||0) - new Date(b.Day||b.Date||0));

  const race = cup[week - 1];
  if (!race) return { ok:false, error:`No race data found for Week ${week}.` };

  const raceId = race.RaceID || race.RaceId;

  // Step 2: fetch live/final results for this race
  const data = await tryFetch(`${SPORTSDATA_BASE}/RaceResults/${raceId}?key=${SPORTSDATA_KEY}`);
  if (!data) return { ok:false, error:`Could not fetch results for race ID ${raceId}` };

  // SportsDataIO returns either a single object with DriverRaceResults or an array
  const raceObj = Array.isArray(data) ? data[0] : data;
  const rawResults = raceObj?.DriverRaceResults || raceObj?.Results || [];

  if (!rawResults.length) {
    return { ok:false, error:"No driver results in feed yet — race may not have started." };
  }

  let mostLapsLedName = null, maxLaps = 0;

  const drivers = rawResults.map(r => {
    const carNo = String(r.Number || r.CarNumber || r.Car || "");
    const fullName = r.Name || r.Driver || "";
    const parts = fullName.trim().split(" ");
    const first = parts.slice(0,-1).join(" ");
    const last = parts[parts.length-1]||"";
    const name = carToDriver(carNo, first, last);

    const finish = parseInt(r.FinishPosition || r.Position || 0);
    const start  = parseInt(r.StartPosition  || 0);
    const lapsLed = parseInt(r.LapsLed || 0);
    const status  = (r.Status||r.Reason||"").toLowerCase();
    const dnf = status.includes("accident")||status.includes("engine")||
                status.includes("crash")||status.includes("out");
    const dq = status.includes("dq")||status.includes("disqualified");

    if(lapsLed > maxLaps){ maxLaps=lapsLed; mostLapsLedName=name; }

    // Stage positions from SportsDataIO (may not always be present)
    const stage1 = parseInt(r.Stage1FinishPosition || r.Stage1Position || 0);
    const stage2 = parseInt(r.Stage2FinishPosition || r.Stage2Position || 0);

    return {
      name, finish, qualPos:start, lapsLed,
      stage1, stage2, stage3:0,
      pole: start===1,
      stageWin1: stage1===1,
      stageWin2: stage2===1,
      stageWin3: false,
      fastestLap: false, // not in live feed
      mostLapsLed: false, // set after loop
      dnf, dq,
    };
  }).filter(d=>d.finish>0).sort((a,b)=>a.finish-b.finish);

  if(mostLapsLedName){
    const d=drivers.find(x=>x.name===mostLapsLedName);
    if(d) d.mostLapsLed=true;
  }

  const isLive = raceObj?.IsStarted && !raceObj?.IsOver;
  const isOver = !!raceObj?.IsOver;
  const raceName = raceObj?.Name || race?.Name || `Week ${week}`;
  const trackName = raceObj?.Track || race?.Track || "";

  return {
    ok:true, drivers, threeStages:false, raceName, trackName,
    isLive, isOver, raceId,
    driverCount: drivers.length,
    note: isOver
      ? "Race complete. Fastest lap not in live feed — enter manually before final score."
      : `Live · ${drivers.length} drivers · updates every 30s`,
    source: "SportsDataIO",
  };
}

// ─── POST-RACE DATA (cacher) ──────────────────────────────────────────────────
// Called by the Commissioner "Fetch from NASCAR.com" button after the race ends

async function getCacherRaceId(week) {
  if(CACHER_RACE_IDS[week]) return CACHER_RACE_IDS[week];
  const schedule = await tryFetch(`${CACHER_BASE}/race_list_basic.json`)
    || await tryFetch(`${PROXY_BASE}?path=/2026/race_list_basic.json`);
  if(schedule?.series_1){
    const pts = schedule.series_1.filter(r=>r.race_type_id!==2);
    const r = pts[week-1];
    if(r?.race_id) return r.race_id;
  }
  return week;
}

function parseStages(weekendData){
  const stageResults = weekendData?.weekend_stage_results||[];
  const stageMap={};
  stageResults.forEach(e=>{
    const sn=e.stage_number||1; const pos=e.finishing_position||0;
    const car=e.car_number||""; const first=e.driver_first_name||""; const last=e.driver_last_name||"";
    const name=carToDriver(car,first,last);
    if(!stageMap[name])stageMap[name]={};
    stageMap[name][`stage${sn}`]=pos;
    if(pos===1)stageMap[name][`stageWin${sn}`]=true;
  });
  return stageMap;
}

export async function fetchNASCARResults(week) {
  const raceId = await getCacherRaceId(week);
  const data = await tryFetch(`${CACHER_BASE}/1/${raceId}/weekend-feed.json`)
    || await tryFetch(`${PROXY_BASE}?path=/2026/1/${raceId}/weekend-feed.json`);
  if(!data) return { ok:false, error:`No post-race data for Week ${week} (race ID ${raceId}).` };

  const raceResults = data?.race_results||[];
  if(!raceResults.length) return { ok:false, error:"Race results not available yet." };

  const stageMap=parseStages(data);
  const lapsLedTotals={};
  (data?.lead_changes||[]).forEach(lc=>{
    const n=carToDriver(lc.car_number||"",lc.driver_first_name||"",lc.driver_last_name||"");
    lapsLedTotals[n]=(lapsLedTotals[n]||0)+(lc.laps_led||0);
  });

  let mostLapsLedDriver=null, maxLL=0;

  const drivers=raceResults.map(r=>{
    const carNo=r.car_number||""; const first=r.driver_first_name||""; const last=r.driver_last_name||"";
    const name=carToDriver(carNo,first,last);
    const finish=parseInt(r.finishing_position||0); const start=parseInt(r.starting_position||0);
    const lapsLed=lapsLedTotals[name]||parseInt(r.Laps_Led||0);
    const status=(r.status||"").toLowerCase();
    const dnf=status==="out"||status.includes("accident");
    const dq=status.includes("dq");
    if(start===1){/* pole set below */}
    if(lapsLed>maxLL){maxLL=lapsLed;mostLapsLedDriver=name;}
    const stages=stageMap[name]||{};
    return { name,finish,qualPos:start,lapsLed,
      stage1:stages.stage1||0, stage2:stages.stage2||0, stage3:stages.stage3||0,
      pole:start===1, stageWin1:!!stages.stageWin1, stageWin2:!!stages.stageWin2,
      stageWin3:!!stages.stageWin3, fastestLap:false, mostLapsLed:false, dnf, dq };
  }).filter(d=>d.finish>0).sort((a,b)=>a.finish-b.finish);

  if(mostLapsLedDriver){const d=drivers.find(x=>x.name===mostLapsLedDriver);if(d)d.mostLapsLed=true;}
  const threeStages=(data?.weekend_stage_results||[]).some(s=>s.stage_number>=3);

  return {
    ok:true, drivers, threeStages,
    raceName:data?.race_name||`Week ${week}`,
    trackName:data?.track_name||"",
    poleSitter:drivers.find(d=>d.pole)?.name||null,
    mostLapsLedDriver, driverCount:drivers.length,
    note:`✓ ${drivers.length} drivers loaded. Enter fastest lap manually before scoring.`,
    source:"NASCAR Cacher",
  };
}

export async function getRaceStatus() {
  const data=await tryFetch(`${CACHER_BASE}/race_list/latest_completed.json`)
    ||await tryFetch(`${PROXY_BASE}?path=/2026/race_list/latest_completed.json`);
  return { status:data?"ok":"unknown", latestRace:data?.race_no||data?.RaceNo||0 };
}

// ─── DRIVER PROJECTIONS (SportsDataIO) ───────────────────────────────────────
// Pre-race projected fantasy stats for the upcoming race.
// Also doubles as an API connectivity test — if this returns data, live scoring will work.

export async function fetchDriverProjections(week) {
  // Get race ID for this week from SportsDataIO schedule
  const races = await tryFetch(`${SPORTSDATA_BASE}/Races/2026?key=${SPORTSDATA_KEY}`);
  if (!races || !Array.isArray(races)) {
    return { ok:false, error:"SportsDataIO unreachable — check API key or network.", apiWorking:false };
  }

  const cup = races
    .filter(r => (r.SeriesID===100||r.SeriesID===1||String(r.Series||"").includes("Cup")) && r.PointsRace!==false)
    .sort((a,b)=> new Date(a.Day||a.Date||0) - new Date(b.Day||b.Date||0));

  const race = cup[week - 1];
  if (!race) return { ok:false, error:`No race found for Week ${week}.`, apiWorking:true };

  const raceId = race.RaceID || race.RaceId;
  const projections = await tryFetch(`${SPORTSDATA_BASE}/DriverRaceProjections/${raceId}?key=${SPORTSDATA_KEY}`);

  if (!projections || !Array.isArray(projections)) {
    // Race may not have projections yet (too far out, or projections not released)
    return {
      ok:false,
      error:`No projections available for Week ${week} yet. They usually post 2-3 days before the race.`,
      apiWorking:true, // Schedule fetch worked, so API is live
      raceName: race.Name || `Week ${week}`,
      raceId,
    };
  }

  // Map SportsDataIO projections to something readable
  const drivers = projections
    .filter(p => p.ProjectedFantasyPoints > 0)
    .map(p => {
      const carNo = String(p.Number || p.CarNumber || "");
      const name = carToDriver(carNo, p.FirstName || "", p.LastName || "");
      return {
        name,
        carNo,
        projectedPts: Math.round((p.ProjectedFantasyPoints || 0) * 10) / 10,
        projectedStart: p.ProjectedStartPosition || p.StartPosition || 0,
        projectedFinish: p.ProjectedFinishPosition || 0,
        projectedLapsLed: Math.round(p.ProjectedLapsLed || 0),
        driverName: `${p.FirstName||""} ${p.LastName||""}`.trim(),
      };
    })
    .sort((a, b) => b.projectedPts - a.projectedPts);

  return {
    ok: true,
    apiWorking: true,
    drivers,
    raceName: race.Name || `Week ${week}`,
    trackName: race.Track || "",
    raceId,
    source: "SportsDataIO",
  };
}
