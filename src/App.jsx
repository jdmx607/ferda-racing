import { useState, useEffect, useCallback, useMemo } from "react";
import { loadLeagueData, saveLeagueData, subscribeToLeagueData, loadLocalBackup, isFirebaseReady } from "./firebase";
import { HISTORICAL_PICKS, HISTORICAL_RESULTS } from "./historicalData";

const PLAYERS = [
  { id: "justin", name: "Justin", password: "ferda1" },
  { id: "bigmonroe", name: "Big Monroe", password: "ferda2" },
  { id: "monroe", name: "Monroe", password: "ferda3" },
  { id: "rich", name: "Rich", password: "ferda4" },
];
const PNAME = { justin:"Justin", bigmonroe:"Big Monroe", monroe:"Monroe", rich:"Rich" };
const FINISH_POINTS = {1:55,2:35,3:34,4:33,5:32,6:31,7:30,8:29,9:28,10:27,11:26,12:25,13:24,14:23,15:22,16:21,17:20,18:19,19:18,20:17,21:16,22:15,23:14,24:13,25:12,26:11,27:10,28:9,29:8,30:7,31:6,32:5,33:4,34:3,35:2,36:1,37:1,38:1,39:1,40:1};
const STAGE_POINTS = {1:10,2:9,3:8,4:7,5:6,6:5,7:4,8:3,9:2,10:1};
const TRACK_MULTS = { superspeedway:1.0, short_track:0.2, intermediate:0.5, road_course:1.5 };
const ACTIVE_PICKS = 5;
const PICKS_PER_WEEK = 6;
const MAX_MULLIGANS = 10;
const PLAYOFF_START_WEEK = 27;
const GARAGE_PICK_ENABLED = false;
const SCHEDULE = [
  {w:1,t:"Daytona",ty:"superspeedway",d:"Feb 15",r:"Daytona 500"},{w:2,t:"Atlanta",ty:"superspeedway",d:"Feb 22",r:"Autotrader 400"},
  {w:3,t:"COTA",ty:"road_course",d:"Mar 1",r:"DuraMAX Grand Prix"},{w:4,t:"Phoenix",ty:"short_track",d:"Mar 8",r:"Straight Talk 500"},
  {w:5,t:"Las Vegas",ty:"intermediate",d:"Mar 15",r:"Pennzoil 400"},{w:6,t:"Darlington",ty:"intermediate",d:"Mar 22",r:"Goodyear 400"},
  {w:7,t:"Martinsville",ty:"short_track",d:"Mar 29",r:"Cook Out 400"},{w:8,t:"Bristol",ty:"short_track",d:"Apr 12",r:"Food City 500"},
  {w:9,t:"Kansas",ty:"intermediate",d:"Apr 19",r:"AdventHealth 400"},{w:10,t:"Talladega",ty:"superspeedway",d:"Apr 26",r:"Jack Link's 500"},
  {w:11,t:"Texas",ty:"intermediate",d:"May 3",r:"Würth 400"},{w:12,t:"Watkins Glen",ty:"road_course",d:"May 10",r:"Go Bowling at The Glen"},
  {w:13,t:"Charlotte",ty:"intermediate",d:"May 24",r:"Coca-Cola 600"},{w:14,t:"Nashville",ty:"intermediate",d:"May 31",r:"Cracker Barrel 400"},
  {w:15,t:"Michigan",ty:"intermediate",d:"Jun 7",r:"FireKeepers Casino 400"},{w:16,t:"Pocono",ty:"intermediate",d:"Jun 14",r:"Great American Getaway 400"},
  {w:17,t:"San Diego",ty:"road_course",d:"Jun 21",r:"Anduril 250"},{w:18,t:"Sonoma",ty:"road_course",d:"Jun 28",r:"Toyota/Save Mart 350"},
  {w:19,t:"Chicagoland",ty:"intermediate",d:"Jul 5",r:"TBA"},{w:20,t:"Atlanta",ty:"superspeedway",d:"Jul 12",r:"Quaker State 400"},
  {w:21,t:"N. Wilkesboro",ty:"short_track",d:"Jul 19",r:"Window World 450"},{w:22,t:"Indianapolis",ty:"intermediate",d:"Jul 26",r:"Brickyard 400"},
  {w:23,t:"Iowa",ty:"short_track",d:"Aug 9",r:"Iowa Corn 350"},{w:24,t:"Richmond",ty:"short_track",d:"Aug 15",r:"Cook Out 400"},
  {w:25,t:"New Hampshire",ty:"short_track",d:"Aug 23",r:"Mobil 1 301"},{w:26,t:"Daytona",ty:"superspeedway",d:"Aug 29",r:"Coke Zero Sugar 400"},
  {w:27,t:"Darlington",ty:"intermediate",d:"Sep 6",r:"Cook Out Southern 500"},{w:28,t:"WWT Raceway",ty:"intermediate",d:"Sep 13",r:"Enjoy Illinois 300"},
  {w:29,t:"Bristol",ty:"short_track",d:"Sep 19",r:"Bass Pro Shops Night Race"},{w:30,t:"Kansas",ty:"intermediate",d:"Sep 27",r:"Hollywood Casino 400"},
  {w:31,t:"Las Vegas",ty:"intermediate",d:"Oct 4",r:"South Point 400"},{w:32,t:"Charlotte",ty:"intermediate",d:"Oct 11",r:"Bank of America 400"},
  {w:33,t:"Phoenix",ty:"short_track",d:"Oct 18",r:"Freeway Insurance 500"},{w:34,t:"Talladega",ty:"superspeedway",d:"Oct 25",r:"YellaWood 500"},
  {w:35,t:"Martinsville",ty:"short_track",d:"Nov 1",r:"Xfinity 500"},{w:36,t:"Homestead",ty:"intermediate",d:"Nov 8",r:"Straight Talk Wireless 400"},
];
const DRIVERS = [
  "#1 Ross Chastain","#2 Austin Cindric","#3 Austin Dillon","#4 Noah Gragson",
  "#5 Kyle Larson","#6 Brad Keselowski","#7 Daniel Suarez","#8 Kyle Busch",
  "#9 Chase Elliott","#10 Ty Dillon","#11 Denny Hamlin","#12 Ryan Blaney",
  "#16 AJ Allmendinger","#17 Chris Buescher","#19 Chase Briscoe","#20 Christopher Bell",
  "#21 Josh Berry","#22 Joey Logano","#23 Bubba Wallace","#24 William Byron",
  "#34 Todd Gilliland","#35 Riley Herbst","#38 Zane Smith",
  "#41 Cole Custer","#42 John Hunter Nemechek","#43 Erik Jones","#45 Tyler Reddick",
  "#47 Ricky Stenhouse Jr","#48 Alex Bowman","#51 Cody Ware","#54 Ty Gibbs",
  "#60 Ryan Preece","#71 Michael McDowell","#77 Carson Hocevar","#88 Connor Zilisch","#97 Shane Van Gisbergen",
  "#33 Austin Hill / Will Brown","#36 Chandler Smith","#40 Justin Allgaier",
  "#44 JJ Yeley","#50 Burt Myers","#62 Anthony Alfredo","#66 Various",
  "#67 Corey Heim","#78 BJ McLeod","#84 Jimmie Johnson","#99 Corey LaJoie",
];

