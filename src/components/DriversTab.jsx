import { useState, useMemo, createContext, useContext } from "react";
import { C, r } from "../theme";
import { DRIVERS, DRIVER_INFO, MAKE_COLORS, MEMORIAL_DRIVERS, SILLY_SEASON_2027, isMemorial, isPartTime, isFreeAgent, isRookieIn } from "../constants";
import { paintFor } from "../driverPaint";
import { nameKey } from "../driverKey";
import { useScouting } from "../hooks/useScouting";
import { ARCHETYPE } from "../engine/scouting";
import { weekName } from "../exhibitions";
import { DriverDrawer, ScoutTags } from "./DriverTelemetry";

// Scouting context for this week's race, shared by every row without prop-drilling.
const ScoutCtx = createContext(null);

// "#24 William Byron" -> { num:"24", name:"William Byron" }
function parseDriver(d) {
  const m = d.match(/^#(\S+)\s+(.*)$/);
  return m ? { num: m[1], name: m[2] } : { num: "", name: d };
}

const numSort = (a, b) => (parseInt(a.num, 10) || 0) - (parseInt(b.num, 10) || 0);

function MakeBadge({ make }) {
  if (!make) return null;
  const col = MAKE_COLORS[make] || C.muted;
  return (
    <span style={{
      fontSize:9, fontWeight:700, letterSpacing:1, color:col, background:col+"18",
      padding:"2px 7px", borderRadius:r.pill, border:`1px solid ${col}44`, flexShrink:0,
    }}>{make.toUpperCase()}</span>
  );
}

function DriverRow({ driver, note, hideTeam }) {
  const sc = useContext(ScoutCtx);
  const { num, name } = parseDriver(driver);
  const info = DRIVER_INFO[driver] || {};
  const sub  = [hideTeam ? null : (info.team || "—"), note].filter(Boolean).join(" · ");
  const tags = sc && !isMemorial(driver) ? sc.tagsFor(driver) : [];
  const form = sc?.ty ? sc.formFor(driver) : null;
  const start = sc?.grid?.[sc.key(driver)];
  return (
    <button className="dv-row" style={{ "--paint": paintFor(driver) }} onClick={() => sc?.open(driver)} aria-label={`${name} telemetry`}>
      <span className="dv-num num">{num || "—"}</span>
      <span className="dv-mid">
        <span className="dv-name">{name}</span>
        {sub && <span className="dv-sub">{sub}</span>}
        {sc?.ty && !isMemorial(driver) && (
          <span className="dv-stats num">
            {start != null && <span><i>Start</i>P{start}</span>}
            <span title={`Average finish, last ${form?.races || 5} races at ${ARCHETYPE[sc.ty]} tracks`}><i>L5 {sc.ttl}</i>{form ? `P${form.avgFinish.toFixed(1)}` : "—"}</span>
          </span>
        )}
        {tags.length > 0 && <span className="dv-tags"><ScoutTags tags={tags} /></span>}
      </span>
      <MakeBadge make={info.make} />
    </button>
  );
}

function Section({ title, count, accent = C.accent, children, empty }) {
  return (
    <div style={{ marginBottom:24 }}>
      <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:8 }}>
        <h3 style={{
          margin:0, color:accent, fontFamily:"var(--font-sans)",
          fontSize:15, letterSpacing:2, textTransform:"uppercase",
        }}>{title}</h3>
        <span style={{ color:C.muted, fontSize:12 }}>{count}</span>
      </div>
      {count === 0
        ? <div style={{ color:C.muted, fontSize:12, fontStyle:"italic", padding:"8px 2px" }}>{empty}</div>
        : children}
    </div>
  );
}

