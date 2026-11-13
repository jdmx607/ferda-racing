import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { saveLeagueData, saveDraftPick } from "./firebase";
import { sendDraftEmail, isEmailConfigured, DEFAULT_EMAILS } from "./email";
import { fetchNASCARResults } from "./nascar";
import {
  PLAYERS, PNAME, SCHEDULE,
  GARAGE_PICK_ENABLED, PICKS_PER_WEEK, ACTIVE_PICKS, PLAYOFF_START_WEEK,
  DRAFT_TIMER_MS, DRAFT_REMINDER_MS,
} from "./constants";
import { scoreWeekFull } from "./engine/scoring";
import { getDraftOrder, buildSnakeOrder, getBestAvailableDriver, getNextDraftOpenTime } from "./engine/draft";
import { recalcMeta } from "./engine/meta";
import { storeFor, ensureStore, getCurrentWeek, getNextEventWeek } from "./engine/events";
import { weekLabel, isExhibition } from "./exhibitions";
import { useLeagueData } from "./hooks/useLeagueData";
import { useLivePolling } from "./hooks/useLivePolling";
import { useLiveTiming } from "./hooks/useLiveTiming";
import { notifyDraftTurn, notifyRaceScored, notifyPlayer } from "./hooks/useNotifications";

// ── Eagerly-loaded shell + high-traffic tabs ───────────────────────────────────
// These are in the main bundle — they render on first load or first tap.
import { FerdaLogo } from "./components/FerdaLogo";
import { LoginScreen, WinnerModal, RichRoastModal, getLastWeekResults } from "./components/LoginScreen";
import { Nav, FlagBanner } from "./components/Nav";
import { ScoreTicker } from "./components/ScoreTicker";
import { RightRail } from "./components/RightRail";
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
const NewsTab      = lazy(() => import("./components/NewsTab").then(m     => ({ default: m.NewsTab      })));
const StatsTab     = lazy(() => import("./components/StatsTab").then(m    => ({ default: m.StatsTab     })));
const HistoryTab   = lazy(() => import("./components/HistoryTab").then(m  => ({ default: m.HistoryTab   })));

