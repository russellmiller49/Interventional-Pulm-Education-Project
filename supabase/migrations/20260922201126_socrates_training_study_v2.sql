-- Forward-only SOCRATES case packages and authenticated study sessions.
-- No case content, clinical response options, enrollment or active study is seeded.

alter table public.site_entitlements drop constraint site_entitlements_entitlement_check;
alter table public.site_entitlements add constraint site_entitlements_entitlement_check check (
  entitlement in ('socal_ebus_course','ip_registry','site_admin','pccm_intro_course',
    'pccm_intro_course_admin_ucsd','pccm_intro_course_admin_loma_linda','socrates_editor',
    'preference_cards_builder','socrates_participant')
);
alter table public.socrates_slides drop constraint socrates_slides_descriptor_url_check;
alter table public.socrates_slides add constraint socrates_slides_descriptor_url_check check (
  descriptor_url ~ '^https://www[.]invenio-cloud[.]com/api/thinslides/[A-Za-z0-9._-]+[.]dzi$'
  or descriptor_url ~ '^https://ucsd-slide-viewer-1080580899927[.]us-central1[.]run[.]app/generated/tiles/nio-[0-9]+-series-[0-9]+-barcode-[a-z0-9]+/(original|analysis)[.]dzi$'
);
alter table public.socrates_annotations add column explanation text not null default '' check (length(explanation) <= 8000);

create table public.socrates_case_content (
  case_id uuid primary key references public.socrates_slides(id) on delete cascade,
  schema_version integer not null default 2 check (schema_version = 2),
  diagnostic_category text not null check (length(diagnostic_category) <= 160),
  subcategory text not null default '' check (length(subcategory) <= 160),
  sort_order integer not null default 0 check (sort_order >= 0),
  training_eligible boolean not null default false,
  testing_eligible boolean not null default false,
  vignette text not null default '' check (length(vignette) <= 8000),
  low_observations text[] not null default '{}',
  high_observations text[] not null default '{}',
  learning_points text[] not null default '{}',
  adequacy_designation text not null default '',
  adequacy_reasoning text not null default '',
  cancer_designation text not null default '',
  cancer_reasoning text not null default '',
  preliminary_designation text,
  preliminary_reasoning text,
  legend_reviewed boolean not null default false
);
create table public.socrates_case_legend (
  case_id uuid not null references public.socrates_case_content(case_id) on delete cascade,
  position integer not null check (position between 0 and 39),
  label text not null check (length(trim(label)) between 1 and 120),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  explanation text not null default '' check (length(explanation) <= 2000),
  primary key (case_id, position)
);
create table public.socrates_case_readiness (
  case_id uuid primary key references public.socrates_case_content(case_id) on delete cascade,
  internal_highlight_notes text not null default '' check (length(internal_highlight_notes) <= 8000),
  provenance_notes text not null default '' check (length(provenance_notes) <= 8000),
  content_review text not null default 'incomplete' check (content_review in ('incomplete','ready','hold')),
  deidentification_verified boolean not null default false,
  identifiers_verified boolean not null default false,
  imaging text not null default 'incomplete' check (imaging in ('incomplete','ready','hold')),
  secondary_rose text not null default 'incomplete' check (secondary_rose in ('incomplete','ready','hold','not-applicable')),
  technical_hold boolean not null default false,
  hold_reason text not null default '' check (length(hold_reason) <= 8000)
);
create index socrates_case_catalog_idx on public.socrates_case_content (diagnostic_category, sort_order, case_id) where training_eligible;

-- Case fields and readiness cannot be changed independently of the revision transaction.
do $$ declare tab text; begin
  foreach tab in array array['socrates_case_content','socrates_case_legend','socrates_case_readiness'] loop
    execute format('alter table public.%I enable row level security', tab);
    execute format('revoke all on public.%I from public, anon, authenticated', tab);
    execute format('grant select on public.%I to authenticated', tab);
    execute format('grant all on public.%I to service_role', tab);
    execute format('create policy editor_read on public.%I for select to authenticated using ((select public.current_user_can_edit_socrates()))', tab);
  end loop;
end $$;

