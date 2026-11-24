import { useState, useMemo, useEffect, useRef, createContext, useContext } from "react";
import { PClr } from "../theme";
import { PNAME, SCHEDULE, TRACK_MULTS, ACTIVE_PICKS, isMemorial } from "../constants";
import { getWeekTopDrivers, generateWeekRecap } from "../engine/stats";
import { storeFor } from "../engine/events";
import { CLASH_WEEK, ALL_STAR_WEEK, weekLabel, weekName } from "../exhibitions";
import { allStarPayouts } from "../engine/meta";
import { getGmRatings } from "../utils/gmRating";
import { BestValueLine } from "./GmBoard";
import { wireRecap } from "../engine/wire";
import { TrackGlyph, TrackSpecLine, auraProps } from "./TrackIdentity";
import { optimalLineup } from "../engine/whatIf";
import { renderRecapCard, shareBlob } from "../utils/shareCard";
import { haptic } from "../utils/haptics";
import { DriverTelemetryCard } from "./DriverTelemetryCard";
import { useDriverCard, tapProps } from "../hooks/useDriverCard";
import { pushToast } from "../utils/toast";
import {
  scoredWeeks, weekWinners, stepWeek, buildOwnerMap, carKey, parseDriver,
  getRaceFacts, leagueAverage, getSuperlatives, fmtPts, TRACK_ARCHETYPE,
} from "../engine/resultsView";

// ─── Point-breakdown tags (unchanged colours / labels) ───────────────────────
const BONUS_CHIP = {
  "Top 5":    "#10b981", "Top 10":   "#10b981",
  "Pole":     "#f59e0b", "S1 Win":   "#f59e0b", "S2 Win": "#f59e0b", "S3 Win": "#f59e0b",
  "Fast Lap": "#8b5cf6", "Most Led": "#3b82f6",
  "SWEEP!":   "#f59e0b", "Led a lap":"#6B7280",
  "DNF":      "#949BA8", "DQ":       "#ef4444",
};

// Opens the telemetry card for a driver (null in Simplified Mode, where rows stay plain text).
const OpenCtx = createContext(null);

function ScoreChip({ label, pts }) {
  const col = BONUS_CHIP[label] || (pts > 0 ? "#10b981" : pts < 0 ? "#ef4444" : "#6B7280");
  const short = label === "SWEEP!" ? "💫 SWEEP" : label;
  return (
    <span className="rs-chip" style={{ "--c": col }}>
      {short}
      {pts !== 0 && <span className="num rs-chip-pts">{pts > 0 ? "+" : ""}{pts}</span>}
    </span>
  );
}

