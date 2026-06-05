import { useState, useEffect, useCallback } from "react";

// VITE_VAPID_PUBLIC_KEY must be set as a Vercel environment variable.
// Without it push subscription is silently disabled.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(b64) {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64  = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// Send a push notification to a player using their stored subscription.
// Gracefully no-ops if the subscription is missing or the API isn't configured.
export async function sendPushToPlayer(subscription, { title, message, url = "/" }) {
  if (!subscription?.endpoint) return;
  try {
    const res = await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription, title, message, url }),
    });
    const data = await res.json();
    return data;
  } catch (e) {
    console.warn("Push send failed:", e.message);
    return { ok: false };
  }
}

// Hook — manages the current player's push subscription lifecycle.
// Returns { isSupported, isSubscribed, isLoading, error, subscribe, unsubscribe }
export function usePushNotifications(player, data, onSaveSettings) {
  const [isSupported,  setIsSupported]  = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState(null);

  useEffect(() => {
    setIsSupported(
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager"   in window &&
      !!VAPID_PUBLIC_KEY
    );
  }, []);

  useEffect(() => {
    const saved = data?.playerSettings?.[player?.id]?.pushSubscription;
    setIsSubscribed(!!saved?.endpoint);
  }, [data, player?.id]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !player) return;
    setIsLoading(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Notification permission was denied. Please allow notifications in your browser settings.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      await onSaveSettings(player.id, { pushSubscription: sub.toJSON() });
      setIsSubscribed(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, player, onSaveSettings]);

  const unsubscribe = useCallback(async () => {
    if (!player) return;
    setIsLoading(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await onSaveSettings(player.id, { pushSubscription: null });
      setIsSubscribed(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [player, onSaveSettings]);

  return { isSupported, isSubscribed, isLoading, error, subscribe, unsubscribe };
}
