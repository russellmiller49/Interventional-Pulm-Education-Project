create or replace function public.grant_primary_site_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  primary_admin_email constant text := 'admin@interventionalpulm.com';
  new_email text := lower(coalesce(new.email, ''));
  old_email text := '';
begin
  if tg_op = 'UPDATE' then
    old_email := lower(coalesce(old.email, ''));
  end if;

  if new_email = primary_admin_email then
    insert into public.site_entitlements (
      user_id,
      entitlement,
      status,
      granted_by,
      granted_at,
      expires_at,
      notes
    )
    values (
      new.id,
      'site_admin',
      'active',
      null,
      timezone('utc', now()),
      null,
      'Automatic primary site admin grant for admin@interventionalpulm.com.'
    )
    on conflict (user_id, entitlement) do update
    set
      status = 'active',
      expires_at = null,
      notes = excluded.notes,
      updated_at = timezone('utc', now());
  elsif tg_op = 'UPDATE' and old_email = primary_admin_email then
    update public.site_entitlements
    set
      status = 'revoked',
      expires_at = timezone('utc', now()),
      notes = 'Automatic primary site admin grant revoked after admin email changed.',
      updated_at = timezone('utc', now())
    where user_id = new.id
      and entitlement = 'site_admin'
      and (
        granted_by is null
        or notes ilike '%primary site admin%'
      );
  end if;

  return new;
end;
$$;

revoke execute on function public.grant_primary_site_admin()
  from public, anon, authenticated;

notify pgrst, 'reload schema';
