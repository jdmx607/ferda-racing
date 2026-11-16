import { useState, useMemo, useEffect, useRef } from "react";
import { PClr } from "../theme";
import { PLAYERS, PNAME, ACTIVE_SEASON } from "../constants";
import { CATEGORIES, getAchievements, getRecords, progress, billTribute } from "../engine/achievements";
import { BottomSheet } from "./BottomSheet";

const accentOf = pid => PClr[pid]?.accent || "var(--text-2)";
const APP_VERSION = `${ACTIVE_SEASON}.11`;
const FIRST_SEASON = 2019;

// League-lore easter eggs
// 'Bill' = Justin's old spreadsheet-era nickname; figures derived from his career record
const BILL_TRIBUTE = billTribute();
const ROWDY_TRIBUTE = "Everything Great — #8 Kyle Busch (1985–2026)";
const isRowdy = q => /rowdy/i.test(q) || /^#?8$/.test(q.trim());

const FILTER_ORDER = ["justin", "monroe", "bigmonroe", "rich"];
const FILTERS = [{ id: "all", label: "All" }, ...FILTER_ORDER.map(id => ({ id, label: PNAME[id] }))];

function Dots({ pids }) {
  return <span className="ac-dots">{pids.map(pid => <i key={pid} style={{ background: accentOf(pid) }} title={PNAME[pid]} />)}</span>;
}

/** UNLOCKED (holder dots) / LOCKED / SOON pill. */
function Status({ b, filter }) {
  if (!b.tracked) return <span className="ac-status soon">SOON</span>;
  const holders = filter === "all" ? b.holders : b.holders.filter(h => h.pid === filter);
  if (!holders.length) return <span className="ac-status locked">LOCKED</span>;
  return <span className="ac-status on"><Dots pids={holders.map(h => h.pid)} />UNLOCKED</span>;
}

function BadgeCard({ b, filter, onOpen }) {
  const unlocked = b.tracked && (filter === "all" ? b.holders.length > 0 : b.holders.some(h => h.pid === filter));
  const starred = b.star?.pids?.length > 0 && (filter === "all" || b.star.pids.includes(filter));
  const counter = b.counter && filter !== "all" ? b.counter[filter] : null;
  return (
    <button className={"ac-card" + (unlocked ? " on" : "")} onClick={() => onOpen(b)}>
      <span className="ac-emblem" aria-hidden="true">{b.emoji}</span>
      {starred && <span className="ac-star" title={b.star.label}>★</span>}
      <span className="ac-title">{b.title}</span>
      <span className="ac-cond">{b.condition}</span>
      <span className="ac-foot">
        <Status b={b} filter={filter} />
        {counter != null && counter > 0 && <span className="ac-count num">×{counter}</span>}
      </span>
    </button>
  );
}

