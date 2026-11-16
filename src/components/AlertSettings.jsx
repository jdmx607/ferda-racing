import { useState } from "react";
import { getAlertPrefs, setAlertPrefs, pushToast, systemNotify } from "../utils/toast";
import { haptic } from "../utils/haptics";

/** Settings → Sweat Alerts: in-app toasts + system notifications (this device only). */
export function AlertSettings() {
  const [prefs, setPrefs] = useState(getAlertPrefs);
  const supported = typeof Notification !== "undefined";
  const [perm, setPerm] = useState(supported ? Notification.permission : "unsupported");

  const update = next => { setPrefs(next); setAlertPrefs(next); };
  const toggleSystem = async () => {
    if (prefs.system) return update({ ...prefs, system: false });
    if (!supported) return;
    const p = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    setPerm(p);
    update({ ...prefs, system: p === "granted" });
  };
  const test = async () => {
    haptic(15);
    if (prefs.inApp) pushToast({ title: "Stage 1 winner: #11 Hamlin", body: "Test alert — this is how sweat alerts look", tone: "gold" });
    await systemNotify("FERDA sweat alert (test)", "Stage 1 winner: #11 Hamlin — +10 stage pts +2.5 bonus");
  };

  return (
    <section className="as" aria-label="Sweat alerts">
      <div className="as-h">⚡ Sweat Alerts</div>
      <p className="as-p">
        Draft clock, owned stage winners, owned DNFs and the 10-to-go points gap — while the app is open.
        Saved on this device.
      </p>
      <label className="as-row">
        <span><b>In-app alerts</b><small>Banners at the top of the screen</small></span>
        <input type="checkbox" checked={prefs.inApp} onChange={() => update({ ...prefs, inApp: !prefs.inApp })} />
      </label>
      <label className="as-row">
        <span>
          <b>System notifications</b>
          <small>
            {!supported ? "Not supported in this browser"
              : perm === "denied" ? "Blocked — allow notifications for this site in your browser settings"
              : "Also show alerts in your phone's notification shade"}
          </small>
        </span>
        <input type="checkbox" checked={prefs.system} disabled={!supported || perm === "denied"} onChange={toggleSystem} />
      </label>
      <button className="as-test" onClick={test}>Send test alert</button>
    </section>
  );
}
