import { ArrowLeft, Check, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";

export function UnitScreen({
  title,
  subtitle,
  step,
  children,
  backTo = "/dashboard",
  headerBrand = false,
}) {
  return (
    <main className="unit-page">
      <section className="unit-phone">
        <header className="unit-header">
          <Link className="unit-back" to={backTo} aria-label="Go back">
            <ArrowLeft size={20} />
          </Link>
          <div className="unit-header__copy">
            {headerBrand ? (
              <span className="unit-wordmark">
                <img src="/assets/plotscale_logo_primary.svg" alt="" />
                <strong><span>Plot</span><span>Scale</span></strong>
              </span>
            ) : (
              <>
                <strong>{title}</strong>
                {subtitle && <small>{subtitle}</small>}
              </>
            )}
          </div>
          {headerBrand ? (
            <span className="unit-offline"><WifiOff size={13} /> Offline</span>
          ) : (
            <img
              className="unit-header__logo"
              src="/assets/plotscale_logo_primary.svg"
              alt="PlotScale"
            />
          )}
        </header>
        {step && (
          <div className="unit-progress" aria-label={`Step ${step.current} of ${step.total}`}>
            <span>{step.label}</span>
            <div>{Array.from({ length: step.total }, (_, index) => (
              <i key={index} className={index < step.current ? "is-active" : ""} />
            ))}</div>
          </div>
        )}
        {children}
      </section>
    </main>
  );
}

export function UnitSaveNotice({ visible, children = "Saved on this device" }) {
  if (!visible) return null;
  return <p className="unit-save-notice"><Check size={15} /> {children}</p>;
}

