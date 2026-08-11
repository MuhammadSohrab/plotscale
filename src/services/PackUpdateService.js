import { validatePackData, validatePackManifest } from "../models/unitPackModels";
import { localDatabaseService } from "./LocalDatabaseService";
import { unitPackRegistry } from "./UnitPackRegistry";
import { locationService } from "./LocationService";

const utf8 = (value) => new TextEncoder().encode(value);
const fromBase64 = (value) => {
  const binary = globalThis.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};
const toHex = (bytes) => [...new Uint8Array(bytes)]
  .map((value) => value.toString(16).padStart(2, "0"))
  .join("");

const parseVersion = (value) => {
  const match = String(value ?? "").trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) throw new Error(`Invalid semantic version: ${value}.`);
  return match.slice(1).map(Number);
};

export const compareVersions = (left, right) => {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] > rightParts[index] ? 1 : -1;
    }
  }
  return 0;
};

export const canonicalJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

export class PackUpdateService {
  constructor({
    database = localDatabaseService,
    fetchImpl = globalThis.fetch?.bind(globalThis),
    publicKeyBase64 = import.meta.env?.VITE_UNIT_PACK_PUBLIC_KEY ?? "",
    appVersion = "0.1.0",
    signatureVerifier,
    requestTimeoutMs = 10000,
    maximumResponseBytes = 2 * 1024 * 1024,
  } = {}) {
    this.database = database;
    this.fetchImpl = fetchImpl;
    this.publicKeyBase64 = publicKeyBase64;
    this.appVersion = appVersion;
    this.signatureVerifier = signatureVerifier;
    this.requestTimeoutMs = requestTimeoutMs;
    this.maximumResponseBytes = maximumResponseBytes;
  }

  async sha256(value) {
    return toHex(await crypto.subtle.digest("SHA-256", utf8(value)));
  }

  async verifySignature(payload, signature, keyId = "primary") {
    if (this.signatureVerifier) return this.signatureVerifier(payload, signature, keyId);
    if (!this.publicKeyBase64) throw new Error("Unit pack public key is not configured.");
    const key = await crypto.subtle.importKey(
      "raw",
      fromBase64(this.publicKeyBase64),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      fromBase64(signature),
      utf8(canonicalJson(payload)),
    );
  }

