-- PlotScale Part 1: lightweight cloud data only.
-- Run in the Supabase SQL editor. Heavy plots/media intentionally never appear here.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null,
  registered_at timestamptz not null default now(),
  subscription_status text not null default 'free'
    check (subscription_status in ('free', 'trial', 'active', 'past_due', 'cancelled')),
  credit_balance numeric(12, 2) not null default 0 check (credit_balance >= 0)
);

create or replace function public.protect_server_managed_profile_fields()
returns trigger
language plpgsql
as $$
begin
  if current_user <> 'service_role' then
    if tg_op = 'INSERT' then
      new.subscription_status := 'free';
      new.credit_balance := 0;
    else
      new.subscription_status := old.subscription_status;
      new.credit_balance := old.credit_balance;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_entitlement_fields on public.profiles;
create trigger protect_profile_entitlement_fields
  before insert or update on public.profiles
  for each row execute procedure public.protect_server_managed_profile_fields();

create table if not exists public.app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  language text not null default 'en',
  default_calculation_mode text not null default 'manual',
  updated_at timestamptz not null default now()
);

create table if not exists public.unit_profiles (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  default_input_length_unit text not null default 'METER',
  default_output_area_unit text not null default 'SQM',
  laggi_meters numeric null check (laggi_meters is null or laggi_meters > 0),
  hierarchy_multipliers jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.unit_profiles
  add column if not exists profile_data jsonb not null default '{}'::jsonb;

create table if not exists public.unit_user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  location_profile jsonb not null default '{}'::jsonb,
  custom_area_units jsonb not null default '[]'::jsonb,
  custom_tools jsonb not null default '[]'::jsonb,
  compound_recipes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Unit Intelligence Engine: private user-owned configuration.
create table if not exists public.unit_profile_revisions (
  profile_id uuid not null references public.unit_profiles(id) on delete cascade,
  profile_version integer not null check (profile_version > 0),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, profile_version)
);

