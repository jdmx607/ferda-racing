import { useEffect } from "react";
import { createPortal } from "react-dom";

/** Half-screen bottom sheet. Sits above the nav bar, respects the bottom safe area. */
export function BottomSheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Portal to <body> so it stacks above the fixed nav bar, not inside the page container
  return createPortal(
    <>
      <div className={`bsheet-scrim${open ? " open" : ""}`} onClick={onClose} />
      <div className={`bsheet${open ? " open" : ""}`} role="dialog" aria-modal="true" aria-label={title} aria-hidden={!open}>
        <div className="bsheet-grab" />
        <div className="bsheet-head">
          <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
          <button className="link-btn" onClick={onClose}>Close</button>
        </div>
        <div className="bsheet-body">{children}</div>
      </div>
    </>,
    document.body
  );
}