  async fetchSignedJson(url) {
    if (!this.fetchImpl) throw new Error("Pack updates are unavailable in this environment.");
    const parsedUrl = new URL(url, globalThis.location?.origin ?? "https://plotscale.invalid");
    const isLocalDevelopment = ["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname);
    if (parsedUrl.protocol !== "https:" && !isLocalDevelopment) {
      throw new Error("Unit catalog updates require HTTPS.");
    }
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), this.requestTimeoutMs);
    let response;
    try {
      response = await this.fetchImpl(parsedUrl.href, {
        cache: "no-store",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
    } finally {
      globalThis.clearTimeout(timeout);
    }
    if (!response.ok) throw new Error(`Pack update request failed (${response.status}).`);
    const announcedSize = Number(response.headers?.get?.("content-length") ?? 0);
    if (announcedSize > this.maximumResponseBytes) {
      throw new Error("Signed catalog response exceeds the allowed size.");
    }
    const envelope = await response.json();
    if (utf8(canonicalJson(envelope)).byteLength > this.maximumResponseBytes) {
      throw new Error("Signed catalog response exceeds the allowed size.");
    }
    if (!envelope?.payload || !envelope?.signature) {
      throw new Error("Signed pack envelope is invalid.");
    }
    if (!await this.verifySignature(envelope.payload, envelope.signature, envelope.keyId)) {
      throw new Error("Unit pack signature verification failed.");
    }
    return envelope.payload;
  }

  async checkForUpdates(catalogUrl) {
    const catalog = await this.fetchSignedJson(catalogUrl);
    if (catalog.schemaVersion !== "1.0") throw new Error("Unsupported pack catalog schema.");
    const installed = await this.database.listInstalledPacks();
    const installedMap = new Map(installed.map((item) => [item.id, item.version]));
    return (catalog.packs ?? []).filter((item) => {
      if (item.minimumAppVersion &&
          compareVersions(this.appVersion, item.minimumAppVersion) < 0) {
        return false;
      }
      return installedMap.get(item.id) !== item.version;
    });
  }

  async installFromUrl(packUrl) {
    const payload = await this.fetchSignedJson(packUrl);
    const manifest = validatePackManifest(payload.manifest);
    if (manifest.tier === "research") throw new Error("Research packs cannot be installed at runtime.");
    if (compareVersions(this.appVersion, manifest.minimumAppVersion) < 0) {
      throw new Error(
        `Unit pack ${manifest.id} requires PlotScale ${manifest.minimumAppVersion} or newer.`,
      );
    }
    const serializedData = canonicalJson(payload.data);
    if (!manifest.checksum) throw new Error("Remote packs require a SHA-256 checksum.");
    if (await this.sha256(serializedData) !== manifest.checksum.toLowerCase()) {
      throw new Error("Unit pack checksum verification failed.");
    }
    const data = validatePackData(payload.data, manifest);
    const dependencies = await this.database.listInstalledPacks();
    const installedVersions = new Map(dependencies.map((item) => [item.id, item.version]));
    const currentVersion = installedVersions.get(manifest.id);
    if (currentVersion && compareVersions(manifest.version, currentVersion) < 0) {
      throw new Error("Unit pack downgrade was rejected.");
    }
    const missing = manifest.dependencies.filter((dependency) => {
      const id = typeof dependency === "string" ? dependency : dependency.id;
      const minimumVersion = typeof dependency === "string" ? null : dependency.minimumVersion;
      const installedVersion = installedVersions.get(id);
      return !installedVersion
        || (minimumVersion && compareVersions(installedVersion, minimumVersion) < 0);
    }).map((dependency) => typeof dependency === "string" ? dependency : dependency.id);
    if (missing.length) throw new Error(`Missing unit pack dependencies: ${missing.join(", ")}.`);

    const staged = { manifest, data, stagedAt: new Date().toISOString() };
    await this.database.stageUnitPack(staged);
    await this.database.activateStagedUnitPack(manifest.id, manifest.version);
    unitPackRegistry.installPack({ manifest, data, source: "remote" });
    return staged;
  }

  async installCatalogRelease(catalogUrl) {
    const release = await this.fetchSignedJson(catalogUrl);
    if (release.schemaVersion !== "1.0" || !release.version) {
      throw new Error("Unsupported catalog release schema.");
    }
    if (
      !Array.isArray(release.countries)
      || release.countries.length < 249
      || !Array.isArray(release.locationNodes)
      || !Array.isArray(release.measurementRegions)
      || !Array.isArray(release.researchSuggestionIndex)
      || !Array.isArray(release.resources)
      || release.resources.length < 4
    ) {
      throw new Error("Signed catalog release is incomplete.");
    }
    const installed = await this.database.getActiveCatalogRelease();
    if (installed?.version && compareVersions(release.version, installed.version) < 0) {
      throw new Error("Catalog release downgrade was rejected.");
    }
    for (const resource of release.resources ?? []) {
      if (!resource.name || !resource.checksum || !Object.hasOwn(release, resource.name)) {
        throw new Error("Catalog resource integrity metadata is invalid.");
      }
      if (await this.sha256(canonicalJson(release[resource.name]))
          !== resource.checksum.toLowerCase()) {
        throw new Error(`Catalog resource checksum failed: ${resource.name}.`);
      }
    }
    await this.database.activateCatalogRelease(release);
    for (const pack of release.packs ?? []) {
      const manifest = validatePackManifest(pack.manifest);
      if (manifest.tier === "research") continue;
      const data = validatePackData(pack.data, manifest);
      unitPackRegistry.installPack({ manifest, data, source: "signed-catalog-release" });
    }
    locationService.replaceCatalog({
      countries: release.countries,
      nodes: release.locationNodes,
      measurementRegions: release.measurementRegions,
      researchSuggestionIndex: release.researchSuggestionIndex,
    });
    return release;
  }

  async rollback(packId) {
    const previous = await this.database.rollbackUnitPack(packId);
    unitPackRegistry.installPack({
      manifest: previous.manifest,
      data: previous.data,
      source: previous.source ?? "rollback-cache",
    });
    return previous;
  }
}

export const packUpdateService = new PackUpdateService();
