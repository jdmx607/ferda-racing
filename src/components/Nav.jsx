import { C, PClr } from "../theme";
import { PLAYERS, PNAME, ACTIVE_PICKS } from "../constants";
import { getDraftOrder, buildSnakeOrder } from "../engine/draft";
import { FerdaLogo } from "./FerdaLogo";

function Banner({flag,text,onClick}){
  const flags={green:{bg:"#10b981",fg:"#000",icon:"🟢"},yellow:{bg:"#fbbf24",fg:"#000",icon:"🟡"},red:{bg:"#dc2626",fg:"#fff",icon:"🔴"},white:{bg:"#f8fafc",fg:"#000",icon:"⚪"},checkered:{bg:"#1f2937",fg:"#fff",icon:"🏁"}};
  const f=flags[flag];
  const checkeredBg = flag==="checkered" ? "repeating-linear-gradient(45deg, #1f2937 0px, #1f2937 10px, #f8fafc 10px, #f8fafc 20px)" : f.bg;
  return (<div onClick={onClick} style={{background:checkeredBg,color:f.fg,padding:"10px 16px",textAlign:"center",fontFamily:"'Oswald',sans-serif",fontWeight:700,fontSize:14,letterSpacing:1,textTransform:"uppercase",cursor:onClick?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",gap:10,borderBottom:"2px solid rgba(0,0,0,0.3)",position:"relative",zIndex:1,animation:flag==="green"?"pulse 2s infinite":"none"}}>
    <span style={{fontSize:20}}>{f.icon}</span>
    <span style={{background:flag==="checkered"?"rgba(0,0,0,0.6)":"transparent",padding:flag==="checkered"?"4px 10px":0,borderRadius:6}}>{text}</span>
    {onClick&&<span style={{fontSize:11,opacity:0.7,marginLeft:4}}>→</span>}
  </div>);
}

export function FlagBanner({user,data,currentWeek,onGoTo}) {
  if(!user||!data) return null;
  const draftKey="w"+currentWeek;
  const draftState=data.drafts?.[draftKey]||[];
  const draftOrder=getDraftOrder(data,currentWeek);
  const snakeSequence=buildSnakeOrder(draftOrder);
  const currentPickNum=draftState.length;
  const draftComplete=currentPickNum>=snakeSequence.length;
  const savedPicks=data.picks?.[draftKey]||{};
  const hasSavedPicks=Object.values(savedPicks).some(p=>p&&p.length>0);
  const hasScored=!!(data.results?.[draftKey]?.scored);

  if(draftState.length===0&&!hasSavedPicks&&!hasScored){
    const firstUp=snakeSequence[0]?.pid;
    if(firstUp===user.id) return <Banner flag="green" text={"Your turn to pick first for Week "+currentWeek+"!"} onClick={()=>onGoTo("draft")}/>;
    return null;
  }
  if(hasScored) return <Banner flag="checkered" text={"Week "+currentWeek+" is complete. Results posted."} onClick={()=>onGoTo("results")}/>;
  if(draftComplete||(hasSavedPicks&&draftState.length===0)) return <Banner flag="checkered" text={"All picks locked for Week "+currentWeek+". Race day!"} onClick={()=>onGoTo("lineups")}/>;

  const currentTurn=snakeSequence[currentPickNum];
  const nextTurn=snakeSequence[currentPickNum+1];
  const lastRound=currentTurn?.round===ACTIVE_PICKS;
  if(currentTurn?.pid===user.id) return <Banner flag={lastRound?"white":"green"} text={lastRound?"FINAL ROUND — Your pick!":"Your turn to pick!"} onClick={()=>onGoTo("draft")}/>;
  if(nextTurn?.pid===user.id) return <Banner flag="yellow" text={"You're up next after "+PNAME[currentTurn.pid]}/>;
  return <Banner flag="red" text={"Waiting on "+PNAME[currentTurn.pid]+" to pick"}/>;
}

export function Nav({player,tab,setTab,onLogout}) {
  const tabs=[
    {id:"welcome",l:"Home"},
    {id:"draft",l:"Draft"},
    {id:"lineups",l:"Lineups"},
    {id:"mulligans",l:"Mulligans"},
    {id:"live",l:"🔴 Live"},
    {id:"results",l:"Results"},
    {id:"playoffs",l:"Playoffs"},
    {id:"projections",l:"Projections"},
    {id:"schedule",l:"Schedule"},
    {id:"rules",l:"Rules"},
    {id:"settings",l:"Settings"},
  ];
  if(player.id==="justin") tabs.push({id:"commissioner",l:"COMMISH",red:true});
  return (<nav style={{background:"#000000",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 12px",height:52,position:"sticky",top:0,zIndex:100,overflowX:"auto"}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}><FerdaLogo size="small"/><div style={{display:"flex",gap:1}}>{tabs.map(t=>(<button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"7px 8px",borderRadius:6,border:t.red?"1px solid #ef4444":"none",background:tab===t.id?(t.red?"#ef4444":C.accent+"22"):"transparent",color:tab===t.id?(t.red?"#fff":C.accent):(t.red?"#ef4444":C.dim),fontFamily:"'Barlow Condensed',sans-serif",fontSize:11,fontWeight:t.red?700:600,cursor:"pointer",letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap"}}>{t.l}</button>))}</div></div>
    <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}><span style={{color:C.dim,fontSize:11}}>{player.name}</span><button onClick={onLogout} style={{padding:"5px 8px",borderRadius:6,border:"1px solid "+C.border,background:"transparent",color:C.dim,fontFamily:"inherit",fontSize:10,cursor:"pointer"}}>Out</button></div>
  </nav>);
}
