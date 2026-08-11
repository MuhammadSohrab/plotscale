import { ArrowDownUp, Check, Copy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { UnitScreen } from "../components/UnitScreen";
import { unitEngine } from "../services/UnitEngine";
import { useAppStore } from "../store/useAppStore";
import { useUnitStore } from "../store/useUnitStore";
import { formatDecimalExact } from "../utils/exactFormat";

const display = (value, digits = 8) =>
  formatDecimalExact(value, { maximumFractionDigits: digits });

export function UnitConverterPage() {
  const user = useAppStore((state) => state.user);
  const entitlements = useAppStore((state) => state.entitlements);
  const isGuest = useAppStore((state) => state.isGuest);
  const {
    units,
    standaloneCustomUnits,
    runtimeFactors,
    activeProfile,
    profiles,
    compoundRecipes,
    preferences,
    capabilities,
    status,
    hydrate,
    setActiveProfile,
  } = useUnitStore();
  const [dimension, setDimension] = useState("area");
  const [value, setValue] = useState("1");
  const [fromUnitId, setFromUnitId] = useState("ACRE");
  const [toUnitId, setToUnitId] = useState("SQM");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    hydrate(user?.id ?? "guest", { ...entitlements, isGuest: isGuest || !user });
  }, [entitlements, hydrate, isGuest, user]);

  const context = useMemo(() => ({
    dimension,
    capabilities,
    profiles: activeProfile ? [activeProfile] : [],
    units,
    customUnits: standaloneCustomUnits,
    runtimeFactors,
    advancedUnitsEnabled: preferences.advancedUnitsEnabled,
  }), [
    activeProfile,
    capabilities,
    dimension,
    preferences.advancedUnitsEnabled,
    runtimeFactors,
    standaloneCustomUnits,
    units,
  ]);
  const availableUnits = useMemo(() =>
    unitEngine.listAvailableUnits(context), [context]);

  useEffect(() => {
    if (status !== "ready" || !availableUnits.length) return;
    const preferredFrom = dimension === "length" ? "METER" : "ACRE";
    const preferredTo = dimension === "length" ? "FOOT" : "SQM";
    setFromUnitId((current) =>
      availableUnits.some((unit) => unit.id === current) ? current : preferredFrom);
    setToUnitId((current) =>
      availableUnits.some((unit) => unit.id === current) ? current : preferredTo);
  }, [availableUnits, dimension, status]);

  const result = useMemo(() => {
    try {
      const converted = unitEngine.convertExact({
        value: value || 0,
        fromUnitId,
        toUnitId,
      }, context);
      const baseUnitId = dimension === "length" ? "METER" : "SQM";
      const base = unitEngine.convertExact({
        value: value || 0,
        fromUnitId,
        toUnitId: baseUnitId,
      }, context);
      const activeRecipe = compoundRecipes.find((recipe) =>
        !recipe.isArchived
        && recipe.id === preferences.activeCompoundRecipeId
        && recipe.dimension === dimension)
        ?? compoundRecipes.find((recipe) => !recipe.isArchived && recipe.dimension === dimension);
      const composite = activeRecipe
        ? unitEngine.formatResult(base, activeRecipe, context).text
        : "";
      return { base, converted, composite, error: "" };
    } catch (error) {
      return { base: "0", converted: "0", composite: "", error: error.message };
    }
  }, [
    compoundRecipes,
    context,
    dimension,
    fromUnitId,
    preferences.activeCompoundRecipeId,
    toUnitId,
    value,
  ]);
  const toUnit = availableUnits.find((item) => item.id === toUnitId);

  const swap = () => {
    setFromUnitId(toUnitId);
    setToUnitId(fromUnitId);
  };
  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(`${display(result.converted)} ${toUnit?.symbol ?? ""}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <UnitScreen headerBrand backTo="/dashboard">
      <div className="unit-content converter-content">
        <div className="converter-title">
          <span>Unit Converter</span>
          <small>Central UnitEngine · exact offline normalization</small>
        </div>

        <div className="dimension-tabs">
          <button type="button" className={dimension === "length" ? "is-active" : ""} onClick={() => setDimension("length")}>Length</button>
          <button type="button" className={dimension === "area" ? "is-active" : ""} onClick={() => setDimension("area")}>Area</button>
        </div>

        {capabilities.canUseLocalProfiles && profiles.length > 1 && (
          <label className="unit-select-card">
            <span>Regional unit profile</span>
            <select value={activeProfile?.id ?? ""} onChange={(event) => setActiveProfile(event.target.value)}>
              {profiles.filter((item) => !item.migrationState && !item.isArchived).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
        )}

        <label className="converter-box">
          <span>FROM</span>
          <div>
            <input type="number" step="any" value={value} onChange={(event) => setValue(event.target.value)} />
            <select value={fromUnitId} onChange={(event) => setFromUnitId(event.target.value)}>
              {availableUnits.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
        </label>
        <button className="converter-swap" type="button" onClick={swap} aria-label="Swap units"><ArrowDownUp size={19} /></button>
        <label className="converter-box converter-box--result">
          <span>TO</span>
          <div>
            <output>{display(result.converted)}</output>
            <select value={toUnitId} onChange={(event) => setToUnitId(event.target.value)}>
              {availableUnits.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
        </label>

        {result.error ? <p className="unit-error">{result.error}</p> : (
          <section className="converter-breakdown">
            <small>CANONICAL BASE</small>
            <strong>{display(result.base)} {dimension === "length" ? "m" : "sqm"}</strong>
            {result.composite && <p>{result.composite}</p>}
          </section>
        )}

        {!capabilities.canUseLocalProfiles && (
          <p className="converter-hint">
            Standard units are free. Saved local and custom units become available with a subscription.
          </p>
        )}
        <button className="unit-secondary" type="button" onClick={copy}>
          {copied ? <Check size={18} /> : <Copy size={18} />} {copied ? "Copied" : "Copy Result"}
        </button>
      </div>
    </UnitScreen>
  );
}