function BadgeSheet({ b, filter }) {
  if (!b) return null;
  const holders = filter === "all" ? b.holders : b.holders.filter(h => h.pid === filter);
  return (
    <div className="ac-sheet">
      <div className="ac-sheet-top">
        <span className="ac-emblem lg" aria-hidden="true">{b.emoji}</span>
        <div>
          <div className="t">{b.title}</div>
          <div className="c">{b.condition}</div>
        </div>
      </div>
      <div style={{ margin: "4px 0 12px" }}><Status b={b} filter={filter} /></div>

      {b.counter && (
        <div className="ac-counter">
          <div className="label">{b.id === "poop" ? "Poop Trophy Counter" : "Season tally"}</div>
          <div className="ac-counter-grid">
            {PLAYERS.map(p => (
              <div key={p.id} style={{ "--c": accentOf(p.id) }}>
                <span className="nm">{p.name}</span>
                <span className="v num">{b.counter[p.id] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {holders.length > 0 && (
        <div className="ac-holders">
          {holders.map(h => {
            const note = b.archive.find(a => a.pid === h.pid);
            return (
              <div key={h.pid} className="ac-holder" style={{ "--c": accentOf(h.pid) }}>
                <div className="hd">
                  <span className="dot" />
                  <span className="nm">{PNAME[h.pid]}</span>
                  {b.star?.pids?.includes(h.pid) && <span className="ac-gold">★ {b.star.label}</span>}
                  {note && <span className="ac-archive">ARCHIVE NOTE · {note.text}</span>}
                  <span className="num ct">{h.count > 1 ? `${h.count}×` : ""}</span>
                </div>
                {h.lines.slice(0, 6).map((l, i) => <div key={i} className="ln num">{l}</div>)}
                {h.lines.length > 6 && <div className="ln more">+{h.lines.length - 6} more</div>}
              </div>
            );
          })}
        </div>
      )}

      {b.facts.length > 0 && <ul className="ac-facts">{b.facts.map((f, i) => <li key={i}>{f}</li>)}</ul>}
      {b.archive.filter(a => !a.pid).map((a, i) => (
        <div key={i} className="ac-archive solo">ARCHIVE NOTE · {a.text}</div>
      ))}
    </div>
  );
}

function RecordsCard({ records }) {
  const [mode, setMode] = useState("season");
  const list = mode === "season" ? records.season : records.allTime;
  return (
    <section className="card ac-records" aria-label="Records">
      <div className="seg ac-rec-seg" role="group" aria-label="Record range">
        <button aria-pressed={mode === "season"} onClick={() => setMode("season")}>{ACTIVE_SEASON} Season</button>
        <button aria-pressed={mode === "all"} onClick={() => setMode("all")}>All-Time ({FIRST_SEASON}–{ACTIVE_SEASON})</button>
      </div>
      <div className="ac-rec-list">
        {list.map(r => (
          <div key={r.id} className="ac-rec" style={{ "--c": r.pid ? accentOf(r.pid) : "var(--text-3)" }}>
            <span className="lb">{r.label}</span>
            <span className="v num">{r.unit === "pts" ? Number(r.value).toFixed(1) : r.value}<small> {r.unit}</small></span>
            <span className="who">
              {r.pid && <><i className="dot" />{PNAME[r.pid]} <span className="sep">•</span> </>}
              <span className="d">{r.detail}</span>
            </span>
            {r.note && <span className="note">{r.note}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

export function AchievementsTab({ data }) {
  const [filter, setFilter] = useState("all");
  const [cat, setCat] = useState("race");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(null);
  const [toast, setToast] = useState(null);
  const [rowdy, setRowdy] = useState(false);
  const estTaps = useRef({ n: 0, at: 0 });

  const badges = useMemo(() => getAchievements(data), [data]);
  const records = useMemo(() => getRecords(data), [data]);
  const prog = progress(badges, filter === "all" ? null : filter);

  const q = query.trim().toLowerCase();
  const showRowdy = rowdy || (q && isRowdy(q));
  // a search looks across every category; otherwise show the selected category
  const searching = q && !isRowdy(q);
  const visible = searching
    ? badges.filter(b => `${b.title} ${b.condition}`.toLowerCase().includes(q))
    : badges.filter(b => b.cat === cat);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(t);
  }, [toast]);

  const openBadge = b => {
    setOpen(b);
    if (b.id === "century") setToast(BILL_TRIBUTE);
  };
  const tapEst = () => {
    const now = Date.now();
    const t = estTaps.current;
    t.n = now - t.at < 1500 ? t.n + 1 : 1;
    t.at = now;
    if (t.n >= 5) { t.n = 0; setToast(BILL_TRIBUTE); }
  };

  return (
    <div className="ac">
      <header className="ac-head">
        <h2>Achievements &amp; Records</h2>
        <span className="ac-prog num">{prog.unlocked} / {prog.total} <small>UNLOCKED</small></span>
      </header>

      <div className="ac-filters" role="group" aria-label="Manager">
        {FILTERS.map(f => (
          <button key={f.id} className="ac-pill" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
                  style={f.id !== "all" ? { "--c": accentOf(f.id) } : undefined}>
            {f.id !== "all" && <i className="dot" />}{f.label}
          </button>
        ))}
      </div>
      <input className="ac-search" type="search" value={query} onChange={e => setQuery(e.target.value)}
             placeholder="Search badges…" aria-label="Search badges" />

      {showRowdy && (
        <div className="ac-rowdy" role="note">
          <span className="n num">8</span>
          <span className="t">{ROWDY_TRIBUTE}</span>
          {rowdy && <button className="x" onClick={() => setRowdy(false)} aria-label="Dismiss">✕</button>}
        </div>
      )}

      <RecordsCard records={records} />

      <div className="seg ac-cats" role="tablist" aria-label="Badge category">
        {CATEGORIES.map(c => (
          <button key={c.id} role="tab" aria-selected={cat === c.id} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      {visible.length === 0
        ? <div className="ac-empty">No badges match.</div>
        : <div className="ac-grid">{visible.map(b => <BadgeCard key={b.id} b={b} filter={filter} onOpen={openBadge} />)}</div>}

      <footer className="ac-footer">
        <button className="ac-est num" onClick={tapEst} aria-label="Established 2019">EST. {FIRST_SEASON}</button>
        <span className="sep">·</span>
        <button className="ac-ver num" onClick={() => setRowdy(true)} aria-label="App version">FERDA Racing League v{APP_VERSION}</button>
      </footer>

      <BottomSheet open={!!open} onClose={() => setOpen(null)} title={open?.title || "Badge"}>
        <BadgeSheet b={open} filter={filter} />
      </BottomSheet>

      {toast && (
        <button className="ac-toast num" role="status" onClick={() => setToast(null)}>
          <span className="lbl">TELEMETRY</span>{toast}
        </button>
      )}
    </div>
  );
}
