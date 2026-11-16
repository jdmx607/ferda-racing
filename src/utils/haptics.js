// Subtle haptic tap for key moments (pick locked, mulligan confirmed, recap shared,
// easter egg found). No-ops where vibration isn't supported (iOS Safari, desktop)
// or when the user prefers reduced motion.
export function haptic(pattern = 15) {
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}