create table if not exists public.custom_unit_families (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  dimension text not null check (dimension in ('length', 'area')),
  family_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.standalone_custom_units (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  dimension text not null check (dimension in ('length', 'area')),
  unit_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.custom_measuring_tools (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.unit_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.device_installations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_hash text not null,
  platform text,
  app_version text,
  last_seen_at timestamptz not null default now(),
  unique (user_id, installation_hash)
);

create table if not exists public.subscription_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'free'
    check (status in ('free', 'trial', 'active', 'past_due', 'cancelled', 'expired')),
  capabilities jsonb not null default '{}'::jsonb,
  valid_until timestamptz,
  provider_reference text,
  updated_at timestamptz not null default now()
);

-- Signed catalog data. Client applications may read published rows but cannot
-- mutate them.
create table if not exists public.location_nodes (
  id text primary key,
  parent_id text references public.location_nodes(id),
  country_code text not null,
  level_index integer not null check (level_index >= 0),
  type_code text not null,
  localized_names jsonb not null,
  official_code text,
  aliases jsonb not null default '[]'::jsonb,
  is_administrative boolean not null default true,
  source jsonb not null default '{}'::jsonb,
  catalog_version text not null
);

create table if not exists public.measurement_regions (
  id text primary key,
  country_code text not null,
  name text not null,
  aliases jsonb not null default '[]'::jsonb,
  location_node_ids jsonb not null default '[]'::jsonb,
  parent_measurement_region_id text references public.measurement_regions(id),
  region_type text not null,
  source jsonb not null default '{}'::jsonb,
  catalog_version text not null
);

create table if not exists public.unit_catalog_releases (
  id text not null,
  version text not null,
  tier text not null check (tier in ('standard', 'suggested')),
  manifest jsonb not null,
  data jsonb not null,
  sha256 text not null,
  signature text not null,
  published_at timestamptz not null default now(),
  primary key (id, version)
);

-- Evidence is deliberately not user-owned profile data. Direct client access
-- is denied; only a server/Edge Function with the service role may write it.
create table if not exists public.unit_evidence (
  id uuid primary key default gen_random_uuid(),
  contributor_hash text not null,
  country_code text not null,
  location_path_ids jsonb not null default '[]'::jsonb,
  measurement_region_ids jsonb not null default '[]'::jsonb,
  family_topology_hash text not null,
  relationship_fingerprint text not null,
  factor_fingerprint text not null,
  evidence_data jsonb not null,
  revision integer not null default 1,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists unit_evidence_active_contributor_scope_idx
  on public.unit_evidence (
    contributor_hash,
    country_code,
    family_topology_hash,
    relationship_fingerprint
  )
  where superseded_at is null;

create table if not exists public.unit_evidence_revisions (
  evidence_id uuid not null references public.unit_evidence(id) on delete cascade,
  revision integer not null,
  evidence_data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (evidence_id, revision)
);

create table if not exists public.unit_evidence_aggregates (
  id uuid primary key default gen_random_uuid(),
  country_code text not null,
  location_scope_hash text not null,
  family_topology_hash text not null,
  relationship_fingerprint text not null,
  factor_cluster text not null,
  distinct_contributor_count integer not null check (distinct_contributor_count >= 0),
  percentage numeric(7, 4) not null check (percentage >= 0 and percentage <= 100),
  aggregate_data jsonb not null,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (
    country_code,
    location_scope_hash,
    family_topology_hash,
    relationship_fingerprint,
    factor_cluster
  )
);

create or replace function public.submit_unit_evidence_atomic(
  p_contributor_hash text,
  p_country_code text,
  p_location_path_ids jsonb,
  p_measurement_region_ids jsonb,
  p_family_topology_hash text,
  p_relationship_fingerprint text,
  p_factor_fingerprint text,
  p_evidence_data jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_row public.unit_evidence%rowtype;
  new_id uuid;
  next_revision integer := 1;
begin
  perform pg_advisory_xact_lock(hashtextextended(
    p_contributor_hash || ':' || p_country_code || ':' ||
    p_family_topology_hash || ':' || p_relationship_fingerprint,
    0
  ));

  select * into previous_row
  from public.unit_evidence
  where contributor_hash = p_contributor_hash
    and country_code = p_country_code
    and family_topology_hash = p_family_topology_hash
    and relationship_fingerprint = p_relationship_fingerprint
    and superseded_at is null
  for update;

  if found then
    next_revision := previous_row.revision + 1;
    update public.unit_evidence
      set superseded_at = now(), updated_at = now()
      where id = previous_row.id;
  end if;

  insert into public.unit_evidence (
    contributor_hash,
    country_code,
    location_path_ids,
    measurement_region_ids,
    family_topology_hash,
    relationship_fingerprint,
    factor_fingerprint,
    evidence_data,
    revision
  ) values (
    p_contributor_hash,
    p_country_code,
    coalesce(p_location_path_ids, '[]'::jsonb),
    coalesce(p_measurement_region_ids, '[]'::jsonb),
    p_family_topology_hash,
    p_relationship_fingerprint,
    p_factor_fingerprint,
    p_evidence_data,
    next_revision
  )
  returning id into new_id;

  insert into public.unit_evidence_revisions (evidence_id, revision, evidence_data)
  values (new_id, next_revision, p_evidence_data);
  return new_id;
end;
$$;

revoke all on function public.submit_unit_evidence_atomic(
  text, text, jsonb, jsonb, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.submit_unit_evidence_atomic(
  text, text, jsonb, jsonb, text, text, text, jsonb
) to service_role;

create index if not exists unit_profiles_user_id_idx on public.unit_profiles(user_id);

alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.unit_profiles enable row level security;
alter table public.unit_user_data enable row level security;
alter table public.unit_profile_revisions enable row level security;
alter table public.custom_unit_families enable row level security;
alter table public.standalone_custom_units enable row level security;
alter table public.custom_measuring_tools enable row level security;
alter table public.unit_preferences enable row level security;
alter table public.device_installations enable row level security;
alter table public.subscription_entitlements enable row level security;
alter table public.location_nodes enable row level security;
alter table public.measurement_regions enable row level security;
alter table public.unit_catalog_releases enable row level security;
alter table public.unit_evidence enable row level security;
alter table public.unit_evidence_revisions enable row level security;
alter table public.unit_evidence_aggregates enable row level security;

drop policy if exists "profiles_owner_all" on public.profiles;
create policy "profiles_owner_all" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "settings_owner_all" on public.app_settings;
create policy "settings_owner_all" on public.app_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "unit_profiles_owner_all" on public.unit_profiles;
create policy "unit_profiles_owner_all" on public.unit_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "unit_user_data_owner_all" on public.unit_user_data;
create policy "unit_user_data_owner_all" on public.unit_user_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "unit_profile_revisions_owner_all" on public.unit_profile_revisions;
create policy "unit_profile_revisions_owner_all" on public.unit_profile_revisions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "custom_unit_families_owner_all" on public.custom_unit_families;
create policy "custom_unit_families_owner_all" on public.custom_unit_families
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "standalone_custom_units_owner_all" on public.standalone_custom_units;
create policy "standalone_custom_units_owner_all" on public.standalone_custom_units
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "custom_measuring_tools_owner_all" on public.custom_measuring_tools;
create policy "custom_measuring_tools_owner_all" on public.custom_measuring_tools
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "unit_preferences_owner_all" on public.unit_preferences;
create policy "unit_preferences_owner_all" on public.unit_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "device_installations_owner_all" on public.device_installations;
create policy "device_installations_owner_all" on public.device_installations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "subscription_entitlements_owner_read" on public.subscription_entitlements;
create policy "subscription_entitlements_owner_read" on public.subscription_entitlements
  for select using (auth.uid() = user_id);

drop policy if exists "location_nodes_published_read" on public.location_nodes;
create policy "location_nodes_published_read" on public.location_nodes for select using (true);
drop policy if exists "measurement_regions_published_read" on public.measurement_regions;
create policy "measurement_regions_published_read" on public.measurement_regions for select using (true);
drop policy if exists "unit_catalog_releases_published_read" on public.unit_catalog_releases;
create policy "unit_catalog_releases_published_read" on public.unit_catalog_releases for select using (true);

create or replace function public.create_plotscale_profile()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, name, email, registered_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.email, ''),
    coalesce(new.created_at, now())
  )
  on conflict (user_id) do nothing;
  insert into public.app_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;
  insert into public.unit_user_data (user_id) values (new.id)
  on conflict (user_id) do nothing;
  insert into public.subscription_entitlements (user_id, status)
  values (new.id, 'free')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_plotscale_profile();
