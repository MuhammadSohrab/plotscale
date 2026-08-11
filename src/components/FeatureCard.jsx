import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function FeatureCard({
  icon: Icon,
  title,
  description,
  tone = "blue",
  badge,
  to,
  onClick,
}) {
  const content = (
    <>
      <span className={`feature-card__icon feature-card__icon--${tone}`}>
        <Icon size={23} />
      </span>
      <span className="feature-card__copy">
        <span className="feature-card__heading">
          <strong>{title}</strong>
          {badge && <small className="feature-card__badge">{badge}</small>}
        </span>
        <small>{description}</small>
      </span>
      <ArrowRight className="feature-card__arrow" size={18} />
    </>
  );

  if (to) {
    return (
      <Link className="feature-card" to={to}>
        {content}
      </Link>
    );
  }

  return (
    <button className="feature-card" type="button" onClick={onClick}>
      {content}
    </button>
  );
}
