import { useState, useMemo } from "react";
import { C, r } from "../theme";
import { DRIVERS, DRIVER_INFO, MAKE_COLORS, MEMORIAL_DRIVERS, isMemorial, isPartTime, isFreeAgent } from "../constants";

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
  const { num, name } = parseDriver(driver);
  const info = DRIVER_INFO[driver] || {};
  const sub  = [hideTeam ? null : (info.team || "—"), note].filter(Boolean).join(" · ");
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:10, padding:"9px 12px",
      background:C.card, border:`1px solid ${C.border}`, borderRadius:r.sm,
    }}>
      <div style={{
        width:38, flexShrink:0, textAlign:"center", color:C.accent,
        fontFamily:"'Oswald',sans-serif", fontSize:18, fontWeight:700, lineHeight:1,
      }}>{num || "—"}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ color:C.text, fontSize:14, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          {name}
        </div>
        {sub && <div style={{ color:C.muted, fontSize:11, marginTop:1 }}>{sub}</div>}
      </div>
      <MakeBadge make={info.make} />
    </div>
  );
}

function Section({ title, count, accent = C.accent, children, empty }) {
  return (
    <div style={{ marginBottom:24 }}>
      <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:8 }}>
        <h3 style={{
          margin:0, color:accent, fontFamily:"'Oswald',sans-serif",
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

export function DriversTab() {
  const [search, setSearch] = useState("");
  const [view,   setView]   = useState("team");   // "team" | "number"

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
      fontSize:11, fontWeight:700, fontFamily:"'Oswald',sans-serif", letterSpacing:1,
    }}>{label}</button>
  );

  return (
    <div style={{ padding:20, maxWidth:760, margin:"0 auto", position:"relative", zIndex:1 }}>
      <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", flexWrap:"wrap", gap:8, marginBottom:4 }}>
        <h2 style={{ color:C.text, fontFamily:"'Oswald',sans-serif", fontSize:26, letterSpacing:1, margin:0 }}>
          Drivers
        </h2>
        <span style={{ color:C.muted, fontSize:12 }}>
          {groups.active.length} active · {groups.free.length} free agent{groups.free.length === 1 ? "" : "s"} · {groups.part.length} part-time
        </span>
      </div>
      <div style={{ color:C.dim, fontSize:12, marginBottom:14 }}>
        The 2027 Cup Series driver pool.
      </div>

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
          {toggle("team", "BY TEAM")}
          {toggle("number", "BY NUMBER")}
        </div>
      </div>

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
    </div>
  );
}
