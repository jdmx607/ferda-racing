import { useState } from "react";
import { C, TTC, TTL } from "../theme";
import { SCHEDULE, DRIVER_INFO, MAKE_COLORS, TRACK_MULTS } from "../constants";
import { fetchDriverProjections } from "../nascar";

export function ProjectionsTab({data, currentWeek}) {
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
        <div style={{display:"grid",gridTemplateColumns:"32px 1fr 60px 60px 60px 70px",gap:8,padding:"8px 14px",background:"rgba(255,255,255,0.04)",borderBottom:"1px solid "+C.border}}>
          {["#","Driver","Start","Finish","Laps Led","Proj Pts"].map(h=>(<span key={h} style={{color:C.dim,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>{h}</span>))}
        </div>
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
