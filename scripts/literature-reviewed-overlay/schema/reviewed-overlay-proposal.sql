-- Literature reviewed overlay V1 — additive forward-only schema proposal.
--
-- STATUS: PROPOSAL ONLY. This file is deliberately staged outside supabase/migrations/ and is
-- not authorized for any remote application. It is applied only to disposable rehearsal
-- databases by the reviewed-overlay operator's rehearsal harness. Applying it to the dedicated
-- project is a separate, later, owner-authorized boundary.
--
-- Everything here is additive: five nullable columns and one partial index on
-- public.literature_articles, one new operation-registry table, and one new RPC. No existing
-- column, constraint, trigger, function, grant, or row is altered or dropped. The existing
-- append-only trigger on public.literature_curation_events is relied on unchanged.

begin;

-- One row per overlay operation: the remote registry that makes a concurrent or repeated
-- operation detectable, exactly as literature_import_batches does for the bibliographic ingest.
-- The id is the operator's deterministic UUID, so a second fresh run of the same truth collides
-- here instead of writing beside itself.
create table public.literature_reviewed_overlay_operations (
  id uuid primary key,
  writer_identity text not null,
  artifact_sha256 text not null,
  source_identity text not null,
  reviewed_at timestamptz not null,
  record_count integer not null,
  include_core_count integer not null,
  include_adjacent_count integer not null,
  exclude_count integer not null,
  physician_confirmed_count integer not null,
  physician_modified_count integer not null,
  qc_accepted_count integer not null,
  status text not null default 'started',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint literature_reviewed_overlay_operations_writer_check check (
    length(trim(writer_identity)) > 0 and length(writer_identity) <= 100
  ),
  constraint literature_reviewed_overlay_operations_artifact_check check (
    artifact_sha256 ~ '^[a-f0-9]{64}$'
  ),
  constraint literature_reviewed_overlay_operations_source_identity_check check (
    length(trim(source_identity)) > 0 and length(source_identity) <= 200
  ),
  constraint literature_reviewed_overlay_operations_status_check check (
    status in ('started', 'completed')
  ),
  constraint literature_reviewed_overlay_operations_counts_check check (
    record_count > 0
    and include_core_count >= 0
    and include_adjacent_count >= 0
    and exclude_count >= 0
    and physician_confirmed_count >= 0
    and physician_modified_count >= 0
    and qc_accepted_count >= 0
    and include_core_count + include_adjacent_count + exclude_count = record_count
    and physician_confirmed_count + physician_modified_count + qc_accepted_count = record_count
  ),
  constraint literature_reviewed_overlay_operations_completed_check check (
    (status = 'completed') = (completed_at is not null)
  )
);

alter table public.literature_reviewed_overlay_operations enable row level security;
revoke all on table public.literature_reviewed_overlay_operations
  from public, anon, authenticated;
grant all on table public.literature_reviewed_overlay_operations to service_role;

-- The five reviewed-overlay columns. Nullable and paired: an article is physician-reviewed
-- exactly when all five are set. The coarse relevance_state remains the working state machine;
-- the fine physician class survives beside it instead of being collapsed into it.
alter table public.literature_articles
  add column reviewed_relevance text,
  add column reviewed_enrichment_provenance text,
  add column reviewed_source_identity text,
  add column reviewed_at timestamptz,
  add column reviewed_operation_id uuid
    references public.literature_reviewed_overlay_operations (id);

alter table public.literature_articles
  add constraint literature_articles_reviewed_relevance_check check (
    reviewed_relevance is null
    or reviewed_relevance in ('include_core', 'include_adjacent', 'exclude')
  ),
  add constraint literature_articles_reviewed_provenance_check check (
    reviewed_enrichment_provenance is null
    or reviewed_enrichment_provenance in (
      'physician_confirmed',
      'physician_modified',
      'qc_accepted'
    )
  ),
  add constraint literature_articles_reviewed_source_identity_check check (
    reviewed_source_identity is null
    or (
      length(trim(reviewed_source_identity)) > 0
      and length(reviewed_source_identity) <= 200
    )
  ),
  add constraint literature_articles_reviewed_pairing_check check (
    (
      reviewed_relevance is null
      and reviewed_enrichment_provenance is null
      and reviewed_source_identity is null
      and reviewed_at is null
      and reviewed_operation_id is null
    )
    or (
      reviewed_relevance is not null
      and reviewed_enrichment_provenance is not null
      and reviewed_source_identity is not null
      and reviewed_at is not null
      and reviewed_operation_id is not null
    )
  );

