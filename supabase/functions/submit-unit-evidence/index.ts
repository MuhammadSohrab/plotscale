import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "access-control-allow-origin":
    Deno.env.get("PLOTSCALE_ALLOWED_ORIGIN") ?? "https://plotscale.app",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

const bytesToHex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};

const digest = async (value: unknown) => bytesToHex(
  await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical(value)),
  ),
);

const shortText = (value: unknown, max = 128) => {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > max) throw new Error("Invalid evidence identifier");
  return normalized;
};

const stringList = (value: unknown, maxItems = 64) => {
  if (!Array.isArray(value) || value.length > maxItems) throw new Error("Invalid evidence list");
  return value.map((item) => shortText(item));
};

const contributorHash = async (userId: string, secret: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToHex(await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(userId),
  ));
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 32768) return json(413, { error: "Evidence payload is too large" });
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const evidenceSecret = Deno.env.get("UNIT_EVIDENCE_HMAC_SECRET");
  if (!url || !anonKey || !serviceKey || !evidenceSecret) {
    return json(500, { error: "Evidence service is not configured" });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const userClient = createClient(url, anonKey, {
    global: { headers: { authorization } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json(401, { error: "Authentication required" });

  const service = createClient(url, serviceKey);
  const { data: entitlement } = await service
    .from("subscription_entitlements")
    .select("status,valid_until")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  const active = ["active", "trial"].includes(entitlement?.status)
    && (!entitlement?.valid_until || new Date(entitlement.valid_until) > new Date());
  if (!active) return json(403, { error: "Active unit-setup entitlement required" });

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: "Evidence payload must be valid JSON" });
  }
  if (!payload?.countryCode || !payload?.family || !payload?.relationships || !payload?.factors) {
    return json(400, { error: "Evidence payload is incomplete" });
  }
  let countryCode;
  let locationPathIds;
  let measurementRegionIds;
  let family;
  let relationships;
  let factors;
  try {
    countryCode = shortText(payload.countryCode, 2).toUpperCase();
    if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error("Invalid country");
    locationPathIds = stringList(payload.locationPathIds ?? []);
    measurementRegionIds = stringList(payload.measurementRegionIds ?? []);
    family = {
      familyId: shortText(payload.family.familyId),
      dimension: shortText(payload.family.dimension, 16),
      memberIds: stringList(payload.family.memberIds),
    };
    if (!Array.isArray(payload.relationships) || payload.relationships.length > 64) {
      throw new Error("Invalid relationships");
    }
    relationships = (payload.relationships as unknown[]).map((item) => {
      const relation = item as Record<string, unknown>;
      return {
        parentUnitId: shortText(relation.parentUnitId),
        childUnitId: shortText(relation.childUnitId),
        multiplier: shortText(relation.multiplier, 64),
      };
    });
    if (!["length", "area"].includes(family.dimension)) throw new Error("Invalid dimension");
    if (relationships.some((relationship) =>
      !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(relationship.multiplier)
      || Number(relationship.multiplier) <= 0)) {
      throw new Error("Invalid relationship multiplier");
    }
    if (
      !payload.factors
      || Array.isArray(payload.factors)
      || typeof payload.factors !== "object"
      || Object.keys(payload.factors).length > 64
    ) throw new Error("Invalid factors");
    factors = Object.fromEntries(Object.entries(payload.factors as Record<string, unknown>)
      .slice(0, 64)
      .map(([key, value]) => [shortText(key), shortText(value, 96)]));
    if (Object.values(factors).some((factor) =>
      !/^(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(factor)
      || Number(factor) <= 0)) {
      throw new Error("Invalid factor");
    }
  } catch {
    return json(400, { error: "Evidence payload failed privacy or schema validation" });
  }
  const safeEvidence = {
    schemaVersion: "1.0.0",
    family,
    relationships,
    factors,
    verificationState: "verified_by_user",
    submittedAt: new Date().toISOString(),
  };
  const rpcPayload = {
    p_contributor_hash: await contributorHash(authData.user.id, evidenceSecret),
    p_country_code: countryCode,
    p_location_path_ids: locationPathIds,
    p_measurement_region_ids: measurementRegionIds,
    p_family_topology_hash: await digest(family),
    p_relationship_fingerprint: await digest(relationships),
    p_factor_fingerprint: await digest(factors),
    p_evidence_data: safeEvidence,
  };
  const { data, error } = await service.rpc("submit_unit_evidence_atomic", rpcPayload);
  if (error) return json(500, { error: "Evidence could not be recorded" });
  return json(201, { evidenceId: data });
});
