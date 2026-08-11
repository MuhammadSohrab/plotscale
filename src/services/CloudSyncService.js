import {
  createAppSettings,
  createUnitProfile,
} from "../models/cloudModels";
import { requireSupabase, supabase } from "./supabaseClient";

const toProfileRow = (profile) => ({
  user_id: profile.userId,
  name: profile.name,
  email: profile.email,
  registered_at: profile.registeredAt,
  subscription_status: profile.subscriptionStatus,
  credit_balance: profile.creditBalance,
});

const fromProfileRow = (row) =>
  row && ({
    userId: row.user_id,
    name: row.name,
    email: row.email,
    registeredAt: row.registered_at,
    subscriptionStatus: row.subscription_status,
    creditBalance: row.credit_balance,
  });

const toSettingsRow = (settings) => ({
  user_id: settings.userId,
  theme: settings.theme,
  language: settings.language,
  default_calculation_mode: settings.defaultCalculationMode,
  updated_at: settings.updatedAt,
});

const fromSettingsRow = (row) =>
  row && ({
    userId: row.user_id,
    theme: row.theme,
    language: row.language,
    defaultCalculationMode: row.default_calculation_mode,
    updatedAt: row.updated_at,
  });

const fromUnitRow = (row) => row.profile_data ?? ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  defaultInputLengthUnit: row.default_input_length_unit,
  defaultOutputAreaUnit: row.default_output_area_unit,
  laggiMeters: row.laggi_meters,
  hierarchyMultipliers: row.hierarchy_multipliers ?? {},
  isDefault: row.is_default,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toUnitUserDataRow = (userId, input) => ({
  user_id: userId,
  location_profile: input.locationProfile ?? {},
  custom_area_units: input.customAreaUnits ?? [],
  custom_tools: input.customTools ?? [],
  compound_recipes: input.compoundRecipes ?? [],
  updated_at: new Date().toISOString(),
});

const fromUnitUserDataRow = (row) => row && ({
  userId: row.user_id,
  locationProfile: row.location_profile ?? null,
  customAreaUnits: row.custom_area_units ?? [],
  customTools: row.custom_tools ?? [],
  compoundRecipes: row.compound_recipes ?? [],
  updatedAt: row.updated_at,
});

const reconcileOwnedCollection = async ({
  client,
  table,
  userId,
  records,
  toRow,
}) => {
  const normalizedRecords = records ?? [];
  if (normalizedRecords.length) {
    const { error: upsertError } = await client
      .from(table)
      .upsert(normalizedRecords.map((record) => toRow(record)), { onConflict: "id" });
    if (upsertError) throw upsertError;
  }

  const { data: cloudRows, error: listError } = await client
    .from(table)
    .select("id")
    .eq("user_id", userId);
  if (listError) throw listError;

  const localIds = new Set(normalizedRecords.map((record) => record.id));
  const staleIds = (cloudRows ?? [])
    .map((row) => row.id)
    .filter((id) => !localIds.has(id));
  if (!staleIds.length) return;

  const { error: deleteError } = await client
    .from(table)
    .delete()
    .eq("user_id", userId)
    .in("id", staleIds);
  if (deleteError) throw deleteError;
};

class CloudSyncService {
  async getSession() {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  onAuthStateChange(callback) {
    if (!supabase) return () => {};
    const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
    return () => data.subscription.unsubscribe();
  }

  async signUp({ name, email, password }) {
    const client = requireSupabase();
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { name: name.trim() },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) throw error;
    return data;
  }

  async signIn({ email, password }) {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    return data;
  }