// "info" chunk: reference/settings screens
const PlayoffsTab   = lazy(() => import("./components/PlayoffsTab").then(m   => ({ default: m.PlayoffsTab   })));
const ScheduleTab   = lazy(() => import("./components/ScheduleTab").then(m   => ({ default: m.ScheduleTab   })));
const DriversTab    = lazy(() => import("./components/DriversTab").then(m    => ({ default: m.DriversTab    })));
const HallOfChampions = lazy(() => import("./components/HallOfChampions").then(m => ({ default: m.HallOfChampions })));
const RulesTab      = lazy(() => import("./components/RulesTab").then(m      => ({ default: m.RulesTab      })));
const SettingsTab   = lazy(() => import("./components/SettingsTab").then(m   => ({ default: m.SettingsTab   })));
const CommissionerTab=lazy(() => import("./components/CommissionerTab").then(m=>({ default: m.CommissionerTab})));
const ISCTab         =lazy(() => import("./components/ISCTab").then(m         =>({ default: m.ISCTab         })));

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
  const [showRichRoast,setShowRichRoast]=useState(false);

  const { data, setData, loading, dbStatus } = useLeagueData();
  const { liveScores, liveStatus, raceInfo } = useLivePolling(data);
  const timingData = useLiveTiming(data);

  const handleLogin=(p)=>{
    setUser(p);
    if(p.id==="rich") setShowRichRoast(true);
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

  // The event after the latest-scored one in schedule order — includes the
  // Clash (before W1) and All-Star (between W12 and W13) in 2027.
  const currentWeek=useMemo(()=>data?getCurrentWeek(data):1,[data]);

  const notifyNextPicker=async(week,dataAfterPick)=>{
    const draftKey="w"+week;
    const draftState=storeFor(dataAfterPick,week).drafts?.[draftKey]||[];
    const snakeSequence=buildSnakeOrder(getDraftOrder(dataAfterPick,week));
    const nextPickIdx=draftState.length;
    if(nextPickIdx>=snakeSequence.length)return;
    const nextPicker=snakeSequence[nextPickIdx];
    const settings=dataAfterPick.playerSettings?.[nextPicker.pid]||{};
    // Don't notify yourself for your own pick (unless it's the very first pick)
    if(user&&nextPicker.pid===user.id&&nextPickIdx>0)return;
    const raceInfo2=SCHEDULE.find(s=>s.w===week);

    // Email (original channel — kept as-is)
    if(isEmailConfigured()){
      const email=settings.email||DEFAULT_EMAILS[nextPicker.pid];
      if(email&&settings.notifyOnTurn!==false){
        sendDraftEmail({toEmail:email,name:PNAME[nextPicker.pid],week,race:raceInfo2?.r||"the next race",track:raceInfo2?.t||"",pickNumber:nextPickIdx+1,round:nextPicker.round});
      }
    }

    // Push + SMS via unified notifications helper
    notifyDraftTurn(nextPicker.pid,dataAfterPick.playerSettings,{
      week,
      pickNumber:nextPickIdx+1,
      totalPicks:snakeSequence.length,
      raceName:raceInfo2?.r||"Draft",
    }).catch(()=>{});
  };

  // Goes through a Firestore transaction (saveDraftPick) rather than writing
  // the caller's local `data` — a client with stale state (backgrounded phone,
  // spotty connection) can no longer overwrite picks made by others in the
  // meantime. Returns the outcome so DraftTab can tell the user what happened.
  const handleDraftPick=async(week,pid,driver,pickNum)=>{
    const result=await saveDraftPick(week,pid,driver,pickNum);
    if(!result.ok){
      return {applied:false,reason:"offline"};
    }
    if(!result.applied){
      // Stale click — someone else already filled this slot. Local state will
      // resync from the next onSnapshot update; nothing was lost.
      return {applied:false,reason:"stale",currentLength:result.currentLength};
    }
    setData(result.data);
    notifyNextPicker(week,result.data).catch(e=>console.error("Email notify failed:",e));
    return {applied:true};
  };

  // Exhibitions (Clash / All-Star) keep their drafts/picks/results in
  // d.exhibitions; ensureStore() hands back the right object for the event.
  const handleUndoDraft=async(week)=>{
    const d=JSON.parse(JSON.stringify(data)); const key="w"+week; const s=ensureStore(d,week);
    if(!s.drafts?.[key]?.length)return;
    const removed=s.drafts[key].pop();
    if(s.picks?.[key]?.[removed.pid]){const idx=s.picks[key][removed.pid].findIndex(pk=>pk.driver===removed.driver);if(idx>=0)s.picks[key][removed.pid].splice(idx,1);}
    setData(d); await saveLeagueData(d); return removed;
  };

  const handlePostResults=async(week,scored,rr,wp)=>{
    const d=JSON.parse(JSON.stringify(data)); const s=ensureStore(d,week);
    if(!s.results)s.results={}; if(!s.picks)s.picks={};
    s.results["w"+week]={scored,raw:rr}; s.picks["w"+week]=wp; recalcMeta(d);
    // The next event's draft no longer opens the instant results post — gate it
    // to the following Monday at 5pm so picks stay organized/easier to track.
    // (no next event after the final race of the season)
    const next=getNextEventWeek(week);
    if(next!==null){
      const ns=ensureStore(d,next);
      if(!ns.draftSchedule)ns.draftSchedule={};
      ns.draftSchedule["w"+next]={opensAt:getNextDraftOpenTime(new Date()).toISOString()};
    }
    setData(d); await saveLeagueData(d);
    // Notify all players with the final scores (push + SMS)
    notifyRaceScored(week,scored,d.playerSettings,PLAYERS).catch(()=>{});
  };

  const handleSavePicksOnly=async(week,wp)=>{
    const d=JSON.parse(JSON.stringify(data)); const s=ensureStore(d,week);
    if(!s.picks)s.picks={}; if(!s.drafts)s.drafts={};
    s.picks["w"+week]=wp;
    const draftEntries=[];
    PLAYERS.forEach(pid=>{
      (wp[pid]||[]).forEach((pk)=>{
        if(pk.driver) draftEntries.push({pid,driver:pk.driver,pickNum:draftEntries.length});
      });
    });
    s.drafts["w"+week]=draftEntries;
    setData(d); await saveLeagueData(d);
  };

  // ISC bracket saves (pick/result/lock changes) go through here so standings
  // always reflect the current champion bonus — ISCTab used to save straight
  // to Firestore, bypassing recalcMeta entirely.
  const handleIscSave=async(newData)=>{
    const d=JSON.parse(JSON.stringify(newData));
    recalcMeta(d);
    setData(d); await saveLeagueData(d);
  };

  // Manual trigger to re-derive meta.standings/playoffPts from current data —
  // useful to fix stale standings after a bug, with no data actually changing.
  const handleRecalcMeta=async()=>{
    const d=JSON.parse(JSON.stringify(data));
    recalcMeta(d);
    setData(d); await saveLeagueData(d);
  };

  // NASCAR playoff field tracker (commissioner-managed list of who's still in
  // the actual Chase + elimination status) — purely informational, no scoring
  // impact, so no recalcMeta needed.
  const handleSaveChaseField=async(chaseField)=>{
    const d=JSON.parse(JSON.stringify(data));
    d.chaseField=chaseField;
    setData(d); await saveLeagueData(d);
  };

  const handleResetWeek=async(week)=>{
    const d=JSON.parse(JSON.stringify(data)); const key="w"+week; const s=ensureStore(d,week);
    if(s.results)delete s.results[key]; if(s.picks)delete s.picks[key]; if(s.drafts)delete s.drafts[key];
    recalcMeta(d); setData(d); await saveLeagueData(d);
  };

  const handleSaveSettings=async(pid,settings)=>{
    const d=JSON.parse(JSON.stringify(data)); if(!d.playerSettings)d.playerSettings={};
    d.playerSettings[pid]={...d.playerSettings[pid],...settings};
    setData(d); await saveLeagueData(d);
  };

  const handleApplyMulligan=async(week,pid,oldDriver,newDriver)=>{
    if(isExhibition(week))return; // no mulligans in the Clash / All-Star
    const d=JSON.parse(JSON.stringify(data)); const key="w"+week; const s=ensureStore(d,week);
    if(!s.picks?.[key]?.[pid])return;
    s.picks[key][pid]=s.picks[key][pid].map(pk=>pk.driver===oldDriver?{driver:newDriver,mulligan:true}:pk);
    if(!d.mulligans)d.mulligans={justin:[],bigmonroe:[],monroe:[],rich:[]}; if(!d.mulligans[pid])d.mulligans[pid]=[];
    d.mulligans[pid].push({week,driver:oldDriver,replacement:newDriver});
    const mc={justin:0,bigmonroe:0,monroe:0,rich:0};
    Object.entries(d.picks||{}).forEach(([,wp])=>{Object.entries(wp).forEach(([p,pks])=>{(pks||[]).forEach(pk=>{if(pk.mulligan)mc[p]++;});});});
    d.meta.mulligansUsed=mc; setData(d); await saveLeagueData(d);
  };

  const handleStartDraftNotify=async(week)=>{
    const d=JSON.parse(JSON.stringify(data)); const s=ensureStore(d,week);
    if(!s.draftTimers)s.draftTimers={};
    s.draftTimers["w"+week]={startedAt:new Date().toISOString(),reminderSent:false};
    setData(d); await saveLeagueData(d);
    await notifyNextPicker(week,d);
  };

  const handleMarkReminderSent=async(week)=>{
    const d=JSON.parse(JSON.stringify(data)); const key="w"+week; const s=ensureStore(d,week);
    if(!s.draftTimers)s.draftTimers={}; if(!s.draftTimers[key])s.draftTimers[key]={};
    s.draftTimers[key].reminderSent=true;
    setData(d); await saveLeagueData(d);
  };

  const handleToggleLive=async(week,active)=>{
    const d=JSON.parse(JSON.stringify(data));
    d.liveRace={active,week,startedAt:active?new Date().toISOString():null};
    setData(d); await saveLeagueData(d);
  };

  // ── Draft timer watchdog ─────────────────────────────────────────────────────
  // Runs app-wide (any tab, any logged-in player) so autopick and the 6h reminder
  // fire as long as SOMEONE has the app open — not just when the Draft tab is up.
  const [timerTick,setTimerTick]=useState(()=>Date.now());
  useEffect(()=>{
    const t=setInterval(()=>setTimerTick(Date.now()),60000);
    return ()=>clearInterval(t);
  },[]);
  const draftTimerGuard=useRef({slot:"",autopicked:false,reminded:false});
  const draftOpenGuard=useRef({week:null,opened:false});
  useEffect(()=>{
    if(!data||!user)return;
    const week=currentWeek,key="w"+week;
    if(!SCHEDULE.some(s=>s.w===week))return; // season over — no draft to run
    const st=storeFor(data,week); // exhibitions keep their draft state separately
    const draftState=st.drafts?.[key]||[];
    const snake=buildSnakeOrder(getDraftOrder(data,week));
    if(draftState.length>=snake.length)return; // draft complete

    const timerMeta=st.draftTimers?.[key];

    // Auto-open the draft once its scheduled Monday-5pm time passes (only if
    // nobody has picked yet and the timer hasn't already been started). Weeks
    // with no draftSchedule entry (pre-dating this feature) just skip the
    // gate entirely and behave as before.
    if(!timerMeta?.startedAt&&draftState.length===0){
      if(draftOpenGuard.current.week!==week)draftOpenGuard.current={week,opened:false};
      const opensAt=st.draftSchedule?.[key]?.opensAt;
      if(opensAt&&Date.now()>=new Date(opensAt).getTime()&&!draftOpenGuard.current.opened){
        draftOpenGuard.current.opened=true;
        handleStartDraftNotify(week);
      }
      return;
    }

    if(!timerMeta?.startedAt)return;
    // Reset one-shot guards whenever the pick slot advances
    const slot=key+":"+draftState.length;
    if(draftTimerGuard.current.slot!==slot)draftTimerGuard.current={slot,autopicked:false,reminded:false};
    const elapsed=Date.now()-new Date(timerMeta.startedAt).getTime();
    const turn=snake[draftState.length];

    if(elapsed>=DRAFT_TIMER_MS&&!draftTimerGuard.current.autopicked){
      draftTimerGuard.current.autopicked=true;
      const taken=new Set(draftState.map(x=>x.driver));
      const best=getBestAvailableDriver(data,taken,week);
      if(best){
        handleDraftPick(week,turn.pid,best,draftState.length);
        notifyPlayer(turn.pid,data.playerSettings,{
          title:"⏰ FERDA — Auto-Pick Made",
          message:`Your 12-hour draft clock expired. ${best} was auto-drafted for you for ${weekLabel(week)}.`,
        }).catch(()=>{});
      }
    } else if(elapsed>=DRAFT_REMINDER_MS&&elapsed<DRAFT_TIMER_MS&&!timerMeta.reminderSent&&!draftTimerGuard.current.reminded){
      draftTimerGuard.current.reminded=true;
      handleMarkReminderSent(week);
      const ri=SCHEDULE.find(s=>s.w===week);
      notifyDraftTurn(turn.pid,data.playerSettings,{
        week,pickNumber:draftState.length+1,totalPicks:snake.length,raceName:ri?.r||"Draft",
      }).catch(()=>{});
    }
  },[data,timerTick,user,currentWeek]); // eslint-disable-line react-hooks/exhaustive-deps

  if(loading)return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:C.bg,gap:12}}>
      <FerdaLogo size="large"/>
      <div style={{color:C.dim,fontSize:13}}>Connecting to database…</div>
    </div>
  );
  if(!user)return <LoginScreen onLogin={handleLogin} data={data} timing={timingData}/>;

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"var(--font-sans)",color:C.text,paddingTop:"var(--safe-top)"}}>
      {showRichRoast&&<RichRoastModal onDismiss={()=>setShowRichRoast(false)}/>}
      {!showRichRoast&&showWinnerModal&&<WinnerModal player={user} data={data} onDismiss={()=>setShowWinnerModal(false)}/>}
      <Nav player={user} tab={tab} setTab={setTab} onLogout={()=>setUser(null)} data={data}/>
      <RightRail data={data}/>
      <ScoreTicker data={data} liveScores={liveScores} liveStatus={liveStatus} raceInfo={raceInfo}/>
      {dbStatus==="offline"&&(
        <div style={{background:C.red+"22",color:C.red,textAlign:"center",padding:"6px",fontSize:11,fontWeight:600,position:"relative",zIndex:1}}>
          OFFLINE MODE — Firebase not connected
        </div>
      )}
      {showInstall&&(
        <div style={{background:C.card,borderBottom:"1px solid "+C.border,padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"relative",zIndex:2}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <img src="/icons/icon-72x72.png" style={{width:36,height:36,borderRadius:8}}/>
            <div>
              <div style={{color:C.text,fontWeight:700,fontSize:13}}>Install FERDA Racing</div>
              <div style={{color:C.dim,fontSize:11}}>Add to home screen for the best experience</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={handleInstall} style={{padding:"6px 14px",borderRadius:8,border:"none",background:C.text,color:C.bg,fontFamily:"var(--font-sans)",fontSize:12,fontWeight:700,cursor:"pointer",letterSpacing:0.5}}>Install</button>
            <button onClick={()=>setShowInstall(false)} style={{padding:"6px 8px",borderRadius:8,border:"none",background:"transparent",color:C.dim,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
          </div>
        </div>
      )}
      <FlagBanner user={user} data={data} currentWeek={currentWeek} onGoTo={setTab}/>

      {/* Eager tabs — no Suspense needed */}
      {tab==="welcome"&&<WelcomeTab player={user} data={data} setTab={setTab} liveScores={liveScores} liveStatus={liveStatus} timingData={timingData}/>}
      {tab==="draft"&&<DraftTab player={user} data={data} onDraftPick={handleDraftPick} onUndoDraft={handleUndoDraft} currentWeek={currentWeek}/>}
      {tab==="live"&&<LiveTab data={data} liveScores={liveScores} liveStatus={liveStatus} raceInfo={raceInfo} currentWeek={currentWeek} timingData={timingData}/>}

      {/* Lazy tabs — wrapped in Suspense */}
      <Suspense fallback={<TabLoader/>}>
        {tab==="lineups"&&<LineupsTab data={data} currentWeek={currentWeek}/>}
        {tab==="mulligans"&&<MulligansTab player={user} data={data} currentWeek={currentWeek} onApplyMulligan={handleApplyMulligan}/>}
        {tab==="results"&&<ResultsTab data={data}/>}
        {tab==="feed"&&<FeedTab data={data}/>}
        {tab==="news"&&<NewsTab/>}
        {tab==="stats"&&<StatsTab data={data}/>}
        {tab==="history"&&<HistoryTab data={data}/>}
        {tab==="playoffs"&&<PlayoffsTab data={data} user={user} currentWeek={currentWeek} onSaveChaseField={handleSaveChaseField}/>}
        {tab==="schedule"&&<ScheduleTab data={data}/>}
        {tab==="drivers"&&<DriversTab/>}
        {tab==="hall"&&<HallOfChampions setTab={setTab}/>}
        {tab==="rules"&&<RulesTab/>}
        {tab==="settings"&&<SettingsTab player={user} data={data} onSaveSettings={handleSaveSettings}/>}
        {tab==="isc"&&<ISCTab data={data} user={user} onSave={handleIscSave}/>}
        {tab==="commissioner"&&user.id==="justin"&&
          <CommissionerTab data={data} onPostResults={handlePostResults} onSavePicks={handleSavePicksOnly} onResetWeek={handleResetWeek} onNotifyDraft={handleStartDraftNotify} onToggleLive={handleToggleLive} onRecalcMeta={handleRecalcMeta} currentWeek={currentWeek}/>}
      </Suspense>
    </div>
  );
}
