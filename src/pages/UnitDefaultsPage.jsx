import { ArrowLeftRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UnitScreen } from "../components/UnitScreen";
import { useAppStore } from "../store/useAppStore";
import { useUnitStore } from "../store/useUnitStore";

export function UnitDefaultsPage() {
  const user = useAppStore((state) => state.user);
  const entitlements = useAppStore((state) => state.entitlements);
  const isGuest = useAppStore((state) => state.isGuest);
  const {
    hydrate,
    status,
    standaloneCustomUnits,
    compoundRecipes,
    deleteStandaloneUnit,
    deleteCompoundRecipe,
  } = useUnitStore();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    hydrate(user?.id ?? "guest", { ...entitlements, isGuest: isGuest || !user });
  }, [entitlements, hydrate, isGuest, user]);

  const removeUnit = async (unit) => {
    if (!window.confirm(`Delete custom unit “${unit.name}”?`)) return;
    setError("");
    try {
      const result = await deleteStandaloneUnit(unit.id);
      setMessage(result.archived
        ? "This unit is used by saved data, so it was archived instead of permanently deleted."
        : "Custom unit deleted.");
    } catch (caught) {
      setError(caught.message);
    }
  };

  const removeRecipe = async (recipe) => {
    if (!window.confirm(`Delete compound setup “${recipe.name}”?`)) return;
    setError("");
    try {
      const result = await deleteCompoundRecipe(recipe.id);
      setMessage(result.archived
        ? "This compound setup is used by saved data, so it was archived instead."
        : "Compound setup deleted.");
    } catch (caught) {
      setError(caught.message);
    }
  };

  const activeUnits = standaloneCustomUnits.filter((item) => !item.isArchived);
  const activeRecipes = compoundRecipes.filter((item) => !item.isArchived);

  return (
    <UnitScreen
      title="Unit Setup"
      subtitle="Custom units and compound display only"
      backTo="/dashboard"
    >
      <div className="unit-content simple-unit-setup">
        <section className="unit-intro">
          <span><ArrowLeftRight size={21} /></span>
          <div>
            <h1>Simple Unit Setup</h1>
            <p>
              The regional Unit Engine is temporarily on hold. For now, manage only
              your own custom units and compound output formats.
            </p>
          </div>
        </section>

        <section className="simple-crud-section">
          <header>
            <div>
              <h2>Custom Units</h2>
              <p>Create a length or area unit from one standard-unit equivalence.</p>
            </div>
            <Link className="unit-primary unit-primary--compact" to="/units/custom">
              <Plus size={17} /> Add Custom Unit
            </Link>
          </header>
          <div className="simple-crud-list">
            {status === "loading" && <p>Loading custom units…</p>}
            {status !== "loading" && activeUnits.length === 0 && (
              <p className="unit-empty-copy">No custom units added yet.</p>
            )}
            {activeUnits.map((unit) => (
              <article key={unit.id}>
                <div>
                  <strong>{unit.name}</strong>
                  <small>
                    {unit.symbol} · {unit.dimension === "length" ? "Length" : "Area"}
                  </small>
                </div>
                <div className="simple-crud-actions">
                  <Link to={`/units/custom?edit=${encodeURIComponent(unit.id)}`} aria-label={`Edit ${unit.name}`}>
                    <Pencil size={16} /> Edit
                  </Link>
                  <button type="button" onClick={() => removeUnit(unit)} aria-label={`Delete ${unit.name}`}>
                    <Trash2 size={16} /> Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="simple-crud-section">
          <header>
            <div>
              <h2>Compound Unit Setup</h2>
              <p>Combine compatible units into a mixed display such as Acre · Sq Yard · Sq Ft.</p>
            </div>
            <Link className="unit-primary unit-primary--compact" to="/units/compound">
              <Plus size={17} /> Add Compound Setup
            </Link>
          </header>
          <div className="simple-crud-list">
            {status !== "loading" && activeRecipes.length === 0 && (
              <p className="unit-empty-copy">No compound setups added yet.</p>
            )}
            {activeRecipes.map((recipe) => (
              <article key={recipe.id}>
                <div>
                  <strong>{recipe.name}</strong>
                  <small>{recipe.unitIds.join(" → ")}</small>
                </div>
                <div className="simple-crud-actions">
                  <Link to={`/units/compound?edit=${encodeURIComponent(recipe.id)}`} aria-label={`Edit ${recipe.name}`}>
                    <Pencil size={16} /> Edit
                  </Link>
                  <button type="button" onClick={() => removeRecipe(recipe)} aria-label={`Delete ${recipe.name}`}>
                    <Trash2 size={16} /> Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {message && <p className="unit-save-notice">{message}</p>}
        {error && <p className="unit-error">{error}</p>}
      </div>
    </UnitScreen>
  );
}
