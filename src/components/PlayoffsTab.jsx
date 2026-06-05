import { useMemo } from "react";
import { C, PClr } from "../theme";
import { PLAYERS, PNAME, PLAYOFF_START_WEEK, REG_SEASON_CHAMP_BONUS } from "../constants";

export function PlayoffsTab({data}) {
  const scored=Object.keys(data.results||{}).length;
  const weeksUntil=Math.max(0,PLAYOFF_START_WEEK-scored);
  const playoffsStarted=scored>=PLAYOFF_START_WEEK;

  const regStandings=PLAYERS.map(p=>({id:p.id,pts:data.meta.standings[p.id]||0})).sort((a,b)=>b.pts-a.pts);
  const regLeader=regStandings[0]?.id;
  const isTied=regStandings[0]?.pts===regStandings[1]?.pts;

  const ps=useMemo(()=>PLAYERS.map(p=>{
    const base=1000;
    const pp=data.meta.playoffPts[p.id]||0;
    const champBonus=(p.id===regLeader&&!isTied)?REG_SEASON_CHAMP_BONUS:0;
    return{...p,base,pp,champBonus,total:base+pp+champBonus,
      wins:Object.values(data.results||{}).filter(r=>r.scored?.[p.id]?.weeklyWin).length,
      regPts:data.meta.standings[p.id]||0};
  }).sort((a,b)=>b.total-a.total),[data,regLeader,isTied]);

  return (<div style={{padding:20,maxWidth:900,margin:"0 auto",position:"relative",zIndex:1}}>
    <h2 style={{color:C.text,fontFamily:"'Oswald',sans-serif",fontSize:26,marginBottom:4}}>Playoff Picture</h2>
    <div style={{color:C.dim,fontSize:13,marginBottom:8}}>If the chase started today — {scored} races completed, {weeksUntil} until playoffs</div>
    <div style={{background:C.card,borderRadius:10,padding:14,marginBottom:16,border:"1px solid "+C.border}}>
      <div style={{color:C.dim,fontSize:11,marginBottom:4}}>Everyone starts at <span style={{color:C.accent,fontWeight:700}}>1,000</span> base. Playoff points (weekly wins +25, bonus pts) carry over. Regular season leader earns <span style={{color:C.accent,fontWeight:700}}>+{REG_SEASON_CHAMP_BONUS} bonus pts</span>.</div>
      {!isTied&&regLeader&&<div style={{color:C.accent,fontSize:12,fontWeight:700}}>🏆 Current reg. season leader: {PNAME[regLeader]} {playoffsStarted?"(+50 applied)":"(projected +50 if they hold the lead)"}</div>}
      {isTied&&<div style={{color:"#f59e0b",fontSize:12}}>⚠️ Tie at the top — no bonus awarded until the lead is broken</div>}
    </div>
    <div style={{display:"grid",gap:12}}>{ps.map((p,i)=>(
      <div key={p.id} style={{background:PClr[p.id].bg,borderRadius:12,padding:"18px 20px",border:"2px solid "+(i===0?C.accent:PClr[p.id].bg==="#000000"?C.border:PClr[p.id].bg+"88")}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:38,height:38,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:PClr[p.id].fg,color:PClr[p.id].bg,fontWeight:700,fontSize:17,fontFamily:"'Oswald',sans-serif"}}>{i+1}</div>
            <div>
              <div style={{color:PClr[p.id].fg,fontWeight:700,fontSize:20,fontFamily:"'Barlow Condensed',sans-serif"}}>{p.name}{p.champBonus>0?<span style={{fontSize:12,color:C.accent,marginLeft:8}}>👑 Reg. Champion</span>:""}</div>
              <div style={{color:PClr[p.id].fg+"99",fontSize:12}}>{p.wins} weekly win{p.wins!==1?"s":""}</div>
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{color:PClr[p.id].fg,fontFamily:"'Oswald',sans-serif",fontSize:32,fontWeight:700}}>{p.total}</div>
            <div style={{color:PClr[p.id].fg+"88",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Chase Pts</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <div style={{background:"rgba(0,0,0,0.2)",borderRadius:8,padding:"8px 12px",flex:1,minWidth:80}}><div style={{fontSize:10,color:PClr[p.id].fg+"88",textTransform:"uppercase"}}>Base</div><div style={{fontSize:16,fontWeight:700,color:PClr[p.id].fg,fontFamily:"'Oswald',sans-serif"}}>{p.base}</div></div>
          <div style={{background:"rgba(0,0,0,0.2)",borderRadius:8,padding:"8px 12px",flex:1,minWidth:80}}><div style={{fontSize:10,color:PClr[p.id].fg+"88",textTransform:"uppercase"}}>Playoff Pts</div><div style={{fontSize:16,fontWeight:700,color:C.accent,fontFamily:"'Oswald',sans-serif"}}>+{p.pp}</div></div>
          {p.champBonus>0&&<div style={{background:"rgba(245,158,11,0.2)",borderRadius:8,padding:"8px 12px",flex:1,minWidth:80,border:"1px solid "+C.accent+"44"}}><div style={{fontSize:10,color:C.accent,textTransform:"uppercase"}}>Champ Bonus</div><div style={{fontSize:16,fontWeight:700,color:C.accent,fontFamily:"'Oswald',sans-serif"}}>+{p.champBonus}</div></div>}
          <div style={{background:"rgba(0,0,0,0.2)",borderRadius:8,padding:"8px 12px",flex:1,minWidth:80}}><div style={{fontSize:10,color:PClr[p.id].fg+"88",textTransform:"uppercase"}}>Reg Season</div><div style={{fontSize:16,fontWeight:700,color:PClr[p.id].fg,fontFamily:"'Oswald',sans-serif"}}>{p.regPts}</div></div>
        </div>
      </div>
    ))}</div>
    <div style={{marginTop:20,background:C.card,borderRadius:10,padding:14,border:"1px solid "+C.border}}><div style={{color:C.dim,fontSize:12,lineHeight:1.6}}>The Chase begins Week {PLAYOFF_START_WEEK} (Darlington). All players reset to 1,000 + playoff pts + regular season champion bonus (if applicable), then regular scoring continues through Week 36 (Homestead).</div></div>
  </div>);
}
