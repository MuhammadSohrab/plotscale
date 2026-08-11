import { Plus, Ruler } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SubscriptionDialog } from "../components/SubscriptionDialog";
import { UnitSaveNotice, UnitScreen } from "../components/UnitScreen";
import { unitEngine } from "../services/UnitEngine";
import { useAppStore } from "../store/useAppStore";
import { useUnitStore } from "../store/useUnitStore";

export function CustomToolPage() {
  const navigate = useNavigate();
  const user = useAppStore((state) => state.user);
  const entitlements = useAppStore((state) => state.entitlements);
  const isGuest = useAppStore((state) => state.isGuest);
  const { units, hydrate, capabilities, saveDraft, saveCustomTool } = useUnitStore();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [note, setNote] = useState("");
  const [equivalentValue, setEquivalentValue] = useState("");
  const [equivalentUnitId, setEquivalentUnitId] = useState("FOOT");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [paywallOpen, setPaywallOpen] = useState(false);

  useEffect(() => {
    hydrate(user?.id ?? "guest", { ...entitlements, isGuest: isGuest || !user });
  }, [entitlements, hydrate, isGuest, user]);
  const referenceUnits = units.filter((item) =>
    item.dimension === "length" &&
    item.factorToBase !== null &&
    item.trustTier !== "suggested" &&
    item.visibility !== "legacy_profile_only");
  const factor = useMemo(() => {
    try {
      return unitEngine.toBaseExact(equivalentValue, equivalentUnitId);
    } catch {
      return "0";
    }
  }, [equivalentValue, equivalentUnitId]);

  const save = async () => {
    setError("");
    if (!capabilities.canManageCustomUnits) {
      await saveDraft({
        draftType: "measuring_tool",
        name,
        symbol,
        note,
        factorToBase: factor,
        status: "preview_ready",
      });
      setPaywallOpen(true);
      return;
    }
    try {
      await saveCustomTool({ name, symbol, note, equivalentValue, equivalentUnitId });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (caught) {
      setError(caught.message);
    }
  };

  return (
    <UnitScreen title="Custom measuring tool" subtitle="Length tool — separate from area units" backTo="/units">
      <div className="unit-content custom-unit-content">
        <section className="unit-intro"><span><Ruler size={21} /></span><div><h1>Add a local tool</h1><p>Use this for a local Jareeb, Laggi, rope or bamboo length.</p></div></section>
        <label className="unit-field"><span>Tool name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. My village Laggi" /></label>
        <label className="unit-field"><span>Short symbol</span><input value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder="e.g. laggi" /></label>
        <label className="unit-field"><span>Personal note (optional)</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="How this length was verified" /></label>
        <div className="custom-equation">
          <span>1 {name || "tool"}</span><strong>=</strong>
          <input type="number" min="0" step="any" value={equivalentValue} onChange={(event) => setEquivalentValue(event.target.value)} />
          <select value={equivalentUnitId} onChange={(event) => setEquivalentUnitId(event.target.value)}>
            {referenceUnits.map((item) => <option key={item.id} value={item.id}>{item.symbol}</option>)}
          </select>
        </div>
        <section className="live-test-card"><small>CANONICAL LENGTH</small><strong>{Number(factor).toLocaleString("en-IN", { maximumFractionDigits: 10 })} metres</strong><p>A tool becomes an area anchor only when a reviewed family explicitly defines its square relation.</p></section>
        {error && <p className="unit-error">{error}</p>}
        <UnitSaveNotice visible={saved}>Custom measuring tool saved offline</UnitSaveNotice>
        <button className="unit-primary" type="button" onClick={save}><Plus size={18} /> Save custom tool</button>
      </div>
      <SubscriptionDialog
        open={paywallOpen}
        isAuthenticated={Boolean(user)}
        onClose={() => setPaywallOpen(false)}
        onContinueFree={() => navigate("/dashboard")}
      />
    </UnitScreen>
  );
}
