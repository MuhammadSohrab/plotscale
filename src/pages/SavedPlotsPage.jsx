import { ArrowLeft, Edit3, FolderOpen, MapPinned, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";
import { localDatabaseService } from "../services/LocalDatabaseService";
import { useAppStore } from "../store/useAppStore";

const plotModeLabels = {
  triangles: "Triangle Plot",
  irregular: "Irregular Plot",
  regular: "Regular Shapes",
  custom: "Custom Shapes",
  map: "Map Measurement",
  manual: "Area Calculator",
};

export function SavedPlotsPage() {
  const user = useAppStore((state) => state.user);
  const [plots, setPlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    localDatabaseService
      .listPlots(user?.id)
      .then((items) => active && setPlots(items))
      .catch(() => active && setPlots([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [user?.id]);

  const removePlot = async (plot) => {
    if (!window.confirm(`Delete “${plot.name}” from this device?`)) return;
    setError("");
    try {
      await localDatabaseService.deletePlot(plot.id);
      setPlots((current) => current.filter((item) => item.id !== plot.id));
    } catch (caught) {
      setError(caught.message);
    }
  };

  return (
    <main className="dashboard saved-plots">
      <header className="dashboard__header">
        <Brand compact />
        <Link className="icon-button" to="/dashboard" aria-label="Back to home">
          <ArrowLeft size={19} />
        </Link>
      </header>
      <section className="dashboard__hero saved-plots__hero">
        <span className="status-pill"><FolderOpen size={15} /> Free account feature</span>
        <h1>Your saved plots</h1>
        <p>Plots, measurements and media stay securely on this device.</p>
      </section>
      {loading ? (
        <p className="saved-plots__loading">Loading saved plots…</p>
      ) : plots.length ? (
        <section className="saved-plots__grid" aria-label="Saved plots">
          {plots.map((plot) => (
            <article key={plot.id}>
              <span><MapPinned size={21} /></span>
              <div>
                <strong>{plot.name}</strong>
                <small>
                  {plotModeLabels[plot.calculationMode ?? plot.mode] ?? "Area Calculator"}
                  {" · "}
                  Updated {new Date(plot.modifiedAt).toLocaleDateString()}
                </small>
              </div>
              <div className="saved-plots__actions">
                <Link
                  to={`/calculator?edit=${encodeURIComponent(plot.id)}`}
                  aria-label={`Edit ${plot.name}`}
                >
                  <Edit3 size={16} /> Edit
                </Link>
                <button
                  type="button"
                  onClick={() => removePlot(plot)}
                  aria-label={`Delete ${plot.name}`}
                >
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="saved-plots__empty">
          <span><FolderOpen size={30} /></span>
          <h2>No saved plots yet</h2>
          <p>Your saved calculations and maps will appear here.</p>
          <Link className="primary-button" to="/calculator">Create a plot</Link>
        </section>
      )}
      {error && <p className="saved-plots__error">{error}</p>}
    </main>
  );
}
