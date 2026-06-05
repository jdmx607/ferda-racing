import { useState, useEffect, useMemo } from "react";
import { loadLeagueData, saveLeagueData, subscribeToLeagueData, loadLocalBackup, isFirebaseReady } from "./firebase";
import { sendDraftEmail, isEmailConfigured, DEFAULT_EMAILS } from "./email";
import { fetchNASCARResults, fetchLiveRaceData, fetchDriverProjections } from "./nascar";
import {
  PLAYERS, PNAME, TRACK_MULTS, ACTIVE_PICKS, PICKS_PER_WEEK, MAX_MULLIGANS,
  PLAYOFF_START_WEEK, REG_SEASON_CHAMP_BONUS, GARAGE_PICK_ENABLED,
  MEMORIAL_DRIVERS, SCHEDULE, DRIVERS, DRIVER_INFO, MAKE_COLORS, isMemorial,
} from "./constants";
import { scoreWeekFull, scoreAllWeeks, buildInitialData } from "./engine/scoring";
import { getDraftOrder, buildSnakeOrder } from "./engine/draft";

// ─── LIVE SCORING ────────────────────────────────────────────────
// Firestore stores a liveRace flag: { active: bool, week: int, lastFetch: string }
// When active, app polls every 30s and shows provisional live standings.
const LIVE_POLL_INTERVAL = 30000; // 30 seconds



const C = {bg:"#0a0e17",card:"#111827",accent:"#f59e0b",green:"#10b981",red:"#ef4444",blue:"#3b82f6",purple:"#8b5cf6",text:"#f1f5f9",dim:"#94a3b8",border:"#1e293b",input:"#0f172a"};
const PClr = {
  justin:{bg:"#000000",fg:"#CFC493"},
  bigmonroe:{bg:"#DC0019",fg:"#FFFFFF"},
  monroe:{bg:"#046A38",fg:"#91999F"},
  rich:{bg:"#B3995D",fg:"#AA0000"},
};
const PC = {justin:PClr.justin.fg,bigmonroe:"#ef4444",monroe:PClr.monroe.fg,rich:PClr.rich.fg};
const TTC = {superspeedway:C.blue,short_track:C.red,intermediate:C.accent,road_course:C.green};
const TTL = {superspeedway:"SS",short_track:"ST",intermediate:"INT",road_course:"RC"};

function FerdaLogo({size="large"}) {
  const lg = size==="large";
  const fs = lg ? 52 : 22;
  const sh = lg ? 40 : 16;
  const sw = lg ? 4 : 2;
  const gap = lg ? 3 : 1.5;
  const stripeColors = ["#ffcf00","#ff0000","#ff0000","#0077c8","#0077c8"];
  return (<div style={{display:"inline-flex",alignItems:"center",gap:lg?4:2}}>
    <div style={{display:"flex",gap:gap,transform:"skewX(-12deg)"}}>
      {stripeColors.map((c,i)=>(<div key={i} style={{width:sw,height:sh,background:c,borderRadius:1}}/>))}
    </div>
    <span style={{fontFamily:"'Oswald',sans-serif",fontSize:fs,fontWeight:900,fontStyle:"italic",color:"#ffffff",letterSpacing:lg?4:2,lineHeight:1,transform:"skewX(-6deg)"}}>FERDA</span>
  </div>);
}

// Subtle stylized #8 memorial backdrop for Kyle Busch
function MemorialBackdrop() {
  return (<div aria-hidden style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
    <svg viewBox="0 0 200 260" style={{width:"min(70vw,520px)",opacity:0.05}} xmlns="http://www.w3.org/2000/svg">
      <text x="100" y="205" textAnchor="middle" fontFamily="'Oswald',sans-serif" fontSize="240" fontWeight="900" fontStyle="italic"
        fill="none" stroke="#ffffff" strokeWidth="6">8</text>
    </svg>
  </div>);
}

