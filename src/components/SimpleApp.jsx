import { useMemo, useState } from "react";
import { PClr } from "../theme";
import { PNAME, SCHEDULE, ACTIVE_PICKS } from "../constants";
import { draftStatus, myPicks, availableDrivers, scoreboard, mulliganWindow, splitName } from "../engine/simple";
import { weekName } from "../exhibitions";
import { haptic } from "../utils/haptics";
import { pushToast } from "../utils/toast";
import { useCheatSheet } from "../hooks/useCheatSheet";
import { currentTrack, buildRows, TIERS } from "../engine/cheatSheet";
import { nameKey } from "../driverKey";
import { CheatSheetTab } from "./CheatSheetTab";

const ME_BLUE = "#3B82F6";
const f1 = n => (n == null ? "—" : (Math.round(n * 10) / 10).toFixed(1));
const ordinal = n => ["1st", "2nd", "3rd", "4th"][n] || `${n + 1}th`;

/** Big, plain confirmation dialog. */
function BigModal({ title, children, actions, onClose }) {
  return (
    <div className="sp-modal-scrim" onClick={onClose}>
      <div className="sp-modal" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
        <div className="sp-modal-actions">{actions}</div>
      </div>
    </div>
  );
}

function DriverName({ driver }) {
  const { num, name } = splitName(driver);
  return <span className="sp-dn"><b className="num">#{num}</b> {name}</span>;
}