function DriverResultRow({ d, tag }) {
  const open = useContext(OpenCtx);
  const { num, name } = parseDriver(d.driver);
  const tone = d.total >= 40 ? " big" : d.total < 0 ? " neg" : d.total > 0 ? " pos" : "";
  return (
    <div className={`rs-drv${tone}${d.dnr ? " dnr" : ""}`} {...tapProps(open, d.driver)}>
      <div className="rs-drv-main">
        <div className="rs-drv-name">
          {num && <span className="num rs-dnum">#{num}</span>}
          {name}
          {isMemorial(d.driver) && " 🕊️"}
          {d.isMulligan && <span className="rs-tag amber">MULL</span>}
          {d.dnr && <span className="rs-tag">DNR</span>}
          {tag === "steal" && <span className="rs-tag gm-steal" title="Out-scored its pick-slot expectation by a wide margin">💎 STEAL</span>}
          {tag === "bust" && <span className="rs-tag gm-bust" title="Round 1–2 pick that fell well short of its slot">📉 BUST</span>}
        </div>
        <div className="rs-chips">
          {(d.breakdown || []).map((b, i) => <ScoreChip key={i} label={b.label} pts={b.pts} />)}
        </div>
      </div>
      <div className="num rs-drv-pts">{d.total > 0 ? "+" : ""}{d.total}</div>
    </div>
  );
}

// ─── Post-race inspection grade (unchanged thresholds) ───────────────────────
function getGrade(pct) {
  if (pct >= 0.90) return { grade:"A", color:"#10b981" };
  if (pct >= 0.75) return { grade:"B", color:"#3b82f6" };
  if (pct >= 0.60) return { grade:"C", color:"#f59e0b" };
  if (pct >= 0.45) return { grade:"D", color:"#ef4444" };
  return { grade:"F", color:"#dc2626" };
}

const GradeStamp = ({ grade, color, title }) => (
  <span className="rs-grade num" style={{ "--c": color }} title={title} aria-label={`Inspection grade ${grade}`}>{grade}</span>
);

const CrownIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5L3 8z" />
    <rect x="5" y="19.2" width="14" height="1.8" rx="0.6" />
  </svg>
);
const Chevron = () => (
  <svg className="rs-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

// ─── 1. Week scrubber ────────────────────────────────────────────────────────
function WeekScrubber({ weeks, week, onSelect, winners }) {
  const strip = useRef(null);
  const first = useRef(true);

  // keep the selected pill centred in the strip (without scrolling the page)
  useEffect(() => {
    const box = strip.current;
    const el = box?.querySelector('[aria-current="true"]');
    if (!box || !el) return;
    box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2, behavior: first.current ? "auto" : "smooth" });
    first.current = false;
  }, [week]);

  const prev = stepWeek(weeks, week, -1);
  const next = stepWeek(weeks, week, 1);

  return (
    <div className="rs-scrub">
      <button className="rs-step" disabled={prev == null} onClick={() => prev != null && onSelect(prev)} aria-label="Earlier week">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <div className="rs-strip" ref={strip} role="tablist" aria-label="Race week">
        {weeks.map(w => {
          const wp = winners[w];
          return (
            <button
              key={w} role="tab" className="rs-wk num"
              aria-current={w === week} aria-selected={w === week}
              aria-label={`${weekName(w)}${wp ? `, won by ${PNAME[wp]}` : ""}`}
              onClick={() => onSelect(w)}
            >
              {weekLabel(w)}
              {wp && <i className="rs-wk-dot" style={{ background: PClr[wp]?.accent }} />}
            </button>
          );
        })}
      </div>
      <button className="rs-step" disabled={next == null} onClick={() => next != null && onSelect(next)} aria-label="Later week">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  );
}

// ─── 2. Post-race timing sheet header ────────────────────────────────────────
function OwnerTag({ pids }) {
  if (!pids?.length) return null;
  return <span className="rs-gold-tag">★ {pids.map(p => PNAME[p]).join(", ")}</span>;
}

