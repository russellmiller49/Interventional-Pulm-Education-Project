-- Forward-only extension. Module metadata only; no clinical cases or memberships are seeded.
alter table public.socrates_case_content add column learner_narrative text
  check (learner_narrative is null or length(learner_narrative) between 1 and 32000);
alter table public.socrates_case_readiness add column curriculum_source jsonb
  check (curriculum_source is null or jsonb_typeof(curriculum_source) = 'object');

create function public.socrates_narrative_classification(n text, label text) returns jsonb
language plpgsql immutable set search_path='' as $$
declare line text; active boolean := false; sections integer := 0; vals text[] := '{}'; value text; stop integer;
begin
  foreach line in array string_to_array(replace(n,E'\r\n',E'\n'),E'\n') loop
    if line in ('What to notice','Key learning point','Expected study classification','Common pitfall') then
      active := line = 'Expected study classification';
      if active then sections := sections+1; end if;
    elsif active and left(line,length(label)+2) = label||': ' then
      vals := array_append(vals,substring(line from length(label)+3));
    end if;
  end loop;
  if sections <> 1 or cardinality(vals) <> 1 then return '{"designation":"","reasoning":""}'::jsonb; end if;
  value := vals[1]; stop := strpos(value,'. ');
  if stop < 2 then return '{"designation":"","reasoning":""}'::jsonb; end if;
  return jsonb_build_object('designation',left(value,stop-1),'reasoning',substring(value from stop+2));
end $$;
create function public.socrates_narrative_teaching(n text) returns jsonb
language sql immutable set search_path='' as $$
  select jsonb_build_object('lowMagnificationObservations','[]'::jsonb,'highMagnificationObservations','[]'::jsonb,
    'keyLearningPoints','[]'::jsonb,'preliminaryDiagnosis',null,
    'adequacy',public.socrates_narrative_classification(n,'Adequacy'),
    'cancer',public.socrates_narrative_classification(n,'Cancer vs non-cancer'));
$$;

alter function public.socrates_validate_case_v2(jsonb) rename to socrates_validate_case_v2_base;
create function public.socrates_validate_case_v2(p jsonb) returns void
language plpgsql set search_path='' as $$
declare c jsonb := p->'caseContent'; source jsonb := p#>'{authorContent,curriculumSource}';
  vals jsonb; derived jsonb; k text; e jsonb;
