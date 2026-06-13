import { useState } from "react";
import { C, PClr, PC, TTC, TTL, r } from "../theme";
import { PLAYERS, PNAME, SCHEDULE, DRIVERS, ACTIVE_PICKS, TRACK_MULTS, isMemorial } from "../constants";
import { scoreWeekFull } from "../engine/scoring";
import { getDraftOrder, buildSnakeOrder } from "../engine/draft";
import { fetchNASCARResults, fetchPostRaceFromLive } from "../nascar";

// ─── helpers ─────────────────────────────────────────────────────────────────
const iS = {
  padding:"6px 8px", borderRadius:6,
  border:`1px solid ${C.border}`, background:C.input,
  color:C.text, fontSize:13, fontFamily:"inherit",
  outline:"none", width:"100%", boxSizing:"border-box",
};

// ─── Quick Score Card (shown after a successful Fetch) ────────────────────────
function QuickScoreCard({ fetchResult, week, race, playerPicks, onConfirm, onAdvanced, saving }) {
  const [fastestLap, setFastestLap] = useState(fetchResult.fastestLapDriver || "");
  const { raceName, trackName, winner, poleSitter, mostLapsLedDriver,
          stageWinners, threeStages, drivers, fastestLapAutoDetected } = fetchResult;

  const top5 = drivers.slice(0, 5);
  const trackType = race?.ty;

  const handleScore = () => {
    // Apply fastest lap selection to the drivers array
    const updatedDrivers = drivers.map(d => ({
      ...d,
      fastestLap: fastestLap ? d.name === fastestLap : d.fastestLap,
    }));
    onConfirm(updatedDrivers, threeStages, playerPicks);
  };

  return (
    <div style={{ animation:"fadeIn 0.3s ease" }}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>

      {/* ── Race header ───────────────────────────────────────────────────── */}
      <div style={{
        background:`linear-gradient(135deg,#001a10,${C.bg})`,
        border:`1px solid ${TTC[trackType] || C.accent}55`,
        borderRadius:`${r.lg}px ${r.lg}px 0 0`,
        padding:"16px 20px",
        boxShadow:`0 0 20px ${TTC[trackType] || C.accent}22`,
      }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
          <div style={{ color: TTC[trackType] || C.accent, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:2 }}>
            ✅ {drivers.length} drivers loaded · W{week} · {TTL[trackType] || ""} ×{TRACK_MULTS[trackType] || 1}
          </div>
          {(() => {
            const src = fetchResult.source;
            const [bg,clr,lbl] =
              src === "NASCAR Live Feed" ? ["#f59e0b22","#f59e0b","🏁 LIVE FEED"] :
              src === "Manual Entry"     ? ["#3b82f622","#3b82f6","📋 MANUAL"]    :
                                          ["#10b98122","#10b981","📦 CACHER"];
            return (
              <div style={{
                fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:20,
                background:bg, color:clr, border:`1px solid ${clr}44`,
                letterSpacing:1, textTransform:"uppercase",
              }}>{lbl}</div>
            );
          })()}
        </div>
        <div style={{ color:C.text, fontFamily:"'Oswald',sans-serif", fontSize:22, fontWeight:900, letterSpacing:1 }}>
          {raceName}
        </div>
        {trackName && <div style={{ color:C.muted, fontSize:12, marginTop:2 }}>@ {trackName}</div>}
      </div>

      {/* ── Race summary stats ────────────────────────────────────────────── */}
      <div style={{
        display:"grid", gridTemplateColumns:"repeat(2,1fr)",
        gap:1, background:C.border,
        border:`1px solid ${C.border}`, borderTop:"none",
      }}>
        {[
          { label:"🏆 Race Winner",    value: winner           || "—" },
          { label:"🎯 Pole Sitter",    value: poleSitter       || "—" },
          { label:"📈 Most Laps Led",  value: mostLapsLedDriver || "—" },
          ...stageWinners.map(sw => ({ label:`S${sw.stage} Winner`, value: sw.driver || "—" })),
        ].map(({ label, value }, i) => (
          <div key={i} style={{
            background:C.card, padding:"10px 14px",
            borderRight: i % 2 === 0 ? `1px solid ${C.border}` : "none",
          }}>
            <div style={{ color:C.muted, fontSize:9, textTransform:"uppercase", letterSpacing:1.5, marginBottom:3 }}>{label}</div>
            <div style={{ color:C.text, fontWeight:700, fontSize:13 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Top 5 finishers ───────────────────────────────────────────────── */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderTop:"none", padding:"10px 14px" }}>
        <div style={{ color:C.muted, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>Top 5</div>
        <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
          {top5.map((d, i) => (
            <div key={d.name} style={{
              display:"flex", alignItems:"center", gap:10,
              padding:"5px 8px", borderRadius:r.sm,
              background: i === 0 ? `${C.accent}15` : "transparent",
            }}>
              <span style={{
                fontFamily:"'Oswald',sans-serif", fontSize:14, fontWeight:900,
                color: i === 0 ? C.accent : C.muted, width:20, flexShrink:0,
              }}>P{d.finish}</span>
              <span style={{ color: i === 0 ? C.text : C.textDim, fontSize:13, fontWeight: i===0?700:400, flex:1 }}>{d.name}</span>
              {d.lapsLed > 0 && <span style={{ color:C.muted, fontSize:10 }}>{d.lapsLed} led</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Picks summary ─────────────────────────────────────────────────── */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderTop:"none", padding:"10px 14px" }}>
        <div style={{ color:C.muted, fontSize:9, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>
          This Week's Picks (loaded from Firestore)
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
          {PLAYERS.map(p => {
            const picks = playerPicks[p.id] || [];
            return (
              <div key={p.id} style={{
                padding:"8px 10px", borderRadius:r.sm,
                background:PClr[p.id].bg,
                border:`1px solid ${PClr[p.id].fg}22`,
              }}>
                <div style={{ color:PClr[p.id].fg, fontFamily:"'Oswald',sans-serif", fontSize:12, fontWeight:700, marginBottom:4 }}>
                  {PNAME[p.id]}
                  <span style={{ color:PClr[p.id].fg+"66", fontSize:9, fontWeight:400, marginLeft:6 }}>
                    {picks.length}/{ACTIVE_PICKS}
                  </span>
                </div>
                {picks.length === 0
                  ? <div style={{ color:C.red, fontSize:10 }}>⚠️ No picks saved</div>
                  : picks.map((pk, i) => (
                    <div key={i} style={{ color:PClr[p.id].fg+"cc", fontSize:11, lineHeight:1.6 }}>
                      {pk.driver}{pk.mulligan ? " 🔄" : ""}
                    </div>
                  ))
                }
              </div>
            );
          })}
        </div>
        {PLAYERS.some(p => !(playerPicks[p.id]?.length)) && (
          <div style={{ color:C.yellow, fontSize:11, marginTop:8 }}>
            ⚠️ Some players have no picks saved. Use Advanced Edit to set them before scoring.
          </div>
        )}
      </div>

      {/* ── Fastest Lap ───────────────────────────────────────────────────── */}
      <div style={{
        background:C.card, border:`1px solid ${C.border}`, borderTop:"none",
        padding:"12px 14px",
        borderRadius: `0 0 ${r.lg}px ${r.lg}px`,
      }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
          <div style={{ color:C.muted, fontSize:9, textTransform:"uppercase", letterSpacing:2 }}>
            ⚡ Fastest Lap Driver
          </div>
          {fastestLapAutoDetected
            ? <span style={{ color:C.green, fontSize:10, fontWeight:700 }}>✓ Auto-detected from timing data</span>
            : <span style={{ color:C.yellow, fontSize:10 }}>Optional · +1 pt bonus · skip if unknown</span>
          }
        </div>
        <select
          value={fastestLap}
          onChange={e => setFastestLap(e.target.value)}
          style={{ ...iS, borderColor: fastestLap ? C.accent+"88" : C.border }}
        >
          <option value="">— Skip fastest lap (score without it) —</option>
          {drivers.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
        </select>
      </div>

      {/* ── Action buttons ────────────────────────────────────────────────── */}
      <div style={{ display:"flex", gap:8, marginTop:12 }}>
        <button
          onClick={handleScore}
          disabled={saving}
          style={{
            flex:1, padding:"16px 0", borderRadius:r.md,
            border:"none", background:C.accent,
            color:"#000", fontFamily:"'Oswald',sans-serif",
            fontSize:18, fontWeight:900, letterSpacing:2,
            textTransform:"uppercase", cursor:"pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Scoring…" : `🏁 Score & Post W${week}`}
        </button>
      </div>
      <div style={{ textAlign:"center", marginTop:10 }}>
        <button
          onClick={onAdvanced}
          style={{
            background:"none", border:"none", color:C.muted,
            fontSize:12, cursor:"pointer", textDecoration:"underline",
            fontFamily:"inherit",
          }}
        >
          Advanced Edit (manual entry / override driver data)
        </button>
      </div>
    </div>
  );
}

// ─── Main Commissioner Tab ────────────────────────────────────────────────────
export function CommissionerTab({ data, onPostResults, onSavePicks, onResetWeek, onNotifyDraft, onToggleLive, currentWeek }) {
  const [week,       setWeek]       = useState(currentWeek);
  const [editing,    setEditing]    = useState(false);
  const [quickScore, setQuickScore] = useState(null);   // fetched race data for Quick Score mode
  const [drivers,    setDrivers]    = useState([]);
  const [playerPicks,setPlayerPicks]= useState({ justin:[], bigmonroe:[], monroe:[], rich:[] });
  const [threeStages,setThreeStages]= useState(false);
  const [saving,     setSaving]     = useState(false);
  const [msg,        setMsg]        = useState("");
  const [fetching,   setFetching]   = useState(false);
  const [fetchError, setFetchError] = useState("");

  const race = SCHEDULE.find(s => s.w === week);
  const done = !!(data.results?.["w" + week]);
  const hasPicks = !!(data.picks?.["w"+week] && Object.values(data.picks["w"+week]).some(p => p?.length > 0));
  const hasDraft  = !!(data.drafts?.["w"+week]?.length);

  // ── Load picks from Firestore into local state ───────────────────────────
  function loadPicksFromStore() {
    const wp = data.picks?.["w" + week] || {};
    const pp = {};
    PLAYERS.forEach(p => {
      pp[p.id] = (wp[p.id] || []).map(pk => ({ driver: pk.driver, mulligan: pk.mulligan || false }));
    });
    return pp;
  }

  // ── Fetch helpers ───────────────────────────────────────────────────────
  const handleFetch = async () => {
    setFetching(true); setFetchError(""); setMsg(""); setQuickScore(null);
    // fetchNASCARResults tries live feed first, then falls back to weekend-feed cacher
    const result = await fetchNASCARResults(week);
    setFetching(false);
    if (!result.ok) { setFetchError("⚠️ " + result.error); return; }
    setPlayerPicks(loadPicksFromStore());
    setQuickScore(result);
  };

  // Direct live-feed fetch (bypasses the weekend-feed fallback chain)
  const handleFetchLive = async () => {
    setFetching(true); setFetchError(""); setMsg(""); setQuickScore(null);
    const result = await fetchPostRaceFromLive();
    setFetching(false);
    if (!result.ok) { setFetchError("⚠️ " + result.error); return; }
    setPlayerPicks(loadPicksFromStore());
    setQuickScore(result);
  };

  // ── Quick Score confirm ─────────────────────────────────────────────────
  const handleQuickScoreConfirm = async (updatedDrivers, ts, pp) => {
    setSaving(true); setMsg("");
    const rr = {
      threeStages: ts,
      drivers: updatedDrivers.map(d => ({
        name:d.name, finish:parseInt(d.finish)||40, qualPos:parseInt(d.qualPos)||40,
        stage1:parseInt(d.stage1)||0, stage2:parseInt(d.stage2)||0, stage3:parseInt(d.stage3)||0,
        lapsLed:parseInt(d.lapsLed)||0, pole:!!d.pole,
        stageWin1:!!d.stageWin1, stageWin2:!!d.stageWin2, stageWin3:!!d.stageWin3,
        fastestLap:!!d.fastestLap, mostLapsLed:!!d.mostLapsLed, dnf:!!d.dnf, dq:!!d.dq,
      })),
    };
    const wp = {};
    PLAYERS.forEach(p => { wp[p.id] = (pp[p.id] || []).filter(pk => pk.driver); });
    const mo = {};
    PLAYERS.forEach(p => { mo[p.id] = (pp[p.id] || []).filter(pk => pk.mulligan).map(pk => ({ week, driver:pk.driver })); });
    const scored = scoreWeekFull(wp, rr, week, mo);
    await onPostResults(week, scored, rr, wp);
    setMsg(`✅ Week ${week} scored!`);
    setSaving(false);
    setQuickScore(null);
  };

  // ── Advanced editor helpers ─────────────────────────────────────────────
  const switchToAdvanced = () => {
    if (quickScore) {
      setDrivers(quickScore.drivers.map(d => ({
        ...d,
        finish:   String(d.finish),
        qualPos:  String(d.qualPos),
        stage1:   String(d.stage1 || ""),
        stage2:   String(d.stage2 || ""),
        stage3:   String(d.stage3 || ""),
        lapsLed:  String(d.lapsLed || 0),
      })));
      setThreeStages(!!quickScore.threeStages);
    }
    setQuickScore(null);
    setEditing(true);
  };

  const startEdit = () => {
    const wr = data.results?.["w" + week];
    if (wr?.raw?.drivers) {
      setThreeStages(!!wr.raw.threeStages);
      setDrivers(wr.raw.drivers.map(d => ({
        ...d, finish:String(d.finish), qualPos:String(d.qualPos),
        stage1:String(d.stage1||""), stage2:String(d.stage2||""),
        stage3:String(d.stage3||""), lapsLed:String(d.lapsLed||0),
      })));
    } else { setDrivers([]); setThreeStages(false); }
    setPlayerPicks(loadPicksFromStore());
    setEditing(true); setMsg("");
  };

  const startNew = () => {
    setDrivers([]); setThreeStages(false);
    setPlayerPicks({ justin:[], bigmonroe:[], monroe:[], rich:[] });
    setEditing(true); setMsg("");
  };

  const addD   = () => setDrivers([...drivers, { name:"",finish:"",qualPos:"",stage1:"",stage2:"",stage3:"",lapsLed:"0",pole:false,stageWin1:false,stageWin2:false,stageWin3:false,fastestLap:false,mostLapsLed:false,dnf:false,dq:false }]);
  const ud     = (i,f,v) => { const n=[...drivers]; n[i]={...n[i],[f]:v}; setDrivers(n); };
  const rm     = (i) => setDrivers(drivers.filter((_,j) => j!==i));
  const addPick    = (pid) => { const cur=playerPicks[pid]||[]; if(cur.length>=ACTIVE_PICKS)return; setPlayerPicks({...playerPicks,[pid]:[...cur,{driver:"",mulligan:false}]}); };
  const updatePick = (pid,i,field,val) => { const np={...playerPicks}; np[pid]=[...np[pid]]; np[pid][i]={...np[pid][i],[field]:val}; setPlayerPicks(np); };
  const removePick = (pid,i) => { const np={...playerPicks}; np[pid]=np[pid].filter((_,j)=>j!==i); setPlayerPicks(np); };

  const buildRR = () => ({
    threeStages,
    drivers: drivers.map(d => ({
      name:d.name, finish:parseInt(d.finish)||40, qualPos:parseInt(d.qualPos)||40,
      stage1:parseInt(d.stage1)||0, stage2:parseInt(d.stage2)||0, stage3:parseInt(d.stage3)||0,
      lapsLed:parseInt(d.lapsLed)||0, pole:!!d.pole,
      stageWin1:!!d.stageWin1, stageWin2:!!d.stageWin2, stageWin3:!!d.stageWin3,
      fastestLap:!!d.fastestLap, mostLapsLed:!!d.mostLapsLed, dnf:!!d.dnf, dq:!!d.dq,
    })),
  });
  const buildWP = () => {
    const wp = {};
    PLAYERS.forEach(p => { wp[p.id]=(playerPicks[p.id]||[]).filter(pk=>pk.driver).map(pk=>({driver:pk.driver,mulligan:pk.mulligan})); });
    return wp;
  };

  const handleScore = async () => {
    setSaving(true); setMsg("");
    const rr = buildRR(); const wp = buildWP();
    const mo = {}; PLAYERS.forEach(p => { mo[p.id]=(playerPicks[p.id]||[]).filter(pk=>pk.mulligan).map(pk=>({week,driver:pk.driver})); });
    const scored = scoreWeekFull(wp, rr, week, mo);
    await onPostResults(week, scored, rr, wp);
    setMsg(`Week ${week} ${done?"updated":"scored"}!`);
    setSaving(false); setEditing(false);
  };
  const handleSavePicksOnly = async () => {
    setSaving(true); setMsg("");
    await onSavePicks(week, buildWP());
    setMsg(`Week ${week} picks saved (not scored).`);
    setSaving(false); setEditing(false);
  };
  const handleReset = async () => {
    if (!window.confirm(`Reset Week ${week}? Deletes all scores, picks, and draft data. Cannot be undone.`)) return;
    await onResetWeek(week);
    setMsg(`Week ${week} reset.`); setEditing(false); setQuickScore(null);
  };

  const resetWeekPicker = (newWeek) => {
    setWeek(Number(newWeek));
    setEditing(false); setQuickScore(null); setMsg(""); setFetchError("");
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding:20, maxWidth:1000, margin:"0 auto", position:"relative", zIndex:1 }}>
      <h2 style={{ color:C.text, fontFamily:"'Oswald',sans-serif", fontSize:26, marginBottom:4 }}>Commissioner Panel</h2>
      <div style={{ color:C.muted, fontSize:13, marginBottom:16 }}>Post race results · manage picks · control live scoring</div>

      {/* ── Week selector ──────────────────────────────────────────────────── */}
      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:16, flexWrap:"wrap" }}>
        <span style={{ color:C.muted, fontSize:13 }}>Week:</span>
        <select value={week} onChange={e => resetWeekPicker(e.target.value)} style={{ ...iS, width:80 }}>
          {SCHEDULE.map(s => <option key={s.w} value={s.w}>{s.w}</option>)}
        </select>
        {race && <span style={{ color:C.muted, fontSize:13 }}>{race.r} · {TTL[race.ty]} ×{TRACK_MULTS[race.ty]}</span>}
        {done && !editing && !quickScore && <span style={{ color:C.green, fontSize:13, fontWeight:700 }}>✓ Scored</span>}
      </div>

      {/* ── Live race toggle ───────────────────────────────────────────────── */}
      <div style={{
        background:C.card, borderRadius:10, padding:"12px 16px", marginBottom:16,
        border:`1px solid ${data.liveRace?.active ? "#ef4444" : C.border}`,
      }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
          <div>
            <div style={{ color:data.liveRace?.active?"#ef4444":C.muted, fontWeight:700, fontSize:13, letterSpacing:1 }}>
              {data.liveRace?.active ? `🔴 LIVE SCORING ACTIVE — Week ${data.liveRace.week}` : "⚫ Live Scoring Off"}
            </div>
            <div style={{ color:C.muted, fontSize:11, marginTop:2 }}>
              When active, everyone sees live standings updating every 30s via NASCAR.com
            </div>
          </div>
          {data.liveRace?.active
            ? <button onClick={() => onToggleLive(data.liveRace.week, false)} style={{ padding:"8px 16px", borderRadius:8, border:"1px solid #ef4444", background:"#ef444422", color:"#ef4444", fontFamily:"'Oswald',sans-serif", fontSize:12, fontWeight:700, cursor:"pointer", letterSpacing:1 }}>END RACE</button>
            : <button onClick={() => onToggleLive(week, true)}              style={{ padding:"8px 16px", borderRadius:8, border:"1px solid #10b981", background:"#10b98122", color:"#10b981", fontFamily:"'Oswald',sans-serif", fontSize:12, fontWeight:700, cursor:"pointer", letterSpacing:1 }}>🟢 START LIVE — W{week}</button>
          }
        </div>
      </div>

      {/* ── Action buttons (idle state) ────────────────────────────────────── */}
      {!editing && !quickScore && (
        <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
          {/* Primary: tries live feed first, then cacher */}
          <button
            onClick={handleFetch}
            disabled={fetching}
            style={{
              padding:"12px 20px", borderRadius:8,
              border:"1px solid #10b981", background:"#10b98122", color:"#10b981",
              fontSize:14, fontFamily:"'Oswald',sans-serif", fontWeight:700,
              letterSpacing:1, cursor:"pointer",
              display:"flex", alignItems:"center", gap:8,
              opacity: fetching ? 0.6 : 1,
            }}
          >
            {fetching ? "⏳ Fetching…" : "🔌 Fetch & Score W" + week}
          </button>
          {/* Direct live feed — useful right when the race ends */}
          <button
            onClick={handleFetchLive}
            disabled={fetching}
            title="Pulls from the live feed (updated every second). Use this immediately after the checkered flag."
            style={{
              padding:"12px 16px", borderRadius:8,
              border:"1px solid #f59e0b", background:"#f59e0b22", color:"#f59e0b",
              fontSize:12, fontFamily:"inherit", fontWeight:700,
              cursor:"pointer", opacity: fetching ? 0.6 : 1,
              display:"flex", alignItems:"center", gap:6,
            }}
          >
            🏁 Live Feed Only
          </button>
          {done && (
            <button onClick={startEdit} style={{ padding:"10px 16px", borderRadius:8, border:`1px solid ${C.accent}`, background:C.accent+"22", color:C.accent, fontSize:13, fontFamily:"inherit", fontWeight:600, cursor:"pointer" }}>
              Re-Score / Edit W{week}
            </button>
          )}
          {!done && (
            <button onClick={startNew} style={{ padding:"10px 16px", borderRadius:8, border:`1px solid ${C.blue}`, background:C.blue+"22", color:C.blue, fontSize:13, fontFamily:"inherit", fontWeight:600, cursor:"pointer" }}>
              Manual Entry
            </button>
          )}
          {(done || hasPicks || hasDraft) && (
            <button onClick={handleReset} style={{ padding:"10px 16px", borderRadius:8, border:`1px solid ${C.red}`, background:C.red+"22", color:C.red, fontSize:13, fontFamily:"inherit", fontWeight:600, cursor:"pointer" }}>
              Reset W{week}
            </button>
          )}
          {!done && !hasDraft && (
            <button onClick={async () => { await onNotifyDraft(week); setMsg("Email sent to first picker (if configured)."); setTimeout(()=>setMsg(""),3000); }}
              style={{ padding:"10px 16px", borderRadius:8, border:`1px solid ${C.purple}`, background:C.purple+"22", color:C.purple, fontSize:13, fontFamily:"inherit", fontWeight:600, cursor:"pointer" }}>
              📧 Notify First Picker
            </button>
          )}
          {!done && hasDraft && (() => {
            const totalPicks = ACTIVE_PICKS * PLAYERS.length;
            const draftEntries = data.drafts?.["w"+week] || [];
            if (draftEntries.length >= totalPicks) return null;
            const snakeOrder = buildSnakeOrder(getDraftOrder(data, week));
            const currentPid = snakeOrder[draftEntries.length]?.pid;
            const currentName = currentPid ? PNAME[currentPid] : "Current Picker";
            return (
              <button onClick={async () => { await onNotifyDraft(week); setMsg(`Reminder sent to ${currentName}!`); setTimeout(()=>setMsg(""),3000); }}
                style={{ padding:"10px 16px", borderRadius:8, border:`1px solid ${C.purple}`, background:C.purple+"22", color:C.purple, fontSize:13, fontFamily:"inherit", fontWeight:600, cursor:"pointer" }}>
                🔔 Remind {currentName}
              </button>
            );
          })()}
        </div>
      )}

      {/* ── Fetch error ────────────────────────────────────────────────────── */}
      {fetchError && (
        <div style={{ background:C.card, borderRadius:8, padding:"10px 14px", marginBottom:12, border:`1px solid ${C.red}44`, color:C.red, fontSize:12 }}>
          {fetchError}
          <div style={{ color:C.muted, fontSize:11, marginTop:4 }}>
            The race may not be finished yet, or the NASCAR feed hasn't updated. Try again in a few minutes.
          </div>
        </div>
      )}

      {/* ── Quick Score mode ───────────────────────────────────────────────── */}
      {quickScore && !editing && (
        <>
          <QuickScoreCard
            fetchResult={quickScore}
            week={week}
            race={race}
            playerPicks={playerPicks}
            onConfirm={handleQuickScoreConfirm}
            onAdvanced={switchToAdvanced}
            saving={saving}
          />
          <button
            onClick={() => { setQuickScore(null); setMsg(""); }}
            style={{ marginTop:10, background:"none", border:"none", color:C.muted, fontSize:12, cursor:"pointer", textDecoration:"underline", fontFamily:"inherit" }}
          >
            ← Back
          </button>
        </>
      )}

      {/* ── Advanced editor ────────────────────────────────────────────────── */}
      {editing && (
        <>
          {/* Player picks */}
          <div style={{ marginBottom:16 }}>
            <div style={{ color:C.accent, fontSize:14, fontWeight:700, marginBottom:10, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, textTransform:"uppercase" }}>Player Picks</div>
            {PLAYERS.map(p => {
              const pks = playerPicks[p.id] || [];
              return (
                <div key={p.id} style={{ background:C.card, borderRadius:10, padding:12, marginBottom:8, border:`1px solid ${C.border}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, flexWrap:"wrap", gap:4 }}>
                    <span style={{ color:PC[p.id], fontWeight:700, fontSize:14 }}>{PNAME[p.id]} ({pks.length}/{ACTIVE_PICKS})</span>
                    <div style={{ display:"flex", gap:4 }}>
                      {pks.length < ACTIVE_PICKS && <button onClick={() => addPick(p.id)} style={{ padding:"4px 10px", borderRadius:6, border:`1px solid ${C.accent}66`, background:C.accent+"11", color:C.accent, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>+ Driver</button>}
                      {pks.length > 0 && <button onClick={() => setPlayerPicks({...playerPicks,[p.id]:[]})} style={{ padding:"4px 8px", borderRadius:6, border:`1px solid ${C.red}66`, background:C.red+"11", color:C.red, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>Clear All</button>}
                    </div>
                  </div>
                  {pks.map((pk, i) => (
                    <div key={i} style={{ display:"flex", gap:6, alignItems:"center", marginBottom:4 }}>
                      <span style={{ fontSize:10, color:C.muted, fontWeight:700, width:20 }}>R{i+1}</span>
                      <select value={pk.driver} onChange={e => updatePick(p.id,i,"driver",e.target.value)} style={{ ...iS, flex:1 }}>
                        <option value="">Select driver</option>
                        {DRIVERS.map(dr => <option key={dr} value={dr}>{dr}{isMemorial(dr) ? " 🕊️" : ""}</option>)}
                      </select>
                      <label style={{ display:"flex", alignItems:"center", gap:3, cursor:"pointer", fontSize:11, color:pk.mulligan?C.accent:C.muted, flexShrink:0 }}>
                        <input type="checkbox" checked={!!pk.mulligan} onChange={e => updatePick(p.id,i,"mulligan",e.target.checked)}/>M
                      </label>
                      <button onClick={() => removePick(p.id,i)} style={{ background:C.red+"22", border:`1px solid ${C.red}44`, borderRadius:6, color:C.red, padding:"4px 8px", fontSize:10, cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>✕</button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Race results */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ color:C.accent, fontSize:14, fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, textTransform:"uppercase" }}>Race Results</div>
            <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", fontSize:12, color:threeStages?C.purple:C.muted }}>
              <input type="checkbox" checked={threeStages} onChange={e => setThreeStages(e.target.checked)}/>
              3 Stages (Coca-Cola 600)
            </label>
          </div>
          <button onClick={addD} style={{ padding:"8px 16px", borderRadius:6, border:`1px solid ${C.accent}`, background:C.accent+"22", color:C.accent, fontSize:13, fontFamily:"inherit", fontWeight:600, cursor:"pointer", marginBottom:12 }}>
            + Add Driver Result
          </button>
          {drivers.map((d, i) => (
            <div key={i} style={{ background:C.card, borderRadius:10, padding:14, marginBottom:8, border:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", gap:6, marginBottom:8, alignItems:"center", flexWrap:"wrap" }}>
                <select value={d.name} onChange={e => ud(i,"name",e.target.value)} style={{ ...iS, flex:"2 1 140px" }}>
                  <option value="">Select driver</option>
                  {DRIVERS.map(dr => <option key={dr} value={dr}>{dr}</option>)}
                </select>
                <input placeholder="Fin"  type="number" value={d.finish}  onChange={e=>ud(i,"finish",e.target.value)}  style={{...iS,flex:"0 1 50px"}}/>
                <input placeholder="Qual" type="number" value={d.qualPos} onChange={e=>ud(i,"qualPos",e.target.value)} style={{...iS,flex:"0 1 50px"}}/>
                <input placeholder="S1"   type="number" value={d.stage1}  onChange={e=>ud(i,"stage1",e.target.value)}  style={{...iS,flex:"0 1 42px"}}/>
                <input placeholder="S2"   type="number" value={d.stage2}  onChange={e=>ud(i,"stage2",e.target.value)}  style={{...iS,flex:"0 1 42px"}}/>
                {threeStages && <input placeholder="S3" type="number" value={d.stage3} onChange={e=>ud(i,"stage3",e.target.value)} style={{...iS,flex:"0 1 42px"}}/>}
                <input placeholder="Led"  type="number" value={d.lapsLed} onChange={e=>ud(i,"lapsLed",e.target.value)} style={{...iS,flex:"0 1 50px"}}/>
                <button onClick={() => rm(i)} style={{ background:C.red+"22", border:`1px solid ${C.red}44`, borderRadius:6, color:C.red, padding:"6px 10px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>✕</button>
              </div>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
                {[["pole","Pole"],["stageWin1","S1 Win"],["stageWin2","S2 Win"],...(threeStages?[["stageWin3","S3 Win"]]:[]),["fastestLap","Fast Lap"],["mostLapsLed","Most Led"],["dnf","DNF"],["dq","DQ"]]
                  .map(([f,l]) => (
                    <label key={f} style={{ display:"flex", alignItems:"center", gap:4, cursor:"pointer", fontSize:12, color:d[f]?C.text:C.muted }}>
                      <input type="checkbox" checked={!!d[f]} onChange={e=>ud(i,f,e.target.checked)}/>{l}
                    </label>
                  ))
                }
              </div>
            </div>
          ))}

          {/* Save buttons */}
          <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
            <button onClick={handleScore} disabled={saving} style={{ flex:1, padding:"14px 0", borderRadius:8, border:"none", background:C.accent, color:"#000", fontFamily:"'Oswald',sans-serif", fontSize:16, fontWeight:700, letterSpacing:2, textTransform:"uppercase", cursor:"pointer" }}>
              {saving ? "Saving…" : (done ? `Re-Score W${week}` : `Score W${week}`)}
            </button>
            <button onClick={handleSavePicksOnly} disabled={saving} style={{ padding:"14px 16px", borderRadius:8, border:`1px solid ${C.blue}`, background:C.blue+"22", color:C.blue, fontFamily:"'Oswald',sans-serif", fontSize:13, fontWeight:700, cursor:"pointer", letterSpacing:1, textTransform:"uppercase" }}>
              Save Picks Only
            </button>
            <button onClick={() => { setEditing(false); setQuickScore(null); }} style={{ padding:"14px 16px", borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", color:C.muted, fontFamily:"'Oswald',sans-serif", fontSize:14, cursor:"pointer" }}>
              Cancel
            </button>
          </div>
          {msg && <div style={{ color:C.green, marginTop:10, textAlign:"center", fontSize:14 }}>{msg}</div>}
        </>
      )}

      {/* ── Scored summary (read-only) ─────────────────────────────────────── */}
      {done && !editing && !quickScore && (() => {
        const wr = data.results["w" + week];
        const s  = Object.entries(wr.scored || {}).sort((a, b) => b[1].total - a[1].total);
        return (
          <div style={{ marginTop:8 }}>
            <div style={{ color:C.muted, fontSize:11, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>
              Week {week} Scores
            </div>
            {s.map(([pid, ps]) => (
              <div key={pid} style={{
                display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"8px 12px", background:C.card, borderRadius:8, marginBottom:4,
                border:`1px solid ${ps.weeklyWin ? C.accent+"44" : C.border}`,
              }}>
                <span style={{ color:PC[pid], fontWeight:600, fontSize:14 }}>
                  {ps.weeklyWin ? "👑 " : ""}{PNAME[pid]}
                </span>
                <span style={{ color:PC[pid], fontWeight:700, fontSize:16 }}>{ps.total}</span>
              </div>
            ))}
          </div>
        );
      })()}

      {msg && !editing && !quickScore && (
        <div style={{ color:C.green, marginTop:10, textAlign:"center", fontSize:14 }}>{msg}</div>
      )}
    </div>
  );
}