// ── MAKE PICKS ───────────────────────────────────────────────────────────────
function MakePicks({ user, data, week, onDraftPick, onCheat }) {
  const status = draftStatus(data, week, user.id);
  const picks = myPicks(data, week, user.id);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("num");
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const list = useMemo(() => availableDrivers(data, week, { search, sort }), [data, week, search, sort]);
  const myTurn = status.state === "myTurn";
  const info = SCHEDULE.find(s => s.w === week);
  // Plain-language cheat-sheet tier next to each driver (blank until the sheet loads).
  const sheetSlug = currentTrack(week)?.slug;
  const sheet = useCheatSheet(sheetSlug).data;
  const tierByKey = useMemo(() => {
    const m = {};
    if (sheet) buildRows(sheet).forEach(r => { if (r.tier) m[r.key] = r.tier; });
    return m;
  }, [sheet]);

  const lockIn = async () => {
    if (!confirm || busy) return;
    setBusy(true);
    const result = await onDraftPick(week, user.id, confirm, status.pickNum);
    setBusy(false);
    setConfirm(null);
    if (result && !result.applied) {
      pushToast({ title: "Pick didn't save", body: result.reason === "offline" ? "You look offline — check your connection and try again." : "Someone just picked — the list has refreshed.", tone: "stop" });
      return;
    }
    haptic(20);
    setSearch("");
    pushToast({ title: "Pick locked in", body: confirm, tone: "go" });
  };

  return (
    <div className="sp-page">
      {/* status card */}
      {status.state === "none" && <div className="sp-status">No draft right now — the season is over. See you next season!</div>}
      {status.state === "gated" && (
        <div className="sp-status">The draft opens {new Date(status.opensAt).toLocaleString(undefined, { weekday: "long", hour: "numeric", minute: "2-digit" })}.</div>
      )}
      {status.state === "waiting" && (
        <div className="sp-status">Waiting on <b>{PNAME[status.onClock]}</b> to pick… You pick <b className="num">#{status.nextOverall}</b> in Round <b className="num">{status.nextRound}</b>.</div>
      )}
      {myTurn && <div className="sp-status go" role="status">YOUR TURN TO PICK — PICK {status.myPickNo} OF {ACTIVE_PICKS}</div>}
      {status.state === "done" && <div className="sp-status">All 5 of your picks are in. 👍</div>}
      {status.state === "complete" && <div className="sp-status">The draft is done. Good luck this week!</div>}

      {info && <div className="sp-race">{weekName(week)} · {info.r} · {info.t}</div>}
      {info && <button className="sp-cheat" onClick={onCheat}>📋 Ferda Tips for {info.t} — who runs well here</button>}

      {/* my 5 picks */}
      <section className="sp-card">
        <h2>My 5 Picks</h2>
        <ol className="sp-picks">
          {picks.map(p => (
            <li key={p.slot} className={p.driver ? "" : "open"}>
              <span className="sl">Pick {p.slot}</span>
              {p.driver ? <DriverName driver={p.driver} /> : <span className="op">Open Slot</span>}
            </li>
          ))}
        </ol>
      </section>

      {/* available drivers */}
      {(myTurn || status.state === "waiting") && (
        <section className="sp-card">
          <h2>Available Drivers</h2>
          <input className="sp-search" type="search" value={search} onChange={e => setSearch(e.target.value)}
                 placeholder="Type driver name or car #" aria-label="Type driver name or car number" />
          <div className="sp-sort" role="group" aria-label="Sort drivers">
            <button aria-pressed={sort === "num"} onClick={() => setSort("num")}>By Car #</button>
            <button aria-pressed={sort === "az"} onClick={() => setSort("az")}>A–Z</button>
          </div>
          {!myTurn && <p className="sp-hint">You can look now — the PICK buttons appear when it's your turn.</p>}
          <div className="sp-list">
            {list.length === 0 && <div className="sp-empty">No drivers match.</div>}
            {list.map(d => {
              const { num, name } = splitName(d);
              return (
                <div key={d} className="sp-row">
                  <span className="n num">#{num}</span>
                  <span className="nm">{name}</span>
                  {tierByKey[nameKey(d)] && <span className="sp-tier" style={{ "--tc": TIERS[tierByKey[nameKey(d)]].color }}>{TIERS[tierByKey[nameKey(d)]].plain}</span>}
                  {myTurn && <button className="sp-pick" onClick={() => setConfirm(d)}>PICK</button>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {confirm && (
        <BigModal
          title={`Draft #${splitName(confirm).num} ${splitName(confirm).name} for Pick ${status.myPickNo}?`}
          onClose={() => !busy && setConfirm(null)}
          actions={<>
            <button className="sp-btn yes" onClick={lockIn} disabled={busy}>{busy ? "Saving…" : "YES, LOCK IN PICK"}</button>
            <button className="sp-btn no" onClick={() => setConfirm(null)} disabled={busy}>CANCEL</button>
          </>}
        />
      )}
    </div>
  );
}

// ── SCOREBOARD & MULLIGANS ───────────────────────────────────────────────────
function Scoreboard({ user, data, week, liveScores, onApplyMulligan }) {
  const liveWeek = data?.liveRace?.active ? data.liveRace.week : null;
  const sb = scoreboard(data, { currentWeek: week, liveScores, liveWeek });
  const picks = myPicks(data, week, user.id);
  const mw = mulliganWindow(data, user.id, week);
  const pointsWeek = sb.week === week ? sb.drivers?.[user.id]?.drivers || [] : [];
  const ptsOf = d => pointsWeek.find(x => x.driver === d)?.total ?? null;

  const [step, setStep] = useState(0);            // 0 closed · 1 remove · 2 add · 3 confirm
  const [drop, setDrop] = useState(null);
  const [add, setAdd] = useState(null);
  const [busy, setBusy] = useState(false);
  const close = () => { if (busy) return; setStep(0); setDrop(null); setAdd(null); };
  const swap = async () => {
    setBusy(true);
    await onApplyMulligan(week, user.id, drop, add);
    setBusy(false);
    haptic(20);
    pushToast({ title: "Mulligan used", body: `${drop} → ${add}`, tone: "go" });
    setStep(0); setDrop(null); setAdd(null);
  };

  return (
    <div className="sp-page">
      <section className="sp-card">
        <h2>Scoreboard</h2>
        <div className="sp-sub">
          {sb.week == null ? "No scores yet." : `${weekName(sb.week)} · ${sb.label === "LIVE" ? "LIVE NOW" : "Final scores"}`}
        </div>
        <ol className="sp-board">
          {sb.rows.map((r, i) => (
            <li key={r.pid} className={r.pid === user.id ? "me" : ""} style={{ "--c": PClr[r.pid]?.accent }}>
              <span className="pl">{ordinal(i)}</span>
              <span className="nm">{r.name}</span>
              <span className="pt num">{f1(r.total)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="sp-card">
        <h2>My Lineup</h2>
        <div className="sp-sub">{weekName(week)}</div>
        <ol className="sp-picks">
          {picks.map(p => (
            <li key={p.slot} className={p.driver ? "" : "open"}>
              <span className="sl">Pick {p.slot}</span>
              {p.driver ? <DriverName driver={p.driver} /> : <span className="op">Open Slot</span>}
              {p.mulligan && <span className="sp-mtag">SWAPPED IN</span>}
              {p.driver && <span className="pts num">{f1(ptsOf(p.driver))}</span>}
            </li>
          ))}
        </ol>
        <div className="sp-mull">MULLIGANS LEFT: <b className="num">{mw.remaining}</b></div>
        {mw.open && <button className="sp-btn big" onClick={() => setStep(1)}>SWAP A DRIVER (USE MULLIGAN)</button>}
      </section>

      {step === 1 && (
        <BigModal title="Tap the driver you want to REMOVE" onClose={close}
          actions={<button className="sp-btn no" onClick={close}>CANCEL</button>}>
          <div className="sp-choices">
            {mw.mine.map(d => <button key={d} className="sp-choice" onClick={() => { setDrop(d); setStep(2); }}><DriverName driver={d} /></button>)}
          </div>
        </BigModal>
      )}
      {step === 2 && (
        <BigModal title="Tap the driver you want to ADD" onClose={close}
          actions={<>
            <button className="sp-btn no" onClick={() => setStep(1)}>BACK</button>
            <button className="sp-btn no" onClick={close}>CANCEL</button>
          </>}>
          <div className="sp-choices scroll">
            {mw.pool.map(d => <button key={d} className="sp-choice" onClick={() => { setAdd(d); setStep(3); }}><DriverName driver={d} /></button>)}
          </div>
        </BigModal>
      )}
      {step === 3 && (
        <BigModal title="Confirm Mulligan Swap" onClose={close}
          actions={<>
            <button className="sp-btn yes" onClick={swap} disabled={busy}>{busy ? "Saving…" : "CONFIRM SWAP"}</button>
            <button className="sp-btn no" onClick={close} disabled={busy}>CANCEL</button>
          </>}>
          <p className="sp-confirm">Drop <b>{drop}</b> for <b>{add}</b>?</p>
          <p className="sp-confirm small">You will have <b className="num">{mw.remaining - 1}</b> Mulligan{mw.remaining - 1 === 1 ? "" : "s"} left. The new driver scores finish position points only.</p>
        </BigModal>
      )}
    </div>
  );
}

/** The whole simplified app: two big tabs + a small way back to the full app. */
export function SimpleApp({ user, data, currentWeek, liveScores, onDraftPick, onApplyMulligan, onExitSimple, onLogout }) {
  const [tab, setTab] = useState("picks");
  const [cheat, setCheat] = useState(false);
  return (
    <div className="sp" style={{ "--me": PClr[user.id]?.accent || ME_BLUE }}>
      <header className="sp-head">
        <span className="dot" />
        <span className="who">{user.name}</span>
      </header>

      {tab === "picks" && cheat
        ? <CheatSheetTab simple data={data} currentWeek={currentWeek} player={user} onBack={() => setCheat(false)} />
        : tab === "picks"
        ? <MakePicks user={user} data={data} week={currentWeek} onDraftPick={onDraftPick} onCheat={() => setCheat(true)} />
        : <Scoreboard user={user} data={data} week={currentWeek} liveScores={liveScores} onApplyMulligan={onApplyMulligan} />}

      <div className="sp-foot">
        <button onClick={onExitSimple}>Switch to Full App View</button>
        <button onClick={onLogout}>Sign Out</button>
      </div>

      <nav className="sp-tabs" aria-label="Main">
        <button aria-current={tab === "picks" ? "page" : undefined} onClick={() => { setTab("picks"); setCheat(false); }}>MAKE PICKS</button>
        <button aria-current={tab === "scores" ? "page" : undefined} onClick={() => setTab("scores")}>SCOREBOARD</button>
      </nav>
    </div>
  );
}
