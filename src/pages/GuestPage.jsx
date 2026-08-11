import { ArrowRight, CloudOff, Database, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { ScreenShell } from "../components/ScreenShell";
import { useAppStore } from "../store/useAppStore";

export function GuestPage() {
  const enterGuestMode = useAppStore((state) => state.enterGuestMode);
  const navigate = useNavigate();

  const continueOffline = () => {
    enterGuestMode();
    navigate("/dashboard", { replace: true });
  };

  return (
    <ScreenShell showBrand={false} className="guest-screen">
      <div className="guest-brand"><Brand /></div>
      <section className="guest-card">
        <span className="guest-icon"><CloudOff size={32} /></span>
        <span className="eyebrow">Offline access</span>
        <h1>You are in Guest Mode</h1>
        <p>
          Heavy plot data is saved locally on this device. Create an account to
          back up settings and custom unit profiles to the cloud.
        </p>
        <div className="guest-facts">
          <span><Database size={18} /><strong>Plots stay local</strong><small>IndexedDB stores device data</small></span>
          <span><ShieldCheck size={18} /><strong>No account required</strong><small>Start privately and offline</small></span>
        </div>
        <Link className="primary-button" to="/signup">
          Create free account <ArrowRight size={18} />
        </Link>
        <button className="secondary-button" type="button" onClick={continueOffline}>
          Continue offline
        </button>
      </section>
      <Link className="back-link" to="/">Back to welcome</Link>
    </ScreenShell>
  );
}
