import { useState, useMemo, useRef, useEffect } from "react";
import { PClr, TTC, TTL } from "../theme";
import { PLAYERS, PNAME, SCHEDULE, DRIVER_INFO, MAKE_COLORS } from "../constants";
import { getWeekTopDrivers, getDriverSeasonStats, getSeasonRecords, getDriverStreaks, getSeasonAwards } from "../engine/stats";
import { getPowerRankings } from "../engine/power";
import {
  SORTS, TRACK_TYPES, leaderboardMetrics, getDriverProfile, getManagerEfficiency, getHeadToHead,
  getTrackSpecialists, getDraftTrends,
} from "../engine/statsView";
import { splitDriver, lastNameOf } from "../engine/draftBoard";
import { paintFor } from "../driverPaint";
import { PowerBoard } from "./PowerBoard";
import { BottomSheet } from "./BottomSheet";

const accentOf = pid => PClr[pid]?.accent || "var(--text-2)";
const f1 = v => (Math.round((v || 0) * 10) / 10).toFixed(1);
const signed = v => (v > 0 ? "+" : "") + (Math.round(v * 10) / 10);
const abbr = pid => PNAME[pid].split(" ")[0].slice(0, 3).toUpperCase();

// ─── Shared bits ──────────────────────────────────────────────────────────────

/** 36×36 number badge with a 3px paint-scheme bar. */
function NumBadge({ driver }) {
  const { num } = splitDriver(driver);
  return <span className="st-badge num" style={{ "--paint": paintFor(driver) }}>{num || "—"}</span>;
}

function MakeTeam({ driver }) {
  const info = DRIVER_INFO[driver] || {};
  const parts = [info.make, info.team].filter(Boolean);
  if (!parts.length) return null;
  return (
    <span className="st-mt">
      {info.make && <b style={{ color: MAKE_COLORS[info.make] || "var(--text-2)" }}>{info.make}</b>}
      {info.make && info.team && " • "}
      {info.team}
    </span>
  );
}

function PickDots({ pickedBy }) {
  const pids = Object.keys(pickedBy || {}).sort((a, b) => pickedBy[b] - pickedBy[a]);
  if (!pids.length) return null;
  return (
    <span className="st-dots" aria-hidden="true">
      {pids.map(pid => <i key={pid} style={{ background: accentOf(pid) }} title={`${PNAME[pid]} ×${pickedBy[pid]}`} />)}
    </span>
  );
}

function Empty({ children }) {
  return <div className="st-empty">{children}</div>;
}

function SecHead({ title, note }) {
  return (
    <div className="st-sec">
      <span className="label">{title}</span>
      {note && <span className="st-sec-note">{note}</span>}
    </div>
  );
}

/** Generic compact driver row used by the specialist / trend lists. */
function MiniRow({ rank, driver, sub, value, unit, onClick, highlight }) {
  const { name } = splitDriver(driver);
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={"st-mrow" + (highlight ? " hl" : "")} onClick={onClick}>
      <span className="rk num">{rank}</span>
      <NumBadge driver={driver} />
      <span className="mid">
        <span className="nm">{name}</span>
        {sub && <span className="sub">{sub}</span>}
      </span>
      <span className="val num">{value}{unit && <small>{unit}</small>}</span>
    </Tag>
  );
}

// ─── Drivers · Leaderboard ────────────────────────────────────────────────────

