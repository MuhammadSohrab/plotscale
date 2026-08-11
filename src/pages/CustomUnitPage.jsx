import { Plus, Ruler, SquareDashed } from "lucide-react";
import Decimal from "decimal.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SubscriptionDialog } from "../components/SubscriptionDialog";
import { UnitSaveNotice, UnitScreen } from "../components/UnitScreen";
import { unitEngine } from "../services/UnitEngine";
import { useAppStore } from "../store/useAppStore";
import { useUnitStore } from "../store/useUnitStore";
import { formatDecimalExact } from "../utils/exactFormat";

export function CustomUnitPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const loadedEditRef = useRef(null);
  const user = useAppStore((state) => state.user);
  const entitlements = useAppStore((state) => state.entitlements);
  const isGuest = useAppStore((state) => state.isGuest);
  const {
    units,
    standaloneCustomUnits,
    hydrate,
    capabilities,
    saveDraft,
    saveStandaloneUnit,
  } = useUnitStore();
  const [dimension, setDimension] = useState("area");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [note, setNote] = useState("");
  const [equivalentValue, setEquivalentValue] = useState("");
  const [equivalentUnitId, setEquivalentUnitId] = useState("SQFT");
  const [saved, setSaved] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [error, setError] = useState("");
  const [hydrationAttempted, setHydrationAttempted] = useState(false);

  useEffect(() => {
    let active = true;
    hydrate(user?.id ?? "guest", { ...entitlements, isGuest: isGuest || !user })
      .finally(() => {
        if (active) setHydrationAttempted(true);
      });
    return () => {
      active = false;
    };
  }, [entitlements, hydrate, isGuest, user]);
  const referenceUnits = useMemo(() => units.filter((item) =>
    item.dimension === dimension
    && item.factorToBase !== null
    && !item.isCustom
    && item.trustTier !== "suggested"
    && item.status !== "historical"
    && item.visibility !== "legacy_profile_only"), [dimension, units]);
  useEffect(() => {
    const preferred = dimension === "length" ? "FOOT" : "SQFT";
    setEquivalentUnitId(referenceUnits.some((unit) => unit.id === preferred)
      ? preferred
      : referenceUnits[0]?.id ?? "");
  }, [dimension, referenceUnits]);
  useEffect(() => {
    if (!editId || loadedEditRef.current === editId) return;
    const unit = standaloneCustomUnits.find((item) => item.id === editId);
    if (!unit) return;
    loadedEditRef.current = editId;
    const referenceId = unit.dimension === "length" ? "FOOT" : "SQFT";
    setDimension(unit.dimension);
    setName(unit.name);
    setSymbol(unit.symbol);
    setNote(unit.note ?? "");
    setEquivalentUnitId(referenceId);
    try {
      setEquivalentValue(unitEngine.fromBaseExact(unit.factorToBase, referenceId));
    } catch {
      setEquivalentValue(unit.factorToBase);
      setEquivalentUnitId(unit.dimension === "length" ? "METER" : "SQM");
    }
  }, [editId, standaloneCustomUnits]);
  useEffect(() => {
    if (
      editId
      && hydrationAttempted
      && !standaloneCustomUnits.some((item) => item.id === editId)
    ) {
      navigate("/units", { replace: true });
    }
  }, [editId, hydrationAttempted, navigate, standaloneCustomUnits]);
  const factor = useMemo(() => {
    try {
      return unitEngine.toBaseExact(equivalentValue, equivalentUnitId);
    } catch {
      return "0";
    }
  }, [equivalentUnitId, equivalentValue]);

  const save = async () => {
    setError("");
    const input = { name, symbol, note, dimension, factorToBase: factor };
    if (!name.trim() || !symbol.trim() || !new Decimal(factor).gt(0)) {
      setError("Enter a name, symbol, and positive known equivalence.");
      return;
    }
    if (!capabilities.canManageCustomUnits) {
      await saveDraft({ ...input, draftType: "standalone_unit", status: "preview_ready" });
      setPaywallOpen(true);
      return;
    }
    try {
      const existing = standaloneCustomUnits.find((item) => item.id === editId);
      await saveStandaloneUnit({
        ...input,
        id: editId ?? undefined,
        createdAt: existing?.createdAt,
      });
      setSaved(true);
      window.setTimeout(() => navigate("/units"), 700);
    } catch (caught) {
      setError(caught.message);
    }
  };

  return (
    <UnitScreen
      title={editId ? "Edit Custom Unit" : "Add Custom Unit"}
      subtitle="One standard equivalence"
      backTo="/units"
    >
      <div className="unit-content custom-unit-content">
        <section className="unit-intro">
          <span>{dimension === "length" ? <Ruler size={21} /> : <SquareDashed size={21} />}</span>
          <div>
            <h1>{editId ? "Update your custom unit" : "Add your own unit"}</h1>
            <p>Only its name, symbol and standard equivalence are stored.</p>
          </div>
        </section>
        <div className="dimension-tabs">
          <button type="button" className={dimension === "length" ? "is-active" : ""} onClick={() => setDimension("length")}>Length</button>
          <button type="button" className={dimension === "area" ? "is-active" : ""} onClick={() => setDimension("area")}>Area</button>
        </div>
        <label className="unit-field"><span>Unit name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Village Plot Unit" /></label>
        <label className="unit-field"><span>Short symbol</span><input value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder="e.g. vpu" /></label>
        <label className="unit-field"><span>Personal note (optional)</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Source or local explanation" /></label>
        <div className="custom-equation">
          <span>1 {name || "unit"}</span><strong>=</strong>
          <input type="number" min="0" step="any" value={equivalentValue} onChange={(event) => setEquivalentValue(event.target.value)} />
          <select value={equivalentUnitId} onChange={(event) => setEquivalentUnitId(event.target.value)}>
            {referenceUnits.map((item) => <option key={item.id} value={item.id}>{item.symbol}</option>)}
          </select>
        </div>
        <section className="live-test-card">
          <small>CANONICAL FACTOR</small>
          <strong>{formatDecimalExact(factor, { maximumFractionDigits: 10 })} {dimension === "length" ? "m" : "sqm"}</strong>
          <p>Display rounding never changes this Decimal-string factor.</p>
        </section>
        {error && <p className="unit-error">{error}</p>}
        <UnitSaveNotice visible={saved}>{editId ? "Custom unit updated" : "Custom unit saved"}</UnitSaveNotice>
        <button className="unit-primary" type="button" onClick={save}>
          <Plus size={18} /> {editId ? "Update Custom Unit" : "Save Custom Unit"}
        </button>
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