function getDraftOrder(data, currentWeek) {
  const prev = data.results?.["w" + (currentWeek - 1)];
  if (!prev?.scored) return PLAYERS.map(p => p.id);
  return PLAYERS.map(p => ({ id: p.id, score: prev.scored[p.id]?.total || 0 }))
    .sort((a, b) => a.score - b.score).map(s => s.id);
}
function buildSnakeOrder(order) {
  const seq = [];
  const rounds = GARAGE_PICK_ENABLED ? PICKS_PER_WEEK : ACTIVE_PICKS;
  for (let r = 0; r < rounds; r++) { order.forEach(pid => seq.push({ pid, round: r + 1 })); }
  return seq;
}

function buildInitialData() {
  const results = {}, picks = {};
  for (let w = 1; w <= 10; w++) {
    const key = "w" + w;
    const rawResult = HISTORICAL_RESULTS[key];
    const weekPicks = HISTORICAL_PICKS[key];
    if (!rawResult || !weekPicks) continue;
    results[key] = { raw: rawResult, scored: null };
    picks[key] = weekPicks;
  }
  return scoreAllWeeks({
    results, picks, drafts: {},
    mulligans: { justin:[], bigmonroe:[], monroe:[], rich:[] },
    meta: { standings:{justin:0,bigmonroe:0,monroe:0,rich:0}, playoffPts:{justin:0,bigmonroe:0,monroe:0,rich:0},
      mulligansUsed:{justin:0,bigmonroe:0,monroe:1,rich:0}, lastScoredWeek:10 },
  });
}

function scoreAllWeeks(data) {
  const d = JSON.parse(JSON.stringify(data));
  const fs={justin:0,bigmonroe:0,monroe:0,rich:0}, fp={justin:0,bigmonroe:0,monroe:0,rich:0};
  let last = 0;
  Object.entries(d.results||{}).forEach(([key, wr]) => {
    const w = parseInt(key.replace("w","")); if (!wr.raw?.drivers) return;
    const wp = d.picks?.[key] || {};
    const mo = {}; PLAYERS.forEach(p => { mo[p.id] = (wp[p.id]||[]).filter(pk=>pk.mulligan).map(pk=>({week:w,driver:pk.driver})); });
    const scored = scoreWeekFull(wp, wr.raw, w, mo);
    d.results[key].scored = scored; if (w > last) last = w;
    Object.entries(scored).forEach(([pid, s]) => {
      fs[pid] = Math.round((fs[pid] + s.total) * 100) / 100;
      fp[pid] = Math.round((fp[pid] + (s.bonusPoints||0)) * 100) / 100;
      if (s.weeklyWin) fp[pid] = Math.round((fp[pid] + 25) * 100) / 100;
    });
  });
  const mc={justin:0,bigmonroe:0,monroe:0,rich:0};
  Object.entries(d.picks||{}).forEach(([,wp]) => { Object.entries(wp).forEach(([pid,pks]) => { (pks||[]).forEach(pk => { if(pk.mulligan) mc[pid]++; }); }); });
  d.meta = { standings:fs, playoffPts:fp, mulligansUsed:mc, lastScoredWeek:last };
  return d;
}

function calcDriverScore(driver, trackType, isMulligan) {
  let score = 0; const bd = []; const mult = TRACK_MULTS[trackType] || 0.5;
  if (driver.dnf) { return driver.dq ? {total:-5,breakdown:[{label:"DQ",pts:-5}],bonusPoints:0} : {total:0,breakdown:[{label:"DNF",pts:0}],bonusPoints:0}; }
  const fp = FINISH_POINTS[driver.finish] || 1; score += fp; bd.push({label:"P"+driver.finish,pts:fp});
  if (isMulligan) { bd.push({label:"Mulligan",pts:0}); return {total:score,breakdown:bd,bonusPoints:0}; }
  if (driver.finish <= 5) { score+=2; bd.push({label:"Top 5",pts:2}); } else if (driver.finish <= 10) { score+=1; bd.push({label:"Top 10",pts:1}); }
  if (driver.stage1 > 0 && driver.stage1 <= 10) { const sp=STAGE_POINTS[driver.stage1]; score+=sp; bd.push({label:"S1:P"+driver.stage1,pts:sp}); }
  if (driver.stage2 > 0 && driver.stage2 <= 10) { const sp=STAGE_POINTS[driver.stage2]; score+=sp; bd.push({label:"S2:P"+driver.stage2,pts:sp}); }
  if (driver.lapsLed > 0) { const lp=Math.round(driver.lapsLed*mult*10)/10; score+=lp; bd.push({label:driver.lapsLed+"laps*"+mult,pts:lp}); score+=0.5; bd.push({label:"Led a lap",pts:0.5}); }
  if (driver.qualPos && driver.finish) { let net=driver.qualPos-driver.finish; net=Math.max(-10,Math.min(10,net)); if(net!==0){score+=net;bd.push({label:"Net Q"+driver.qualPos+">P"+driver.finish,pts:net});} }
  let bp = 0;
  if (driver.pole) { score+=5; bp+=5; bd.push({label:"Pole",pts:5}); }
  if (driver.stageWin1) { score+=2.5; bp+=2.5; bd.push({label:"S1 Win",pts:2.5}); }
  if (driver.stageWin2) { score+=2.5; bp+=2.5; bd.push({label:"S2 Win",pts:2.5}); }
  if (driver.fastestLap) { score+=1; bp+=1; bd.push({label:"Fast Lap",pts:1}); }
  if (driver.mostLapsLed) { score+=5; bp+=5; bd.push({label:"Most Led",pts:5}); }
  if (driver.pole && driver.stageWin1 && driver.stageWin2) { score+=12.5; bp+=12.5; bd.push({label:"SWEEP!",pts:12.5}); }
  return { total:Math.round(score*100)/100, breakdown:bd, bonusPoints:bp };
}

function scoreWeekFull(picks, raceResult, week, mullData) {
  const ty = SCHEDULE.find(s => s.w === week)?.ty || "intermediate";
  const ps = {};
  PLAYERS.forEach(p => {
    const allPicks = picks[p.id] || [];
    const activePicks = allPicks.filter(pk => !pk.garage);
    const garagePick = allPicks.find(pk => pk.garage);
    let finalPicks = [...activePicks];
    if (garagePick?.garageActivated && garagePick.garageReplace) {
      finalPicks = finalPicks.filter(pk => pk.driver !== garagePick.garageReplace);
      finalPicks.push({driver:garagePick.driver, mulligan:false, garageUsed:true});
    }
    let wt=0, wb=0; const ds=[];
    finalPicks.forEach(pick => {
      const r = raceResult.drivers?.find(d => d.name === pick.driver); if (!r) return;
      const im = pick.mulligan || (!pick.garageUsed && mullData?.[p.id]?.some(m => m.week === week && m.driver === pick.driver));
      const sc = calcDriverScore(r, ty, im);
      wt += sc.total; wb += sc.bonusPoints;
      ds.push({driver:pick.driver, total:sc.total, breakdown:sc.breakdown, bonusPoints:sc.bonusPoints, isMulligan:!!im, isGarage:!!pick.garageUsed});
    });
    ps[p.id] = { total:Math.round(wt*100)/100, bonusPoints:Math.round(wb*100)/100, drivers:ds, weeklyWin:false };
  });
  let mx=-Infinity, wn=null;
  Object.entries(ps).forEach(([id,s]) => { if(s.total>mx){mx=s.total;wn=id;} });
  if (wn) ps[wn].weeklyWin = true;
  return ps;
}

