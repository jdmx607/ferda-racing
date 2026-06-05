import { useState } from "react";
import { C, PClr, PC, TTC, TTL } from "../theme";
import { PLAYERS, PNAME, SCHEDULE, DRIVERS, ACTIVE_PICKS, TRACK_MULTS, isMemorial } from "../constants";
import { scoreWeekFull } from "../engine/scoring";
import { getDraftOrder, buildSnakeOrder } from "../engine/draft";
import { fetchNASCARResults } from "../nascar";

export function CommissionerTab({data,onPostResults,onSavePicks,onResetWeek,onNotifyDraft,onToggleLive,currentWeek}) {
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
    if(!result.ok){ setFetchNote("⚠️ "+result.error); return; }
    setDrivers(result.drivers.map(d=>({...d,finish:String(d.finish),qualPos:String(d.qualPos),stage1:String(d.stage1||""),stage2:String(d.stage2||""),stage3:String(d.stage3||""),lapsLed:String(d.lapsLed||0)})));
    setThreeStages(!!result.threeStages);
    const wp=data.picks?.["w"+week]||{}; const pp={};
    PLAYERS.forEach(p=>{pp[p.id]=(wp[p.id]||[]).map(pk=>({driver:pk.driver,mulligan:pk.mulligan||false}));});
    if(Object.values(pp).every(v=>v.length===0)){ setPlayerPicks({justin:[],bigmonroe:[],monroe:[],rich:[]}); } else { setPlayerPicks(pp); }
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
