import { useState } from "react";
import { C, PClr, r, shadow } from "../theme";
import { DRIVERS, MAX_MULLIGANS, isMemorial } from "../constants";

export function MulligansTab({ player, data, currentWeek, onApplyMulligan }) {
  const used      = data.meta.mulligansUsed[player.id] || 0;
  const remaining = MAX_MULLIGANS - used;

  const [selectedDriver, setSelectedDriver] = useState("");
  const [replacement,    setReplacement]    = useState("");
  const [search,         setSearch]         = useState("");
  const [saving,         setSaving]         = useState(false);
  const [msg,            setMsg]            = useState("");

  const weekKey    = "w" + currentWeek;
  const weekPicks  = data.picks?.[weekKey]?.[player.id] || [];
  const myDrivers  = weekPicks.filter(pk => !pk.garage);
  const hasScored  = !!(data.results?.[weekKey]?.scored);

  const allWeekPicks = data.picks?.[weekKey] || {};
  const takenDrivers = new Set();
  Object.values(allWeekPicks).forEach(picks => {
    (picks || []).forEach(pk => { if (pk.driver) takenDrivers.add(pk.driver); });
  });
  const available = DRIVERS.filter(d =>
    !takenDrivers.has(d) && !isMemorial(d) && d.toLowerCase().includes(search.toLowerCase())
  );

  const mullColor = remaining <= 1 ? C.red : remaining <= 5 ? "#f59e0b" : C.green;

  const apply = async () => {
    if (!selectedDriver || !replacement) return;
    if (!window.confirm(
      `Use a mulligan to swap ${selectedDriver} for ${replacement}?\n\nCounts as 1 of your ${MAX_MULLIGANS} season mulligans. Replacement earns finish position points only.`
    )) return;
    setSaving(true); setMsg("");
    await onApplyMulligan(currentWeek, player.id, selectedDriver, replacement);
    setMsg(`✓ Mulligan applied: ${selectedDriver} → ${replacement}`);
    setSelectedDriver(""); setReplacement(""); setSearch(""); setSaving(false);
    setTimeout(() => setMsg(""), 5000);
  };

  const clr = PClr[player.id];

  return (
    <div style={{ padding:20, maxWidth:700, margin:"0 auto", position:"relative", zIndex:1 }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <h2 style={{ color:C.text, fontFamily:"'Oswald',sans-serif", fontSize:26, letterSpacing:1, margin:"0 0 16px" }}>
        Mulligans
      </h2>

      {/* ── Remaining count + pip row ────────────────────────────────────────── */}
      <div style={{
        background:C.card, borderRadius:r.lg, padding:"16px 20px", marginBottom:16,
        border:`1px solid ${C.border}`, boxShadow:shadow.card,
      }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
          <div>
            <div style={{
              color:mullColor, fontFamily:"'Oswald',sans-serif",
              fontSize:32, fontWeight:900, lineHeight:1,
            }}>
              {remaining}
              <span style={{ fontSize:16, color:C.muted, fontWeight:400 }}> / {MAX_MULLIGANS}</span>
            </div>
            <div style={{ color:C.dim, fontSize:11, marginTop:3, textTransform:"uppercase", letterSpacing:1 }}>
              Mulligans remaining this season
            </div>
          </div>
          {remaining <= 1 && remaining > 0 && (
            <div style={{
              background:C.red+"15", border:`2px solid ${C.red}`, borderRadius:r.md,
              padding:"8px 14px", textAlign:"center",
            }}>
              <div style={{ fontSize:18, marginBottom:2 }}>⚠️</div>
              <div style={{ color:C.red, fontWeight:700, fontSize:11, letterSpacing:1 }}>LAST ONE</div>
            </div>
          )}
          {remaining <= 5 && remaining > 1 && (
            <div style={{
              background:"#f59e0b15", border:"1px solid #f59e0b66", borderRadius:r.md,
              padding:"8px 14px", textAlign:"center",
            }}>
              <div style={{ color:"#f59e0b", fontWeight:700, fontSize:11, letterSpacing:1 }}>USE WISELY</div>
            </div>
          )}
        </div>

        {/* Pip track */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {Array.from({ length:MAX_MULLIGANS }).map((_, i) => {
            const isUsed = i < used;
            return (
              <div key={i} style={{
                flex:"0 0 auto", width:28, height:28, borderRadius:"50%",
                background:isUsed ? C.red+"22" : C.green+"22",
                border:`2px solid ${isUsed ? C.red : C.green}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:11, fontWeight:700,
                color:isUsed ? C.red : C.green,
                transition:"all 0.2s ease",
              }}>
                {isUsed ? "✗" : "✓"}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Current week roster ─────────────────────────────────────────────── */}
      <div style={{
        background:clr.bg, borderRadius:r.lg, padding:16, marginBottom:16,
        border:`2px solid ${clr.bg === "#000000" ? C.border : clr.bg+"66"}`,
      }}>
        <div style={{
          color:clr.fg, fontFamily:"'Oswald',sans-serif",
          fontSize:13, fontWeight:700, letterSpacing:1,
          textTransform:"uppercase", marginBottom:10,
        }}>
          Your Week {currentWeek} Roster
        </div>
        {myDrivers.length === 0
          ? <div style={{ color:clr.fg+"66", fontSize:13, fontStyle:"italic" }}>No picks yet for this week</div>
          : (
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              {myDrivers.map((pk, i) => (
                <div key={i} style={{
                  padding:"8px 12px",
                  background:clr.bg === "#000000" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.18)",
                  borderRadius:r.sm,
                  borderLeft:`3px solid ${pk.mulligan ? "#f59e0b88" : clr.fg+"33"}`,
                  display:"flex", alignItems:"center", gap:8,
                }}>
                  <span style={{ fontSize:9, color:clr.fg+"55", fontWeight:700, width:22 }}>R{i+1}</span>
                  <span style={{ fontSize:13, color:clr.fg, fontWeight:700, flex:1 }}>
                    {pk.driver}
                  </span>
                  {pk.mulligan && (
                    <span style={{
                      fontSize:9, fontWeight:700, color:"#f59e0b",
                      background:"#f59e0b22", padding:"2px 6px", borderRadius:r.pill,
                    }}>MULL</span>
                  )}
                </div>
              ))}
            </div>
          )
        }
      </div>

      {/* ── Conditional: blocked states ─────────────────────────────────────── */}
      {hasScored && (
        <div style={{
          background:C.card, borderRadius:r.md, padding:"14px 18px",
          border:`1px solid ${C.border}`, color:C.dim, fontSize:13, textAlign:"center",
        }}>
          Week {currentWeek} is already scored. Mulligans must be applied before scoring.
        </div>
      )}

      {!hasScored && remaining <= 0 && (
        <div style={{
          background:C.red+"15", borderRadius:r.md, padding:"14px 18px",
          border:`1px solid ${C.red}44`, color:C.red, fontSize:13, textAlign:"center",
        }}>
          No mulligans remaining this season.
        </div>
      )}

      {!hasScored && remaining > 0 && myDrivers.length === 0 && (
        <div style={{
          background:C.card, borderRadius:r.md, padding:"14px 18px",
          border:`1px solid ${C.border}`, color:C.dim, fontSize:13, textAlign:"center",
        }}>
          You don't have any picks for Week {currentWeek} yet.
        </div>
      )}

      {/* ── Mulligan flow ───────────────────────────────────────────────────── */}
      {!hasScored && remaining > 0 && myDrivers.length > 0 && (
        <>
          {/* Step 1 */}
          <div style={{
            background:C.card, borderRadius:r.lg, padding:16,
            border:`1px solid ${selectedDriver ? C.accent+"66" : C.border}`,
            marginBottom:10, boxShadow:shadow.sm,
          }}>
            <div style={{
              color:C.accent, fontSize:10, fontWeight:700,
              textTransform:"uppercase", letterSpacing:2, marginBottom:10,
            }}>
              Step 1 — Choose Driver to Replace
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {myDrivers.map((pk, i) => {
                const isSel = selectedDriver === pk.driver;
                return (
                  <button key={i}
                    onClick={() => setSelectedDriver(isSel ? "" : pk.driver)}
                    disabled={pk.mulligan}
                    style={{
                      padding:"11px 14px", borderRadius:r.sm, textAlign:"left",
                      border:`2px solid ${isSel ? C.accent : pk.mulligan ? C.border+"44" : C.border}`,
                      background:isSel ? C.accent+"18" : pk.mulligan ? C.input+"55" : C.input,
                      color:pk.mulligan ? C.muted : C.text,
                      fontSize:13, fontWeight:700, fontFamily:"inherit",
                      cursor:pk.mulligan ? "not-allowed" : "pointer",
                      transition:"all 0.12s ease",
                      display:"flex", justifyContent:"space-between", alignItems:"center",
                    }}
                  >
                    <span>{pk.driver}</span>
                    {pk.mulligan
                      ? <span style={{ fontSize:9, color:C.muted }}>already used</span>
                      : isSel && <span style={{ fontSize:11, color:C.accent }}>✓ Selected</span>
                    }
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2 — only shown after step 1 */}
          {selectedDriver && (
            <div style={{
              background:C.card, borderRadius:r.lg, padding:16,
              border:`1px solid ${replacement ? "#10b98166" : C.border}`,
              marginBottom:10, boxShadow:shadow.sm,
            }}>
              <div style={{
                color:C.accent, fontSize:10, fontWeight:700,
                textTransform:"uppercase", letterSpacing:2, marginBottom:10,
              }}>
                Step 2 — Choose Replacement
              </div>
              <div style={{ color:C.dim, fontSize:11, marginBottom:8 }}>
                Drivers not already in anyone's lineup this week
              </div>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search drivers…"
                style={{
                  width:"100%", padding:"10px 14px", borderRadius:r.sm,
                  border:`1px solid ${C.border}`, background:C.input,
                  color:C.text, fontSize:13, fontFamily:"inherit", outline:"none",
                  boxSizing:"border-box", marginBottom:8,
                }}
              />
              <div style={{ maxHeight:240, overflowY:"auto", display:"grid", gridTemplateColumns:"1fr 1fr", gap:4 }}>
                {available.length === 0
                  ? <div style={{ gridColumn:"1/-1", color:C.dim, fontSize:12, textAlign:"center", padding:16 }}>
                      No available drivers match
                    </div>
                  : available.map(d => (
                      <button key={d}
                        onClick={() => setReplacement(d)}
                        style={{
                          textAlign:"left", padding:"8px 10px", borderRadius:r.sm,
                          background:replacement===d ? C.green+"18" : C.input,
                          border:`2px solid ${replacement===d ? C.green : C.border}`,
                          color:replacement===d ? C.green : C.text,
                          fontSize:12, fontWeight:700,
                          cursor:"pointer", fontFamily:"inherit",
                          transition:"all 0.1s ease",
                        }}
                      >
                        {d}
                      </button>
                    ))
                }
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {selectedDriver && replacement && (
            <div style={{
              background:C.accent+"0f", borderRadius:r.lg, padding:16,
              border:`2px solid ${C.accent}44`, marginBottom:12,
              boxShadow:shadow.glow(C.accent),
            }}>
              <div style={{
                color:C.accent, fontSize:10, fontWeight:700,
                textTransform:"uppercase", letterSpacing:2, marginBottom:12,
              }}>
                Step 3 — Confirm Swap
              </div>
              <div style={{
                display:"flex", alignItems:"center", gap:12, marginBottom:12,
                flexWrap:"wrap",
              }}>
                <div style={{
                  flex:1, padding:"10px 14px", borderRadius:r.sm,
                  background:C.red+"18", border:`1px solid ${C.red}44`,
                  textAlign:"center",
                }}>
                  <div style={{ color:C.red, fontSize:9, fontWeight:700, letterSpacing:1, marginBottom:4 }}>OUT</div>
                  <div style={{ color:C.text, fontWeight:700, fontSize:13 }}>{selectedDriver}</div>
                </div>
                <div style={{ color:C.dim, fontSize:20 }}>→</div>
                <div style={{
                  flex:1, padding:"10px 14px", borderRadius:r.sm,
                  background:C.green+"18", border:`1px solid ${C.green}44`,
                  textAlign:"center",
                }}>
                  <div style={{ color:C.green, fontSize:9, fontWeight:700, letterSpacing:1, marginBottom:4 }}>IN</div>
                  <div style={{ color:C.text, fontWeight:700, fontSize:13 }}>{replacement} 🔄</div>
                </div>
              </div>
              <div style={{ color:C.muted, fontSize:11, marginBottom:14, lineHeight:1.5 }}>
                Replacement earns <strong style={{ color:C.text }}>finish position points only</strong> — no stage points, laps led, or bonuses.
              </div>
              <button
                onClick={apply}
                disabled={saving}
                style={{
                  width:"100%", padding:"14px 0", borderRadius:r.md,
                  border:"none", background:saving ? C.border : C.accent,
                  color: saving ? C.dim : "#000",
                  fontFamily:"'Oswald',sans-serif", fontSize:15, fontWeight:900,
                  letterSpacing:2, textTransform:"uppercase", cursor:saving ? "wait" : "pointer",
                  transition:"all 0.15s ease",
                }}
              >
                {saving ? "Applying…" : "Apply Mulligan"}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Success message ─────────────────────────────────────────────────── */}
      {msg && (
        <div style={{
          color:C.green, fontSize:13, fontWeight:700,
          textAlign:"center", padding:"10px 0",
        }}>
          {msg}
        </div>
      )}
    </div>
  );
}
