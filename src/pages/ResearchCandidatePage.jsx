import { AlertTriangle, BookOpen, ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { UnitScreen } from "../components/UnitScreen";
import { researchSuggestionCatalogRepository } from "../services/ResearchSuggestionCatalogRepository";
import { unitEngine } from "../services/UnitEngine";
import { useAppStore } from "../store/useAppStore";
import { useUnitStore } from "../store/useUnitStore";

const nonActionableRoles = new Set([
  "ambiguous_reference_only",
  "non_geometric_reference_only",
]);

export function ResearchCandidatePage() {
  const { packId } = useParams();
  const navigate = useNavigate();
  const user = useAppStore((state) => state.user);
  const entitlements = useAppStore((state) => state.entitlements);
  const isGuest = useAppStore((state) => state.isGuest);
  const { hydrate, saveDraft } = useUnitStore();
  const [pack, setPack] = useState(null);
  const [selected, setSelected] = useState([]);
  const [dimension, setDimension] = useState("area");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    hydrate(user?.id ?? "guest", { ...entitlements, isGuest: isGuest || !user });
  }, [entitlements, hydrate, isGuest, user]);
  useEffect(() => {
    researchSuggestionCatalogRepository.getPack(packId)
      .then(setPack)
      .catch((caught) => setError(caught.message));
  }, [packId]);

  const visible = useMemo(() => (pack?.candidates ?? [])
    .filter((candidate) => candidate.dimension === dimension), [dimension, pack]);
  const uniqueCandidates = useMemo(() => {
    const seen = new Set();
    const normalizedQuery = query.trim().toLowerCase();
    return visible.filter((candidate) => {
      const key = `${candidate.unitConcept.toLowerCase()}|${candidate.role}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return !normalizedQuery || [
        candidate.unitConcept,
        candidate.locationLabel,
        ...(candidate.aliases ?? []),
        candidate.role,
      ].some((value) => String(value ?? "").toLowerCase().includes(normalizedQuery));
    });
  }, [query, visible]);
  const actionableSelection = selected.filter((id) => {
    const candidate = pack?.candidates.find((item) => item.sourceRecordId === id);
    return candidate && !nonActionableRoles.has(candidate.role);
  });

  const continueToDraft = async () => {
    setError("");
    try {
      const draft = await unitEngine.createDraftFromResearchCandidates(packId, actionableSelection);
      const saved = await saveDraft({
        ...draft,
        returnRoute: `/units/research/${packId}`,
        validationStatus: "not_validated",
      });
      navigate(`/units/custom-family?draftId=${encodeURIComponent(saved.id)}`);
    } catch (caught) {
      setError(caught.message);
    }
  };

  return (
    <UnitScreen
      title="Research candidate review"
      subtitle="References only — not conversion facts"
      backTo="/units/location"
    >
      <div className="unit-content">
        <section className="unit-intro">
          <span><BookOpen size={21} /></span>
          <div>
            <h1>{pack?.name ?? "Loading research candidates…"}</h1>
            <p>Select relevant names only. PlotScale will never copy a research factor into your setup.</p>
          </div>
        </section>
        {pack?.hasConflicts && (
          <aside className="unit-disclaimer">
            <AlertTriangle size={17} />
            <span>Conflicting assertions are kept separate. Do not combine units from different local systems.</span>
          </aside>
        )}
        <div className="dimension-tabs">
          <button type="button" className={dimension === "length" ? "is-active" : ""} onClick={() => { setDimension("length"); setSelected([]); }}>Length/tools</button>
          <button type="button" className={dimension === "area" ? "is-active" : ""} onClick={() => { setDimension("area"); setSelected([]); }}>Area</button>
        </div>
        <label className="unit-field">
          <span>Filter by unit, alias or locality</span>
          <div className="searchable-country__input">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="e.g. Assam, Katha, Karam"
            />
          </div>
        </label>
        <div className="research-candidate-list">
          {uniqueCandidates.map((candidate) => {
            const disabled = nonActionableRoles.has(candidate.role);
            return (
              <label key={candidate.sourceRecordId} className={disabled ? "is-disabled" : ""}>
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={selected.includes(candidate.sourceRecordId)}
                  onChange={(event) => setSelected((current) =>
                    event.target.checked
                      ? [...current, candidate.sourceRecordId]
                      : current.filter((id) => id !== candidate.sourceRecordId))}
                />
                <span>
                  <strong>{candidate.unitConcept}</strong>
                  <small>{candidate.locationLabel} · {candidate.role.replaceAll("_", " ")}</small>
                  <small>Source locator: {candidate.sourceLocator}</small>
                  {disabled && <em>Reference-only; cannot become a conversion unit.</em>}
                </span>
              </label>
            );
          })}
        </div>
        {!uniqueCandidates.length && <p className="unit-assist-note">No {dimension} candidates are classified in this pack.</p>}
        {error && <p className="unit-error">{error}</p>}
        <button
          type="button"
          className="unit-primary"
          disabled={!actionableSelection.length}
          onClick={continueToDraft}
        >
          Build editable family draft <ChevronRight size={17} />
        </button>
      </div>
    </UnitScreen>
  );
}
