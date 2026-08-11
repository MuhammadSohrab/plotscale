import { LockKeyhole, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

export function AccessDialog({ featureName, mode = "login", onClose }) {
  const loginRequired = mode === "login";
  const closeButtonRef = useRef(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="access-dialog__backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="access-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="access-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          className="access-dialog__close"
          type="button"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <span className="access-dialog__icon"><LockKeyhole size={25} /></span>
        <span className="eyebrow">{loginRequired ? "Free account feature" : "Coming next"}</span>
        <h2 id="access-dialog-title">
          {loginRequired ? "Login required" : `${featureName} is on the way`}
        </h2>
        <p>
          {loginRequired
            ? `${featureName} is completely free. Log in to use it, or create a free PlotScale account if you are new.`
            : `${featureName} will be enabled with the upcoming drawing and calculation module.`}
        </p>
        {loginRequired ? (
          <>
            <Link className="primary-button" to="/login">Log in</Link>
            <Link className="secondary-button" to="/signup">Create free account</Link>
          </>
        ) : (
          <button className="secondary-button" type="button" onClick={onClose}>Got it</button>
        )}
      </section>
    </div>
  );
}
