/**
 * Secrets Utility — Unified secret resolution for Base44 + Local Development
 */
const ENV = import.meta.env;

export function isLocalDev() {
  if (ENV.VITE_LOCAL_DEV === 'true') return true;
  if (ENV.VITE_GOOGLE_MAPS_API_KEY) return true;
  return false;
}

export async function getGoogleMapsApiKey() {
  const localKey = ENV.VITE_GOOGLE_MAPS_API_KEY;
  if (localKey && localKey.trim()) {
    return localKey.trim();
  }
  return "";
}

export async function getSecret({
  envVarName,
  functionName,
  responseField = 'key',
  label = 'Secret',
}) {
  const localVal = ENV[envVarName];
  if (localVal && localVal.trim()) {
    return localVal.trim();
  }
  return "";
}
