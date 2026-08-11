import { Info, LocateFixed, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { UnitSaveNotice, UnitScreen } from "../components/UnitScreen";
import { SearchableCountryPicker } from "../components/SearchableCountryPicker";
import { unitEngine } from "../services/UnitEngine";
import { useAppStore } from "../store/useAppStore";
import { useUnitStore } from "../store/useUnitStore";

const emptySelection = {
  countryCode: "",
  nodePathIds: [],
  measurementRegionIds: [],
  resolutionLevel: 0,
  confirmedByUser: true,
  source: "manual",
};

export function UnitLocationPage() {
  const user = useAppStore((state) => state.user);
  const entitlements = useAppStore((state) => state.entitlements);
  const isGuest = useAppStore((state) => state.isGuest);
  const {
    hydrate,
    saveLocation,
    locationProfile,
    locationSuggestions,
    status,
  } = useUnitStore();
  const [selection, setSelection] = useState(emptySelection);
  const [skippedLevel, setSkippedLevel] = useState(false);
  const [saved, setSaved] = useState(false);
  const [assistNotice, setAssistNotice] = useState("");

  useEffect(() => {
    hydrate(user?.id ?? "guest", { ...entitlements, isGuest: isGuest || !user });
  }, [entitlements, hydrate, isGuest, user]);
  useEffect(() => {
    if (locationProfile) setSelection({ ...emptySelection, ...locationProfile });
  }, [locationProfile]);

  const countries = useMemo(() => unitEngine.listCountries(), []);
  const nextStep = useMemo(
    () => selection.countryCode && !skippedLevel
      ? unitEngine.getNextLocationStep(selection)
      : null,
    [selection, skippedLevel],
  );
  const selectionMatchesSaved = Boolean(
    locationProfile
    && locationProfile.countryCode === selection.countryCode
    && JSON.stringify(locationProfile.nodePathIds ?? []) === JSON.stringify(selection.nodePathIds)
    && JSON.stringify(locationProfile.measurementRegionIds ?? []) === JSON.stringify(selection.measurementRegionIds),
  );

  const chooseCountry = (countryCode) => {
    setSelection({ ...emptySelection, countryCode });
    setSkippedLevel(false);
  };
  const chooseNext = (id) => {
    if (!id || !nextStep) return;
    const isMeasurementRegion = nextStep.typeCode === "measurement_region";
    setSelection((current) => ({
      ...current,
      nodePathIds: isMeasurementRegion
        ? current.nodePathIds
        : [...current.nodePathIds, id],
      measurementRegionIds: isMeasurementRegion
        ? [...current.measurementRegionIds, id]
        : current.measurementRegionIds,
      resolutionLevel: current.resolutionLevel + 1,
    }));
  };
  const suggestFromDevice = () => {
    const region = new Intl.Locale(navigator.language).region;
    const country = countries.find((item) => item.code === region);
    if (country) {
      chooseCountry(country.code);
      setAssistNotice(`Device locale suggests ${country.name}. Please confirm it.`);
    } else {
      setAssistNotice("Device locale could not identify a country. Select it manually.");
    }
  };
  const submit = async (event) => {
    event.preventDefault();
    await saveLocation({
      ...selection,
      source: "manual",
      confirmedByUser: true,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  return (
    <UnitScreen title="Locations & Suggestions" subtitle="Suggestions only — never automatic" backTo="/units">
      <form className="unit-content" onSubmit={submit}>
        <section className="unit-intro">
          <span><MapPin size={21} /></span>
          <div>
            <h1>Confirm your land-measurement region</h1>
            <p>PlotScale asks only for the location depth needed to distinguish available suggestions.</p>
          </div>
        </section>

        <button className="unit-secondary" type="button" onClick={suggestFromDevice}>
          <LocateFixed size={17} /> Suggest from device locale
        </button>
        {assistNotice && <p className="unit-assist-note">{assistNotice}</p>}

        <SearchableCountryPicker
          countries={countries}
          value={selection.countryCode}
          onChange={chooseCountry}
          required
        />

        {nextStep && (
          <div className="dynamic-location-step">
            <label className="unit-field">
              <span>{nextStep.label}</span>
              <select defaultValue="" onChange={(event) => chooseNext(event.target.value)}>
                <option value="">Select {nextStep.label.toLowerCase()}</option>
                {nextStep.options.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
            {nextStep.allowSkip && (
              <button className="unit-link-button" type="button" onClick={() => setSkippedLevel(true)}>
                I don&apos;t know / Skip this level
              </button>
            )}
          </div>
        )}

        {skippedLevel && (
          <aside className="unit-disclaimer">
            <Info size={17} />
            <span>Broader candidates will be shown. PlotScale will not silently choose one for you.</span>
          </aside>
        )}
        <aside className="unit-disclaimer">
          <ShieldCheck size={17} />
          <span>Only your confirmed location codes are stored. Raw GPS coordinates are not saved.</span>
        </aside>
        <UnitSaveNotice visible={saved}>Location saved; suggestions refreshed</UnitSaveNotice>
        <button className="unit-primary" type="submit" disabled={status === "loading" || !selection.countryCode}>
          Save & find unit families
        </button>

        {selectionMatchesSaved && locationSuggestions.suggested.length === 0 && (
          <section className="unit-empty-state">
            <strong>No researched local-family suggestion is available for this location.</strong>
            <p>You can create a relative family, add a standalone unit, or continue with standard units.</p>
            <Link to="/units/custom-family">Create Relative Unit Family</Link>
            <Link to="/units/custom">Create Standalone Unit</Link>
          </section>
        )}

        {selectionMatchesSaved && locationSuggestions.suggested.length > 0 && (
          <section className="pack-results">
            <h2><Sparkles size={17} /> Possible local families</h2>
            {locationSuggestions.warning && (
              <aside className="unit-disclaimer"><Info size={16} /><span>{locationSuggestions.warning}</span></aside>
            )}
            {locationSuggestions.suggested.map((pack) => (
              <article key={pack.manifest.id}>
                <span className="pack-tier pack-tier--suggested">Research suggestion</span>
                <strong>{pack.manifest.name}</strong>
                <small>Names and possible relationships only. Confirm every ratio and one known size before use.</small>
                <Link to={`/units/calibrate/${pack.manifest.id}`}>Set up this family</Link>
              </article>
            ))}
          </section>
        )}

        {selectionMatchesSaved && locationSuggestions.researchCandidates?.length > 0 && (
          <section className="pack-results">
            <h2><Info size={17} /> Additional research candidates</h2>
            {locationSuggestions.researchCandidates.map((pack) => (
              <article key={pack.id}>
                <span className="pack-tier pack-tier--suggested">Names & relationships only</span>
                <strong>{pack.name}</strong>
                <small>
                  {pack.candidateCount} classified assertions. Factors are hidden from conversion and anchor fields.
                  {pack.hasConflicts ? " Conflicting records are preserved separately." : ""}
                </small>
                <Link to={`/units/research/${pack.id}`}>Review these research candidates</Link>
              </article>
            ))}
          </section>
        )}
      </form>
    </UnitScreen>
  );
}
