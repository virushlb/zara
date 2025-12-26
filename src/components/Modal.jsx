import { useEffect } from "react";

/**
 * Simple modal.
 * - closes on backdrop click or Escape
 * - renders nothing when closed
 */
export default function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  widthClass = "max-w-2xl",
}) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e) {
      if (e.key === "Escape") onClose?.();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title || "Dialog"}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45 baggo-backdrop-enter"
        onClick={() => onClose?.()}
        aria-label="Close dialog"
      />

      <div
        className={`relative w-full ${widthClass} rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl baggo-modal-enter`}
      >
        <div className="p-5 border-b border-[var(--color-border)] flex items-start justify-between gap-4">
          <div className="min-w-0">
            {title ? (
              <h3 className="text-lg font-semibold text-[var(--color-text)] truncate">{title}</h3>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="rounded-full px-3 py-1 text-sm border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
          >
            Close
          </button>
        </div>

        <div className="p-5 max-h-[75vh] overflow-auto">{children}</div>

        {footer ? (
          <div className="p-5 border-t border-[var(--color-border)] bg-[var(--color-surface)] rounded-b-2xl">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
