-- Bounded, authenticated, atomic workbook import through the existing v2 save.
-- No source workbook, case, membership or publication is seeded by this migration.
create table public.socrates_import_receipts (
  import_id text primary key check(import_id ~ '^[a-f0-9]{64}$'),
  payload_hash text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  result jsonb not null
);
alter table public.socrates_import_receipts enable row level security;
revoke all on public.socrates_import_receipts from public,anon,authenticated;
grant select on public.socrates_import_receipts to authenticated;
grant all on public.socrates_import_receipts to service_role;
create policy own_editor_receipt on public.socrates_import_receipts for select to authenticated
  using(created_by=(select auth.uid()) and (select public.current_user_can_edit_socrates()));

create function public.socrates_apply_workbook_import(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e jsonb; d jsonb; old jsonb; saved jsonb; source jsonb; names text[]; image_names text[];
  k text; key text; fingerprint text; receipt public.socrates_import_receipts%rowtype;
  updated jsonb := '[]'; unchanged jsonb := '[]'; module_results jsonb := '[]'; result jsonb;
  m jsonb; member jsonb; prior_member public.socrates_curriculum_memberships%rowtype;
  allowed_case text[] := array['learnerNarrative','lowMagnificationObservations','highMagnificationObservations','keyLearningPoints','adequacy','cancer','preliminaryDiagnosis'];
begin
  if auth.uid() is null or not public.current_user_can_edit_socrates() then raise exception 'Editor access required' using errcode='42501'; end if;
  if jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>8388608
    or exists(select 1 from jsonb_object_keys(payload) field where field not in ('importId','sourceSha256','updates','modules'))
    or coalesce(payload->>'importId','') !~ '^[a-f0-9]{64}$' or coalesce(payload->>'sourceSha256','') !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(payload->'updates') is distinct from 'array' or jsonb_array_length(payload->'updates') not between 1 and 59
    or jsonb_typeof(payload->'modules') is distinct from 'array' or jsonb_array_length(payload->'modules')>6 then raise exception 'Invalid bounded import plan'; end if;
  fingerprint := encode(extensions.digest(payload::text,'sha256'),'hex');
  -- Serialize retries for this key, without creating duplicate revisions.
  perform pg_advisory_xact_lock(hashtextextended(payload->>'importId',0));
  select * into receipt from public.socrates_import_receipts where import_id=payload->>'importId';
  if found then
    if receipt.created_by<>auth.uid() or receipt.payload_hash<>fingerprint then raise exception 'Import key already belongs to a different request'; end if;
    return receipt.result;
  end if;
  if (select count(distinct value#>>'{document,recordId}') from jsonb_array_elements(payload->'updates'))<>jsonb_array_length(payload->'updates')
    or (select count(distinct value->>'sourceKey') from jsonb_array_elements(payload->'updates'))<>jsonb_array_length(payload->'updates')
    or (select count(distinct value->>'moduleId') from jsonb_array_elements(payload->'modules'))<>jsonb_array_length(payload->'modules') then
    raise exception 'Duplicate import source, target or module';
  end if;
  -- Take all row locks in a stable order before checking expected revisions.
  perform 1 from public.socrates_slides where id in
    (select (value#>>'{document,recordId}')::uuid from jsonb_array_elements(payload->'updates')) order by id for update;
  perform 1 from public.socrates_curriculum_modules where id in
    (select value->>'moduleId' from jsonb_array_elements(payload->'modules')) order by id for update;
  for e in select value from jsonb_array_elements(payload->'updates') loop
    if jsonb_typeof(e) is distinct from 'object'
      or exists(select 1 from jsonb_object_keys(e) field where field not in ('sourceKey','expectedRevision','expectedImageUrl','approvedFields','document'))
      or jsonb_typeof(e->'approvedFields') is distinct from 'array' or jsonb_array_length(e->'approvedFields')>10
      or exists(select 1 from jsonb_array_elements(e->'approvedFields') field where jsonb_typeof(field)<>'string')
      or jsonb_typeof(e->'expectedRevision') is distinct from 'number' or e->>'expectedRevision' !~ '^[0-9]+$'
      or jsonb_typeof(e->'expectedImageUrl') is distinct from 'string' then raise exception 'Invalid import update'; end if;
    d := e->'document';
    perform public.socrates_validate_case_v2(d);
    select r.snapshot into old from public.socrates_slides s join public.socrates_revisions r on r.slide_id=s.id and r.revision=s.revision
      where s.id=(d->>'recordId')::uuid;
    if old is null or old->>'schemaVersion' is distinct from '2' then raise exception 'Import requires an existing saved v2 case'; end if;
    if (old->>'revision')::integer<>(e->>'expectedRevision')::integer or d->'revision' is distinct from e->'expectedRevision' then
      raise exception 'Case changed; compare current draft and rebuild import' using errcode='40001';
    end if;
    source := d#>'{authorContent,curriculumSource}';
    if source is null or source->>'workbookSha256' is distinct from payload->>'sourceSha256'
      or source#>>'{sourceValues,Full Learner-Facing Text}' is distinct from d#>>'{caseContent,learnerNarrative}' then raise exception 'Source narrative/hash mismatch'; end if;
    names := regexp_match(source#>>'{sourceValues,Full Case Name}','^Case ([0-9]+) · Series ([0-9]+) · .+$');
    image_names := regexp_match(old#>>'{slide,descriptorUrl}',
      '^https://ucsd-slide-viewer-1080580899927[.]us-central1[.]run[.]app/generated/tiles/nio-([0-9]+)-series-([0-9]+)-barcode-[a-z0-9]+/original[.]dzi$');
    if names is null or image_names is null then raise exception 'Actual source/image identity requires reconciliation'; end if;
    key := 'case-'||names[1]::bigint||'-series-'||names[2]::bigint;
    if key is distinct from e->>'sourceKey' or names[1]::bigint<>image_names[1]::bigint or names[2]::bigint<>image_names[2]::bigint
      or e->>'expectedImageUrl' is distinct from old#>>'{slide,descriptorUrl}' then raise exception 'Case AND series/image identity mismatch'; end if;
    if (d-array['revision','workflowStatus','caseContent','authorContent']) is distinct from (old-array['revision','workflowStatus','caseContent','authorContent'])
      or ((d->'caseContent')-allowed_case) is distinct from ((old->'caseContent')-allowed_case)
      or ((d#>'{authorContent,readiness}')-'contentReview') is distinct from ((old#>'{authorContent,readiness}')-'contentReview')
      or ((d->'authorContent')-array['readiness','curriculumSource']) is distinct from ((old->'authorContent')-array['readiness','curriculumSource']) then
      raise exception 'Import would alter protected existing fields';
    end if;
    foreach k in array allowed_case loop
      if d#>array['caseContent',k] is distinct from old#>array['caseContent',k]
        and old#>array['caseContent',k] is not null and old#>array['caseContent',k] not in
          ('null'::jsonb,'""'::jsonb,'[]'::jsonb,'{"designation":"","reasoning":""}'::jsonb)
        and not (e->'approvedFields' ? ('caseContent.'||k)) then raise exception 'Existing teaching replacement needs per-field approval: %',k; end if;
    end loop;
    if old#>'{authorContent,curriculumSource}' is not null and old#>'{authorContent,curriculumSource}' is distinct from source
      and not (e->'approvedFields' ? 'authorContent.curriculumSource') then raise exception 'Existing provenance replacement needs approval'; end if;
    if d->>'workflowStatus' is distinct from old->>'workflowStatus' and
      (old->>'workflowStatus'<>'published' or d->>'workflowStatus'<>'draft' or not (e->'approvedFields' ? 'workflowStatus')) then raise exception 'Draft workflow transition needs approval'; end if;
    if d->'caseContent' is distinct from old->'caseContent' then
      d := jsonb_set(d,'{authorContent,readiness,contentReview}','"incomplete"');
    elsif d#>'{authorContent,readiness,contentReview}' is distinct from old#>'{authorContent,readiness,contentReview}' then
      raise exception 'Import cannot approve review';
    end if;
    if d=old then
      unchanged := unchanged||jsonb_build_array(jsonb_build_object('caseId',d->'recordId','revision',d->'revision'));
    else
      saved := public.save_socrates_case_v2(d);
      updated := updated||jsonb_build_array(jsonb_build_object('caseId',saved->'recordId','revision',saved->'revision'));
    end if;
  end loop;
  for m in select value from jsonb_array_elements(payload->'modules') order by value->>'moduleId' loop
    for member in select value from jsonb_array_elements(m->'memberships') loop
      select value->'document' into d from jsonb_array_elements(payload->'updates') where value#>>'{document,recordId}'=member->>'caseId';
      if d is null then raise exception 'Membership has no mapped case in this batch'; end if;
      source := d#>'{authorContent,curriculumSource,sourceValues}';
      if member->'sourceOrder' is distinct from source->'Overall Order' or member->'position' is distinct from source->'Order in Module'
        or not exists(select 1 from public.socrates_curriculum_modules cm where cm.id=m->>'moduleId' and source->>'Module'='MODULE '||cm.display_order||' — '||cm.title)
        or not exists(select 1 from jsonb_array_elements(payload->'updates') u where u#>>'{document,recordId}'=member->>'caseId' and u->>'sourceKey'=member->>'sourceKey')
        then raise exception 'Source membership values changed'; end if;
      if member->>'sourceKey' in ('case-430-series-2','case-357-series-2','case-436-series-1') and member->>'state' is distinct from 'held' then
        raise exception 'Unresolved source decision must remain held'; end if;
      select * into prior_member from public.socrates_curriculum_memberships where module_id=m->>'moduleId' and case_id=(member->>'caseId')::uuid;
      if found and prior_member.release_state='approved' and (prior_member.position<>(member->>'position')::integer or prior_member.source_key<>member->>'sourceKey') then
        raise exception 'Reordering an approved membership requires a separate administrator decision'; end if;
    end loop;
    module_results := module_results||jsonb_build_array(jsonb_build_object('moduleId',m->'moduleId','revision',public.socrates_change_memberships(m,false)));
  end loop;
  -- Any case or membership failure rolls back the entire call, including revisions.
  result := jsonb_build_object('importId',payload->'importId','updated',updated,'unchanged',unchanged,'modules',module_results);
  insert into public.socrates_import_receipts(import_id,payload_hash,created_by,result) values(payload->>'importId',fingerprint,auth.uid(),result);
  return result;
end $$;
revoke all on function public.socrates_apply_workbook_import(jsonb) from public,anon;
grant execute on function public.socrates_apply_workbook_import(jsonb) to authenticated;
notify pgrst,'reload schema';
