import { useState, useEffect, useCallback, useMemo } from "react";
import { loadLeagueData, saveLeagueData, subscribeToLeagueData, loadLocalBackup, isFirebaseReady } from "./firebase";

const PLAYERS = [
  { id: "justin", name: "Justin", password: "ferda1" },
  { id: "bigmonroe", name: "Big Monroe", password: "ferda2" },
  { id: "monroe", name: "Monroe", password: "ferda3" },
  { id: "rich", name: "Rich", password: "ferda4" },
];
const PNAME = { justin:"Justin", bigmonroe:"Big Monroe", monroe:"Monroe", rich:"Rich" };
const FINISH_POINTS = {1:50,2:40,3:36,4:35,5:33,6:30,7:29,8:28,9:27,10:26,11:25,12:24,13:23,14:22,15:21,16:20,17:19,18:18,19:17,20:16,21:15,22:14,23:13,24:12,25:11,26:10,27:9,28:8,29:7,30:6,31:5,32:5,33:5,34:5,35:5,36:4,37:3,38:2,39:1,40:0.5};
const STAGE_POINTS = {1:10,2:9,3:8,4:7,5:6,6:5,7:4,8:3,9:2,10:1};
const TRACK_MULTS = { superspeedway:1.0, short_track:0.2, intermediate:0.5, road_course:1.5 };
const SCHEDULE = [
  {w:1,t:"Daytona",ty:"superspeedway",d:"Feb 15",r:"Daytona 500"},
  {w:2,t:"Atlanta",ty:"superspeedway",d:"Feb 22",r:"Autotrader 400"},
  {w:3,t:"COTA",ty:"road_course",d:"Mar 1",r:"DuraMAX Grand Prix"},
  {w:4,t:"Phoenix",ty:"short_track",d:"Mar 8",r:"Straight Talk 500"},
  {w:5,t:"Las Vegas",ty:"intermediate",d:"Mar 15",r:"Pennzoil 400"},
  {w:6,t:"Darlington",ty:"intermediate",d:"Mar 22",r:"Goodyear 400"},
  {w:7,t:"Martinsville",ty:"short_track",d:"Mar 29",r:"STP 500"},
  {w:8,t:"Bristol",ty:"short_track",d:"Apr 12",r:"Food City 500"},
  {w:9,t:"Kansas",ty:"intermediate",d:"Apr 19",r:"AdventHealth 400"},
  {w:10,t:"Talladega",ty:"superspeedway",d:"Apr 26",r:"GEICO 500"},
  {w:11,t:"Watkins Glen",ty:"road_course",d:"May 3",r:"Go Bowling at The Glen"},
  {w:12,t:"Texas",ty:"intermediate",d:"May 10",r:"EchoPark 500"},
  {w:13,t:"Charlotte",ty:"intermediate",d:"May 24",r:"Coca-Cola 600"},
  {w:14,t:"Nashville",ty:"intermediate",d:"May 31",r:"Ally 400"},
  {w:15,t:"Michigan",ty:"intermediate",d:"Jun 7",r:"FireKeepers 400"},
  {w:16,t:"Pocono",ty:"intermediate",d:"Jun 14",r:"Pocono 400"},
  {w:17,t:"San Diego",ty:"road_course",d:"Jun 21",r:"Street Race"},
  {w:18,t:"Sonoma",ty:"road_course",d:"Jun 28",r:"Save Mart 350"},
  {w:19,t:"Chicagoland",ty:"intermediate",d:"Jul 5",r:"Chicagoland 400"},
  {w:20,t:"Atlanta",ty:"superspeedway",d:"Jul 12",r:"Quaker State 400"},
  {w:21,t:"N. Wilkesboro",ty:"short_track",d:"Jul 19",r:"N. Wilkesboro 400"},
  {w:22,t:"Indianapolis",ty:"intermediate",d:"Jul 26",r:"Brickyard 400"},
  {w:23,t:"Iowa",ty:"short_track",d:"Aug 9",r:"Iowa Corn 350"},
  {w:24,t:"Richmond",ty:"short_track",d:"Aug 15",r:"Federated Auto 400"},
  {w:25,t:"New Hampshire",ty:"short_track",d:"Aug 23",r:"Foxwoods 301"},
  {w:26,t:"Daytona",ty:"superspeedway",d:"Aug 29",r:"Coke Zero 400"},
  {w:27,t:"Darlington",ty:"intermediate",d:"Sep 6",r:"Southern 500"},
  {w:28,t:"WWT Raceway",ty:"intermediate",d:"Sep 13",r:"Enjoy Illinois 300"},
  {w:29,t:"Bristol",ty:"short_track",d:"Sep 19",r:"Bass Pro Night Race"},
  {w:30,t:"Kansas",ty:"intermediate",d:"Sep 27",r:"Hollywood Casino 400"},
  {w:31,t:"Las Vegas",ty:"intermediate",d:"Oct 4",r:"South Point 400"},
  {w:32,t:"Charlotte",ty:"intermediate",d:"Oct 11",r:"Bank of America 500"},
  {w:33,t:"Phoenix",ty:"short_track",d:"Oct 18",r:"Phoenix Fall Race"},
  {w:34,t:"Talladega",ty:"superspeedway",d:"Oct 25",r:"YellaWood 500"},
  {w:35,t:"Martinsville",ty:"short_track",d:"Nov 1",r:"Xfinity 500"},
  {w:36,t:"Homestead",ty:"intermediate",d:"Nov 8",r:"Championship Race"},
];
const DRIVERS = [
  "#1 Ross Chastain","#2 Austin Cindric","#3 Austin Dillon","#4 Noah Gragson",
  "#5 Kyle Larson","#6 Brad Keselowski","#7 Daniel Suarez","#8 Kyle Busch",
  "#9 Chase Elliott","#10 Ty Dillon","#11 Denny Hamlin","#12 Ryan Blaney",
  "#16 AJ Allmendinger","#17 Chris Buescher","#19 Chase Briscoe","#20 Christopher Bell",
  "#21 Josh Berry","#22 Joey Logano","#23 Bubba Wallace","#24 William Byron",
  "#31 Justin Allgaier","#33 Austin Hill","#34 Todd Gilliland","#35 Riley Herbst","#38 Zane Smith",
  "#41 Cole Custer","#42 John Hunter Nemechek","#43 Erik Jones","#45 Tyler Reddick",
  "#47 Ricky Stenhouse Jr","#48 Alex Bowman","#51 Cody Ware","#54 Ty Gibbs",
  "#60 Ryan Preece","#71 Michael McDowell","#77 Carson Hocevar","#84 Jimmie Johnson","#88 Connor Zilisch","#97 Shane Van Gisbergen",
  "[Open / TBD #1]","[Open / TBD #2]"
];
const MAX_MULLIGANS = 10;
const PICKS_PER_WEEK = 5;
const PLAYOFF_START_WEEK = 27;

function getDraftOrder(data, currentWeek) {
  const prev = data.results?.["w" + (currentWeek - 1)];
  if (!prev?.scored) return PLAYERS.map(p => p.id);
  return PLAYERS.map(p => ({ id: p.id, score: prev.scored[p.id]?.total || 0 }))
    .sort((a, b) => a.score - b.score).map(s => s.id);
}

function buildSnakeOrder(order) {
  const seq = [];
  for (let r = 0; r < PICKS_PER_WEEK; r++) {
    order.forEach(pid => seq.push({ pid, round: r + 1 }));
  }
  return seq;
}

