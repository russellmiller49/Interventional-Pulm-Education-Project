-- Author collaboration uses the existing protected case/revision store. Publication
-- is a separate pointer; saving a draft never changes a learner's released content.
create function public.socrates_library_editor() returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and public.current_user_can_edit_socrates()
    and exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and not coalesce(is_anonymous,false));
$$;
revoke all on function public.socrates_library_editor() from public,anon;
grant execute on function public.socrates_library_editor() to authenticated;

create table public.socrates_library_slides (
  id uuid primary key,
  case_id uuid not null unique references public.socrates_slides(id),
  import_key text not null unique check (length(import_key) between 1 and 200),
  assignment text not null default 'unassigned' check (assignment in ('unassigned','teaching','testing')),
  version integer not null default 1 check (version > 0),
  published_revision integer,
  published_assignment text check (published_assignment in ('teaching','testing')),
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  foreign key(case_id,published_revision) references public.socrates_revisions(slide_id,revision),
  check ((published_revision is null) = (published_assignment is null)),
  check ((published_revision is null) = (published_at is null))
);
create index socrates_library_updated_by_idx on public.socrates_library_slides(updated_by);
alter table public.socrates_library_slides enable row level security;
revoke all on public.socrates_library_slides from public,anon,authenticated;
grant select on public.socrates_library_slides to authenticated,service_role;
create policy editor_read on public.socrates_library_slides for select to authenticated
using ((select public.socrates_library_editor()));

create function public.list_socrates_library_slides(requested_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.socrates_library_editor() then
    raise exception 'SOCRATES editor access required' using errcode='42501';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'id',l.id,'importKey',l.import_key,'version',l.version,'assignment',l.assignment,
    'publishedRevision',l.published_revision,'publishedAssignment',l.published_assignment,
    'publishedAt',l.published_at,'updatedAt',l.updated_at,'document',r.snapshot
  ) order by l.updated_at desc,l.id),'[]'::jsonb)
  from public.socrates_library_slides l join public.socrates_slides s on s.id=l.case_id
  join public.socrates_revisions r on r.slide_id=s.id and r.revision=s.revision where requested_id is null or l.id=requested_id);
end $$;
revoke all on function public.list_socrates_library_slides(uuid) from public,anon;
grant execute on function public.list_socrates_library_slides(uuid) to authenticated;

