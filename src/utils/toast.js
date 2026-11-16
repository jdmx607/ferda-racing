// Tiny app-wide toast bus: any module can pushToast(); <ToastCenter/> renders them.
import { useEffect, useState } from "react";

let seq = 0;
let toasts = [];
const subs = new Set();
const emit = () => subs.forEach(fn => fn(toasts));

/** { title, body?, tone?: "go"|"gold"|"stop"|"caution"|"neutral", ttl?: ms } */
export function pushToast(t) {
  const id = ++seq;
  toasts = [...toasts, { tone: "neutral", ttl: 6000, ...t, id }].slice(-4);
  emit();
  setTimeout(() => dismissToast(id), t.ttl ?? 6000);
  return id;
}

export function dismissToast(id) {
  toasts = toasts.filter(t => t.id !== id);
  emit();
}

export function useToasts() {
  const [list, setList] = useState(toasts);
  useEffect(() => { subs.add(setList); return () => { subs.delete(setList); }; }, []);
  return list;
}

// ── Device preferences for alerts (per device, not synced) ───────────────────
const PREF = "ferda-sweat-alerts";
export function getAlertPrefs() {
  try { return { inApp: true, system: false, ...JSON.parse(localStorage.getItem(PREF) || "{}") }; }
  catch { return { inApp: true, system: false }; }
}
export function setAlertPrefs(p) {
  try { localStorage.setItem(PREF, JSON.stringify(p)); } catch { /* storage unavailable */ }
}

/** Show a system notification (service worker when available) if the user enabled + granted it. */
export async function systemNotify(title, body) {
  try {
    if (!getAlertPrefs().system || typeof Notification === "undefined" || Notification.permission !== "granted") return false;
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg?.showNotification) { await reg.showNotification(title, { body, icon: "/icons/icon-192x192.png", badge: "/icons/icon-72x72.png", tag: title }); return true; }
    new Notification(title, { body, icon: "/icons/icon-192x192.png" });
    return true;
  } catch { return false; }
}
