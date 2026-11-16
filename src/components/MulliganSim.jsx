import { useMemo, useState, useEffect } from "react";
import { PClr, TTL } from "../theme";
import { PNAME, DRIVERS, SCHEDULE, TRACK_MULTS, isMemorial, isFreeAgent } from "../constants";
import { storeFor } from "../engine/events";
import { simulateMulligan, projectedLine, sameCar } from "../engine/whatIf";
import { nameKey } from "../driverKey";
import { haptic } from "../utils/haptics";
import { pushToast } from "../utils/toast";

const f1 = n => (Math.round(n * 10) / 10).toFixed(1);
const signed = n => (n > 0 ? "+" : n < 0 ? "−" : "") + f1(Math.abs(n));

function Stepper({ label, value, onChange, min = 1, max = 40 }) {
  const set = v => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div className="ms-step">
      <span className="lb">{label}</span>
      <button onClick={() => set(value - 1)} aria-label={`${label} down`}>−</button>
      <input className="num" type="number" inputMode="numeric" min={min} max={max} value={value}
             onChange={e => set(parseInt(e.target.value || String(min), 10))} aria-label={label} />
      <button onClick={() => set(value + 1)} aria-label={`${label} up`}>+</button>
    </div>
  );
}

/**
 * "What-if" mulligan calculator: pick one of the manager's drivers to drop and an
 * undrafted replacement, tweak projected finishes, and see the real scoring delta
 * (replacement = finish + net position, capped ±10; dropped = full scoring).
 */
export function MulliganSim({ data, week, pid, player, raceInfo, grid, remaining, onApplyMulligan, onDone }) {
  const info = SCHEDULE.find(s => s.w === week);
  const ty = info?.ty || "intermediate";
  const src = storeFor(data, week);
  const picks = (src.picks?.["w" + week]?.[pid] || []).filter(pk => !pk.garage && pk.driver);
  const live = data?.liveRace?.active && data.liveRace.week === week ? (raceInfo?.raw?.drivers || []) : [];
  const three = !!raceInfo?.raw?.threeStages;
  const rawOf = name => live.find(d => sameCar(d.name, name)) || null;

  const taken = new Set(Object.values(src.picks?.["w" + week] || {}).flat().map(pk => pk?.driver).filter(Boolean));
  const pool = DRIVERS.filter(d => !taken.has(d) && !isMemorial(d) && !isFreeAgent(d));

  const [drop, setDrop] = useState(picks.find(p => !p.mulligan)?.driver || "");
  const [rep, setRep] = useState("");
  const startOf = name => rawOf(name)?.qualPos || grid?.[nameKey(name)] || 20;
  const [proj, setProj] = useState({});
  useEffect(() => {
    // seed projections from live running order / qualifying when the selection changes
    setProj(p => ({
      ...p,
      dropFinish: rawOf(drop)?.finish || p.dropFinish || 20,
      dropLaps: rawOf(drop)?.lapsLed ?? 0,
      dropStart: startOf(drop),
      repFinish: rawOf(rep)?.finish || p.repFinish || 10,
      repStart: startOf(rep),
    }));
  }, [drop, rep]); // eslint-disable-line react-hooks/exhaustive-deps

  const sim = useMemo(() => {
    if (!drop || !rep || !proj.dropFinish) return null;
    const dropped = projectedLine(drop, rawOf(drop), { finish: proj.dropFinish, qualPos: proj.dropStart, lapsLed: proj.dropLaps });
    const replacement = projectedLine(rep, rawOf(rep), { finish: proj.repFinish, qualPos: proj.repStart });
    return simulateMulligan({ dropped, replacement, ty, threeStages: three });
  }, [drop, rep, proj, ty, three]); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = player?.id === pid;
  const confirm = async () => {
    if (!mine || !drop || !rep || remaining <= 0) return;
    if (!window.confirm(`Use a Mulligan: drop ${drop} for ${rep}?\n\nThe replacement scores finish position + net position only. This can't be undone.`)) return;
    await onApplyMulligan(week, pid, drop, rep);
    haptic(15);
    pushToast({ title: "Mulligan locked in", body: `${drop} → ${rep}`, tone: "gold" });
    onDone?.();
  };

  return (
    <div className="ms" style={{ "--c": PClr[pid]?.accent }}>
      <div className="ms-head">
        <span className="dot" />
        <b>{PNAME[pid]}</b>
        <span className="ms-badge num">{TTL[ty]} ×{(TRACK_MULTS[ty] ?? 0.5).toFixed(1)}</span>
        <span className="ms-left num">{remaining} mulligan{remaining === 1 ? "" : "s"} left</span>
      </div>
      <div className="ms-note">
        {live.length ? "Seeded from the live running order — adjust to test scenarios." : "No live race data — set projected finishes to test scenarios."}
      </div>

      <label className="ms-field">
        <span className="lb">Drop</span>
        <select value={drop} onChange={e => setDrop(e.target.value)}>
          {picks.map(p => <option key={p.driver} value={p.driver} disabled={p.mulligan}>{p.driver}{p.mulligan ? " (mulligan)" : ""}</option>)}
        </select>
      </label>
      {drop && (
        <div className="ms-row">
          <Stepper label="Finish" value={proj.dropFinish || 20} onChange={v => setProj(p => ({ ...p, dropFinish: v }))} />
          <Stepper label="Laps led" value={proj.dropLaps || 0} min={0} max={600} onChange={v => setProj(p => ({ ...p, dropLaps: v }))} />
        </div>
      )}

      <label className="ms-field">
        <span className="lb">Swap in</span>
        <select value={rep} onChange={e => setRep(e.target.value)}>
          <option value="">Choose an undrafted driver…</option>
          {pool.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </label>
      {rep && (
        <div className="ms-row">
          <Stepper label="Start" value={proj.repStart || 20} onChange={v => setProj(p => ({ ...p, repStart: v }))} />
          <Stepper label="Finish" value={proj.repFinish || 10} onChange={v => setProj(p => ({ ...p, repFinish: v }))} />
        </div>
      )}

      {sim && (
        <div className="ms-out">
          <div className="ms-line"><span>Dropped scores (full)</span><b className="num">{f1(sim.dropPts)}</b></div>
          <div className="ms-line sub"><span>incl. laps led × {sim.mult.toFixed(1)}</span><span className="num">{f1(sim.lapsLedPts)}</span></div>
          <div className="ms-line"><span>Replacement (finish + net only)</span><b className="num">{f1(sim.repPts)}</b></div>
          <div className="ms-line sub">
            <span>Net position {sim.netCapped ? `(${sim.netRaw > 0 ? "+" : ""}${sim.netRaw} capped)` : ""}</span>
            <span className="num">{sim.net > 0 ? "+" : ""}{sim.net}</span>
          </div>
          <div className={"ms-delta num " + (sim.delta > 0 ? "up" : sim.delta < 0 ? "dn" : "")}>
            {signed(sim.delta)} <small>pts net</small>
          </div>
        </div>
      )}

      {mine ? (
        <button className="ms-go" disabled={!sim || remaining <= 0} onClick={confirm}>
          {remaining <= 0 ? "No mulligans left" : "Confirm Mulligan"}
        </button>
      ) : (
        <div className="ms-note">Preview only — only {PNAME[pid]} can confirm their own mulligan.</div>
      )}
    </div>
  );
}
