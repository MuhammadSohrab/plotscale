const TILE_BASE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/17";
const TILES = [
  "55417/95878",
  "55417/95879",
  "55418/95878",
  "55418/95879",
  "55419/95878",
  "55419/95879",
  "55420/95878",
  "55420/95879",
];

export function MapBackdrop() {
  return (
    <div className="map-backdrop" aria-hidden="true">
      <div className="map-backdrop__tiles">
        {TILES.map((tile) => (
          <img
            key={tile}
            src={`${TILE_BASE}/${tile}`}
            alt=""
            width="256"
            height="256"
            loading="eager"
            referrerPolicy="no-referrer"
          />
        ))}
        <span className="map-backdrop__tint" />
      </div>
      <span className="map-backdrop__wash" />
      <span className="map-backdrop__attribution">
        Imagery © Esri, Maxar, Earthstar Geographics, GIS Community
      </span>
    </div>
  );
}
