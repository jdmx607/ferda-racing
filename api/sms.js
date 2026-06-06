// Vercel serverless function — SMS notifications via Twilio
//
// Required Vercel env vars (set in dashboard → Settings → Environment Variables):
//   TWILIO_SID    — Account SID from console.twilio.com
//   TWILIO_AUTH   — Auth Token from console.twilio.com
//   TWILIO_FROM   — Your Twilio phone number, e.g. "+15551234567"
//
// Cost: ~$0.0079/SMS in the US. For 4 players + a few races/week this is
// well under $1/month. Twilio trial gives $15 free credit to start.
//
// Graceful no-op when env vars are not configured.

// Normalise a US phone number to E.164 format (+1XXXXXXXXXX)
function toE164(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10)  return `+1${digits}`;
  if (digits.length === 11 && digits[0] === "1") return `+${digits}`;
  if (String(raw).startsWith("+")) return raw.trim();
  return null; // unrecognised format
}

async function parseBody(req) {
  if (req.body != null) {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => { raw += chunk; });
    req.on("end",  () => { try { resolve(JSON.parse(raw || "{}")); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")   return res.status(405).json({ ok:false, error:"Method not allowed" });

  const SID  = process.env.TWILIO_SID;
  const AUTH = process.env.TWILIO_AUTH;
  const FROM = process.env.TWILIO_FROM;

  // Graceful no-op — SMS is optional
  if (!SID || !AUTH || !FROM) {
    return res.status(200).json({
      ok: false,
      reason: "SMS not configured. Add TWILIO_SID, TWILIO_AUTH, TWILIO_FROM to Vercel env vars.",
    });
  }

  let body;
  try { body = await parseBody(req); }
  catch (e) { return res.status(400).json({ ok:false, error:"Bad JSON body" }); }

  const { to, message } = body;
  if (!to || !message)  return res.status(400).json({ ok:false, error:"Missing 'to' or 'message'" });

  const toFormatted = toE164(to);
  if (!toFormatted) {
    return res.status(400).json({ ok:false, error:`Could not parse phone number: "${to}"` });
  }

  try {
    // Dynamically import twilio so the function cold-starts quickly
    const { default: twilio } = await import("twilio");
    const client  = twilio(SID, AUTH);
    const result  = await client.messages.create({
      to:   toFormatted,
      from: FROM,
      body: message,
    });
    return res.status(200).json({ ok:true, sid:result.sid });
  } catch (err) {
    // Surface Twilio errors (wrong number, account suspended, etc.)
    const status = err.status || 500;
    return res.status(status < 200 || status > 599 ? 500 : status)
              .json({ ok:false, error:err.message, twilioCode: err.code });
  }
}
