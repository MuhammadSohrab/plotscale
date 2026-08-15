import { ArrowLeft, Cloud, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Brand } from "../components/Brand";
import { useAppStore } from "../store/useAppStore";
import { unitSyncQueue } from "../services/UnitSyncQueue";

export function CloudProfilePage() {
  const user = useAppStore((state) => state.user);
  const entitlements = useAppStore((state) => state.entitlements);
  const location = useLocation();
  const returnTo = location.state?.from;
  const [pending, setPending] = useState(0);
  const [syncMessage, setSyncMessage] = useState("");
  useEffect(() => {
    if (user?.id) unitSyncQueue.pendingCount(user.id).then(setPending);
  }, [user?.id]);
  const retry = async () => {
    const result = await unitSyncQueue.process(user.id);
    setPending(result.pending);
    setSyncMessage(result.failed
      ? `${result.failed} change(s) still waiting.`
      : "Unit setup sync is up to date.");
  };
  return (
    <main className="dashboard cloud-profile">
      <header className="calculator-header">
        <Link className="icon-button" to="/dashboard" aria-label="Back to dashboard">
          <ArrowLeft size={19} />
        </Link>
        <Brand compact />
        <span className="calculator-header__chip">
          <ShieldCheck size={14} /> Profile
        </span>
      </header>
      <section className="dashboard__hero">
        <span className="status-pill"><Cloud size={15} /> Account protected</span>
        <h1>Cloud profile</h1>
        <p>Only lightweight identity, preferences, and unit setup belong here.</p>
      </section>
      <section className="profile-card">
        <ShieldCheck size={28} />
        <div><small>Name</small><strong>{user?.user_metadata?.name || "PlotScale user"}</strong></div>
        <div><small>Email</small><strong>{user?.email}</strong></div>
        <div><small>User ID</small><code>{user?.id}</code></div>
        <div><small>Unit Setup entitlement</small><strong>{entitlements.subscriptionStatus}</strong></div>
        <div><small>Pending unit changes</small><strong>{pending}</strong></div>
        <button
          className="unit-secondary"
          type="button"
          onClick={retry}
          disabled={!["active", "trial"].includes(entitlements.subscriptionStatus) || pending === 0}
        >
          <RefreshCw size={16} /> Retry unit sync
        </button>
        {syncMessage && <small>{syncMessage}</small>}
        {returnTo && ["active", "trial"].includes(entitlements.subscriptionStatus) && (
          <Link className="primary-button" to={returnTo}>
            Return to your unit setup
          </Link>
        )}
      </section>
    </main>
  );
}