begin
  perform public.socrates_validate_case_v2_base(p #- '{caseContent,learnerNarrative}' #- '{authorContent,curriculumSource}');
  if c ? 'learnerNarrative' then
    if jsonb_typeof(c->'learnerNarrative') is distinct from 'string' or length(c->>'learnerNarrative') not between 1 and 32000 then
      raise exception 'Invalid learner narrative' using errcode='22023';
    end if;
    derived := public.socrates_narrative_teaching(c->>'learnerNarrative');
    for k in select jsonb_object_keys(derived) loop
      if c->k is distinct from derived->k then raise exception 'Narrative conflicts with structured teaching: %',k using errcode='22023'; end if;
    end loop;
  end if;
  if source is not null then
    if jsonb_typeof(source) is distinct from 'object'
      or exists(select 1 from jsonb_object_keys(source) key where key not in ('workbookSha256','sourceSheet','sourceRow','sourceValues'))
      or coalesce(source->>'workbookSha256','') !~ '^[a-f0-9]{64}$'
      or source->>'sourceSheet' is distinct from 'Curriculum Sequence'
      or jsonb_typeof(source->'sourceRow') is distinct from 'number'
      or (source->>'sourceRow') !~ '^[0-9]+$' or (source->>'sourceRow')::integer not between 2 and 1000
      or jsonb_typeof(source->'sourceValues') is distinct from 'object' then raise exception 'Invalid curriculum source'; end if;
    vals := source->'sourceValues';
    if (select count(*) from jsonb_object_keys(vals)) <> 8 or exists(select 1 from jsonb_object_keys(vals) key where key not in
      ('Overall Order','Module','Order in Module','Full Case Name','Curriculum Role','Teaching Objective / Why Here','Full Learner-Facing Text','Internal Note · Not Learner-Facing')) then
      raise exception 'Unmapped curriculum source cell';
    end if;
    foreach k in array array['Overall Order','Order in Module'] loop
      if jsonb_typeof(vals->k) is distinct from 'number' or vals->>k !~ '^[0-9]+$' or (vals->>k)::integer<1 then raise exception 'Invalid source order'; end if;
    end loop;
    foreach k in array array['Module','Full Case Name','Full Learner-Facing Text'] loop
      if jsonb_typeof(vals->k) is distinct from 'string' or length(vals->>k) not between 1 and
        (case k when 'Module' then 200 when 'Full Case Name' then 1000 else 32000 end) then raise exception 'Invalid source text'; end if;
    end loop;
    foreach k in array array['Curriculum Role','Teaching Objective / Why Here','Internal Note · Not Learner-Facing'] loop
      if vals->k is distinct from 'null'::jsonb and (jsonb_typeof(vals->k) is distinct from 'string' or length(vals->>k)>8000) then raise exception 'Invalid private source text'; end if;
    end loop;
  end if;
  if c#>>'{annotationLegend,reviewed}'='true' then
    if jsonb_array_length(c#>'{annotationLegend,entries}')=0 then raise exception 'Reviewed key is empty'; end if;
    for e in select value from jsonb_array_elements(c#>'{annotationLegend,entries}') loop
      if trim(e->>'label')='' or lower(trim(e->>'label'))='pending label' or trim(e->>'explanation')=''
        or e->>'color' !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Reviewed key requires actual provider labels, colors and meanings'; end if;
    end loop;
  end if;
end $$;
revoke all on function public.socrates_narrative_classification(text,text),public.socrates_narrative_teaching(text),
  public.socrates_validate_case_v2(jsonb),public.socrates_validate_case_v2_base(jsonb) from public,anon,authenticated;

alter function public.save_socrates_case_v2(jsonb) rename to socrates_save_case_v2_base;
revoke all on function public.socrates_save_case_v2_base(jsonb) from public,anon,authenticated;
create function public.save_socrates_case_v2(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare saved jsonb; previous jsonb; cid uuid := nullif(payload->>'recordId','')::uuid;
begin
  if auth.uid() is null or not public.current_user_can_edit_socrates() then raise exception 'Editor access required' using errcode='42501'; end if;
  if payload->>'workflowStatus' not in ('draft','review') then raise exception 'Save as draft or review first'; end if;
  perform public.socrates_validate_case_v2(payload);
  if cid is not null then
    perform 1 from public.socrates_slides where id=cid for update;
    select r.snapshot into previous from public.socrates_slides s join public.socrates_revisions r
      on r.slide_id=s.id and r.revision=s.revision where s.id=cid;
    if previous is not null and
      jsonb_build_array(previous->'title',previous->'slide',previous->'annotations',previous->'caseContent') is distinct from
      jsonb_build_array(payload->'title',payload->'slide',payload->'annotations',payload->'caseContent') then
      payload := jsonb_set(payload,'{authorContent,readiness,contentReview}','"incomplete"');
    end if;
    if previous is not null and previous#>'{caseContent,annotationLegend,entries}' is distinct from payload#>'{caseContent,annotationLegend,entries}' then
      payload := jsonb_set(payload,'{caseContent,annotationLegend,reviewed}','false');
    end if;
  end if;
  -- The existing function locks and compares the expected case revision, saves
  -- geometry, and stores the complete immutable snapshot in this transaction.
  saved := public.socrates_save_case_v2_base(payload);
  cid := (saved->>'recordId')::uuid;
  update public.socrates_case_content set learner_narrative=payload#>>'{caseContent,learnerNarrative}' where case_id=cid;
  update public.socrates_case_readiness set curriculum_source=payload#>'{authorContent,curriculumSource}' where case_id=cid;
  return saved;
end $$;
revoke all on function public.save_socrates_case_v2(jsonb) from public,anon;
grant execute on function public.save_socrates_case_v2(jsonb) to authenticated;

-- The public entry point only needs catalog metadata and a neutral viewer.
-- Answers (including narratives, legends and region explanations) use the
-- authenticated post-reveal path; existing v1 publications keep their contract.
create or replace function public.socrates_public_case_snapshot(p jsonb) returns jsonb
language sql immutable set search_path='' as $$
  select jsonb_build_object('schemaVersion',2,'recordId',p->'recordId','slug',p->'slug','title',p->'title','revision',p->'revision',
    'workflowStatus','published','publishedAt',p->'publishedAt',
    'slide',jsonb_build_object('id',p->'recordId','descriptorUrl','/api/socrates/images/training/'||(p->>'recordId')||'/'||(p->>'revision')||'/tissue/slide.dzi',
      'expectedDimensions',p#>'{slide,expectedDimensions}','initialImageRect',p#>'{slide,initialImageRect}',
      'attribution',jsonb_build_object('label','Invenio Imaging','href','https://www.invenioimaging.com/'),
      'contentStatus','Education and research only. Not for clinical diagnosis.'),
    'caseContent',jsonb_build_object('diagnosticCategory',p#>'{caseContent,diagnosticCategory}',
      'subcategory',p#>'{caseContent,subcategory}','sortOrder',p#>'{caseContent,sortOrder}'),'annotations','[]'::jsonb);
$$;
create or replace function public.get_published_socrates_slide(requested_slug text default null) returns jsonb
language sql stable security definer set search_path='' as $$
  select case when s.published_snapshot->>'schemaVersion'='2' then public.socrates_public_case_snapshot(s.published_snapshot)
    else s.published_snapshot end
  from public.socrates_slides s where s.published_snapshot is not null and (requested_slug is null or s.slug=requested_slug)
    and (s.published_snapshot->>'schemaVersion' is distinct from '2' or public.socrates_case_ready(s.id,(s.published_snapshot->>'revision')::integer,false))
  order by s.published_at desc nulls last,s.id limit 1;
$$;

create table public.socrates_curriculum_modules (
  id text primary key check(id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check(length(title) between 1 and 200),
  purpose text not null check(length(purpose) between 1 and 4000),
  display_order integer not null unique check(display_order>0),
  recommended_start boolean not null default false,
  level text not null check(level in ('Core','Deep dive','Advanced')),
  planned_count integer not null check(planned_count between 1 and 1000),
  revision integer not null default 0 check(revision>=0)
);
create unique index socrates_one_recommended_start on public.socrates_curriculum_modules(recommended_start) where recommended_start;
create table public.socrates_curriculum_memberships (
  module_id text not null references public.socrates_curriculum_modules(id),
  case_id uuid not null references public.socrates_slides(id),
  position integer not null check(position>0),
  source_order integer not null check(source_order>0),
  source_key text not null check(length(source_key) between 1 and 160),
  release_state text not null default 'pending' check(release_state in ('pending','held','approved')),
  decision_note text not null default '' check(length(decision_note)<=4000),
  primary key(module_id,case_id),
  unique(module_id,position) deferrable initially deferred,
  unique(module_id,source_key) deferrable initially deferred
);
do $$ declare tab text; begin
  foreach tab in array array['socrates_curriculum_modules','socrates_curriculum_memberships'] loop
    execute format('alter table public.%I enable row level security',tab);
    execute format('revoke all on public.%I from public,anon,authenticated',tab);
    execute format('grant select on public.%I to authenticated',tab);
    execute format('grant all on public.%I to service_role',tab);
    execute format('create policy editor_read on public.%I for select to authenticated using ((select public.current_user_can_edit_socrates()))',tab);
  end loop;
end $$;

insert into public.socrates_curriculum_modules(id,title,purpose,display_order,recommended_start,level,planned_count) values
('core-srh-orientation','CORE SRH ORIENTATION','Build a practical framework for identifying non-lesional versus lesional tissue, deciding adequacy, and distinguishing cancer from diagnostic non-cancer processes while exposing learners to representative normal, non-diagnostic, granulomatous, inflammatory, and malignant patterns.',1,true,'Core',20),
('non-diagnostic-adequacy','NON-DIAGNOSTIC & ADEQUACY','Reinforce major non-diagnostic patterns and operational adequacy decisions after the core framework is established.',2,false,'Deep dive',5),
('normal-lung-airway','NORMAL LUNG & AIRWAY','Expand the normal SRH vocabulary and teach benign orientation, folding, collapse, and airway-wall variants that can mimic abnormal tissue.',3,false,'Deep dive',8),
('cancer','CANCER','Expand cancer recognition across high-grade carcinoma, squamous and adenocarcinoma patterns, focal and metastatic disease, mixed differentiation, and lymphoma reinforcement.',4,false,'Deep dive',14),
('inflammation-infection-granuloma','INFLAMMATION & INFECTION & GRANULOMA','Deepen benign lesional and inflammatory recognition, including macrophage-rich processes, acute infection, and progressively less classic granulomas.',5,false,'Deep dive',6),
('advanced-cases','ADVANCED CASES','Apply the established framework to distorted, subtle, crushed, spindle-cell, and overlapping malignant/benign patterns.',6,false,'Advanced',6);

create function public.socrates_curriculum_catalog() returns jsonb
language sql stable security definer set search_path='' as $$
  with available as (select value as c from jsonb_array_elements(public.socrates_training_catalog()))
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'title',m.title,'purpose',m.purpose,'displayOrder',m.display_order,
    'recommendedStart',m.recommended_start,'level',m.level,'plannedCount',m.planned_count,
    'cases',coalesce((select jsonb_agg(a.c||jsonb_build_object('position',memb.position) order by memb.position,a.c->>'id')
      from public.socrates_curriculum_memberships memb join available a on a.c->>'id'=memb.case_id::text
      where memb.module_id=m.id and memb.release_state='approved'),'[]'::jsonb))
    order by m.display_order,m.id),'[]'::jsonb) from public.socrates_curriculum_modules m;
$$;
revoke all on function public.socrates_curriculum_catalog() from public;
grant execute on function public.socrates_curriculum_catalog() to anon,authenticated,service_role;

-- Only this checked helper changes memberships. It cannot change cases or studies.
create function public.socrates_change_memberships(payload jsonb, allow_approval boolean) returns integer
language plpgsql security definer set search_path='' as $$
declare m public.socrates_curriculum_modules%rowtype; e jsonb; changed boolean := false;
  previous public.socrates_curriculum_memberships%rowtype;
begin
  if auth.uid() is null or not public.current_user_can_edit_socrates()
    or (allow_approval and not public.current_user_has_site_admin()) then raise exception 'Curriculum author access required' using errcode='42501'; end if;
  if jsonb_typeof(payload) is distinct from 'object' or exists(select 1 from jsonb_object_keys(payload) key where key not in ('moduleId','expectedRevision','memberships'))
    or jsonb_typeof(payload->'expectedRevision') is distinct from 'number'
    or payload->>'expectedRevision' !~ '^[0-9]+$'
    or jsonb_typeof(payload->'memberships') is distinct from 'array' or jsonb_array_length(payload->'memberships')>1000 then raise exception 'Invalid membership plan'; end if;
  select * into m from public.socrates_curriculum_modules where id=payload->>'moduleId' for update;
  if not found then raise exception 'Unknown curriculum module'; end if;
  if m.revision <> (payload->>'expectedRevision')::integer then raise exception 'Curriculum changed; rebuild plan' using errcode='40001'; end if;
  if (select count(distinct value->>'caseId') from jsonb_array_elements(payload->'memberships')) <> jsonb_array_length(payload->'memberships') then raise exception 'Duplicate membership target'; end if;
  for e in select value from jsonb_array_elements(payload->'memberships') loop
    if jsonb_typeof(e) is distinct from 'object' or exists(select 1 from jsonb_object_keys(e) key where key not in ('caseId','position','sourceOrder','sourceKey','state','decision'))
      or jsonb_typeof(e->'caseId') is distinct from 'string'
      or jsonb_typeof(e->'position') is distinct from 'number' or e->>'position' !~ '^[0-9]+$'
      or (e->>'position')::integer not between 1 and m.planned_count
      or jsonb_typeof(e->'sourceOrder') is distinct from 'number' or e->>'sourceOrder' !~ '^[0-9]+$'
      or (e->>'sourceOrder')::integer<1 or jsonb_typeof(e->'sourceKey') is distinct from 'string'
      or length(e->>'sourceKey') not between 1 and 160
      or coalesce(e->>'state','') not in ('pending','held','approved')
      or jsonb_typeof(e->'decision') is distinct from 'string' or length(e->>'decision')>4000 then raise exception 'Invalid membership'; end if;
    if e->>'state'='approved' and (not allow_approval or trim(e->>'decision')='') then raise exception 'Membership release requires an administrator decision'; end if;
    select * into previous from public.socrates_curriculum_memberships where module_id=m.id and case_id=(e->>'caseId')::uuid;
    if found and previous.release_state='held' and e->>'state'<>'held' and (not allow_approval or trim(e->>'decision')='') then raise exception 'Held membership needs an administrator decision'; end if;
    if not found or jsonb_build_array(previous.position,previous.source_order,previous.source_key,previous.release_state,previous.decision_note)
      is distinct from jsonb_build_array((e->>'position')::integer,(e->>'sourceOrder')::integer,e->>'sourceKey',e->>'state',e->>'decision') then
      -- A bulk import may not revoke, re-hold or rewrite an administrator's release decision.
      if found and previous.release_state='approved' and not allow_approval then raise exception 'Changing an approved membership requires an administrator decision'; end if;
      insert into public.socrates_curriculum_memberships(module_id,case_id,position,source_order,source_key,release_state,decision_note)
        values(m.id,(e->>'caseId')::uuid,(e->>'position')::integer,(e->>'sourceOrder')::integer,e->>'sourceKey',e->>'state',e->>'decision')
        on conflict(module_id,case_id) do update set position=excluded.position,source_order=excluded.source_order,source_key=excluded.source_key,
          release_state=excluded.release_state,decision_note=excluded.decision_note;
      changed := true;
    end if;
  end loop;
  if changed then update public.socrates_curriculum_modules set revision=revision+1 where id=m.id returning revision into m.revision; end if;
  return m.revision;
end $$;
revoke all on function public.socrates_change_memberships(jsonb,boolean) from public,anon,authenticated;
create function public.save_socrates_curriculum_memberships(payload jsonb) returns integer
language sql security invoker set search_path='' as $$ select public.socrates_change_memberships(payload,true); $$;
-- The wrapper must be privileged to reach the non-callable helper, whose own
-- verified editor/admin checks remain authoritative.
alter function public.save_socrates_curriculum_memberships(jsonb) security definer;
revoke all on function public.save_socrates_curriculum_memberships(jsonb) from public,anon;
grant execute on function public.save_socrates_curriculum_memberships(jsonb) to authenticated;

notify pgrst,'reload schema';
