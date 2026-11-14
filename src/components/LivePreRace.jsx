import { PLAYERS, PNAME, ACTIVE_PICKS } from "../constants";
import { paintFor } from "../driverPaint";
import { nameKey } from "../driverKey";
import { lastNameOf, splitDriver } from "../engine/draftBoard";
import { getLineups } from "../engine/liveBoard";
import { formatRaceWhen, hasRealRaceTime } from "../engine/racetime";
import { accentOf } from "./LiveBoard";

/**
 * Pre-Race Pit Box — shown when no race is live. Green-flag date, each manager's
 * roster with qualifying start positions, and a Draft Room CTA while lineups are
 * still being set.
 */
export function PreRaceCard({ weekInfo, times, weekPicks, draftState, grid, me, onGoDraft }) {
  const lineups = getLineups(PLAYERS, weekPicks, draftState, ACTIVE_PICKS);
  const allSet = lineups.every(l => l.complete);
  const when = formatRaceWhen(weekInfo, times);
  const realTime = hasRealRaceTime(weekInfo, times);

  return (
    <section className="card lv-pit" aria-label="Pre-race pit box">
      <div className="lv-pit-head">
        <span className="lv-pit-flag"><span className="dot" />GREEN FLAG</span>
        <span className="lv-pit-when num">{when}{!realTime && <em> · time TBC</em>}</span>
      </div>

      {!allSet && (
        <button className="lv-cta" onClick={onGoDraft}>+ Go to Draft Room</button>
      )}

      <div className="lv-pit-sub">
        <span className="label">{allSet ? "Locked-in lineups" : "Lineups"}</span>
        {grid ? <span className="num lv-pit-grid-note">Qualifying set</span> : <span className="lv-pit-grid-note">Start positions post after qualifying</span>}
      </div>

      <div className="lv-pit-grid">
        {lineups.map(l => (
          <div key={l.id} className="lv-pit-mgr" style={{ "--c": accentOf(l.id) }}>
            <div className="lv-pit-mh">
              <span className="dot" />
              <span className="nm">{PNAME[l.id]}{l.id === me && <em>YOU</em>}</span>
              <span className="ct num">{l.drivers.length}/{ACTIVE_PICKS}</span>
            </div>
            {l.drivers.slice(0, ACTIVE_PICKS).map((d, i) => {
              const { num, name } = splitDriver(d);
              const start = grid?.[nameKey(d)];
              return (
                <div key={i} className="lv-pit-d" style={{ "--paint": paintFor(d) }}>
                  <span className="n num">{num}</span>
                  <span className="nm">{lastNameOf(name)}</span>
                  <span className="st num">{start ? `Start P${start}` : "—"}</span>
                </div>
              );
            })}
            {l.drivers.length < ACTIVE_PICKS && (
              <div className="lv-pit-d empty">
                <span className="nm">{l.drivers.length === 0 ? "Lineup not set" : "Still drafting"}</span>
                <span className="st num">{ACTIVE_PICKS - l.drivers.length} to go</span>
              </div>
            )}
          </div>
        ))}
      </div>

    </section>
  );
}
