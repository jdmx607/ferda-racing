import { useState } from "react";
import { C, PClr } from "../theme";
import { PLAYERS, SCHEDULE, MEMORIAL_DRIVERS } from "../constants";
import { FerdaLogo } from "./FerdaLogo";

export function getLastWeekResults(data) {
  const weeks=Object.keys(data.results||{}).map(k=>parseInt(k.replace("w",""))).sort((a,b)=>b-a);
  if(!weeks.length) return null;
  const key="w"+weeks[0];
  const scored=data.results[key]?.scored;
  if(!scored) return null;
  const sorted=Object.entries(scored).sort((a,b)=>b[1].total-a[1].total);
  return { week:weeks[0], winner:sorted[0]?.[0], loser:sorted[sorted.length-1]?.[0], scores:scored };
}

export function WinnerModal({player, data, onDismiss}) {
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

export function LoginScreen({onLogin}) {
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
