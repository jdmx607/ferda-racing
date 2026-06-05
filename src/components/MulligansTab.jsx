import { useState } from "react";
import { C, PClr } from "../theme";
import { DRIVERS, MAX_MULLIGANS, isMemorial } from "../constants";

export function MulligansTab({player,data,currentWeek,onApplyMulligan}) {
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
