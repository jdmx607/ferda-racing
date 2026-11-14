import { useState, useMemo, useEffect } from "react";
import { C, PClr, TTC, TTL, DRAFT_CLR, r, shadow } from "../theme";
import { PLAYERS, PNAME, SCHEDULE, DRIVERS, DRIVER_INFO, ACTIVE_PICKS, TRACK_MULTS, DRAFT_TIMER_MS, isMemorial, isFreeAgent, isRookie } from "../constants";
import { getDraftOrder, buildSnakeOrder } from "../engine/draft";
import { storeFor } from "../engine/events";
import { weekName, weekLabel } from "../exhibitions";
import { analyzeLineups } from "../engine/draftAnalysis";
import { getUpNext, picksUntil, splitDriver, pillLabel, getScouting, buildPool, pruneQueue } from "../engine/draftBoard";
import { useDraftQueue } from "../hooks/useDraftQueue";
import { useStartingGrid } from "../hooks/useNascarFeeds";
import { paintFor } from "../driverPaint";

const MAKE_BADGE = { Chevy:"#b8b8b8", Ford:"#4a90e2", Toyota:"#eb0a1e", Dodge:"#a855f7" };

function fmtCountdown(msRemaining) {
  if (msRemaining <= 0) return "0m";
  const h = Math.floor(msRemaining / 3600000);
  const m = Math.floor((msRemaining % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// per-viewer UI preference (board collapsed) — never required, never shared
const PREF_BOARD = "ferda-draft-board-collapsed";
function readPref(key) { try { return window.localStorage.getItem(key) === "1"; } catch { return false; } }
function writePref(key, on) { try { window.localStorage.setItem(key, on ? "1" : "0"); } catch { /* ignore */ } }

function StarIcon({ filled }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8L12 3.2z"/>
    </svg>
  );
}

function DraftGate({ opensAt, now, weekInfo }) {
  const msRemaining = Math.max(0, new Date(opensAt).getTime() - now);
  const d = Math.floor(msRemaining / 86400000);
  const h = Math.floor((msRemaining % 86400000) / 3600000);
  const m = Math.floor((msRemaining % 3600000) / 60000);
  const opensDate = new Date(opensAt);
  return (
    <div style={{
      background:C.card, borderRadius:r.lg, padding:"32px 24px", textAlign:"center",
      border:`1px solid ${C.border}`, marginBottom:16,
    }}>
      <div style={{ fontSize:36, marginBottom:10 }}>🔒</div>
      <div style={{ color:C.text, fontFamily:"var(--font-sans)", fontSize:20, fontWeight:900, marginBottom:6 }}>
        Draft Opens Monday at 5:00 PM
      </div>
      {weekInfo && (
        <div style={{ color:C.dim, fontSize:13, marginBottom:16 }}>
          {weekName(weekInfo.w)} — {weekInfo.r}
        </div>
      )}
      <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:16 }}>
        {[{ v:d, l:"D" }, { v:h, l:"H" }, { v:m, l:"M" }].map(({ v, l }) => (
          <div key={l} style={{ textAlign:"center" }}>
            <div style={{
              background:C.accent+"18", border:`1px solid ${C.accent}44`,
              borderRadius:r.md, padding:"8px 12px", minWidth:48,
            }}>
              <div className="num" style={{ fontSize:22, fontWeight:900, color:C.accent, lineHeight:1 }}>
                {String(v).padStart(2, "0")}
              </div>
            </div>
            <div style={{ color:C.muted, fontSize:9, fontWeight:700, letterSpacing:1, marginTop:3 }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ color:C.muted, fontSize:11 }}>
        Opens {opensDate.toLocaleDateString(undefined, { weekday:"long", month:"short", day:"numeric" })} at{" "}
        {opensDate.toLocaleTimeString(undefined, { hour:"numeric", minute:"2-digit" })}
      </div>
    </div>
  );
}

// ── Draft board ──────────────────────────────────────────────────────────────
function BoardColumn({ pid, seed, picks, active }) {
  const nextSlot = picks.length;
  return (
    <div className={"dr-col" + (active ? " on" : "")} style={{ "--mc": DRAFT_CLR[pid] }} aria-current={active ? "step" : undefined}>
      {active && <span className="dr-pulse dr-col-led" role="img" aria-label="On the clock" />}
      <div className="dr-col-h">
        <span className="dr-col-name">{PNAME[pid]}</span>
      </div>
      {Array.from({ length:ACTIVE_PICKS }).map((_, si) => {
        const driver = picks[si];
        const label = driver ? pillLabel(driver) : null;
        const isActiveSlot = active && si === nextSlot;
        return (
          <div key={si} className={"dr-slot" + (driver ? " filled" : "") + (isActiveSlot ? " active" : "")}>
            <span className="r num">R{si + 1}</span>
            {driver ? (
              <span className="d" title={driver}><span className="n num">{label.num}</span> {label.last}</span>
            ) : isActiveSlot ? (
              <span className="d now"><span className="long">On the clock</span><span className="short">NOW</span></span>
            ) : (
              <span className="d dim">—</span>
            )}
          </div>
        );
      })}
      <div className="dr-col-seed num" title={`Picks ${seed}${["st","nd","rd"][seed - 1] || "th"} each round`}>#{seed} <i>•</i> {picks.length}/{ACTIVE_PICKS}</div>
    </div>
  );
}

function BoardSummary({ order, playerPicks, currentPid }) {
  return (
    <div className="dr-sum">
      {order.map(pid => {
        const active = pid === currentPid;
        return (
          <div key={pid} className={"dr-sum-c" + (active ? " on" : "")} style={{ "--mc": DRAFT_CLR[pid] }}>
            {active && <span className="dr-pulse dr-col-led" role="img" aria-label="On the clock" />}
            <span className="nm">{PNAME[pid]}</span>
            <span className="ct num">{(playerPicks[pid] || []).length}/{ACTIVE_PICKS}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Driver scouting row ──────────────────────────────────────────────────────
function PoolRow({ row, myTurn, queued, spotlight, onDraft, onQueue }) {
  const { driver, owner, memorial, rookie, start, avgFinish, trackAvg } = row;
  const info = DRIVER_INFO[driver] || {};
  const { num, name } = splitDriver(driver);
  return (
    <div
      className={"dr-row" + (owner ? " owned" : "") + (memorial ? " mem" : "") + (rookie && spotlight ? " rk" : "")}
      style={{ "--paint": paintFor(driver) }}
    >
      <div className="dr-num num" aria-hidden="true">{num || "–"}</div>
      <div className="dr-main">
        <div className="dr-l1">
          <span className="dr-name">{name}</span>
          {info.make && <span className="dr-make" style={{ color:MAKE_BADGE[info.make] }}>{info.make}</span>}
          {rookie && <span className="dr-rk" title="Rookie / bonus eligible" aria-label="Rookie, bonus eligible">★</span>}
          {memorial && <span aria-label="In memoriam">🕊️</span>}
        </div>
        <div className="dr-l2">
          <span><i>Start</i><b className="num">{start != null ? `P${start}` : "—"}</b></span>
          <span><i>Trk</i><b className="num">{trackAvg != null ? trackAvg.toFixed(1) : "—"}</b></span>
          <span><i>Avg</i><b className="num">{avgFinish != null ? avgFinish.toFixed(1) : "—"}</b></span>
        </div>
      </div>
      <div className="dr-act">
        {owner ? (
          <span className="dr-owned" style={{ "--mc": DRAFT_CLR[owner] }}>OWNED • {PNAME[owner].toUpperCase()}</span>
        ) : memorial ? null : myTurn ? (
          <button className="dr-draft" onClick={() => onDraft(driver)} aria-label={`Draft ${name}`}>DRAFT</button>
        ) : (
          <button className="dr-q" aria-pressed={queued} onClick={() => onQueue(driver)}
                  aria-label={queued ? `Remove ${name} from queue` : `Queue ${name}`}>
            <StarIcon filled={queued} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── My Queue bar (pinned above the bottom nav) ───────────────────────────────
function QueueBar({ queue, myTurn, open, setOpen, onDraft, onTop, onRemove }) {
  if (!queue.length) return null;
  const top = splitDriver(queue[0]);
  return (
    <div className="dr-queue" role="region" aria-label="My queue">
      <div className={"dr-queue-in" + (myTurn ? " go" : "")}>
        {open && (
          <div className="dr-q-list">
            {queue.map((d, i) => {
              const { num, name } = splitDriver(d);
              return (
                <div key={d} className="dr-q-item" style={{ "--paint": paintFor(d) }}>
                  <span className="rk num">{i + 1}</span>
                  <span className="nm"><span className="num">#{num}</span> {name}</span>
                  {i > 0 && <button className="ic" onClick={() => onTop(d)} aria-label={`Move ${name} to top`}>↑</button>}
                  <button className="ic" onClick={() => onRemove(d)} aria-label={`Remove ${name}`}>✕</button>
                  {myTurn && <button className="dr-draft sm" onClick={() => onDraft(d)}>DRAFT</button>}
                </div>
              );
            })}
          </div>
        )}
        <div className="dr-q-bar">
          <button className="tog" onClick={() => setOpen(!open)} aria-expanded={open}>
            <span className="st"><StarIcon filled /></span>
            <span className="t">My Queue</span>
            <span className="c num">{queue.length}</span>
            {!open && <span className="nx"><span className="num">#{top.num}</span> {top.name}</span>}
            <span className="chev" aria-hidden="true">{open ? "▼" : "▲"}</span>
          </button>
          {myTurn && !open && (
            <button className="dr-draft sm" onClick={() => onDraft(queue[0])} aria-label={`Draft ${top.name}`}>
              DRAFT #{top.num}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const POOL_PILLS = [
  { id:"bonus", label:"★ Bonus / Rookie", hint:"Rookie / bonus-eligible drivers first" },
  { id:"track", label:"Track Rating",     hint:"Best average FERDA points at this track type first" },
  { id:"top10", label:"Starting Top 10",  hint:"Drivers starting P1–P10, in grid order" },
];

export function DraftTab({ player, data, onDraftPick, onUndoDraft, currentWeek }) {
  const [search,  setSearch]  = useState("");
  const [undoMsg, setUndoMsg] = useState("");
  const [pickMsg, setPickMsg] = useState("");
  const [pool,    setPool   ] = useState("drivers");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [mode,    setMode   ] = useState(null);
  const [boardCollapsed, setBoardCollapsed] = useState(() => readPref(PREF_BOARD));
  const [queueOpen, setQueueOpen] = useState(false);
  const [now,     setNow    ] = useState(() => Date.now());

  const weekInfo      = SCHEDULE.find(s => s.w === currentWeek);
  const draftKey      = "w" + currentWeek;
  const draftOrder    = useMemo(() => getDraftOrder(data, currentWeek),  [data, currentWeek]);
  const snakeSequence = useMemo(() => buildSnakeOrder(draftOrder), [draftOrder]);
  const src           = storeFor(data, currentWeek); // exhibitions keep drafts/picks separately
  const draftState    = src.drafts?.[draftKey] || [];
  const currentPickNum = draftState.length;
  const draftComplete  = currentPickNum >= snakeSequence.length;
  const currentTurn    = !draftComplete ? snakeSequence[currentPickNum] : null;
  const isMyTurn       = currentTurn?.pid === player.id;

  const takenDrivers = useMemo(() => new Set(draftState.map(d => d.driver)), [draftState]);
  const owners = useMemo(() => {
    const m = {};
    draftState.forEach(d => { m[d.driver] = d.pid; });
    return m;
  }, [draftState]);

  const playerPicks = {};
  PLAYERS.forEach(p => { playerPicks[p.id] = []; });
  draftState.forEach(d => { if (playerPicks[d.pid]) playerPicks[d.pid].push(d.driver); });

  // ── Scouting data + driver pool ───────────────────────────────────────────
  const scouting = useMemo(() => getScouting(data, weekInfo?.ty), [data, weekInfo?.ty]);
  const grid = useStartingGrid(currentWeek, !!weekInfo && !draftComplete);
  const rows = useMemo(() => buildPool({
    drivers: DRIVERS, owners, search, availableOnly, mode, pool, scouting, grid,
    isRookie, isFreeAgent, isMemorial,
  }), [owners, search, availableOnly, mode, pool, scouting, grid]);
  // tab counts: drivers still on the board (matching the search), split by free agency
  const poolCount = free => DRIVERS.filter(d =>
    !takenDrivers.has(d) && d.toLowerCase().includes(search.trim().toLowerCase()) && isFreeAgent(d) === free
  ).length;

  // ── My Queue (device-local watchlist; drafted drivers fall off automatically) ──
  const q = useDraftQueue(player.id, currentWeek);
  const liveQueue = useMemo(() => pruneQueue(q.queue, takenDrivers, isMemorial), [q.queue, takenDrivers]);
  useEffect(() => {
    if (liveQueue.length !== q.queue.length) q.replace(liveQueue);
  }, [liveQueue, q.queue.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Post-draft analysis — computed once draft is locked
  const savedPicks = src.picks?.[draftKey] || {};
  const picksForAnalysis = draftComplete ? playerPicks : savedPicks;
  const analysis = useMemo(() => {
    if (!draftComplete) return null;
    // Build picks shape for analyzeLineups: {pid: [{driver, mulligan}]}
    const wp = {};
    PLAYERS.forEach(p => { wp[p.id] = (picksForAnalysis[p.id] || []).map(d => typeof d === "string" ? { driver:d, mulligan:false } : d); });
    return analyzeLineups(wp, currentWeek, data);
  }, [draftComplete, currentWeek, data]);

  const handlePick = async (driver) => {
    if (!isMyTurn || draftComplete || isMemorial(driver)) return;
    if (!window.confirm(`Lock in ${driver}?`)) return;
    const result = await onDraftPick(currentWeek, player.id, driver, currentPickNum);
    if (result && !result.applied) {
      setPickMsg(
        result.reason === "offline"
          ? "⚠️ Couldn't save — you appear to be offline. Check your connection and try again."
          : "⚠️ Someone already picked this slot — the board just refreshed with the latest picks."
      );
      setTimeout(() => setPickMsg(""), 5000);
      return;
    }
    setSearch("");
  };

  // ── Timer countdown display (autopick + reminders now run app-wide in App.jsx) ─
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const timerMeta   = src.draftTimers?.[draftKey];
  const msElapsed   = timerMeta?.startedAt ? now - new Date(timerMeta.startedAt).getTime() : null;
  const msRemaining = msElapsed !== null ? Math.max(0, DRAFT_TIMER_MS - msElapsed) : null;
  const timerExpired = msElapsed !== null && msElapsed >= DRAFT_TIMER_MS;

  // Gate the draft to its scheduled Monday-5pm open time. Only applies before
  // anyone has picked — weeks with no schedule entry (pre-dating this
  // feature) just skip the gate and behave as before.
  const opensAt = src.draftSchedule?.[draftKey]?.opensAt;
  const isGated = !!opensAt && draftState.length === 0 && now < new Date(opensAt).getTime();

  const toggleBoard = () => setBoardCollapsed(c => { writePref(PREF_BOARD, !c); return !c; });

  if (!weekInfo) {
    return (
      <div style={{ padding:20, maxWidth:900, margin:"0 auto", position:"relative", zIndex:1 }}>
        <div style={{
          background:C.card, borderRadius:r.lg, padding:"40px 24px", textAlign:"center",
          border:`1px solid ${C.border}`,
        }}>
          <div style={{ fontSize:36, marginBottom:8 }}>🏁</div>
          <div style={{ color:C.text, fontFamily:"var(--font-sans)", fontSize:20, fontWeight:900, marginBottom:6 }}>
            Season Complete
          </div>
          <div style={{ color:C.dim, fontSize:13 }}>No draft right now — see you next season.</div>
        </div>
      </div>
    );
  }

  const upNext   = !draftComplete ? getUpNext(snakeSequence, currentPickNum, draftOrder) : [];
  const until    = !draftComplete ? picksUntil(snakeSequence, currentPickNum, player.id) : null;
  const clockClr = msRemaining === null ? null : msRemaining < 2*3600000 ? "var(--stop)" : msRemaining < 6*3600000 ? "var(--caution)" : null;
  const showPool = !draftComplete && !isGated;
  const hasQueue = showPool && liveQueue.length > 0;
  const activeHint = POOL_PILLS.find(p => p.id === mode)?.hint;

  return (
    <div className={"dr-root" + (hasQueue ? " has-queue" : "")}>

      {/* ── Sticky "On The Clock" header ────────────────────────────────────── */}
      <header className="dr-head" data-tone={isGated || draftComplete ? "done" : isMyTurn ? "go" : "wait"}
              style={currentTurn ? { "--mc": DRAFT_CLR[currentTurn.pid] } : undefined}>
        <div className="dr-race">
          <span className="ttl">
            {weekName(currentWeek)} Draft <i>•</i> {weekInfo.r} — {weekInfo.t}
          </span>
          {TTL[weekInfo.ty] && (
            <span className="dr-mult num" style={{ color:TTC[weekInfo.ty] }} title={`${weekInfo.ty.replace("_"," ")} track multiplier`}>
              {TTL[weekInfo.ty]} ×{TRACK_MULTS[weekInfo.ty]}
            </span>
          )}
        </div>

        {!isGated && (draftComplete ? (
          <div className="dr-turn done">🏁 Draft Complete <i>•</i> All picks locked for {weekLabel(currentWeek)}</div>
        ) : (
          <>
            <div className="dr-turn" role="status" aria-live="polite">
              <div className="dr-turn-a">
                <span className="dr-pulse" aria-hidden="true" />
                <b className="who">{isMyTurn ? "Your Pick!" : `${PNAME[currentTurn.pid]}'s Turn`}</b>
                <i>•</i><span className="num">Pick {currentPickNum + 1} of {snakeSequence.length}</span>
                <i>•</i><span className="num">Round {currentTurn.round}</span>
                {currentTurn.round === ACTIVE_PICKS && <span className="dr-final">FINAL ROUND</span>}
              </div>
              <div className="dr-turn-b">
                {timerExpired ? (
                  <span className="dr-clock" style={{ color:"var(--caution)" }}>⏳ Auto-picking…</span>
                ) : msRemaining !== null && (
                  <span className="dr-clock num" style={clockClr ? { color:clockClr } : undefined}>
                    ⏱ {fmtCountdown(msRemaining)} {isMyTurn ? "to auto-pick" : "left"}
                  </span>
                )}
                {!isMyTurn && until > 0 && <span className="dr-you num">You pick in {until}</span>}
              </div>
            </div>

            <div className="dr-next" aria-label="Up next">
              <span className="dr-next-l">Up next</span>
              {upNext.map((n, i) => (
                <span key={n.pickNo} className="dr-nx-wrap">
                  {i > 0 && (n.turn
                    ? <span className="dr-wrap" title={`Round ${n.round}`}>↻<small className="num">R{n.round}</small></span>
                    : <span className="dr-arr">→</span>)}
                  <span className={"dr-nx" + (n.now ? " now" : "") + (n.pid === player.id ? " me" : "")} style={{ "--mc": DRAFT_CLR[n.pid] }}>
                    <b className="num">{n.seed}.</b> {PNAME[n.pid]}
                  </span>
                </span>
              ))}
            </div>
          </>
        ))}
      </header>

      {isGated ? (
        <DraftGate opensAt={opensAt} now={now} weekInfo={weekInfo} />
      ) : (
      <>
      {pickMsg && <div className="dr-alert" role="alert">{pickMsg}</div>}

      {/* ── Telemetry draft board ───────────────────────────────────────────── */}
      <section className="dr-board-wrap" aria-label="Draft board">
        <div className="dr-sec">
          <span className="label">Draft Board</span>
          <button className="dr-toggle" onClick={toggleBoard} aria-expanded={!boardCollapsed}>
            Board {boardCollapsed ? "▼" : "▲"}
          </button>
        </div>
        {boardCollapsed ? (
          <BoardSummary order={draftOrder} playerPicks={playerPicks} currentPid={currentTurn?.pid} />
        ) : (
          <div className="dr-board">
            {draftOrder.map((pid, i) => (
              <BoardColumn key={pid} pid={pid} seed={i + 1} picks={playerPicks[pid] || []} active={currentTurn?.pid === pid} />
            ))}
          </div>
        )}
      </section>

      {/* ── Driver scouting pool (browse any time; DRAFT on your turn, QUEUE otherwise) ── */}
      {showPool && (
        <section className="dr-pool" aria-label="Driver pool">
          <div className="dr-sec">
            <span className="label">{isMyTurn ? "Select a Driver" : "Scouting Pool"}</span>
            <div className="seg dr-poolseg" role="group" aria-label="Pool">
              {[{ id:"drivers", label:"Drivers", n:poolCount(false) }, { id:"free", label:"Free Agents", n:poolCount(true) }].map(t => (
                <button key={t.id} aria-pressed={pool === t.id} onClick={() => setPool(t.id)}>
                  {t.label} <span className="num">{t.n}</span>
                </button>
              ))}
            </div>
          </div>

          <input
            className="dr-search" type="search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search driver or #…" aria-label="Search driver or car number"
          />
          <div className="dr-pills" role="group" aria-label="Quick filters">
            <button className="dr-pill" aria-pressed={availableOnly} onClick={() => setAvailableOnly(a => !a)}>Available</button>
            {POOL_PILLS.map(p => (
              <button key={p.id} className="dr-pill" aria-pressed={mode === p.id} onClick={() => setMode(m => (m === p.id ? null : p.id))}>
                {p.label}
              </button>
            ))}
          </div>
          {(activeHint || !availableOnly) && (
            <div className="dr-note">
              {[activeHint, !availableOnly && "Drafted drivers are shown dimmed with their owner"].filter(Boolean).join(" · ")}
            </div>
          )}

          <div className="dr-list">
            {rows.length === 0 ? (
              <div className="dr-empty">
                {mode === "top10" && !grid
                  ? "Starting grid isn't set yet — NASCAR posts it after qualifying."
                  : "No drivers match."}
              </div>
            ) : rows.map(row => (
              <PoolRow
                key={row.driver} row={row} myTurn={isMyTurn} queued={liveQueue.includes(row.driver)}
                spotlight={mode === "bonus"} onDraft={handlePick} onQueue={q.toggle}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Pick log ────────────────────────────────────────────────────────── */}
      {draftState.length > 0 && (
        <div style={{ marginTop:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <div className="label">Pick Log</div>
            {player.id === "justin" && !draftComplete && (
              <button
                onClick={async () => {
                  const last = draftState[draftState.length - 1];
                  if (!window.confirm(`Undo last pick by ${PNAME[last.pid]} (${last.driver})?`)) return;
                  const removed = await onUndoDraft(currentWeek);
                  if (removed) setUndoMsg(`Undid ${PNAME[removed.pid]}'s pick: ${removed.driver}`);
                  setTimeout(() => setUndoMsg(""), 3000);
                }}
                style={{
                  padding:"5px 12px", borderRadius:r.pill,
                  border:`1px solid ${C.red}66`, background:C.red+"11",
                  color:C.red, fontSize:11, cursor:"pointer",
                  fontFamily:"inherit", fontWeight:700,
                }}
              >
                ↩ Undo Last Pick
              </button>
            )}
          </div>
          {undoMsg && (
            <div style={{ color:C.accent, fontSize:12, marginBottom:8, textAlign:"center" }}>{undoMsg}</div>
          )}
          <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
            {[...draftState].reverse().map((d, i) => (
              <div key={i} style={{
                display:"flex", alignItems:"center", gap:10, padding:"8px 12px",
                background:C.card, borderRadius:r.sm,
                border:`1px solid ${C.border}`,
                borderLeft:`3px solid ${DRAFT_CLR[d.pid]}`,
              }}>
                <span className="num" style={{ fontSize:10, color:C.muted, width:26, flexShrink:0 }}>
                  #{draftState.length - i}
                </span>
                <span style={{ fontSize:12, color:DRAFT_CLR[d.pid], fontWeight:700, width:90, flexShrink:0 }}>
                  {PNAME[d.pid]}
                </span>
                <span style={{ fontSize:12, color:C.text, flex:1 }}>{d.driver}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── My Queue — pinned above the bottom nav ─────────────────────────── */}
      {hasQueue && (
        <QueueBar
          queue={liveQueue} myTurn={isMyTurn} open={queueOpen} setOpen={setQueueOpen}
          onDraft={handlePick} onTop={q.toTop} onRemove={q.remove}
        />
      )}

      {/* ── Post-draft lineup analysis ────────────────────────────────────────── */}
      {draftComplete && analysis && (
        <div style={{ marginTop:24 }}>
          {/* Header */}
          <div style={{
            background:C.card,
            borderRadius:`${r.lg}px ${r.lg}px 0 0`,
            padding:"16px 20px",
            border:`1px solid ${TTC[analysis.trackType]}44`,
            borderBottom:"none",
            boxShadow:shadow.glow(TTC[analysis.trackType]),
          }}>
            <div style={{ color:TTC[analysis.trackType], fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:4 }}>
              📊 Lineup Analysis — {weekLabel(analysis.week)}
            </div>
            <div style={{ color:C.text, fontFamily:"var(--font-sans)", fontSize:18, fontWeight:900, letterSpacing:1 }}>
              {analysis.raceName}
            </div>
            <div style={{ color:C.muted, fontSize:11, marginTop:3 }}>
              @ {analysis.trackName} · Based on {analysis.racesOfType} {TTL[analysis.trackType]} race{analysis.racesOfType!==1?"s":""} this season
            </div>
          </div>

          {/* Overall ranking */}
          <div style={{
            background:C.card, border:`1px solid ${C.border}`,
            borderTop:"none", padding:"14px 20px",
          }}>
            <div style={{ color:C.muted, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:10 }}>
              Projected Ranking (avg pts at this track type)
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {analysis.lineups.map((p, i) => {
                const barW = analysis.maxProjected > 0 ? (p.projectedTotal / analysis.maxProjected) * 100 : 0;
                const isFirst = i === 0;
                return (
                  <div key={p.id}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
                      <span style={{
                        fontFamily:"var(--font-sans)", fontSize:16, fontWeight:900,
                        color:isFirst ? C.accent : C.muted,
                        width:22, flexShrink:0,
                      }}>{i+1}</span>
                      <div style={{
                        width:28, height:28, borderRadius:"50%", flexShrink:0,
                        background:PClr[p.id].bg, border:`2px solid ${PClr[p.id].fg}44`,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontFamily:"var(--font-sans)", fontSize:12, fontWeight:900,
                        color:PClr[p.id].fg,
                      }}>{PNAME[p.id][0]}</div>
                      <span style={{ color:PClr[p.id].fg === "#AA0000" ? C.text : PClr[p.id].fg, fontWeight:700, fontSize:14, flex:1 }}>
                        {PNAME[p.id]}
                        {isFirst && <span style={{ color:C.accent, fontSize:10, marginLeft:8 }}>PAPER FAVORITE</span>}
                      </span>
                      <span style={{
                        fontFamily:"var(--font-sans)", fontSize:18, fontWeight:900,
                        color:isFirst ? C.accent : C.text,
                      }}>{p.projectedTotal}</span>
                    </div>
                    <div style={{ marginLeft:60, height:5, background:C.border, borderRadius:r.pill, overflow:"hidden" }}>
                      <div style={{
                        height:"100%", width:`${barW}%`,
                        background:isFirst ? C.accent : PClr[p.id].fg,
                        opacity:0.75, transition:"width 0.6s ease",
                      }}/>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ color:C.muted, fontSize:10, marginTop:10 }}>
              Mulliganed drivers discounted ~60% (finish pts only). Projected ≠ actual — just historical avg.
            </div>
          </div>

          {/* Per-player driver breakdown */}
          <div style={{
            display:"grid", gridTemplateColumns:"repeat(2,1fr)",
            gap:1, border:`1px solid ${C.border}`,
            borderTop:"none",
            borderRadius:`0 0 ${r.lg}px ${r.lg}px`, overflow:"hidden",
          }}>
            {analysis.lineups.map((p, idx) => {
              const maxAvg = p.drivers[0]?.avgScore || 1;
              return (
                <div key={p.id} style={{
                  background:PClr[p.id].bg, padding:"12px 14px",
                  borderRight: idx % 2 === 0 ? `1px solid ${C.border}` : "none",
                }}>
                  <div style={{ color:PClr[p.id].fg, fontFamily:"var(--font-sans)", fontSize:14, fontWeight:900, letterSpacing:0.5, marginBottom:8 }}>
                    {PNAME[p.id].toUpperCase()}
                    <span style={{ color:PClr[p.id].fg+"66", fontSize:9, fontWeight:400, marginLeft:6 }}>
                      {p.projectedTotal} proj
                    </span>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    {p.drivers.map(d => (
                      <div key={d.driver} style={{
                        display:"flex", alignItems:"center", gap:6, padding:"5px 8px",
                        background:PClr[p.id].bg==="#000000"?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.15)",
                        borderRadius:r.sm,
                      }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ color:PClr[p.id].fg, fontSize:11, fontWeight:700,
                            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                          }}>
                            {d.driver}{d.isMulligan?" 🔄":""}
                          </div>
                          {/* Mini bar */}
                          <div style={{ height:2, background:C.border+"55", borderRadius:r.pill, marginTop:3 }}>
                            <div style={{
                              height:"100%",
                              width:`${maxAvg>0?(d.avgScore/maxAvg)*100:0}%`,
                              background:PClr[p.id].fg, opacity:0.6,
                            }}/>
                          </div>
                        </div>
                        <div style={{ textAlign:"right", flexShrink:0 }}>
                          <span style={{
                            fontFamily:"var(--font-sans)", fontSize:13, fontWeight:700,
                            color:d.avgScore>=40?C.accent:d.avgScore>=20?C.green:PClr[p.id].fg+"88",
                          }}>
                            {d.avgScore>0?d.avgScore:"—"}
                          </span>
                          {d.appearances>0&&<div style={{ color:PClr[p.id].fg+"44", fontSize:8 }}>{d.appearances}r avg</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Top 3 left on the board */}
          {analysis.top3Available?.length > 0 && (
            <div style={{
              marginTop:8, background:C.card, borderRadius:r.md, padding:"12px 16px",
              border:`1px solid ${C.border}`,
            }}>
              <div style={{ color:C.muted, fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:1.5, marginBottom:10 }}>
                🔥 Best Drivers Left on the Board
              </div>
              {analysis.top3Available.map((d, i) => (
                <div key={d.name} style={{
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"8px 0",
                  borderBottom: i < analysis.top3Available.length - 1 ? `1px solid ${C.border}` : "none",
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{
                      width:24, height:24, borderRadius:"50%", flexShrink:0,
                      background: i === 0 ? C.accent+"22" : "transparent",
                      border:`1px solid ${i === 0 ? C.accent : C.border}`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontFamily:"var(--font-sans)", fontSize:12, fontWeight:700,
                      color: i === 0 ? C.accent : C.muted,
                    }}>{i + 1}</div>
                    <div>
                      <div style={{ color: i === 0 ? C.text : C.textDim, fontWeight: i === 0 ? 700 : 400, fontSize:13 }}>
                        {d.name}
                      </div>
                      <div style={{ color:C.muted, fontSize:10, marginTop:1 }}>
                        {d.appearances} race{d.appearances!==1?"s":""} at {TTL[analysis.trackType]}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{
                      fontFamily:"var(--font-sans)", fontWeight:900,
                      fontSize: i === 0 ? 24 : 18,
                      color: i === 0 ? C.accent : C.text,
                    }}>
                      {d.avgScore}
                    </div>
                    <div style={{ color:C.muted, fontSize:9, textTransform:"uppercase" }}>avg pts</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* No track data yet */}
      {draftComplete && !analysis && (
        <div style={{
          marginTop:16, background:C.card, borderRadius:r.md, padding:"14px 18px",
          border:`1px solid ${C.border}`, color:C.dim, fontSize:13, textAlign:"center",
        }}>
          📊 Lineup analysis will be available once we have results from this track type.
        </div>
      )}
      </>
      )}
    </div>
  );
}