create function public.save_socrates_library_slide(library_id uuid, expected_version integer,
  assignment text, payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare l public.socrates_library_slides%rowtype; saved jsonb; key text; source jsonb;
begin
  if auth.uid() is null or not public.socrates_library_editor() then
    raise exception 'SOCRATES editor access required' using errcode='42501';
  end if;
  if library_id is null or expected_version is null or expected_version < 0 or
    assignment is null or assignment not in ('unassigned','teaching','testing') or
    octet_length(payload::text)>1048576 then raise exception 'Invalid library draft'; end if;
  -- Validate the complete author package even for direct RPC callers.
  perform public.socrates_validate_case_v2(payload);
  source := payload#>'{authorContent,curriculumSource}';
  key := case when source is not null then 'workbook:'||(source->>'workbookSha256')||':'||(source->>'sourceRow')
    else 'local:'||library_id::text end;
  select * into l from public.socrates_library_slides where id=library_id for update;
  if found then
    if l.version<>expected_version or (payload->>'recordId')::uuid is distinct from l.case_id then
      raise exception 'Another author changed this slide. Review the latest draft before saving.' using errcode='40001';
    end if;
    -- Identity is fixed after import, even if the author edits provenance fields.
    saved := public.save_socrates_case_v2(payload || jsonb_build_object('workflowStatus','draft','publishedAt',null));
    update public.socrates_library_slides set assignment=save_socrates_library_slide.assignment,
      version=version+1,updated_at=now(),updated_by=auth.uid() where id=library_id;
  else
    if expected_version<>0 then raise exception 'Shared slide no longer exists' using errcode='40001'; end if;
    if exists(select 1 from public.socrates_library_slides x where x.import_key=key) then
      raise exception 'This source slide is already in the shared library. Open its shared draft.' using errcode='23505';
    end if;
    saved := public.save_socrates_case_v2((payload-'recordId') || jsonb_build_object('revision',0,'workflowStatus','draft','publishedAt',null));
    insert into public.socrates_library_slides(id,case_id,import_key,assignment,updated_by)
    values(library_id,(saved->>'recordId')::uuid,key,assignment,auth.uid());
  end if;
  return (select item from jsonb_array_elements(public.list_socrates_library_slides(library_id)) item where item->>'id'=library_id::text);
end $$;
revoke all on function public.save_socrates_library_slide(uuid,integer,text,jsonb) from public,anon;
grant execute on function public.save_socrates_library_slide(uuid,integer,text,jsonb) to authenticated;

create function public.publish_socrates_library_slide(library_id uuid, expected_version integer,
  expected_revision integer, release boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare l public.socrates_library_slides%rowtype; p jsonb; rev integer;
begin
  if auth.uid() is null or not public.current_user_has_site_admin() or not public.socrates_library_editor() then
    raise exception 'Site administrator access is required to publish.' using errcode='42501'; end if;
  select * into l from public.socrates_library_slides where id=library_id for update;
  if not found or expected_version is null or l.version<>expected_version then
    raise exception 'Library changed. Reload before publishing.' using errcode='40001'; end if;
  select revision into rev from public.socrates_slides where id=l.case_id for update;
  if expected_revision is null or rev<>expected_revision then
    raise exception 'Draft changed. Review the latest revision before publishing.' using errcode='40001'; end if;
  if release is null then raise exception 'Choose publish or withdraw'; end if;
  if release then
    if l.assignment='unassigned' then raise exception 'Assign Teaching or Testing before publishing.'; end if;
    select snapshot into p from public.socrates_revisions where slide_id=l.case_id and revision=rev;
    if p#>>'{authorContent,readiness,contentReview}' is distinct from 'ready'
      or p#>>'{authorContent,readiness,deidentificationVerified}' is distinct from 'true'
      or p#>>'{authorContent,readiness,identifiersVerified}' is distinct from 'true'
      or p#>>'{authorContent,readiness,imaging}' is distinct from 'ready'
      or coalesce(p#>>'{authorContent,readiness,secondaryRose}','') not in ('ready','not-applicable')
      or p#>>'{authorContent,readiness,technicalHold}' is distinct from 'false' then
      raise exception 'Complete content, identity, de-identification, imaging, and secondary review before publishing.';
    end if;
    if l.assignment='testing' and (length(trim(coalesce(p#>>'{caseContent,adequacy,designation}','')))=0
      or length(trim(coalesce(p#>>'{caseContent,adequacy,reasoning}','')))=0
      or length(trim(coalesce(p#>>'{caseContent,cancer,designation}','')))=0
      or length(trim(coalesce(p#>>'{caseContent,cancer,reasoning}','')))=0) then
      raise exception 'Complete the reference interpretations before publishing testing slides.'; end if;
  end if;
  update public.socrates_library_slides set published_revision=case when release then rev end,
    published_assignment=case when release then assignment end,published_at=case when release then now() end,
    version=version+1,updated_at=now(),updated_by=auth.uid() where id=library_id;
  return (select item from jsonb_array_elements(public.list_socrates_library_slides(library_id)) item where item->>'id'=library_id::text);
end $$;
revoke all on function public.publish_socrates_library_slide(uuid,integer,integer,boolean) from public,anon;
grant execute on function public.publish_socrates_library_slide(uuid,integer,integer,boolean) to authenticated;

-- Raw published snapshots remain server-only: testing answers/URLs are projected in
-- the authenticated server route, never sent as a hidden full author document.
create function public.socrates_library_releases(requested_id uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'assignment',l.published_assignment,
    'publishedAt',l.published_at,'document',r.snapshot) order by l.id),'[]'::jsonb)
  from public.socrates_library_slides l join public.socrates_revisions r
    on r.slide_id=l.case_id and r.revision=l.published_revision
  join public.socrates_case_readiness ready on ready.case_id=l.case_id
  where (requested_id is null or l.id=requested_id) and not ready.technical_hold and ready.content_review<>'hold' and ready.imaging<>'hold'
    and ready.secondary_rose<>'hold';
$$;
revoke all on function public.socrates_library_releases(uuid) from public,anon,authenticated;
grant execute on function public.socrates_library_releases(uuid) to service_role;
