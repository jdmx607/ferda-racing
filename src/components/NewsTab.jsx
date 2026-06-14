import { useState, useEffect } from "react";
import { C, r } from "../theme";

function fmtDate(str) {
  if (!str) return "";
  try {
    return new Date(str).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
  } catch { return str; }
}

function NascarNews() {
  const [items,     setItems    ] = useState([]);
  const [loading,   setLoading  ] = useState(true);
  const [error,     setError    ] = useState(null);
  const [source,    setSource   ] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/jayski");
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setItems(json.items || []);
      setSource((json.sources || []).join(", "));
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div style={{ color:C.muted, fontSize:11 }}>
          {source ? source.split(",").join(" · ") : "loading sources…"}
        </div>
        <button
          onClick={load} disabled={loading}
          style={{
            padding:"5px 12px", borderRadius:r.pill, border:`1px solid ${C.border}`,
            background:"transparent", color:loading ? C.muted : C.dim,
            fontSize:11, cursor:loading ? "default" : "pointer", fontFamily:"inherit",
          }}
        >
          {loading ? "Loading…" : "↻ Refresh"}
        </button>
      </div>

      {loading && !items.length && (
        <div style={{ textAlign:"center", color:C.muted, padding:"40px 0", fontSize:13 }}>
          Fetching news…
        </div>
      )}

      {error && (
        <div style={{
          background:C.card, borderRadius:r.md, padding:"12px 16px",
          border:`1px solid #ef444444`, color:"#ef4444", fontSize:13, marginBottom:12,
        }}>
          Couldn't load news: {error}
          <button onClick={load} style={{ marginLeft:12, color:C.accent, background:"none", border:"none", cursor:"pointer", fontSize:13 }}>
            Retry
          </button>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {items.map((item, i) => (
          <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration:"none" }}>
            <div style={{
              background:C.card, borderRadius:r.md, padding:"12px 14px",
              border:`1px solid ${C.border}`, transition:"border-color 0.12s",
            }}>
              <div style={{ color:C.text, fontWeight:600, fontSize:13, lineHeight:1.4, marginBottom:5 }}>
                {item.title}
              </div>
              {item.excerpt && (
                <div style={{ color:C.textDim, fontSize:12, lineHeight:1.5, marginBottom:5 }}>
                  {item.excerpt}
                </div>
              )}
              <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                {item.sourceName && (
                  <span style={{ fontSize:9, fontWeight:700, letterSpacing:1, textTransform:"uppercase", color:C.accent, opacity:0.7 }}>
                    {item.sourceName}
                  </span>
                )}
                {item.date && (
                  <span style={{ color:C.muted, fontSize:11 }}>{fmtDate(item.date)}</span>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>

      {!loading && !error && items.length > 0 && (
        <div style={{ textAlign:"center", marginTop:12 }}>
          <a href="https://www.jayski.com" target="_blank" rel="noopener noreferrer"
            style={{ color:C.muted, fontSize:11, textDecoration:"none" }}>
            More at jayski.com →
          </a>
        </div>
      )}
    </div>
  );
}

export function NewsTab() {
  return (
    <div style={{ padding:20, maxWidth:760, margin:"0 auto", position:"relative", zIndex:1 }}>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ color:C.text, fontFamily:"'Oswald',sans-serif", fontSize:26, letterSpacing:1, margin:0 }}>
          NASCAR News
        </h2>
        <div style={{ color:C.dim, fontSize:13, marginTop:4 }}>
          Jayski · Daily Downforce · Motorsport.com · On3 · Frontstretch · Speedway Media
        </div>
      </div>
      <NascarNews />
    </div>
  );
}
