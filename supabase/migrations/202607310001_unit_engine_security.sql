-- PlotScale Unit Engine security hardening.
-- Apply after the original bootstrap schema.

create extension if not exists pgcrypto;

create or replace function public.has_active_unit_entitlement(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscription_entitlements
    where user_id = target_user_id
      and status in ('active', 'trial')
      and (valid_until is null or valid_until > now())
  );
$$;

revoke all on function public.has_active_unit_entitlement(uuid) from public, anon;
grant execute on function public.has_active_unit_entitlement(uuid) to authenticated, service_role;

-- Paid configuration remains readable/exportable/deletable by its owner after
-- expiry, while creation and mutation require a current entitlement.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'unit_profiles',
    'unit_user_data',
    'custom_unit_families',
    'standalone_custom_units',
    'custom_measuring_tools',
    'unit_preferences'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_all', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_select', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_insert_paid', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_update_paid', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_delete', table_name);
    execute format(
      'create policy %I on public.%I for select using (auth.uid() = user_id)',
      table_name || '_owner_select', table_name
    );
    execute format(
      'create policy %I on public.%I for insert with check (auth.uid() = user_id and public.has_active_unit_entitlement(auth.uid()))',
      table_name || '_owner_insert_paid', table_name
    );
    execute format(
      'create policy %I on public.%I for update using (auth.uid() = user_id and public.has_active_unit_entitlement(auth.uid())) with check (auth.uid() = user_id and public.has_active_unit_entitlement(auth.uid()))',
      table_name || '_owner_update_paid', table_name
    );
    execute format(
      'create policy %I on public.%I for delete using (auth.uid() = user_id)',
      table_name || '_owner_delete', table_name
    );
  end loop;
end
$$;

drop policy if exists "unit_profile_revisions_owner_all" on public.unit_profile_revisions;
drop policy if exists "unit_profile_revisions_owner_select" on public.unit_profile_revisions;
drop policy if exists "unit_profile_revisions_owner_insert_paid" on public.unit_profile_revisions;
create policy "unit_profile_revisions_owner_select" on public.unit_profile_revisions
  for select using (auth.uid() = user_id);
create policy "unit_profile_revisions_owner_insert_paid" on public.unit_profile_revisions
  for insert with check (
    auth.uid() = user_id
    and public.has_active_unit_entitlement(auth.uid())
  );

create or replace function public.prevent_unit_revision_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Unit profile revisions are append-only';
end;
$$;

drop trigger if exists unit_profile_revisions_immutable on public.unit_profile_revisions;
create trigger unit_profile_revisions_immutable
  before update or delete on public.unit_profile_revisions
  for each row execute procedure public.prevent_unit_revision_mutation();

-- Do not expose payment-provider references through the user-readable table.
revoke select on public.subscription_entitlements from authenticated;
grant select (
  user_id, status, capabilities, valid_until, updated_at
) on public.subscription_entitlements to authenticated;

alter table public.unit_evidence
  add column if not exists location_scope_hash text,
  add column if not exists contributor_key_version text not null default 'v1';

update public.unit_evidence
set location_scope_hash = encode(digest(
  country_code || ':' || location_path_ids::text || ':' || measurement_region_ids::text,
  'sha256'
), 'hex')
where location_scope_hash is null;

alter table public.unit_evidence
  alter column location_scope_hash set not null;

drop index if exists unit_evidence_active_contributor_scope_idx;
create unique index unit_evidence_active_contributor_scope_idx
  on public.unit_evidence (
    contributor_hash,
    location_scope_hash,
    family_topology_hash,
    relationship_fingerprint
  )
  where superseded_at is null;

alter table public.unit_evidence
  drop constraint if exists unit_evidence_payload_size;
alter table public.unit_evidence
  add constraint unit_evidence_payload_size
  check (octet_length(evidence_data::text) <= 32768);

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
  scope_hash text;
begin
  scope_hash := encode(digest(
    upper(p_country_code) || ':' ||
    coalesce(p_location_path_ids, '[]'::jsonb)::text || ':' ||
    coalesce(p_measurement_region_ids, '[]'::jsonb)::text,
    'sha256'
  ), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(
    p_contributor_hash || ':' || scope_hash || ':' ||
    p_family_topology_hash || ':' || p_relationship_fingerprint,
    0
  ));

  select * into previous_row
  from public.unit_evidence
  where contributor_hash = p_contributor_hash
    and location_scope_hash = scope_hash
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
    contributor_key_version,
    country_code,
    location_path_ids,
    measurement_region_ids,
    location_scope_hash,
    family_topology_hash,
    relationship_fingerprint,
    factor_fingerprint,
    evidence_data,
    revision
  ) values (
    p_contributor_hash,
    'v1',
    upper(p_country_code),
    coalesce(p_location_path_ids, '[]'::jsonb),
    coalesce(p_measurement_region_ids, '[]'::jsonb),
    scope_hash,
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
