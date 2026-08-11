import { Crown, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";

export function SubscriptionDialog({
  open,
  isAuthenticated,
  onContinueFree,
  onClose,
  draftId = null,
  returnTo,
}) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const previousFocusRef = useRef(null);
  const location = useLocation();
  const handoffRoute = returnTo ?? `${location.pathname}${location.search}`;

  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement;
    closeRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...dialogRef.current.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div className="access-dialog__backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="access-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="subscription-dialog-title"
        ref={dialogRef}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button ref={closeRef} className="access-dialog__close" type="button" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <span className="access-dialog__icon"><Crown size={25} /></span>
        <span className="eyebrow">Subscription feature</span>
        <h2 id="subscription-dialog-title">Your setup preview is ready</h2>
        <p>
          Standard units remain free. Saving and using custom units and compound
          setups requires a PlotScale subscription.
          Your draft stays safely on this device.
        </p>
        <Link
          className="primary-button"
          to={isAuthenticated ? "/cloud-profile" : "/login"}
          state={{ from: handoffRoute, draftId, subscriptionRequired: true }}
        >
          {isAuthenticated ? "Subscribe & Save" : "Log in to subscribe"}
        </Link>
        <button className="secondary-button" type="button" onClick={onContinueFree}>
          Continue Free
        </button>
      </section>
    </div>
  );
}
