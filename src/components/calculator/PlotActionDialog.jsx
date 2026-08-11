import { Download, Save, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { exportPlotPdf } from "../../services/PlotReportService";

const emptyMetadata = {
  plotName: "",
  owner: "",
  address: "",
  notes: "",
};

export function PlotActionDialog({
  open,
  action,
  snapshot,
  initialMetadata,
  initialBoundaries,
  canSave,
  onClose,
  onSave,
}) {
  const dialogRef = useRef(null);
  const plotNameRef = useRef(null);
  const returnFocusRef = useRef(null);
  const [metadata, setMetadata] = useState(emptyMetadata);
  const [boundaries, setBoundaries] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement;
    setMetadata({ ...emptyMetadata, ...initialMetadata });
    setBoundaries(
      Array.from(
        { length: snapshot?.result?.sideLengthsMeters?.length ?? 0 },
        (_, index) => initialBoundaries?.[index] ?? "",
      ),
    );
    setError("");
    const focusTimer = window.setTimeout(() => plotNameRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(focusTimer);
      returnFocusRef.current?.focus?.();
    };
  }, [initialBoundaries, initialMetadata, open, snapshot]);

  useEffect(() => {
    if (!open) return undefined;
    const handleDialogKeys = (event) => {
      if (event.key === "Escape" && !busy) onClose();
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => !element.hidden);
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
    window.addEventListener("keydown", handleDialogKeys);
    return () => window.removeEventListener("keydown", handleDialogKeys);
  }, [busy, onClose, open]);

  if (!open || !snapshot) return null;

  const execute = async () => {
    setError("");
    if (!metadata.plotName.trim()) {
      setError("Enter a plot name.");
      return;
    }
    if (action === "save" && !canSave) {
      setError("Sign in to save plots. Saving plots is a free account feature.");
      return;
    }
    setBusy(true);
    try {
      if (action === "save") {
        await onSave({ metadata, boundaries });
      } else {
        await exportPlotPdf({
          ...snapshot,
          metadata,
          boundaries,
        });
      }
      onClose();
    } catch (caught) {
      setError(caught.message || "The action could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="plot-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section
        className="plot-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plot-dialog-title"
        tabIndex="-1"
        ref={dialogRef}
      >
        <header>
          <div>
            <small>{action === "save" ? "DEVICE STORAGE" : "LOCAL PDF REPORT"}</small>
            <h2 id="plot-dialog-title">{action === "save" ? "Save plot" : "Export report"}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close dialog">
            <X size={19} />
          </button>
        </header>
        <div className="plot-dialog__body">
          <label>
            <span>Plot name</span>
            <input
              ref={plotNameRef}
              value={metadata.plotName}
              onChange={(event) => setMetadata((current) => ({ ...current, plotName: event.target.value }))}
              placeholder="e.g. North field"
            />
          </label>
          <div className="plot-dialog__split">
            <label>
              <span>Owner (optional)</span>
              <input
                value={metadata.owner}
                onChange={(event) => setMetadata((current) => ({ ...current, owner: event.target.value }))}
              />
            </label>
            <label>
              <span>Address (optional)</span>
              <input
                value={metadata.address}
                onChange={(event) => setMetadata((current) => ({ ...current, address: event.target.value }))}
              />
            </label>
          </div>
          <label>
            <span>Notes (optional)</span>
            <textarea
              rows="3"
              value={metadata.notes}
              onChange={(event) => setMetadata((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>
          {snapshot.calculationMode !== "triangles" && snapshot.mode !== "triangles" && boundaries && boundaries.length > 0 && (
            <fieldset>
              <legend>Boundary Detail</legend>
              <div className="plot-dialog__boundaries">
                {boundaries.map((boundary, index) => (
                  <label key={`boundary-${index}`}>
                    <span>Side {index + 1}</span>
                    <input
                      value={boundary}
                      onChange={(event) => setBoundaries((current) =>
                        current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))}
                      placeholder="Neighbour, road or landmark"
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {snapshot.sourceType === "map" && (
            <p className="plot-dialog__notice">
              The PDF includes a locally generated QR for driving directions to the selected
              navigation point, or the plot centre when no entrance point was selected.
            </p>
          )}
          {action === "save" && !canSave && (
            <p className="plot-dialog__notice">
              Saving plots is a free account feature. Sign in or create an account to keep this
              result on the device and reopen it later.
            </p>
          )}
          {error && <p className="plot-dialog__error">{error}</p>}
        </div>
        <footer>
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button>
          {action === "save" && !canSave ? (
            <Link to="/login" className="primary-button">
              Sign in to save
            </Link>
          ) : (
            <button type="button" className="primary-button" onClick={execute} disabled={busy}>
              {action === "save" ? <Save size={18} /> : <Download size={18} />}
              {busy ? "Please wait…" : action === "save" ? "Save to device" : "Download PDF"}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
