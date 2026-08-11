import { CheckCircle2, Info, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { SubscriptionDialog } from "../components/SubscriptionDialog";
import { UnitSaveNotice, UnitScreen } from "../components/UnitScreen";
import { unitEngine } from "../services/UnitEngine";
import { localDatabaseService } from "../services/LocalDatabaseService";
import { useAppStore } from "../store/useAppStore";
import { useUnitStore } from "../store/useUnitStore";
import { formatDecimalExact } from "../utils/exactFormat";

const format = (value, maximumFractionDigits = 5) =>
  formatDecimalExact(value, { maximumFractionDigits });

export function LocalUnitCalibrationPage() {
  const { packId } = useParams();
  const [searchParams] = useSearchParams();
  const editProfileId = searchParams.get("profileId");
  const resumeDraftId = searchParams.get("draftId");
  const navigate = useNavigate();
  const user = useAppStore((state) => state.user);
  const entitlements = useAppStore((state) => state.entitlements);
  const isGuest = useAppStore((state) => state.isGuest);
  const {
    units,
    hydrate,
    calibrateSuggestedFamily,
    saveDraft,
    locationSuggestions,
    capabilities,
    preferences,
  } = useUnitStore();
  const [knownKey, setKnownKey] = useState("");
  const [selectedFamilyId, setSelectedFamilyId] = useState("");
  const [value, setValue] = useState("");
  const [sourceUnitId, setSourceUnitId] = useState("SQFT");
  const [multipliers, setMultipliers] = useState({});
  const [relationshipsConfirmed, setRelationshipsConfirmed] = useState(false);
  const [finalConfirmed, setFinalConfirmed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [error, setError] = useState("");
  const [paywallDraftId, setPaywallDraftId] = useState(null);

  useEffect(() => {
    hydrate(user?.id ?? "guest", { ...entitlements, isGuest: isGuest || !user });
  }, [entitlements, hydrate, isGuest, user]);

  const pack = useMemo(() => {
    try {
      return packId ? unitEngine.getSuggestionPack(packId) : null;
    } catch {
      return null;
    }
  }, [packId]);
  useEffect(() => {
    setSelectedFamilyId(pack?.data.familyTemplates[0]?.id ?? "");
  }, [pack]);
  const family = pack?.data.familyTemplates.find((candidate) =>
    candidate.id === selectedFamilyId) ?? pack?.data.familyTemplates[0] ?? null;
  const sourceDraft = useMemo(
    () => pack && family ? unitEngine.createDraftFromSuggestion(pack.manifest.id, family.id) : null,
    [family, pack],
  );
  const familyVariants = useMemo(() => sourceDraft?.members ?? [], [sourceDraft]);
  const relationships = useMemo(() => sourceDraft?.relationships ?? [], [sourceDraft]);
  const tools = useMemo(() => sourceDraft?.tools ?? [], [sourceDraft]);
  const knownOptions = useMemo(() => [
    ...familyVariants.map((variant) => ({
      key: `unit_area:${variant.id}`,
      kind: "unit_area",
      referenceId: variant.id,
      label: variant.name,
      dimension: variant.dimension,
    })),
    ...tools.filter((tool) => tool.derivedArea).map((tool) => ({
      key: `tool_length:${tool.id}`,
      kind: "tool_length",
      referenceId: tool.id,
      label: `${tool.name} — measuring tool`,
      dimension: "length",
    })),
  ], [familyVariants, tools]);

  useEffect(() => {
    if (knownOptions.length) setKnownKey(knownOptions[0].key);
  }, [knownOptions]);
  useEffect(() => {
    setMultipliers(Object.fromEntries(
      relationships.map((relationship) => [relationship.id, relationship.multiplier]),
    ));
    setRelationshipsConfirmed(false);
  }, [relationships]);
  useEffect(() => {
    if (!editProfileId || !sourceDraft) return;
    localDatabaseService.getUserLocalProfile(editProfileId).then((profile) => {
      if (!profile) return;
      setMultipliers({
        ...Object.fromEntries(sourceDraft.relationships.map((item) => [item.id, item.multiplier])),
        ...(profile.hierarchyMultipliers ?? {}),
      });
      setRelationshipsConfirmed(true);
      const savedAnchor = profile.anchor ?? profile.knownBasis;
      if (savedAnchor) {
        setKnownKey(`${savedAnchor.kind}:${savedAnchor.referenceId}`);
        setValue(savedAnchor.value);
        setSourceUnitId(savedAnchor.sourceUnitId);
      }
      setFinalConfirmed(false);
    }).catch((caught) => setError(caught.message));
  }, [editProfileId, sourceDraft]);
  useEffect(() => {
    if (!resumeDraftId || !sourceDraft) return;
    localDatabaseService.getUnitDraft(user?.id ?? "guest", resumeDraftId).then((savedDraft) => {
      if (!savedDraft) return;
      if (savedDraft.familyId) setSelectedFamilyId(savedDraft.familyId);
      setMultipliers(Object.fromEntries(
        savedDraft.relationships.map((relationship) => [relationship.id, relationship.multiplier]),
      ));
      setRelationshipsConfirmed(
        savedDraft.relationships.every((relationship) => relationship.confirmedByUser),
      );
      if (savedDraft.anchor) {
        setKnownKey(`${savedDraft.anchor.kind}:${savedDraft.anchor.referenceId}`);
        setValue(savedDraft.anchor.value);
        setSourceUnitId(savedDraft.anchor.sourceUnitId);
      }
      setFinalConfirmed(savedDraft.status === "preview_ready");
    }).catch((caught) => setError(caught.message));
  }, [resumeDraftId, sourceDraft, user?.id]);

  const selectedKnown = knownOptions.find((option) => option.key === knownKey);
  const sourceUnits = useMemo(() => units.filter((unit) =>
    unit.dimension === selectedKnown?.dimension
    && unit.factorToBase !== null
    && unit.trustTier !== "suggested"
    && unit.visibility !== "legacy_profile_only"
    && (unit.status !== "historical" || preferences.advancedUnitsEnabled)),
  [preferences.advancedUnitsEnabled, selectedKnown, units]);
  useEffect(() => {
    if (!selectedKnown) return;
    if (!editProfileId && !resumeDraftId) {
      const preferred = selectedKnown.dimension === "length" ? "FOOT" : "SQFT";
      setSourceUnitId(sourceUnits.some((unit) => unit.id === preferred)
        ? preferred
        : sourceUnits[0]?.id ?? "");
      setValue("");
      setFinalConfirmed(false);
    }
  }, [editProfileId, knownKey, resumeDraftId, selectedKnown, sourceUnits]);

  const confirmedDraft = useMemo(() => sourceDraft && ({
    ...sourceDraft,
    relationships: sourceDraft.relationships.map((relationship) => ({
      ...relationship,
      multiplier: multipliers[relationship.id],
      confirmedByUser: relationshipsConfirmed,
    })),
  }), [multipliers, relationshipsConfirmed, sourceDraft]);
  const anchor = useMemo(() => selectedKnown && value && sourceUnitId ? {
    kind: selectedKnown.kind,
    referenceId: selectedKnown.referenceId,
    value,
    sourceUnitId,
  } : null, [selectedKnown, sourceUnitId, value]);
  const previewState = useMemo(() => {
    if (!confirmedDraft || !relationshipsConfirmed || !anchor) {
      return { preview: null, error: "" };
    }
    try {
      return { preview: unitEngine.derivePreview(confirmedDraft, anchor), error: "" };
    } catch (caught) {
      return { preview: null, error: caught.message };
    }
  }, [anchor, confirmedDraft, relationshipsConfirmed]);
  const preview = previewState.preview;

  if (!packId) {
    return (
      <UnitScreen title="Local family setup" subtitle="Choose a location-matched suggestion" backTo="/units">
        <div className="unit-content">
          <section className="unit-intro">
            <span><Sparkles size={21} /></span>
            <div><h1>Select a possible family</h1><p>Suggestions are setup shortcuts, not confirmed conversion facts.</p></div>
          </section>
          {!locationSuggestions.suggested.length && (
            <aside className="unit-disclaimer">
              <Info size={17} />
              <span>No matching family is available. Confirm a location or create your own family.</span>
            </aside>
          )}
          <div className="pack-results">
            {locationSuggestions.suggested.map((candidate) => (
              <article key={candidate.manifest.id}>
                <span className="pack-tier pack-tier--suggested">Research suggestion</span>
                <strong>{candidate.manifest.name}</strong>
                <Link to={`/units/calibrate/${candidate.manifest.id}`}>Open setup</Link>
              </article>
            ))}
          </div>
          <Link className="unit-secondary" to="/units/location">Confirm location</Link>
        </div>
      </UnitScreen>
    );
  }

  if (!pack || !family || !sourceDraft) {
    return (
      <UnitScreen title="Unit suggestion unavailable" backTo="/units">
        <div className="unit-content"><p className="unit-error">This suggestion has no calibratable family.</p></div>
      </UnitScreen>
    );
  }

  const save = async () => {
    setError("");
    if (!preview || !finalConfirmed) {
      setError("Confirm the relationships, known size, and derived preview before saving.");
      return;
    }
    if (!capabilities.canSaveLocalProfiles) {
      const savedDraft = await saveDraft({
        ...confirmedDraft,
        anchor,
        status: "preview_ready",
      });
      setPaywallDraftId(savedDraft.id);
      setPaywallOpen(true);
      return;
    }
    try {
      await calibrateSuggestedFamily({
        draft: confirmedDraft,
        name: `${pack.manifest.name} — My profile`,
        packId: pack.manifest.id,
        familyId: family.id,
        anchor,
        hierarchyMultipliers: multipliers,
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (caught) {
      setError(caught.message);
    }
  };

  return (
    <UnitScreen
      title="Set up local family"
      subtitle={pack.manifest.name}
      backTo="/units/location"
      step={{ current: relationshipsConfirmed ? 2 : 1, total: 3, label: "Relationships → one known size → preview" }}
    >
      <div className="unit-content">
        <section className="calibration-heading">
          <span><Sparkles size={22} /></span>
          <h1>Build your verified-by-you profile</h1>
          <p>
            {editProfileId
              ? "Editing creates a new immutable profile revision; the saved source remains unchanged."
              : "The research suggestion stays unchanged. Your edits belong only to your versioned profile."}
          </p>
        </section>

        <span className="pack-tier pack-tier--suggested">Unverified research suggestion</span>
        {pack.data.familyTemplates.length > 1 && (
          <label className="unit-field">
            <span>Choose the local family template</span>
            <select
              value={family.id}
              onChange={(event) => {
                setSelectedFamilyId(event.target.value);
                setRelationshipsConfirmed(false);
                setFinalConfirmed(false);
              }}
            >
              {pack.data.familyTemplates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name ?? candidate.id}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="unit-section-label">1. Confirm relationships first</div>
        <div className="hierarchy-editor">
          {relationships.map((relationship) => {
            const parent = familyVariants.find((unit) => unit.id === relationship.parentUnitId);
            const child = familyVariants.find((unit) => unit.id === relationship.childUnitId);
            return (
              <label key={relationship.id}>
                <span>1 {parent?.name.replace(/\s*\(.*/, "")} =</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={multipliers[relationship.id] ?? ""}
                  onChange={(event) => {
                    setMultipliers((current) => ({ ...current, [relationship.id]: event.target.value }));
                    setRelationshipsConfirmed(false);
                  }}
                />
                <span>{child?.name.replace(/\s*\(.*/, "")}</span>
              </label>
            );
          })}
          <label className="profile-confirmation profile-confirmation--inside">
            <input
              type="checkbox"
              checked={relationshipsConfirmed}
              onChange={(event) => setRelationshipsConfirmed(event.target.checked)}
            />
            <span>I confirm every multiplication relationship above.</span>
          </label>
        </div>

        {relationshipsConfirmed && (
          <>
            <div className="unit-section-label">2. Choose exactly one known unit</div>
            <div className="unit-pills unit-pills--scroll" role="group" aria-label="Known local value">
              {knownOptions.map((option) => (
                <button
                  type="button"
                  key={option.key}
                  className={knownKey === option.key ? "is-active" : ""}
                  onClick={() => setKnownKey(option.key)}
                >
                  {option.label.replace(/\s*\(.*/, "")}
                </button>
              ))}
            </div>
            <div className="calibration-equation">
              <span>1 {selectedKnown?.label}</span><strong>=</strong>
              <input aria-label="Known local unit size" type="number" min="0" step="any" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Known size" />
              <select aria-label="Known size standard unit" value={sourceUnitId} onChange={(event) => setSourceUnitId(event.target.value)}>
                {sourceUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.symbol}</option>)}
              </select>
            </div>
          </>
        )}

        {preview && (
          <>
            <div className="unit-section-label">3. Readonly derived preview</div>
            <section className="derived-card">
              <header><Sparkles size={17} /><strong>Derived only from your ratios and one anchor</strong><small>PREVIEW</small></header>
              {familyVariants.map((variant) => (
                <div key={variant.id}>
                  <span>1 {variant.name.replace(/\s*\(.*/, "")}</span>
                  <strong>
                    {format(unitEngine.fromBaseExact(preview.derivedFactors[variant.id], "SQFT"))} sq ft · {format(preview.derivedFactors[variant.id])} sqm
                  </strong>
                </div>
              ))}
            </section>
            <label className="profile-confirmation">
              <input type="checkbox" checked={finalConfirmed} onChange={(event) => setFinalConfirmed(event.target.checked)} />
              <span><CheckCircle2 size={17} /> I confirm this setup for my local practice. Status: Verified by you.</span>
            </label>
          </>
        )}

        <aside className="unit-disclaimer"><Info size={17} /><span>{pack.data.warnings.join(" ")}</span></aside>
        {previewState.error && <p className="unit-error">{previewState.error}</p>}
        {error && <p className="unit-error">{error}</p>}
        <UnitSaveNotice visible={saved}>Versioned unit profile saved</UnitSaveNotice>
        <button className="unit-primary" type="button" onClick={save} disabled={!preview || !finalConfirmed}>
          Confirm & Save
        </button>
      </div>
      <SubscriptionDialog
        open={paywallOpen}
        isAuthenticated={Boolean(user)}
        onClose={() => setPaywallOpen(false)}
        onContinueFree={() => navigate("/dashboard")}
        draftId={paywallDraftId}
        returnTo={paywallDraftId
          ? `/units/calibrate/${pack.manifest.id}?draftId=${encodeURIComponent(paywallDraftId)}`
          : undefined}
      />
    </UnitScreen>
  );
}
