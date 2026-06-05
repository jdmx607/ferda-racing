import { useMemo } from "react";
import { C, PClr, TTC, TTL } from "../theme";
import { PLAYERS, PNAME, SCHEDULE, MAX_MULLIGANS, TRACK_MULTS } from "../constants";

export function WelcomeTab({player, data, setTab, liveScores, liveStatus}) {
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
