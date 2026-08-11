import {
  ArrowLeftRight,
  ArrowRight,
  Calculator,
  Image,
  MapPinned,
  PencilRuler,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { FeatureCard } from "../components/FeatureCard";
import { ScreenShell } from "../components/ScreenShell";

const modes = [
  {
    icon: Calculator,
    title: "Area Calculator",
    description: "Type dimensions, get area instantly",
    tone: "blue",
  },
  {
    icon: ArrowLeftRight,
    title: "Unit Converter",
    description: "Convert standard and verified local units",
    tone: "green",
  },
  {
    icon: MapPinned,
    title: "Map Measurement",
    description: "Drop pins on satellite imagery",
    tone: "blue",
  },
  {
    icon: Image,
    title: "Image Trace",
    description: "Trace a survey plan or photo",
    tone: "green",
  },
  {
    icon: PencilRuler,
    title: "Sketch Pad",
    description: "Draw, scale and shape a plot visually",
    tone: "blue",
  },
];

export function WelcomePage() {
  const navigate = useNavigate();
  return (
    <ScreenShell showBrand={false} className="welcome-screen">
      <div className="welcome-brand"><Brand /></div>
      <section className="welcome-copy">
        <span className="eyebrow">Survey tools, simplified</span>
        <h1>Measure any plot,<br />in any unit.</h1>
        <p>Pick how you want to start. Everything works offline.</p>
      </section>
      <section className="feature-group welcome-feature-group" aria-labelledby="welcome-measuring-tools">
        <h2 className="feature-group__title" id="welcome-measuring-tools">Measuring Tools</h2>
        <div className="feature-list">
          {modes.map((mode) => <FeatureCard key={mode.title} {...mode} to="/guest" />)}
        </div>
      </section>
      <footer className="welcome-actions">
        <button className="primary-button" onClick={() => navigate("/guest")} type="button">
          Start measuring <ArrowRight size={18} />
        </button>
        <nav className="text-links" aria-label="Authentication links">
          <Link to="/login">Log in</Link>
          <span>·</span>
          <Link to="/signup">Register</Link>
          <span>·</span>
          <Link className="muted-link" to="/guest">Continue as Guest</Link>
        </nav>
      </footer>
    </ScreenShell>
  );
}
