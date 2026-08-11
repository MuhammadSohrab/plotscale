import { Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SubscriptionDialog } from "../components/SubscriptionDialog";
import { UnitScreen } from "../components/UnitScreen";
import { unitEngine } from "../services/UnitEngine";
import { localDatabaseService } from "../services/LocalDatabaseService";
import { useAppStore } from "../store/useAppStore";
import { useUnitStore } from "../store/useUnitStore";
import { formatDecimalExact } from "../utils/exactFormat";

const makeMember = (dimension, index) => ({
  id: `CUSTOM_MEMBER_${crypto.randomUUID()}`,
  name: `Unit ${index + 1}`,
  symbol: `u${index + 1}`,
  dimension,
  aliases: [],
});

export function CustomFamilyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get("draftId");
  const user = useAppStore((state) => state.user);
  const entitlements = useAppStore((state) => state.entitlements);
  const isGuest = useAppStore((state) => state.isGuest);
  const {
    hydrate,
    capabilities,
    customTools,
    saveDraft,
    activateCustomFamily,
  } = useUnitStore();
  const [dimension, setDimension] = useState("area");
  const [name, setName] = useState("My local unit family");
  const [members, setMembers] = useState(() => [makeMember("area", 0), makeMember("area", 1)]);
  const [multipliers, setMultipliers] = useState(["20"]);
  const [relationshipsConfirmed, setRelationshipsConfirmed] = useState(false);
  const [anchorMemberId, setAnchorMemberId] = useState(members[0].id);
  const [anchorValue, setAnchorValue] = useState("");
  const [sourceUnitId, setSourceUnitId] = useState("SQFT");
  const [finalConfirmed, setFinalConfirmed] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallDraftId, setPaywallDraftId] = useState(null);
  const [error, setError] = useState("");
  const [anchorMode, setAnchorMode] = useState("unit");
  const [anchorToolId, setAnchorToolId] = useState("");
  const [toolAreaMultiplier, setToolAreaMultiplier] = useState("1");

  useEffect(() => {
    hydrate(user?.id ?? "guest", { ...entitlements, isGuest: isGuest || !user });
  }, [entitlements, hydrate, isGuest, user]);
  useEffect(() => {
    if (!draftId) return;
    localDatabaseService.getUnitDraft(user?.id ?? "guest", draftId).then((savedDraft) => {
      if (!savedDraft || !savedDraft.members?.length) return;
      setDimension(savedDraft.dimension);
      setName(savedDraft.name);
      setMembers(savedDraft.members);
      setMultipliers(savedDraft.relationships?.map((relationship) => relationship.multiplier) ?? []);
      setRelationshipsConfirmed(
        Boolean(savedDraft.relationships?.length)
        && savedDraft.relationships.every((relationship) => relationship.confirmedByUser),
      );
      setAnchorMemberId(savedDraft.anchor?.referenceId ?? savedDraft.members[0].id);
      setAnchorValue(savedDraft.anchor?.value ?? "");
      if (savedDraft.anchor?.sourceUnitId) setSourceUnitId(savedDraft.anchor.sourceUnitId);
      setFinalConfirmed(savedDraft.status === "preview_ready");
    }).catch((caught) => setError(caught.message));
  }, [draftId, user?.id]);
  const anchorDimension = anchorMode === "tool" ? "length" : dimension;
  const standardUnits = useMemo(() => unitEngine.listStandardUnits(anchorDimension), [anchorDimension]);
  useEffect(() => {
    const availableTool = customTools.find((tool) => !tool.isArchived);
    if (!anchorToolId && availableTool) setAnchorToolId(availableTool.id);
  }, [anchorToolId, customTools]);
  useEffect(() => {
    const preferred = anchorDimension === "length" ? "FOOT" : "SQFT";
    setSourceUnitId(standardUnits.some((unit) => unit.id === preferred)
      ? preferred : standardUnits[0]?.id ?? "");
  }, [anchorDimension, standardUnits]);

  const relationships = useMemo(() => members.slice(0, -1).map((member, index) => ({
    id: `CUSTOM_REL_${index}`,
    parentUnitId: member.id,
    childUnitId: members[index + 1].id,
    multiplier: multipliers[index] ?? "",
    confirmedByUser: relationshipsConfirmed,
  })), [members, multipliers, relationshipsConfirmed]);
  const draft = useMemo(() => ({
    id: draftId ?? "CUSTOM_FAMILY_DRAFT",
    familyId: `CUSTOM_FAMILY_${members[0]?.id ?? "NEW"}`,
    name,
    dimension,
    members,
    relationships,
    tools: anchorMode === "tool"
      ? customTools.filter((tool) => !tool.isArchived && tool.id === anchorToolId)
      : [],
    toolToAreaRelationships: anchorMode === "tool" ? [{
      id: `CUSTOM_TOOL_AREA_${anchorToolId}`,
      toolId: anchorToolId,
      targetAreaUnitId: anchorMemberId,
      power: 2,
      multiplier: toolAreaMultiplier,
      confirmedByUser: relationshipsConfirmed,
    }] : [],
    status: "draft",
    draftType: draftId ? "resumed_family" : "custom_family",
  }), [
    anchorMemberId,
    anchorMode,
    anchorToolId,
    customTools,
    dimension,
    draftId,
    members,
    name,
    relationships,
    relationshipsConfirmed,
    toolAreaMultiplier,
  ]);
  const anchor = useMemo(() => ({
    kind: anchorMode === "tool"
      ? "tool_length"
      : dimension === "area" ? "unit_area" : "unit_length",
    referenceId: anchorMode === "tool" ? anchorToolId : anchorMemberId,
    value: anchorValue,
    sourceUnitId,
  }), [anchorMemberId, anchorMode, anchorToolId, anchorValue, dimension, sourceUnitId]);
  const previewState = useMemo(() => {
    if (!relationshipsConfirmed || !anchorValue || !sourceUnitId) {
      return { preview: null, error: "" };
    }
    try {
      return { preview: unitEngine.derivePreview(draft, anchor), error: "" };
    } catch (caught) {
      return { preview: null, error: caught.message };
    }
  }, [anchor, anchorValue, draft, relationshipsConfirmed, sourceUnitId]);
  const preview = previewState.preview;

  const switchDimension = (next) => {
    const nextMembers = [makeMember(next, 0), makeMember(next, 1)];
    setDimension(next);
    setMembers(nextMembers);
    setMultipliers(["20"]);
    setRelationshipsConfirmed(false);
    setAnchorMemberId(nextMembers[0].id);
    setAnchorValue("");
    setFinalConfirmed(false);
    setAnchorMode("unit");
    setError("");
  };
  const updateMember = (index, key, value) => {
    setMembers((current) => current.map((member, itemIndex) =>
      itemIndex === index ? { ...member, [key]: value } : member));
    setRelationshipsConfirmed(false);
  };
  const addMember = () => {
    setMembers((current) => [...current, makeMember(dimension, current.length)]);
    setMultipliers((current) => [...current, "1"]);
    setRelationshipsConfirmed(false);
  };
  const removeMember = (index) => {
    if (members.length <= 2) return;
    const removedId = members[index].id;
    const nextMembers = members.filter((_, itemIndex) => itemIndex !== index);
    const nextMultipliers = nextMembers.slice(0, -1).map((member, nextIndex) => {
      const child = nextMembers[nextIndex + 1];
      const oldIndex = members.findIndex((candidate) => candidate.id === member.id);
      return oldIndex >= 0 && members[oldIndex + 1]?.id === child.id
        ? multipliers[oldIndex]
        : "";
    });
    setMembers(nextMembers);
    setMultipliers(nextMultipliers);
    if (anchorMemberId === removedId) {
      setAnchorMemberId(nextMembers[0].id);
      setAnchorValue("");
    }
    setRelationshipsConfirmed(false);
    setFinalConfirmed(false);
  };
  const save = async () => {
    setError("");
    if (!preview || !finalConfirmed) {
      setError("Confirm the family relationships, one known unit, and derived preview.");
      return;
    }
    if (!capabilities.canSaveLocalProfiles) {
      const savedDraft = await saveDraft({ ...draft, anchor, status: "preview_ready" });
      setPaywallDraftId(savedDraft.id);
      setPaywallOpen(true);
      return;
    }
    try {
      await activateCustomFamily({ draft, anchor });
      navigate("/units");
    } catch (caught) {
      setError(caught.message);
    }
  };

  return (
    <UnitScreen title="Relative custom family" subtitle="One anchor · connected ratios" backTo="/units">
      <div className="unit-content">
        <section className="unit-intro"><span><Sparkles size={21} /></span><div><h1>Create a unit family</h1><p>Define names and multiplication first, then provide exactly one known size.</p></div></section>
        <div className="dimension-tabs">
          <button type="button" className={dimension === "length" ? "is-active" : ""} onClick={() => switchDimension("length")}>Length</button>
          <button type="button" className={dimension === "area" ? "is-active" : ""} onClick={() => switchDimension("area")}>Area</button>
        </div>
        <label className="unit-field"><span>Family name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <div className="unit-section-label">Family members, largest to smallest</div>
        <div className="family-member-list">
          {members.map((member, index) => (
            <div key={member.id}>
              <input value={member.name} onChange={(event) => updateMember(index, "name", event.target.value)} aria-label={`Unit ${index + 1} name`} />
              <input value={member.symbol} onChange={(event) => updateMember(index, "symbol", event.target.value)} aria-label={`Unit ${index + 1} symbol`} />
              <button
                type="button"
                onClick={() => removeMember(index)}
                disabled={members.length <= 2}
                aria-label={`Remove ${member.name}`}
              >
                <Trash2 size={15} />
              </button>
              {index < members.length - 1 && (
                <label>
                  <span>1 {member.name} =</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={multipliers[index] ?? ""}
                    onChange={(event) => {
                      setMultipliers((current) => current.map((value, itemIndex) =>
                        itemIndex === index ? event.target.value : value));
                      setRelationshipsConfirmed(false);
                    }}
                  />
                  <span>{members[index + 1].name}</span>
                </label>
              )}
            </div>
          ))}
        </div>
        <button className="unit-secondary" type="button" onClick={addMember}><Plus size={16} /> Add family member</button>
        <label className="profile-confirmation">
          <input type="checkbox" checked={relationshipsConfirmed} onChange={(event) => setRelationshipsConfirmed(event.target.checked)} />
          <span>I confirm all family multiplication relationships.</span>
        </label>

        {relationshipsConfirmed && (
          <>
            <div className="unit-section-label">Exactly one known unit</div>
            {dimension === "area" && customTools.some((tool) => !tool.isArchived) && (
              <div className="dimension-tabs">
                <button type="button" className={anchorMode === "unit" ? "is-active" : ""} onClick={() => { setAnchorMode("unit"); setAnchorValue(""); }}>
                  Area unit
                </button>
                <button type="button" className={anchorMode === "tool" ? "is-active" : ""} onClick={() => { setAnchorMode("tool"); setAnchorValue(""); }}>
                  Measuring tool
                </button>
              </div>
            )}
            {anchorMode === "tool" && (
              <div className="custom-equation">
                <label>
                  <span>Length tool</span>
                  <select value={anchorToolId} onChange={(event) => setAnchorToolId(event.target.value)}>
                    {customTools.filter((tool) => !tool.isArchived).map((tool) => <option key={tool.id} value={tool.id}>{tool.name}</option>)}
                  </select>
                </label>
                <span>Tool length² ×</span>
                <label>
                  <span>Confirmed multiplier</span>
                  <input type="number" min="0" step="any" value={toolAreaMultiplier} onChange={(event) => setToolAreaMultiplier(event.target.value)} />
                </label>
                <span>= 1</span>
                <label>
                  <span>Target area unit</span>
                  <select value={anchorMemberId} onChange={(event) => setAnchorMemberId(event.target.value)}>
                    {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                  </select>
                </label>
              </div>
            )}
            <div className="custom-equation">
              {anchorMode === "unit" ? (
                <select aria-label="Known family unit" value={anchorMemberId} onChange={(event) => setAnchorMemberId(event.target.value)}>
                  {members.map((member) => <option key={member.id} value={member.id}>1 {member.name}</option>)}
                </select>
              ) : <span>1 {customTools.find((tool) => tool.id === anchorToolId)?.name}</span>}
              <strong>=</strong>
              <input aria-label="Known unit value" type="number" min="0" step="any" value={anchorValue} onChange={(event) => setAnchorValue(event.target.value)} />
              <select aria-label="Known value standard unit" value={sourceUnitId} onChange={(event) => setSourceUnitId(event.target.value)}>
                {standardUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.symbol}</option>)}
              </select>
            </div>
          </>
        )}

        {preview && (
          <section className="derived-card">
            <header><Sparkles size={17} /><strong>Readonly derived preview</strong><small>PREVIEW</small></header>
            {members.map((member) => (
              <div key={member.id}><span>1 {member.name}</span><strong>{formatDecimalExact(preview.derivedFactors[member.id], { maximumFractionDigits: 10 })} {dimension === "length" ? "m" : "sqm"}</strong></div>
            ))}
          </section>
        )}
        {previewState.error && <p className="unit-error">{previewState.error}</p>}
        {preview && (
          <label className="profile-confirmation">
            <input type="checkbox" checked={finalConfirmed} onChange={(event) => setFinalConfirmed(event.target.checked)} />
            <span>I confirm this family for my own use. Status: Verified by you.</span>
          </label>
        )}
        {error && <p className="unit-error">{error}</p>}
        <button className="unit-primary" type="button" onClick={save} disabled={!preview || !finalConfirmed}>Confirm & Save</button>
      </div>
      <SubscriptionDialog
        open={paywallOpen}
        isAuthenticated={Boolean(user)}
        onClose={() => setPaywallOpen(false)}
        onContinueFree={() => navigate("/dashboard")}
        draftId={paywallDraftId}
        returnTo={paywallDraftId
          ? `/units/custom-family?draftId=${encodeURIComponent(paywallDraftId)}`
          : undefined}
      />
    </UnitScreen>
  );
}