const C = {bg:"#0a0e17",card:"#111827",accent:"#f59e0b",green:"#10b981",red:"#ef4444",blue:"#3b82f6",purple:"#8b5cf6",text:"#f1f5f9",dim:"#94a3b8",border:"#1e293b",input:"#0f172a"};
// Player colors: {bg, fg} for badges/cards
const PClr = {
  justin:{bg:"#000000",fg:"#CFC493"},
  bigmonroe:{bg:"#FFFFFF",fg:"#000000"},
  monroe:{bg:"#046A38",fg:"#91999F"},
  rich:{bg:"#AA0000",fg:"#B3995D"},
};
const PC = {justin:PClr.justin.fg,bigmonroe:"#3b82f6",monroe:PClr.monroe.fg,rich:PClr.rich.fg};
const TTC = {superspeedway:C.blue,short_track:C.red,intermediate:C.accent,road_course:C.green};
const TTL = {superspeedway:"SS",short_track:"ST",intermediate:"INT",road_course:"RC"};

function LoginScreen({onLogin}) {
  const [sel,setSel]=useState(null); const [pw,setPw]=useState(""); const [err,setErr]=useState("");
  const go=()=>{const p=PLAYERS.find(x=>x.id===sel);if(p&&pw===p.password)onLogin(p);else setErr("Wrong password");};
  return (<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,"+C.bg+" 0%,#111 50%,#1a1000 100%)"}}>
    <div style={{background:C.card,borderRadius:16,padding:"40px 32px",width:340,maxWidth:"90vw",border:"1px solid "+C.border,boxShadow:"0 25px 60px rgba(0,0,0,0.5)"}}>
      <div style={{textAlign:"center",marginBottom:32}}><div style={{fontFamily:"'Racing Sans One',cursive",fontSize:42,color:C.accent,letterSpacing:3}}>FERDA</div><div style={{color:C.dim,fontSize:13,letterSpacing:4,marginTop:4,textTransform:"uppercase"}}>Racing League</div></div>
      <div style={{color:C.dim,fontSize:12,marginBottom:8,textTransform:"uppercase",letterSpacing:2}}>Select Player</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>{PLAYERS.map(p=>(<button key={p.id} onClick={()=>{setSel(p.id);setErr("");}} style={{padding:"10px 0",borderRadius:8,border:"2px solid "+(sel===p.id?PClr[p.id].fg:C.border),background:sel===p.id?PClr[p.id].bg:C.input,color:sel===p.id?PClr[p.id].fg:C.dim,fontFamily:"inherit",fontSize:14,fontWeight:600,cursor:"pointer"}}>{p.name}</button>))}</div>
      {sel&&<><div style={{color:C.dim,fontSize:12,marginBottom:8,textTransform:"uppercase",letterSpacing:2}}>Password</div><input type="password" value={pw} onChange={e=>{setPw(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="Enter password" style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid "+C.border,background:C.input,color:C.text,fontSize:15,fontFamily:"inherit",outline:"none",boxSizing:"border-box",marginBottom:16}}/></>}
      {err&&<div style={{color:C.red,fontSize:13,marginBottom:12,textAlign:"center"}}>{err}</div>}
      <button onClick={go} disabled={!sel||!pw} style={{width:"100%",padding:"12px 0",borderRadius:8,border:"none",background:sel&&pw?C.accent:C.border,color:sel&&pw?"#000":C.dim,fontFamily:"'Oswald',sans-serif",fontSize:16,fontWeight:700,letterSpacing:2,textTransform:"uppercase",cursor:sel&&pw?"pointer":"default"}}>Enter Garage</button>
    </div></div>);
}

function Nav({player,tab,setTab,onLogout}) {
  const tabs=[{id:"standings",l:"Standings"},{id:"draft",l:"Draft"},{id:"results",l:"Results"},{id:"schedule",l:"Schedule"},{id:"mulligans",l:"Mulligans"},{id:"rules",l:"Rules"}];
  if(player.id==="justin") tabs.push({id:"commissioner",l:"Commish"});
  return (<nav style={{background:C.card,borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 12px",height:52,position:"sticky",top:0,zIndex:100,overflowX:"auto"}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontFamily:"'Racing Sans One',cursive",fontSize:20,color:C.accent,flexShrink:0}}>FERDA</span><div style={{display:"flex",gap:1}}>{tabs.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"7px 8px",borderRadius:6,border:"none",background:tab===t.id?C.accent+"22":"transparent",color:tab===t.id?C.accent:C.dim,fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:600,cursor:"pointer",letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap"}}>{t.l}</button>))}</div></div>
    <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}><span style={{color:C.dim,fontSize:11}}>{player.name}</span><button onClick={onLogout} style={{padding:"5px 8px",borderRadius:6,border:"1px solid "+C.border,background:"transparent",color:C.dim,fontFamily:"inherit",fontSize:10,cursor:"pointer"}}>Out</button></div>
  </nav>);
}

