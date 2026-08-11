import { ListPlus, Plus, Trash2 } from "lucide-react";
import Decimal from "decimal.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SubscriptionDialog } from "../components/SubscriptionDialog";
import { UnitSaveNotice, UnitScreen } from "../components/UnitScreen";
import { unitEngine } from "../services/UnitEngine";
import { localDatabaseService } from "../services/LocalDatabaseService";
import { useAppStore } from "../store/useAppStore";
import { useUnitStore } from "../store/useUnitStore";

export function CompoundRecipePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeDraftId = searchParams.get("draftId");
  const editId = searchParams.get("edit");
  const loadedEditRef = useRef(null);
  const user = useAppStore((state) => state.user);
  const entitlements = useAppStore((state) => state.entitlements);
  const isGuest = useAppStore((state) => state.isGuest);
  const {
    units,
    runtimeFactors,
    compoundRecipes,
    preferences,
    hydrate,
    capabilities,
    saveDraft,
    saveCompoundRecipe,
  } = useUnitStore();
  const [dimension, setDimension] = useState("area");
  const [name, setName] = useState("My mixed area output");
  const [unitIds, setUnitIds] = useState(["ACRE", "SQYD", "SQFT"]);
  const [precision, setPrecision] = useState(2);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [sampleValue, setSampleValue] = useState("5000");
  const [paywallDraftId, setPaywallDraftId] = useState(null);
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
  useEffect(() => {
    if (!resumeDraftId) return;
    localDatabaseService.getUnitDraft(user?.id ?? "guest", resumeDraftId).then((draft) => {
      if (!draft) return;
      setDimension(draft.dimension);
      setName(draft.name);
      setUnitIds(draft.unitIds);
      setPrecision(draft.precision);
    }).catch((caught) => setError(caught.message));
  }, [resumeDraftId, user?.id]);
  useEffect(() => {
    if (!editId || loadedEditRef.current === editId) return;
    const recipe = compoundRecipes.find((item) => item.id === editId);
    if (!recipe) return;
    loadedEditRef.current = editId;
    setDimension(recipe.dimension);
    setName(recipe.name);
    setUnitIds(recipe.unitIds);
    setPrecision(recipe.precision);
  }, [compoundRecipes, editId]);
  useEffect(() => {
    if (
      editId
      && hydrationAttempted
      && !compoundRecipes.some((item) => item.id === editId)
    ) {
      navigate("/units", { replace: true });
    }
  }, [compoundRecipes, editId, hydrationAttempted, navigate]);
  const compatibleUnits = useMemo(() => units
    .filter((unit) =>
      unit.dimension === dimension
      && (unit.factorToBase !== null || runtimeFactors[unit.id])
      && (unit.status !== "historical" || preferences.advancedUnitsEnabled))
    .sort((a, b) => new Decimal(b.factorToBase ?? runtimeFactors[b.id])
      .cmp(new Decimal(a.factorToBase ?? runtimeFactors[a.id]))),
  [dimension, preferences.advancedUnitsEnabled, units, runtimeFactors]);
  const switchDimension = (next) => {
    setDimension(next);
    setName(`My mixed ${next} output`);
    setUnitIds(next === "length" ? ["MILE", "YARD", "FOOT"] : ["ACRE", "SQYD", "SQFT"]);
  };

  const updateUnit = (index, value) =>
    setUnitIds((current) => current.map((id, itemIndex) => itemIndex === index ? value : id));
  const preview = useMemo(() => {
    try {
      const recipe = { unitIds, precision, separator: " " };
      const context = { runtimeFactors, units };
      return unitEngine.formatResult(sampleValue || "0", recipe, context).text;
    } catch (caught) {
      return `Preview unavailable: ${caught.message}`;
    }
  }, [precision, runtimeFactors, sampleValue, unitIds, units]);
  const save = async () => {
    setError("");
    if (!capabilities.canManageCustomUnits) {
      const savedDraft = await saveDraft({
        draftType: "compound_recipe",
        name,
        dimension,
        unitIds,
        precision,
        separator: " ",
        status: "preview_ready",
      });
      setPaywallDraftId(savedDraft.id);
      setPaywallOpen(true);
      return;
    }
    try {
      const existing = compoundRecipes.find((item) => item.id === editId);
      await saveCompoundRecipe({
        id: editId ?? undefined,
        createdAt: existing?.createdAt,
        name,
        dimension,
        unitIds,
        precision,
        separator: " ",
      });
      setSaved(true);
      window.setTimeout(() => navigate("/units"), 700);
    } catch (caught) {
      setError(caught.message);
    }
  };

  return (
    <UnitScreen
      title={editId ? "Edit Compound Unit Setup" : "Add Compound Unit Setup"}
      subtitle="Mixed display only — no new conversion factor"
      backTo="/units"
    >
      <div className="unit-content">
        <section className="unit-intro">
          <span><ListPlus size={21} /></span>
          <div>
            <h1>{editId ? "Update compound setup" : "Build a compound display"}</h1>
            <p>Order compatible units from largest to smallest.</p>
          </div>
        </section>
        <div className="dimension-tabs">
          <button type="button" className={dimension === "length" ? "is-active" : ""} onClick={() => switchDimension("length")}>Length</button>
          <button type="button" className={dimension === "area" ? "is-active" : ""} onClick={() => switchDimension("area")}>Area</button>
        </div>
        <label className="unit-field"><span>Recipe name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <div className="recipe-list">
          {unitIds.map((unitId, index) => (
            <div key={`${index}-${unitId}`}>
              <span>{index + 1}</span>
              <select aria-label={`Component ${index + 1}`} value={unitId} onChange={(event) => updateUnit(index, event.target.value)}>
                {compatibleUnits.map((unit) => (
                  <option
                    key={unit.id}
                    value={unit.id}
                    disabled={unitIds.some((selectedId, selectedIndex) =>
                      selectedIndex !== index && selectedId === unit.id)}
                  >
                    {unit.name} ({unit.symbol})
                  </option>
                ))}
              </select>
              <button type="button" aria-label="Remove unit" onClick={() => setUnitIds((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={unitIds.length <= 2}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
        <button className="unit-secondary" type="button" onClick={() => setUnitIds((current) => [...current, compatibleUnits.find((unit) => !current.includes(unit.id))?.id ?? compatibleUnits.at(-1)?.id])}><Plus size={16} /> Add component</button>
        <label className="unit-field"><span>Final component precision</span><input type="number" min="0" max="10" value={precision} onChange={(event) => setPrecision(Number(event.target.value))} /></label>
        <label className="unit-field">
          <span>Sample canonical {dimension === "length" ? "metres" : "square metres"}</span>
          <input type="text" inputMode="decimal" value={sampleValue} onChange={(event) => setSampleValue(event.target.value)} />
        </label>
        <section className="derived-card">
          <header><ListPlus size={17} /><strong>Live display preview</strong><small>DISPLAY ONLY</small></header>
          <div><span>Output</span><strong>{preview}</strong></div>
        </section>
        {error && <p className="unit-error">{error}</p>}
        <UnitSaveNotice visible={saved}>
          {editId ? "Compound setup updated" : "Compound setup saved"}
        </UnitSaveNotice>
        <button className="unit-primary" type="button" onClick={save}>
          {editId ? "Update Compound Setup" : "Save Compound Setup"}
        </button>
      </div>
      <SubscriptionDialog
        open={paywallOpen}
        isAuthenticated={Boolean(user)}
        onClose={() => setPaywallOpen(false)}
        onContinueFree={() => navigate("/dashboard")}
        draftId={paywallDraftId}
        returnTo={paywallDraftId
          ? `/units/compound?draftId=${encodeURIComponent(paywallDraftId)}`
          : undefined}
      />
    </UnitScreen>
  );
}
