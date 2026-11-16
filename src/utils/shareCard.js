// ─── Shareable post-race recap card ──────────────────────────────────────────
// Draws a 1080×1350 (4:5) dark recap graphic on a canvas — no extra dependencies —
// then shares it with the Web Share API (files) or falls back to a PNG download.

import { PClr } from "../theme";
import { PNAME } from "../constants";

const W = 1080, H = 1350, PAD = 72;
const C = { bg: "#0F1115", card: "#181B22", card2: "#1F232B", text: "#F4F6F9", dim: "#949BA8", mute: "#6B7280", gold: "#D4AF37", line: "rgba(255,255,255,0.08)" };
const SANS = `"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
const MONO = `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
const f1 = n => (Math.round(n * 10) / 10).toFixed(1);

function wrap(ctx, text, maxW) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  words.forEach(w => {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  });
  if (cur) lines.push(cur);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * opts = { weekLabel, raceName, track, archetype, standings:[{ pid, total }] (1st→4th),
 *          mvp:{ name, total, owners:[pid] } | null, roast, wire:[sentences] }
 * Resolves to a PNG Blob.
 */
export async function renderRecapCard(opts) {
  try { await document.fonts?.ready; } catch { /* fonts optional */ }
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  // checkered strip
  const sq = 18;
  for (let x = 0; x < W; x += sq) for (let y = 0; y < sq * 2; y += sq) {
    ctx.fillStyle = ((x / sq + y / sq) % 2) ? "#000" : "#fff";
    ctx.fillRect(x, y, sq, sq);
  }

  let y = 112;
  ctx.fillStyle = C.dim; ctx.font = `700 26px ${SANS}`;
  ctx.fillText("FERDA RACING LEAGUE", PAD, y);
  ctx.textAlign = "right"; ctx.fillStyle = C.gold;
  ctx.fillText(String(opts.weekLabel || "").toUpperCase(), W - PAD, y);
  ctx.textAlign = "left";

  y += 70;
  ctx.fillStyle = C.text; ctx.font = `800 64px ${SANS}`;
  wrap(ctx, opts.raceName, W - PAD * 2).slice(0, 2).forEach(l => { ctx.fillText(l, PAD, y); y += 72; });
  ctx.fillStyle = C.dim; ctx.font = `500 30px ${SANS}`;
  ctx.fillText([opts.track, opts.archetype].filter(Boolean).join("  •  "), PAD, y - 18);
  y += 30;

  // podium
  const rowH = 104;
  (opts.standings || []).slice(0, 4).forEach((s, i) => {
    const top = y + i * (rowH + 14);
    roundRect(ctx, PAD, top, W - PAD * 2, rowH, 20);
    ctx.fillStyle = i === 0 ? "rgba(212,175,55,0.08)" : C.card; ctx.fill();
    if (i === 0) { ctx.strokeStyle = "rgba(212,175,55,0.55)"; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.fillStyle = PClr[s.pid]?.accent || C.dim;
    roundRect(ctx, PAD, top, 10, rowH, 5); ctx.fill();
    ctx.fillStyle = i === 0 ? C.gold : C.mute; ctx.font = `800 40px ${MONO}`;
    ctx.fillText(String(i + 1), PAD + 40, top + 66);
    ctx.fillStyle = C.text; ctx.font = `800 44px ${SANS}`;
    ctx.fillText(PNAME[s.pid] + (i === 3 ? "  💩" : i === 0 ? "  👑" : ""), PAD + 100, top + 66);
    ctx.textAlign = "right"; ctx.font = `800 48px ${MONO}`; ctx.fillStyle = i === 0 ? C.gold : C.text;
    ctx.fillText(f1(s.total), W - PAD - 34, top + 68);
    ctx.textAlign = "left";
  });
  y += 4 * (rowH + 14) + 24;

  // MVP
  if (opts.mvp) {
    roundRect(ctx, PAD, y, W - PAD * 2, 130, 20); ctx.fillStyle = C.card2; ctx.fill();
    ctx.fillStyle = C.gold; ctx.font = `800 22px ${SANS}`;
    ctx.fillText("WEEKLY MVP DRIVER", PAD + 34, y + 44);
    ctx.fillStyle = C.text; ctx.font = `800 40px ${SANS}`;
    const who = opts.mvp.owners?.length ? `  ·  ${opts.mvp.owners.map(p => PNAME[p]).join(" & ")}` : "  ·  undrafted";
    ctx.fillText(wrap(ctx, `${opts.mvp.name}${who}`, W - PAD * 2 - 260)[0], PAD + 34, y + 98);
    ctx.textAlign = "right"; ctx.font = `800 46px ${MONO}`; ctx.fillStyle = C.gold;
    ctx.fillText(`+${f1(opts.mvp.total)}`, W - PAD - 34, y + 98);
    ctx.textAlign = "left";
    y += 160;
  }

  // roast
  if (opts.roast) {
    ctx.fillStyle = "#F87171"; ctx.font = `italic 600 30px ${SANS}`;
    wrap(ctx, `💩 ${opts.roast}`, W - PAD * 2).slice(0, 3).forEach(l => { ctx.fillText(l, PAD, y + 20); y += 42; });
  }

  // wire recap fills the rest of the card
  if (opts.wire?.length) {
    y += 40;
    ctx.fillStyle = C.mute; ctx.font = `800 20px ${SANS}`;
    ctx.fillText("FRL WIRE", PAD, y);
    y += 44;
    ctx.fillStyle = C.dim; ctx.font = `500 27px ${SANS}`;
    const LH = 38;
    const maxLines = Math.max(0, Math.floor((H - 130 - y) / LH) + 1);
    const lines = wrap(ctx, opts.wire.join(" "), W - PAD * 2);
    const shown = lines.slice(0, maxLines);
    if (lines.length > maxLines && shown.length) shown[shown.length - 1] = shown[shown.length - 1].replace(/\s*\S*$/, "…");
    shown.forEach(l => { ctx.fillText(l, PAD, y); y += LH; });
  }

  // footer
  ctx.fillStyle = C.line; ctx.fillRect(PAD, H - 96, W - PAD * 2, 2);
  ctx.fillStyle = C.mute; ctx.font = `700 22px ${SANS}`;
  ctx.fillText("PIT-WALL TELEMETRY  •  FERDA RACING LEAGUE", PAD, H - 52);

  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Canvas export failed"))), "image/png"));
}

/** Share with the Web Share API (files) when possible, else download. → "shared" | "downloaded" | "cancelled" */
export async function shareBlob(blob, { filename = "ferda-recap.png", title = "FERDA Racing recap", text = "" } = {}) {
  const file = typeof File !== "undefined" ? new File([blob], filename, { type: "image/png" }) : null;
  if (file && navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title, text });
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "cancelled";
      // fall through to download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "downloaded";
}
