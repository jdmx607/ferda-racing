import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { saveLeagueData } from "./firebase";
import { sendDraftEmail, isEmailConfigured, DEFAULT_EMAILS } from "./email";
import { fetchNASCARResults } from "./nascar";
import {
  PLAYERS, PNAME, SCHEDULE,
  GARAGE_PICK_ENABLED, PICKS_PER_WEEK, ACTIVE_PICKS,
} from "./constants";
import { scoreWeekFull } from "./engine/scoring";
import { getDraftOrder, buildSnakeOrder } from "./engine/draft";
import { useLeagueData } from "./hooks/useLeagueData";
import { useLivePolling } from "./hooks/useLivePolling";
import { sendPushToPlayer } from "./hooks/usePushNotifications";

// ── Eagerly-loaded shell + high-traffic tabs ───────────────────────────────────
// These are in the main bundle — they render on first load or first tap.
import { MemorialBackdrop, FerdaLogo } from "./components/FerdaLogo";
import { LoginScreen, WinnerModal, getLastWeekResults } from "./components/LoginScreen";
import { Nav, FlagBanner } from "./components/Nav";
import { ScoreTicker } from "./components/ScoreTicker";
import { WelcomeTab } from "./components/WelcomeTab";
import { DraftTab } from "./components/DraftTab";
import { LiveTab } from "./components/LiveTab";
import { C } from "./theme";

// ── Lazily-loaded tabs — split into three chunks ───────────────────────────────
// "race" chunk: screens visited every race weekend
const LineupsTab   = lazy(() => import("./components/LineupsTab").then(m  => ({ default: m.LineupsTab   })));
const MulligansTab = lazy(() => import("./components/MulligansTab").then(m => ({ default: m.MulligansTab })));
const ResultsTab   = lazy(() => import("./components/ResultsTab").then(m  => ({ default: m.ResultsTab   })));

// "story" chunk: data-heavy analysis tabs
const FeedTab      = lazy(() => import("./components/FeedTab").then(m     => ({ default: m.FeedTab      })));
const StatsTab     = lazy(() => import("./components/StatsTab").then(m    => ({ default: m.StatsTab     })));
const HistoryTab   = lazy(() => import("./components/HistoryTab").then(m  => ({ default: m.HistoryTab   })));

// "info" chunk: reference/settings screens
const PlayoffsTab   = lazy(() => import("./components/PlayoffsTab").then(m   => ({ default: m.PlayoffsTab   })));
const ProjectionsTab= lazy(() => import("./components/ProjectionsTab").then(m=> ({ default: m.ProjectionsTab})));
const ScheduleTab   = lazy(() => import("./components/ScheduleTab").then(m   => ({ default: m.ScheduleTab   })));
const RulesTab      = lazy(() => import("./components/RulesTab").then(m      => ({ default: m.RulesTab      })));
const SettingsTab   = lazy(() => import("./components/SettingsTab").then(m   => ({ default: m.SettingsTab   })));
const CommissionerTab=lazy(() => import("./components/CommissionerTab").then(m=>({ default: m.CommissionerTab})));

