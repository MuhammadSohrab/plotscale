export function Brand({ compact = false, stacked = false, dark = false }) {
  return (
    <div
      className={[
        "brand",
        compact ? "brand--compact" : "",
        stacked ? "brand--stacked" : "",
        dark ? "brand--dark" : "",
      ].filter(Boolean).join(" ")}
      aria-label="PlotScale"
    >
      <img
        className="brand__logo"
        src="/assets/plotscale_logo_primary.svg"
        alt=""
        aria-hidden="true"
      />
      <span className="brand__name" aria-hidden="true">
        <span>Plot</span><span>Scale</span>
      </span>
    </div>
  );
}
