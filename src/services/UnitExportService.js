import { localDatabaseService } from "./LocalDatabaseService";
import { UNIT_ERROR_CODES, unitError } from "./UnitErrors";
import { canonicalJson } from "./PackUpdateService";
import { createUserLocalProfile } from "../models/unitModels";
import {
  createCompoundDisplayRecipe,
  createCustomMeasuringTool,
  createLocationProfile,
} from "../models/unitIntelligenceModels";
import {
  createStandaloneCustomUnit,
  validateFamilyGraph,
} from "../models/unitEngineModels";

const SCHEMA_VERSION = "1.0.0";
const MAXIMUM_IMPORT_BYTES = 5 * 1024 * 1024;

export class UnitExportService {
  constructor(database = localDatabaseService) {
    this.database = database;
  }

  async createExport(ownerKey = "guest") {
    const [
      location,
      profiles,
      customFamilies,
      standaloneUnits,
      tools,
      recipes,
      preferences,
    ] = await Promise.all([
      this.database.getLocationProfile(ownerKey),
      this.database.listUserLocalProfiles(ownerKey),
      this.database.listCustomFamilies(ownerKey),
      this.database.listStandaloneCustomUnits(ownerKey),
      this.database.listCustomTools(ownerKey),
      this.database.listCompoundRecipes(ownerKey),
      this.database.getUnitPreferences(ownerKey),
    ]);
    const payload = {
      format: "plotscale-unit-setup",
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        location,
        profiles,
        customFamilies,
        standaloneUnits,
        tools,
        recipes,
        preferences,
      },
    };
    return {
      ...payload,
      integrity: {
        algorithm: "SHA-256",
        checksum: await this.sha256(canonicalJson(payload)),
      },
    };
  }

  serialize(exportData) {
    return JSON.stringify(exportData, null, 2);
  }

  async sha256(value) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  async parse(text) {
    if (new TextEncoder().encode(text).byteLength > MAXIMUM_IMPORT_BYTES) {
      throw unitError(UNIT_ERROR_CODES.IMPORT_INVALID, "Unit import exceeds the 5 MB limit.");
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw unitError(UNIT_ERROR_CODES.IMPORT_INVALID, "This is not valid JSON.");
    }
    if (parsed?.format !== "plotscale-unit-setup" || parsed.schemaVersion !== SCHEMA_VERSION) {
      throw unitError(UNIT_ERROR_CODES.IMPORT_INVALID, "Unsupported PlotScale unit export.");
    }
    if (!parsed.data || !Array.isArray(parsed.data.profiles)) {
      throw unitError(UNIT_ERROR_CODES.IMPORT_INVALID, "Unit export data is incomplete.");
    }
    if (parsed.integrity?.algorithm !== "SHA-256" || !parsed.integrity?.checksum) {
      throw unitError(UNIT_ERROR_CODES.IMPORT_INVALID, "Unit export integrity metadata is missing.");
    }
    const { integrity, ...payload } = parsed;
    const checksum = await this.sha256(canonicalJson(payload));
    if (checksum !== integrity.checksum.toLowerCase()) {
      throw unitError(UNIT_ERROR_CODES.IMPORT_INVALID, "Unit export checksum does not match.");
    }
    try {
      if (parsed.data.location) createLocationProfile(parsed.data.location);
      parsed.data.profiles.forEach((profile) => createUserLocalProfile(profile));
      parsed.data.customFamilies?.forEach((family) => validateFamilyGraph(family));
      parsed.data.standaloneUnits?.forEach((unit) => createStandaloneCustomUnit(unit));
      parsed.data.tools?.forEach((tool) => createCustomMeasuringTool(tool));
      parsed.data.recipes?.forEach((recipe) => createCompoundDisplayRecipe(recipe));
    } catch (error) {
      throw unitError(UNIT_ERROR_CODES.IMPORT_INVALID, `Invalid unit import: ${error.message}`);
    }
    return parsed;
  }

  async analyzeImport(ownerKey, text) {
    const parsed = await this.parse(text);
    const existing = await Promise.all([
      this.database.listUserLocalProfiles(ownerKey),
      this.database.listCustomFamilies(ownerKey),
      this.database.listStandaloneCustomUnits(ownerKey),
      this.database.listCustomTools(ownerKey),
      this.database.listCompoundRecipes(ownerKey),
    ]);
    const existingIds = new Set(existing.flat().map((item) => item.id));
    const incoming = [
      ...parsed.data.profiles,
      ...(parsed.data.customFamilies ?? []),
      ...(parsed.data.standaloneUnits ?? []),
      ...(parsed.data.tools ?? []),
      ...(parsed.data.recipes ?? []),
    ];
    return {
      parsed,
      recordCount: incoming.length,
      conflicts: incoming.filter((item) => existingIds.has(item.id))
        .map((item) => ({ id: item.id, name: item.name, resolution: "import_as_copy" })),
    };
  }

  async importExport(ownerKey, text) {
    const analysis = await this.analyzeImport(ownerKey, text);
    await this.database.importUnitSetupAtomic(ownerKey, analysis.parsed.data);
    return analysis;
  }
}

export const unitExportService = new UnitExportService();
