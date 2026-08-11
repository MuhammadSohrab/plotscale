const TILE_BASE = "https://basemaps.cartocdn.com/light_nolabels/17";
const TILES = [
  "92603/53443",
  "92604/53443",
  "92603/53444",
  "92604/53444",
  "92603/53445",
  "92604/53445",
  "92603/53446",
  "92604/53446",
];

export function MapBackdrop() {
  return (
    <div className="map-backdrop" aria-hidden="true">
      <div className="map-backdrop__tiles">
        {TILES.map((tile) => (
          <img
            key={tile}
            src={`${TILE_BASE}/${tile}.png`}
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
        Map data © OpenStreetMap contributors, © CARTO
      </span>
    </div>
  );
}