function DriverText({ name }) {
  const { num, name: nm } = parseDriver(name);
  return <>{num && <span className="num">#{num} </span>}{nm}</>;
}

function RaceInfoCard({ week, weekInfo, wr, facts, ownerMap, avg }) {
  const exhibition = !!weekInfo?.ex;
  const poleChip = facts.pole
    ? { label: "Pole winner", value: facts.pole }
    : facts.stageWinners.length
      ? { label: "Stage winners", text: facts.stageWinners.map(s => `S${s.stage} #${carKey(s.name)}`).join(" · ") }
      : { label: "Pole winner" };

  return (
    <section className="rs-info" aria-label="Race information" {...auraProps(weekInfo?.ty)}>
      <div className="rs-checker" aria-hidden="true" />
      <div className="rs-info-top">
        <div className="rs-info-id">
          <div className="rs-eyebrow">{weekName(week)} · Official results</div>
          <h2 className="rs-race">{weekInfo?.r || weekName(week)}</h2>
          <TrackSpecLine ty={weekInfo?.ty} track={weekInfo?.t} className="rs-specline" />
          {(wr?.raw?.threeStages || exhibition) && (
            <div className="rs-trackline">
              {wr?.raw?.threeStages && <span className="rs-arch">3 stages</span>}
              {exhibition && <span className="rs-arch gold">Exhibition · not in standings</span>}
            </div>
          )}
        </div>
        <div className="rs-logo td-slot" data-slot="track-logo"><TrackGlyph ty={weekInfo?.ty} /></div>
      </div>

      <div className="rs-facts">
        <div className="rs-fact">
          <div className="l">Race winner</div>
          <div className="v">{facts.winner ? <DriverText name={facts.winner} /> : "—"}</div>
          {facts.winner && <OwnerTag pids={ownerMap[carKey(facts.winner)]} />}
        </div>
        <div className="rs-fact">
          <div className="l">{poleChip.label}</div>
          <div className="v">{poleChip.value ? <DriverText name={poleChip.value} /> : poleChip.text ? <span className="num">{poleChip.text}</span> : "—"}</div>
          {poleChip.value && <OwnerTag pids={ownerMap[carKey(poleChip.value)]} />}
        </div>
        <div className="rs-fact">
          <div className="l">Race action</div>
          <div className="v num">{facts.leaders ? `${facts.leaders} leader${facts.leaders === 1 ? "" : "s"}` : "—"}</div>
          <div className="s num">{facts.dnfs ? `${facts.dnfs} DNF` : "No DNFs"}</div>
        </div>
        <div className="rs-fact">
          <div className="l">League avg score</div>
          <div className="v num">{avg == null ? "—" : `${avg.toFixed(1)} PTS`}</div>
        </div>
      </div>
    </section>
  );
}

// ─── 3. Takeaways & superlatives ─────────────────────────────────────────────
function Owner({ pid }) {
  return (
    <span className="rs-owner">
      <i className="dot" style={{ background: PClr[pid]?.accent, width: 6, height: 6 }} />{PNAME[pid]}
    </span>
  );
}

function TakeawaysCard({ week, recap, sup }) {
  const items = [
    sup.mvp && {
      key: "mvp", label: "🏆 MVP PICK",
      body: <><DriverText name={sup.mvp.driver} /> <b className="num pos">{fmtPts(sup.mvp.total)}</b> • <Owner pid={sup.mvp.pid} /></>,
    },
    sup.heartbreaker && {
      key: "heart", label: "💣 HEARTBREAKER",
      body: <><DriverText name={sup.heartbreaker.driver} /> <b className={`num ${sup.heartbreaker.total < 0 ? "neg" : ""}`}>{sup.heartbreaker.total} pts</b>
        {sup.heartbreaker.dnf && <span className="rs-tag">DNF</span>} • <Owner pid={sup.heartbreaker.pid} /></>,
    },
    sup.bestUndrafted && {
      key: "undrafted", label: "🧠 BEST UNDRAFTED",
      body: <><DriverText name={sup.bestUndrafted.driver} /> <b className="num pos">{fmtPts(sup.bestUndrafted.total)}</b> <span className="rs-muted">• nobody had them</span></>,
    },
    sup.margin && {
      key: "margin", label: "📏 MARGIN",
      body: <>{PNAME[sup.margin.pid]} won by <b className="num">+{sup.margin.pts.toFixed(1)} pts</b></>,
    },
  ].filter(Boolean);

  if (!recap && !items.length) return null;
  return (
    <section className="rs-take" aria-label="Race week takeaways">
      <div className="label">Race week takeaways</div>

      {recap && (
        <p className="rs-recap">
          <b className="rs-recap-lead">{weekLabel(week)} recap —</b>{" "}
          <b>{PNAME[recap.winnerPid]}</b> wins with <b className="num">{recap.winnerScore} pts</b>
          {recap.hadWinner && <span> (had race winner {recap.raceWinner})</span>}.{" "}
          {recap.mvpDriver && (
            <>
              <span className="rs-recap-drv">{recap.mvpDriver}</span> scored{" "}
              <b className={`num ${recap.mvpWasPicked ? "pos" : "neg"}`}>{recap.mvpScore} pts</b>{" "}
              — {recap.mvpWasPicked
                ? <span className="pos">someone cashed in ✓</span>
                : <span className="neg">nobody had them 😤</span>}.
            </>
          )}
        </p>
      )}

      {items.length > 0 && (
        <div className="rs-sups">
          {items.map(it => (
            <div key={it.key} className={`rs-sup ${it.key}`}>
              <div className="l">{it.label}</div>
              <div className="b">{it.body}</div>
            </div>
          ))}
        </div>
      )}

      {recap?.roastLine && <div className="rs-roast">💩 {recap.roastLine}</div>}
    </section>
  );
}

// ─── 4. Player cards ─────────────────────────────────────────────────────────
function PlayerBadges({ pid, ps, idx, count, isAllStar, isClash, allStarPay }) {
  const lastOfFour = idx === count - 1 && count === 4;
  const bits = [
    isAllStar && <span key="as" className="rs-badge gold">+{allStarPay[pid] ?? 0} PLAYOFF PTS</span>,
    !isAllStar && ps.weeklyWin && <span key="ww" className="rs-badge">{isClash ? "CLASH WINNER" : "WEEKLY WIN +25 PO"}</span>,
    isClash && lastOfFour && <span key="cl" className="rs-badge green">PICKS 1ST IN W1</span>,
    !isClash && !isAllStar && ps.bonusPoints > 0 && <span key="bp" className="rs-bonus num">{ps.bonusPoints} bonus pts</span>,
  ].filter(Boolean);
  return bits.length ? <div className="rs-badges">{bits}</div> : null;
}

function DriverList({ ps, tags }) {
  if (!ps.drivers?.length) return null;
  return (
    <div className="rs-drvs">
      {ps.drivers.slice().sort((a, b) => b.total - a.total).map(d => <DriverResultRow key={d.driver} d={d} tag={tags?.[d.driver]} />)}
    </div>
  );
}

/** "Optimal 5" hindsight ghost: best lineup available at this manager's real draft slots. */
function OptimalGhost({ ghost }) {
  const [show, setShow] = useState(false);
  if (!ghost) return null;
  return (
    <div className="rs-ghost">
      <button className="rs-ghost-tog" aria-pressed={show} onClick={e => { e.stopPropagation(); setShow(v => !v); }}>
        {show ? "Hide Optimal 5" : "Show Optimal 5"}
        <span className="num">{ghost.left > 0 ? `+${ghost.left.toFixed(1)} left on the pit box` : "Perfect pit box"}</span>
      </button>
      {show && (
        <div className="rs-ghost-list">
          {ghost.picks.map(g => {
            const hit = g.driver === g.actualDriver || (g.driver && g.actualDriver && g.driver.split(" ")[0] === g.actualDriver.split(" ")[0]);
            return (
              <div key={g.k} className={"rs-ghost-row" + (hit ? " hit" : "")}>
                <span className="slot num">#{g.k} · R{g.round}</span>
                <span className="nm">{g.driver ? <DriverText name={g.driver} /> : "—"}{!hit && g.actualDriver && <small>you: {g.actualDriver.replace(/^#S+s+/, "")} {g.actualPts.toFixed(1)}</small>}</span>
                <span className="pt num">{g.pts.toFixed(1)}</span>
              </div>
            );
          })}
          <div className="rs-ghost-foot num">Optimal {ghost.total.toFixed(1)} vs your picks {ghost.actual.toFixed(1)} (full scoring, before mulligans)</div>
        </div>
      )}
    </div>
  );
}

/** Weekly GM chip shown beside the inspection grade. */
const GmChip = ({ gmw }) => gmw
  ? <span className="rs-gm num" title={`Pit-Box GM score: VOPE ${gmw.vopeScore} · Scouting ${gmw.scouting} · Floor ${gmw.execution} · Finish ${gmw.finish}`}>{gmw.gm.toFixed(1)} <small>GM</small></span>
  : null;

function MiniChips({ ps }) {
  return (
    <div className="rs-minis" aria-hidden="true">
      {(ps.drivers || []).slice().sort((a, b) => b.total - a.total).map(d => {
        const tone = d.dnr ? "dnr" : d.total >= 40 ? "big" : d.total <= 0 ? "neg" : "";
        const { num } = parseDriver(d.driver);
        return <span key={d.driver} className={`rs-mini num ${tone}`} title={`${d.driver} ${d.total}`}>{num ? `#${num}` : "—"}</span>;
      })}
    </div>
  );
}

function PlayerCard({ pid, ps, idx, count, isOpen, onToggle, perfectScore, ctx, gmw, tags, ghost }) {
  const isWinner = idx === 0 && count > 1;
  const isLoser  = idx === count - 1 && count === 4;
  const g = perfectScore > 0 ? getGrade(ps.total / perfectScore) : { grade: "—", color: "#6B7280" };
  const gradeTitle = perfectScore > 0 ? `${Math.round((ps.total / perfectScore) * 100)}% of the week's top-5 drivers` : "";

  if (idx === 0) {
    return (
      <article className={`rs-card${isWinner ? " win" : ""}`}>
        <div className="rs-card-head">
          <span className="rs-crown">{isWinner ? <CrownIcon /> : null}</span>
          <div className="rs-who">
            <div className="rs-name"><i className="dot" style={{ background: PClr[pid].accent, width: 8, height: 8 }} />{PNAME[pid]}</div>
            <PlayerBadges pid={pid} ps={ps} idx={idx} count={count} {...ctx} />
          </div>
          <div className="rs-score">
            <span className="num rs-total">{ps.total}</span>
            {perfectScore > 0 && <GradeStamp grade={g.grade} color={g.color} title={gradeTitle} />}
            <GmChip gmw={gmw} />
          </div>
        </div>
        {gmw?.bestValue && <BestValueLine bv={gmw.bestValue} />}
        <DriverList ps={ps} tags={tags} />
        <div style={{ padding: "0 10px 10px" }}><OptimalGhost ghost={ghost} /></div>
      </article>
    );
  }

  return (
    <article className={`rs-card compact${isOpen ? " open" : ""}`}>
      <button className="rs-sum" aria-expanded={isOpen} onClick={onToggle}>
        <div className="rs-sum-top">
          <span className="num rs-rank">{idx + 1}</span>
          <span className="rs-name"><i className="dot" style={{ background: PClr[pid].accent, width: 8, height: 8 }} />{PNAME[pid]}{isLoser && <span className="rs-poop" title="Last place">💩</span>}</span>
          <span className="rs-score">
            <span className="num rs-total">{ps.total}</span>
            {perfectScore > 0 && <GradeStamp grade={g.grade} color={g.color} title={gradeTitle} />}
            <GmChip gmw={gmw} />
            <Chevron />
          </span>
        </div>
        <MiniChips ps={ps} />
        {gmw?.bestValue && <BestValueLine bv={gmw.bestValue} />}
      </button>
      <div className="rs-acc"><div>
        <div className="rs-detail">
          <PlayerBadges pid={pid} ps={ps} idx={idx} count={count} {...ctx} />
          <DriverList ps={ps} tags={tags} />
          <OptimalGhost ghost={ghost} />
        </div>
      </div></div>
    </article>
  );
}

// ─── 5. Top performers ───────────────────────────────────────────────────────
function TopPerformers({ topDrivers, ownerMap }) {
  const open = useContext(OpenCtx);
  if (!topDrivers.length) return null;
  return (
    <section className="rs-top" aria-label="Top performers this week">
      <div className="sec-head" style={{ margin: "2px 2px 8px" }}>
        <span className="label">Top performers this week</span>
      </div>
      <div className="rs-top-list">
        {topDrivers.map((d, i) => {
          const owners = ownerMap[carKey(d.name)] || [];
          return (
            <div key={d.name} className={`rs-top-row${i === 0 ? " first" : ""}`} {...tapProps(open, d.name)}>
              <span className="num rs-top-rank">{i + 1}</span>
              <span className="rs-top-name"><DriverText name={d.name} /></span>
              <span className="rs-top-owner">
                {owners.length
                  ? owners.map(pid => <span key={pid} className="rs-owner"><i className="dot" style={{ background: PClr[pid]?.accent, width: 7, height: 7 }} />{PNAME[pid]}</span>)
                  : <span className="rs-badge red">UNDRAFTED</span>}
              </span>
              <span className="num rs-top-pts">{fmtPts(d.total)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Tab ─────────────────────────────────────────────────────────────────────
export function ResultsTab({ data, player }) {
  const card = useDriverCard(player, data);
  // Scored events oldest → newest, in schedule order (so the Clash / All-Star sit
  // where they actually ran). Opens on the newest.
  const weeks   = useMemo(() => scoredWeeks(data), [data]);
  const winners = useMemo(() => weekWinners(data), [data]);
  const [week, setWeek] = useState(weeks[weeks.length - 1] ?? 1);
  const [open, setOpen] = useState({});                 // pid → expanded (2nd–4th place cards)

  const src       = storeFor(data, week);
  const isClash   = week === CLASH_WEEK;
  const isAllStar = week === ALL_STAR_WEEK;
  const wr        = src.results?.["w" + week];
  const weekInfo  = SCHEDULE.find(s => s.w === week);
  const sorted    = wr?.scored ? Object.entries(wr.scored).sort((a, b) => b[1].total - a[1].total) : [];
  const allStarPay = isAllStar && wr?.scored ? allStarPayouts(wr.scored) : {};

  useEffect(() => { setOpen({}); }, [week]);            // each week starts in the default view

  // Top performers (all drivers, not just picked ones) + perfect score for grading
  const topDrivers = useMemo(
    () => (wr?.raw?.drivers ? getWeekTopDrivers(wr.raw, week, ACTIVE_PICKS) : []),
    [wr, week]
  );
  const perfectScore = useMemo(() => topDrivers.reduce((sum, d) => sum + d.total, 0), [topDrivers]);

  const weekPicks = src.picks?.["w" + week];
  const gm       = useMemo(() => getGmRatings(data), [data]);
  const gmWeek   = gm.byWeek[week] || null;          // points weeks only (not exhibitions)
  const gmTags   = useMemo(() => {
    const out = {};
    (gmWeek?.picks || []).forEach(p => {
      const t = p.steal ? "steal" : p.bust ? "bust" : null;
      if (t) (out[p.pid] = out[p.pid] || {})[p.driver] = t;
    });
    return out;
  }, [gmWeek]);
  const ownerMap = useMemo(() => buildOwnerMap(wr?.scored, weekPicks), [wr, weekPicks]);
  const facts    = useMemo(() => getRaceFacts(wr?.raw), [wr]);
  const avg      = useMemo(() => leagueAverage(wr?.scored), [wr]);
  const sup      = useMemo(() => getSuperlatives(wr?.scored, wr?.raw, week, weekPicks), [wr, week, weekPicks]);
  const recap    = useMemo(
    () => (wr?.scored && wr?.raw ? generateWeekRecap(week, wr.scored, wr.raw) : null),
    [wr, week]
  );

  const wire   = useMemo(() => (wr?.scored && wr?.raw ? wireRecap(week, wr.scored, wr.raw) : []), [wr, week]);
  const ghosts = useMemo(() => Object.fromEntries(sorted.map(([pid]) => [pid, optimalLineup(data, week, pid)])), [data, week, wr]); // eslint-disable-line react-hooks/exhaustive-deps
  const [sharing, setSharing] = useState(false);
  const shareRecap = async () => {
    if (!sorted.length || sharing) return;
    setSharing(true);
    try {
      const mvp = topDrivers[0];
      const blob = await renderRecapCard({
        weekLabel: weekName(week), raceName: weekInfo?.r || weekName(week), track: weekInfo?.t,
        archetype: weekInfo ? `${TRACK_ARCHETYPE[weekInfo.ty] || weekInfo.ty} ×${TRACK_MULTS[weekInfo.ty]?.toFixed(1)}` : "",
        standings: sorted.map(([pid, ps]) => ({ pid, total: ps.total })),
        mvp: mvp ? { name: mvp.name, total: mvp.total, owners: ownerMap[carKey(mvp.name)] || [] } : null,
        roast: recap?.roastLine, wire,
      });
      const how = await shareBlob(blob, { filename: `ferda-${weekLabel(week).toLowerCase()}-recap.png`, title: `FERDA ${weekName(week)} recap`, text: wire.join(" ") });
      if (how !== "cancelled") { haptic(15); pushToast({ title: how === "shared" ? "Recap shared" : "Recap card saved", body: weekInfo?.r || weekName(week), tone: "go", ttl: 3500 }); }
    } catch (e) {
      pushToast({ title: "Couldn't build the recap card", body: e.message, tone: "stop" });
    } finally {
      setSharing(false);
    }
  };

  const foldable = sorted.slice(1).map(([pid]) => pid);
  const allOpen  = foldable.length > 0 && foldable.every(pid => open[pid]);
  const toggleAll = () => setOpen(allOpen ? {} : Object.fromEntries(foldable.map(pid => [pid, true])));
  const ctx = { isAllStar, isClash, allStarPay };

  if (!weeks.length) {
    return <div className="rs"><div className="rs-empty">No results yet</div></div>;
  }

  return (
    <OpenCtx.Provider value={card.open}>
    <div className="rs">
      <div className="rs-top-bar">
        <span className="label">Results</span>
        <span className="rs-top-right">
          {sorted.length > 0 && (
            <button className="rs-share" onClick={shareRecap} disabled={sharing}>{sharing ? "Rendering…" : "Share Recap"}</button>
          )}
          <span className="num rs-count">{weeks.indexOf(week) + 1} / {weeks.length}</span>
        </span>
      </div>
      <WeekScrubber weeks={weeks} week={week} onSelect={setWeek} winners={winners} />

      {sorted.length === 0
        ? <div className="rs-empty">No results for this week</div>
        : <>
            <RaceInfoCard week={week} weekInfo={weekInfo} wr={wr} facts={facts} ownerMap={ownerMap} avg={avg} />
            {wire.length > 0 && (
              <section className="rs-wire" aria-label="Wire recap">
                <span className="rs-wire-tag">FRL WIRE</span>
                <p>{wire.join(" ")}</p>
              </section>
            )}
            <TakeawaysCard week={week} recap={recap} sup={sup} />

            <section>
              <div className="sec-head" style={{ margin: "2px 2px 8px" }}>
                <span className="label">Weekly standings</span>
                {foldable.length > 0 && (
                  <button className="rs-toggle" onClick={toggleAll} aria-pressed={allOpen}>
                    {allOpen ? "Collapse" : "Expand All"}
                  </button>
                )}
              </div>
              <div className="rs-cards">
                {sorted.map(([pid, ps], idx) => (
                  <PlayerCard
                    key={pid} pid={pid} ps={ps} idx={idx} count={sorted.length}
                    isOpen={!!open[pid]} onToggle={() => setOpen(o => ({ ...o, [pid]: !o[pid] }))}
                    perfectScore={perfectScore} ctx={ctx}
                    gmw={gmWeek?.managers?.[pid]} tags={gmTags[pid]} ghost={ghosts[pid]}
                  />
                ))}
              </div>
            </section>

            <TopPerformers topDrivers={topDrivers} ownerMap={ownerMap} />
          </>
      }
      <DriverTelemetryCard data={data} name={card.name} week={week} player={player} mode="results" onClose={card.close} />
    </div>
    </OpenCtx.Provider>
  );
}
