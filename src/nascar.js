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

// Diagnostic fetch — returns full result including error details
async function diagFetch(url) {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    let body; try { body = await res.json(); } catch { body = null; }
    if (!res.ok) return { ok:false, status:res.status, errorBody:body, data:null };
    return { ok:true, status:res.status, data:body };
  } catch(e) {
    return { ok:false, status:0, data:null, networkError:e.message };
  }
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
  const cacherRaceId = await getCacherRaceId(week);
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
      stage1: stages.stage1||0, stage2: stages.stage2||0, stage3: stages.stage3||0,
      pole: start===1, stageWin1:!!stages.stageWin1, stageWin2:!!stages.stageWin2,
      stageWin3:!!stages.stageWin3, fastestLap:false, mostLapsLed:false, dnf, dq,
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
