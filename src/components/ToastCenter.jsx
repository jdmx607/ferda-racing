import { useToasts, dismissToast } from "../utils/toast";

/** Renders the app-wide toast stack (top of screen, under the safe area). */
export function ToastCenter() {
  const toasts = useToasts();
  if (!toasts.length) return null;
  return (
    <div className="tc" role="region" aria-label="Alerts" aria-live="polite">
      {toasts.map(t => (
        <button key={t.id} className="tc-toast" data-tone={t.tone} onClick={() => dismissToast(t.id)}>
          <span className="tc-bar" aria-hidden="true" />
          <span className="tc-txt">
            <b>{t.title}</b>
            {t.body && <span className="num">{t.body}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