export function DriversTab({ data, currentWeek, player, onToggleToRear }) {
  const [search, setSearch] = useState("");
  const [sheet,  setSheet]  = useState(null);
  const sc = useScouting(data || {}, currentWeek);
  const isCommish = player?.id === "justin";
  const ctx = useMemo(() => ({
    ...sc, open: setSheet, ttl: sc.ty ? { superspeedway:"SS", short_track:"ST", intermediate:"INT", road_course:"RC" }[sc.ty] : "",
    key: nameKey,
  }), [sc]);
  const [view,   setView]   = useState("team");   // "team" | "number" | "silly"

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = d => !q || d.toLowerCase().includes(q) || (DRIVER_INFO[d]?.team || "").toLowerCase().includes(q);
    const pool = DRIVERS.filter(match);
    return {
      active:     pool.filter(d => !isMemorial(d) && !isFreeAgent(d) && !isPartTime(d)),
      free:       pool.filter(d => isFreeAgent(d)),
      part:       pool.filter(d => !isFreeAgent(d) && isPartTime(d) && !isMemorial(d)),
      memorial:   pool.filter(d => isMemorial(d)),
    };
  }, [search]);

  // Active drivers grouped by team (teams A–Z, drivers by number)
  const byTeam = useMemo(() => {
    const m = {};
    groups.active.forEach(d => { (m[DRIVER_INFO[d]?.team || "Other"] ||= []).push(d); });
    return Object.entries(m)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([team, ds]) => [team, ds.sort((x, y) => numSort(parseDriver(x), parseDriver(y)))]);
  }, [groups.active]);

  const byNumber = useMemo(
    () => [...groups.active].sort((x, y) => numSort(parseDriver(x), parseDriver(y))),
    [groups.active]
  );

  const toggle = (id, label) => (
    <button key={id} onClick={() => setView(id)} style={{
      padding:"6px 14px", borderRadius:r.pill, cursor:"pointer",
      border:`1px solid ${view === id ? C.accent : C.border}`,
      background:view === id ? C.accent : "transparent",
      color:view === id ? "#000" : C.dim,
      fontSize:11, fontWeight:700, fontFamily:"var(--font-sans)", letterSpacing:1, whiteSpace:"nowrap",
    }}>{label}</button>
  );

  return (
    <ScoutCtx.Provider value={data ? ctx : null}>
    <div style={{ padding:"20px 14px", maxWidth:760, margin:"0 auto", position:"relative", zIndex:1, overflowX:"hidden" }}>
      <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginBottom:4 }}>
        <h2 style={{ color:C.text, fontFamily:"var(--font-sans)", fontSize:26, letterSpacing:1, margin:0 }}>
          Drivers
        </h2>
        <span style={{ color:C.muted, fontSize:12 }}>
          {groups.active.length} active · {groups.free.length} free agent{groups.free.length === 1 ? "" : "s"} · {groups.part.length} part-time
        </span>
      </div>
      <div style={{ color:C.dim, fontSize:12, marginBottom:14 }}>
        The 2027 Cup Series driver pool.
        {sc.weekInfo && <> Scouting for <b style={{ color:C.text }}>{weekName(currentWeek)} · {sc.weekInfo.t}</b> ({ARCHETYPE[sc.ty]}). Tap a driver for telemetry.</>}
      </div>
      {sc.strategy && (
        <div className="dr-strat" data-kind={sc.strategy.id} role="note" style={{ marginBottom:14 }}>
          <span className="hd"><b>{sc.strategy.title}</b><span className="num">{sc.strategy.mult}</span></span>
          <span className="tx">{sc.strategy.text}</span>
        </div>
      )}

      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search drivers or teams…"
          style={{
            flex:"1 1 200px", padding:"9px 14px", borderRadius:r.sm,
            border:`1px solid ${C.border}`, background:C.input, color:C.text,
            fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box",
          }}
        />
        <div style={{ display:"flex", gap:6 }}>
          {toggle("team", "TEAM")}
          {toggle("number", "NUMBER")}
          {toggle("silly", "2027 SILLY SEASON")}
        </div>
      </div>

      {view === "silly" ? (() => {
        const q = search.trim().toLowerCase();
        const list = SILLY_SEASON_2027.filter(d => !q || d.toLowerCase().includes(q) || (DRIVER_INFO[d]?.team || "").toLowerCase().includes(q))
          .sort((x, y) => Number(isRookieIn(y, 2027)) - Number(isRookieIn(x, 2027)));
        return (
          <Section title="2027 Silly Season" count={list.length} accent={C.gold} empty="No off-season moves match.">
            <div style={{ color:C.dim, fontSize:12, margin:"-2px 2px 10px", lineHeight:1.5 }}>
              Off-season team, number and make changes. ★ marks 2027 Cup rookies (bonus-driver eligible).
            </div>
            <div style={{ display:"grid", gap:4 }}>
              {list.map(d => (
                <DriverRow key={d} driver={d}
                  note={[isRookieIn(d, 2027) && "★ 2027 ROOKIE", DRIVER_INFO[d]?.change].filter(Boolean).join(" · ")} />
              ))}
            </div>
          </Section>
        );
      })() : <>
      <Section title="Active Drivers" count={groups.active.length} empty="No drivers match.">
        {view === "team" ? (
          <div style={{ display:"grid", gap:16 }}>
            {byTeam.map(([team, ds]) => (
              <div key={team}>
                <div style={{ color:C.dim, fontSize:11, fontWeight:700, letterSpacing:1, textTransform:"uppercase", margin:"0 0 6px 2px" }}>
                  {team}
                </div>
                <div style={{ display:"grid", gap:4 }}>
                  {ds.map(d => <DriverRow key={d} driver={d} hideTeam />)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display:"grid", gap:4 }}>
            {byNumber.map(d => <DriverRow key={d} driver={d} />)}
          </div>
        )}
      </Section>

      <Section title="Free Agents" count={groups.free.length} accent={C.gold} empty="No free agents.">
        <div style={{ display:"grid", gap:4 }}>
          {groups.free.map(d => <DriverRow key={d} driver={d} note="no ride yet" />)}
        </div>
      </Section>

      <Section title="Part-Time / Miscellaneous" count={groups.part.length} accent={C.purple || C.dim}
        empty="No part-time or miscellaneous drivers listed yet.">
        <div style={{ display:"grid", gap:4 }}>
          {groups.part.map(d => <DriverRow key={d} driver={d} note="part-time" />)}
        </div>
      </Section>

      {groups.memorial.length > 0 && (
        <Section title="In Memoriam" count={groups.memorial.length} accent={C.muted}>
          <div style={{ display:"grid", gap:4 }}>
            {groups.memorial.map(d => (
              <DriverRow key={d} driver={d} note={`🕊️ ${MEMORIAL_DRIVERS[d]?.years || ""} · not draftable`} />
            ))}
          </div>
        </Section>
      )}
      </>}
    </div>
    {data && (
      <DriverDrawer
        data={data} name={sheet} onClose={() => setSheet(null)}
        scout={sheet ? {
          ty: sc.ty, form: sc.formFor(sheet), tags: sc.tagsFor(sheet), toRear: sc.rear.has(sheet),
          canToggleRear: isCommish && !!onToggleToRear && !!sc.weekInfo, onToggleRear: () => onToggleToRear(currentWeek, sheet),
        } : null}
      />
    )}
    </ScoutCtx.Provider>
  );
}