function FlagBanner({user,data,currentWeek,onGoTo}) {
  if(!user||!data) return null;
  const draftKey="w"+currentWeek;
  const draftState=data.drafts?.[draftKey]||[];
  const draftOrder=getDraftOrder(data,currentWeek);
  const snakeSequence=buildSnakeOrder(draftOrder);
  const currentPickNum=draftState.length;
  const draftComplete=currentPickNum>=snakeSequence.length;
  const savedPicks=data.picks?.[draftKey]||{};
  const hasSavedPicks=Object.values(savedPicks).some(p=>p&&p.length>0);
  const hasScored=!!(data.results?.[draftKey]?.scored);

  if(draftState.length===0&&!hasSavedPicks&&!hasScored){
    const firstUp=snakeSequence[0]?.pid;
    if(firstUp===user.id) return <Banner flag="green" text={"Your turn to pick first for Week "+currentWeek+"!"} onClick={()=>onGoTo("draft")}/>;
    return null;
  }
  if(hasScored) return <Banner flag="checkered" text={"Week "+currentWeek+" is complete. Results posted."} onClick={()=>onGoTo("results")}/>;
  if(draftComplete||(hasSavedPicks&&draftState.length===0)) return <Banner flag="checkered" text={"All picks locked for Week "+currentWeek+". Race day!"} onClick={()=>onGoTo("lineups")}/>;

  const currentTurn=snakeSequence[currentPickNum];
  const nextTurn=snakeSequence[currentPickNum+1];
  const lastRound=currentTurn?.round===ACTIVE_PICKS;
  if(currentTurn?.pid===user.id) return <Banner flag={lastRound?"white":"green"} text={lastRound?"FINAL ROUND — Your pick!":"Your turn to pick!"} onClick={()=>onGoTo("draft")}/>;
  if(nextTurn?.pid===user.id) return <Banner flag="yellow" text={"You're up next after "+PNAME[currentTurn.pid]}/>;
  return <Banner flag="red" text={"Waiting on "+PNAME[currentTurn.pid]+" to pick"}/>;
}
function Banner({flag,text,onClick}){
  const flags={green:{bg:"#10b981",fg:"#000",icon:"🟢"},yellow:{bg:"#fbbf24",fg:"#000",icon:"🟡"},red:{bg:"#dc2626",fg:"#fff",icon:"🔴"},white:{bg:"#f8fafc",fg:"#000",icon:"⚪"},checkered:{bg:"#1f2937",fg:"#fff",icon:"🏁"}};
  const f=flags[flag];
  const checkeredBg = flag==="checkered" ? "repeating-linear-gradient(45deg, #1f2937 0px, #1f2937 10px, #f8fafc 10px, #f8fafc 20px)" : f.bg;
  return (<div onClick={onClick} style={{background:checkeredBg,color:f.fg,padding:"10px 16px",textAlign:"center",fontFamily:"'Oswald',sans-serif",fontWeight:700,fontSize:14,letterSpacing:1,textTransform:"uppercase",cursor:onClick?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",gap:10,borderBottom:"2px solid rgba(0,0,0,0.3)",position:"relative",zIndex:1,animation:flag==="green"?"pulse 2s infinite":"none"}}>
    <span style={{fontSize:20}}>{f.icon}</span>
    <span style={{background:flag==="checkered"?"rgba(0,0,0,0.6)":"transparent",padding:flag==="checkered"?"4px 10px":0,borderRadius:6}}>{text}</span>
    {onClick&&<span style={{fontSize:11,opacity:0.7,marginLeft:4}}>→</span>}
  </div>);
}

// Helper: find last week's winner and loser from scored results
function getLastWeekResults(data) {
  const weeks=Object.keys(data.results||{}).map(k=>parseInt(k.replace("w",""))).sort((a,b)=>b-a);
  if(!weeks.length) return null;
  const key="w"+weeks[0];
  const scored=data.results[key]?.scored;
  if(!scored) return null;
  const sorted=Object.entries(scored).sort((a,b)=>b[1].total-a[1].total);
  return { week:weeks[0], winner:sorted[0]?.[0], loser:sorted[sorted.length-1]?.[0], scores:scored };
}

function WinnerModal({player, data, onDismiss}) {
  const last=getLastWeekResults(data);
  if(!last||last.winner!==player.id) return null;
  const raceInfo=SCHEDULE.find(s=>s.w===last.week);
  return (<div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.85)"}} onClick={onDismiss}>
    <div style={{background:PClr[player.id].bg,borderRadius:20,padding:"40px 32px",maxWidth:340,width:"90vw",textAlign:"center",border:"3px solid "+C.accent,boxShadow:"0 0 60px "+C.accent+"66"}} onClick={e=>e.stopPropagation()}>
      <div style={{fontSize:64,marginBottom:12}}>🏆</div>
      <div style={{color:C.accent,fontFamily:"'Oswald',sans-serif",fontSize:13,letterSpacing:3,textTransform:"uppercase",marginBottom:4}}>Weekly Winner</div>
      <div style={{color:PClr[player.id].fg,fontFamily:"'Oswald',sans-serif",fontSize:36,fontWeight:900,marginBottom:4}}>{player.name}</div>
      {raceInfo&&<div style={{color:PClr[player.id].fg+"88",fontSize:13,marginBottom:4}}>{raceInfo.r}</div>}
      <div style={{color:C.accent,fontFamily:"'Oswald',sans-serif",fontSize:20,fontWeight:700,marginBottom:4}}>+25 Playoff Points</div>
      <div style={{color:PClr[player.id].fg+"66",fontSize:12,marginBottom:24}}>{last.scores[player.id]?.total} pts scored</div>
      <button onClick={onDismiss} style={{width:"100%",padding:"12px 0",borderRadius:10,border:"none",background:C.accent,color:"#000",fontFamily:"'Oswald',sans-serif",fontSize:15,fontWeight:700,letterSpacing:2,textTransform:"uppercase",cursor:"pointer"}}>LET'S RACE 🏁</button>
    </div>
  </div>);
}

function LoginScreen({onLogin}) {
  const [sel,setSel]=useState(null); const [pw,setPw]=useState(""); const [err,setErr]=useState("");
  const go=()=>{const p=PLAYERS.find(x=>x.id===sel);if(p&&pw===p.password)onLogin(p);else setErr("Wrong password");};
  return (<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(135deg,"+C.bg+" 0%,#111 50%,#1a1000 100%)"}}>
    <div style={{background:C.card,borderRadius:16,padding:"40px 32px",width:340,maxWidth:"90vw",border:"1px solid "+C.border,boxShadow:"0 25px 60px rgba(0,0,0,0.5)"}}>
      <div style={{textAlign:"center",marginBottom:28}}><FerdaLogo size="large"/><div style={{color:C.dim,fontSize:13,letterSpacing:4,marginTop:8,textTransform:"uppercase"}}>Racing League</div></div>
      <div style={{color:C.dim,fontSize:12,marginBottom:8,textTransform:"uppercase",letterSpacing:2}}>Select Player</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>{PLAYERS.map(p=>(<button key={p.id} onClick={()=>{setSel(p.id);setErr("");}} style={{padding:"10px 0",borderRadius:8,border:"2px solid "+(sel===p.id?PClr[p.id].fg:C.border),background:sel===p.id?PClr[p.id].bg:C.input,color:sel===p.id?PClr[p.id].fg:C.dim,fontFamily:"inherit",fontSize:14,fontWeight:600,cursor:"pointer"}}>{p.name}</button>))}</div>
      {sel&&<><div style={{color:C.dim,fontSize:12,marginBottom:8,textTransform:"uppercase",letterSpacing:2}}>Password</div><input type="password" value={pw} onChange={e=>{setPw(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="Enter password" style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid "+C.border,background:C.input,color:C.text,fontSize:15,fontFamily:"inherit",outline:"none",boxSizing:"border-box",marginBottom:16}}/></>}
      {err&&<div style={{color:C.red,fontSize:13,marginBottom:12,textAlign:"center"}}>{err}</div>}
      <button onClick={go} disabled={!sel||!pw} style={{width:"100%",padding:"12px 0",borderRadius:8,border:"none",background:sel&&pw?C.accent:C.border,color:sel&&pw?"#000":C.dim,fontFamily:"'Oswald',sans-serif",fontSize:16,fontWeight:700,letterSpacing:2,textTransform:"uppercase",cursor:sel&&pw?"pointer":"default"}}>Enter Garage</button>
      <div style={{marginTop:24,paddingTop:16,borderTop:"1px solid "+C.border,textAlign:"center"}}>
        <div style={{color:C.dim,fontSize:11,letterSpacing:1}}>🕊️ In loving memory of</div>
        <div style={{color:C.text,fontSize:14,fontWeight:700,marginTop:2}}>Kyle Busch · #8</div>
        <div style={{color:C.dim,fontSize:11,marginTop:1}}>{MEMORIAL_DRIVERS["#8 Kyle Busch"].years}</div>
      </div>
    </div></div>);
}

function Nav({player,tab,setTab,onLogout}) {
  const tabs=[
    {id:"welcome",l:"Home"},
    {id:"draft",l:"Draft"},
    {id:"lineups",l:"Lineups"},
    {id:"mulligans",l:"Mulligans"},
    {id:"live",l:"🔴 Live"},
    {id:"results",l:"Results"},
    {id:"playoffs",l:"Playoffs"},
    {id:"projections",l:"Projections"},
    {id:"schedule",l:"Schedule"},
    {id:"rules",l:"Rules"},
    {id:"settings",l:"Settings"},
  ];
  if(player.id==="justin") tabs.push({id:"commissioner",l:"COMMISH",red:true});
  return (<nav style={{background:"#000000",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 12px",height:52,position:"sticky",top:0,zIndex:100,overflowX:"auto"}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}><FerdaLogo size="small"/><div style={{display:"flex",gap:1}}>{tabs.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"7px 8px",borderRadius:6,border:t.red?"1px solid #ef4444":"none",background:tab===t.id?(t.red?"#ef4444":C.accent+"22"):"transparent",color:tab===t.id?(t.red?"#fff":C.accent):(t.red?"#ef4444":C.dim),fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:t.red?700:600,cursor:"pointer",letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap"}}>{t.l}</button>))}</div></div>
    <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}><span style={{color:C.dim,fontSize:11}}>{player.name}</span><button onClick={onLogout} style={{padding:"5px 8px",borderRadius:6,border:"1px solid "+C.border,background:"transparent",color:C.dim,fontFamily:"inherit",fontSize:10,cursor:"pointer"}}>Out</button></div>
  </nav>);
}

function WelcomeTab({player, data, setTab, liveScores, liveStatus}) {
  const standings=useMemo(()=>PLAYERS.map(p=>({...p,pts:data.meta.standings[p.id]||0,pp:data.meta.playoffPts[p.id]||0,wins:Object.values(data.results||{}).filter(r=>r.scored?.[p.id]?.weeklyWin).length})).sort((a,b)=>b.pts-a.pts),[data]);
  const lastWeekKey=Object.keys(data.results||{}).map(k=>parseInt(k.replace("w",""))).sort((a,b)=>b-a)[0];
  const lastWeek=lastWeekKey?data.results["w"+lastWeekKey]:null;
  const lastRaceInfo=SCHEDULE.find(s=>s.w===lastWeekKey);
  const nextRace=SCHEDULE.find(s=>!data.results?.["w"+s.w]);
  const myStats=standings.find(s=>s.id===player.id);
  const myRank=standings.findIndex(s=>s.id===player.id)+1;
  const greetings=["Welcome back","Good to see you","Ready to race"];
  const greeting=greetings[Math.floor(Date.now()/86400000)%greetings.length];

  return (<div style={{padding:20,maxWidth:900,margin:"0 auto",position:"relative",zIndex:1}}>
    {/* Hero greeting */}
    <div style={{background:PClr[player.id].bg,borderRadius:16,padding:"24px 24px 20px",marginBottom:20,border:"2px solid "+(PClr[player.id].bg==="#000000"?C.border:PClr[player.id].bg+"88")}}>
      <div style={{color:PClr[player.id].fg+"88",fontSize:13,textTransform:"uppercase",letterSpacing:3,marginBottom:4}}>{greeting}</div>
      <div style={{color:PClr[player.id].fg,fontFamily:"'Oswald',sans-serif",fontSize:34,fontWeight:900,letterSpacing:2}}>{player.name}</div>
      <div style={{display:"flex",gap:16,marginTop:14,flexWrap:"wrap"}}>
        <div style={{background:"rgba(0,0,0,0.25)",borderRadius:10,padding:"10px 16px",flex:1,minWidth:80,textAlign:"center"}}>
          <div style={{color:PClr[player.id].fg,fontFamily:"'Oswald',sans-serif",fontSize:26,fontWeight:700}}>{myStats?.pts||0}</div>
          <div style={{color:PClr[player.id].fg+"88",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Points</div>
        </div>
        <div style={{background:"rgba(0,0,0,0.25)",borderRadius:10,padding:"10px 16px",flex:1,minWidth:80,textAlign:"center"}}>
          <div style={{color:PClr[player.id].fg,fontFamily:"'Oswald',sans-serif",fontSize:26,fontWeight:700}}>#{myRank}</div>
          <div style={{color:PClr[player.id].fg+"88",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Rank</div>
        </div>
        <div style={{background:"rgba(0,0,0,0.25)",borderRadius:10,padding:"10px 16px",flex:1,minWidth:80,textAlign:"center"}}>
          <div style={{color:PClr[player.id].fg,fontFamily:"'Oswald',sans-serif",fontSize:26,fontWeight:700}}>{myStats?.wins||0}</div>
          <div style={{color:PClr[player.id].fg+"88",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Wins</div>
        </div>
        <div style={{background:"rgba(0,0,0,0.25)",borderRadius:10,padding:"10px 16px",flex:1,minWidth:80,textAlign:"center"}}>
          <div style={{color:C.accent,fontFamily:"'Oswald',sans-serif",fontSize:26,fontWeight:700}}>{myStats?.pp||0}</div>
          <div style={{color:PClr[player.id].fg+"88",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Playoff Pts</div>
        </div>
        <div style={{background:"rgba(0,0,0,0.25)",borderRadius:10,padding:"10px 16px",flex:1,minWidth:80,textAlign:"center"}}>
          <div style={{color:C.red,fontFamily:"'Oswald',sans-serif",fontSize:26,fontWeight:700}}>{MAX_MULLIGANS-(data.meta.mulligansUsed[player.id]||0)}</div>
          <div style={{color:PClr[player.id].fg+"88",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Mulligans</div>
        </div>
      </div>
    </div>

    {/* Standings mini-table */}
    <div style={{marginBottom:20}}>
      <div style={{color:C.dim,fontSize:11,textTransform:"uppercase",letterSpacing:2,marginBottom:8,fontWeight:700}}>Season Standings · {Object.keys(data.results||{}).length} of 36 races</div>
      <div style={{display:"grid",gap:6}}>{standings.map((p,i)=>(
        <div key={p.id} style={{background:PClr[p.id].bg,borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",border:"1px solid "+(p.id===player.id?C.accent:PClr[p.id].bg==="#000000"?C.border:PClr[p.id].bg+"55")}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:PClr[p.id].fg,color:PClr[p.id].bg,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:13,fontFamily:"'Oswald',sans-serif"}}>{i+1}</div>
            <div style={{color:PClr[p.id].fg,fontWeight:700,fontSize:15,fontFamily:"'Barlow Condensed',sans-serif"}}>{p.name}{p.id===player.id?<span style={{color:C.accent,fontSize:11,marginLeft:6}}>YOU</span>:""}</div>
          </div>
          <div style={{display:"flex",gap:16,alignItems:"center"}}>
            <div style={{textAlign:"right"}}><div style={{color:PClr[p.id].fg,fontFamily:"'Oswald',sans-serif",fontSize:18,fontWeight:700}}>{p.pts}</div><div style={{color:PClr[p.id].fg+"88",fontSize:9,textTransform:"uppercase"}}>pts</div></div>
            <div style={{textAlign:"right"}}><div style={{color:C.accent,fontFamily:"'Oswald',sans-serif",fontSize:14,fontWeight:700}}>+{p.pp}</div><div style={{color:PClr[p.id].fg+"88",fontSize:9,textTransform:"uppercase"}}>playoff</div></div>
          </div>
        </div>
      ))}</div>
    </div>

    {/* Live race widget — shows when active */}
    {data?.liveRace?.active&&liveScores&&<div style={{marginBottom:20}}>
      <div style={{background:"linear-gradient(90deg,#ef4444,#f59e0b)",borderRadius:10,padding:"10px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}} onClick={()=>setTab("live")}>
        <div style={{color:"#000",fontWeight:900,fontFamily:"'Oswald',sans-serif",fontSize:15,letterSpacing:1}}>🔴 LIVE RACE IN PROGRESS</div>
        <div style={{color:"#000",fontSize:11,fontWeight:600}}>{liveStatus} → View Live</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
        {Object.entries(liveScores).sort((a,b)=>b[1].total-a[1].total).map(([pid,s],i)=>(<div key={pid} onClick={()=>setTab("live")} style={{background:PClr[pid].bg,borderRadius:8,padding:"8px 12px",cursor:"pointer",border:"1px solid "+(PClr[pid].bg==="#000000"?C.border:PClr[pid].bg+"88")}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{color:PClr[pid].fg,fontWeight:700,fontSize:13}}>{i===0?"👑 ":""}{PNAME[pid]}</span>
            <span style={{color:s.total>0?C.green:s.total<0?C.red:PClr[pid].fg,fontWeight:700,fontFamily:"'Oswald',sans-serif",fontSize:16}}>{s.total>0?"+":""}{s.total}</span>
          </div>
        </div>))}
      </div>
    </div>}

    {/* Last race + next race */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
      {lastWeek&&lastRaceInfo&&<div style={{background:C.card,borderRadius:10,padding:14,border:"1px solid "+C.border}}>
        <div style={{color:C.dim,fontSize:10,textTransform:"uppercase",letterSpacing:2,marginBottom:6}}>Last Race</div>
        <div style={{color:C.text,fontWeight:700,fontSize:14}}>{lastRaceInfo.r}</div>
        <div style={{color:C.dim,fontSize:12,marginBottom:8}}>@ {lastRaceInfo.t}</div>
        {Object.entries(lastWeek.scored||{}).sort((a,b)=>b[1].total-a[1].total).map(([pid,s],i)=>(
          <div key={pid} style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
            <span style={{color:PClr[pid].fg,fontWeight:i===0?700:400}}>{i===0?"👑 ":""}{PNAME[pid]}</span>
            <span style={{color:s.weeklyWin?C.accent:C.text,fontWeight:s.weeklyWin?700:400}}>{s.total}</span>
          </div>
        ))}
      </div>}
      {nextRace&&<div style={{background:C.card,borderRadius:10,padding:14,border:"1px solid "+C.accent+"44"}}>
        <div style={{color:C.accent,fontSize:10,textTransform:"uppercase",letterSpacing:2,marginBottom:6}}>Next Race</div>
        <div style={{color:C.text,fontWeight:700,fontSize:14}}>{nextRace.r}</div>
        <div style={{color:C.dim,fontSize:12,marginBottom:8}}>@ {nextRace.t} · {nextRace.d}</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <span style={{fontSize:10,color:TTC[nextRace.ty],background:TTC[nextRace.ty]+"18",padding:"3px 8px",borderRadius:8,fontWeight:600}}>{TTL[nextRace.ty]} x{TRACK_MULTS[nextRace.ty]}</span>
          <span style={{fontSize:10,color:C.dim,background:"rgba(255,255,255,0.05)",padding:"3px 8px",borderRadius:8}}>W{nextRace.w}</span>
        </div>
        <button onClick={()=>setTab("draft")} style={{marginTop:10,width:"100%",padding:"8px 0",borderRadius:8,border:"1px solid "+C.accent,background:C.accent+"22",color:C.accent,fontFamily:"'Oswald',sans-serif",fontSize:12,fontWeight:700,letterSpacing:1,cursor:"pointer",textTransform:"uppercase"}}>Go to Draft →</button>
      </div>}
    </div>
  </div>);
}

function StandingsTab({data, liveScores, liveStatus}) {
  const standings=useMemo(()=>PLAYERS.map(p=>({...p,pts:data.meta.standings[p.id]||0,pp:data.meta.playoffPts[p.id]||0,wins:Object.values(data.results||{}).filter(r=>r.scored?.[p.id]?.weeklyWin).length})).sort((a,b)=>b.pts-a.pts),[data]);
  const isLive = liveScores && data?.liveRace?.active;

  // If live race in progress, show live provisional standings
  const liveStandings = useMemo(()=>{
    if(!isLive) return null;
    return PLAYERS.map(p=>({...p,
      pts: Math.round(((data.meta.standings[p.id]||0) + (liveScores[p.id]?.total||0))*100)/100,
      liveScore: liveScores[p.id]?.total||0,
      pp:data.meta.playoffPts[p.id]||0,
      wins:Object.values(data.results||{}).filter(r=>r.scored?.[p.id]?.weeklyWin).length
    })).sort((a,b)=>b.pts-a.pts);
  },[isLive,liveScores,data]);

  const display = liveStandings || standings;

  return (<div style={{padding:20,maxWidth:900,margin:"0 auto",position:"relative",zIndex:1}}>
    {isLive&&<div style={{background:"linear-gradient(90deg,#ef4444,#f59e0b)",borderRadius:10,padding:"10px 16px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:18}}>🏁</span><span style={{color:"#000",fontWeight:700,fontFamily:"'Oswald',sans-serif",fontSize:16,letterSpacing:1}}>RACE IN PROGRESS — LIVE SCORING</span></div>
      <span style={{color:"#000",fontSize:12,fontWeight:600}}>{liveStatus}</span>
    </div>}
    <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:4}}>{isLive?"Live Standings":"Season Standings"}</h2>
    <div style={{color:C.dim,fontSize:13,marginBottom:20}}>{isLive?"Provisional — updates every 30s":""+Object.keys(data.results||{}).length+" of 36 races scored"}</div>
    <div style={{display:"grid",gap:12}}>{display.map((p,i)=>(<div key={p.id} style={{background:PClr[p.id].bg,borderRadius:12,padding:"16px 20px",border:"2px solid "+(i===0?(isLive?"#ef4444":C.accent):PClr[p.id].bg==="#000000"?C.border:PClr[p.id].bg+"88"),display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{display:"flex",alignItems:"center",gap:14}}><div style={{width:38,height:38,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:PClr[p.id].fg,color:PClr[p.id].bg,fontWeight:700,fontSize:17,fontFamily:"'Oswald',sans-serif"}}>{i+1}</div><div><div style={{color:PClr[p.id].fg,fontWeight:700,fontSize:19,fontFamily:"'Barlow Condensed',sans-serif"}}>{p.name}</div><div style={{color:PClr[p.id].fg+"99",fontSize:12}}>{p.wins} win{p.wins!==1?"s":""} · {p.pp} playoff pts · <span style={{color:(MAX_MULLIGANS-(data.meta.mulligansUsed[p.id]||0))<=1?C.red:(MAX_MULLIGANS-(data.meta.mulligansUsed[p.id]||0))<=5?"#f59e0b":PClr[p.id].fg+"88"}}>M: {MAX_MULLIGANS-(data.meta.mulligansUsed[p.id]||0)}</span>{isLive&&p.liveScore!==0?<span style={{marginLeft:8,color:p.liveScore>0?C.green:C.red,fontWeight:700}}>{p.liveScore>0?"+":""}{p.liveScore} live</span>:""}</div></div></div>
      <div style={{textAlign:"right"}}><div style={{color:PClr[p.id].fg,fontFamily:"'Oswald',sans-serif",fontSize:30,fontWeight:700}}>{p.pts}</div><div style={{color:PClr[p.id].fg+"88",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Points</div></div>
    </div>))}</div></div>);
}

function LineupsTab({data,currentWeek}) {
  const [week,setWeek]=useState(currentWeek);
  const weekInfo=SCHEDULE.find(s=>s.w===week);
  const draftState=data.drafts?.["w"+week]||[];
  const savedPicks=data.picks?.["w"+week]||{};
  const hasScored=!!(data.results?.["w"+week]?.scored);
  const lineups={}; PLAYERS.forEach(p=>{lineups[p.id]=[];});
  if(draftState.length>0){ draftState.forEach(d=>{if(lineups[d.pid])lineups[d.pid].push(d.driver);}); }
  else { PLAYERS.forEach(p=>{lineups[p.id]=(savedPicks[p.id]||[]).map(pk=>pk.driver);}); }
  const hasLineups=PLAYERS.some(p=>lineups[p.id].length>0);
  const allComplete=PLAYERS.every(p=>lineups[p.id].length>=ACTIVE_PICKS);
  const allWeeks=[]; for(let w=1;w<=36;w++){const hd=data.drafts?.["w"+w]?.length>0;const hp=data.picks?.["w"+w]&&Object.values(data.picks["w"+w]).some(pk=>pk&&pk.length>0);if(hd||hp||w===currentWeek)allWeeks.push(w);}
  return (<div style={{padding:20,maxWidth:900,margin:"0 auto",position:"relative",zIndex:1}}>
    <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:4}}>Lineups</h2>
    <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:16}}>{allWeeks.map(w=>(<button key={w} onClick={()=>setWeek(w)} style={{padding:"6px 10px",borderRadius:6,border:"none",fontSize:11,fontWeight:700,cursor:"pointer",background:week===w?C.accent:"rgba(255,255,255,0.05)",color:week===w?"#000":C.dim}}>W{w}</button>))}</div>
    {weekInfo&&<div style={{color:C.dim,fontSize:14,marginBottom:16}}>{weekInfo.r} <span style={{color:C.dim}}>@ {weekInfo.t}</span> — <span style={{color:TTC[weekInfo.ty],fontWeight:600}}>{TTL[weekInfo.ty]} x{TRACK_MULTS[weekInfo.ty]}</span>
      {hasScored&&<span style={{color:C.green,marginLeft:8,fontSize:12,fontWeight:600}}>✓ Scored</span>}
      {!hasScored&&allComplete&&<span style={{color:C.accent,marginLeft:8,fontSize:12,fontWeight:600}}>Picks Locked</span>}
      {!hasScored&&!allComplete&&hasLineups&&<span style={{color:C.blue,marginLeft:8,fontSize:12,fontWeight:600}}>Draft In Progress</span>}
    </div>}
    {!hasLineups?<div style={{color:C.dim,textAlign:"center",padding:40,fontSize:14}}>No picks yet for Week {week}</div>
    :<div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
      {PLAYERS.map(p=>{const picks=lineups[p.id]||[];const mullPicks=(savedPicks[p.id]||[]).filter(pk=>pk.mulligan).map(pk=>pk.driver);
      return(<div key={p.id} style={{background:PClr[p.id].bg,borderRadius:12,padding:16,border:"2px solid "+(PClr[p.id].bg==="#000000"?C.border:PClr[p.id].bg+"88")}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}><div style={{width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:PClr[p.id].fg,color:PClr[p.id].bg,fontWeight:700,fontSize:14,fontFamily:"'Oswald',sans-serif"}}>{PNAME[p.id][0]}</div><div><div style={{color:PClr[p.id].fg,fontWeight:700,fontSize:17,fontFamily:"'Barlow Condensed',sans-serif"}}>{PNAME[p.id]}</div><div style={{color:PClr[p.id].fg+"88",fontSize:11}}>{picks.length}/{ACTIVE_PICKS} drivers · <span style={{color:(MAX_MULLIGANS-(data.meta.mulligansUsed[p.id]||0))<=1?C.red:(MAX_MULLIGANS-(data.meta.mulligansUsed[p.id]||0))<=5?"#f59e0b":PClr[p.id].fg+"66"}}>M: {MAX_MULLIGANS-(data.meta.mulligansUsed[p.id]||0)} left</span></div></div></div>
        <div style={{display:"flex",flexDirection:"column",gap:4}}>{picks.length===0?<div style={{color:PClr[p.id].fg+"55",fontSize:12,fontStyle:"italic"}}>Waiting to pick...</div>
          :picks.map((driver,i)=>{const isMull=mullPicks.includes(driver);return(<div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:PClr[p.id].bg==="#FFFFFF"?"#f0f0f0":"rgba(255,255,255,0.1)",borderRadius:8,border:"1px solid "+PClr[p.id].fg+"22"}}><span style={{fontSize:11,color:PClr[p.id].fg+"88",fontWeight:700,width:22}}>R{i+1}</span><span style={{fontSize:13,color:PClr[p.id].fg,fontWeight:600,flex:1}}>{driver}{isMemorial(driver)?" 🕊️":""}</span>{isMull&&<span style={{fontSize:10,color:"#fff",fontWeight:700}}>🔄 M</span>}</div>);})}
        </div>
      </div>);})}
    </div>}
  </div>);
}

function LiveTab({data, liveScores, liveStatus, currentWeek}) {
  const isActive = !!(data?.liveRace?.active && liveScores);
  const week = data?.liveRace?.week || currentWeek;
  const weekInfo = SCHEDULE.find(s=>s.w===week);
  const weekPicks = data?.picks?.["w"+week] || {};

  if(!isActive) return (
    <div style={{padding:20,maxWidth:900,margin:"0 auto",position:"relative",zIndex:1}}>
      <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:8}}>Live Scoring</h2>
      <div style={{background:C.card,borderRadius:12,padding:40,border:"1px solid "+C.border,textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:12}}>🏁</div>
        <div style={{color:C.text,fontWeight:700,fontSize:18,fontFamily:"'Oswald',sans-serif",marginBottom:8}}>No Race In Progress</div>
        <div style={{color:C.dim,fontSize:13}}>Live scoring activates when the commissioner starts a race. Check back on race day!</div>
        {weekInfo&&<div style={{marginTop:16,color:C.accent,fontSize:13,fontWeight:600}}>Next up: W{week} {weekInfo.r} @ {weekInfo.t} · {weekInfo.d}</div>}
      </div>
    </div>
  );

  // Sort players by current live total (season pts + live race pts)
  const ranked = PLAYERS.map(p=>({
    ...p,
    seasonPts: data.meta.standings[p.id]||0,
    livePts: liveScores[p.id]?.total||0,
    grandTotal: Math.round(((data.meta.standings[p.id]||0)+(liveScores[p.id]?.total||0))*100)/100,
    drivers: liveScores[p.id]?.drivers||[],
    picks: weekPicks[p.id]||[],
  })).sort((a,b)=>b.livePts-a.livePts);

  return (<div style={{padding:20,maxWidth:900,margin:"0 auto",position:"relative",zIndex:1}}>
    {/* Live header */}
    <div style={{background:"linear-gradient(90deg,#ef4444,#f59e0b)",borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:20}}>🔴</span><div><div style={{color:"#000",fontWeight:900,fontFamily:"'Oswald',sans-serif",fontSize:18,letterSpacing:1}}>RACE IN PROGRESS</div><div style={{color:"#000",fontSize:12,opacity:0.8}}>{weekInfo?.r} @ {weekInfo?.t} — W{week}</div></div></div>
      <div style={{textAlign:"right"}}><div style={{color:"#000",fontSize:12,fontWeight:700}}>{liveStatus}</div><div style={{color:"#000",fontSize:10,opacity:0.7}}>Updates every 30s</div></div>
    </div>

    {/* Race scoring cards */}
    <div style={{display:"grid",gap:12}}>{ranked.map((p,i)=>{
      const mullPicks=(p.picks||[]).filter(pk=>pk.mulligan).map(pk=>pk.driver);
      return(<div key={p.id} style={{background:PClr[p.id].bg,borderRadius:12,border:"2px solid "+(i===0?"#ef4444":PClr[p.id].bg==="#000000"?C.border:PClr[p.id].bg+"88")}}>
        {/* Player header */}
        <div style={{padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid "+(PClr[p.id].bg==="#000000"?C.border:"rgba(0,0,0,0.2)")}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:PClr[p.id].fg,color:PClr[p.id].bg,fontWeight:700,fontSize:15,fontFamily:"'Oswald',sans-serif",display:"flex",alignItems:"center",justifyContent:"center"}}>{i+1}</div>
            <div><div style={{color:PClr[p.id].fg,fontWeight:700,fontSize:18,fontFamily:"'Barlow Condensed',sans-serif"}}>{p.name}</div><div style={{color:PClr[p.id].fg+"88",fontSize:11}}>Season: {p.seasonPts} pts</div></div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{color:p.livePts>0?C.green:p.livePts<0?C.red:PClr[p.id].fg,fontFamily:"'Oswald',sans-serif",fontSize:28,fontWeight:700}}>{p.livePts>0?"+":""}{p.livePts}</div>
            <div style={{color:PClr[p.id].fg+"88",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>This Race</div>
          </div>
        </div>
        {/* Drivers */}
        <div style={{padding:"10px 12px",display:"grid",gap:4}}>
          {p.drivers.length===0
            ?<div style={{color:PClr[p.id].fg+"55",fontSize:12,fontStyle:"italic",textAlign:"center",padding:8}}>No picks found</div>
            :p.drivers.map(d=>{
              const isMull=mullPicks.includes(d.driver);
              const info=DRIVER_INFO[d.driver]||{};
              return(<div key={d.driver} style={{background:PClr[p.id].bg==="#FFFFFF"?"rgba(0,0,0,0.06)":"rgba(255,255,255,0.07)",borderRadius:8,padding:"8px 12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
                  <div>
                    <div style={{color:PClr[p.id].fg,fontSize:13,fontWeight:600}}>{d.driver}{isMull?" 🔄":""}{d.dnr?" (DNR)":""}</div>
                    {info.team&&<div style={{color:PClr[p.id].fg+"77",fontSize:10}}>{info.team}{info.make&&<span style={{color:MAKE_COLORS[info.make],marginLeft:4,fontWeight:600}}>· {info.make}</span>}</div>}
                  </div>
                </div>
                <div style={{textAlign:"right",minWidth:40}}>
                  <div style={{color:d.total>0?C.green:d.total<0?C.red:PClr[p.id].fg+"88",fontWeight:700,fontSize:14,fontFamily:"'Oswald',sans-serif"}}>{d.total>0?"+":""}{d.total}</div>
                  {d.breakdown?.slice(0,3).map((b,bi)=>(<div key={bi} style={{fontSize:9,color:PClr[p.id].fg+"66"}}>{b.label}</div>))}
                </div>
              </div>);
            })}
        </div>
      </div>);
    })}</div>
  </div>);
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
    if(isMemorial(driver))return;
    if(!window.confirm("Lock in "+driver+"?"))return;
    onDraftPick(currentWeek,player.id,driver,currentPickNum); setSearch("");
  };
  return (<div style={{padding:20,maxWidth:800,margin:"0 auto",position:"relative",zIndex:1}}>
    <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:4}}>Week {currentWeek} Draft</h2>
    {weekInfo&&<div style={{color:C.dim,fontSize:14,marginBottom:12}}>{weekInfo.r} — {weekInfo.t} — <span style={{color:TTC[weekInfo.ty],fontWeight:600}}>{TTL[weekInfo.ty]} x{TRACK_MULTS[weekInfo.ty]}</span></div>}
    <div style={{background:C.card,borderRadius:10,padding:14,marginBottom:16,border:"1px solid "+C.border}}>
      <div style={{color:C.dim,fontSize:11,textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>Draft Order (last week's loser picks first)</div>
      <div style={{display:"flex",gap:8}}>{draftOrder.map((pid,i)=>(<div key={pid} style={{flex:1,textAlign:"center",padding:"8px 4px",borderRadius:8,background:currentTurn?.pid===pid?PClr[pid].bg:C.input,border:"1px solid "+(currentTurn?.pid===pid?PClr[pid].fg:C.border)}}><div style={{fontSize:10,color:currentTurn?.pid===pid?PClr[pid].fg+"99":C.dim}}>#{i+1}</div><div style={{fontSize:14,fontWeight:700,color:currentTurn?.pid===pid?PClr[pid].fg:PC[pid]}}>{PNAME[pid]}</div></div>))}</div>
    </div>
    {!draftComplete?(<div style={{background:isMyTurn?C.green+"22":C.card,borderRadius:10,padding:14,marginBottom:16,border:"1px solid "+(isMyTurn?C.green:C.border),textAlign:"center"}}>
      <div style={{fontSize:11,color:C.dim,textTransform:"uppercase",letterSpacing:2}}>Pick {currentPickNum+1} of {snakeSequence.length} · Round {currentTurn?.round}</div>
      <div style={{fontSize:20,fontWeight:700,color:isMyTurn?C.green:PC[currentTurn?.pid],marginTop:4}}>{isMyTurn?"YOUR PICK!":PNAME[currentTurn?.pid]+"'s Turn"}</div>
      {!isMyTurn&&<div style={{fontSize:12,color:C.dim,marginTop:4}}>Waiting for {PNAME[currentTurn?.pid]}...</div>}
    </div>):(<div style={{background:C.accent+"22",borderRadius:10,padding:14,marginBottom:16,border:"1px solid "+C.accent+"44",textAlign:"center"}}><div style={{fontSize:18,fontWeight:700,color:C.accent}}>Draft Complete!</div><div style={{fontSize:12,color:C.dim,marginTop:4}}>All picks locked for Week {currentWeek}</div></div>)}
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16}}>{PLAYERS.map(p=>(<div key={p.id} style={{background:PClr[p.id].bg,borderRadius:10,padding:10,border:"1px solid "+(PClr[p.id].bg==="#000000"?C.border:PClr[p.id].bg)}}><div style={{color:PClr[p.id].fg,fontWeight:700,fontSize:13,marginBottom:8,textAlign:"center"}}>{PNAME[p.id]}</div>
      {Array.from({length:ACTIVE_PICKS}).map((_,i)=>{const driver=playerPicks[p.id]?.[i];return(<div key={i} style={{background:driver?(PClr[p.id].bg==="#FFFFFF"?"#f0f0f0":"rgba(255,255,255,0.12)"):"rgba(0,0,0,0.15)",borderRadius:6,padding:"6px 8px",marginBottom:4,minHeight:28,display:"flex",alignItems:"center"}}><span style={{fontSize:10,color:PClr[p.id].fg+"99",marginRight:6,fontWeight:700}}>R{i+1}</span><span style={{fontSize:11,color:driver?PClr[p.id].fg:PClr[p.id].fg+"44"}}>{driver||"—"}</span></div>);})}
    </div>))}</div>
    {isMyTurn&&!draftComplete&&<><div style={{color:C.dim,fontSize:11,textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>Select a Driver</div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search drivers..." style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid "+C.border,background:C.input,color:C.text,fontSize:14,fontFamily:"inherit",outline:"none",marginBottom:8,boxSizing:"border-box"}}/>
      <div style={{maxHeight:300,overflowY:"auto",display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>{available.map(d=>{const mem=isMemorial(d);const info=DRIVER_INFO[d]||{};return(<button key={d} onClick={()=>handlePick(d)} disabled={mem} style={{textAlign:"left",padding:"8px 12px",borderRadius:8,background:mem?C.card+"88":C.card,border:"1px solid "+(mem?C.accent+"33":C.border),color:mem?C.dim:C.text,fontSize:13,cursor:mem?"not-allowed":"pointer",fontFamily:"inherit"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <span style={{fontWeight:600}}>{d}</span>
          {mem&&<span style={{fontSize:10,color:C.accent}}>🕊️</span>}
        </div>
        {info.team&&<div style={{fontSize:10,color:C.dim,marginTop:1}}>{info.team}{info.make&&<span style={{color:MAKE_COLORS[info.make],marginLeft:4,fontWeight:600}}>{info.make}</span>}</div>}
      </button>);})}</div></>}
    {draftState.length>0&&<div style={{marginTop:16}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={{color:C.dim,fontSize:11,textTransform:"uppercase",letterSpacing:2}}>Pick Log</div>
      {player.id==="justin"&&!draftComplete&&<button onClick={async()=>{const last=draftState[draftState.length-1];if(!window.confirm("Undo last pick by "+PNAME[last.pid]+" ("+last.driver+")?"))return;const r=await onUndoDraft(currentWeek);if(r)setUndoMsg("Undid "+PNAME[r.pid]+"'s pick: "+r.driver);setTimeout(()=>setUndoMsg(""),3000);}} style={{padding:"5px 12px",borderRadius:6,border:"1px solid "+C.red+"66",background:C.red+"11",color:C.red,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Undo Last Pick</button>}
    </div>{undoMsg&&<div style={{color:C.accent,fontSize:12,marginBottom:8,textAlign:"center"}}>{undoMsg}</div>}<div style={{display:"flex",flexDirection:"column",gap:3}}>{[...draftState].reverse().map((d,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:C.card,borderRadius:6,border:"1px solid "+C.border}}><span style={{fontSize:10,color:C.dim,width:24}}>#{draftState.length-i}</span><span style={{fontSize:12,color:PC[d.pid],fontWeight:600,width:80}}>{PNAME[d.pid]}</span><span style={{fontSize:12,color:C.text}}>{d.driver}</span></div>))}</div></div>}
  </div>);
}

function ResultsTab({data}) {
  const weeks=Object.keys(data.results||{}).map(k=>parseInt(k.replace("w",""))).sort((a,b)=>b-a);
  const [week,setWeek]=useState(weeks[0]||1);
  const wr=data.results?.["w"+week]; const weekInfo=SCHEDULE.find(s=>s.w===week);
  const sorted=wr?.scored?Object.entries(wr.scored).sort((a,b)=>b[1].total-a[1].total):[];
  return (<div style={{padding:20,maxWidth:900,margin:"0 auto",position:"relative",zIndex:1}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
      <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,margin:0}}>Results</h2>
      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{weeks.map(w=>(<button key={w} onClick={()=>setWeek(w)} style={{padding:"6px 10px",borderRadius:6,border:"none",fontSize:11,fontWeight:700,cursor:"pointer",background:week===w?C.accent:"rgba(255,255,255,0.05)",color:week===w?"#000":C.dim}}>W{w}</button>))}</div>
    </div>
    {weekInfo&&<div style={{color:C.dim,fontSize:14,marginBottom:16}}>{weekInfo.r} @ {weekInfo.t} · <span style={{color:TTC[weekInfo.ty]}}>{TTL[weekInfo.ty]} x{TRACK_MULTS[weekInfo.ty]}</span>{wr?.raw?.threeStages&&<span style={{color:C.purple,marginLeft:8,fontWeight:600}}>3 STAGES</span>}</div>}
    {sorted.length===0?<div style={{color:C.dim,textAlign:"center",padding:40}}>No results</div>
      :<div style={{display:"grid",gap:12}}>{sorted.map(([pid,ps],idx)=>{
        const isLoser=idx===sorted.length-1&&sorted.length===4;
        return(<div key={pid} style={{background:PClr[pid].bg,borderRadius:12,padding:"16px 20px",border:"2px solid "+(ps.weeklyWin?C.accent:PClr[pid].bg==="#000000"?C.border:PClr[pid].bg+"88")}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:(ps.drivers&&ps.drivers.length)?12:0}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{color:PClr[pid].fg,fontWeight:700,fontSize:17,fontFamily:"'Barlow Condensed',sans-serif"}}>{ps.weeklyWin?"👑 ":""}{isLoser?"💩 ":""}{PNAME[pid]}</span>{ps.weeklyWin&&<span style={{background:C.accent+"44",color:C.accent,padding:"2px 10px",borderRadius:12,fontSize:10,fontWeight:700}}>WIN +25 PO</span>}</div>
            <span style={{color:PClr[pid].fg,fontFamily:"'Oswald',sans-serif",fontSize:26,fontWeight:700}}>{ps.total}</span>
          </div>
          {ps.drivers&&ps.drivers.length>0&&<div style={{display:"grid",gap:6}}>{ps.drivers.map(d=>(<div key={d.driver} style={{background:PClr[pid].bg==="#FFFFFF"?"#f0f0f0":PClr[pid].bg==="#000000"?"#1a1a1a":"rgba(0,0,0,0.22)",borderRadius:8,padding:"8px 12px",border:"1px solid "+PClr[pid].fg+"22"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:PClr[pid].fg,fontSize:13,fontWeight:600}}>{d.driver}{isMemorial(d.driver)?" 🕊️":""}{d.isMulligan?" 🔄":""}{d.dnr?" (DNR)":""}</span><span style={{color:d.total>=0?C.green:C.red,fontWeight:700,fontSize:13}}>{d.total}</span></div>
            <div style={{display:"flex",flexWrap:"wrap",gap:3}}>{(d.breakdown||[]).map((b,i)=>(<span key={i} style={{fontSize:9,color:b.pts>0?C.green:b.pts<0?C.red:PClr[pid].fg+"88",background:"rgba(0,0,0,0.3)",padding:"2px 5px",borderRadius:4}}>{b.label}: {b.pts>0?"+":""}{b.pts}</span>))}</div>
          </div>))}</div>}
        </div>);
      })}</div>}
  </div>);
}

function PlayoffsTab({data}) {
  const scored=Object.keys(data.results||{}).length;
  const weeksUntil=Math.max(0,PLAYOFF_START_WEEK-scored);
  const playoffsStarted=scored>=PLAYOFF_START_WEEK;

  // Find the regular season leader for the +50 bonus
  const regStandings=PLAYERS.map(p=>({id:p.id,pts:data.meta.standings[p.id]||0})).sort((a,b)=>b.pts-a.pts);
  const regLeader=regStandings[0]?.id;
  const isTied=regStandings[0]?.pts===regStandings[1]?.pts;

  const ps=useMemo(()=>PLAYERS.map(p=>{
    const base=1000;
    const pp=data.meta.playoffPts[p.id]||0;
    const champBonus=(p.id===regLeader&&!isTied)?REG_SEASON_CHAMP_BONUS:0;
    return{...p,base,pp,champBonus,total:base+pp+champBonus,
      wins:Object.values(data.results||{}).filter(r=>r.scored?.[p.id]?.weeklyWin).length,
      regPts:data.meta.standings[p.id]||0};
  }).sort((a,b)=>b.total-a.total),[data,regLeader,isTied]);
  return (<div style={{padding:20,maxWidth:900,margin:"0 auto",position:"relative",zIndex:1}}>
    <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:4}}>Playoff Picture</h2>
    <div style={{color:C.dim,fontSize:13,marginBottom:8}}>If the chase started today — {scored} races completed, {weeksUntil} until playoffs</div>
    <div style={{background:C.card,borderRadius:10,padding:14,marginBottom:16,border:"1px solid "+C.border}}>
      <div style={{color:C.dim,fontSize:11,marginBottom:4}}>Everyone starts at <span style={{color:C.accent,fontWeight:700}}>1,000</span> base. Playoff points (weekly wins +25, bonus pts) carry over. Regular season leader earns <span style={{color:C.accent,fontWeight:700}}>+{REG_SEASON_CHAMP_BONUS} bonus pts</span>.</div>
      {!isTied&&regLeader&&<div style={{color:C.accent,fontSize:12,fontWeight:700}}>🏆 Current reg. season leader: {PNAME[regLeader]} {playoffsStarted?"(+50 applied)":"(projected +50 if they hold the lead)"}</div>}
      {isTied&&<div style={{color:"#f59e0b",fontSize:12}}>⚠️ Tie at the top — no bonus awarded until the lead is broken</div>}
    </div>
    <div style={{display:"grid",gap:12}}>{ps.map((p,i)=>(
      <div key={p.id} style={{background:PClr[p.id].bg,borderRadius:12,padding:"18px 20px",border:"2px solid "+(i===0?C.accent:PClr[p.id].bg==="#000000"?C.border:PClr[p.id].bg+"88")}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:38,height:38,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:PClr[p.id].fg,color:PClr[p.id].bg,fontWeight:700,fontSize:17,fontFamily:"'Oswald',sans-serif"}}>{i+1}</div>
            <div>
              <div style={{color:PClr[p.id].fg,fontWeight:700,fontSize:20,fontFamily:"'Barlow Condensed',sans-serif"}}>{p.name}{p.champBonus>0?<span style={{fontSize:12,color:C.accent,marginLeft:8}}>👑 Reg. Champion</span>:""}</div>
              <div style={{color:PClr[p.id].fg+"99",fontSize:12}}>{p.wins} weekly win{p.wins!==1?"s":""}</div>
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{color:PClr[p.id].fg,fontFamily:"'Oswald',sans-serif",fontSize:32,fontWeight:700}}>{p.total}</div>
            <div style={{color:PClr[p.id].fg+"88",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Chase Pts</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <div style={{background:"rgba(0,0,0,0.2)",borderRadius:8,padding:"8px 12px",flex:1,minWidth:80}}><div style={{fontSize:10,color:PClr[p.id].fg+"88",textTransform:"uppercase"}}>Base</div><div style={{fontSize:16,fontWeight:700,color:PClr[p.id].fg,fontFamily:"'Oswald',sans-serif"}}>{p.base}</div></div>
          <div style={{background:"rgba(0,0,0,0.2)",borderRadius:8,padding:"8px 12px",flex:1,minWidth:80}}><div style={{fontSize:10,color:PClr[p.id].fg+"88",textTransform:"uppercase"}}>Playoff Pts</div><div style={{fontSize:16,fontWeight:700,color:C.accent,fontFamily:"'Oswald',sans-serif"}}>+{p.pp}</div></div>
          {p.champBonus>0&&<div style={{background:"rgba(245,158,11,0.2)",borderRadius:8,padding:"8px 12px",flex:1,minWidth:80,border:"1px solid "+C.accent+"44"}}><div style={{fontSize:10,color:C.accent,textTransform:"uppercase"}}>Champ Bonus</div><div style={{fontSize:16,fontWeight:700,color:C.accent,fontFamily:"'Oswald',sans-serif"}}>+{p.champBonus}</div></div>}
          <div style={{background:"rgba(0,0,0,0.2)",borderRadius:8,padding:"8px 12px",flex:1,minWidth:80}}><div style={{fontSize:10,color:PClr[p.id].fg+"88",textTransform:"uppercase"}}>Reg Season</div><div style={{fontSize:16,fontWeight:700,color:PClr[p.id].fg,fontFamily:"'Oswald',sans-serif"}}>{p.regPts}</div></div>
        </div>
      </div>
    ))}</div>
    <div style={{marginTop:20,background:C.card,borderRadius:10,padding:14,border:"1px solid "+C.border}}><div style={{color:C.dim,fontSize:12,lineHeight:1.6}}>The Chase begins Week {PLAYOFF_START_WEEK} (Darlington). All players reset to 1,000 + playoff pts + regular season champion bonus (if applicable), then regular scoring continues through Week 36 (Homestead).</div></div>
  </div>);
}

function ScheduleTab({data}) {
  const scored=new Set(Object.keys(data.results||{}).map(k=>parseInt(k.replace("w",""))));
  return (<div style={{padding:20,maxWidth:700,margin:"0 auto",position:"relative",zIndex:1}}>
    <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:8}}>2026 Schedule</h2>
    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>{Object.entries(TTC).map(([t,c])=>(<span key={t} style={{fontSize:11,color:c,background:c+"18",padding:"3px 10px",borderRadius:12,fontWeight:600}}>{TTL[t]} x{TRACK_MULTS[t]}</span>))}</div>
    <div style={{display:"grid",gap:3}}>{SCHEDULE.map(s=>(<div key={s.w} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",borderRadius:8,background:s.w===PLAYOFF_START_WEEK?C.accent+"11":C.card,border:"1px solid "+(s.w>=PLAYOFF_START_WEEK?C.accent+"33":C.border)}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{color:scored.has(s.w)?C.green:C.dim,fontSize:11,width:36,fontWeight:700}}>{scored.has(s.w)?"✓ ":""}W{s.w}</span><div><span style={{color:C.text,fontSize:13,fontWeight:600}}>{s.r}</span><span style={{color:C.dim,fontSize:11,marginLeft:6}}>@ {s.t}</span></div>{s.w===PLAYOFF_START_WEEK&&<span style={{fontSize:9,color:C.accent,fontWeight:700,letterSpacing:1}}>PLAYOFFS</span>}</div>
      <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{color:C.dim,fontSize:10}}>{s.d}</span><span style={{fontSize:10,color:TTC[s.ty],fontWeight:600,background:TTC[s.ty]+"18",padding:"2px 8px",borderRadius:10}}>{TTL[s.ty]}</span></div>
    </div>))}</div></div>);
}

function MulligansTab({player,data,currentWeek,onApplyMulligan}) {
  const used=data.meta.mulligansUsed[player.id]||0;
  const remaining=MAX_MULLIGANS-used;
  const [selectedDriver,setSelectedDriver]=useState("");
  const [replacement,setReplacement]=useState("");
  const [search,setSearch]=useState("");
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState("");
  const weekKey="w"+currentWeek;
  const weekPicks=data.picks?.[weekKey]?.[player.id]||[];
  const myDrivers=weekPicks.filter(pk=>!pk.garage);
  const hasScored=!!(data.results?.[weekKey]?.scored);
  const allWeekPicks=data.picks?.[weekKey]||{};
  const takenDrivers=new Set();
  Object.values(allWeekPicks).forEach(picks=>{(picks||[]).forEach(pk=>{if(pk.driver)takenDrivers.add(pk.driver);});});
  const available=DRIVERS.filter(d=>!takenDrivers.has(d)&&!isMemorial(d)&&d.toLowerCase().includes(search.toLowerCase()));
  const apply=async()=>{
    if(!selectedDriver||!replacement)return;
    if(!window.confirm("Use a mulligan to swap "+selectedDriver+" for "+replacement+"? Counts as 1 of your 10 season mulligans; replacement earns finish position points only."))return;
    setSaving(true);setMsg("");
    await onApplyMulligan(currentWeek,player.id,selectedDriver,replacement);
    setMsg("Mulligan applied: "+selectedDriver+" → "+replacement);
    setSelectedDriver("");setReplacement("");setSearch("");setSaving(false);
    setTimeout(()=>setMsg(""),5000);
  };
  return (<div style={{padding:20,maxWidth:700,margin:"0 auto",position:"relative",zIndex:1}}>
    <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:4}}>Mulligans</h2>
    <div style={{color:C.dim,fontSize:14,marginBottom:16}}>{remaining} of {MAX_MULLIGANS} remaining this season</div>
    {remaining<=1&&remaining>0&&<div style={{background:C.red+"22",border:"2px solid "+C.red,borderRadius:10,padding:14,marginBottom:16,textAlign:"center"}}><div style={{fontSize:24,marginBottom:4}}>⚠️</div><div style={{color:C.red,fontWeight:700,fontSize:14}}>DANGER — Only 1 Mulligan Left!</div><div style={{color:C.red+"cc",fontSize:12,marginTop:4}}>This is your final mulligan for the season. Use it wisely — once it's gone, you're locked in no matter what.</div></div>}
    {remaining<=5&&remaining>1&&<div style={{background:"#f59e0b22",border:"1px solid #f59e0b",borderRadius:10,padding:12,marginBottom:16,textAlign:"center"}}><div style={{color:"#f59e0b",fontWeight:700,fontSize:13}}>🟡 Down to {remaining} mulligans left — use them wisely!</div></div>}
    <div style={{display:"flex",gap:6,marginBottom:24,flexWrap:"wrap"}}>{Array.from({length:MAX_MULLIGANS}).map((_,i)=>(<div key={i} style={{width:26,height:26,borderRadius:"50%",background:i<used?C.red+"33":C.green+"33",border:"2px solid "+(i<used?C.red:C.green),display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:i<used?C.red:C.green}}>{i<used?"✗":"✓"}</div>))}</div>
    <div style={{background:PClr[player.id].bg,borderRadius:12,padding:16,border:"2px solid "+(PClr[player.id].bg==="#000000"?C.border:PClr[player.id].bg+"88"),marginBottom:16}}>
      <div style={{color:PClr[player.id].fg,fontWeight:700,fontSize:15,fontFamily:"'Barlow Condensed',sans-serif",marginBottom:8,letterSpacing:1}}>YOUR WEEK {currentWeek} ROSTER</div>
      {myDrivers.length===0?<div style={{color:PClr[player.id].fg+"88",fontSize:13,fontStyle:"italic"}}>No drivers picked yet for this week</div>
      :<div style={{display:"flex",flexDirection:"column",gap:4}}>{myDrivers.map((pk,i)=>(<div key={i} style={{padding:"8px 12px",background:PClr[player.id].bg==="#FFFFFF"?"#f0f0f0":"rgba(255,255,255,0.12)",borderRadius:6}}><span style={{color:PClr[player.id].fg,fontSize:13,fontWeight:600}}>R{i+1} · {pk.driver}{pk.mulligan?" 🔄":""}</span></div>))}</div>}
    </div>
    {hasScored?<div style={{background:C.card,borderRadius:10,padding:14,border:"1px solid "+C.border,color:C.dim,fontSize:13,textAlign:"center"}}>Week {currentWeek} is already scored. Mulligans must be applied before scoring.</div>
    :remaining<=0?<div style={{background:C.red+"22",borderRadius:10,padding:14,border:"1px solid "+C.red+"44",color:C.red,fontSize:13,textAlign:"center"}}>No mulligans remaining this season.</div>
    :myDrivers.length===0?<div style={{background:C.card,borderRadius:10,padding:14,border:"1px solid "+C.border,color:C.dim,fontSize:13,textAlign:"center"}}>You don't have any picks for Week {currentWeek} yet.</div>
    :<>
      <div style={{background:C.card,borderRadius:12,padding:16,border:"1px solid "+C.border,marginBottom:12}}>
        <div style={{color:C.accent,fontSize:11,textTransform:"uppercase",letterSpacing:2,marginBottom:8,fontWeight:700}}>Step 1: Choose Driver to Replace</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>{myDrivers.map((pk,i)=>(<button key={i} onClick={()=>setSelectedDriver(selectedDriver===pk.driver?"":pk.driver)} disabled={pk.mulligan} style={{padding:"10px 14px",borderRadius:8,border:"2px solid "+(selectedDriver===pk.driver?C.accent:C.border),background:selectedDriver===pk.driver?C.accent+"22":pk.mulligan?C.input+"55":C.input,color:pk.mulligan?C.dim:C.text,fontSize:13,fontWeight:600,fontFamily:"inherit",cursor:pk.mulligan?"not-allowed":"pointer",textAlign:"left"}}>{pk.driver}{pk.mulligan?" (already mulligan'd)":""}</button>))}</div>
      </div>
      {selectedDriver&&<div style={{background:C.card,borderRadius:12,padding:16,border:"1px solid "+C.border,marginBottom:12}}>
        <div style={{color:C.accent,fontSize:11,textTransform:"uppercase",letterSpacing:2,marginBottom:8,fontWeight:700}}>Step 2: Choose Replacement</div>
        <div style={{color:C.dim,fontSize:11,marginBottom:8}}>Only drivers not already picked by anyone this week</div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search drivers..." style={{width:"100%",padding:"10px 14px",borderRadius:8,border:"1px solid "+C.border,background:C.input,color:C.text,fontSize:14,fontFamily:"inherit",outline:"none",boxSizing:"border-box",marginBottom:8}}/>
        <div style={{maxHeight:240,overflowY:"auto",display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>{available.length===0?<div style={{gridColumn:"1/-1",color:C.dim,fontSize:12,textAlign:"center",padding:16}}>No available drivers</div>:available.map(d=>(<button key={d} onClick={()=>setReplacement(d)} style={{textAlign:"left",padding:"8px 10px",borderRadius:6,background:replacement===d?C.accent+"22":C.input,border:"2px solid "+(replacement===d?C.accent:C.border),color:replacement===d?C.accent:C.text,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>{d}</button>))}</div>
      </div>}
      {selectedDriver&&replacement&&<div style={{background:C.accent+"11",borderRadius:12,padding:14,border:"1px solid "+C.accent+"44",marginBottom:12}}>
        <div style={{color:C.accent,fontSize:11,textTransform:"uppercase",letterSpacing:2,marginBottom:6,fontWeight:700}}>Confirm Swap</div>
        <div style={{color:C.text,fontSize:13,marginBottom:4}}><span style={{color:C.red}}>OUT:</span> {selectedDriver}</div>
        <div style={{color:C.text,fontSize:13,marginBottom:8}}><span style={{color:C.green}}>IN:</span> {replacement} 🔄</div>
        <div style={{color:C.dim,fontSize:11,marginBottom:10}}>Replacement earns ONLY finish position points — no stage points, laps led, or bonuses.</div>
        <button onClick={apply} disabled={saving} style={{width:"100%",padding:"12px 0",borderRadius:8,border:"none",background:C.accent,color:"#000",fontFamily:"'Oswald',sans-serif",fontSize:14,fontWeight:700,letterSpacing:2,textTransform:"uppercase",cursor:"pointer"}}>{saving?"Applying...":"Apply Mulligan"}</button>
      </div>}
    </>}
    {msg&&<div style={{color:C.green,marginTop:12,textAlign:"center",fontSize:14,fontWeight:600}}>{msg}</div>}
  </div>);
}

function SettingsTab({player,data,onSaveSettings}) {
  const settings=data.playerSettings?.[player.id]||{};
  const [email,setEmail]=useState(settings.email||"");
  const [notifyOnTurn,setNotifyOnTurn]=useState(settings.notifyOnTurn!==false);
  const [saving,setSaving]=useState(false); const [msg,setMsg]=useState("");
  const defaultEmail=DEFAULT_EMAILS[player.id];
  const save=async()=>{setSaving(true);setMsg("");await onSaveSettings(player.id,{email:email.trim(),notifyOnTurn});setMsg("Settings saved!");setSaving(false);setTimeout(()=>setMsg(""),3000);};
  return (<div style={{padding:20,maxWidth:600,margin:"0 auto",position:"relative",zIndex:1}}>
    <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:4}}>Notification Settings</h2>
    <div style={{color:C.dim,fontSize:13,marginBottom:24}}>Get an email when it's your turn to draft</div>
    <div style={{background:C.card,borderRadius:12,padding:20,border:"1px solid "+C.border,marginBottom:16}}>
      <div style={{color:C.accent,fontSize:11,textTransform:"uppercase",letterSpacing:2,marginBottom:8,fontWeight:700}}>Email Address</div>
      <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={defaultEmail||"you@example.com"} style={{width:"100%",padding:"12px 14px",borderRadius:8,border:"1px solid "+C.border,background:C.input,color:C.text,fontSize:15,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
      <div style={{color:C.dim,fontSize:11,marginTop:6}}>{defaultEmail?<>Default: <span style={{color:C.green}}>{defaultEmail}</span> (leave blank to use)</>:"Where draft notifications will be sent"}</div>
    </div>
    <div style={{background:C.card,borderRadius:12,padding:20,border:"1px solid "+C.border,marginBottom:16}}>
      <label style={{display:"flex",alignItems:"center",gap:12,cursor:"pointer"}}><input type="checkbox" checked={notifyOnTurn} onChange={e=>setNotifyOnTurn(e.target.checked)} style={{width:18,height:18,cursor:"pointer"}}/><div><div style={{color:C.text,fontSize:15,fontWeight:600}}>Notify me when it's my turn</div><div style={{color:C.dim,fontSize:12,marginTop:2}}>Only fires when you're up next on the clock</div></div></label>
    </div>
    <button onClick={save} disabled={saving} style={{width:"100%",padding:"14px 0",borderRadius:8,border:"none",background:C.accent,color:"#000",fontFamily:"'Oswald',sans-serif",fontSize:16,fontWeight:700,letterSpacing:2,textTransform:"uppercase",cursor:"pointer"}}>{saving?"Saving...":"Save Settings"}</button>
    {msg&&<div style={{color:C.green,marginTop:12,textAlign:"center",fontSize:14,fontWeight:600}}>{msg}</div>}
  </div>);
}

function ProjectionsTab({data, currentWeek}) {
  const [projections,setProjections]=useState(null);
  const [loading,setLoading]=useState(false);
  const [msg,setMsg]=useState("");
  const weekInfo=SCHEDULE.find(s=>s.w===currentWeek);

  const load=async()=>{
    setLoading(true); setMsg(""); setProjections(null);
    const result=await fetchDriverProjections(currentWeek);
    setLoading(false);
    if(!result.ok){
      setMsg(result.error);
      if(result.apiWorking) setMsg(prev=>prev+" ✅ API connection confirmed — SportsDataIO is reachable.");
      return;
    }
    setProjections(result);
  };

  // Get the current week's picks to highlight drafted drivers
  const weekPicks=data.picks?.["w"+currentWeek]||data.drafts?.["w"+currentWeek]||{};
  const pickedDrivers=new Set();
  Object.values(weekPicks).forEach(pks=>(pks||[]).forEach(pk=>{if(pk.driver||typeof pk==="string")pickedDrivers.add(pk.driver||pk);}));

  return (<div style={{padding:20,maxWidth:900,margin:"0 auto",position:"relative",zIndex:1}}>
    <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:4}}>Driver Projections</h2>
    {weekInfo&&<div style={{color:C.dim,fontSize:14,marginBottom:12}}>W{currentWeek} · {weekInfo.r} @ {weekInfo.t} · <span style={{color:TTC[weekInfo.ty],fontWeight:600}}>{TTL[weekInfo.ty]} x{TRACK_MULTS[weekInfo.ty]}</span></div>}

    <div style={{background:C.card,borderRadius:10,padding:14,marginBottom:16,border:"1px solid "+C.border}}>
      <div style={{color:C.dim,fontSize:12,marginBottom:10}}>Pre-race projected fantasy points from SportsDataIO — the same API used for live scoring. Projections are based on historical performance, track history, and practice data. Usually available 2–3 days before the race. <span style={{color:C.accent}}>Drafted drivers are highlighted.</span></div>
      <button onClick={load} disabled={loading} style={{padding:"10px 20px",borderRadius:8,border:"none",background:loading?"#374151":C.green,color:"#fff",fontFamily:"'Oswald',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1,cursor:loading?"wait":"pointer",textTransform:"uppercase"}}>
        {loading?"⏳ Fetching from SportsDataIO...":"🔌 Load Projections / Test API"}
      </button>
    </div>

    {msg&&<div style={{background:C.card,borderRadius:10,padding:14,marginBottom:16,border:"1px solid "+(msg.includes("✅")?C.green:C.border),color:msg.includes("✅")?C.green:C.dim,fontSize:13}}>{msg}</div>}

    {projections&&<>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div style={{color:C.dim,fontSize:12}}>Source: {projections.source} · {projections.drivers.length} drivers · {projections.raceName}</div>
        <div style={{background:C.green+"22",color:C.green,padding:"4px 12px",borderRadius:8,fontSize:12,fontWeight:700}}>✅ API Working — Live scoring ready for race day</div>
      </div>

      <div style={{background:C.card,borderRadius:10,border:"1px solid "+C.border,overflow:"hidden"}}>
        {/* Header */}
        <div style={{display:"grid",gridTemplateColumns:"32px 1fr 60px 60px 60px 70px",gap:8,padding:"8px 14px",background:"rgba(255,255,255,0.04)",borderBottom:"1px solid "+C.border}}>
          {["#","Driver","Start","Finish","Laps Led","Proj Pts"].map(h=>(<span key={h} style={{color:C.dim,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>{h}</span>))}
        </div>
        {/* Rows */}
        <div style={{maxHeight:600,overflowY:"auto"}}>
          {projections.drivers.map((d,i)=>{
            const isPicked=pickedDrivers.has(d.name);
            const info=DRIVER_INFO[d.name]||{};
            return(<div key={d.name} style={{display:"grid",gridTemplateColumns:"32px 1fr 60px 60px 60px 70px",gap:8,padding:"9px 14px",borderBottom:"1px solid "+C.border+"44",background:isPicked?"rgba(245,158,11,0.08)":"transparent",alignItems:"center"}}>
              <span style={{color:C.dim,fontSize:12,fontWeight:700}}>{i+1}</span>
              <div>
                <div style={{color:isPicked?C.accent:C.text,fontSize:13,fontWeight:isPicked?700:400}}>{d.name}{isPicked?" ✓":""}</div>
                {info.team&&<div style={{fontSize:10,color:C.dim}}>{info.team}{info.make&&<span style={{color:MAKE_COLORS[info.make],marginLeft:4,fontWeight:600}}>{info.make}</span>}</div>}
              </div>
              <span style={{color:C.dim,fontSize:12,textAlign:"center"}}>{d.projectedStart||"—"}</span>
              <span style={{color:C.dim,fontSize:12,textAlign:"center"}}>{d.projectedFinish||"—"}</span>
              <span style={{color:C.dim,fontSize:12,textAlign:"center"}}>{d.projectedLapsLed||0}</span>
              <span style={{color:d.projectedPts>=40?C.green:d.projectedPts>=25?C.accent:C.text,fontSize:13,fontWeight:700,textAlign:"right",fontFamily:"'Oswald',sans-serif"}}>{d.projectedPts}</span>
            </div>);
          })}
        </div>
      </div>
      <div style={{color:C.dim,fontSize:11,marginTop:8}}>Projections are SportsDataIO's estimates, not ours. Actual FERDA scoring uses our own rules (stage points, net position, etc.) and will differ.</div>
    </>}
  </div>);
}

function RulesTab() {
  const rules=[{t:"Draft System",c:"Draft each week. Last week's loser picks first, winner picks last. Same order all 5 rounds."},{t:"Finish Points",c:"P1: 55, P2: 35, then P3: 34 decreasing by 1 to P36: 1. P37-40: 1 each."},{t:"Top Finish Bonus",c:"Top 5 finish: +2 bonus pts. Top 10 finish: +1 bonus pt."},{t:"Stage Points",c:"Top 10 each stage: 1st=10, 2nd=9... 10th=1. The Coca-Cola 600 has 3 stages."},{t:"Laps Led",c:"Per lap led x track modifier: SS x1.0, INT x0.5, ST x0.2, RC x1.5"},{t:"Net Position",c:"+/-1 pt per spot gained/lost (qualifying to finish). Capped at +/-10."},{t:"Bonuses",c:"Pole: 5 | Stage Win: 2.5 each | Fastest Lap: 1 | Most Laps Led: 5 | Led a Lap: 0.5/driver | Sweep (Pole + all stage wins): 12.5"},{t:"DNF / DQ",c:"DNF drivers score normally — finish position, net position, and any stage points earned still apply. DQ = -5 points total."},{t:"Weekly Win",c:"Highest scorer earns 25 playoff points. Tiebreak: had the race winner, then highest single-driver score."},{t:"Playoffs (W27+)",c:"Reset to 1,000 base. Weekly wins (x25) + bonus pts carry over. Regular season leader earns +50 bonus pts entering the Chase."},{t:"Mulligans",c:"10/season. Replacement driver earns finish position points ONLY."}];
  return (<div style={{padding:20,maxWidth:700,margin:"0 auto",position:"relative",zIndex:1}}><h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:16}}>Scoring Rules</h2>
    {rules.map(r=>(<div key={r.t} style={{background:C.card,borderRadius:10,padding:"12px 16px",marginBottom:8,border:"1px solid "+C.border}}><div style={{color:C.accent,fontWeight:700,fontSize:13,marginBottom:3,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>{r.t}</div><div style={{color:C.dim,fontSize:13,lineHeight:1.5}}>{r.c}</div></div>))}</div>);
}

function CommissionerTab({data,onPostResults,onSavePicks,onResetWeek,onNotifyDraft,onToggleLive,currentWeek}) {
  const [week,setWeek]=useState(currentWeek); const [editing,setEditing]=useState(false);
  const [drivers,setDrivers]=useState([]); const [playerPicks,setPlayerPicks]=useState({justin:[],bigmonroe:[],monroe:[],rich:[]});
  const [threeStages,setThreeStages]=useState(false);
  const [saving,setSaving]=useState(false); const [msg,setMsg]=useState("");
  const [fetching,setFetching]=useState(false); const [fetchNote,setFetchNote]=useState("");
  const race=SCHEDULE.find(s=>s.w===week); const done=!!(data.results?.["w"+week]);

  const handleFetchFromNASCAR=async()=>{
    setFetching(true); setFetchNote(""); setMsg("");
    const result = await fetchNASCARResults(week);
    setFetching(false);
    if(!result.ok){
      setFetchNote("⚠️ "+result.error);
      return;
    }
    // Populate the drivers editor with fetched data
    setDrivers(result.drivers.map(d=>({
      ...d,
      finish:String(d.finish),
      qualPos:String(d.qualPos),
      stage1:String(d.stage1||""),
      stage2:String(d.stage2||""),
      stage3:String(d.stage3||""),
      lapsLed:String(d.lapsLed||0),
    })));
    setThreeStages(!!result.threeStages);
    // Pre-populate existing player picks if available
    const wp=data.picks?.["w"+week]||{}; const pp={};
    PLAYERS.forEach(p=>{pp[p.id]=(wp[p.id]||[]).map(pk=>({driver:pk.driver,mulligan:pk.mulligan||false}));});
    if(Object.values(pp).every(v=>v.length===0)){
      setPlayerPicks({justin:[],bigmonroe:[],monroe:[],rich:[]});
    } else {
      setPlayerPicks(pp);
    }
    setEditing(true);
    setFetchNote(result.note+" Race: "+result.raceName+(result.trackName?" @ "+result.trackName:"")+".");
    setMsg("✅ "+result.drivers.length+" drivers loaded from NASCAR.com! Review the data below, enter the fastest lap driver, then click Score.");
  };

  const startEdit=()=>{
    const wr=data.results?.["w"+week];
    if(wr?.raw?.drivers){setThreeStages(!!wr.raw.threeStages);setDrivers(wr.raw.drivers.map(d=>({...d,finish:String(d.finish),qualPos:String(d.qualPos),stage1:String(d.stage1||""),stage2:String(d.stage2||""),stage3:String(d.stage3||""),lapsLed:String(d.lapsLed||0)})));}else{setDrivers([]);setThreeStages(false);}
    const wp=data.picks?.["w"+week]||{}; const pp={};
    PLAYERS.forEach(p=>{pp[p.id]=(wp[p.id]||[]).map(pk=>({driver:pk.driver,mulligan:pk.mulligan||false}));});
    setPlayerPicks(pp); setEditing(true); setMsg("");
  };
  const startNew=()=>{setDrivers([]);setThreeStages(false);setPlayerPicks({justin:[],bigmonroe:[],monroe:[],rich:[]});setEditing(true);setMsg("");};
  const addD=()=>setDrivers([...drivers,{name:"",finish:"",qualPos:"",stage1:"",stage2:"",stage3:"",lapsLed:"0",pole:false,stageWin1:false,stageWin2:false,stageWin3:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false}]);
  const ud=(i,f,v)=>{const n=[...drivers];n[i]={...n[i],[f]:v};setDrivers(n);}; const rm=(i)=>setDrivers(drivers.filter((_,j)=>j!==i));
  const addPick=(pid)=>{const cur=playerPicks[pid]||[];if(cur.length>=ACTIVE_PICKS)return;setPlayerPicks({...playerPicks,[pid]:[...cur,{driver:"",mulligan:false}]});};
  const updatePick=(pid,i,field,val)=>{const np={...playerPicks};np[pid]=[...np[pid]];np[pid][i]={...np[pid][i],[field]:val};setPlayerPicks(np);};
  const removePick=(pid,i)=>{const np={...playerPicks};np[pid]=np[pid].filter((_,j)=>j!==i);setPlayerPicks(np);};

  const buildRR=()=>({threeStages,drivers:drivers.map(d=>({name:d.name,finish:parseInt(d.finish)||40,qualPos:parseInt(d.qualPos)||40,stage1:parseInt(d.stage1)||0,stage2:parseInt(d.stage2)||0,stage3:parseInt(d.stage3)||0,lapsLed:parseInt(d.lapsLed)||0,pole:!!d.pole,stageWin1:!!d.stageWin1,stageWin2:!!d.stageWin2,stageWin3:!!d.stageWin3,fastestLap:!!d.fastestLap,mostLapsLed:!!d.mostLapsLed,dnf:!!d.dnf,dq:!!d.dq}))});
  const buildWP=()=>{const wp={};PLAYERS.forEach(p=>{wp[p.id]=(playerPicks[p.id]||[]).filter(pk=>pk.driver).map(pk=>({driver:pk.driver,mulligan:pk.mulligan}));});return wp;};

  const handleScore=async()=>{
    setSaving(true);setMsg("");
    const rr=buildRR(); const wp=buildWP();
    const mo={}; PLAYERS.forEach(p=>{mo[p.id]=(playerPicks[p.id]||[]).filter(pk=>pk.mulligan).map(pk=>({week,driver:pk.driver}));});
    const scored=scoreWeekFull(wp,rr,week,mo);
    await onPostResults(week,scored,rr,wp);
    setMsg("Week "+week+" "+(done?"updated":"scored")+"!"); setSaving(false); setEditing(false);
  };
  const handleSavePicksOnly=async()=>{setSaving(true);setMsg("");await onSavePicks(week,buildWP());setMsg("Week "+week+" picks saved (not scored).");setSaving(false);setEditing(false);};
  const handleReset=async()=>{if(!window.confirm("Reset Week "+week+"? Deletes all scores, picks, and draft data for this week. Cannot be undone."))return;await onResetWeek(week);setMsg("Week "+week+" reset to clean slate.");setEditing(false);};
  const iS={padding:"6px 8px",borderRadius:6,border:"1px solid "+C.border,background:C.input,color:C.text,fontSize:13,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box"};
  const hasPicks=!!(data.picks?.["w"+week]&&Object.values(data.picks["w"+week]).some(p=>p&&p.length>0));
  const hasDraft=!!(data.drafts?.["w"+week]?.length);

  return (<div style={{padding:20,maxWidth:1000,margin:"0 auto",position:"relative",zIndex:1}}>
    <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:4}}>Commissioner Panel</h2>
    <div style={{color:C.dim,fontSize:13,marginBottom:16}}>Score new weeks or edit past results</div>
    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
      <span style={{color:C.dim,fontSize:13}}>Week:</span>
      <select value={week} onChange={e=>{setWeek(Number(e.target.value));setEditing(false);setMsg("");}} style={{...iS,width:80}}>{SCHEDULE.map(s=><option key={s.w} value={s.w}>{s.w}</option>)}</select>
      {race&&<span style={{color:C.dim,fontSize:13}}>{race.r} · {TTL[race.ty]} x{TRACK_MULTS[race.ty]}</span>}
      {done&&!editing&&<span style={{color:C.green,fontSize:13,fontWeight:700}}>✓ Scored</span>}
    </div>
    <div style={{background:C.card,borderRadius:10,padding:"12px 16px",marginBottom:16,border:"1px solid "+(data.liveRace?.active?"#ef4444":C.border)}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
        <div><div style={{color:data.liveRace?.active?"#ef4444":C.dim,fontWeight:700,fontSize:13,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>{data.liveRace?.active?"🔴 LIVE SCORING ACTIVE — Week "+data.liveRace.week:"⚫ Live Scoring Off"}</div><div style={{color:C.dim,fontSize:11,marginTop:2}}>When active, everyone sees live standings updating every 30s via NASCAR.com</div></div>
        {data.liveRace?.active?<button onClick={()=>onToggleLive(data.liveRace.week,false)} style={{padding:"8px 16px",borderRadius:8,border:"1px solid #ef4444",background:"#ef444422",color:"#ef4444",fontFamily:"'Oswald',sans-serif",fontSize:12,fontWeight:700,cursor:"pointer",letterSpacing:1}}>END RACE</button>:<button onClick={()=>onToggleLive(week,true)} style={{padding:"8px 16px",borderRadius:8,border:"1px solid #10b981",background:"#10b98122",color:"#10b981",fontFamily:"'Oswald',sans-serif",fontSize:12,fontWeight:700,cursor:"pointer",letterSpacing:1}}>🟢 START LIVE — W{week}</button>}
      </div>
    </div>
    {!editing&&<div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
      <button onClick={handleFetchFromNASCAR} disabled={fetching} style={{padding:"10px 20px",borderRadius:8,border:"1px solid #10b981",background:"#10b981"+"22",color:"#10b981",fontSize:13,fontFamily:"inherit",fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>{fetching?"⏳ Fetching...":"🔌 Fetch from NASCAR.com"}</button>
      {done&&<button onClick={startEdit} style={{padding:"10px 20px",borderRadius:8,border:"1px solid "+C.accent,background:C.accent+"22",color:C.accent,fontSize:13,fontFamily:"inherit",fontWeight:600,cursor:"pointer"}}>Edit Week {week}</button>}
      {!done&&<button onClick={startNew} style={{padding:"10px 20px",borderRadius:8,border:"1px solid "+C.green,background:C.green+"22",color:C.green,fontSize:13,fontFamily:"inherit",fontWeight:600,cursor:"pointer"}}>Score Week {week}</button>}
      {!done&&hasPicks&&<button onClick={startEdit} style={{padding:"10px 20px",borderRadius:8,border:"1px solid "+C.accent,background:C.accent+"22",color:C.accent,fontSize:13,fontFamily:"inherit",fontWeight:600,cursor:"pointer"}}>Edit Picks</button>}
      {!done&&<button onClick={startNew} style={{padding:"10px 20px",borderRadius:8,border:"1px solid "+C.blue,background:C.blue+"22",color:C.blue,fontSize:13,fontFamily:"inherit",fontWeight:600,cursor:"pointer"}}>Set Picks Only</button>}
      {(done||hasPicks||hasDraft)&&<button onClick={handleReset} style={{padding:"10px 20px",borderRadius:8,border:"1px solid "+C.red,background:C.red+"22",color:C.red,fontSize:13,fontFamily:"inherit",fontWeight:600,cursor:"pointer"}}>Reset Week {week}</button>}
      {!done&&!hasDraft&&<button onClick={async()=>{await onNotifyDraft(week);setMsg("Email sent to first picker (if configured).");setTimeout(()=>setMsg(""),3000);}} style={{padding:"10px 20px",borderRadius:8,border:"1px solid "+C.purple,background:C.purple+"22",color:C.purple,fontSize:13,fontFamily:"inherit",fontWeight:600,cursor:"pointer"}}>📧 Notify First Picker</button>}
    </div>}
    {fetchNote&&<div style={{background:C.card,borderRadius:8,padding:"10px 14px",marginBottom:12,border:"1px solid "+C.border,color:C.dim,fontSize:12}}>{fetchNote}</div>}
    {!editing&&hasPicks&&!done&&<div style={{color:C.blue,fontSize:12,marginBottom:12}}>Picks saved for this week (not yet scored)</div>}
    {editing&&<>
      <div style={{marginBottom:16}}>
        <div style={{color:C.accent,fontSize:14,fontWeight:700,marginBottom:10,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1,textTransform:"uppercase"}}>Player Picks</div>
        {PLAYERS.map(p=>{const pks=playerPicks[p.id]||[];return(<div key={p.id} style={{background:C.card,borderRadius:10,padding:12,marginBottom:8,border:"1px solid "+C.border}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:4}}>
            <span style={{color:PC[p.id],fontWeight:700,fontSize:14}}>{PNAME[p.id]} ({pks.length}/{ACTIVE_PICKS})</span>
            <div style={{display:"flex",gap:4}}>
              {pks.length<ACTIVE_PICKS&&<button onClick={()=>addPick(p.id)} style={{padding:"4px 10px",borderRadius:6,border:"1px solid "+C.accent+"66",background:C.accent+"11",color:C.accent,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>+ Driver</button>}
              {pks.length>0&&<button onClick={()=>setPlayerPicks({...playerPicks,[p.id]:[]})} style={{padding:"4px 8px",borderRadius:6,border:"1px solid "+C.red+"66",background:C.red+"11",color:C.red,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Clear All</button>}
            </div>
          </div>
          {pks.map((pk,i)=>(<div key={i} style={{display:"flex",gap:6,alignItems:"center",marginBottom:4}}>
            <span style={{fontSize:10,color:C.dim,fontWeight:700,width:20}}>R{i+1}</span>
            <select value={pk.driver} onChange={e=>updatePick(p.id,i,"driver",e.target.value)} style={{...iS,flex:1}}><option value="">Select driver</option>{DRIVERS.map(dr=><option key={dr} value={dr}>{dr}{isMemorial(dr)?" 🕊️":""}</option>)}</select>
            <label style={{display:"flex",alignItems:"center",gap:3,cursor:"pointer",fontSize:11,color:pk.mulligan?C.accent:C.dim,flexShrink:0}}><input type="checkbox" checked={!!pk.mulligan} onChange={e=>updatePick(p.id,i,"mulligan",e.target.checked)}/>M</label>
            <button onClick={()=>removePick(p.id,i)} style={{background:C.red+"22",border:"1px solid "+C.red+"44",borderRadius:6,color:C.red,padding:"4px 8px",fontSize:10,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>X</button>
          </div>))}
        </div>);})}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{color:C.accent,fontSize:14,fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1,textTransform:"uppercase"}}>Race Results</div>
        <label style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12,color:threeStages?C.purple:C.dim}}><input type="checkbox" checked={threeStages} onChange={e=>setThreeStages(e.target.checked)}/>3 Stages (Coca-Cola 600)</label>
      </div>
      <button onClick={addD} style={{padding:"8px 16px",borderRadius:6,border:"1px solid "+C.accent,background:C.accent+"22",color:C.accent,fontSize:13,fontFamily:"inherit",fontWeight:600,cursor:"pointer",marginBottom:12}}>+ Add Driver Result</button>
      {drivers.map((d,i)=>(<div key={i} style={{background:C.card,borderRadius:10,padding:14,marginBottom:8,border:"1px solid "+C.border}}>
        <div style={{display:"flex",gap:6,marginBottom:8,alignItems:"center",flexWrap:"wrap"}}>
          <select value={d.name} onChange={e=>ud(i,"name",e.target.value)} style={{...iS,flex:"2 1 140px"}}><option value="">Select driver</option>{DRIVERS.map(dr=><option key={dr} value={dr}>{dr}</option>)}</select>
          <input placeholder="Fin" type="number" value={d.finish} onChange={e=>ud(i,"finish",e.target.value)} style={{...iS,flex:"0 1 50px"}}/>
          <input placeholder="Qual" type="number" value={d.qualPos} onChange={e=>ud(i,"qualPos",e.target.value)} style={{...iS,flex:"0 1 50px"}}/>
          <input placeholder="S1" type="number" value={d.stage1} onChange={e=>ud(i,"stage1",e.target.value)} style={{...iS,flex:"0 1 42px"}}/>
          <input placeholder="S2" type="number" value={d.stage2} onChange={e=>ud(i,"stage2",e.target.value)} style={{...iS,flex:"0 1 42px"}}/>
          {threeStages&&<input placeholder="S3" type="number" value={d.stage3} onChange={e=>ud(i,"stage3",e.target.value)} style={{...iS,flex:"0 1 42px"}}/>}
          <input placeholder="Led" type="number" value={d.lapsLed} onChange={e=>ud(i,"lapsLed",e.target.value)} style={{...iS,flex:"0 1 50px"}}/>
          <button onClick={()=>rm(i)} style={{background:C.red+"22",border:"1px solid "+C.red+"44",borderRadius:6,color:C.red,padding:"6px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>X</button></div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>{[["pole","Pole"],["stageWin1","S1 Win"],["stageWin2","S2 Win"],...(threeStages?[["stageWin3","S3 Win"]]:[]),["fastestLap","Fast Lap"],["mostLapsLed","Most Led"],["dnf","DNF"],["dq","DQ"]].map(([f,l])=>(<label key={f} style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",fontSize:12,color:d[f]?C.text:C.dim}}><input type="checkbox" checked={!!d[f]} onChange={e=>ud(i,f,e.target.checked)}/>{l}</label>))}</div>
      </div>))}
      <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
        <button onClick={handleScore} disabled={saving} style={{flex:1,padding:"14px 0",borderRadius:8,border:"none",background:C.accent,color:"#000",fontFamily:"'Oswald',sans-serif",fontSize:16,fontWeight:700,letterSpacing:2,textTransform:"uppercase",cursor:"pointer"}}>{saving?"Saving...":(done?"Re-Score Week "+week:"Score Week "+week)}</button>
        <button onClick={handleSavePicksOnly} disabled={saving} style={{padding:"14px 16px",borderRadius:8,border:"1px solid "+C.blue,background:C.blue+"22",color:C.blue,fontFamily:"'Oswald',sans-serif",fontSize:13,fontWeight:700,cursor:"pointer",letterSpacing:1,textTransform:"uppercase"}}>Save Picks Only</button>
        <button onClick={()=>setEditing(false)} style={{padding:"14px 16px",borderRadius:8,border:"1px solid "+C.border,background:"transparent",color:C.dim,fontFamily:"'Oswald',sans-serif",fontSize:14,cursor:"pointer"}}>Cancel</button>
      </div>{msg&&<div style={{color:C.green,marginTop:10,textAlign:"center",fontSize:14}}>{msg}</div>}
    </>}
    {done&&!editing&&(()=>{const wr=data.results["w"+week];const s=Object.entries(wr.scored||{}).sort((a,b)=>b[1].total-a[1].total);return<div style={{marginTop:8}}><div style={{color:C.dim,fontSize:11,textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>Current Scores</div>{s.map(([pid,ps])=>(<div key={pid} style={{display:"flex",justifyContent:"space-between",padding:"8px 12px",background:C.card,borderRadius:8,marginBottom:4,border:"1px solid "+(ps.weeklyWin?C.accent+"44":C.border)}}><span style={{color:PC[pid],fontWeight:600,fontSize:14}}>{ps.weeklyWin?"👑 ":""}{PNAME[pid]}</span><span style={{color:PC[pid],fontWeight:700,fontSize:16}}>{ps.total}</span></div>))}</div>;})()}
    {msg&&!editing&&<div style={{color:C.green,marginTop:10,textAlign:"center",fontSize:14}}>{msg}</div>}
  </div>);
}

export default function App() {
  const [user,setUser]=useState(null); const [tab,setTab]=useState("welcome");
  const [data,setData]=useState(null); const [loading,setLoading]=useState(true);
  const [dbStatus,setDbStatus]=useState("connecting");
  const [liveScores,setLiveScores]=useState(null);
  const [liveStatus,setLiveStatus]=useState("");
  const [installPrompt,setInstallPrompt]=useState(null);
  const [showInstall,setShowInstall]=useState(false);
  const [showWinnerModal,setShowWinnerModal]=useState(false);

  const handleLogin=(p)=>{
    setUser(p);
    // Show winner modal if this player won last week
    const last=getLastWeekResults(data);
    if(last?.winner===p.id) setShowWinnerModal(true);
  };

  // Capture the browser's install prompt (Chrome/Android)
  useEffect(()=>{
    const handler = e => { e.preventDefault(); setInstallPrompt(e); setShowInstall(true); };
    window.addEventListener('beforeinstallprompt', handler);
    // Hide if already installed
    window.addEventListener('appinstalled', ()=>setShowInstall(false));
    return ()=>window.removeEventListener('beforeinstallprompt', handler);
  },[]);

  const handleInstall = async () => {
    if(!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if(outcome === 'accepted') setShowInstall(false);
  };

  // Live polling effect — activates when data.liveRace.active === true
  useEffect(()=>{
    if(!data?.liveRace?.active) { setLiveScores(null); setLiveStatus(""); return; }
    const week = data.liveRace.week;
    let timer;
    const poll = async () => {
      try {
        const result = await fetchLiveRaceData(week);
        if(!result.ok) return;
        // Score picks against live results (provisional)
        const wp = data.picks?.["w"+week] || {};
        const mo = {}; PLAYERS.forEach(p=>{ mo[p.id]=(wp[p.id]||[]).filter(pk=>pk.mulligan).map(pk=>({week,driver:pk.driver})); });
        const scored = scoreWeekFull(wp, {drivers:result.drivers, threeStages:result.threeStages}, week, mo);
        setLiveScores(scored);
        const now = new Date(); setLiveStatus(`Live · ${now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`);
      } catch(e) { console.error("Live poll error:", e); }
    };
    poll(); // immediate first fetch
    timer = setInterval(poll, LIVE_POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [data?.liveRace?.active, data?.liveRace?.week]);

  useEffect(()=>{let unsub=null;(async()=>{try{
    let d=await loadLeagueData(); if(d)setDbStatus("connected"); else{d=loadLocalBackup();if(d)setDbStatus("offline");}
    if(!d){d=buildInitialData();setDbStatus(isFirebaseReady()?"new":"offline");await saveLeagueData(d);}
    setData(d);setLoading(false);unsub=subscribeToLeagueData(u=>{setData(u);setDbStatus("connected");});
  }catch(e){console.error("Startup error:",e);setData(loadLocalBackup()||buildInitialData());setLoading(false);setDbStatus("offline");}})();
  return()=>{if(unsub)unsub();};},[]);

  const currentWeek=useMemo(()=>data?(data.meta.lastScoredWeek||13)+1:14,[data]);

  const notifyNextPicker=async(week,dataAfterPick)=>{
    if(!isEmailConfigured())return;
    const draftKey="w"+week;
    const draftState=dataAfterPick.drafts?.[draftKey]||[];
    const snakeSequence=buildSnakeOrder(getDraftOrder(dataAfterPick,week));
    const nextPickIdx=draftState.length;
    if(nextPickIdx>=snakeSequence.length)return;
    const nextPicker=snakeSequence[nextPickIdx];
    const settings=dataAfterPick.playerSettings?.[nextPicker.pid]||{};
    const email=settings.email||DEFAULT_EMAILS[nextPicker.pid];
    if(!email||settings.notifyOnTurn===false)return;
    if(user&&nextPicker.pid===user.id&&nextPickIdx>0)return;
    const raceInfo=SCHEDULE.find(s=>s.w===week);
    sendDraftEmail({toEmail:email,name:PNAME[nextPicker.pid],week,race:raceInfo?.r||"the next race",track:raceInfo?.t||"",pickNumber:nextPickIdx+1,round:nextPicker.round});
  };

  const handleDraftPick=async(week,pid,driver,pickNum)=>{
    const d=JSON.parse(JSON.stringify(data)); if(!d.drafts)d.drafts={}; const key="w"+week;
    if(!d.drafts[key])d.drafts[key]=[]; d.drafts[key].push({pid,driver,pickNum});
    if(!d.picks)d.picks={}; if(!d.picks[key])d.picks[key]={}; if(!d.picks[key][pid])d.picks[key][pid]=[];
    d.picks[key][pid].push({driver,mulligan:false});
    setData(d); await saveLeagueData(d);
    notifyNextPicker(week,d).catch(e=>console.error("Email notify failed:",e));
  };
  const handleUndoDraft=async(week)=>{
    const d=JSON.parse(JSON.stringify(data)); const key="w"+week;
    if(!d.drafts?.[key]?.length)return;
    const removed=d.drafts[key].pop();
    if(d.picks?.[key]?.[removed.pid]){const idx=d.picks[key][removed.pid].findIndex(pk=>pk.driver===removed.driver);if(idx>=0)d.picks[key][removed.pid].splice(idx,1);}
    setData(d); await saveLeagueData(d); return removed;
  };
  const recalcMeta=(d)=>{
    const fs={justin:0,bigmonroe:0,monroe:0,rich:0},fp2={justin:0,bigmonroe:0,monroe:0,rich:0}; let last=0;
    Object.entries(d.results||{}).forEach(([key,wr])=>{const w=parseInt(key.replace("w",""));if(w>last)last=w;if(!wr.scored)return;
      Object.entries(wr.scored).forEach(([pid,s])=>{fs[pid]=Math.round((fs[pid]+s.total)*100)/100;fp2[pid]=Math.round((fp2[pid]+(s.bonusPoints||0))*100)/100;if(s.weeklyWin)fp2[pid]=Math.round((fp2[pid]+25)*100)/100;});});
    const mc={justin:0,bigmonroe:0,monroe:0,rich:0};
    Object.entries(d.picks||{}).forEach(([,wp])=>{Object.entries(wp).forEach(([pid,pks])=>{(pks||[]).forEach(pk=>{if(pk.mulligan)mc[pid]++;});});});
    d.meta.standings=fs; d.meta.playoffPts=fp2; d.meta.lastScoredWeek=last; d.meta.mulligansUsed=mc;
  };
  const handlePostResults=async(week,scored,rr,wp)=>{
    const d=JSON.parse(JSON.stringify(data)); if(!d.results)d.results={}; if(!d.picks)d.picks={};
    d.results["w"+week]={scored,raw:rr}; d.picks["w"+week]=wp; recalcMeta(d);
    setData(d); await saveLeagueData(d);
  };
  const handleSavePicksOnly=async(week,wp)=>{
    const d=JSON.parse(JSON.stringify(data)); if(!d.picks)d.picks={}; if(!d.drafts)d.drafts={};
    d.picks["w"+week]=wp;
    // Also write to drafts so the Draft tab shows as locked (prevents double-drafting)
    const order=getDraftOrder(d,week);
    const seq=buildSnakeOrder(order);
    const draftEntries=[];
    PLAYERS.forEach(pid=>{
      (wp[pid]||[]).forEach((pk,i)=>{
        if(pk.driver) draftEntries.push({pid,driver:pk.driver,pickNum:draftEntries.length});
      });
    });
    d.drafts["w"+week]=draftEntries;
    setData(d); await saveLeagueData(d);
  };
  const handleResetWeek=async(week)=>{
    const d=JSON.parse(JSON.stringify(data)); const key="w"+week;
    delete d.results[key]; delete d.picks[key]; if(d.drafts)delete d.drafts[key];
    recalcMeta(d); setData(d); await saveLeagueData(d);
  };
  const handleSaveSettings=async(pid,settings)=>{
    const d=JSON.parse(JSON.stringify(data)); if(!d.playerSettings)d.playerSettings={};
    d.playerSettings[pid]={...d.playerSettings[pid],...settings};
    setData(d); await saveLeagueData(d);
  };
  const handleApplyMulligan=async(week,pid,oldDriver,newDriver)=>{
    const d=JSON.parse(JSON.stringify(data)); const key="w"+week;
    if(!d.picks?.[key]?.[pid])return;
    d.picks[key][pid]=d.picks[key][pid].map(pk=>pk.driver===oldDriver?{driver:newDriver,mulligan:true}:pk);
    if(!d.mulligans)d.mulligans={justin:[],bigmonroe:[],monroe:[],rich:[]}; if(!d.mulligans[pid])d.mulligans[pid]=[];
    d.mulligans[pid].push({week,driver:oldDriver,replacement:newDriver});
    const mc={justin:0,bigmonroe:0,monroe:0,rich:0};
    Object.entries(d.picks||{}).forEach(([,wp])=>{Object.entries(wp).forEach(([p,pks])=>{(pks||[]).forEach(pk=>{if(pk.mulligan)mc[p]++;});});});
    d.meta.mulligansUsed=mc; setData(d); await saveLeagueData(d);
  };
  const handleStartDraftNotify=async(week)=>{await notifyNextPicker(week,data);};

  const handleToggleLive=async(week, active)=>{
    const d=JSON.parse(JSON.stringify(data));
    d.liveRace = { active, week, startedAt: active ? new Date().toISOString() : null };
    setData(d); await saveLeagueData(d);
  };

  if(loading)return(<div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:C.bg,gap:12}}>
    <FerdaLogo size="large"/>
    <div style={{color:C.dim,fontSize:13}}>Connecting to database...</div></div>);
  if(!user)return <LoginScreen onLogin={handleLogin}/>;
  return (<div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Barlow Condensed',sans-serif",color:C.text}}>
    <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.75; } }`}</style>
    <MemorialBackdrop/>
    {showWinnerModal&&<WinnerModal player={user} data={data} onDismiss={()=>setShowWinnerModal(false)}/>}
    <Nav player={user} tab={tab} setTab={setTab} onLogout={()=>setUser(null)}/>
    {dbStatus==="offline"&&<div style={{background:C.red+"22",color:C.red,textAlign:"center",padding:"6px",fontSize:11,fontWeight:600,position:"relative",zIndex:1}}>OFFLINE MODE — Firebase not connected</div>}
    {showInstall&&<div style={{background:"linear-gradient(90deg,#f59e0b,#ef4444)",padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"relative",zIndex:2}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}><img src="/icons/icon-72x72.png" style={{width:36,height:36,borderRadius:8}}/><div><div style={{color:"#000",fontWeight:700,fontSize:13}}>Install FERDA Racing</div><div style={{color:"#000",fontSize:11,opacity:0.8}}>Add to home screen for the best experience</div></div></div>
      <div style={{display:"flex",gap:8}}><button onClick={handleInstall} style={{padding:"6px 14px",borderRadius:8,border:"none",background:"#000",color:"#fff",fontFamily:"'Oswald',sans-serif",fontSize:12,fontWeight:700,cursor:"pointer",letterSpacing:1}}>INSTALL</button><button onClick={()=>setShowInstall(false)} style={{padding:"6px 8px",borderRadius:8,border:"none",background:"rgba(0,0,0,0.2)",color:"#000",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✕</button></div>
    </div>}
    <FlagBanner user={user} data={data} currentWeek={currentWeek} onGoTo={setTab}/>
    {tab==="welcome"&&<WelcomeTab player={user} data={data} setTab={setTab} liveScores={liveScores} liveStatus={liveStatus}/>}
    {tab==="draft"&&<DraftTab player={user} data={data} onDraftPick={handleDraftPick} onUndoDraft={handleUndoDraft} currentWeek={currentWeek}/>}
    {tab==="lineups"&&<LineupsTab data={data} currentWeek={currentWeek}/>}
    {tab==="mulligans"&&<MulligansTab player={user} data={data} currentWeek={currentWeek} onApplyMulligan={handleApplyMulligan}/>}
    {tab==="live"&&<LiveTab data={data} liveScores={liveScores} liveStatus={liveStatus} currentWeek={currentWeek}/>}
    {tab==="results"&&<ResultsTab data={data}/>}
    {tab==="playoffs"&&<PlayoffsTab data={data}/>}
    {tab==="projections"&&<ProjectionsTab data={data} currentWeek={currentWeek}/>}
    {tab==="schedule"&&<ScheduleTab data={data}/>}
    {tab==="rules"&&<RulesTab/>}
    {tab==="settings"&&<SettingsTab player={user} data={data} onSaveSettings={handleSaveSettings}/>}
    {tab==="commissioner"&&user.id==="justin"&&<CommissionerTab data={data} onPostResults={handlePostResults} onSavePicks={handleSavePicksOnly} onResetWeek={handleResetWeek} onNotifyDraft={handleStartDraftNotify} onToggleLive={handleToggleLive} currentWeek={currentWeek}/>}
  </div>);
}