  async signInWithOAuth(provider) {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) throw error;
    return data;
  }

  async sendPasswordReset(email) {
    const client = requireSupabase();
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  }

  async updatePassword(password) {
    const client = requireSupabase();
    const { data, error } = await client.auth.updateUser({ password });
    if (error) throw error;
    return data;
  }

  async signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  async upsertProfile(profile) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("profiles")
      .upsert(toProfileRow(profile), { onConflict: "user_id" })
      .select()
      .single();
    if (error) throw error;
    return fromProfileRow(data);
  }

  async getProfile(userId) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return fromProfileRow(data);
  }

  async upsertSettings(settings) {
    const client = requireSupabase();
    const normalized = createAppSettings(settings.userId, settings);
    const { data, error } = await client
      .from("app_settings")
      .upsert(toSettingsRow(normalized), { onConflict: "user_id" })
      .select()
      .single();
    if (error) throw error;
    return fromSettingsRow(data);
  }

  async getSettings(userId) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("app_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ? fromSettingsRow(data) : createAppSettings(userId);
  }

  async saveUnitProfile(userId, input) {
    const client = requireSupabase();
    const profile = createUnitProfile(userId, input);
    const { data, error } = await client
      .rpc("save_unit_profile_revision", { p_profile: profile });
    if (error) throw error;
    return data;
  }

  async listUnitProfiles(userId) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("unit_profiles")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data.map(fromUnitRow);
  }

  async getUnitConfiguration(userId) {
    const client = requireSupabase();
    const [families, units, tools, preferences] = await Promise.all([
      client.from("custom_unit_families").select("family_data").eq("user_id", userId),
      client.from("standalone_custom_units").select("unit_data").eq("user_id", userId),
      client.from("custom_measuring_tools").select("tool_data").eq("user_id", userId),
      client.from("unit_preferences").select("preferences_data").eq("user_id", userId).maybeSingle(),
    ]);
    const failed = [families, units, tools, preferences].find((result) => result.error);
    if (failed?.error) throw failed.error;
    return {
      customFamilies: (families.data ?? []).map((row) => row.family_data),
      standaloneUnits: (units.data ?? []).map((row) => row.unit_data),
      customTools: (tools.data ?? []).map((row) => row.tool_data),
      preferences: preferences.data?.preferences_data ?? null,
    };
  }

  async getUnitBundle(userId) {
    const [profiles, userData, configuration] = await Promise.all([
      this.listUnitProfiles(userId),
      this.getUnitUserData(userId),
      this.getUnitConfiguration(userId),
    ]);
    return { profiles, userData, configuration };
  }

  async deleteUnitProfile(userId, id) {
    const client = requireSupabase();
    const { error } = await client
      .from("unit_profiles")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw error;
  }

  async saveUnitUserData(userId, input) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("unit_user_data")
      .upsert(toUnitUserDataRow(userId, input), { onConflict: "user_id" })
      .select()
      .single();
    if (error) throw error;
    return fromUnitUserDataRow(data);
  }

  async getUnitUserData(userId) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("unit_user_data")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return fromUnitUserDataRow(data);
  }

  async saveUnitConfiguration(userId, input) {
    const client = requireSupabase();
    const updatedAt = new Date().toISOString();
    const operations = [
      reconcileOwnedCollection({
        client,
        table: "custom_unit_families",
        userId,
        records: input.customFamilies,
        toRow: (family) => ({
          id: family.id,
          user_id: userId,
          dimension: family.dimension,
          family_data: family,
          updated_at: family.updatedAt ?? updatedAt,
        }),
      }),
      reconcileOwnedCollection({
        client,
        table: "standalone_custom_units",
        userId,
        records: input.standaloneUnits,
        toRow: (unit) => ({
          id: unit.id,
          user_id: userId,
          dimension: unit.dimension,
          unit_data: unit,
          updated_at: unit.updatedAt ?? updatedAt,
        }),
      }),
      reconcileOwnedCollection({
        client,
        table: "custom_measuring_tools",
        userId,
        records: input.customTools,
        toRow: (tool) => ({
          id: tool.id,
          user_id: userId,
          tool_data: tool,
          updated_at: tool.updatedAt ?? updatedAt,
        }),
      }),
    ];
    if (input.preferences) {
      operations.push(client.from("unit_preferences").upsert({
        user_id: userId,
        preferences_data: input.preferences,
        updated_at: updatedAt,
      }, { onConflict: "user_id" }));
    }
    const results = await Promise.all(operations);
    const failed = results.find((result) => result?.error);
    if (failed?.error) throw failed.error;
    return true;
  }

  async getEntitlements(userId) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("subscription_entitlements")
      .select("status,capabilities,valid_until,updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { subscriptionStatus: "free", capabilities: {} };
    const verifiedAt = data.updated_at ?? new Date().toISOString();
    const graceBase = data.valid_until
      ? new Date(data.valid_until).getTime()
      : new Date(verifiedAt).getTime();
    return {
      subscriptionStatus: data.status,
      capabilities: data.capabilities ?? {},
      validUntil: data.valid_until,
      verifiedAt,
      offlineGraceUntil: ["active", "trial"].includes(data.status)
        ? new Date(graceBase + (7 * 24 * 60 * 60 * 1000)).toISOString()
        : null,
      updatedAt: data.updated_at,
    };
  }
}

export const cloudSyncService = new CloudSyncService();
export { CloudSyncService };
