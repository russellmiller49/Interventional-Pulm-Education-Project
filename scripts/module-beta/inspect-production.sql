-- READ ONLY. Run against main-site Endoreels, never the dedicated IP_Literature project.
-- Returns metadata and counts only: no report text, identities, image paths or image bytes.
select jsonb_build_object(
  'inspected_at', now(),
  'counts', jsonb_build_object(
    'overall_reviews', (select count(*) from public.module_beta_reviews),
    'reports', (select count(*) from public.module_beta_feedback),
    'reports_with_screenshots', (select count(*) from public.module_beta_feedback where screenshot_path is not null)
  ),
  'history', (select jsonb_agg(to_jsonb(m) order by version) from (
    select version, name from supabase_migrations.schema_migrations
    where name like '%module_beta%' or version = '20261109120000'
  ) m),
  'columns', (select jsonb_agg(to_jsonb(c) order by table_name, ordinal_position) from (
    select table_name, column_name, ordinal_position, data_type, is_nullable, column_default
    from information_schema.columns where table_schema = 'public'
      and table_name in ('module_beta_feedback', 'module_beta_reviews')
  ) c),
  'constraints', (select jsonb_agg(to_jsonb(c)) from (
    select conrelid::regclass::text as table_name, conname, convalidated,
      pg_get_constraintdef(oid) as definition from pg_constraint
    where conrelid in ('public.module_beta_feedback'::regclass, 'public.module_beta_reviews'::regclass)
  ) c),
  'indexes', (select jsonb_agg(to_jsonb(i)) from (
    select tablename, indexname, indexdef from pg_indexes where schemaname = 'public'
      and tablename in ('module_beta_feedback', 'module_beta_reviews')
  ) i),
  'rls', (select jsonb_agg(to_jsonb(r)) from (
    select relname, relrowsecurity, relforcerowsecurity from pg_class
    where oid in ('public.module_beta_feedback'::regclass, 'public.module_beta_reviews'::regclass)
  ) r),
  'policies', (select coalesce(jsonb_agg(to_jsonb(p)), '[]') from (
    select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies where
      (schemaname = 'public' and tablename in ('module_beta_feedback', 'module_beta_reviews'))
      or (schemaname = 'storage' and tablename = 'objects' and policyname = 'module_beta_feedback_server_only')
  ) p),
  'permissions', (select jsonb_agg(to_jsonb(p)) from (
    select r as role, t as table_name,
      has_table_privilege(r, 'public.' || t, 'SELECT') as can_select,
      has_table_privilege(r, 'public.' || t, 'INSERT') as can_insert,
      has_table_privilege(r, 'public.' || t, 'UPDATE') as can_update,
      has_table_privilege(r, 'public.' || t, 'DELETE') as can_delete
    from unnest(array['anon', 'authenticated', 'service_role']) r
    cross join unnest(array['module_beta_feedback', 'module_beta_reviews']) t
  ) p),
  'browser_column_grants', (select coalesce(jsonb_agg(to_jsonb(p)), '[]') from (
    select table_name, column_name, grantee, privilege_type from information_schema.column_privileges
    where table_schema = 'public' and table_name in ('module_beta_feedback', 'module_beta_reviews')
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ) p),
  'bucket', (select jsonb_agg(to_jsonb(b)) from (
    select id, public, file_size_limit, allowed_mime_types from storage.buckets
    where id = 'module-beta-feedback'
  ) b)
) as beta_metadata;
