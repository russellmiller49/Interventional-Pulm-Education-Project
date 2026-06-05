create or replace function public.grant_primary_site_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.email, '')) = 'admin@interventionalpulm.com' then
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
  end if;

  return new;
end;
$$;

revoke execute on function public.grant_primary_site_admin()
  from public, anon, authenticated;

drop trigger if exists grant_primary_site_admin_on_auth_user on auth.users;
create trigger grant_primary_site_admin_on_auth_user
  after insert or update of email on auth.users
  for each row
  execute function public.grant_primary_site_admin();

insert into public.site_entitlements (
  user_id,
  entitlement,
  status,
  granted_by,
  granted_at,
  expires_at,
  notes
)
select
  id,
  'site_admin',
  'active',
  null,
  timezone('utc', now()),
  null,
  'Backfilled primary site admin grant for admin@interventionalpulm.com.'
from auth.users
where lower(coalesce(email, '')) = 'admin@interventionalpulm.com'
on conflict (user_id, entitlement) do update
set
  status = 'active',
  expires_at = null,
  notes = excluded.notes,
  updated_at = timezone('utc', now());

notify pgrst, 'reload schema';