function StandingsTab({data}) {
  const standings=useMemo(()=>PLAYERS.map(p=>({...p,pts:data.meta.standings[p.id]||0,pp:data.meta.playoffPts[p.id]||0,wins:Object.values(data.results||{}).filter(r=>r.scored?.[p.id]?.weeklyWin).length})).sort((a,b)=>b.pts-a.pts),[data]);
  return (<div style={{padding:20,maxWidth:900,margin:"0 auto"}}>
    <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:4}}>Season Standings</h2>
    <div style={{color:C.dim,fontSize:13,marginBottom:20}}>{Object.keys(data.results||{}).length} of 36 races scored</div>
    <div style={{display:"grid",gap:12}}>{standings.map((p,i)=>(<div key={p.id} style={{background:C.card,borderRadius:12,padding:"16px 20px",border:"1px solid "+(i===0?C.accent+"55":C.border),display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}><div style={{width:38,height:38,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:PClr[p.id].bg,color:PClr[p.id].fg,fontWeight:700,fontSize:17,fontFamily:"'Oswald',sans-serif",border:"2px solid "+(PClr[p.id].bg==="#000000"?C.border:PClr[p.id].bg)}}>{i+1}</div><div><div style={{color:PClr[p.id].fg,fontWeight:700,fontSize:19,fontFamily:"'Barlow Condensed',sans-serif"}}>{p.name}</div><div style={{color:C.dim,fontSize:12}}>{p.wins} win{p.wins!==1?"s":""} · {p.pp} playoff pts</div></div></div>
      <div style={{textAlign:"right"}}><div style={{color:PClr[p.id].fg,fontFamily:"'Oswald',sans-serif",fontSize:30,fontWeight:700}}>{p.pts}</div><div style={{color:C.dim,fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Points</div></div>
    </div>))}</div></div>);
}

function DraftTab({player,data,onDraftPick,onUndoDraft,currentWeek}) {
  const [search,setSearch]=useState("");
  const [undoMsg,setUndoMsg]=useState("");
  const weekInfo=SCHEDULE.find(s=>s.w===currentWeek);
  const draftKey="w"+currentWeek;
  const draftOrder=useMemo(()=>getDraftOrder(data,currentWeek),[data,currentWeek]);
  const snakeSequence=useMemo(()=>buildSnakeOrder(draftOrder),[draftOrder]);
  const draftState=data.drafts?.[draftKey]||[];
  const currentPickNum=draftState.length;
  const draftComplete=currentPickNum>=snakeSequence.length;
  const currentTurn=!draftComplete?snakeSequence[currentPickNum]:null;
  const isMyTurn=currentTurn?.pid===player.id;
  const takenDrivers=new Set(draftState.map(d=>d.driver));
  const available=DRIVERS.filter(d=>!takenDrivers.has(d)&&d.toLowerCase().includes(search.toLowerCase()));
  const playerPicks={}; PLAYERS.forEach(p=>{playerPicks[p.id]=[];}); draftState.forEach(d=>{if(playerPicks[d.pid])playerPicks[d.pid].push(d.driver);});

  const handlePick=(driver)=>{
    if(!isMyTurn||draftComplete)return;
    if(!window.confirm("Lock in "+driver+"?"))return;
    onDraftPick(currentWeek,player.id,driver,currentPickNum);
    setSearch("");
  };

  return (<div style={{padding:20,maxWidth:800,margin:"0 auto"}}>
    <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:4}}>Week {currentWeek} Draft</h2>
    {weekInfo&&<div style={{color:C.dim,fontSize:14,marginBottom:12}}>{weekInfo.r} — {weekInfo.t} — <span style={{color:TTC[weekInfo.ty],fontWeight:600}}>{TTL[weekInfo.ty]} x{TRACK_MULTS[weekInfo.ty]}</span></div>}
    <div style={{background:C.card,borderRadius:10,padding:14,marginBottom:16,border:"1px solid "+C.border}}>
      <div style={{color:C.dim,fontSize:11,textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>Draft Order (last week's loser picks first)</div>
      <div style={{display:"flex",gap:8}}>{draftOrder.map((pid,i)=>(<div key={pid} style={{flex:1,textAlign:"center",padding:"8px 4px",borderRadius:8,background:currentTurn?.pid===pid?PC[pid]+"33":C.input,border:"1px solid "+(currentTurn?.pid===pid?PC[pid]:C.border)}}><div style={{fontSize:10,color:C.dim}}>#{i+1}</div><div style={{fontSize:14,fontWeight:700,color:PC[pid]}}>{PNAME[pid]}</div></div>))}</div>
    </div>
    {!draftComplete?(<div style={{background:isMyTurn?C.green+"22":C.card,borderRadius:10,padding:14,marginBottom:16,border:"1px solid "+(isMyTurn?C.green:C.border),textAlign:"center"}}>
      <div style={{fontSize:11,color:C.dim,textTransform:"uppercase",letterSpacing:2}}>Pick {currentPickNum+1} of {snakeSequence.length} · Round {currentTurn?.round}</div>
      <div style={{fontSize:20,fontWeight:700,color:isMyTurn?C.green:PC[currentTurn?.pid],marginTop:4}}>{isMyTurn?"YOUR PICK!":PNAME[currentTurn?.pid]+"'s Turn"}</div>
      {!isMyTurn&&<div style={{fontSize:12,color:C.dim,marginTop:4}}>Waiting for {PNAME[currentTurn?.pid]}...</div>}
    </div>):(<div style={{background:C.accent+"22",borderRadius:10,padding:14,marginBottom:16,border:"1px solid "+C.accent+"44",textAlign:"center"}}><div style={{fontSize:18,fontWeight:700,color:C.accent}}>Draft Complete!</div><div style={{fontSize:12,color:C.dim,marginTop:4}}>All picks locked for Week {currentWeek}</div></div>)}
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16}}>{PLAYERS.map(p=>(<div key={p.id} style={{background:C.card,borderRadius:10,padding:10,border:"1px solid "+C.border}}><div style={{color:PC[p.id],fontWeight:700,fontSize:13,marginBottom:8,textAlign:"center"}}>{PNAME[p.id]}</div>
      {Array.from({length:GARAGE_PICK_ENABLED?PICKS_PER_WEEK:ACTIVE_PICKS}).map((_,i)=>{const driver=playerPicks[p.id]?.[i];const isG=GARAGE_PICK_ENABLED&&i===ACTIVE_PICKS;return(<div key={i} style={{background:driver?(isG?C.purple+"22":C.input):C.bg,borderRadius:6,padding:"6px 8px",marginBottom:4,border:"1px solid "+(driver?(isG?C.purple+"55":C.border):"rgba(255,255,255,0.03)"),minHeight:28,display:"flex",alignItems:"center"}}><span style={{fontSize:10,color:isG?C.purple:C.dim,marginRight:6,fontWeight:700}}>{isG?"G":"R"+(i+1)}</span><span style={{fontSize:11,color:driver?C.text:C.dim+"44"}}>{driver||"—"}</span></div>);})}
    </div>))}</div>
    {isMyTurn&&!draftComplete&&<><div style={{color:C.dim,fontSize:11,textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>Select a Driver</div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search drivers..." style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid "+C.border,background:C.input,color:C.text,fontSize:14,fontFamily:"inherit",outline:"none",marginBottom:8,boxSizing:"border-box"}}/>
      <div style={{maxHeight:300,overflowY:"auto",display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>{available.map(d=>(<button key={d} onClick={()=>handlePick(d)} style={{textAlign:"left",padding:"10px 12px",borderRadius:8,background:C.card,border:"1px solid "+C.border,color:C.text,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{d}</button>))}</div></>}
    {draftState.length>0&&<div style={{marginTop:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={{color:C.dim,fontSize:11,textTransform:"uppercase",letterSpacing:2}}>Pick Log</div>
      {player.id==="justin"&&draftState.length>0&&!draftComplete&&<button onClick={async()=>{if(!window.confirm("Undo last pick by "+PNAME[draftState[draftState.length-1].pid]+" ("+draftState[draftState.length-1].driver+")?"))return;const r=await onUndoDraft(currentWeek);if(r)setUndoMsg("Undid "+PNAME[r.pid]+"'s pick: "+r.driver);setTimeout(()=>setUndoMsg(""),3000);}} style={{padding:"5px 12px",borderRadius:6,border:"1px solid "+C.red+"66",background:C.red+"11",color:C.red,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Undo Last Pick</button>}
    </div>{undoMsg&&<div style={{color:C.accent,fontSize:12,marginBottom:8,textAlign:"center"}}>{undoMsg}</div>}<div style={{display:"flex",flexDirection:"column",gap:3}}>{[...draftState].reverse().map((d,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:C.card,borderRadius:6,border:"1px solid "+C.border}}><span style={{fontSize:10,color:C.dim,width:24}}>#{draftState.length-i}</span><span style={{fontSize:12,color:PC[d.pid],fontWeight:600,width:80}}>{PNAME[d.pid]}</span><span style={{fontSize:12,color:C.text}}>{d.driver}</span></div>))}</div></div>}
  </div>);
}

function ResultsTab({data}) {
  const weeks=Object.keys(data.results||{}).map(k=>parseInt(k.replace("w",""))).sort((a,b)=>b-a);
  const [week,setWeek]=useState(weeks[0]||1);
  const wr=data.results?.["w"+week]; const weekInfo=SCHEDULE.find(s=>s.w===week);
  const sorted=wr?.scored?Object.entries(wr.scored).sort((a,b)=>b[1].total-a[1].total):[];
  return (<div style={{padding:20,maxWidth:900,margin:"0 auto"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
      <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,margin:0}}>Results</h2>
      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{weeks.map(w=>(<button key={w} onClick={()=>setWeek(w)} style={{padding:"6px 10px",borderRadius:6,border:"none",fontSize:11,fontWeight:700,cursor:"pointer",background:week===w?C.accent:"rgba(255,255,255,0.05)",color:week===w?"#000":C.dim}}>W{w}</button>))}</div>
    </div>
    {weekInfo&&<div style={{color:C.dim,fontSize:14,marginBottom:16}}>{weekInfo.r} · {weekInfo.t} · <span style={{color:TTC[weekInfo.ty]}}>{TTL[weekInfo.ty]} x{TRACK_MULTS[weekInfo.ty]}</span></div>}
    {sorted.length===0?<div style={{color:C.dim,textAlign:"center",padding:40}}>No results</div>
      :<div style={{display:"grid",gap:12}}>{sorted.map(([pid,ps],idx)=>(<div key={pid} style={{background:C.card,borderRadius:12,padding:"16px 20px",border:"1px solid "+(ps.weeklyWin?C.accent+"55":C.border)}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:(ps.drivers&&ps.drivers.length)?12:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{color:PC[pid],fontWeight:700,fontSize:17,fontFamily:"'Barlow Condensed',sans-serif"}}>{idx===0?"👑 ":""}{PNAME[pid]}</span>{ps.weeklyWin&&<span style={{background:C.accent+"22",color:C.accent,padding:"2px 10px",borderRadius:12,fontSize:10,fontWeight:700}}>WIN +25 PO</span>}</div>
          <span style={{color:PC[pid],fontFamily:"'Oswald',sans-serif",fontSize:26,fontWeight:700}}>{ps.total}</span>
        </div>
        {ps.drivers&&ps.drivers.length>0&&<div style={{display:"grid",gap:6}}>{ps.drivers.map(d=>(<div key={d.driver} style={{background:C.input,borderRadius:8,padding:"8px 12px",border:"1px solid "+C.border}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:C.text,fontSize:13,fontWeight:600}}>{d.driver}{d.isMulligan?" 🔄":""}{d.isGarage?" 🅶":""}{d.replaced?" ❌":""}</span><span style={{color:d.replaced?C.dim:d.total>=0?C.green:C.red,fontWeight:700,fontSize:13}}>{d.total}</span></div>
          <div style={{display:"flex",flexWrap:"wrap",gap:3}}>{(d.breakdown||[]).map((b,i)=>(<span key={i} style={{fontSize:9,color:b.pts>0?C.green:b.pts<0?C.red:C.dim,background:C.bg,padding:"2px 5px",borderRadius:4}}>{b.label}: {b.pts>0?"+":""}{b.pts}</span>))}</div>
        </div>))}</div>}
      </div>))}</div>}
  </div>);
}

function ScheduleTab({data}) {
  const scored=new Set(Object.keys(data.results||{}).map(k=>parseInt(k.replace("w",""))));
  return (<div style={{padding:20,maxWidth:700,margin:"0 auto"}}>
    <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:8}}>2026 Schedule</h2>
    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>{Object.entries(TTC).map(([t,c])=>(<span key={t} style={{fontSize:11,color:c,background:c+"18",padding:"3px 10px",borderRadius:12,fontWeight:600}}>{TTL[t]} x{TRACK_MULTS[t]}</span>))}</div>
    <div style={{display:"grid",gap:3}}>{SCHEDULE.map(s=>(<div key={s.w} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",borderRadius:8,background:s.w===PLAYOFF_START_WEEK?C.accent+"11":C.card,border:"1px solid "+(s.w>=PLAYOFF_START_WEEK?C.accent+"33":C.border)}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{color:scored.has(s.w)?C.green:C.dim,fontSize:11,width:36,fontWeight:700}}>{scored.has(s.w)?"✓ ":""}W{s.w}</span><span style={{color:C.text,fontSize:13,fontWeight:600}}>{s.r}</span>{s.w===PLAYOFF_START_WEEK&&<span style={{fontSize:9,color:C.accent,fontWeight:700,letterSpacing:1}}>PLAYOFFS</span>}</div>
      <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{color:C.dim,fontSize:10}}>{s.d}</span><span style={{fontSize:10,color:TTC[s.ty],fontWeight:600,background:TTC[s.ty]+"18",padding:"2px 8px",borderRadius:10}}>{TTL[s.ty]}</span></div>
    </div>))}</div></div>);
}

function MulligansTab({player,data}) {
  const used=data.meta.mulligansUsed[player.id]||0;
  return (<div style={{padding:20,maxWidth:700,margin:"0 auto"}}>
    <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:4}}>Mulligans</h2>
    <div style={{color:C.dim,fontSize:14,marginBottom:20}}>{MAX_MULLIGANS-used} of {MAX_MULLIGANS} remaining</div>
    <div style={{display:"flex",gap:6,marginBottom:20}}>{Array.from({length:MAX_MULLIGANS}).map((_,i)=>(<div key={i} style={{width:26,height:26,borderRadius:"50%",background:i<used?C.red+"33":C.green+"33",border:"2px solid "+(i<used?C.red:C.green),display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:i<used?C.red:C.green}}>{i<used?"✗":"✓"}</div>))}</div>
    {used===0&&<div style={{color:C.dim,fontSize:13}}>No mulligans used yet.</div>}
  </div>);
}

function RulesTab() {
  const rules=[{t:"Draft System",c:"Draft each week. Last week's loser picks first, winner picks last. Same order all 5 rounds."},{t:"Finish Points",c:"P1: 55, P2: 35, then P3: 34 decreasing by 1 to P36: 1. P37-40: 1 each."},{t:"Top Finish Bonus",c:"Top 5 finish: +2 bonus pts. Top 10 finish: +1 bonus pt."},{t:"Stage Points",c:"Top 10 each stage: 1st=10, 2nd=9... 10th=1"},{t:"Laps Led",c:"Per lap led x track modifier: SS x1.0, INT x0.5, ST x0.2, RC x1.5"},{t:"Net Position",c:"+/-1 pt per spot gained/lost (qualifying to finish). Capped at +/-10."},{t:"Bonuses",c:"Pole: 5 | Stage Win: 2.5 | Fastest Lap: 1 | Most Laps Led: 5 | Led a Lap: 0.5/driver | Sweep (Pole + both stage wins): 12.5"},{t:"DNF / DQ",c:"DNF = 0 total. DQ = -5 points."},{t:"Weekly Win",c:"Highest scorer earns 25 playoff points."},{t:"Playoffs (W27+)",c:"Reset to 1,000 base. Weekly wins (x25) + bonus pts carry over."},{t:"Mulligans",c:"10/season. Replacement driver earns finish position points ONLY."}];
  return (<div style={{padding:20,maxWidth:700,margin:"0 auto"}}><h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:16}}>Scoring Rules</h2>
    {rules.map(r=>(<div key={r.t} style={{background:C.card,borderRadius:10,padding:"12px 16px",marginBottom:8,border:"1px solid "+C.border}}><div style={{color:C.accent,fontWeight:700,fontSize:13,marginBottom:3,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>{r.t}</div><div style={{color:C.dim,fontSize:13,lineHeight:1.5}}>{r.c}</div></div>))}</div>);
}

function CommissionerTab({data,onPostResults,currentWeek}) {
  const [week,setWeek]=useState(currentWeek); const [editing,setEditing]=useState(false);
  const [drivers,setDrivers]=useState([]); const [playerPicks,setPlayerPicks]=useState({justin:[],bigmonroe:[],monroe:[],rich:[]});
  const [saving,setSaving]=useState(false); const [msg,setMsg]=useState("");
  const race=SCHEDULE.find(s=>s.w===week); const done=!!(data.results?.["w"+week]);

  const startEdit=()=>{
    const wr=data.results?.["w"+week];
    if(wr?.raw?.drivers){setDrivers(wr.raw.drivers.map(d=>({...d,finish:String(d.finish),qualPos:String(d.qualPos),stage1:String(d.stage1||""),stage2:String(d.stage2||""),lapsLed:String(d.lapsLed||0)})));}else{setDrivers([]);}
    const wp=data.picks?.["w"+week]||{}; const pp={};
    PLAYERS.forEach(p=>{pp[p.id]=(wp[p.id]||[]).map(pk=>({driver:pk.driver,mulligan:pk.mulligan||false,garage:pk.garage||false,garageActivated:pk.garageActivated||false,garageReplace:pk.garageReplace||""}));});
    setPlayerPicks(pp); setEditing(true); setMsg("");
  };
  const startNew=()=>{setDrivers([]);setPlayerPicks({justin:[],bigmonroe:[],monroe:[],rich:[]});setEditing(true);setMsg("");};
  const addD=()=>setDrivers([...drivers,{name:"",finish:"",qualPos:"",stage1:"",stage2:"",lapsLed:"0",pole:false,stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false}]);
  const ud=(i,f,v)=>{const n=[...drivers];n[i]={...n[i],[f]:v};setDrivers(n);}; const rm=(i)=>setDrivers(drivers.filter((_,j)=>j!==i));
  const addPick=(pid,isGarage)=>{const cur=playerPicks[pid]||[];const ac=cur.filter(pk=>!pk.garage).length;const hg=cur.some(pk=>pk.garage);if(isGarage&&hg)return;if(!isGarage&&ac>=ACTIVE_PICKS)return;setPlayerPicks({...playerPicks,[pid]:[...cur,{driver:"",mulligan:false,garage:!!isGarage,garageActivated:false,garageReplace:""}]});};
  const updatePick=(pid,i,field,val)=>{const np={...playerPicks};np[pid]=[...np[pid]];np[pid][i]={...np[pid][i],[field]:val};setPlayerPicks(np);};
  const removePick=(pid,i)=>{const np={...playerPicks};np[pid]=np[pid].filter((_,j)=>j!==i);setPlayerPicks(np);};

  const handleScore=async()=>{
    setSaving(true);setMsg("");
    const rr={drivers:drivers.map(d=>({name:d.name,finish:parseInt(d.finish)||40,qualPos:parseInt(d.qualPos)||40,stage1:parseInt(d.stage1)||0,stage2:parseInt(d.stage2)||0,lapsLed:parseInt(d.lapsLed)||0,pole:!!d.pole,stageWin1:!!d.stageWin1,stageWin2:!!d.stageWin2,fastestLap:!!d.fastestLap,mostLapsLed:!!d.mostLapsLed,dnf:!!d.dnf,dq:!!d.dq}))};
    const wp={}; PLAYERS.forEach(p=>{wp[p.id]=(playerPicks[p.id]||[]).filter(pk=>pk.driver).map(pk=>({driver:pk.driver,mulligan:pk.mulligan,garage:pk.garage,garageActivated:pk.garageActivated,garageReplace:pk.garageReplace}));});
    const mo={}; PLAYERS.forEach(p=>{mo[p.id]=(playerPicks[p.id]||[]).filter(pk=>pk.mulligan).map(pk=>({week,driver:pk.driver}));});
    const scored=scoreWeekFull(wp,rr,week,mo);
    await onPostResults(week,scored,rr,wp);
    setMsg("Week "+week+" "+(done?"updated":"scored")+"!"); setSaving(false); setEditing(false);
  };
  const iS={padding:"6px 8px",borderRadius:6,border:"1px solid "+C.border,background:C.input,color:C.text,fontSize:13,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box"};

  return (<div style={{padding:20,maxWidth:1000,margin:"0 auto"}}>
    <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:4}}>Commissioner Panel</h2>
    <div style={{color:C.dim,fontSize:13,marginBottom:16}}>Score new weeks or edit past results</div>
    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
      <span style={{color:C.dim,fontSize:13}}>Week:</span>
      <select value={week} onChange={e=>{setWeek(Number(e.target.value));setEditing(false);setMsg("");}} style={{...iS,width:80}}>{SCHEDULE.map(s=><option key={s.w} value={s.w}>{s.w}</option>)}</select>
      {race&&<span style={{color:C.dim,fontSize:13}}>{race.r} · {TTL[race.ty]} x{TRACK_MULTS[race.ty]}</span>}
      {done&&!editing&&<span style={{color:C.green,fontSize:13,fontWeight:700}}>✓ Scored</span>}
    </div>
    {!editing&&<div style={{display:"flex",gap:8,marginBottom:16}}>
      {done&&<button onClick={startEdit} style={{padding:"10px 20px",borderRadius:8,border:"1px solid "+C.accent,background:C.accent+"22",color:C.accent,fontSize:13,fontFamily:"inherit",fontWeight:600,cursor:"pointer"}}>Edit Week {week}</button>}
      {!done&&<button onClick={startNew} style={{padding:"10px 20px",borderRadius:8,border:"1px solid "+C.green,background:C.green+"22",color:C.green,fontSize:13,fontFamily:"inherit",fontWeight:600,cursor:"pointer"}}>Score Week {week}</button>}
    </div>}
    {editing&&<>
      <div style={{marginBottom:20}}>
        <div style={{color:C.accent,fontSize:14,fontWeight:700,marginBottom:10,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1,textTransform:"uppercase"}}>Player Picks</div>
        {PLAYERS.map(p=>{const pks=playerPicks[p.id]||[];const ac=pks.filter(pk=>!pk.garage).length;const hg=pks.some(pk=>pk.garage);const aps=pks.filter(pk=>!pk.garage);const gps=pks.filter(pk=>pk.garage);
        return(<div key={p.id} style={{background:C.card,borderRadius:10,padding:12,marginBottom:8,border:"1px solid "+C.border}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:4}}>
            <span style={{color:PC[p.id],fontWeight:700,fontSize:14}}>{PNAME[p.id]} ({ac}/{ACTIVE_PICKS}{GARAGE_PICK_ENABLED?" + "+(hg?"1":"0")+"/1 G":""})</span>
            <div style={{display:"flex",gap:4}}>{ac<ACTIVE_PICKS&&<button onClick={()=>addPick(p.id,false)} style={{padding:"4px 10px",borderRadius:6,border:"1px solid "+C.accent+"66",background:C.accent+"11",color:C.accent,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>+ Driver</button>}{GARAGE_PICK_ENABLED&&!hg&&<button onClick={()=>addPick(p.id,true)} style={{padding:"4px 10px",borderRadius:6,border:"1px solid "+C.purple+"66",background:C.purple+"11",color:C.purple,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>+ Garage</button>}</div>
          </div>
          {aps.map((pk,i)=>{const ri=pks.indexOf(pk);return(<div key={ri} style={{display:"flex",gap:6,alignItems:"center",marginBottom:4}}>
            <span style={{fontSize:10,color:C.dim,fontWeight:700,width:20}}>R{i+1}</span>
            <select value={pk.driver} onChange={e=>updatePick(p.id,ri,"driver",e.target.value)} style={{...iS,flex:1}}><option value="">Select driver</option>{DRIVERS.map(dr=><option key={dr} value={dr}>{dr}</option>)}</select>
            <label style={{display:"flex",alignItems:"center",gap:3,cursor:"pointer",fontSize:11,color:pk.mulligan?C.accent:C.dim,flexShrink:0}}><input type="checkbox" checked={!!pk.mulligan} onChange={e=>updatePick(p.id,ri,"mulligan",e.target.checked)}/>M</label>
            <button onClick={()=>removePick(p.id,ri)} style={{background:C.red+"22",border:"1px solid "+C.red+"44",borderRadius:6,color:C.red,padding:"4px 8px",fontSize:10,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>X</button>
          </div>);})}
          {gps.map(pk=>{const ri=pks.indexOf(pk);const ads=aps.filter(ap=>ap.driver).map(ap=>ap.driver);return(<div key={ri} style={{marginTop:6,padding:8,background:C.purple+"11",borderRadius:8,border:"1px solid "+C.purple+"33"}}>
            <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:pk.garageActivated?6:0}}><span style={{fontSize:10,color:C.purple,fontWeight:700,width:20}}>G</span>
              <select value={pk.driver} onChange={e=>updatePick(p.id,ri,"driver",e.target.value)} style={{...iS,flex:1}}><option value="">Garage driver</option>{DRIVERS.map(dr=><option key={dr} value={dr}>{dr}</option>)}</select>
              <label style={{display:"flex",alignItems:"center",gap:3,cursor:"pointer",fontSize:11,color:pk.garageActivated?C.green:C.dim,flexShrink:0}}><input type="checkbox" checked={!!pk.garageActivated} onChange={e=>updatePick(p.id,ri,"garageActivated",e.target.checked)}/>Use</label>
              <button onClick={()=>removePick(p.id,ri)} style={{background:C.red+"22",border:"1px solid "+C.red+"44",borderRadius:6,color:C.red,padding:"4px 8px",fontSize:10,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>X</button></div>
            {pk.garageActivated&&<div style={{display:"flex",gap:6,alignItems:"center"}}><span style={{fontSize:10,color:C.purple,width:20}}>↔</span><select value={pk.garageReplace||""} onChange={e=>updatePick(p.id,ri,"garageReplace",e.target.value)} style={{...iS,flex:1}}><option value="">Replaces?</option>{ads.map(dr=><option key={dr} value={dr}>{dr}</option>)}</select></div>}
          </div>);})}
        </div>);})}
      </div>
      <div style={{color:C.accent,fontSize:14,fontWeight:700,marginBottom:10,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1,textTransform:"uppercase"}}>Race Results</div>
      <button onClick={addD} style={{padding:"8px 16px",borderRadius:6,border:"1px solid "+C.accent,background:C.accent+"22",color:C.accent,fontSize:13,fontFamily:"inherit",fontWeight:600,cursor:"pointer",marginBottom:12}}>+ Add Driver Result</button>
      {drivers.map((d,i)=>(<div key={i} style={{background:C.card,borderRadius:10,padding:14,marginBottom:8,border:"1px solid "+C.border}}>
        <div style={{display:"flex",gap:6,marginBottom:8,alignItems:"center",flexWrap:"wrap"}}>
          <select value={d.name} onChange={e=>ud(i,"name",e.target.value)} style={{...iS,flex:"2 1 140px"}}><option value="">Select driver</option>{DRIVERS.map(dr=><option key={dr} value={dr}>{dr}</option>)}</select>
          <input placeholder="Fin" type="number" value={d.finish} onChange={e=>ud(i,"finish",e.target.value)} style={{...iS,flex:"0 1 55px"}}/>
          <input placeholder="Qual" type="number" value={d.qualPos} onChange={e=>ud(i,"qualPos",e.target.value)} style={{...iS,flex:"0 1 55px"}}/>
          <input placeholder="S1" type="number" value={d.stage1} onChange={e=>ud(i,"stage1",e.target.value)} style={{...iS,flex:"0 1 45px"}}/>
          <input placeholder="S2" type="number" value={d.stage2} onChange={e=>ud(i,"stage2",e.target.value)} style={{...iS,flex:"0 1 45px"}}/>
          <input placeholder="Led" type="number" value={d.lapsLed} onChange={e=>ud(i,"lapsLed",e.target.value)} style={{...iS,flex:"0 1 55px"}}/>
          <button onClick={()=>rm(i)} style={{background:C.red+"22",border:"1px solid "+C.red+"44",borderRadius:6,color:C.red,padding:"6px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>X</button></div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>{[["pole","Pole"],["stageWin1","S1 Win"],["stageWin2","S2 Win"],["fastestLap","Fast Lap"],["mostLapsLed","Most Led"],["dnf","DNF"],["dq","DQ"]].map(([f,l])=>(<label key={f} style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",fontSize:12,color:d[f]?C.text:C.dim}}><input type="checkbox" checked={!!d[f]} onChange={e=>ud(i,f,e.target.checked)}/>{l}</label>))}</div>
      </div>))}
      <div style={{display:"flex",gap:8,marginTop:12}}>
        <button onClick={handleScore} disabled={saving} style={{flex:1,padding:"14px 0",borderRadius:8,border:"none",background:C.accent,color:"#000",fontFamily:"'Oswald',sans-serif",fontSize:16,fontWeight:700,letterSpacing:2,textTransform:"uppercase",cursor:"pointer"}}>{saving?"Saving...":(done?"Re-Score Week "+week:"Score Week "+week)}</button>
        <button onClick={()=>setEditing(false)} style={{padding:"14px 20px",borderRadius:8,border:"1px solid "+C.border,background:"transparent",color:C.dim,fontFamily:"'Oswald',sans-serif",fontSize:14,cursor:"pointer"}}>Cancel</button>
      </div>{msg&&<div style={{color:C.green,marginTop:10,textAlign:"center",fontSize:14}}>{msg}</div>}
    </>}
    {done&&!editing&&(()=>{const wr=data.results["w"+week];const s=Object.entries(wr.scored||{}).sort((a,b)=>b[1].total-a[1].total);return<div style={{marginTop:8}}><div style={{color:C.dim,fontSize:11,textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>Current Scores</div>{s.map(([pid,ps])=>(<div key={pid} style={{display:"flex",justifyContent:"space-between",padding:"8px 12px",background:C.card,borderRadius:8,marginBottom:4,border:"1px solid "+(ps.weeklyWin?C.accent+"44":C.border)}}><span style={{color:PC[pid],fontWeight:600,fontSize:14}}>{ps.weeklyWin?"👑 ":""}{PNAME[pid]}</span><span style={{color:PC[pid],fontWeight:700,fontSize:16}}>{ps.total}</span></div>))}</div>;})()}
    {msg&&!editing&&<div style={{color:C.green,marginTop:10,textAlign:"center",fontSize:14}}>{msg}</div>}
  </div>);
}

export default function App() {
  const [user,setUser]=useState(null); const [tab,setTab]=useState("standings");
  const [data,setData]=useState(null); const [loading,setLoading]=useState(true);
  const [dbStatus,setDbStatus]=useState("connecting");

  useEffect(()=>{let unsub=null;(async()=>{try{
    let d=await loadLeagueData(); if(d)setDbStatus("connected"); else{d=loadLocalBackup();if(d)setDbStatus("offline");}
    if(!d){d=buildInitialData();setDbStatus(isFirebaseReady()?"new":"offline");await saveLeagueData(d);}
    setData(d);setLoading(false);unsub=subscribeToLeagueData(u=>{setData(u);setDbStatus("connected");});
  }catch(e){console.error("Startup error:",e);setData(loadLocalBackup()||buildInitialData());setLoading(false);setDbStatus("offline");}})();
  return()=>{if(unsub)unsub();};},[]);

  const currentWeek=useMemo(()=>data?(data.meta.lastScoredWeek||10)+1:11,[data]);

  const handleDraftPick=async(week,pid,driver,pickNum)=>{
    const d=JSON.parse(JSON.stringify(data)); if(!d.drafts)d.drafts={}; const key="w"+week;
    if(!d.drafts[key])d.drafts[key]=[]; d.drafts[key].push({pid,driver,pickNum});
    setData(d); await saveLeagueData(d);
  };

  const handleUndoDraft=async(week)=>{
    const d=JSON.parse(JSON.stringify(data)); const key="w"+week;
    if(!d.drafts?.[key]?.length) return;
    const removed = d.drafts[key].pop();
    setData(d); await saveLeagueData(d);
    return removed;
  };

  const handlePostResults=async(week,scored,rr,wp)=>{
    const d=JSON.parse(JSON.stringify(data)); if(!d.results)d.results={}; if(!d.picks)d.picks={};
    d.results["w"+week]={scored,raw:rr}; d.picks["w"+week]=wp;
    const fs={justin:0,bigmonroe:0,monroe:0,rich:0},fp2={justin:0,bigmonroe:0,monroe:0,rich:0}; let last=0;
    Object.entries(d.results).forEach(([key,wr])=>{const w=parseInt(key.replace("w",""));if(w>last)last=w;if(!wr.scored)return;
      Object.entries(wr.scored).forEach(([pid,s])=>{fs[pid]=Math.round((fs[pid]+s.total)*100)/100;fp2[pid]=Math.round((fp2[pid]+(s.bonusPoints||0))*100)/100;if(s.weeklyWin)fp2[pid]=Math.round((fp2[pid]+25)*100)/100;});});
    d.meta.standings=fs; d.meta.playoffPts=fp2; d.meta.lastScoredWeek=last;
    const mc={justin:0,bigmonroe:0,monroe:0,rich:0};
    Object.entries(d.picks).forEach(([,wp2])=>{Object.entries(wp2).forEach(([pid,pks])=>{(pks||[]).forEach(pk=>{if(pk.mulligan)mc[pid]++;});});});
    d.meta.mulligansUsed=mc; setData(d); await saveLeagueData(d);
  };

  if(loading)return(<div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:C.bg,gap:12}}>
    <div style={{color:C.accent,fontFamily:"'Racing Sans One',cursive",fontSize:32}}>FERDA</div>
    <div style={{color:C.dim,fontSize:13}}>Connecting to database...</div>
    <div style={{color:C.dim,fontSize:11,marginTop:8}}>If this takes more than 10 seconds, check browser console (F12)</div></div>);
  if(!user)return <LoginScreen onLogin={setUser}/>;
  return (<div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Barlow Condensed',sans-serif",color:C.text}}>
    <Nav player={user} tab={tab} setTab={setTab} onLogout={()=>setUser(null)}/>
    {dbStatus==="offline"&&<div style={{background:C.red+"22",color:C.red,textAlign:"center",padding:"6px",fontSize:11,fontWeight:600}}>OFFLINE MODE — Firebase not connected</div>}
    {tab==="standings"&&<StandingsTab data={data}/>}
    {tab==="draft"&&<DraftTab player={user} data={data} onDraftPick={handleDraftPick} onUndoDraft={handleUndoDraft} currentWeek={currentWeek}/>}
    {tab==="results"&&<ResultsTab data={data}/>}
    {tab==="schedule"&&<ScheduleTab data={data}/>}
    {tab==="mulligans"&&<MulligansTab player={user} data={data}/>}
    {tab==="rules"&&<RulesTab/>}
    {tab==="commissioner"&&user.id==="justin"&&<CommissionerTab data={data} onPostResults={handlePostResults} currentWeek={currentWeek}/>}
  </div>);
}
