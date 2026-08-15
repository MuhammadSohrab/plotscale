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
    icon: PencilRuler,
    title: "Sketch Pad",
    description: "Draw, scale and shape a plot with rotary joints & diagonals",
    tone: "blue",
    highlight: true,
    badge: "Featured",
  },
  {
    icon: MapPinned,
    title: "Map Measurement",
    description: "Drop pins on satellite imagery with GPS & entrance point",
    tone: "green",
  },
  {
    icon: Image,
    title: "Image Trace",
    description: "Vectorize & trace boundaries from survey map, photo or PDF",
    tone: "blue",
  },
  {
    icon: Calculator,
    title: "Area Calculator",
    description: "Type dimensions, get regular and irregular land area instantly",
    tone: "green",
  },
  {
    icon: ArrowLeftRight,
    title: "Unit Converter",
    description: "Convert standard and verified local units",
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
        <p>Choose your preferred survey method. Your plot data is stored privately on this device.</p>
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