create function public.socrates_text_array_valid(value jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(value) = 'array' then jsonb_array_length(value) <= 40 and not exists (
    select 1 from jsonb_array_elements(value) e where jsonb_typeof(e) <> 'string' or length(e #>> '{}') > 8000
  ) else false end;
$$;
create function public.socrates_validate_case_v2(p jsonb) returns void
language plpgsql set search_path = '' as $$
declare c jsonb := p->'caseContent'; a jsonb := p->'authorContent'; r jsonb := a->'readiness'; v jsonb; k text; parent jsonb;
begin
  if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text) > 1048576 or p->'schemaVersion' is distinct from '2'::jsonb
    or jsonb_typeof(c) is distinct from 'object' or jsonb_typeof(a) is distinct from 'object' or jsonb_typeof(r) is distinct from 'object'
    or exists (select 1 from jsonb_object_keys(p) key where key <> all(array['schemaVersion','recordId','slug','title','workflowStatus','revision','publishedAt','slide','annotations','caseContent','authorContent'])) then
    raise exception 'Invalid version 2 case package' using errcode = '22023';
  end if;
  -- Reject unmapped nested data rather than silently discard it on a later reload.
  if jsonb_typeof(p->'slide') is distinct from 'object'
    or exists(select 1 from jsonb_object_keys(p->'slide') key where key <> all(array['id','descriptorUrl','expectedDimensions','initialImageRect','attribution','contentStatus']))
    or exists(select 1 from jsonb_object_keys(p#>'{slide,expectedDimensions}') key where key not in ('width','height'))
    or exists(select 1 from jsonb_object_keys(p#>'{slide,initialImageRect}') key where key not in ('x','y','width','height'))
    or exists(select 1 from jsonb_object_keys(p#>'{slide,attribution}') key where key not in ('label','href')) then raise exception 'Invalid slide fields'; end if;
  foreach k in array array['internalHighlightNotes','provenanceNotes'] loop
    if jsonb_typeof(a->k) is distinct from 'string' or length(a->>k)>8000 then raise exception 'Invalid author notes'; end if;
  end loop;
  if jsonb_typeof(r->'holdReason') is distinct from 'string' or length(r->>'holdReason')>8000
    or jsonb_typeof(c->'sortOrder') is distinct from 'number' or (c->>'sortOrder') !~ '^[0-9]+$' then raise exception 'Invalid case metadata'; end if;
  if exists(select 1 from jsonb_object_keys(c) key where key <> all(array['diagnosticCategory','subcategory','sortOrder','trainingEligible','testingEligible','vignette','lowMagnificationObservations','highMagnificationObservations','keyLearningPoints','adequacy','cancer','preliminaryDiagnosis','annotationLegend']))
    or exists(select 1 from jsonb_object_keys(a) key where key <> all(array['internalHighlightNotes','provenanceNotes','readiness']))
    or exists(select 1 from jsonb_object_keys(r) key where key <> all(array['contentReview','deidentificationVerified','identifiersVerified','imaging','secondaryRose','technicalHold','holdReason'])) then
    raise exception 'Unknown case content or readiness field' using errcode = '22023';
  end if;
  foreach k in array array['diagnosticCategory','subcategory','vignette'] loop
    if jsonb_typeof(c->k) is distinct from 'string' or length(c->>k) > 8000 then raise exception 'Invalid case text'; end if;
  end loop;
  foreach k in array array['trainingEligible','testingEligible'] loop
    if jsonb_typeof(c->k) is distinct from 'boolean' then raise exception 'Invalid eligibility'; end if;
  end loop;
  foreach k in array array['deidentificationVerified','identifiersVerified','technicalHold'] loop
    if jsonb_typeof(r->k) is distinct from 'boolean' then raise exception 'Invalid readiness'; end if;
  end loop;
  if not public.socrates_text_array_valid(c->'lowMagnificationObservations') or not public.socrates_text_array_valid(c->'highMagnificationObservations')
    or not public.socrates_text_array_valid(c->'keyLearningPoints') then raise exception 'Invalid case observations'; end if;
  foreach k in array array['adequacy','cancer','preliminaryDiagnosis'] loop
    v := c->k;
    if k = 'preliminaryDiagnosis' and v = 'null'::jsonb then continue; end if;
    if jsonb_typeof(v) is distinct from 'object' or jsonb_typeof(v->'designation') is distinct from 'string' or length(v->>'designation') > 300
      or jsonb_typeof(v->'reasoning') is distinct from 'string' or length(v->>'reasoning') > 8000
      or exists(select 1 from jsonb_object_keys(v) key where key not in ('designation','reasoning')) then raise exception 'Invalid interpretation'; end if;
  end loop;
  if exists(select 1 from jsonb_object_keys(c->'annotationLegend') key where key not in ('reviewed','entries'))
    or jsonb_typeof(c#>'{annotationLegend,reviewed}') is distinct from 'boolean'
    or jsonb_typeof(c#>'{annotationLegend,entries}') is distinct from 'array'
    or jsonb_array_length(c#>'{annotationLegend,entries}') > 40 then raise exception 'Invalid legend'; end if;
  for v in select value from jsonb_array_elements(c#>'{annotationLegend,entries}') loop
    if jsonb_typeof(v) is distinct from 'object' or exists(select 1 from jsonb_object_keys(v) key where key not in ('label','color','explanation'))
      or jsonb_typeof(v->'label') is distinct from 'string' or jsonb_typeof(v->'color') is distinct from 'string'
      or jsonb_typeof(v->'explanation') is distinct from 'string' then raise exception 'Invalid legend entry'; end if;
  end loop;
  if jsonb_typeof(p->'annotations') is distinct from 'array' or jsonb_array_length(p->'annotations') > 2000 then raise exception 'Invalid annotations'; end if;
  for v in select value from jsonb_array_elements(p->'annotations') loop
    if exists(select 1 from jsonb_object_keys(v) key where key <> all(array['id','parentId','label','polygon','style','enterZoomRatio','exitZoomRatio','summary','explanation','placeholderNote','sortOrder']))
      or (v ? 'explanation' and jsonb_typeof(v->'explanation') is distinct from 'string')
      or jsonb_typeof(v->'summary') is distinct from 'string' or jsonb_typeof(v->'placeholderNote') is distinct from 'string' then raise exception 'Invalid region fields'; end if;
    if jsonb_typeof(v->'polygon') is distinct from 'array' or jsonb_array_length(v->'polygon') <> 4
      or length(coalesce(v->>'explanation','')) > 8000 or length(coalesce(v->>'summary','')) > 2000 then raise exception 'Invalid region'; end if;
    if exists(select 1 from jsonb_array_elements(v->'polygon') point where jsonb_typeof(point->'x') is distinct from 'number' or jsonb_typeof(point->'y') is distinct from 'number'
      or exists(select 1 from jsonb_object_keys(point) key where key not in ('x','y'))
      or (point->>'x')::numeric < 0 or (point->>'y')::numeric < 0
      or (point->>'x')::numeric > (p#>>'{slide,expectedDimensions,width}')::numeric or (point->>'y')::numeric > (p#>>'{slide,expectedDimensions,height}')::numeric) then raise exception 'Region outside slide'; end if;
    if v->>'style' = 'detail' then
      select value into parent from jsonb_array_elements(p->'annotations') where value->>'id'=v->>'parentId' and value->>'style'='parent';
      if parent is null then raise exception 'Detail requires a parent'; end if;
      if exists(select 1 from jsonb_array_elements(v->'polygon') point where
        (point->>'x')::numeric < (select min((x->>'x')::numeric) from jsonb_array_elements(parent->'polygon') x)
        or (point->>'x')::numeric > (select max((x->>'x')::numeric) from jsonb_array_elements(parent->'polygon') x)
        or (point->>'y')::numeric < (select min((x->>'y')::numeric) from jsonb_array_elements(parent->'polygon') x)
        or (point->>'y')::numeric > (select max((x->>'y')::numeric) from jsonb_array_elements(parent->'polygon') x)) then raise exception 'Detail outside parent'; end if;
    end if;
  end loop;
end $$;

-- Keep historical implementation intact behind a non-callable helper. The v2
-- transaction reuses its geometry/revision persistence, then writes typed fields.
alter function public.save_socrates_slide_document(jsonb) rename to socrates_save_geometry_v1;
revoke all on function public.socrates_save_geometry_v1(jsonb) from public, anon, authenticated;
create function public.save_socrates_slide_document(payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not public.current_user_can_edit_socrates() then raise exception 'Editor access required' using errcode='42501'; end if;
  if payload ? 'caseContent' or payload ? 'authorContent' or payload->>'schemaVersion' = '2'
    or exists(select 1 from public.socrates_case_content where case_id = nullif(payload->>'recordId','')::uuid)
    or exists(select 1 from jsonb_array_elements(payload->'annotations') a where coalesce(a->>'explanation','') <> '')
    or payload#>>'{slide,descriptorUrl}' like '%us-central1.run.app%' then
    raise exception 'Use the version 2 case save; the legacy format cannot store this package' using errcode='22023';
  end if;
  return public.socrates_save_geometry_v1(payload);
end $$;
revoke all on function public.save_socrates_slide_document(jsonb) from public, anon;
grant execute on function public.save_socrates_slide_document(jsonb) to authenticated;

-- Anonymous overlay sharing remains v1-only. Private case packages must never
-- enter the public sandbox, including through a direct RPC call.
alter function public.save_socrates_sandbox_document(jsonb,text,uuid) rename to socrates_save_sandbox_v1;
revoke all on function public.socrates_save_sandbox_v1(jsonb,text,uuid) from public,anon,authenticated;
create function public.save_socrates_sandbox_document(payload jsonb, edit_token text, target_document_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if payload ? 'caseContent' or payload ? 'authorContent' or payload->>'schemaVersion'='2'
    or payload#>>'{slide,descriptorUrl}' like '%us-central1.run.app%'
    or exists(select 1 from jsonb_array_elements(payload->'annotations') a where coalesce(a->>'explanation','')<>'') then
    raise exception 'Use protected version 2 authoring for complete case packages';
  end if;
  return public.socrates_save_sandbox_v1(payload,edit_token,target_document_id);
end $$;
revoke all on function public.save_socrates_sandbox_document(jsonb,text,uuid) from public;
grant execute on function public.save_socrates_sandbox_document(jsonb,text,uuid) to anon,authenticated;

create function public.save_socrates_case_v2(payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare saved jsonb; cid uuid; c jsonb := payload->'caseContent'; a jsonb := payload->'authorContent'; r jsonb := a->'readiness'; current_revision integer;
begin
  if (select auth.uid()) is null or not public.current_user_can_edit_socrates() then raise exception 'Editor access required' using errcode='42501'; end if;
  perform public.socrates_validate_case_v2(payload);
  cid := nullif(payload->>'recordId','')::uuid;
  if cid is not null then
    select revision into current_revision from public.socrates_slides where id=cid for update;
    if not found or current_revision <> (payload->>'revision')::integer then raise exception 'Case changed; reload before saving' using errcode='40001'; end if;
  end if;
  saved := public.socrates_save_geometry_v1(payload);
  cid := (saved->>'recordId')::uuid;
  insert into public.socrates_case_content(case_id,diagnostic_category,subcategory,sort_order,training_eligible,testing_eligible,vignette,low_observations,high_observations,learning_points,
    adequacy_designation,adequacy_reasoning,cancer_designation,cancer_reasoning,preliminary_designation,preliminary_reasoning,legend_reviewed)
  values(cid,c->>'diagnosticCategory',c->>'subcategory',(c->>'sortOrder')::integer,(c->>'trainingEligible')::boolean,(c->>'testingEligible')::boolean,c->>'vignette',
    array(select jsonb_array_elements_text(c->'lowMagnificationObservations')),array(select jsonb_array_elements_text(c->'highMagnificationObservations')),array(select jsonb_array_elements_text(c->'keyLearningPoints')),
    c#>>'{adequacy,designation}',c#>>'{adequacy,reasoning}',c#>>'{cancer,designation}',c#>>'{cancer,reasoning}',c#>>'{preliminaryDiagnosis,designation}',c#>>'{preliminaryDiagnosis,reasoning}',(c#>>'{annotationLegend,reviewed}')::boolean)
  on conflict(case_id) do update set diagnostic_category=excluded.diagnostic_category,subcategory=excluded.subcategory,sort_order=excluded.sort_order,
    training_eligible=excluded.training_eligible,testing_eligible=excluded.testing_eligible,vignette=excluded.vignette,low_observations=excluded.low_observations,high_observations=excluded.high_observations,
    learning_points=excluded.learning_points,adequacy_designation=excluded.adequacy_designation,adequacy_reasoning=excluded.adequacy_reasoning,cancer_designation=excluded.cancer_designation,
    cancer_reasoning=excluded.cancer_reasoning,preliminary_designation=excluded.preliminary_designation,preliminary_reasoning=excluded.preliminary_reasoning,legend_reviewed=excluded.legend_reviewed;
  insert into public.socrates_case_readiness(case_id,internal_highlight_notes,provenance_notes,content_review,deidentification_verified,identifiers_verified,imaging,secondary_rose,technical_hold,hold_reason)
  values(cid,a->>'internalHighlightNotes',a->>'provenanceNotes',r->>'contentReview',(r->>'deidentificationVerified')::boolean,(r->>'identifiersVerified')::boolean,r->>'imaging',r->>'secondaryRose',(r->>'technicalHold')::boolean,r->>'holdReason')
  on conflict(case_id) do update set internal_highlight_notes=excluded.internal_highlight_notes,provenance_notes=excluded.provenance_notes,content_review=excluded.content_review,
    deidentification_verified=excluded.deidentification_verified,identifiers_verified=excluded.identifiers_verified,imaging=excluded.imaging,secondary_rose=excluded.secondary_rose,technical_hold=excluded.technical_hold,hold_reason=excluded.hold_reason;
  delete from public.socrates_case_legend where case_id=cid;
  insert into public.socrates_case_legend(case_id,position,label,color,explanation)
    select cid, ordinality-1, value->>'label',value->>'color',value->>'explanation' from jsonb_array_elements(c#>'{annotationLegend,entries}') with ordinality;
  update public.socrates_annotations annotation set explanation=coalesce(value->>'explanation','')
    from jsonb_array_elements(payload->'annotations') where annotation.slide_id=cid and annotation.id=value->>'id';
  return saved;
end $$;
revoke all on function public.save_socrates_case_v2(jsonb) from public, anon;
grant execute on function public.save_socrates_case_v2(jsonb) to authenticated;

-- A saved revision must have been ready AND the current case must still be clear.
create function public.socrates_case_ready(cid uuid, rev integer, testing boolean default true) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.socrates_case_content c join public.socrates_case_readiness r using(case_id)
    join public.socrates_revisions v on v.slide_id=c.case_id and v.revision=rev
    where c.case_id=cid and (case when testing then c.testing_eligible else c.training_eligible end)
    and r.content_review='ready' and r.deidentification_verified and r.identifiers_verified and r.imaging='ready'
    and r.secondary_rose in ('ready','not-applicable') and not r.technical_hold
    and v.snapshot#>>'{authorContent,readiness,contentReview}'='ready'
    and v.snapshot#>>'{authorContent,readiness,deidentificationVerified}'='true'
    and v.snapshot#>>'{authorContent,readiness,identifiersVerified}'='true'
    and v.snapshot#>>'{authorContent,readiness,imaging}'='ready'
    and v.snapshot#>>'{authorContent,readiness,secondaryRose}' in ('ready','not-applicable')
    and v.snapshot#>>'{authorContent,readiness,technicalHold}'='false'
    and (case when testing then v.snapshot#>>'{caseContent,testingEligible}' else v.snapshot#>>'{caseContent,trainingEligible}' end)='true'
    and (not testing or (length(trim(v.snapshot#>>'{caseContent,adequacy,designation}'))>0 and length(trim(v.snapshot#>>'{caseContent,adequacy,reasoning}'))>0
      and length(trim(v.snapshot#>>'{caseContent,cancer,designation}'))>0 and length(trim(v.snapshot#>>'{caseContent,cancer,reasoning}'))>0))
  );
$$;
revoke all on function public.socrates_case_ready(uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.socrates_case_ready(uuid,integer,boolean) to service_role;

-- The v2 public snapshot is an allowlist with opaque image references. It contains
-- no authorContent, no source key/URL, and no region placeholder notes.
create function public.socrates_public_case_snapshot(p jsonb) returns jsonb
language sql immutable set search_path='' as $$
  select jsonb_build_object('schemaVersion',2,'recordId',p->'recordId','slug',p->'slug','title',p->'title','revision',p->'revision','workflowStatus','published','publishedAt',p->'publishedAt',
    'slide',jsonb_build_object('id',p->'recordId','descriptorUrl','/api/socrates/images/training/'||(p->>'recordId')||'/'||(p->>'revision')||'/tissue/slide.dzi',
      'expectedDimensions',p#>'{slide,expectedDimensions}','initialImageRect',p#>'{slide,initialImageRect}','attribution',jsonb_build_object('label','Invenio Imaging','href','https://www.invenioimaging.com/'),
      'contentStatus','Education and research only. Not for clinical diagnosis.'),
    'caseContent',p->'caseContent',
    'annotations',coalesce((select jsonb_agg(jsonb_build_object('id',a->'id','parentId',a->'parentId','label',a->'label','polygon',a->'polygon','style',a->'style',
      'enterZoomRatio',a->'enterZoomRatio','exitZoomRatio',a->'exitZoomRatio','summary',a->'summary','explanation',a->'explanation','placeholderNote','','sortOrder',a->'sortOrder')) from jsonb_array_elements(p->'annotations') a),'[]'::jsonb));
$$;
revoke all on function public.socrates_public_case_snapshot(jsonb) from public,anon,authenticated;

alter function public.publish_socrates_slide_document(uuid) rename to socrates_publish_legacy;
revoke all on function public.socrates_publish_legacy(uuid) from public,anon,authenticated;
create function public.publish_socrates_slide_document(target_slide_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.socrates_slides%rowtype; p jsonb;
begin
  if (select auth.uid()) is null or not public.current_user_has_site_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  select * into s from public.socrates_slides where id=target_slide_id for update;
  if not found then raise exception 'Case not found'; end if;
  if not exists(select 1 from public.socrates_case_content where case_id=s.id) then return public.socrates_publish_legacy(target_slide_id); end if;
  if not public.socrates_case_ready(s.id,s.revision,false) then raise exception 'Training publication requires reviewed, de-identified, ready content and training eligibility'; end if;
  select snapshot into p from public.socrates_revisions where slide_id=s.id and revision=s.revision;
  p := p || jsonb_build_object('revision',s.revision+1,'publishedAt',now(),'workflowStatus','published');
  update public.socrates_slides set revision=s.revision+1,workflow_status='published',published_snapshot=public.socrates_public_case_snapshot(p),published_at=now(),published_by=auth.uid(),updated_by=auth.uid() where id=s.id;
  insert into public.socrates_revisions(slide_id,revision,workflow_status,snapshot,created_by) values(s.id,s.revision+1,'published',p,auth.uid());
  return p; -- Protected author response; public readers use the projected snapshot.
end $$;
revoke all on function public.publish_socrates_slide_document(uuid) from public,anon;
grant execute on function public.publish_socrates_slide_document(uuid) to authenticated;

create or replace function public.get_published_socrates_slide(requested_slug text default null) returns jsonb
language sql stable security definer set search_path='' as $$
  select s.published_snapshot from public.socrates_slides s where s.published_snapshot is not null and (requested_slug is null or s.slug=requested_slug)
    -- Upgrading an unpublished draft must not withdraw its existing v1 publication.
    and (s.published_snapshot->>'schemaVersion' is distinct from '2' or public.socrates_case_ready(s.id,(s.published_snapshot->>'revision')::integer,false))
  order by s.published_at desc nulls last, s.id limit 1;
$$;
create function public.socrates_training_catalog() returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'slug',s.published_snapshot->>'slug','title',s.published_snapshot->>'title',
    'diagnosticCategory',coalesce(nullif(s.published_snapshot#>>'{caseContent,diagnosticCategory}',''),'Uncategorized'),
    'subcategory',s.published_snapshot#>>'{caseContent,subcategory}','sortOrder',(s.published_snapshot#>>'{caseContent,sortOrder}')::integer,
    'revision',(s.published_snapshot->>'revision')::integer) order by c.diagnostic_category,c.sort_order,s.id),'[]'::jsonb)
  from public.socrates_slides s join public.socrates_case_content c on c.case_id=s.id where s.published_snapshot is not null
    and public.socrates_case_ready(s.id,(s.published_snapshot->>'revision')::integer,false);
$$;
revoke all on function public.socrates_training_catalog() from public;
grant execute on function public.socrates_training_catalog() to anon,authenticated,service_role;

create table public.socrates_studies (
  id uuid primary key default gen_random_uuid(), slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check(length(trim(title)) between 1 and 160), version text not null check(length(trim(version)) between 1 and 80),
  active boolean not null default false, activated_at timestamptz, created_at timestamptz not null default now()
);
create table public.socrates_study_rounds (
  study_id uuid not null references public.socrates_studies(id) on delete restrict,
  round_key text not null check(round_key ~ '^[a-z0-9-]{1,40}$'), title text not null,
  position integer not null check(position > 0), show_legend boolean not null default false,
  show_color_image boolean not null default false, feedback_after_submission boolean not null default false,
  survey jsonb not null check(jsonb_typeof(survey)='array' and jsonb_array_length(survey) between 3 and 5),
  primary key(study_id,round_key), unique(study_id,position)
);
create table public.socrates_study_cases (
  study_id uuid not null, round_key text not null, case_order integer not null check(case_order > 0),
  case_id uuid not null, case_revision integer not null,
  primary key(study_id,round_key,case_id), unique(study_id,round_key,case_order),
  foreign key(study_id,round_key) references public.socrates_study_rounds(study_id,round_key) on delete cascade,
  foreign key(case_id,case_revision) references public.socrates_revisions(slide_id,revision) on delete restrict
);
create index socrates_study_cases_revision_idx on public.socrates_study_cases(case_id,case_revision);
create table public.socrates_study_participants (
  study_id uuid not null references public.socrates_studies(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  active boolean not null default true, enrolled_at timestamptz not null default now(), primary key(study_id,user_id)
);
create index socrates_participants_user_idx on public.socrates_study_participants(user_id,study_id);
create table public.socrates_training_progress (
  user_id uuid not null references auth.users(id) on delete restrict,
  case_id uuid not null, case_revision integer not null,
  opened_at timestamptz not null default now(), revealed_at timestamptz, completed_at timestamptz,
  primary key(user_id,case_id,case_revision),
  foreign key(case_id,case_revision) references public.socrates_revisions(slide_id,revision) on delete restrict,
  check(revealed_at is null or revealed_at >= opened_at), check(completed_at is null or (revealed_at is not null and completed_at >= revealed_at))
);
create index socrates_training_case_idx on public.socrates_training_progress(case_id,case_revision);
create table public.socrates_test_attempts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete restrict,
  study_id uuid not null, study_version text not null, round_key text not null,
  case_id uuid not null, case_revision integer not null, case_order integer not null,
  started_at timestamptz not null default clock_timestamp(), submitted_at timestamptz,
  elapsed_ms bigint, responses jsonb not null default '{}' check(jsonb_typeof(responses)='object'),
  confidence text, response_complete boolean not null default false, missing_items text[] not null default '{}',
  unique(user_id,study_id,round_key,case_id),
  foreign key(study_id,round_key,case_id) references public.socrates_study_cases(study_id,round_key,case_id) on delete restrict,
  foreign key(study_id,user_id) references public.socrates_study_participants(study_id,user_id) on delete restrict,
  foreign key(case_id,case_revision) references public.socrates_revisions(slide_id,revision) on delete restrict,
  check((submitted_at is null and elapsed_ms is null) or (submitted_at >= started_at and elapsed_ms >= 0))
);
create index socrates_attempts_study_idx on public.socrates_test_attempts(study_id,round_key,case_id);
create index socrates_attempts_revision_idx on public.socrates_test_attempts(case_id,case_revision);

create function public.socrates_is_participant() returns boolean
language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
    and exists(select 1 from public.site_entitlements where user_id=auth.uid() and status='active'
      and entitlement in ('socrates_participant','site_admin') and (expires_at is null or expires_at > now()));
$$;
revoke all on function public.socrates_is_participant() from public,anon;
grant execute on function public.socrates_is_participant() to authenticated,service_role;

-- Administrative configuration is never readable to other participants. Session
-- rows are readable only by their owner or a site administrator. All writes go
-- through transactions; direct inserts, timestamp changes and answer edits denied.
do $$ declare tab text; begin
  foreach tab in array array['socrates_studies','socrates_study_rounds','socrates_study_cases','socrates_study_participants','socrates_training_progress','socrates_test_attempts'] loop
    execute format('alter table public.%I enable row level security', tab);
    execute format('revoke all on public.%I from public,anon,authenticated', tab);
    execute format('grant select on public.%I to authenticated', tab);
    execute format('grant all on public.%I to service_role', tab);
    execute format('create policy admin_read on public.%I for select to authenticated using ((select public.current_user_has_site_admin()))', tab);
  end loop;
end $$;
create policy own_participation on public.socrates_study_participants for select to authenticated using(user_id=(select auth.uid()) and (select public.socrates_is_participant()));
create policy own_training on public.socrates_training_progress for select to authenticated using(user_id=(select auth.uid()) and (select public.socrates_is_participant()));
create policy own_attempts on public.socrates_test_attempts for select to authenticated using(user_id=(select auth.uid()) and (select public.socrates_is_participant()));

create function public.socrates_record_training(cid uuid, rev integer, stage text) returns public.socrates_training_progress
language plpgsql security definer set search_path='' as $$
declare p public.socrates_training_progress;
begin
  if not public.socrates_is_participant() then raise exception 'Study participant access required' using errcode='42501'; end if;
  if not public.socrates_case_ready(cid,rev,false) or not exists(select 1 from public.socrates_slides where id=cid and (published_snapshot->>'revision')::integer=rev)
    then raise exception 'Training case unavailable' using errcode='42501'; end if;
  if stage not in ('opened','revealed','completed') then raise exception 'Invalid training stage'; end if;
  insert into public.socrates_training_progress(user_id,case_id,case_revision) values(auth.uid(),cid,rev) on conflict do nothing;
  select * into p from public.socrates_training_progress where user_id=auth.uid() and case_id=cid and case_revision=rev for update;
  if stage='revealed' and p.revealed_at is null then
    update public.socrates_training_progress set revealed_at=clock_timestamp() where user_id=auth.uid() and case_id=cid and case_revision=rev returning * into p;
  elsif stage='completed' then
    if p.revealed_at is null then raise exception 'Review the teaching interpretation before completing'; end if;
    update public.socrates_training_progress set completed_at=coalesce(completed_at,clock_timestamp()) where user_id=auth.uid() and case_id=cid and case_revision=rev returning * into p;
  end if;
  return p;
end $$;
revoke all on function public.socrates_record_training(uuid,integer,text) from public,anon;
grant execute on function public.socrates_record_training(uuid,integer,text) to authenticated;

create function public.socrates_save_study(config jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare sid uuid := coalesce((config->>'id')::uuid,gen_random_uuid()); r jsonb; c jsonb; item jsonb; pos integer:=0; cp integer;
  previous public.socrates_studies; activating boolean := (config->>'active')::boolean;
begin
  if (select auth.uid()) is null or not public.current_user_has_site_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  if octet_length(config::text)>262144 or jsonb_typeof(config->'rounds') is distinct from 'array' or jsonb_array_length(config->'rounds') not between 1 and 20 then raise exception 'Invalid study configuration'; end if;
  perform pg_advisory_xact_lock(hashtextextended(sid::text,0));
  select * into previous from public.socrates_studies where id=sid for update;
  if previous.activated_at is not null then raise exception 'Activated study configuration is immutable. Create a new study version.'; end if;
  insert into public.socrates_studies(id,slug,title,version,active,activated_at) values(sid,config->>'slug',config->>'title',config->>'version',activating,case when activating then now() else null end)
    on conflict(id) do update set slug=excluded.slug,title=excluded.title,version=excluded.version,active=excluded.active,activated_at=excluded.activated_at;
  delete from public.socrates_study_rounds where study_id=sid;
  for r in select value from jsonb_array_elements(config->'rounds') loop
    pos:=pos+1;
    if jsonb_typeof(r->'survey') is distinct from 'array' or jsonb_array_length(r->'survey') not between 3 and 5
      or (select count(distinct value->>'id') from jsonb_array_elements(r->'survey')) <> jsonb_array_length(r->'survey')
      or not (r->'survey' @> '[{"id":"adequacy"},{"id":"cancer"},{"id":"confidence"}]'::jsonb) then raise exception 'Configure adequacy, cancer and confidence survey items'; end if;
    for item in select value from jsonb_array_elements(r->'survey') loop
      if item->>'id' not in ('adequacy','cancer','confidence','preliminaryDiagnosis','freeText') or jsonb_typeof(item->'required') is distinct from 'boolean'
        or jsonb_typeof(item->'prompt') is distinct from 'string' or length(trim(item->>'prompt')) not between 1 and 500
        or jsonb_typeof(item->'options') is distinct from 'array' or jsonb_array_length(item->'options')>30
        or (item->>'id'<>'freeText' and jsonb_array_length(item->'options')<2)
        or exists(select 1 from jsonb_array_elements(item->'options') o where jsonb_typeof(o)<>'string' or length(trim(o#>>'{}')) not between 1 and 300)
        or (select count(distinct value) from jsonb_array_elements(item->'options'))<>jsonb_array_length(item->'options') then raise exception 'Invalid survey item'; end if;
    end loop;
    insert into public.socrates_study_rounds(study_id,round_key,title,position,show_legend,show_color_image,feedback_after_submission,survey)
      values(sid,r->>'key',r->>'title',pos,(r->>'showLegend')::boolean,(r->>'showColorImage')::boolean,(r->>'feedbackAfterSubmission')::boolean,r->'survey');
    if jsonb_typeof(r->'cases') is distinct from 'array' or jsonb_array_length(r->'cases') not between 1 and 200 then raise exception 'Configure round cases'; end if;
    cp:=0;
    for c in select value from jsonb_array_elements(r->'cases') loop
      cp:=cp+1;
      if activating and not public.socrates_case_ready((c->>'caseId')::uuid,(c->>'revision')::integer,true) then raise exception 'Testing activation blocked: case readiness requirements have not passed'; end if;
      if activating and (r->>'showLegend')::boolean and not exists(select 1 from public.socrates_revisions where slide_id=(c->>'caseId')::uuid and revision=(c->>'revision')::integer
        and snapshot#>>'{caseContent,annotationLegend,reviewed}'='true' and jsonb_array_length(snapshot#>'{caseContent,annotationLegend,entries}')>0) then raise exception 'Testing legend requires a reviewed annotation key'; end if;
      insert into public.socrates_study_cases(study_id,round_key,case_order,case_id,case_revision) values(sid,r->>'key',cp,(c->>'caseId')::uuid,(c->>'revision')::integer);
    end loop;
  end loop;
  return sid;
end $$;
revoke all on function public.socrates_save_study(jsonb) from public,anon;
grant execute on function public.socrates_save_study(jsonb) to authenticated;

create function public.socrates_set_study_active(sid uuid, enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  if (select auth.uid()) is null or not public.current_user_has_site_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  perform 1 from public.socrates_studies where id=sid and activated_at is not null for update;
  if not found then raise exception 'Activate a reviewed configuration first'; end if;
  if enabled and exists(select 1 from public.socrates_study_cases where study_id=sid and not public.socrates_case_ready(case_id,case_revision,true)) then raise exception 'A case is on hold or incomplete'; end if;
  update public.socrates_studies set active=enabled where id=sid;
end $$;
revoke all on function public.socrates_set_study_active(uuid,boolean) from public,anon;
grant execute on function public.socrates_set_study_active(uuid,boolean) to authenticated;

create function public.socrates_enroll_participant(sid uuid, participant uuid, enabled boolean default true) returns void
language plpgsql security definer set search_path='' as $$
begin
  if (select auth.uid()) is null or not public.current_user_has_site_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  if not exists(select 1 from auth.users where id=participant and email_confirmed_at is not null and not coalesce(is_anonymous,false)) then raise exception 'Use a verified, non-anonymous site account'; end if;
  -- Entitlement provisioning follows existing site administration; enrollment does
  -- not silently create global access or extend an expired entitlement.
  if enabled and not exists(select 1 from public.site_entitlements where user_id=participant and entitlement in ('socrates_participant','site_admin') and status='active'
    and (expires_at is null or expires_at>now())) then raise exception 'Assign SOCRATES participant entitlement before enrollment'; end if;
  insert into public.socrates_study_participants(study_id,user_id,active) values(sid,participant,enabled)
    on conflict(study_id,user_id) do update set active=excluded.active;
end $$;
revoke all on function public.socrates_enroll_participant(uuid,uuid,boolean) from public,anon;
grant execute on function public.socrates_enroll_participant(uuid,uuid,boolean) to authenticated;

create function public.socrates_start_attempt(sid uuid, round_id text, case_position integer) returns public.socrates_test_attempts
language plpgsql security definer set search_path='' as $$
declare c public.socrates_study_cases; s public.socrates_studies; a public.socrates_test_attempts;
begin
  if not public.socrates_is_participant() or not exists(select 1 from public.socrates_study_participants where study_id=sid and user_id=auth.uid() and active)
    then raise exception 'Study enrollment required' using errcode='42501'; end if;
  select * into s from public.socrates_studies where id=sid and active for share;
  if not found then raise exception 'Study unavailable' using errcode='42501'; end if;
  select * into c from public.socrates_study_cases where study_id=sid and round_key=round_id and case_order=case_position;
  if not found or not public.socrates_case_ready(c.case_id,c.case_revision,true) then raise exception 'Case unavailable' using errcode='42501'; end if;
  if exists(select 1 from public.socrates_study_cases prior where prior.study_id=sid and prior.round_key=round_id and prior.case_order<case_position and not exists(
    select 1 from public.socrates_test_attempts done where done.study_id=sid and done.round_key=round_id and done.case_id=prior.case_id and done.user_id=auth.uid() and done.submitted_at is not null)) then raise exception 'Complete the preceding case first'; end if;
  insert into public.socrates_test_attempts(user_id,study_id,study_version,round_key,case_id,case_revision,case_order)
    values(auth.uid(),sid,s.version,round_id,c.case_id,c.case_revision,c.case_order) on conflict(user_id,study_id,round_key,case_id) do nothing;
  select * into a from public.socrates_test_attempts where user_id=auth.uid() and study_id=sid and round_key=round_id and case_id=c.case_id;
  return a;
end $$;
revoke all on function public.socrates_start_attempt(uuid,text,integer) from public,anon;
grant execute on function public.socrates_start_attempt(uuid,text,integer) to authenticated;

create function public.socrates_submit_attempt(attempt_id uuid, answers jsonb) returns public.socrates_test_attempts
language plpgsql security definer set search_path='' as $$
declare a public.socrates_test_attempts; survey jsonb; item jsonb; value text; missing text[] := '{}'; finished timestamptz;
begin
  if not public.socrates_is_participant() then raise exception 'Study participant access required' using errcode='42501'; end if;
  select * into a from public.socrates_test_attempts where id=attempt_id and user_id=auth.uid() for update;
  if not found then raise exception 'Attempt unavailable' using errcode='42501'; end if;
  if not exists(select 1 from public.socrates_study_participants where study_id=a.study_id and user_id=auth.uid() and active) then raise exception 'Study enrollment required' using errcode='42501'; end if;
  if a.submitted_at is not null then return a; end if; -- Final, immutable, idempotent.
  if not exists(select 1 from public.socrates_studies where id=a.study_id and active) or not public.socrates_case_ready(a.case_id,a.case_revision,true)
    then raise exception 'Study or case is on hold' using errcode='42501'; end if;
  select r.survey into survey from public.socrates_study_rounds r where r.study_id=a.study_id and r.round_key=a.round_key;
  if jsonb_typeof(answers) is distinct from 'object' or octet_length(answers::text)>24000 or exists(select 1 from jsonb_object_keys(answers) k where not exists(select 1 from jsonb_array_elements(survey) q where q->>'id'=k))
    then raise exception 'Invalid survey responses'; end if;
  for item in select q from jsonb_array_elements(survey) q loop
    value := trim(answers->>(item->>'id'));
    if value is null or value='' then
      missing := array_append(missing,item->>'id');
      if (item->>'required')::boolean then raise exception 'Required survey response missing'; end if;
    elsif jsonb_typeof(answers->(item->>'id')) is distinct from 'string' or length(value)>4000
      or (item->>'id'<>'freeText' and not (item->'options' ? value)) then raise exception 'Response is not a configured option'; end if;
  end loop;
  finished:=clock_timestamp();
  update public.socrates_test_attempts set responses=answers,confidence=answers->>'confidence',submitted_at=finished,
    elapsed_ms=greatest(0,floor(extract(epoch from (finished-started_at))*1000))::bigint,response_complete=true,missing_items=missing
    where id=a.id returning * into a;
  return a;
end $$;
revoke all on function public.socrates_submit_attempt(uuid,jsonb) from public,anon;
grant execute on function public.socrates_submit_attempt(uuid,jsonb) to authenticated;

-- Prevent a direct legacy table mutation from changing private case revisions.
-- Existing editor reads remain available; all geometry writes now use checked RPCs.
revoke insert,update,delete on public.socrates_slides from authenticated;
-- Column privileges need explicit revocation as well as table privileges.
revoke insert(id,slug,title,slide_key,descriptor_url,source_width,source_height,initial_x,initial_y,initial_width,initial_height,attribution_label,attribution_url,content_status,workflow_status,revision,created_by,updated_by) on public.socrates_slides from authenticated;
revoke update(slug,title,slide_key,descriptor_url,source_width,source_height,initial_x,initial_y,initial_width,initial_height,attribution_label,attribution_url,content_status,workflow_status,revision,updated_by) on public.socrates_slides from authenticated;
revoke insert,update,delete on public.socrates_annotations from authenticated;
revoke insert on public.socrates_revisions from authenticated;
revoke all on function public.socrates_validate_case_v2(jsonb),public.socrates_text_array_valid(jsonb) from public,anon,authenticated;
notify pgrst,'reload schema';

create function public.list_socrates_author_cases() returns jsonb
language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(r.snapshot order by s.updated_at desc,s.id),'[]'::jsonb)
  from public.socrates_slides s join public.socrates_case_content c on c.case_id=s.id
  join public.socrates_revisions r on r.slide_id=s.id and r.revision=s.revision;
$$;
revoke all on function public.list_socrates_author_cases() from public,anon;
grant execute on function public.list_socrates_author_cases() to authenticated;


-- Aggregate inside PostgreSQL so directory denominators cannot be truncated by
-- the REST row cap. Only enrolled study/round labels and own completion escape.
create function public.socrates_participant_studies() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.socrates_is_participant() then raise exception 'Study participant access required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'version',s.version,'active',s.active,
    'rounds',(select coalesce(jsonb_agg(jsonb_build_object('key',r.round_key,'title',r.title,
      'total',(select count(*) from public.socrates_study_cases c where c.study_id=s.id and c.round_key=r.round_key),
      'completed',(select count(*) from public.socrates_test_attempts a where a.study_id=s.id and a.round_key=r.round_key and a.user_id=auth.uid() and a.submitted_at is not null),
      'nextOrder',1+(select count(*) from public.socrates_test_attempts a where a.study_id=s.id and a.round_key=r.round_key and a.user_id=auth.uid() and a.submitted_at is not null)
    ) order by r.position),'[]'::jsonb) from public.socrates_study_rounds r where r.study_id=s.id)
  ) order by s.id),'[]'::jsonb) into result
  from public.socrates_studies s join public.socrates_study_participants p on p.study_id=s.id where p.user_id=auth.uid() and p.active;
  return result;
end $$;
revoke all on function public.socrates_participant_studies() from public,anon;
grant execute on function public.socrates_participant_studies() to authenticated;
