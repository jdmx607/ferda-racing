import { useState } from "react";
import { C, PClr, TTC, TTL } from "../theme";
import { PLAYERS, PNAME, SCHEDULE, ACTIVE_PICKS, MAX_MULLIGANS, TRACK_MULTS, isMemorial } from "../constants";

export function LineupsTab({data,currentWeek}) {
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
