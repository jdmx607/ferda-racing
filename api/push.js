// Vercel serverless function — Web Push notifications
//
// Required Vercel env vars (set in dashboard → Settings → Environment Variables):
//   VAPID_PUBLIC_KEY   — from `npx web-push generate-vapid-keys`
//   VAPID_PRIVATE_KEY  — (same command, keep private)
//   VAPID_EMAIL        — e.g. "mailto:jdmx607@gmail.com"
//
// Also set for the Vite client:
//   VITE_VAPID_PUBLIC_KEY  — same value as VAPID_PUBLIC_KEY

import webpush from "web-push";

const PUB  = process.env.VAPID_PUBLIC_KEY;
const PRIV = process.env.VAPID_PRIVATE_KEY;
const MAIL = process.env.VAPID_EMAIL || "mailto:ferdaracing@example.com";

if (PUB && PRIV) {
  webpush.setVapidDetails(MAIL, PUB, PRIV);
}

// Body parser for Vercel ESM functions (body isn't pre-parsed in older runtimes)
async function parseBody(req) {
  if (req.body != null) {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => { raw += chunk; });
    req.on("end",  ()    => { try { resolve(JSON.parse(raw || "{}")); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ ok:false, error:"Method not allowed" });

  if (!PUB || !PRIV) {
    // Graceful no-op when VAPID keys haven't been configured yet
    return res.status(200).json({ ok:false, error:"Push not configured — set VAPID env vars in Vercel dashboard" });
  }

  let body;
  try { body = await parseBody(req); }
  catch (e) { return res.status(400).json({ ok:false, error:"Bad JSON body" }); }

  const { subscription, title, message, url } = body;

  if (!subscription?.endpoint) {
    return res.status(400).json({ ok:false, error:"Missing subscription.endpoint" });
  }

  const payload = JSON.stringify({
    title:   title   || "FERDA Racing",
    body:    message || "It's your turn to pick!",
    url:     url     || "/",
  });

  try {
    await webpush.sendNotification(subscription, payload);
    return res.status(200).json({ ok:true });
  } catch (e) {
    // 410 Gone = subscription expired/unsubscribed — caller should clean it up
    const status = e.statusCode || 500;
    return res.status(status).json({ ok:false, error:e.message, gone: status === 410 });
  }
}