function DriverSheet({ data, name }) {
  const p = useMemo(() => (name ? getDriverProfile(data, name) : null), [data, name]);
  if (!p) return null;
  return (
    <div className="st-sheet">
      <div className="st-sheet-top">
        <NumBadge driver={name} />
        <div className="mid">
          <div className="nm">{splitDriver(name).name}</div>
          <div className="sub"><MakeTeam driver={name} /></div>
        </div>
      </div>

      <div className="st-kpis">
        <div><span className="num">{f1(p.total)}</span><small>Total</small></div>
        <div><span className="num">{f1(p.avg)}</span><small>Avg</small></div>
        <div><span className="num">{f1(p.best)}</span><small>Best</small></div>
        <div><span className="num">{p.races}</span><small>Races</small></div>
      </div>

      <SecHead title="Track-type splits" note="avg FERDA pts" />
      <div className="st-splits">
        {TRACK_TYPES.map(ty => (
          <div key={ty} className="st-split">
            <span className="ty num" style={{ color: TTC[ty] }}>{TTL[ty]}</span>
            <span className="v num">{p.splits[ty].avg == null ? "—" : f1(p.splits[ty].avg)}</span>
            <span className="r num">{p.splits[ty].races} race{p.splits[ty].races === 1 ? "" : "s"}</span>
          </div>
        ))}
      </div>

      <SecHead title="Drafted most by" />
      {p.drafters.length === 0 ? (
        <div className="st-note">Never drafted this season.</div>
      ) : (
        <div className="st-drafters">
          {p.drafters.map((d, i) => (
            <div key={d.pid} className={"st-drafter" + (i === 0 ? " top" : "")} style={{ "--c": accentOf(d.pid) }}>
              <span className="dot" />
              <span className="nm">{PNAME[d.pid]}</span>
              <span className="num">{d.count}×</span>
              <span className="num sh">{d.share}%</span>
            </div>
          ))}
        </div>
      )}

      <SecHead title="Season race log" note={`${p.log.length} races`} />
      <div className="st-log">
        {p.log.map(r => (
          <div key={r.week} className="st-log-row">
            <span className="w num">W{r.week}</span>
            <span className="ty num" style={{ color: TTC[r.ty] }}>{TTL[r.ty]}</span>
            <span className="rc">{r.track}</span>
            <span className="fin num">{r.dnf ? <em>DNF</em> : `P${r.finish}`}</span>
            <span className="by">{r.pickedBy.map(pid => <i key={pid} style={{ background: accentOf(pid) }} title={PNAME[pid]} />)}</span>
            <span className="pt num">{signed(r.pts)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DriverLeaderboard({ data, driverStats }) {
  const [sortBy, setSortBy] = useState("totalFerdaPts");
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState(null);

  const sorted = useMemo(() => [...driverStats].sort((a, b) => b[sortBy] - a[sortBy]), [driverStats, sortBy]);
  const visible = showAll ? sorted : sorted.slice(0, 15);

  return (
    <div>
      <div className="st-pills" role="group" aria-label="Sort by">
        {SORTS.map(o => (
          <button key={o.key} className="st-pill" aria-pressed={sortBy === o.key} onClick={() => setSortBy(o.key)}>{o.label}</button>
        ))}
      </div>

      <div className="st-list">
        {visible.map((s, i) => {
          const m = leaderboardMetrics(s, sortBy);
          return (
            <button key={s.name} className={"st-card" + (i === 0 ? " lead" : "")} onClick={() => setOpen(s.name)}>
              <span className="rk num">{i + 1}</span>
              <NumBadge driver={s.name} />
              <span className="mid">
                <span className="nm">{splitDriver(s.name).name}</span>
                <span className="sub"><MakeTeam driver={s.name} /></span>
                <span className="sub2">
                  {s.neverPicked
                    ? <span className="st-undrafted">UNDRAFTED</span>
                    : <><PickDots pickedBy={s.pickedBy} /><span className="num">{s.pickCount} pick{s.pickCount === 1 ? "" : "s"}</span></>}
                </span>
              </span>
              <span className="right">
                <span className="pri num">{m.primary}{m.unit && <small> {m.unit}</small>}</span>
                <span className="sec num">{m.secondary}</span>
              </span>
            </button>
          );
        })}
      </div>

      {!showAll && sorted.length > 15 && (
        <button className="st-more" onClick={() => setShowAll(true)}>Show all {sorted.length} drivers ↓</button>
      )}

      <BottomSheet open={!!open} onClose={() => setOpen(null)} title="Driver season">
        {open && <DriverSheet data={data} name={open} />}
      </BottomSheet>
    </div>
  );
}

// ─── Drivers · Track Specialists ──────────────────────────────────────────────

function TrackSpecialists({ data }) {
  const [ty, setTy] = useState("superspeedway");
  const [open, setOpen] = useState(null);
  const list = useMemo(() => getTrackSpecialists(data, ty, { min: 2, n: 10 }), [data, ty]);
  return (
    <div>
      <div className="seg st-tyseg" role="group" aria-label="Track type">
        {TRACK_TYPES.map(t => (
          <button key={t} aria-pressed={ty === t} onClick={() => setTy(t)}>{TTL[t]}</button>
        ))}
      </div>
      <SecHead title={`Best at ${ty.replace("_", " ")} tracks`} note="avg FERDA pts · min 2 races" />
      {list.length === 0 ? <Empty>No races of this type scored yet.</Empty> : (
        <div className="st-list">
          {list.map((d, i) => (
            <MiniRow
              key={d.name} rank={i + 1} driver={d.name} highlight={i === 0} onClick={() => setOpen(d.name)}
              sub={`${d.races} races • ${d.wins}W • ${d.top5} T5 • best ${f1(d.best)}`}
              value={f1(d.avg)} unit=" AVG"
            />
          ))}
        </div>
      )}
      <BottomSheet open={!!open} onClose={() => setOpen(null)} title="Driver season">
        {open && <DriverSheet data={data} name={open} />}
      </BottomSheet>
    </div>
  );
}

// ─── Drivers · Draft Trends ───────────────────────────────────────────────────

function WeeklyTopPerformers({ data }) {
  const weeks = Object.keys(data.results || {})
    .filter(k => data.results[k].raw?.drivers)
    .map(k => parseInt(k.replace("w", ""), 10))
    .sort((a, b) => b - a);

  const [week, setWeek] = useState(weeks[0] || 1);
  const wr = data.results?.["w" + week];
  const topDrivers = useMemo(() => (wr?.raw ? getWeekTopDrivers(wr.raw, week, 8) : []), [wr, week]);

  const weekPicks = data.picks?.["w" + week] || {};
  const pickerMap = {};
  Object.entries(weekPicks).forEach(([pid, picks]) => {
    (picks || []).forEach(pk => { if (pk.driver) (pickerMap[pk.driver] = pickerMap[pk.driver] || []).push(pid); });
  });
  const weekInfo = SCHEDULE.find(s => s.w === week);

  return (
    <div>
      <div className="st-weeks" role="group" aria-label="Week">
        {weeks.map(w => (
          <button key={w} className="st-wk num" aria-pressed={week === w} onClick={() => setWeek(w)}>W{w}</button>
        ))}
      </div>
      {weekInfo && (
        <div className="st-race">
          <b>{weekInfo.r}</b> <span>@ {weekInfo.t}</span>
          <span className="num" style={{ color: TTC[weekInfo.ty] }}>{TTL[weekInfo.ty]}</span>
        </div>
      )}
      <div className="st-list">
        {topDrivers.map((d, i) => {
          const pickers = pickerMap[d.name] || [];
          return (
            <div key={d.name} className={"st-mrow" + (i === 0 ? " hl" : "")}>
              <span className="rk num">{i + 1}</span>
              <NumBadge driver={d.name} />
              <span className="mid">
                <span className="nm">{splitDriver(d.name).name}{i === 0 && <em className="st-mvp">MVP</em>}</span>
                <span className="sub">
                  {pickers.length
                    ? pickers.map(pid => <span key={pid} className="st-own" style={{ "--c": accentOf(pid) }}>{PNAME[pid].toUpperCase()}</span>)
                    : <span className="st-missed">MISSED</span>}
                </span>
              </span>
              <span className="val num">{signed(d.total)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DraftTrends({ data, driverStats }) {
  const t = useMemo(() => getDraftTrends(data, 6), [data]);
  const gems = useMemo(() => driverStats.filter(s => s.neverPicked).sort((a, b) => b.totalFerdaPts - a.totalFerdaPts).slice(0, 5), [driverStats]);
  return (
    <div className="st-stack">
      <section>
        <SecHead title="Most drafted" note="points per pick" />
        <div className="st-list">
          {t.mostDrafted.map((d, i) => (
            <MiniRow key={d.name} rank={i + 1} driver={d.name} sub={`${d.count} picks`} value={f1(d.ppp)} unit=" PPP" />
          ))}
        </div>
      </section>
      <section>
        <SecHead title="First-round favorites" note="a manager's 1st pick" />
        <div className="st-list">
          {t.firstRound.map((d, i) => (
            <MiniRow key={d.name} rank={i + 1} driver={d.name} sub={`Taken first ${d.count}×`} value={d.count} unit="×" />
          ))}
        </div>
      </section>
      <section>
        <SecHead title="Late-round steals" note="best R4 / R5 picks" />
        <div className="st-list">
          {t.lateValue.map((d, i) => (
            <MiniRow key={`${d.name}-${d.week}-${d.pid}`} rank={i + 1} driver={d.name}
              sub={<><span className="st-own" style={{ "--c": accentOf(d.pid) }}>{PNAME[d.pid].toUpperCase()}</span> <span className="num">W{d.week}</span></>}
              value={signed(d.pts)} />
          ))}
        </div>
      </section>
      {gems.length > 0 && (
        <section>
          <SecHead title="Undrafted all season" note="points left on the table" />
          <div className="st-list">
            {gems.map((d, i) => (
              <MiniRow key={d.name} rank={i + 1} driver={d.name} sub={`${d.appearances} races`} value={f1(d.totalFerdaPts)} unit=" TOT" />
            ))}
          </div>
        </section>
      )}
      <section>
        <SecHead title="Weekly top performers" note="drafted or missed" />
        <WeeklyTopPerformers data={data} />
      </section>
    </div>
  );
}

// ─── Managers · Power Rankings ────────────────────────────────────────────────

function PowerRankings({ data }) {
  const rankings = useMemo(() => getPowerRankings(data), [data]);
  return <PowerBoard rankings={rankings} />;
}

// ─── Managers · Efficiency & Loyalty ──────────────────────────────────────────

function ManagerEfficiency({ data }) {
  const eff = useMemo(() => getManagerEfficiency(data), [data]);
  const h2h = useMemo(() => getHeadToHead(data), [data]);
  if (!eff.some(e => e.weeks > 0)) return <Empty>No scored weeks yet.</Empty>;
  const ranked = eff.slice().sort((a, b) => b.avg - a.avg);

  return (
    <div className="st-stack">
      <section>
        <SecHead title="Manager telemetry" note="season to date" />
        <div className="st-mgrs">
          {ranked.map(e => {
            const rod = e.rideOrDie && splitDriver(e.rideOrDie.driver);
            return (
              <div key={e.id} className="st-mgr" style={{ "--c": accentOf(e.id) }}>
                <div className="st-mgr-h"><span className="dot" /><span className="nm">{e.name}</span><span className="wk num">{e.weeks} wks</span></div>
                <div className="st-mgr-k">
                  <div><small>Avg score</small><b className="num">{f1(e.avg)}</b></div>
                  <div><small>R4/R5 pts</small><b className="num">{f1(e.lateRoundPts)}</b><i className="num">{f1(e.lateRoundAvg)}/wk</i></div>
                  <div><small>DNF rate</small><b className="num">{f1(e.dnfRate)}%</b><i className="num">{e.dnfs} of {e.starts}</i></div>
                </div>
                {rod && (
                  <div className="st-rod" title={e.rideOrDie.driver}>
                    <span className="lbl">RIDE OR DIE</span>
                    <span className="d"><span className="num">#{rod.num}</span> {lastNameOf(rod.name)}</span>
                    <span className="num m">{e.rideOrDie.count}× • {f1(e.rideOrDie.pts)} pts</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="st-note">R4/R5 = points from each week's 4th and 5th draft slots. DNF rate counts drivers who started.</div>
      </section>

      <section>
        <SecHead title="Head-to-head" note="weekly record, row vs column" />
        <div className="st-h2h" role="table" aria-label="Head-to-head weekly records">
          <div className="st-h2h-r hd" role="row">
            <span role="columnheader" />
            {PLAYERS.map(p => <span key={p.id} role="columnheader" className="num" style={{ color: accentOf(p.id) }}>{abbr(p.id)}</span>)}
          </div>
          {PLAYERS.map(a => (
            <div key={a.id} className="st-h2h-r" role="row">
              <span role="rowheader" className="rh"><i style={{ background: accentOf(a.id) }} />{PNAME[a.id]}</span>
              {PLAYERS.map(b => {
                if (a.id === b.id) return <span key={b.id} role="cell" className="self">—</span>;
                const r = h2h[a.id][b.id];
                const tone = r.w > r.l ? "up" : r.w < r.l ? "dn" : "";
                return (
                  <span key={b.id} role="cell" className={"num " + tone} title={`${PNAME[a.id]} vs ${PNAME[b.id]}: ${r.w}-${r.l}${r.t ? `-${r.t}` : ""}`}>
                    {r.w}-{r.l}{r.t ? <small>-{r.t}</small> : null}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Managers · Awards & Streaks ──────────────────────────────────────────────

function AwardCard({ emoji, title, tone, children }) {
  return (
    <div className="st-award" style={{ "--c": tone }}>
      <div className="t">{emoji} {title}</div>
      {children}
    </div>
  );
}

function SeasonRecords({ data, records }) {
  const { bestPlayerWeek, bestDriverPerf, winStreaks, currentStreaks } = records;
  const wins = Object.fromEntries(
    PLAYERS.map(p => [p.id, Object.values(data.results || {}).filter(r => r.scored?.[p.id]?.weeklyWin).length])
  );
  return (
    <div className="st-awards">
      {bestPlayerWeek && (
        <AwardCard emoji="🏆" title="Best player week" tone="var(--gold)">
          <div className="big num">{f1(bestPlayerWeek.score)}</div>
          <div className="who" style={{ color: accentOf(bestPlayerWeek.pid) }}>{PNAME[bestPlayerWeek.pid]} <span className="num">· W{bestPlayerWeek.week}</span></div>
          {bestPlayerWeek.race && <div className="fine">{bestPlayerWeek.race}</div>}
        </AwardCard>
      )}
      {bestDriverPerf && (
        <AwardCard emoji="🚗" title="Best driver performance" tone="var(--gold)">
          <div className="big num">{f1(bestDriverPerf.score)}</div>
          <div className="who">{bestDriverPerf.name} <span className="num">· W{bestDriverPerf.week}</span></div>
          <div className="fine">
            {bestDriverPerf.pickedBy.length
              ? bestDriverPerf.pickedBy.map(pid => <span key={pid} className="st-own" style={{ "--c": accentOf(pid) }}>{PNAME[pid].toUpperCase()}</span>)
              : <span className="st-missed">NOT PICKED</span>}
          </div>
        </AwardCard>
      )}
      <div className="st-wins">
        {PLAYERS.map(p => (
          <div key={p.id} className="st-win" style={{ "--c": accentOf(p.id) }}>
            <span className="nm">{PNAME[p.id]}</span>
            <span className="w num">{wins[p.id]}<small> W</small></span>
            <span className="s num">
              Best run {winStreaks[p.id]}
              {currentStreaks[p.id] > 0 && <em> • 🔥 on {currentStreaks[p.id]}</em>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeasonAwards({ data }) {
  const awards = useMemo(() => getSeasonAwards(data), [data]);
  if (!awards) return <Empty>Need at least 2 scored races to generate awards.</Empty>;
  const { consistencyKing, sleeperHit, eyeOfTiger, comebackKing, bestMulligan, biggestBust } = awards;
  return (
    <div className="st-awards">
      {consistencyKing && (
        <AwardCard emoji="🎯" title="Consistency King" tone="#3b82f6">
          <div className="who big2" style={{ color: accentOf(consistencyKing.pid) }}>{PNAME[consistencyKing.pid]}</div>
          <div className="fine num">Avg {consistencyKing.mean} pts · σ {consistencyKing.stddev} over {consistencyKing.weeks} races</div>
          <div className="fine">Tightest week-to-week spread</div>
        </AwardCard>
      )}
      {sleeperHit && (
        <AwardCard emoji="😴" title="Sleeper Hit" tone="#8b5cf6">
          <div className="who big2">{sleeperHit.name}</div>
          <div className="fine num"><b>+{sleeperHit.score} pts</b> · W{sleeperHit.week}{sleeperHit.race ? ` · ${sleeperHit.race}` : ""}</div>
          <div className="fine">Nobody picked them — free points left on the table</div>
        </AwardCard>
      )}
      {eyeOfTiger && (
        <AwardCard emoji="👁️" title="Eye of the Tiger" tone="#f59e0b">
          <div className="who big2" style={{ color: accentOf(eyeOfTiger.pid) }}>{PNAME[eyeOfTiger.pid]}</div>
          <div className="fine num">Had the race winner in <b>{eyeOfTiger.count}</b> race{eyeOfTiger.count !== 1 ? "s" : ""}</div>
          <div className="fine">Best at drafting winners</div>
        </AwardCard>
      )}
      {comebackKing && (
        <AwardCard emoji="⬆️" title="Comeback King" tone="#10b981">
          <div className="who big2">{comebackKing.name}</div>
          <div className="fine num">P{comebackKing.qualPos} → P{comebackKing.finish} (<b>+{comebackKing.gain} spots</b>)</div>
          {comebackKing.race && <div className="fine num">{comebackKing.race} · W{comebackKing.week}</div>}
        </AwardCard>
      )}
      {bestMulligan && (
        <AwardCard emoji="🔀" title="Best Mulligan" tone="#ec4899">
          <div className="who big2" style={{ color: accentOf(bestMulligan.pid) }}>{PNAME[bestMulligan.pid]}</div>
          <div className="fine num">
            {bestMulligan.origDriver} ({signed(bestMulligan.origScore)}) → {bestMulligan.newDriver} ({signed(bestMulligan.newScore)})
          </div>
          <div className="fine num"><b>+{bestMulligan.gain} pts gained</b> · W{bestMulligan.week}</div>
        </AwardCard>
      )}
      {biggestBust && (
        <AwardCard emoji="💩" title="Biggest Bust" tone="#ef4444">
          <div className="who big2" style={{ color: accentOf(biggestBust.pid) }}>{PNAME[biggestBust.pid]}</div>
          <div className="fine num">Started {biggestBust.name} for <b>{biggestBust.score} pts</b> · W{biggestBust.week}</div>
          {biggestBust.race && <div className="fine">{biggestBust.race}</div>}
          <div className="fine">The pick nobody wants to talk about</div>
        </AwardCard>
      )}
    </div>
  );
}

function HotStreaks({ data }) {
  const streaks = useMemo(() => getDriverStreaks(data), [data]);
  if (!streaks.length) return <Empty>No active streaks yet — check back after more races are scored.</Empty>;
  return (
    <div>
      <div className="st-note" style={{ marginTop: 0 }}>Drivers on a current hot streak entering the next race. 🔥 consecutive top-5s · 🌶️ consecutive top-10s</div>
      <div className="st-list">
        {streaks.map((s, i) => {
          const hot5 = s.top5 >= 2;
          return (
            <div key={s.name} className={"st-mrow" + (i === 0 ? " hl" : "")}>
              <span className="rk" aria-hidden="true">{hot5 ? "🔥" : "🌶️"}</span>
              <NumBadge driver={s.name} />
              <span className="mid">
                <span className="nm">{splitDriver(s.name).name}</span>
                <span className="sub">{hot5 ? `${s.top5} straight top-5${s.top5 !== 1 ? "s" : ""}` : `${s.top10} straight top-10${s.top10 !== 1 ? "s" : ""}`}</span>
              </span>
              <span className="val num" style={{ color: hot5 ? "var(--caution)" : "var(--go)" }}>{hot5 ? s.top5 : s.top10}<small>{hot5 ? "× T5" : "× T10"}</small></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AwardsStreaks({ data, records }) {
  return (
    <div className="st-stack">
      <section><SecHead title="Season records" /><SeasonRecords data={data} records={records} /></section>
      <section><SecHead title="Season awards" /><SeasonAwards data={data} /></section>
      <section><SecHead title="Hot streaks" note="drivers" /><HotStreaks data={data} /></section>
    </div>
  );
}

// ─── Main StatsTab ────────────────────────────────────────────────────────────

const TIERS = [
  { id: "managers", label: "Managers (FRL)", subs: [
    { id: "power",      label: "Power Rankings" },
    { id: "efficiency", label: "Manager Efficiency" },
    { id: "awards",     label: "Awards & Streaks" },
  ] },
  { id: "drivers", label: "Drivers (Cup)", subs: [
    { id: "leaderboard", label: "Leaderboard" },
    { id: "tracks",      label: "Track Specialists" },
    { id: "trends",      label: "Draft Trends" },
  ] },
];

export function StatsTab({ data }) {
  const [tier, setTier] = useState("drivers");
  const [sub, setSub] = useState({ managers: "power", drivers: "leaderboard" });
  const stripRef = useRef(null);

  const driverStats = useMemo(() => getDriverSeasonStats(data), [data]);
  const records     = useMemo(() => getSeasonRecords(data),     [data]);
  const scoredWeeks = Object.keys(data.results || {}).filter(k => data.results[k].raw?.drivers).length;

  const t = TIERS.find(x => x.id === tier);
  const active = sub[tier];

  // keep the active secondary filter in view if the strip ever has to scroll
  useEffect(() => {
    stripRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [tier, active]);

  return (
    <div className="st">
      <header className="st-head">
        <h2>Stats</h2>
        <div className="st-meta num">{scoredWeeks} races • {driverStats.length} drivers • FERDA scoring</div>
      </header>

      <div className="seg st-tier" role="tablist" aria-label="Stats category">
        {TIERS.map(x => (
          <button key={x.id} role="tab" aria-selected={tier === x.id} aria-pressed={tier === x.id} onClick={() => setTier(x.id)}>{x.label}</button>
        ))}
      </div>

      <div className="st-strip" ref={stripRef} role="tablist" aria-label={`${t.label} views`}>
        {t.subs.map(s => (
          <button key={s.id} role="tab" aria-selected={active === s.id} aria-pressed={active === s.id}
                  onClick={() => setSub(v => ({ ...v, [tier]: s.id }))}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="st-body">
        {tier === "drivers" && active === "leaderboard" && <DriverLeaderboard data={data} driverStats={driverStats} />}
        {tier === "drivers" && active === "tracks"      && <TrackSpecialists data={data} />}
        {tier === "drivers" && active === "trends"      && <DraftTrends data={data} driverStats={driverStats} />}
        {tier === "managers" && active === "power"      && <PowerRankings data={data} />}
        {tier === "managers" && active === "efficiency" && <ManagerEfficiency data={data} />}
        {tier === "managers" && active === "awards"     && <AwardsStreaks data={data} records={records} />}
      </div>

      <div className="st-foot">
        All scores use FERDA rules (full scoring, not mulligan). "Times Picked" counts each pick across all 4 players. Tap a driver for their season.
      </div>
    </div>
  );
}
