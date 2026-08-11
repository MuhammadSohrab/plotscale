-- Run after all numbered migrations in an isolated Supabase test project.
begin;

do $$
declare
  paid_tables text[] := array[
    'unit_profiles',
    'unit_user_data',
    'custom_unit_families',
    'standalone_custom_units',
    'custom_measuring_tools',
    'unit_preferences'
  ];
  table_name text;
begin
  foreach table_name in array paid_tables loop
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = table_name || '_paid_insert'
    ) then
      raise exception 'Missing paid insert policy for %', table_name;
    end if;
  end loop;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'unit_profile_revisions_immutable'
      and not tgisinternal
  ) then
    raise exception 'Unit profile revisions are not immutable';
  end if;

  if to_regprocedure('public.save_unit_profile_revision(jsonb)') is null then
    raise exception 'Append-only profile revision RPC is missing';
  end if;

  if to_regprocedure(
    'public.submit_unit_evidence_atomic(text,text,jsonb,jsonb,text,text,text,jsonb)'
  ) is null then
    raise exception 'Privacy-scoped evidence RPC is missing';
  end if;
end;
$$;

rollback;