create index literature_articles_reviewed_relevance_idx
  on public.literature_articles (reviewed_relevance)
  where reviewed_relevance is not null;

-- The one reviewed pathway: bounded, transactional per call, append-only history with
-- caller-supplied deterministic event ids, and exact per-record acknowledgement.
--
-- Per record it accepts exactly two states:
--   * the untouched imported state (fresh application), or
--   * the exact target reviewed state with the deterministic event already present
--     (idempotent replay, disposition already_applied).
-- Anything else raises and rolls the whole batch back. Exception messages carry record
-- ordinals, never PMIDs.
create or replace function public.apply_literature_reviewed_overlay_batch_v1(
  p_operation jsonb,
  p_records jsonb
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, public
as $$
declare
  op_id uuid;
  op_writer text;
  op_artifact text;
  op_source text;
  op_reviewed_at timestamptz;
  op_record_count integer;
  op_include_core integer;
  op_include_adjacent integer;
  op_exclude integer;
  op_physician_confirmed integer;
  op_physician_modified integer;
  op_qc_accepted integer;
  op_final_batch boolean;
  operation_row public.literature_reviewed_overlay_operations%rowtype;
  record_count integer;
  record_value jsonb;
  record_ordinal integer := 0;
  rec_pmid text;
  rec_event_id uuid;
  rec_relevance text;
  rec_provenance text;
  rec_head_revision integer;
  rec_note_correction jsonb;
  rec_coarse text;
  current_article public.literature_articles%rowtype;
  expected_before jsonb;
  expected_after jsonb;
  existing_event public.literature_curation_events%rowtype;
  dispositions jsonb := '[]'::jsonb;
  applied_count integer := 0;
  already_applied_count integer := 0;
  total_reviewed integer;
  total_core integer;
  total_adjacent integer;
  total_exclude integer;
  total_events integer;
begin
  if p_operation is null or jsonb_typeof(p_operation) <> 'object' then
    raise exception 'overlay operation must be a JSON object';
  end if;
  if p_records is null or jsonb_typeof(p_records) <> 'array' then
    raise exception 'overlay records must be a JSON array';
  end if;

  op_id := (p_operation ->> 'operationId')::uuid;
  op_writer := p_operation ->> 'writerIdentity';
  op_artifact := p_operation ->> 'artifactSha256';
  op_source := p_operation ->> 'sourceIdentity';
  op_reviewed_at := (p_operation ->> 'reviewedAt')::timestamptz;
  op_record_count := (p_operation ->> 'recordCount')::integer;
  op_include_core := (p_operation ->> 'includeCoreCount')::integer;
  op_include_adjacent := (p_operation ->> 'includeAdjacentCount')::integer;
  op_exclude := (p_operation ->> 'excludeCount')::integer;
  op_physician_confirmed := (p_operation ->> 'physicianConfirmedCount')::integer;
  op_physician_modified := (p_operation ->> 'physicianModifiedCount')::integer;
  op_qc_accepted := (p_operation ->> 'qcAcceptedCount')::integer;
  op_final_batch := (p_operation ->> 'finalBatch')::boolean;

  if op_id is null
    or op_writer is null
    or op_artifact is null
    or op_source is null
    or op_reviewed_at is null
    or op_record_count is null
    or op_include_core is null
    or op_include_adjacent is null
    or op_exclude is null
    or op_physician_confirmed is null
    or op_physician_modified is null
    or op_qc_accepted is null
    or op_final_batch is null
  then
    raise exception 'overlay operation is missing a required field';
  end if;

  if p_operation ->> 'curationReason' is null
    or length(trim(p_operation ->> 'curationReason')) = 0
    or length(p_operation ->> 'curationReason') > 2000
  then
    raise exception 'overlay operation curation reason is missing or invalid';
  end if;

  record_count := jsonb_array_length(p_records);
  if record_count < 1 or record_count > 250 then
    raise exception 'overlay batch must contain between 1 and 250 records';
  end if;

  -- Register or authenticate the operation. A deterministic-id collision with different
  -- identity content is a foreign operation and is never overwritten.
  insert into public.literature_reviewed_overlay_operations (
    id,
    writer_identity,
    artifact_sha256,
    source_identity,
    reviewed_at,
    record_count,
    include_core_count,
    include_adjacent_count,
    exclude_count,
    physician_confirmed_count,
    physician_modified_count,
    qc_accepted_count
  )
  values (
    op_id,
    op_writer,
    op_artifact,
    op_source,
    op_reviewed_at,
    op_record_count,
    op_include_core,
    op_include_adjacent,
    op_exclude,
    op_physician_confirmed,
    op_physician_modified,
    op_qc_accepted
  )
  on conflict (id) do nothing;

  select *
  into operation_row
  from public.literature_reviewed_overlay_operations
  where literature_reviewed_overlay_operations.id = op_id
  for update;

  if operation_row.writer_identity is distinct from op_writer
    or operation_row.artifact_sha256 is distinct from op_artifact
    or operation_row.source_identity is distinct from op_source
    or operation_row.reviewed_at is distinct from op_reviewed_at
    or operation_row.record_count is distinct from op_record_count
    or operation_row.include_core_count is distinct from op_include_core
    or operation_row.include_adjacent_count is distinct from op_include_adjacent
    or operation_row.exclude_count is distinct from op_exclude
    or operation_row.physician_confirmed_count is distinct from op_physician_confirmed
    or operation_row.physician_modified_count is distinct from op_physician_modified
    or operation_row.qc_accepted_count is distinct from op_qc_accepted
  then
    raise exception 'overlay operation identity does not match the registered operation';
  end if;

  for record_value in select value from jsonb_array_elements(p_records)
  loop
    record_ordinal := record_ordinal + 1;

    rec_pmid := record_value ->> 'pmid';
    rec_event_id := (record_value ->> 'eventId')::uuid;
    rec_relevance := record_value ->> 'reviewedRelevance';
    rec_provenance := record_value ->> 'enrichmentProvenance';
    rec_head_revision := (record_value ->> 'persistedHeadRevision')::integer;
    rec_note_correction := record_value -> 'noteCorrection';

    if rec_pmid is null or rec_pmid !~ '^[0-9]{1,12}$' then
      raise exception 'overlay record % has an invalid PMID', record_ordinal;
    end if;
    if rec_event_id is null then
      raise exception 'overlay record % has an invalid event id', record_ordinal;
    end if;
    if rec_relevance is null
      or rec_relevance not in ('include_core', 'include_adjacent', 'exclude')
    then
      raise exception 'overlay record % has an unknown reviewed relevance', record_ordinal;
    end if;
    if rec_provenance is null
      or rec_provenance not in ('physician_confirmed', 'physician_modified', 'qc_accepted')
    then
      raise exception 'overlay record % has an unknown enrichment provenance', record_ordinal;
    end if;
    -- A null persisted head revision is the common case: most cohort items have no persisted
    -- local review row, and their truth comes exclusively from the finalized artifact.
    if rec_head_revision is not null and rec_head_revision < 1 then
      raise exception 'overlay record % has an invalid persisted head revision', record_ordinal;
    end if;
    if rec_note_correction is not null
      and jsonb_typeof(rec_note_correction) not in ('object', 'null')
    then
      raise exception 'overlay record % has an invalid note correction', record_ordinal;
    end if;
    if jsonb_typeof(rec_note_correction) = 'null' then
      rec_note_correction := null;
    end if;

    rec_coarse := case when rec_relevance = 'exclude' then 'excluded' else 'included' end;

    expected_before := jsonb_build_object(
      'relevance_state', 'unreviewed',
      'reviewed_relevance', null
    );
    expected_after := jsonb_build_object(
      'relevance_state', rec_coarse,
      'reviewed_relevance', rec_relevance,
      'reviewed_enrichment_provenance', rec_provenance,
      'reviewed_source_identity', op_source,
      'reviewed_operation_id', op_id,
      'persisted_head_revision', rec_head_revision,
      'note_correction', rec_note_correction
    );

    select *
    into current_article
    from public.literature_articles
    where literature_articles.pmid = rec_pmid
    for update;

    if not found then
      raise exception 'overlay record % names an article absent from the corpus', record_ordinal;
    end if;

    if current_article.reviewed_operation_id = op_id then
      -- Replay path: the article must be in the exact target state and the deterministic
      -- event must already exist with the exact payload.
      if current_article.reviewed_relevance is distinct from rec_relevance
        or current_article.reviewed_enrichment_provenance is distinct from rec_provenance
        or current_article.reviewed_source_identity is distinct from op_source
        or current_article.reviewed_at is distinct from op_reviewed_at
        or current_article.relevance_state is distinct from rec_coarse
        or current_article.manual_override is distinct from true
      then
        raise exception
          'overlay record % is partially applied and requires reconciliation', record_ordinal;
      end if;

      select *
      into existing_event
      from public.literature_curation_events
      where literature_curation_events.id = rec_event_id;

      if not found
        or existing_event.pmid is distinct from rec_pmid
        or existing_event.event_type is distinct from 'relevance_changed'
        or existing_event.actor_email is distinct from op_writer
        or existing_event.before_value is distinct from expected_before
        or existing_event.after_value is distinct from expected_after
        or existing_event.reason is distinct from (p_operation ->> 'curationReason')
      then
        raise exception
          'overlay record % does not match its recorded history', record_ordinal;
      end if;

      dispositions := dispositions || to_jsonb('already_applied'::text);
      already_applied_count := already_applied_count + 1;
      continue;
    end if;

    -- Fresh-application path: only the untouched imported state is acceptable.
    if current_article.relevance_state is distinct from 'unreviewed'
      or current_article.visibility_state is distinct from 'draft'
      or current_article.reviewed_relevance is not null
      or current_article.reviewed_operation_id is not null
      or current_article.manual_override is distinct from false
      or current_article.is_landmark is distinct from false
      or current_article.classifier_version is not null
      or current_article.classifier_payload is not null
    then
      raise exception
        'overlay record % is not in the untouched imported state', record_ordinal;
    end if;

    if exists (
      select 1
      from public.literature_curation_events
      where literature_curation_events.id = rec_event_id
    ) then
      raise exception
        'overlay record % collides with an existing curation event', record_ordinal;
    end if;

    insert into public.literature_curation_events (
      id,
      pmid,
      actor_user_id,
      actor_email,
      event_type,
      before_value,
      after_value,
      reason
    )
    values (
      rec_event_id,
      rec_pmid,
      null,
      op_writer,
      'relevance_changed',
      expected_before,
      expected_after,
      p_operation ->> 'curationReason'
    );

    update public.literature_articles
    set
      relevance_state = rec_coarse,
      manual_override = true,
      curation_reason = p_operation ->> 'curationReason',
      reviewed_relevance = rec_relevance,
      reviewed_enrichment_provenance = rec_provenance,
      reviewed_source_identity = op_source,
      reviewed_at = op_reviewed_at,
      reviewed_operation_id = op_id
    where literature_articles.pmid = rec_pmid;

    dispositions := dispositions || to_jsonb('applied'::text);
    applied_count := applied_count + 1;
  end loop;

  if op_final_batch then
    select
      count(*),
      count(*) filter (where reviewed_relevance = 'include_core'),
      count(*) filter (where reviewed_relevance = 'include_adjacent'),
      count(*) filter (where reviewed_relevance = 'exclude')
    into total_reviewed, total_core, total_adjacent, total_exclude
    from public.literature_articles
    where literature_articles.reviewed_operation_id = op_id;

    if total_reviewed is distinct from op_record_count
      or total_core is distinct from op_include_core
      or total_adjacent is distinct from op_include_adjacent
      or total_exclude is distinct from op_exclude
    then
      raise exception 'overlay finalization totals do not match the registered operation';
    end if;

    select count(*)
    into total_events
    from public.literature_curation_events
    where literature_curation_events.actor_email = op_writer
      and literature_curation_events.event_type = 'relevance_changed'
      and literature_curation_events.after_value ->> 'reviewed_operation_id' = op_id::text;

    if total_events is distinct from op_record_count then
      raise exception 'overlay finalization history does not match the registered operation';
    end if;

    if operation_row.status = 'started' then
      update public.literature_reviewed_overlay_operations
      set status = 'completed', completed_at = now()
      where literature_reviewed_overlay_operations.id = op_id;
    end if;
  end if;

  return jsonb_build_object(
    'operationId', op_id,
    'recordCount', record_count,
    'applied', applied_count,
    'alreadyApplied', already_applied_count,
    'dispositions', dispositions,
    'operationStatus', case
      when op_final_batch then 'completed'
      else operation_row.status
    end
  );
end;
$$;

revoke all on function public.apply_literature_reviewed_overlay_batch_v1(jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_literature_reviewed_overlay_batch_v1(jsonb, jsonb)
  to service_role;

commit;
