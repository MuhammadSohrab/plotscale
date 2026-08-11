-- Server-authoritative, append-only unit profile revisions.
create or replace function public.save_unit_profile_revision(p_profile jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_version integer;
  v_profile jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if not public.has_active_unit_entitlement(v_user_id) then
    raise exception 'Active unit setup entitlement required';
  end if;
  if pg_column_size(p_profile) > 262144 then
    raise exception 'Unit profile payload too large';
  end if;

  v_profile_id := coalesce(nullif(p_profile->>'id', '')::uuid, gen_random_uuid());
  perform pg_advisory_xact_lock(hashtext(v_profile_id::text));

  select coalesce(max(profile_version), 0) + 1
    into v_version
    from public.unit_profile_revisions
   where profile_id = v_profile_id;

  v_profile := jsonb_set(
    jsonb_set(
      jsonb_set(p_profile, '{id}', to_jsonb(v_profile_id::text), true),
      '{userId}', to_jsonb(v_user_id::text), true
    ),
    '{profileVersion}', to_jsonb(v_version), true
  );

  insert into public.unit_profiles (
    id, user_id, name, default_input_length_unit, default_output_area_unit,
    laggi_meters, hierarchy_multipliers, is_default, created_at, updated_at, profile_data
  ) values (
    v_profile_id,
    v_user_id,
    coalesce(nullif(v_profile->>'name', ''), 'My unit profile'),
    coalesce(v_profile->>'defaultInputLengthUnit', 'METER'),
    coalesce(v_profile->>'defaultOutputAreaUnit', 'SQM'),
    nullif(v_profile->>'laggiMeters', '')::numeric,
    coalesce(v_profile->'hierarchyMultipliers', '{}'::jsonb),
    coalesce((v_profile->>'isDefault')::boolean, false),
    coalesce((v_profile->>'createdAt')::timestamptz, now()),
    now(),
    v_profile
  )
  on conflict (id) do update set
    name = excluded.name,
    default_input_length_unit = excluded.default_input_length_unit,
    default_output_area_unit = excluded.default_output_area_unit,
    laggi_meters = excluded.laggi_meters,
    hierarchy_multipliers = excluded.hierarchy_multipliers,
    is_default = excluded.is_default,
    updated_at = now(),
    profile_data = excluded.profile_data
  where unit_profiles.user_id = v_user_id;

  insert into public.unit_profile_revisions (
    profile_id, profile_version, user_id, profile_data
  ) values (v_profile_id, v_version, v_user_id, v_profile);

  return v_profile;
end;
$$;

revoke all on function public.save_unit_profile_revision(jsonb) from public;
grant execute on function public.save_unit_profile_revision(jsonb) to authenticated;
