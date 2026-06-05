import { C, PClr } from "../theme";
import { PLAYERS, SCHEDULE, DRIVER_INFO, MAKE_COLORS } from "../constants";

export function LiveTab({data, liveScores, liveStatus, currentWeek}) {
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

  const ranked = PLAYERS.map(p=>({
    ...p,
    seasonPts: data.meta.standings[p.id]||0,
    livePts: liveScores[p.id]?.total||0,
    grandTotal: Math.round(((data.meta.standings[p.id]||0)+(liveScores[p.id]?.total||0))*100)/100,
    drivers: liveScores[p.id]?.drivers||[],
    picks: weekPicks[p.id]||[],
  })).sort((a,b)=>b.livePts-a.livePts);

  return (<div style={{padding:20,maxWidth:900,margin:"0 auto",position:"relative",zIndex:1}}>
    <div style={{background:"linear-gradient(90deg,#ef4444,#f59e0b)",borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:20}}>🔴</span><div><div style={{color:"#000",fontWeight:900,fontFamily:"'Oswald',sans-serif",fontSize:18,letterSpacing:1}}>RACE IN PROGRESS</div><div style={{color:"#000",fontSize:12,opacity:0.8}}>{weekInfo?.r} @ {weekInfo?.t} — W{week}</div></div></div>
      <div style={{textAlign:"right"}}><div style={{color:"#000",fontSize:12,fontWeight:700}}>{liveStatus}</div><div style={{color:"#000",fontSize:10,opacity:0.7}}>Updates every 30s</div></div>
    </div>

    <div style={{display:"grid",gap:12}}>{ranked.map((p,i)=>{
      const mullPicks=(p.picks||[]).filter(pk=>pk.mulligan).map(pk=>pk.driver);
      return(<div key={p.id} style={{background:PClr[p.id].bg,borderRadius:12,border:"2px solid "+(i===0?"#ef4444":PClr[p.id].bg==="#000000"?C.border:PClr[p.id].bg+"88")}}>
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
