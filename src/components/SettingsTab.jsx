import { useState } from "react";
import { C, r, shadow } from "../theme";
import { DEFAULT_EMAILS } from "../email";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { sendSms, sendPush } from "../hooks/useNotifications";

export function SettingsTab({ player, data, onSaveSettings }) {
  const settings      = data.playerSettings?.[player.id] || {};
  const [email,       setEmail]       = useState(settings.email || "");
  const [notifyEmail, setNotifyEmail] = useState(settings.notifyOnTurn !== false);
  const [phone,       setPhone]       = useState(settings.phone || "");
  const [notifySms,   setNotifySms]   = useState(!!settings.notifySms);
  const [saving,      setSaving]      = useState(false);
  const [msg,         setMsg]         = useState("");
  const [testing,     setTesting]     = useState(null);   // "sms" | "push" | null
  const [testResult,  setTestResult]  = useState(null);
  const defaultEmail  = DEFAULT_EMAILS[player.id];

  const { isSupported, isSubscribed, isLoading, error: pushError, subscribe, unsubscribe } =
    usePushNotifications(player, data, onSaveSettings);

  const vapidConfigured = !!import.meta.env.VITE_VAPID_PUBLIC_KEY;

  const save = async () => {
    setSaving(true); setMsg("");
    await onSaveSettings(player.id, {
      email:       email.trim(),
      notifyOnTurn:notifyEmail,
      phone:       phone.trim(),
      notifySms,
    });
    setMsg("Settings saved!");
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  };

  const testSms = async () => {
    if (!phone) return;
    setTesting("sms"); setTestResult(null);
    const result = await sendSms(phone, `FERDA Racing test 🏁 — SMS notifications are working! This is ${player.name}'s FERDA Racing test message.`);
    setTestResult({ channel:"sms", ...result });
    setTesting(null);
  };

  const testPush = async () => {
    const sub = data.playerSettings?.[player.id]?.pushSubscription;
    if (!sub?.endpoint) return;
    setTesting("push"); setTestResult(null);
    const result = await sendPush(sub, {
      title:   "FERDA Racing test 🏁",
      message: `Push notifications are working for ${player.name}!`,
    });
    setTestResult({ channel:"push", ...result });
    setTesting(null);
  };

  const inputStyle = {
    width:"100%", padding:"11px 14px", borderRadius:r.sm,
    border:`1px solid ${C.border}`, background:C.input,
    color:C.text, fontSize:14, fontFamily:"inherit",
    outline:"none", boxSizing:"border-box",
  };

  const sectionStyle = {
    background:C.card, borderRadius:r.lg, padding:20, marginBottom:14,
    border:`1px solid ${C.border}`, boxShadow:shadow.sm,
  };

  const labelStyle = {
    color:C.accent, fontSize:11, fontWeight:700,
    textTransform:"uppercase", letterSpacing:2, marginBottom:14, display:"block",
  };

  return (
    <div style={{ padding:20, maxWidth:600, margin:"0 auto", position:"relative", zIndex:1 }}>
      <h2 style={{ color:C.text, fontFamily:"'Oswald',sans-serif", fontSize:26, letterSpacing:1, margin:"0 0 20px" }}>
        Settings
      </h2>

      {/* ── Email notifications ───────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <span style={labelStyle}>📧 Email Notifications</span>
        <div style={{ marginBottom:14 }}>
          <div style={{ color:C.textDim, fontSize:12, marginBottom:6 }}>Email Address</div>
          <input
            type="email" value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={defaultEmail || "you@example.com"}
            style={inputStyle}
          />
          {defaultEmail && (
            <div style={{ color:C.muted, fontSize:11, marginTop:5 }}>
              Default: <span style={{ color:C.green }}>{defaultEmail}</span> — leave blank to use default
            </div>
          )}
        </div>
        <label style={{ display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}>
          <input type="checkbox" checked={notifyEmail}
            onChange={e => setNotifyEmail(e.target.checked)}
            style={{ width:18, height:18, cursor:"pointer" }}/>
          <div>
            <div style={{ color:C.text, fontSize:14, fontWeight:600 }}>Email me when it's my turn to draft</div>
            <div style={{ color:C.muted, fontSize:11, marginTop:2 }}>Fires when the previous player picks</div>
          </div>
        </label>
      </div>

      {/* ── SMS notifications ─────────────────────────────────────────────── */}
      <div style={{ ...sectionStyle, borderColor: notifySms && phone ? `${C.green}44` : C.border }}>
        <span style={labelStyle}>💬 SMS Notifications (Recommended)</span>
        <div style={{
          background:`${C.green}11`, border:`1px solid ${C.green}33`,
          borderRadius:r.sm, padding:"10px 12px", marginBottom:14, fontSize:12,
          color:C.textDim, lineHeight:1.6,
        }}>
          Text messages reach you even when the app isn't open — no installation required.
          Draft turn alerts + final race scores sent to your phone.
          <div style={{ color:C.muted, fontSize:10, marginTop:4 }}>
            Requires TWILIO_SID, TWILIO_AUTH, TWILIO_FROM in Vercel env vars.
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <div style={{ color:C.textDim, fontSize:12, marginBottom:6 }}>Phone Number</div>
          <input
            type="tel" value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="555-867-5309 or +15558675309"
            style={inputStyle}
          />
          <div style={{ color:C.muted, fontSize:11, marginTop:5 }}>
            US numbers: enter 10 digits. International: include country code (+1…).
          </div>
        </div>

        <label style={{ display:"flex", alignItems:"center", gap:12, cursor:"pointer", marginBottom: phone ? 12 : 0 }}>
          <input type="checkbox" checked={notifySms}
            onChange={e => setNotifySms(e.target.checked)}
            style={{ width:18, height:18, cursor:"pointer" }}/>
          <div>
            <div style={{ color:C.text, fontSize:14, fontWeight:600 }}>Text me draft turns + race scores</div>
            <div style={{ color:C.muted, fontSize:11, marginTop:2 }}>
              When it's your pick, and when weekly scores are posted
            </div>
          </div>
        </label>

        {phone && (
          <button
            onClick={testSms}
            disabled={testing === "sms"}
            style={{
              marginTop:4, padding:"8px 16px", borderRadius:r.pill,
              border:`1px solid ${C.green}66`, background:`${C.green}11`,
              color:C.green, fontSize:12, fontWeight:700,
              cursor:testing==="sms"?"wait":"pointer", fontFamily:"inherit",
            }}
          >
            {testing === "sms" ? "Sending…" : "📤 Send Test Text"}
          </button>
        )}

        {testResult?.channel === "sms" && (
          <div style={{
            marginTop:8, padding:"8px 12px", borderRadius:r.sm,
            background: testResult.ok ? `${C.green}15` : `${C.red}15`,
            border: `1px solid ${testResult.ok ? C.green : C.red}44`,
            color: testResult.ok ? C.green : C.red,
            fontSize:12,
          }}>
            {testResult.ok
              ? "✅ Test text sent! Check your phone."
              : `❌ ${testResult.error || testResult.reason || "SMS failed. Check Twilio env vars in Vercel."}`}
          </div>
        )}
      </div>

      {/* ── Push notifications ────────────────────────────────────────────── */}
      <div style={{ ...sectionStyle, borderColor: isSubscribed ? `${C.accent}44` : C.border }}>
        <span style={labelStyle}>🔔 Push Notifications (Browser/PWA)</span>

        {!vapidConfigured ? (
          // Setup guide when VAPID keys aren't configured
          <div>
            <div style={{
              background:`${C.yellow}11`, border:`1px solid ${C.yellow}33`,
              borderRadius:r.sm, padding:"12px 14px", marginBottom:12,
              color:C.textDim, fontSize:12, lineHeight:1.7,
            }}>
              <div style={{ color:C.yellow, fontWeight:700, marginBottom:6 }}>⚙️ One-time setup required (5 min)</div>
              Push notifications work on Android and installed PWAs. To enable:
              <ol style={{ margin:"8px 0 0 16px", padding:0, color:C.muted }}>
                <li>Run in your terminal: <code style={{ background:C.bg, padding:"1px 6px", borderRadius:4, color:C.accent }}>npx web-push generate-vapid-keys</code></li>
                <li>Go to <strong style={{ color:C.text }}>Vercel → ferda-racing → Settings → Environment Variables</strong></li>
                <li>Add three variables:
                  <div style={{ marginTop:6, display:"flex", flexDirection:"column", gap:4 }}>
                    {[
                      ["VAPID_PUBLIC_KEY",      "The Public Key from the command above"],
                      ["VAPID_PRIVATE_KEY",     "The Private Key from the command above"],
                      ["VAPID_EMAIL",           "mailto:your@email.com"],
                      ["VITE_VAPID_PUBLIC_KEY", "Same as VAPID_PUBLIC_KEY"],
                    ].map(([k, v]) => (
                      <div key={k} style={{ background:C.bg, padding:"4px 8px", borderRadius:4, fontFamily:"monospace", fontSize:11 }}>
                        <span style={{ color:C.accent }}>{k}</span>
                        <span style={{ color:C.muted }}> = {v}</span>
                      </div>
                    ))}
                  </div>
                </li>
                <li>Redeploy the app (git push to main triggers it automatically)</li>
              </ol>
            </div>
            <div style={{ color:C.muted, fontSize:11 }}>
              SMS is easier to set up and works on every phone without any of this — use that instead if you prefer.
            </div>
          </div>
        ) : !isSupported ? (
          <div style={{ color:C.muted, fontSize:13, lineHeight:1.6 }}>
            Push notifications aren't supported in this browser.{" "}
            <span style={{ fontSize:11 }}>Install the app on your phone (Add to Home Screen) for the best experience.</span>
          </div>
        ) : (
          <>
            <div style={{ color:C.textDim, fontSize:13, marginBottom:14, lineHeight:1.6 }}>
              Get a notification on your phone's lock screen when it's your turn to draft —
              even when the app isn't open. Requires the app to be installed (Add to Home Screen on iPhone).
            </div>

            {isSubscribed ? (
              <div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10, marginBottom:10 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:10, height:10, borderRadius:"50%", background:C.green, boxShadow:`0 0 8px ${C.green}` }}/>
                    <span style={{ color:C.green, fontWeight:700, fontSize:13 }}>Push notifications active</span>
                  </div>
                  <button onClick={unsubscribe} disabled={isLoading}
                    style={{ padding:"7px 14px", borderRadius:r.pill, border:`1px solid ${C.red}66`, background:`${C.red}11`, color:C.red, fontSize:12, fontWeight:700, cursor:isLoading?"wait":"pointer", fontFamily:"inherit" }}>
                    {isLoading ? "…" : "Turn Off"}
                  </button>
                </div>
                <button onClick={testPush} disabled={testing === "push"}
                  style={{ padding:"8px 16px", borderRadius:r.pill, border:`1px solid ${C.accent}66`, background:`${C.accent}11`, color:C.accent, fontSize:12, fontWeight:700, cursor:testing==="push"?"wait":"pointer", fontFamily:"inherit" }}>
                  {testing === "push" ? "Sending…" : "📤 Send Test Push"}
                </button>
                {testResult?.channel === "push" && (
                  <div style={{ marginTop:8, padding:"8px 12px", borderRadius:r.sm, background:testResult.ok?`${C.green}15`:`${C.red}15`, border:`1px solid ${testResult.ok?C.green:C.red}44`, color:testResult.ok?C.green:C.red, fontSize:12 }}>
                    {testResult.ok ? "✅ Test push sent! Check your notifications." : `❌ ${testResult.error || "Push failed."}`}
                  </div>
                )}
              </div>
            ) : (
              <button onClick={subscribe} disabled={isLoading}
                style={{ width:"100%", padding:"12px 0", borderRadius:r.md, border:"none", background:isLoading?C.border:C.accent, color:isLoading?C.muted:"#000", fontFamily:"'Oswald',sans-serif", fontSize:14, fontWeight:900, letterSpacing:2, textTransform:"uppercase", cursor:isLoading?"wait":"pointer", transition:"all 0.15s ease" }}>
                {isLoading ? "Setting up…" : "Enable Push Notifications"}
              </button>
            )}

            {pushError && (
              <div style={{ color:C.red, fontSize:12, marginTop:10, lineHeight:1.5 }}>⚠️ {pushError}</div>
            )}
          </>
        )}
      </div>

      {/* ── Save button ───────────────────────────────────────────────────── */}
      <button onClick={save} disabled={saving}
        style={{ width:"100%", padding:"14px 0", borderRadius:r.md, border:"none", background:saving?C.border:C.accent, color:saving?C.muted:"#000", fontFamily:"'Oswald',sans-serif", fontSize:16, fontWeight:900, letterSpacing:2, textTransform:"uppercase", cursor:saving?"wait":"pointer", transition:"all 0.15s ease" }}>
        {saving ? "Saving…" : "Save Settings"}
      </button>

      {msg && (
        <div style={{ color:C.green, marginTop:10, textAlign:"center", fontSize:14, fontWeight:700 }}>{msg}</div>
      )}
    </div>
  );
}
