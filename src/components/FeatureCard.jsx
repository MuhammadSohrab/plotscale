import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function FeatureCard({
  icon: Icon,
  title,
  description,
  tone = "blue",
  badge,
  highlight = false,
  to,
  onClick,
}) {
  const cardClassName = `feature-card ${highlight ? "feature-card--highlight" : ""}`.trim();

  const content = (
    <>
      <span className={`feature-card__icon feature-card__icon--${tone} ${highlight ? "feature-card__icon--highlight" : ""}`}>
        <Icon size={23} />
      </span>
      <span className="feature-card__copy">
        <span className="feature-card__heading">
          <strong>{title}</strong>
          {badge && (
            <small className={`feature-card__badge ${highlight ? "feature-card__badge--highlight" : ""}`}>
              {badge}
            </small>
          )}
        </span>
        <small>{description}</small>
      </span>
      <ArrowRight className="feature-card__arrow" size={18} />
    </>
  );

  if (to) {
    return (
      <Link className={cardClassName} to={to}>
        {content}
      </Link>
    );
  }

  return (
    <button className={cardClassName} type="button" onClick={onClick}>
      {content}
    </button>
  );
}
