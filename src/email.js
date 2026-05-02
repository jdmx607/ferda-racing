// Email notification service using EmailJS REST API
// No SDK installation needed — uses direct HTTPS calls

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PASTE YOUR EMAILJS CREDENTIALS HERE (from emailjs.com dashboard)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const EMAILJS_CONFIG = {
  serviceId: "service_po962m8",
  templateId: "template_w6a290d",
  publicKey: "x5gm09HoetYBepHgk",
};
// Your app URL (change if you change the Vercel domain):
export const APP_URL = "https://ferda-racing.vercel.app";
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function isConfigured() {
  return EMAILJS_CONFIG.serviceId !== "YOUR_SERVICE_ID"
    && EMAILJS_CONFIG.templateId !== "YOUR_TEMPLATE_ID"
    && EMAILJS_CONFIG.publicKey !== "YOUR_PUBLIC_KEY";
}

export async function sendDraftEmail({ toEmail, name, week, race, track, pickNumber, round }) {
  if (!isConfigured()) {
    console.warn("EmailJS not configured. Skipping email.");
    return { ok: false, reason: "not_configured" };
  }
  if (!toEmail) {
    console.warn("No email address provided. Skipping.");
    return { ok: false, reason: "no_email" };
  }

  const payload = {
    service_id: EMAILJS_CONFIG.serviceId,
    template_id: EMAILJS_CONFIG.templateId,
    user_id: EMAILJS_CONFIG.publicKey,
    template_params: {
      to_email: toEmail,
      name: name || "Player",
      week: String(week),
      race: race || "the next race",
      track: track || "",
      pick_number: String(pickNumber || 1),
      round: String(round || 1),
      app_url: APP_URL,
    },
  };

  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("EmailJS send failed:", res.status, text);
      return { ok: false, reason: "send_failed", status: res.status };
    }
    console.log("Email sent to", toEmail);
    return { ok: true };
  } catch (e) {
    console.error("EmailJS error:", e);
    return { ok: false, reason: "network_error" };
  }
}

export function isEmailConfigured() { return isConfigured(); }
