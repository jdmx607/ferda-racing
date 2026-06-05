import { useState } from "react";
import { C, PClr, TTC, TTL } from "../theme";
import { PNAME, SCHEDULE, TRACK_MULTS, isMemorial } from "../constants";

export function ResultsTab({data}) {
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
