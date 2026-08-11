import { describe, expect, it, vi } from "vitest";
import {
  PackUpdateService,
  canonicalJson,
  compareVersions,
} from "./PackUpdateService";

const manifest = {
  id: "test_pack",
  name: "Test pack",
  version: "1.0.0",
  tier: "suggested",
  schemaVersion: "1.0",
  minimumAppVersion: "0.1.0",
  dimensions: ["area"],
  regions: [{ countryCode: "IN" }],
  evidenceGrade: "test",
  sourceIds: [],
  ownerApproval: { status: "pending" },
  dependencies: [],
};
const data = {
  concepts: [{ id: "concept.test", canonicalName: "Test", dimensions: ["area"] }],
  variants: [{ id: "TEST_AREA", conceptId: "concept.test", name: "Test area", symbol: "ta", dimension: "area", suggestedFactorToBase: "1", exactness: "exact" }],
  relationships: [],
};

describe("PackUpdateService", () => {
  it("compares compatible semantic versions", () => {
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
    expect(compareVersions("1.3.0", "1.2.9")).toBe(1);
    expect(compareVersions("1.2.2", "1.2.3")).toBe(-1);
  });

  it("rejects a bad signature before staging", async () => {
    const service = new PackUpdateService({
      database: {},
      fetchImpl: vi.fn(async () => ({
        ok: true,
        json: async () => ({ payload: { manifest, data }, signature: "bad" }),
      })),
      signatureVerifier: async () => false,
    });
    await expect(service.installFromUrl("https://example.test/pack"))
      .rejects.toThrow("signature verification failed");
  });

  it("rejects a checksum mismatch", async () => {
    const service = new PackUpdateService({
      database: {},
      fetchImpl: vi.fn(async () => ({
        ok: true,
        json: async () => ({
          payload: { manifest: { ...manifest, checksum: "00" }, data },
          signature: "signed",
        }),
      })),
      signatureVerifier: async () => true,
    });
    await expect(service.installFromUrl("https://example.test/pack"))
      .rejects.toThrow("checksum verification failed");
    expect(canonicalJson(data)).toContain("concept.test");
  });

  it("rejects a pack requiring a newer app version", async () => {
    const service = new PackUpdateService({
      appVersion: "0.1.0",
      database: {},
      fetchImpl: vi.fn(async () => ({
        ok: true,
        json: async () => ({
          payload: {
            manifest: {
              ...manifest,
              minimumAppVersion: "2.0.0",
              checksum: "not-reached",
            },
            data,
          },
          signature: "signed",
        }),
      })),
      signatureVerifier: async () => true,
    });
    await expect(service.installFromUrl("https://example.test/pack"))
      .rejects.toThrow("requires PlotScale 2.0.0");
  });

  it("rejects a suggested pack that tries to activate a runtime factor", async () => {
    const checksumService = new PackUpdateService({
      signatureVerifier: async () => true,
      fetchImpl: async () => ({ ok: true }),
    });
    const unsafeData = {
      ...data,
      variants: [{ ...data.variants[0], factorToBase: "1" }],
    };
    const checksum = await checksumService.sha256(canonicalJson(unsafeData));
    const service = new PackUpdateService({
      database: {},
      fetchImpl: vi.fn(async () => ({
        ok: true,
        json: async () => ({
          payload: { manifest: { ...manifest, checksum }, data: unsafeData },
          signature: "signed",
        }),
      })),
      signatureVerifier: async () => true,
    });
    await expect(service.installFromUrl("https://example.test/unsafe"))
      .rejects.toThrow("suggested variants cannot provide runtime factors");
  });

  it("rejects insecure non-local catalog URLs", async () => {
    const service = new PackUpdateService({
      fetchImpl: vi.fn(),
      signatureVerifier: async () => true,
    });
    await expect(service.fetchSignedJson("http://catalog.example.test/packs"))
      .rejects.toThrow("require HTTPS");
    expect(service.fetchImpl).not.toHaveBeenCalled();
  });
});
