import { C, TTC, TTL } from "../theme";
import { SCHEDULE, PLAYOFF_START_WEEK, TRACK_MULTS } from "../constants";

export function ScheduleTab({data}) {
  const scored=new Set(Object.keys(data.results||{}).map(k=>parseInt(k.replace("w",""))));
  return (<div style={{padding:20,maxWidth:700,margin:"0 auto",position:"relative",zIndex:1}}>
    <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:8}}>2026 Schedule</h2>
    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>{Object.entries(TTC).map(([t,c])=>(<span key={t} style={{fontSize:11,color:c,background:c+"18",padding:"3px 10px",borderRadius:12,fontWeight:600}}>{TTL[t]} x{TRACK_MULTS[t]}</span>))}</div>
    <div style={{display:"grid",gap:3}}>{SCHEDULE.map(s=>(<div key={s.w} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",borderRadius:8,background:s.w===PLAYOFF_START_WEEK?C.accent+"11":C.card,border:"1px solid "+(s.w>=PLAYOFF_START_WEEK?C.accent+"33":C.border)}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{color:scored.has(s.w)?C.green:C.dim,fontSize:11,width:36,fontWeight:700}}>{scored.has(s.w)?"✓ ":""}W{s.w}</span><div><span style={{color:C.text,fontSize:13,fontWeight:600}}>{s.r}</span><span style={{color:C.dim,fontSize:11,marginLeft:6}}>@ {s.t}</span></div>{s.w===PLAYOFF_START_WEEK&&<span style={{fontSize:9,color:C.accent,fontWeight:700,letterSpacing:1}}>PLAYOFFS</span>}</div>
      <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{color:C.dim,fontSize:10}}>{s.d}</span><span style={{fontSize:10,color:TTC[s.ty],fontWeight:600,background:TTC[s.ty]+"18",padding:"2px 8px",borderRadius:10}}>{TTL[s.ty]}</span></div>
    </div>))}</div></div>);
}
