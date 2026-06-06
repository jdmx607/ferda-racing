// ── Unified notification helpers ──────────────────────────────────────────────
// Fires Web Push and/or SMS depending on what each player has configured.
// Both channels are optional and gracefully no-op when not set up.

import { PNAME, SCHEDULE } from "../constants";

// ── SMS ───────────────────────────────────────────────────────────────────────
export async function sendSms(phone, message) {
  if (!phone) return { ok: false, reason: "no phone" };
  try {
    const res = await fetch("/api/sms", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ to: phone, message }),
    });
    return await res.json();
  } catch (e) {
    console.warn("SMS failed:", e.message);
    return { ok: false };
  }
}

// ── Web Push ──────────────────────────────────────────────────────────────────
export async function sendPush(subscription, { title, message, url = "/" }) {
  if (!subscription?.endpoint) return { ok: false, reason: "no subscription" };
  try {
    const res = await fetch("/api/push", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ subscription, title, message, url }),
    });
    return await res.json();
  } catch (e) {
    console.warn("Push failed:", e.message);
    return { ok: false };
  }
}

// ── Notify a single player through all configured channels ────────────────────
export async function notifyPlayer(pid, playerSettings, { title, message, url = "/" }) {
  const s = playerSettings?.[pid] || {};
  const results = await Promise.allSettled([
    // Web Push
    s.pushSubscription?.endpoint
      ? sendPush(s.pushSubscription, { title, message, url })
      : Promise.resolve({ ok: false, reason: "no push" }),
    // SMS
    s.notifySms && s.phone
      ? sendSms(s.phone, `${title}\n${message}`)
      : Promise.resolve({ ok: false, reason: "no sms" }),
  ]);
  return results.map(r => r.value ?? r.reason);
}

// ── Draft turn notification ───────────────────────────────────────────────────
export async function notifyDraftTurn(pid, playerSettings, { week, pickNumber, totalPicks, raceName }) {
  const appUrl = typeof window !== "undefined" ? window.location.origin : "https://ferda-racing.vercel.app";
  const title   = "FERDA Racing — Your Pick! 🏁";
  const message = `Pick ${pickNumber} of ${totalPicks} · W${week} ${raceName}. Open the app: ${appUrl}`;
  return notifyPlayer(pid, playerSettings, { title, message, url: "/" });
}

// ── Race scored notification (to ALL players) ─────────────────────────────────
// Called once after the commissioner posts week results.
export async function notifyRaceScored(week, scored, playerSettings, players) {
  const sorted = Object.entries(scored)
    .sort((a, b) => b[1].total - a[1].total);

  const medals = ["🥇","🥈","🥉","4️⃣"];
  const lines  = sorted.map(([pid, s], i) =>
    `${medals[i]} ${PNAME[pid]}: ${s.total} pts${s.weeklyWin ? " 👑" : ""}`
  ).join("\n");

  const title   = `🏁 W${week} Scores Are In!`;
  const message = `${lines}`;

  const promises = players.map(p =>
    notifyPlayer(p.id, playerSettings, { title, message, url: "/" })
  );
  return Promise.allSettled(promises);
}

// ── Draft opened notification (to first picker) ───────────────────────────────
export async function notifyDraftOpened(pid, playerSettings, { week, raceName, trackName }) {
  const title   = `📋 W${week} Draft Is Open!`;
  const message = `${raceName} @ ${trackName || "TBD"} — You pick first! Open the app to get started.`;
  return notifyPlayer(pid, playerSettings, { title, message, url: "/" });
}
