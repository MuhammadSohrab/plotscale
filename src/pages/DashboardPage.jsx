import {
  ArrowLeftRight,
  Calculator,
  CircleUserRound,
  Cloud,
  CloudOff,
  FolderOpen,
  Image,
  LogOut,
  MapPinned,
  PencilRuler,
  Settings2,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AccessDialog } from "../components/AccessDialog";
import { Brand } from "../components/Brand";
import { FeatureCard } from "../components/FeatureCard";
import { cloudSyncService } from "../services/CloudSyncService";
import { useAppStore } from "../store/useAppStore";

export function DashboardPage() {
  const { user, isGuest, storageReady, resetSession } = useAppStore();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState(null);

  const leave = async () => {
    if (user) await cloudSyncService.signOut();
    resetSession();
    navigate("/", { replace: true });
  };

  const openAccountFeature = (featureName, authenticatedPath) => {
    if (isGuest) {
      setDialog({ featureName, mode: "login" });
      return;
    }
    navigate(authenticatedPath);
  };

  const showUpcomingFeature = (featureName) => {
    setDialog({ featureName, mode: "upcoming" });
  };

  const measuringTools = [
    {
      icon: Calculator,
      title: "Area Calculator",
      description: "Calculate regular and irregular land area",
      tone: "blue",
      to: "/calculator",
    },
    {
      icon: ArrowLeftRight,
      title: "Unit Converter",
      description: "Convert standard and active local units",
      tone: "green",
      to: "/converter",
    },
    {
      icon: MapPinned,
      title: "Map Measurement",
      description: "Full-featured satellite map surveying tool with entrance point & GeoJSON/KML export",
      tone: "green",
      to: "/calculator?mode=map_mode",
    },
    {
      icon: Image,
      title: "Image Trace",
      description: "Trace boundaries from a map, image or PDF",
      tone: "green",
      to: "/image-trace",
    },
    {
      icon: PencilRuler,
      title: "Sketch Pad",
      description: "Draw, scale and build plot boundaries",
      tone: "blue",
      to: "/sketch",
    },
  ];

  const accountSetups = [
    {
      icon: FolderOpen,
      title: "My Plots",
      description: "Open plots stored securely on this device",
      tone: "green",
      badge: isGuest ? "Login" : null,
      onClick: () => openAccountFeature("My Plots", "/saved-plots"),
    },
    {
      icon: Settings2,
      title: "Unit Setup",
      description: "Manage custom and compound units",
      tone: "blue",
      to: "/units",
    },
    {
      icon: CircleUserRound,
      title: "Profile & Account",
      description: "Manage identity, preferences and cloud sync",
      tone: "green",
      badge: isGuest ? "Login" : null,
      onClick: () => openAccountFeature("Profile & Account", "/cloud-profile"),
    },
  ];

  return (
    <main className="dashboard">
      <header className="dashboard__header">
        <Brand compact />
        <button className="icon-button" type="button" onClick={leave} aria-label="Sign out">
          <LogOut size={19} />
        </button>
      </header>
      <section className="dashboard__hero">
        <span className={`status-pill ${isGuest ? "status-pill--guest" : ""}`}>
          {isGuest ? <CloudOff size={15} /> : <Cloud size={15} />}
          {isGuest ? "Guest Mode" : "Cloud connected"}
        </span>
        <h1>{isGuest ? "Ready to work offline." : `Welcome, ${user?.user_metadata?.name || "Surveyor"}.`}</h1>
        <p>
          Choose a PlotScale tool to begin. Your heavy plot data stays on this
          device{storageReady ? " and offline storage is ready." : "."}
        </p>
      </section>
      {isGuest && (
        <aside className="dashboard__prompt">
          <Cloud size={22} />
          <span>
            <strong>Sync your settings</strong>
            <small>Sign in to back up unit profiles and preferences.</small>
          </span>
          <Link to="/signup">Create account</Link>
        </aside>
      )}
      <section className="feature-group dashboard-feature-group" aria-labelledby="dashboard-measuring-tools">
        <h2 className="feature-group__title" id="dashboard-measuring-tools">Measuring Tools</h2>
        <div className="dashboard-features">
          {measuringTools.map((feature) => <FeatureCard key={feature.title} {...feature} />)}
        </div>
      </section>
      <section className="feature-group dashboard-feature-group" aria-labelledby="dashboard-account-setups">
        <h2 className="feature-group__title" id="dashboard-account-setups">Account &amp; Setups</h2>
        <div className="dashboard-features">
          {accountSetups.map((feature) => <FeatureCard key={feature.title} {...feature} />)}
        </div>
      </section>
      {dialog && (
        <AccessDialog
          featureName={dialog.featureName}
          mode={dialog.mode}
          onClose={() => setDialog(null)}
        />
      )}
    </main>
  );
}
