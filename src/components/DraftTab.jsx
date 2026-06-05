import { useState, useMemo } from "react";
import { C, PClr, PC, TTC, TTL } from "../theme";
import { PLAYERS, PNAME, SCHEDULE, DRIVERS, DRIVER_INFO, MAKE_COLORS, ACTIVE_PICKS, TRACK_MULTS, isMemorial } from "../constants";
import { getDraftOrder, buildSnakeOrder } from "../engine/draft";

export function DraftTab({player,data,onDraftPick,onUndoDraft,currentWeek}) {
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
