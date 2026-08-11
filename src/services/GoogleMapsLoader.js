let googleMapsPromise = null;

const GOOGLE_MAPS_LIBRARIES = [
  "maps",
  "geometry",
  "places",
  "marker",
  "geocoding",
  "elevation",
];

export function getGoogleMapsConfiguration() {
  return {
    apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "",
    mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim() || "DEMO_MAP_ID",
  };
}

async function ensureGoogleMapsLibraries() {
  const maps = window.google?.maps;
  if (!maps) {
    throw new Error("Google Maps loaded without the required libraries.");
  }

  if (typeof maps.importLibrary === "function") {
    const [
      mapsLibrary,
      geometryLibrary,
      placesLibrary,
      markerLibrary,
      geocodingLibrary,
      elevationLibrary,
    ] = await Promise.all(
      GOOGLE_MAPS_LIBRARIES.map((library) => maps.importLibrary(library)),
    );

    Object.assign(maps, mapsLibrary, geocodingLibrary, elevationLibrary);
    Object.assign(maps.geometry ??= {}, geometryLibrary);
    Object.assign(maps.places ??= {}, placesLibrary);
    Object.assign(maps.marker ??= {}, markerLibrary);
  }

  if (typeof maps.Map !== "function" || !maps.geometry?.spherical) {
    throw new Error("Google Maps loaded without the required map and geometry libraries.");
  }
  return maps;
}

export function loadGoogleMaps() {
  if (window.google?.maps?.geometry?.spherical && typeof window.google.maps.Map === "function") {
    return Promise.resolve(window.google.maps);
  }
  if (googleMapsPromise) return googleMapsPromise;
  const { apiKey } = getGoogleMapsConfiguration();
  if (!apiKey) {
    return Promise.reject(new Error(
      "Google Maps is not configured. Add VITE_GOOGLE_MAPS_API_KEY to the app environment.",
    ));
  }
  googleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-plotscale-google-maps="true"]');
    if (existing) {
      if (window.google?.maps) {
        resolve(ensureGoogleMapsLibraries());
      } else {
        reject(new Error("Google Maps is still initializing. Retry in a moment."));
      }
      return;
    }
    const callbackName = "__plotscaleGoogleMapsReady";
    const script = document.createElement("script");
    script.dataset.plotscaleGoogleMaps = "true";
    script.async = true;
    script.defer = true;
    window[callbackName] = () => {
      delete window[callbackName];
      ensureGoogleMapsLibraries().then(resolve, reject);
    };
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=geometry,places,marker&v=weekly&loading=async&callback=${callbackName}`;
    script.onerror = () => {
      delete window[callbackName];
      reject(new Error("Google Maps could not be loaded. Check the connection, key and API restrictions."));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    googleMapsPromise = null;
    throw error;
  });
  return googleMapsPromise;
}
