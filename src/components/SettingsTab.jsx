import { useState } from "react";
import { C, r, shadow } from "../theme";
import { DEFAULT_EMAILS } from "../email";
import { usePushNotifications } from "../hooks/usePushNotifications";

export function SettingsTab({ player, data, onSaveSettings }) {
  const settings      = data.playerSettings?.[player.id] || {};
  const [email,       setEmail]       = useState(settings.email || "");
  const [notifyEmail, setNotifyEmail] = useState(settings.notifyOnTurn !== false);
  const [saving,      setSaving]      = useState(false);
  const [msg,         setMsg]         = useState("");
  const defaultEmail  = DEFAULT_EMAILS[player.id];

  const { isSupported, isSubscribed, isLoading, error, subscribe, unsubscribe } =
    usePushNotifications(player, data, onSaveSettings);

  const save = async () => {
    setSaving(true); setMsg("");
    await onSaveSettings(player.id, { email: email.trim(), notifyOnTurn: notifyEmail });
    setMsg("Settings saved!");
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div style={{ padding:20, maxWidth:600, margin:"0 auto", position:"relative", zIndex:1 }}>
      <h2 style={{ color:C.text, fontFamily:"'Oswald',sans-serif", fontSize:26, letterSpacing:1, margin:"0 0 20px" }}>
        Settings
      </h2>

      {/* ── Email notifications ───────────────────────────────────────────── */}
      <div style={{
        background:C.card, borderRadius:r.lg, padding:20, marginBottom:14,
        border:`1px solid ${C.border}`, boxShadow:shadow.sm,
      }}>
        <div style={{ color:C.accent, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:14 }}>
          📧 Email Notifications
        </div>

        <div style={{ marginBottom:14 }}>
          <div style={{ color:C.textDim, fontSize:12, marginBottom:6 }}>Email Address</div>
          <input
            type="email" value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={defaultEmail || "you@example.com"}
            style={{
              width:"100%", padding:"11px 14px", borderRadius:r.sm,
              border:`1px solid ${C.border}`, background:C.input,
              color:C.text, fontSize:14, fontFamily:"inherit",
              outline:"none", boxSizing:"border-box",
            }}
          />
          {defaultEmail && (
            <div style={{ color:C.muted, fontSize:11, marginTop:5 }}>
              Default: <span style={{ color:C.green }}>{defaultEmail}</span> — leave blank to use default
            </div>
          )}
        </div>

        <label style={{ display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}>
          <input
            type="checkbox" checked={notifyEmail}
            onChange={e => setNotifyEmail(e.target.checked)}
            style={{ width:18, height:18, cursor:"pointer" }}
          />
          <div>
            <div style={{ color:C.text, fontSize:14, fontWeight:600 }}>Notify me by email when it's my turn</div>
            <div style={{ color:C.muted, fontSize:11, marginTop:2 }}>Fires when the previous player picks</div>
          </div>
        </label>
      </div>

      {/* ── Push notifications ────────────────────────────────────────────── */}
      <div style={{
        background:C.card, borderRadius:r.lg, padding:20, marginBottom:14,
        border:`1px solid ${isSubscribed ? C.green+"44" : C.border}`,
        boxShadow:shadow.sm,
      }}>
        <div style={{ color:C.accent, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:2, marginBottom:14 }}>
          🔔 Push Notifications
        </div>

        {!isSupported ? (
          <div style={{ color:C.muted, fontSize:13, lineHeight:1.6 }}>
            Push notifications aren't available in this browser.
            {!import.meta.env.VITE_VAPID_PUBLIC_KEY && (
              <span style={{ color:C.dim }}>
                {" "}(VAPID key not configured — see deploy notes)
              </span>
            )}
            <br/>
            <span style={{ fontSize:11 }}>
              Install the app on your phone and open it from the home screen for the best experience.
            </span>
          </div>
        ) : (
          <>
            <div style={{ color:C.textDim, fontSize:13, marginBottom:14, lineHeight:1.6 }}>
              Get a notification on your phone's lock screen when it's your turn to draft —
              even when the app isn't open.
            </div>

            {isSubscribed ? (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{
                    width:10, height:10, borderRadius:"50%", background:C.green,
                    boxShadow:`0 0 8px ${C.green}`,
                  }}/>
                  <span style={{ color:C.green, fontWeight:700, fontSize:13 }}>Push notifications active</span>
                </div>
                <button
                  onClick={unsubscribe}
                  disabled={isLoading}
                  style={{
                    padding:"7px 14px", borderRadius:r.pill,
                    border:`1px solid ${C.red}66`, background:C.red+"11",
                    color:C.red, fontSize:12, fontWeight:700,
                    cursor:isLoading ? "wait" : "pointer", fontFamily:"inherit",
                  }}
                >
                  {isLoading ? "…" : "Turn Off"}
                </button>
              </div>
            ) : (
              <button
                onClick={subscribe}
                disabled={isLoading}
                style={{
                  width:"100%", padding:"12px 0", borderRadius:r.md,
                  border:"none", background:isLoading ? C.border : C.green,
                  color:isLoading ? C.muted : "#000",
                  fontFamily:"'Oswald',sans-serif", fontSize:14, fontWeight:900,
                  letterSpacing:2, textTransform:"uppercase",
                  cursor:isLoading ? "wait" : "pointer",
                  transition:"all 0.15s ease",
                }}
              >
                {isLoading ? "Setting up…" : "Enable Push Notifications"}
              </button>
            )}

            {error && (
              <div style={{ color:C.red, fontSize:12, marginTop:10, lineHeight:1.5 }}>⚠️ {error}</div>
            )}
          </>
        )}
      </div>

      {/* ── Save email settings ───────────────────────────────────────────── */}
      <button
        onClick={save}
        disabled={saving}
        style={{
          width:"100%", padding:"14px 0", borderRadius:r.md,
          border:"none", background:saving ? C.border : C.accent,
          color:saving ? C.muted : "#000",
          fontFamily:"'Oswald',sans-serif", fontSize:16, fontWeight:900,
          letterSpacing:2, textTransform:"uppercase",
          cursor:saving ? "wait" : "pointer", transition:"all 0.15s ease",
        }}
      >
        {saving ? "Saving…" : "Save Email Settings"}
      </button>

      {msg && (
        <div style={{ color:C.green, marginTop:10, textAlign:"center", fontSize:14, fontWeight:700 }}>{msg}</div>
      )}
    </div>
  );
}
