const TILE_SIZE = 256;
const SATELLITE_TILE_BASE =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";

const clampLatitude = (latitude) => Math.min(85.05112878, Math.max(-85.05112878, latitude));

export function lngLatToWorldPixel(latitude, longitude, zoom = 18) {
  const safeLatitude = clampLatitude(latitude);
  const worldSize = TILE_SIZE * (2 ** zoom);
  const sine = Math.sin((safeLatitude * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * worldSize,
    y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * worldSize,
    worldSize,
  };
}

function loadImage(source, crossOrigin) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (crossOrigin) image.crossOrigin = crossOrigin;
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Satellite imagery could not be loaded."));
    image.src = source;
  });
}

export async function createSatelliteSnapshot(latitude, longitude, options = {}) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Valid GPS coordinates are required for satellite imagery.");
  }

  const zoom = options.zoom ?? 18;
  const size = options.size ?? 512;
  const { x: centerX, y: centerY, worldSize } = lngLatToWorldPixel(latitude, longitude, zoom);
  const startX = centerX - size / 2;
  const startY = centerY - size / 2;
  const endX = centerX + size / 2;
  const endY = centerY + size / 2;
  const minimumTileX = Math.floor(startX / TILE_SIZE);
  const maximumTileX = Math.floor((endX - 1) / TILE_SIZE);
  const minimumTileY = Math.floor(startY / TILE_SIZE);
  const maximumTileY = Math.floor((endY - 1) / TILE_SIZE);
  const tileCount = worldSize / TILE_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  const tileJobs = [];
  for (let tileY = minimumTileY; tileY <= maximumTileY; tileY += 1) {
    if (tileY < 0 || tileY >= tileCount) continue;
    for (let tileX = minimumTileX; tileX <= maximumTileX; tileX += 1) {
      const wrappedTileX = ((tileX % tileCount) + tileCount) % tileCount;
      const source = `${SATELLITE_TILE_BASE}/${zoom}/${tileY}/${wrappedTileX}`;
      tileJobs.push(
        loadImage(source, "anonymous").then((image) => ({ image, tileX, tileY })),
      );
    }
  }

  const tiles = await Promise.all(tileJobs);
  tiles.forEach(({ image, tileX, tileY }) => {
    context.drawImage(
      image,
      Math.round(tileX * TILE_SIZE - startX),
      Math.round(tileY * TILE_SIZE - startY),
      TILE_SIZE,
      TILE_SIZE,
    );
  });

  const attribution = "Esri · Maxar · Earthstar Geographics · GIS Community";
  context.font = "600 12px Arial, sans-serif";
  const attributionWidth = context.measureText(attribution).width + 14;
  context.fillStyle = "rgba(0,0,0,.62)";
  context.fillRect(size - attributionWidth, size - 22, attributionWidth, 22);
  context.fillStyle = "#fff";
  context.textBaseline = "middle";
  context.fillText(attribution, size - attributionWidth + 7, size - 11);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
  const image = await loadImage(dataUrl);
  return { dataUrl, image, zoom };
}

export const satelliteImageryAttribution =
  "Satellite imagery: Esri, Maxar, Earthstar Geographics, and the GIS User Community";