function buildInitialData() {
  const wr = {
    1:{w:"monroe",s:{monroe:196.5,justin:131.0,bigmonroe:84.0,rich:76.5}},
    2:{w:"justin",s:{justin:212.0,monroe:190.0,rich:177.5,bigmonroe:159.0}},
    3:{w:"monroe",s:{monroe:235.5,bigmonroe:190.5,rich:151.0,justin:92.5}},
    4:{w:"justin",s:{justin:220.8,bigmonroe:149.0,monroe:108.0,rich:87.5}},
    5:{w:"rich",s:{rich:282.5,monroe:144.5,justin:124.0,bigmonroe:109.0}},
    6:{w:"justin",s:{justin:227.0,bigmonroe:214.5,rich:188.0,monroe:166.5}},
    7:{w:"justin",s:{justin:249.8,rich:226.4,monroe:143.0,bigmonroe:116.3}},
  };
  const results = {};
  Object.entries(wr).forEach(([w, r]) => {
    results["w"+w] = { scored: {} };
    Object.entries(r.s).forEach(([pid, total]) => {
      results["w"+w].scored[pid] = { total, bonusPoints:0, weeklyWin:pid===r.w, drivers:[], historical:true };
    });
  });

  // Week 8: Bristol Food City 500 (Short Track x0.2)
  results["w8"] = { scored: {
    bigmonroe: { total:260.5, bonusPoints:10, weeklyWin:true, drivers:[
      {driver:"#5 Kyle Larson",total:128.3,bonusPoints:10,isMulligan:false,breakdown:[
        {label:"P3",pts:36},{label:"Net Q8>P3",pts:5},{label:"284laps*0.2",pts:56.8},{label:"Led a lap",pts:0.5},
        {label:"S1:P1",pts:10},{label:"S2:P1",pts:10},{label:"S1 Win",pts:2.5},{label:"S2 Win",pts:2.5},{label:"Most Led",pts:5}
      ]},
      {driver:"#54 Ty Gibbs",total:63.5,bonusPoints:0,isMulligan:false,breakdown:[
        {label:"P1",pts:50},{label:"Net Q5>P1",pts:4},{label:"25laps*0.2",pts:5},{label:"Led a lap",pts:0.5},
        {label:"S2:P7",pts:4}
      ]},
      {driver:"#23 Bubba Wallace",total:30,bonusPoints:0,isMulligan:false,breakdown:[
        {label:"P11",pts:25},{label:"Net Q12>P11",pts:1},{label:"S1:P9",pts:2},{label:"S2:P9",pts:2}
      ]},
      {driver:"#6 Brad Keselowski",total:29,bonusPoints:0,isMulligan:false,breakdown:[
        {label:"P14",pts:22},{label:"Net Q21>P14",pts:7}
      ]},
      {driver:"#20 Christopher Bell",total:9.7,bonusPoints:0,isMulligan:false,breakdown:[
        {label:"P27",pts:9},{label:"Net Q14>P27",pts:-10},{label:"6laps*0.2",pts:1.2},{label:"Led a lap",pts:0.5},
        {label:"S1:P2",pts:9}
      ]},
    ]},
    monroe: { total:163, bonusPoints:7.5, weeklyWin:false, drivers:[
      {driver:"#12 Ryan Blaney",total:102,bonusPoints:7.5,isMulligan:false,breakdown:[
        {label:"P2",pts:40},{label:"Net Q1>P2",pts:-1},{label:"190laps*0.2",pts:38},{label:"Led a lap",pts:0.5},
        {label:"S1:P3",pts:8},{label:"S2:P2",pts:9},{label:"Pole",pts:5},{label:"Fast Lap",pts:2.5}
      ]},
      {driver:"#22 Joey Logano",total:42,bonusPoints:0,isMulligan:false,breakdown:[
        {label:"P7",pts:29},{label:"Net Q20>P7",pts:10},{label:"S2:P8",pts:3}
      ]},
      {driver:"#9 Chase Elliott",total:10,bonusPoints:0,isMulligan:false,breakdown:[
        {label:"P22",pts:14},{label:"Net Q18>P22",pts:-4}
      ]},
      {driver:"#21 Josh Berry",total:5,bonusPoints:0,isMulligan:true,breakdown:[
        {label:"P32",pts:5},{label:"Mulligan",pts:0}
      ]},
      {driver:"#97 Shane Van Gisbergen",total:4,bonusPoints:0,isMulligan:false,breakdown:[
        {label:"P34",pts:5},{label:"Net Q33>P34",pts:-1}
      ]},
    ]},
    justin: { total:137, bonusPoints:0, weeklyWin:false, drivers:[
      {driver:"#19 Chase Briscoe",total:44,bonusPoints:0,isMulligan:false,breakdown:[
        {label:"P5",pts:33},{label:"Net Q3>P5",pts:-2},{label:"S1:P4",pts:7},{label:"S2:P5",pts:6}
      ]},
      {driver:"#77 Carson Hocevar",total:37,bonusPoints:0,isMulligan:false,breakdown:[
        {label:"P10",pts:26},{label:"S1:P7",pts:4},{label:"S2:P4",pts:7}
      ]},
      {driver:"#45 Tyler Reddick",total:33,bonusPoints:0,isMulligan:false,breakdown:[
        {label:"P4",pts:35},{label:"Net Q2>P4",pts:-2}
      ]},
      {driver:"#7 Daniel Suarez",total:25,bonusPoints:0,isMulligan:false,breakdown:[
        {label:"P12",pts:24},{label:"Net Q13>P12",pts:1}
      ]},
      {driver:"#88 Connor Zilisch",total:-2,bonusPoints:0,isMulligan:false,breakdown:[
        {label:"P33",pts:5},{label:"Net Q26>P33",pts:-7}
      ]},
    ]},
    rich: { total:119, bonusPoints:0, weeklyWin:false, drivers:[
      {driver:"#11 Denny Hamlin",total:42,bonusPoints:0,isMulligan:false,breakdown:[
        {label:"P9",pts:27},{label:"Net Q11>P9",pts:2},{label:"S1:P6",pts:5},{label:"S2:P3",pts:8}
      ]},
      {driver:"#60 Ryan Preece",total:37,bonusPoints:0,isMulligan:false,breakdown:[
        {label:"P8",pts:28},{label:"Net Q17>P8",pts:9}
      ]},
      {driver:"#17 Chris Buescher",total:27,bonusPoints:0,isMulligan:false,breakdown:[
        {label:"P13",pts:23},{label:"Net Q17>P13",pts:4}
      ]},
      {driver:"#71 Michael McDowell",total:7,bonusPoints:0,isMulligan:false,breakdown:[
        {label:"P24",pts:12},{label:"Net Q19>P24",pts:-5}
      ]},
      {driver:"#1 Ross Chastain",total:6,bonusPoints:0,isMulligan:false,breakdown:[
        {label:"P20",pts:16},{label:"Net Q6>P20",pts:-10}
      ]},
    ]},
  }};

  const w8picks = {
    bigmonroe:[{driver:"#5 Kyle Larson"},{driver:"#54 Ty Gibbs"},{driver:"#23 Bubba Wallace"},{driver:"#6 Brad Keselowski"},{driver:"#20 Christopher Bell"}],
    monroe:[{driver:"#12 Ryan Blaney"},{driver:"#22 Joey Logano"},{driver:"#9 Chase Elliott"},{driver:"#21 Josh Berry",mulligan:true},{driver:"#97 Shane Van Gisbergen"}],
    justin:[{driver:"#19 Chase Briscoe"},{driver:"#77 Carson Hocevar"},{driver:"#45 Tyler Reddick"},{driver:"#7 Daniel Suarez"},{driver:"#88 Connor Zilisch"}],
    rich:[{driver:"#11 Denny Hamlin"},{driver:"#60 Ryan Preece"},{driver:"#17 Chris Buescher"},{driver:"#71 Michael McDowell"},{driver:"#1 Ross Chastain"}],
  };

  // Raw race result data for Bristol so Commissioner can edit
  const w8raw = {drivers:[
    {name:"#54 Ty Gibbs",finish:1,qualPos:5,stage1:0,stage2:7,lapsLed:25,pole:false,stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
    {name:"#12 Ryan Blaney",finish:2,qualPos:1,stage1:3,stage2:2,lapsLed:190,pole:true,stageWin1:false,stageWin2:false,fastestLap:true,mostLapsLed:false,dnf:false,dq:false},
    {name:"#5 Kyle Larson",finish:3,qualPos:8,stage1:1,stage2:1,lapsLed:284,pole:false,stageWin1:true,stageWin2:true,fastestLap:false,mostLapsLed:true,dnf:false,dq:false},
    {name:"#45 Tyler Reddick",finish:4,qualPos:2,stage1:0,stage2:0,lapsLed:0,pole:false,stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
    {name:"#19 Chase Briscoe",finish:5,qualPos:3,stage1:4,stage2:5,lapsLed:0,pole:false,stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
    {name:"#34 Todd Gilliland",finish:6,qualPos:35,stage1:0,stage2:0,lapsLed:0,pole:false,stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
    {name:"#22 Joey Logano",finish:7,qualPos:20,stage1:0,stage2:8,lapsLed:0,pole:false,stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
    {name:"#60 Ryan Preece",finish:8,qualPos:17,stage1:0,stage2:0,lapsLed:0,pole:false,stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
    {name:"#11 Denny Hamlin",finish:9,qualPos:11,stage1:6,stage2:3,lapsLed:0,pole:false,stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
    {name:"#77 Carson Hocevar",finish:10,qualPos:10,stage1:7,stage2:4,lapsLed:0,pole:false,stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
    {name:"#23 Bubba Wallace",finish:11,qualPos:12,stage1:9,stage2:9,lapsLed:0,pole:false,stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
    {name:"#7 Daniel Suarez",finish:12,qualPos:13,stage1:0,stage2:0,lapsLed:0,pole:false,stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
    {name:"#17 Chris Buescher",finish:13,qualPos:17,stage1:0,stage2:0,lapsLed:0,pole:false,stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
    {name:"#6 Brad Keselowski",finish:14,qualPos:21,stage1:0,stage2:0,lapsLed:0,pole:false,stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
    {name:"#9 Chase Elliott",finish:22,qualPos:18,stage1:0,stage2:0,lapsLed:0,pole:false,stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
    {name:"#71 Michael McDowell",finish:24,qualPos:19,stage1:0,stage2:0,lapsLed:0,pole:false,stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
    {name:"#20 Christopher Bell",finish:27,qualPos:14,stage1:2,stage2:0,lapsLed:6,pole:false,stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
    {name:"#1 Ross Chastain",finish:20,qualPos:6,stage1:0,stage2:0,lapsLed:0,pole:false,stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
    {name:"#21 Josh Berry",finish:32,qualPos:25,stage1:5,stage2:6,lapsLed:0,pole:false,stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
    {name:"#88 Connor Zilisch",finish:33,qualPos:26,stage1:0,stage2:0,lapsLed:0,pole:false,stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
    {name:"#97 Shane Van Gisbergen",finish:34,qualPos:33,stage1:0,stage2:0,lapsLed:0,pole:false,stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false},
  ]};

  results["w8"].raw = w8raw;

  return {
    results, picks: {"w8": w8picks}, drafts: {},
    mulligans: { justin:[], bigmonroe:[], monroe:[{week:8,driver:"#24 William Byron",replacement:"#21 Josh Berry"}], rich:[] },
    meta: {
      standings: { justin:1394.1, bigmonroe:1282.8, monroe:1347.0, rich:1308.4 },
      playoffPts: { justin:154.5, bigmonroe:53.0, monroe:100.0, rich:83.5 },
      mulligansUsed: { justin:0, bigmonroe:0, monroe:1, rich:0 },
      lastScoredWeek: 8,
    },
  };
}

function calcDriverScore(driver, trackType, isMulligan) {
  let score = 0; const bd = []; const mult = TRACK_MULTS[trackType] || 0.5;
  if (driver.dnf) {
    if (driver.dq) return { total:-5, breakdown:[{label:"DQ",pts:-5}], bonusPoints:0 };
    return { total:0, breakdown:[{label:"DNF",pts:0}], bonusPoints:0 };
  }
  const fp = FINISH_POINTS[driver.finish] || 0;
  score += fp; bd.push({label:"P"+driver.finish,pts:fp});
  if (isMulligan) { bd.push({label:"Mulligan",pts:0}); return {total:score,breakdown:bd,bonusPoints:0}; }
  if (driver.stage1 > 0 && driver.stage1 <= 10) { const sp=STAGE_POINTS[driver.stage1]; score+=sp; bd.push({label:"S1:P"+driver.stage1,pts:sp}); }
  if (driver.stage2 > 0 && driver.stage2 <= 10) { const sp=STAGE_POINTS[driver.stage2]; score+=sp; bd.push({label:"S2:P"+driver.stage2,pts:sp}); }
  if (driver.lapsLed > 0) {
    const lp = Math.round(driver.lapsLed * mult * 10) / 10;
    score += lp; bd.push({label:driver.lapsLed+"laps*"+mult,pts:lp});
    score += 0.5; bd.push({label:"Led a lap",pts:0.5});
  }
  if (driver.qualPos && driver.finish) {
    let net = driver.qualPos - driver.finish;
    net = Math.max(-10, Math.min(10, net));
    if (net !== 0) { score += net; bd.push({label:"Net Q"+driver.qualPos+">P"+driver.finish,pts:net}); }
  }
  let bp = 0;
  if (driver.pole) { score+=5; bp+=5; bd.push({label:"Pole",pts:5}); }
  if (driver.stageWin1) { score+=2.5; bp+=2.5; bd.push({label:"S1 Win",pts:2.5}); }
  if (driver.stageWin2) { score+=2.5; bp+=2.5; bd.push({label:"S2 Win",pts:2.5}); }
  if (driver.fastestLap) { score+=2.5; bp+=2.5; bd.push({label:"Fast Lap",pts:2.5}); }
  if (driver.mostLapsLed) { score+=5; bp+=5; bd.push({label:"Most Led",pts:5}); }
  if (driver.pole && driver.stageWin1 && driver.stageWin2 && driver.finish === 1) { score+=10; bp+=10; bd.push({label:"SWEEP!",pts:10}); }
  return { total:Math.round(score*100)/100, breakdown:bd, bonusPoints:bp };
}

function scoreWeekFull(picks, raceResult, week, mullData) {
  const ty = SCHEDULE.find(s => s.w === week)?.ty || "intermediate";
  const ps = {};
  PLAYERS.forEach(p => {
    const pp = picks[p.id] || [];
    let wt=0, wb=0; const ds=[];
    pp.forEach(pick => {
      const r = raceResult.drivers?.find(d => d.name === pick.driver);
      if (!r) return;
      const im = pick.mulligan || mullData?.[p.id]?.some(m => m.week === week && m.driver === pick.driver);
      const sc = calcDriverScore(r, ty, im);
      wt += sc.total; wb += sc.bonusPoints;
      ds.push({ driver:pick.driver, total:sc.total, breakdown:sc.breakdown, bonusPoints:sc.bonusPoints, isMulligan:!!im });
    });
    ps[p.id] = { total:Math.round(wt*100)/100, bonusPoints:Math.round(wb*100)/100, drivers:ds, weeklyWin:false };
  });
  let mx=-Infinity, wn=null;
  Object.entries(ps).forEach(([id,s]) => { if(s.total>mx){mx=s.total;wn=id;} });
  if (wn) ps[wn].weeklyWin = true;
  return ps;
}

const C = { bg:"#0a0e17",card:"#111827",accent:"#f59e0b",accentDim:"#b45309",green:"#10b981",red:"#ef4444",blue:"#3b82f6",purple:"#8b5cf6",text:"#f1f5f9",dim:"#94a3b8",border:"#1e293b",input:"#0f172a" };
const PC = { justin:C.accent, bigmonroe:C.blue, monroe:C.green, rich:C.red };
const TTC = { superspeedway:C.blue, short_track:C.red, intermediate:C.accent, road_course:C.green };
const TTL = { superspeedway:"SS", short_track:"ST", intermediate:"INT", road_course:"RC" };

function LoginScreen({ onLogin }) {
  const [sel, setSel] = useState(null);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const go = () => { const p=PLAYERS.find(x=>x.id===sel); if(p&&pw===p.password)onLogin(p); else setErr("Wrong password"); };
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,"+C.bg+" 0%,#111 50%,#1a1000 100%)",fontFamily:"'Barlow Condensed','Oswald',sans-serif"}}>
      <div style={{background:C.card,borderRadius:16,padding:"40px 32px",width:340,maxWidth:"90vw",border:"1px solid "+C.border,boxShadow:"0 25px 60px rgba(0,0,0,0.5)"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontFamily:"'Racing Sans One',cursive",fontSize:42,color:C.accent,letterSpacing:3}}>FERDA</div>
          <div style={{color:C.dim,fontSize:13,letterSpacing:4,marginTop:4,textTransform:"uppercase"}}>Racing League</div>
        </div>
        <div style={{color:C.dim,fontSize:12,marginBottom:8,textTransform:"uppercase",letterSpacing:2}}>Select Player</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
          {PLAYERS.map(p=>(<button key={p.id} onClick={()=>{setSel(p.id);setErr("");}} style={{padding:"10px 0",borderRadius:8,border:"2px solid "+(sel===p.id?PC[p.id]:C.border),background:sel===p.id?PC[p.id]+"22":C.input,color:sel===p.id?PC[p.id]:C.dim,fontFamily:"inherit",fontSize:14,fontWeight:600,cursor:"pointer"}}>{p.name}</button>))}
        </div>
        {sel&&<><div style={{color:C.dim,fontSize:12,marginBottom:8,textTransform:"uppercase",letterSpacing:2}}>Password</div>
          <input type="password" value={pw} onChange={e=>{setPw(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="Enter password" style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid "+C.border,background:C.input,color:C.text,fontSize:15,fontFamily:"inherit",outline:"none",boxSizing:"border-box",marginBottom:16}}/></>}
        {err&&<div style={{color:C.red,fontSize:13,marginBottom:12,textAlign:"center"}}>{err}</div>}
        <button onClick={go} disabled={!sel||!pw} style={{width:"100%",padding:"12px 0",borderRadius:8,border:"none",background:sel&&pw?C.accent:C.border,color:sel&&pw?"#000":C.dim,fontFamily:"'Oswald',sans-serif",fontSize:16,fontWeight:700,letterSpacing:2,textTransform:"uppercase",cursor:sel&&pw?"pointer":"default"}}>Enter Garage</button>
      </div>
    </div>
  );
}

function Nav({player,tab,setTab,onLogout}) {
  const tabs=[{id:"standings",l:"Standings"},{id:"draft",l:"Draft"},{id:"results",l:"Results"},{id:"schedule",l:"Schedule"},{id:"mulligans",l:"Mulligans"},{id:"rules",l:"Rules"}];
  if(player.id==="justin") tabs.push({id:"commissioner",l:"Commish"});
  return (
    <nav style={{background:C.card,borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 12px",height:52,position:"sticky",top:0,zIndex:100,overflowX:"auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontFamily:"'Racing Sans One',cursive",fontSize:20,color:C.accent,flexShrink:0}}>FERDA</span>
        <div style={{display:"flex",gap:1}}>{tabs.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"7px 8px",borderRadius:6,border:"none",background:tab===t.id?C.accent+"22":"transparent",color:tab===t.id?C.accent:C.dim,fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:600,cursor:"pointer",letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap"}}>{t.l}</button>))}</div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
        <span style={{color:C.dim,fontSize:11}}>{player.name}</span>
        <button onClick={onLogout} style={{padding:"5px 8px",borderRadius:6,border:"1px solid "+C.border,background:"transparent",color:C.dim,fontFamily:"inherit",fontSize:10,cursor:"pointer"}}>Out</button>
      </div>
    </nav>
  );
}

function StandingsTab({data}) {
  const standings = useMemo(()=>PLAYERS.map(p=>({...p,pts:data.meta.standings[p.id]||0,pp:data.meta.playoffPts[p.id]||0,wins:Object.values(data.results||{}).filter(r=>r.scored?.[p.id]?.weeklyWin).length})).sort((a,b)=>b.pts-a.pts),[data]);
  return (
    <div style={{padding:20,maxWidth:900,margin:"0 auto"}}>
      <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:4}}>Season Standings</h2>
      <div style={{color:C.dim,fontSize:13,marginBottom:20}}>{Object.keys(data.results||{}).length} of 36 races scored</div>
      <div style={{display:"grid",gap:12}}>
        {standings.map((p,i)=>(
          <div key={p.id} style={{background:C.card,borderRadius:12,padding:"16px 20px",border:"1px solid "+(i===0?C.accent+"55":C.border),display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:38,height:38,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:i===0?C.accent:i===1?"#9ca3af":i===2?"#b45309":C.border,color:i<3?"#000":C.dim,fontWeight:700,fontSize:17,fontFamily:"'Oswald',sans-serif"}}>{i+1}</div>
              <div><div style={{color:C.text,fontWeight:700,fontSize:19,fontFamily:"'Barlow Condensed',sans-serif"}}>{p.name}</div><div style={{color:C.dim,fontSize:12}}>{p.wins} win{p.wins!==1?"s":""} · {p.pp} playoff pts</div></div>
            </div>
            <div style={{textAlign:"right"}}><div style={{color:PC[p.id],fontFamily:"'Oswald',sans-serif",fontSize:30,fontWeight:700}}>{p.pts}</div><div style={{color:C.dim,fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Points</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DraftTab({player, data, onDraftPick, currentWeek}) {
  const [search, setSearch] = useState("");
  const weekInfo = SCHEDULE.find(s => s.w === currentWeek);
  const draftKey = "w" + currentWeek;
  const draftOrder = useMemo(() => getDraftOrder(data, currentWeek), [data, currentWeek]);
  const snakeSequence = useMemo(() => buildSnakeOrder(draftOrder), [draftOrder]);
  const draftState = data.drafts?.[draftKey] || [];
  const currentPickNum = draftState.length;
  const draftComplete = currentPickNum >= snakeSequence.length;
  const currentTurn = !draftComplete ? snakeSequence[currentPickNum] : null;
  const isMyTurn = currentTurn?.pid === player.id;
  const takenDrivers = new Set(draftState.map(d => d.driver));
  const available = DRIVERS.filter(d => !takenDrivers.has(d) && d.toLowerCase().includes(search.toLowerCase()));
  const playerPicks = {};
  PLAYERS.forEach(p => { playerPicks[p.id] = []; });
  draftState.forEach(d => { if(playerPicks[d.pid]) playerPicks[d.pid].push(d.driver); });

  const handlePick = (driver) => {
    if (!isMyTurn || draftComplete) return;
    onDraftPick(currentWeek, player.id, driver, currentPickNum);
    setSearch("");
  };

  return (
    <div style={{padding:20,maxWidth:800,margin:"0 auto"}}>
      <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:4}}>Week {currentWeek} Draft</h2>
      {weekInfo && <div style={{color:C.dim,fontSize:14,marginBottom:12}}>{weekInfo.r} — {weekInfo.t} — <span style={{color:TTC[weekInfo.ty],fontWeight:600}}>{TTL[weekInfo.ty]} x{TRACK_MULTS[weekInfo.ty]}</span></div>}

      <div style={{background:C.card,borderRadius:10,padding:14,marginBottom:16,border:"1px solid "+C.border}}>
        <div style={{color:C.dim,fontSize:11,textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>Draft Order (last week's loser picks first)</div>
        <div style={{display:"flex",gap:8}}>
          {draftOrder.map((pid,i) => (
            <div key={pid} style={{flex:1,textAlign:"center",padding:"8px 4px",borderRadius:8,background:currentTurn?.pid===pid?PC[pid]+"33":C.input,border:"1px solid "+(currentTurn?.pid===pid?PC[pid]:C.border)}}>
              <div style={{fontSize:10,color:C.dim}}>#{i+1}</div>
              <div style={{fontSize:14,fontWeight:700,color:PC[pid]}}>{PNAME[pid]}</div>
            </div>
          ))}
        </div>
      </div>

      {!draftComplete ? (
        <div style={{background:isMyTurn?C.green+"22":C.card,borderRadius:10,padding:14,marginBottom:16,border:"1px solid "+(isMyTurn?C.green:C.border),textAlign:"center"}}>
          <div style={{fontSize:11,color:C.dim,textTransform:"uppercase",letterSpacing:2}}>Pick {currentPickNum+1} of {snakeSequence.length} · Round {currentTurn?.round}</div>
          <div style={{fontSize:20,fontWeight:700,color:isMyTurn?C.green:PC[currentTurn?.pid],marginTop:4}}>{isMyTurn ? "YOUR PICK!" : PNAME[currentTurn?.pid] + "'s Turn"}</div>
          {!isMyTurn && <div style={{fontSize:12,color:C.dim,marginTop:4}}>Waiting for {PNAME[currentTurn?.pid]}...</div>}
        </div>
      ) : (
        <div style={{background:C.accent+"22",borderRadius:10,padding:14,marginBottom:16,border:"1px solid "+C.accent+"44",textAlign:"center"}}>
          <div style={{fontSize:18,fontWeight:700,color:C.accent}}>Draft Complete!</div>
          <div style={{fontSize:12,color:C.dim,marginTop:4}}>All picks locked for Week {currentWeek}</div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16}}>
        {PLAYERS.map(p => (
          <div key={p.id} style={{background:C.card,borderRadius:10,padding:10,border:"1px solid "+C.border}}>
            <div style={{color:PC[p.id],fontWeight:700,fontSize:13,marginBottom:8,textAlign:"center"}}>{PNAME[p.id]}</div>
            {Array.from({length:PICKS_PER_WEEK}).map((_,i) => {
              const driver = playerPicks[p.id]?.[i];
              return (<div key={i} style={{background:driver?C.input:C.bg,borderRadius:6,padding:"6px 8px",marginBottom:4,border:"1px solid "+(driver?C.border:"rgba(255,255,255,0.03)"),minHeight:28,display:"flex",alignItems:"center"}}>
                <span style={{fontSize:10,color:C.dim,marginRight:6,fontWeight:700}}>R{i+1}</span>
                <span style={{fontSize:11,color:driver?C.text:C.dim+"44"}}>{driver||"—"}</span>
              </div>);
            })}
          </div>
        ))}
      </div>

      {isMyTurn && !draftComplete && <>
        <div style={{color:C.dim,fontSize:11,textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>Select a Driver</div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search drivers..." style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid "+C.border,background:C.input,color:C.text,fontSize:14,fontFamily:"inherit",outline:"none",marginBottom:8,boxSizing:"border-box"}}/>
        <div style={{maxHeight:300,overflowY:"auto",display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
          {available.map(d => (<button key={d} onClick={()=>handlePick(d)} style={{textAlign:"left",padding:"10px 12px",borderRadius:8,background:C.card,border:"1px solid "+C.border,color:C.text,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{d}</button>))}
        </div>
      </>}

      {draftState.length > 0 && <div style={{marginTop:16}}>
        <div style={{color:C.dim,fontSize:11,textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>Pick Log</div>
        <div style={{display:"flex",flexDirection:"column",gap:3}}>
          {[...draftState].reverse().map((d,i) => (
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:C.card,borderRadius:6,border:"1px solid "+C.border}}>
              <span style={{fontSize:10,color:C.dim,width:24}}>#{draftState.length-i}</span>
              <span style={{fontSize:12,color:PC[d.pid],fontWeight:600,width:80}}>{PNAME[d.pid]}</span>
              <span style={{fontSize:12,color:C.text}}>{d.driver}</span>
            </div>
          ))}
        </div>
      </div>}
    </div>
  );
}

function ResultsTab({data}) {
  const weeks = Object.keys(data.results||{}).map(k=>parseInt(k.replace("w",""))).sort((a,b)=>b-a);
  const [week, setWeek] = useState(weeks[0]||1);
  const wr = data.results?.["w"+week];
  const weekInfo = SCHEDULE.find(s=>s.w===week);
  const sorted = wr?.scored ? Object.entries(wr.scored).sort((a,b)=>b[1].total-a[1].total) : [];
  return (
    <div style={{padding:20,maxWidth:900,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,margin:0}}>Results</h2>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{weeks.map(w=>(<button key={w} onClick={()=>setWeek(w)} style={{padding:"6px 10px",borderRadius:6,border:"none",fontSize:11,fontWeight:700,cursor:"pointer",background:week===w?C.accent:"rgba(255,255,255,0.05)",color:week===w?"#000":C.dim}}>W{w}</button>))}</div>
      </div>
      {weekInfo&&<div style={{color:C.dim,fontSize:14,marginBottom:16}}>{weekInfo.r} · {weekInfo.t} · <span style={{color:TTC[weekInfo.ty]}}>{TTL[weekInfo.ty]} x{TRACK_MULTS[weekInfo.ty]}</span></div>}
      {sorted.length===0?<div style={{color:C.dim,textAlign:"center",padding:40}}>No results</div>
        :<div style={{display:"grid",gap:12}}>{sorted.map(([pid,ps],idx)=>(
          <div key={pid} style={{background:C.card,borderRadius:12,padding:"16px 20px",border:"1px solid "+(ps.weeklyWin?C.accent+"55":C.border)}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:(ps.drivers&&ps.drivers.length)?12:0}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{color:PC[pid],fontWeight:700,fontSize:17,fontFamily:"'Barlow Condensed',sans-serif"}}>{idx===0?"👑 ":""}{PNAME[pid]}</span>
                {ps.weeklyWin&&<span style={{background:C.accent+"22",color:C.accent,padding:"2px 10px",borderRadius:12,fontSize:10,fontWeight:700}}>WIN +30 PO</span>}
              </div>
              <span style={{color:PC[pid],fontFamily:"'Oswald',sans-serif",fontSize:26,fontWeight:700}}>{ps.total}</span>
            </div>
            {ps.historical&&(!ps.drivers||!ps.drivers.length)&&<div style={{color:C.dim,fontSize:12,fontStyle:"italic"}}>Imported from v12</div>}
            {ps.drivers&&ps.drivers.length>0&&<div style={{display:"grid",gap:6}}>{ps.drivers.map(d=>(
              <div key={d.driver} style={{background:C.input,borderRadius:8,padding:"8px 12px",border:"1px solid "+C.border}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:C.text,fontSize:13,fontWeight:600}}>{d.driver}{d.isMulligan?" 🔄":""}</span><span style={{color:d.total>=0?C.green:C.red,fontWeight:700,fontSize:13}}>{d.total}</span></div>
                <div style={{display:"flex",flexWrap:"wrap",gap:3}}>{(d.breakdown||[]).map((b,i)=>(<span key={i} style={{fontSize:9,color:b.pts>0?C.green:b.pts<0?C.red:C.dim,background:C.bg,padding:"2px 5px",borderRadius:4}}>{b.label}: {b.pts>0?"+":""}{b.pts}</span>))}</div>
              </div>
            ))}</div>}
          </div>
        ))}</div>}
    </div>
  );
}

function ScheduleTab({data}) {
  const scored = new Set(Object.keys(data.results||{}).map(k=>parseInt(k.replace("w",""))));
  return (
    <div style={{padding:20,maxWidth:700,margin:"0 auto"}}>
      <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:8}}>2026 Schedule</h2>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>{Object.entries(TTC).map(([t,c])=>(<span key={t} style={{fontSize:11,color:c,background:c+"18",padding:"3px 10px",borderRadius:12,fontWeight:600}}>{TTL[t]} x{TRACK_MULTS[t]}</span>))}</div>
      <div style={{display:"grid",gap:3}}>{SCHEDULE.map(s=>(
        <div key={s.w} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",borderRadius:8,background:s.w===PLAYOFF_START_WEEK?C.accent+"11":C.card,border:"1px solid "+(s.w>=PLAYOFF_START_WEEK?C.accent+"33":C.border)}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{color:scored.has(s.w)?C.green:C.dim,fontSize:11,width:36,fontWeight:700}}>{scored.has(s.w)?"✓ ":""}W{s.w}</span>
            <span style={{color:C.text,fontSize:13,fontWeight:600}}>{s.r}</span>
            {s.w===PLAYOFF_START_WEEK&&<span style={{fontSize:9,color:C.accent,fontWeight:700,letterSpacing:1}}>PLAYOFFS</span>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{color:C.dim,fontSize:10}}>{s.d}</span><span style={{fontSize:10,color:TTC[s.ty],fontWeight:600,background:TTC[s.ty]+"18",padding:"2px 8px",borderRadius:10}}>{TTL[s.ty]}</span></div>
        </div>
      ))}</div>
    </div>
  );
}

function MulligansTab({player,data}) {
  const used = data.meta.mulligansUsed[player.id]||0;
  return (
    <div style={{padding:20,maxWidth:700,margin:"0 auto"}}>
      <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:4}}>Mulligans</h2>
      <div style={{color:C.dim,fontSize:14,marginBottom:20}}>{MAX_MULLIGANS-used} of {MAX_MULLIGANS} remaining</div>
      <div style={{display:"flex",gap:6,marginBottom:20}}>{Array.from({length:MAX_MULLIGANS}).map((_,i)=>(<div key={i} style={{width:26,height:26,borderRadius:"50%",background:i<used?C.red+"33":C.green+"33",border:"2px solid "+(i<used?C.red:C.green),display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:i<used?C.red:C.green}}>{i<used?"✗":"✓"}</div>))}</div>
      {used===0&&<div style={{color:C.dim,fontSize:13}}>No mulligans used yet.</div>}
    </div>
  );
}

function RulesTab() {
  const rules=[{t:"Draft System",c:"Draft each week. Last week's loser picks first, winner picks last. Same order all 5 rounds — loser always gets first pick."},{t:"Finish Points",c:"P1: 50, P2: 40, P3: 36, P4: 35 down to P30: 6. P31-35: 5, P36: 4, P37: 3, P38: 2, P39: 1, P40: 0.5"},{t:"Stage Points",c:"Top 10 each stage: 1st=10, 2nd=9... 10th=1"},{t:"Laps Led",c:"Per lap led x track modifier: SS x1.0, INT x0.5, ST x0.2, RC x1.5"},{t:"Net Position",c:"+/-1 pt per spot gained/lost (qualifying to finish). Capped at +/-10."},{t:"Bonuses",c:"Pole: 5 | Stage Win: 2.5 | Fastest Lap: 2.5 | Most Laps Led: 5 | Led a Lap: 0.5/driver | Sweep: 10"},{t:"DNF / DQ",c:"DNF = 0 total. DQ = -5 points."},{t:"Weekly Win",c:"Highest scorer earns 30 playoff points."},{t:"Playoffs (W27+)",c:"Reset to 1,000 base. Weekly wins (x30) + bonus pts carry over."},{t:"Mulligans",c:"10/season. Replacement earns finish position points ONLY."}];
  return (
    <div style={{padding:20,maxWidth:700,margin:"0 auto"}}>
      <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:16}}>Scoring Rules</h2>
      {rules.map(r=>(<div key={r.t} style={{background:C.card,borderRadius:10,padding:"12px 16px",marginBottom:8,border:"1px solid "+C.border}}><div style={{color:C.accent,fontWeight:700,fontSize:13,marginBottom:3,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>{r.t}</div><div style={{color:C.dim,fontSize:13,lineHeight:1.5}}>{r.c}</div></div>))}
    </div>
  );
}

function CommissionerTab({data,onPostResults,currentWeek}) {
  const [week,setWeek] = useState(currentWeek);
  const [editing,setEditing] = useState(false);
  const [drivers,setDrivers] = useState([]);
  const [playerPicks,setPlayerPicks] = useState({justin:[],bigmonroe:[],monroe:[],rich:[]});
  const [saving,setSaving] = useState(false);
  const [msg,setMsg] = useState("");
  const race = SCHEDULE.find(s=>s.w===week);
  const done = !!(data.results?.["w"+week]);
  const isHistorical = data.results?.["w"+week]?.scored?.[PLAYERS[0].id]?.historical;

  // Load existing data when editing a scored week
  const startEdit = () => {
    const wr = data.results?.["w"+week];
    if (wr?.raw?.drivers) {
      setDrivers(wr.raw.drivers.map(d=>({...d,finish:String(d.finish),qualPos:String(d.qualPos),stage1:String(d.stage1||""),stage2:String(d.stage2||""),lapsLed:String(d.lapsLed||0)})));
    } else { setDrivers([]); }
    // Load picks
    const wp = data.picks?.["w"+week] || {};
    const pp = {};
    PLAYERS.forEach(p => {
      pp[p.id] = (wp[p.id]||[]).map(pk => ({driver:pk.driver, mulligan:pk.mulligan||false}));
    });
    setPlayerPicks(pp);
    setEditing(true); setMsg("");
  };

  const startNew = () => { setDrivers([]); setPlayerPicks({justin:[],bigmonroe:[],monroe:[],rich:[]}); setEditing(true); setMsg(""); };

  const addD = () => setDrivers([...drivers,{name:"",finish:"",qualPos:"",stage1:"",stage2:"",lapsLed:"0",pole:false,stageWin1:false,stageWin2:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false}]);
  const ud = (i,f,v) => {const n=[...drivers];n[i]={...n[i],[f]:v};setDrivers(n);};
  const rm = (i) => setDrivers(drivers.filter((_,j)=>j!==i));

  const addPick = (pid) => {
    if ((playerPicks[pid]||[]).length >= PICKS_PER_WEEK) return;
    setPlayerPicks({...playerPicks, [pid]:[...(playerPicks[pid]||[]),{driver:"",mulligan:false}]});
  };
  const updatePick = (pid,i,field,val) => {
    const np = {...playerPicks};
    np[pid] = [...np[pid]];
    np[pid][i] = {...np[pid][i],[field]:val};
    setPlayerPicks(np);
  };
  const removePick = (pid,i) => {
    const np = {...playerPicks};
    np[pid] = np[pid].filter((_,j)=>j!==i);
    setPlayerPicks(np);
  };

  const handleScore = async () => {
    setSaving(true); setMsg("");
    const rr = {drivers:drivers.map(d=>({name:d.name,finish:parseInt(d.finish)||40,qualPos:parseInt(d.qualPos)||40,stage1:parseInt(d.stage1)||0,stage2:parseInt(d.stage2)||0,lapsLed:parseInt(d.lapsLed)||0,pole:!!d.pole,stageWin1:!!d.stageWin1,stageWin2:!!d.stageWin2,fastestLap:!!d.fastestLap,mostLapsLed:!!d.mostLapsLed,dnf:!!d.dnf,dq:!!d.dq}))};
    const wp = {};
    PLAYERS.forEach(p => { wp[p.id] = (playerPicks[p.id]||[]).filter(pk=>pk.driver).map(pk=>({driver:pk.driver,mulligan:pk.mulligan})); });
    const mullOverride = {};
    PLAYERS.forEach(p => {
      mullOverride[p.id] = (playerPicks[p.id]||[]).filter(pk=>pk.mulligan).map(pk=>({week,driver:pk.driver}));
    });
    const scored = scoreWeekFull(wp, rr, week, mullOverride);
    await onPostResults(week, scored, rr, wp);
    setMsg("Week "+week+" "+(done?"updated":"scored")+"! Standings recalculated.");
    setSaving(false); setEditing(false);
  };

  const iS = {padding:"6px 8px",borderRadius:6,border:"1px solid "+C.border,background:C.input,color:C.text,fontSize:13,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box"};

  return (
    <div style={{padding:20,maxWidth:1000,margin:"0 auto"}}>
      <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:4}}>Commissioner Panel</h2>
      <div style={{color:C.dim,fontSize:13,marginBottom:16}}>Score new weeks or edit past results</div>

      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
        <span style={{color:C.dim,fontSize:13}}>Week:</span>
        <select value={week} onChange={e=>{setWeek(Number(e.target.value));setEditing(false);setMsg("");}} style={{...iS,width:80}}>{SCHEDULE.map(s=><option key={s.w} value={s.w}>{s.w}</option>)}</select>
        {race&&<span style={{color:C.dim,fontSize:13}}>{race.r} · {TTL[race.ty]} x{TRACK_MULTS[race.ty]}</span>}
        {done&&!editing&&<span style={{color:C.green,fontSize:13,fontWeight:700}}>✓ Scored</span>}
      </div>

      {/* Action buttons when not editing */}
      {!editing && <div style={{display:"flex",gap:8,marginBottom:16}}>
        {done && <button onClick={startEdit} style={{padding:"10px 20px",borderRadius:8,border:"1px solid "+C.accent,background:C.accent+"22",color:C.accent,fontSize:13,fontFamily:"inherit",fontWeight:600,cursor:"pointer"}}>Edit Week {week}</button>}
        {!done && <button onClick={startNew} style={{padding:"10px 20px",borderRadius:8,border:"1px solid "+C.green,background:C.green+"22",color:C.green,fontSize:13,fontFamily:"inherit",fontWeight:600,cursor:"pointer"}}>Score Week {week}</button>}
      </div>}

      {/* Editing mode */}
      {editing && <>
        {/* Player Picks Editor */}
        <div style={{marginBottom:20}}>
          <div style={{color:C.accent,fontSize:14,fontWeight:700,marginBottom:10,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1,textTransform:"uppercase"}}>Player Picks</div>
          {PLAYERS.map(p => (
            <div key={p.id} style={{background:C.card,borderRadius:10,padding:12,marginBottom:8,border:"1px solid "+C.border}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <span style={{color:PC[p.id],fontWeight:700,fontSize:14}}>{PNAME[p.id]} ({(playerPicks[p.id]||[]).length}/{PICKS_PER_WEEK})</span>
                {(playerPicks[p.id]||[]).length < PICKS_PER_WEEK && <button onClick={()=>addPick(p.id)} style={{padding:"4px 10px",borderRadius:6,border:"1px solid "+C.accent+"66",background:C.accent+"11",color:C.accent,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>+ Driver</button>}
              </div>
              {(playerPicks[p.id]||[]).map((pk,i) => (
                <div key={i} style={{display:"flex",gap:6,alignItems:"center",marginBottom:4}}>
                  <select value={pk.driver} onChange={e=>updatePick(p.id,i,"driver",e.target.value)} style={{...iS,flex:1}}>
                    <option value="">Select driver</option>
                    {DRIVERS.map(dr=><option key={dr} value={dr}>{dr}</option>)}
                  </select>
                  <label style={{display:"flex",alignItems:"center",gap:3,cursor:"pointer",fontSize:11,color:pk.mulligan?C.accent:C.dim,flexShrink:0}}>
                    <input type="checkbox" checked={!!pk.mulligan} onChange={e=>updatePick(p.id,i,"mulligan",e.target.checked)}/>M
                  </label>
                  <button onClick={()=>removePick(p.id,i)} style={{background:C.red+"22",border:"1px solid "+C.red+"44",borderRadius:6,color:C.red,padding:"4px 8px",fontSize:10,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>X</button>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Race Results Editor */}
        <div style={{color:C.accent,fontSize:14,fontWeight:700,marginBottom:10,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1,textTransform:"uppercase"}}>Race Results</div>
        <button onClick={addD} style={{padding:"8px 16px",borderRadius:6,border:"1px solid "+C.accent,background:C.accent+"22",color:C.accent,fontSize:13,fontFamily:"inherit",fontWeight:600,cursor:"pointer",marginBottom:12}}>+ Add Driver Result</button>
        {drivers.map((d,i)=>(
          <div key={i} style={{background:C.card,borderRadius:10,padding:14,marginBottom:8,border:"1px solid "+C.border}}>
            <div style={{display:"flex",gap:6,marginBottom:8,alignItems:"center",flexWrap:"wrap"}}>
              <select value={d.name} onChange={e=>ud(i,"name",e.target.value)} style={{...iS,flex:"2 1 140px"}}><option value="">Select driver</option>{DRIVERS.map(dr=><option key={dr} value={dr}>{dr}</option>)}</select>
              <input placeholder="Fin" type="number" value={d.finish} onChange={e=>ud(i,"finish",e.target.value)} style={{...iS,flex:"0 1 55px"}}/>
              <input placeholder="Qual" type="number" value={d.qualPos} onChange={e=>ud(i,"qualPos",e.target.value)} style={{...iS,flex:"0 1 55px"}}/>
              <input placeholder="S1" type="number" value={d.stage1} onChange={e=>ud(i,"stage1",e.target.value)} style={{...iS,flex:"0 1 45px"}}/>
              <input placeholder="S2" type="number" value={d.stage2} onChange={e=>ud(i,"stage2",e.target.value)} style={{...iS,flex:"0 1 45px"}}/>
              <input placeholder="Led" type="number" value={d.lapsLed} onChange={e=>ud(i,"lapsLed",e.target.value)} style={{...iS,flex:"0 1 55px"}}/>
              <button onClick={()=>rm(i)} style={{background:C.red+"22",border:"1px solid "+C.red+"44",borderRadius:6,color:C.red,padding:"6px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>X</button>
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
              {[["pole","Pole"],["stageWin1","S1 Win"],["stageWin2","S2 Win"],["fastestLap","Fast Lap"],["mostLapsLed","Most Led"],["dnf","DNF"],["dq","DQ"]].map(([f,l])=>(<label key={f} style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",fontSize:12,color:d[f]?C.text:C.dim}}><input type="checkbox" checked={!!d[f]} onChange={e=>ud(i,f,e.target.checked)}/>{l}</label>))}
            </div>
          </div>
        ))}

        <div style={{display:"flex",gap:8,marginTop:12}}>
          <button onClick={handleScore} disabled={saving} style={{flex:1,padding:"14px 0",borderRadius:8,border:"none",background:C.accent,color:"#000",fontFamily:"'Oswald',sans-serif",fontSize:16,fontWeight:700,letterSpacing:2,textTransform:"uppercase",cursor:"pointer"}}>{saving?"Saving...":(done?"Re-Score Week "+week:"Score Week "+week)}</button>
          <button onClick={()=>setEditing(false)} style={{padding:"14px 20px",borderRadius:8,border:"1px solid "+C.border,background:"transparent",color:C.dim,fontFamily:"'Oswald',sans-serif",fontSize:14,cursor:"pointer"}}>Cancel</button>
        </div>
        {msg&&<div style={{color:C.green,marginTop:10,textAlign:"center",fontSize:14}}>{msg}</div>}
      </>}

      {/* Show current results summary when not editing */}
      {done && !editing && (() => {
        const wr = data.results["w"+week];
        const sorted = Object.entries(wr.scored||{}).sort((a,b)=>b[1].total-a[1].total);
        return <div style={{marginTop:8}}>
          <div style={{color:C.dim,fontSize:11,textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>Current Scores</div>
          {sorted.map(([pid,ps])=>(
            <div key={pid} style={{display:"flex",justifyContent:"space-between",padding:"8px 12px",background:C.card,borderRadius:8,marginBottom:4,border:"1px solid "+(ps.weeklyWin?C.accent+"44":C.border)}}>
              <span style={{color:PC[pid],fontWeight:600,fontSize:14}}>{ps.weeklyWin?"👑 ":""}{PNAME[pid]}</span>
              <span style={{color:PC[pid],fontWeight:700,fontSize:16}}>{ps.total}</span>
            </div>
          ))}
        </div>;
      })()}

      {msg&&!editing&&<div style={{color:C.green,marginTop:10,textAlign:"center",fontSize:14}}>{msg}</div>}
    </div>
  );
}

export default function App() {
  const [user,setUser] = useState(null);
  const [tab,setTab] = useState("standings");
  const [data,setData] = useState(null);
  const [loading,setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState("connecting");

  useEffect(()=>{
    let unsub = null;
    (async()=>{
      try {
        let d = await loadLeagueData();
        if(d) setDbStatus("connected");
        else { d = loadLocalBackup(); if(d) setDbStatus("offline"); }
        if(!d){ d = buildInitialData(); setDbStatus(isFirebaseReady()?"new":"offline"); await saveLeagueData(d); }
        setData(d); setLoading(false);
        unsub = subscribeToLeagueData((u) => { setData(u); setDbStatus("connected"); });
      } catch(e) {
        console.error("Startup error:", e);
        setData(loadLocalBackup() || buildInitialData()); setLoading(false); setDbStatus("offline");
      }
    })();
    return () => { if(unsub) unsub(); };
  },[]);

  const currentWeek = useMemo(()=>data?(data.meta.lastScoredWeek||7)+1:8,[data]);

  const handleDraftPick = async(week, pid, driver, pickNum) => {
    const d = JSON.parse(JSON.stringify(data));
    if(!d.drafts) d.drafts = {};
    const key = "w"+week;
    if(!d.drafts[key]) d.drafts[key] = [];
    d.drafts[key].push({ pid, driver, pickNum });
    setData(d);
    await saveLeagueData(d);
  };

  const handlePostResults = async(week, scored, rr, wp) => {
    const d = JSON.parse(JSON.stringify(data));
    if(!d.results) d.results = {};
    if(!d.picks) d.picks = {};
    d.results["w"+week] = { scored, raw: rr };
    d.picks["w"+week] = wp;

    // FULL RECALCULATE: rebuild standings from ALL scored weeks
    const freshStandings = {justin:0,bigmonroe:0,monroe:0,rich:0};
    const freshPlayoff = {justin:0,bigmonroe:0,monroe:0,rich:0};
    let lastScored = 0;

    // Include historical base for weeks without raw data
    Object.entries(d.results).forEach(([key,wr]) => {
      const w = parseInt(key.replace("w",""));
      if (w > lastScored) lastScored = w;
      if (!wr.scored) return;
      Object.entries(wr.scored).forEach(([pid,s]) => {
        freshStandings[pid] = Math.round((freshStandings[pid] + s.total) * 100) / 100;
        freshPlayoff[pid] = Math.round((freshPlayoff[pid] + (s.bonusPoints||0)) * 100) / 100;
        if (s.weeklyWin) freshPlayoff[pid] = Math.round((freshPlayoff[pid] + 30) * 100) / 100;
      });
    });

    d.meta.standings = freshStandings;
    d.meta.playoffPts = freshPlayoff;
    d.meta.lastScoredWeek = lastScored;

    // Count mulligans used across all weeks
    const mullCounts = {justin:0,bigmonroe:0,monroe:0,rich:0};
    Object.entries(d.picks).forEach(([key,weekPicks]) => {
      Object.entries(weekPicks).forEach(([pid,picks]) => {
        (picks||[]).forEach(pk => { if(pk.mulligan) mullCounts[pid]++; });
      });
    });
    d.meta.mulligansUsed = mullCounts;

    setData(d); await saveLeagueData(d);
  };

  if(loading) return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:C.bg,gap:12}}>
      <div style={{color:C.accent,fontFamily:"'Racing Sans One',cursive",fontSize:32}}>FERDA</div>
      <div style={{color:C.dim,fontSize:13}}>Connecting to database...</div>
      <div style={{color:C.dim,fontSize:11,marginTop:8}}>If this takes more than 10 seconds, check browser console (F12)</div>
    </div>
  );
  if(!user) return <LoginScreen onLogin={setUser}/>;
  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Barlow Condensed',sans-serif",color:C.text}}>
      <Nav player={user} tab={tab} setTab={setTab} onLogout={()=>setUser(null)}/>
      {dbStatus==="offline"&&<div style={{background:C.red+"22",color:C.red,textAlign:"center",padding:"6px",fontSize:11,fontWeight:600}}>OFFLINE MODE — Firebase not connected</div>}
      {tab==="standings"&&<StandingsTab data={data}/>}
      {tab==="draft"&&<DraftTab player={user} data={data} onDraftPick={handleDraftPick} currentWeek={currentWeek}/>}
      {tab==="results"&&<ResultsTab data={data}/>}
      {tab==="schedule"&&<ScheduleTab data={data}/>}
      {tab==="mulligans"&&<MulligansTab player={user} data={data}/>}
      {tab==="rules"&&<RulesTab/>}
      {tab==="commissioner"&&user.id==="justin"&&<CommissionerTab data={data} onPostResults={handlePostResults} currentWeek={currentWeek}/>}
    </div>
  );
}
