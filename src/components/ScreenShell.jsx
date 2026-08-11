import { MapBackdrop } from "./MapBackdrop";

export function ScreenShell({ children, showBrand = true, className = "" }) {
  return (
    <main className={`screen-shell ${className}`}>
      <div className="screen-shell__content">
        <MapBackdrop />
        {showBrand && (
          <header className="screen-shell__header">
            <span className="offline-chip">Offline ready</span>
          </header>
        )}
        {children}
      </div>
    </main>
  );
}