// ── Tab loading fallback ───────────────────────────────────────────────────────
function TabLoader() {
  return (
    <div style={{
      display:"flex", alignItems:"center", justifyContent:"center",
      minHeight:200, color:C.muted, fontSize:13, gap:10,
    }}>
      <div style={{
        width:20, height:20, borderRadius:"50%",
        border:`2px solid ${C.border}`,
        borderTopColor:C.accent,
        animation:"spin 0.7s linear infinite",
        flexShrink:0,
      }}/>
      Loading…
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}

export default function App() {
  const [user,setUser]=useState(null); const [tab,setTab]=useState("welcome");
  const [installPrompt,setInstallPrompt]=useState(null);
  const [showInstall,setShowInstall]=useState(false);
  const [showWinnerModal,setShowWinnerModal]=useState(false);

  const { data, setData, loading, dbStatus } = useLeagueData();
  const { liveScores, liveStatus, raceInfo } = useLivePolling(data);

  const handleLogin=(p)=>{
    setUser(p);
    const last=getLastWeekResults(data);
    if(last?.winner===p.id) setShowWinnerModal(true);
  };

  useEffect(()=>{
    const handler = e => { e.preventDefault(); setInstallPrompt(e); setShowInstall(true); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', ()=>setShowInstall(false));
    return ()=>window.removeEventListener('beforeinstallprompt', handler);
  },[]);

  const handleInstall = async () => {
    if(!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if(outcome === 'accepted') setShowInstall(false);
  };

  const currentWeek=useMemo(()=>data?(data.meta.lastScoredWeek||13)+1:14,[data]);

  const notifyNextPicker=async(week,dataAfterPick)=>{
    if(!isEmailConfigured())return;
    const draftKey="w"+week;
    const draftState=dataAfterPick.drafts?.[draftKey]||[];
    const snakeSequence=buildSnakeOrder(getDraftOrder(dataAfterPick,week));
    const nextPickIdx=draftState.length;
    if(nextPickIdx>=snakeSequence.length)return;
    const nextPicker=snakeSequence[nextPickIdx];
    const settings=dataAfterPick.playerSettings?.[nextPicker.pid]||{};
    const email=settings.email||DEFAULT_EMAILS[nextPicker.pid];
    if(!email||settings.notifyOnTurn===false)return;
    if(user&&nextPicker.pid===user.id&&nextPickIdx>0)return;
    const raceInfo2=SCHEDULE.find(s=>s.w===week);
    sendDraftEmail({toEmail:email,name:PNAME[nextPicker.pid],week,race:raceInfo2?.r||"the next race",track:raceInfo2?.t||"",pickNumber:nextPickIdx+1,round:nextPicker.round});
    const pushSub=dataAfterPick.playerSettings?.[nextPicker.pid]?.pushSubscription;
    if(pushSub?.endpoint){
      sendPushToPlayer(pushSub,{
        title:"FERDA Racing — Your Pick!",
        message:`Pick ${nextPickIdx+1} of ${snakeSequence.length} · W${week} ${raceInfo2?.r||"Draft"}`,
        url:"/",
      }).catch(()=>{});
    }
  };

  const handleDraftPick=async(week,pid,driver,pickNum)=>{
    const d=JSON.parse(JSON.stringify(data)); if(!d.drafts)d.drafts={}; const key="w"+week;
    if(!d.drafts[key])d.drafts[key]=[]; d.drafts[key].push({pid,driver,pickNum});
    if(!d.picks)d.picks={}; if(!d.picks[key])d.picks[key]={}; if(!d.picks[key][pid])d.picks[key][pid]=[];
    d.picks[key][pid].push({driver,mulligan:false});
    setData(d); await saveLeagueData(d);
    notifyNextPicker(week,d).catch(e=>console.error("Email notify failed:",e));
  };

  const handleUndoDraft=async(week)=>{
    const d=JSON.parse(JSON.stringify(data)); const key="w"+week;
    if(!d.drafts?.[key]?.length)return;
    const removed=d.drafts[key].pop();
    if(d.picks?.[key]?.[removed.pid]){const idx=d.picks[key][removed.pid].findIndex(pk=>pk.driver===removed.driver);if(idx>=0)d.picks[key][removed.pid].splice(idx,1);}
    setData(d); await saveLeagueData(d); return removed;
  };

  const recalcMeta=(d)=>{
    const fs={justin:0,bigmonroe:0,monroe:0,rich:0},fp2={justin:0,bigmonroe:0,monroe:0,rich:0}; let last=0;
    Object.entries(d.results||{}).forEach(([key,wr])=>{const w=parseInt(key.replace("w",""));if(w>last)last=w;if(!wr.scored)return;
      Object.entries(wr.scored).forEach(([pid,s])=>{fs[pid]=Math.round((fs[pid]+s.total)*100)/100;fp2[pid]=Math.round((fp2[pid]+(s.bonusPoints||0))*100)/100;if(s.weeklyWin)fp2[pid]=Math.round((fp2[pid]+25)*100)/100;});});
    const mc={justin:0,bigmonroe:0,monroe:0,rich:0};
    Object.entries(d.picks||{}).forEach(([,wp])=>{Object.entries(wp).forEach(([pid,pks])=>{(pks||[]).forEach(pk=>{if(pk.mulligan)mc[pid]++;});});});
    d.meta.standings=fs; d.meta.playoffPts=fp2; d.meta.lastScoredWeek=last; d.meta.mulligansUsed=mc;
  };

  const handlePostResults=async(week,scored,rr,wp)=>{
    const d=JSON.parse(JSON.stringify(data)); if(!d.results)d.results={}; if(!d.picks)d.picks={};
    d.results["w"+week]={scored,raw:rr}; d.picks["w"+week]=wp; recalcMeta(d);
    setData(d); await saveLeagueData(d);
  };

  const handleSavePicksOnly=async(week,wp)=>{
    const d=JSON.parse(JSON.stringify(data)); if(!d.picks)d.picks={}; if(!d.drafts)d.drafts={};
    d.picks["w"+week]=wp;
    const draftEntries=[];
    PLAYERS.forEach(pid=>{
      (wp[pid]||[]).forEach((pk)=>{
        if(pk.driver) draftEntries.push({pid,driver:pk.driver,pickNum:draftEntries.length});
      });
    });
    d.drafts["w"+week]=draftEntries;
    setData(d); await saveLeagueData(d);
  };

  const handleResetWeek=async(week)=>{
    const d=JSON.parse(JSON.stringify(data)); const key="w"+week;
    delete d.results[key]; delete d.picks[key]; if(d.drafts)delete d.drafts[key];
    recalcMeta(d); setData(d); await saveLeagueData(d);
  };

  const handleSaveSettings=async(pid,settings)=>{
    const d=JSON.parse(JSON.stringify(data)); if(!d.playerSettings)d.playerSettings={};
    d.playerSettings[pid]={...d.playerSettings[pid],...settings};
    setData(d); await saveLeagueData(d);
  };

  const handleApplyMulligan=async(week,pid,oldDriver,newDriver)=>{
    const d=JSON.parse(JSON.stringify(data)); const key="w"+week;
    if(!d.picks?.[key]?.[pid])return;
    d.picks[key][pid]=d.picks[key][pid].map(pk=>pk.driver===oldDriver?{driver:newDriver,mulligan:true}:pk);
    if(!d.mulligans)d.mulligans={justin:[],bigmonroe:[],monroe:[],rich:[]}; if(!d.mulligans[pid])d.mulligans[pid]=[];
    d.mulligans[pid].push({week,driver:oldDriver,replacement:newDriver});
    const mc={justin:0,bigmonroe:0,monroe:0,rich:0};
    Object.entries(d.picks||{}).forEach(([,wp])=>{Object.entries(wp).forEach(([p,pks])=>{(pks||[]).forEach(pk=>{if(pk.mulligan)mc[p]++;});});});
    d.meta.mulligansUsed=mc; setData(d); await saveLeagueData(d);
  };

  const handleStartDraftNotify=async(week)=>{await notifyNextPicker(week,data);};

  const handleToggleLive=async(week,active)=>{
    const d=JSON.parse(JSON.stringify(data));
    d.liveRace={active,week,startedAt:active?new Date().toISOString():null};
    setData(d); await saveLeagueData(d);
  };

  if(loading)return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:C.bg,gap:12}}>
      <FerdaLogo size="large"/>
      <div style={{color:C.dim,fontSize:13}}>Connecting to database…</div>
    </div>
  );
  if(!user)return <LoginScreen onLogin={handleLogin}/>;

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Barlow Condensed',sans-serif",color:C.text}}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.75}}
        @media(max-width:640px){body{padding-bottom:72px}}
      `}</style>
      <MemorialBackdrop/>
      {showWinnerModal&&<WinnerModal player={user} data={data} onDismiss={()=>setShowWinnerModal(false)}/>}
      <Nav player={user} tab={tab} setTab={setTab} onLogout={()=>setUser(null)}/>
      <ScoreTicker data={data} liveScores={liveScores} liveStatus={liveStatus} raceInfo={raceInfo}/>
      {dbStatus==="offline"&&(
        <div style={{background:C.red+"22",color:C.red,textAlign:"center",padding:"6px",fontSize:11,fontWeight:600,position:"relative",zIndex:1}}>
          OFFLINE MODE — Firebase not connected
        </div>
      )}
      {showInstall&&(
        <div style={{background:"linear-gradient(90deg,#f59e0b,#ef4444)",padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"relative",zIndex:2}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <img src="/icons/icon-72x72.png" style={{width:36,height:36,borderRadius:8}}/>
            <div>
              <div style={{color:"#000",fontWeight:700,fontSize:13}}>Install FERDA Racing</div>
              <div style={{color:"#000",fontSize:11,opacity:0.8}}>Add to home screen for the best experience</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={handleInstall} style={{padding:"6px 14px",borderRadius:8,border:"none",background:"#000",color:"#fff",fontFamily:"'Oswald',sans-serif",fontSize:12,fontWeight:700,cursor:"pointer",letterSpacing:1}}>INSTALL</button>
            <button onClick={()=>setShowInstall(false)} style={{padding:"6px 8px",borderRadius:8,border:"none",background:"rgba(0,0,0,0.2)",color:"#000",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
          </div>
        </div>
      )}
      <FlagBanner user={user} data={data} currentWeek={currentWeek} onGoTo={setTab}/>

      {/* Eager tabs — no Suspense needed */}
      {tab==="welcome"&&<WelcomeTab player={user} data={data} setTab={setTab} liveScores={liveScores} liveStatus={liveStatus}/>}
      {tab==="draft"&&<DraftTab player={user} data={data} onDraftPick={handleDraftPick} onUndoDraft={handleUndoDraft} currentWeek={currentWeek}/>}
      {tab==="live"&&<LiveTab data={data} liveScores={liveScores} liveStatus={liveStatus} raceInfo={raceInfo} currentWeek={currentWeek}/>}

      {/* Lazy tabs — wrapped in Suspense */}
      <Suspense fallback={<TabLoader/>}>
        {tab==="lineups"&&<LineupsTab data={data} currentWeek={currentWeek}/>}
        {tab==="mulligans"&&<MulligansTab player={user} data={data} currentWeek={currentWeek} onApplyMulligan={handleApplyMulligan}/>}
        {tab==="results"&&<ResultsTab data={data}/>}
        {tab==="feed"&&<FeedTab data={data}/>}
        {tab==="stats"&&<StatsTab data={data}/>}
        {tab==="history"&&<HistoryTab data={data}/>}
        {tab==="playoffs"&&<PlayoffsTab data={data}/>}
        {tab==="projections"&&<ProjectionsTab data={data} currentWeek={currentWeek}/>}
        {tab==="schedule"&&<ScheduleTab data={data}/>}
        {tab==="rules"&&<RulesTab/>}
        {tab==="settings"&&<SettingsTab player={user} data={data} onSaveSettings={handleSaveSettings}/>}
        {tab==="commissioner"&&user.id==="justin"&&
          <CommissionerTab data={data} onPostResults={handlePostResults} onSavePicks={handleSavePicksOnly} onResetWeek={handleResetWeek} onNotifyDraft={handleStartDraftNotify} onToggleLive={handleToggleLive} currentWeek={currentWeek}/>}
      </Suspense>
    </div>
  );
}
