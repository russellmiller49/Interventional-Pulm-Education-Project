-- Literature reviewed overlay V1 — additive forward-only schema proposal.
--
-- STATUS: PROPOSAL ONLY. This file is deliberately staged outside supabase/migrations/ and is
-- not authorized for any remote application. It is applied only to disposable rehearsal
-- databases by the reviewed-overlay operator's rehearsal harness. Applying it to the dedicated
-- project is a separate, later, owner-authorized boundary.
--
-- Everything here is additive: five nullable columns and one partial index on
-- public.literature_articles, one new operation-registry table, and two new functions. No
-- existing column, constraint, trigger, function, grant, or row is altered or dropped. The
-- existing append-only trigger on public.literature_curation_events is relied on unchanged.
--
-- Partial-schema safety: every CREATE here is bare (never CREATE OR REPLACE), and the whole
-- file is one transaction. If any owned object already exists — including a same-signature
-- function with a different definition — the CREATE fails and the transaction rolls back,
-- leaving the pre-existing object untouched. A second application therefore fails safely and
-- transactionally rather than rewriting an unknown existing object.

begin;

-- One row per overlay operation: the remote registry that makes a concurrent or repeated
-- operation detectable, exactly as literature_import_batches does for the bibliographic
-- ingest. The id is the operator's deterministic UUID, so a second fresh run of the same truth
-- collides here instead of writing beside itself. The frozen curation reason is part of the
-- registered operation identity: every event and article written under the operation must
-- carry exactly this reason, so mixed-reason batches are structurally impossible.
create table public.literature_reviewed_overlay_operations (
  id uuid primary key,
  writer_identity text not null,
  artifact_sha256 text not null,
  source_identity text not null,
  curation_reason text not null,
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
  constraint literature_reviewed_overlay_operations_curation_reason_check check (
    length(trim(curation_reason)) > 0 and length(curation_reason) <= 2000
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
-- Input discipline: every untrusted text is validated against an exact grammar before any
-- PostgreSQL cast, key sets are closed, duplicates are refused, and every rejection carries a
-- record ordinal — never a raw rejected value, never a PMID.
--
-- Per record it accepts exactly two states:
--   * the complete untouched imported state (fresh application), or
--   * the exact target reviewed state with the exact deterministic event (idempotent replay).
-- Anything else raises and rolls the whole batch back.
--
-- Once the registered operation is completed it is immutable: every later call must be an
-- exact replay — a fresh application, a foreign article, or any metadata difference fails the
-- entire call — and completion itself requires the ACTUAL article and event state (total,
-- classes, provenance, events) to equal the registered expectation exactly. Registry metadata
-- is never trusted as proof of article state.
--
-- Every request also declares its causal mode (`fresh` | `replay`), fixed by the caller
-- before the request was sent. The mode is enforced against the registered status in the same
-- transaction — a fresh request against a completed operation, or a replay request against
-- anything else, fails whole — and it is echoed in the acknowledgement so the caller can
-- refuse an answer given in the wrong causal vocabulary.
create function public.apply_literature_reviewed_overlay_batch_v1(
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
  operation_keys text[];
  record_keys text[];
  correction_keys text[];
  op_id uuid;
  op_writer text;
  op_artifact text;
  op_source text;
  op_reason text;
  op_reviewed_at_text text;
  op_reviewed_at timestamptz;
  op_record_count integer;
  op_include_core integer;
  op_include_adjacent integer;
  op_exclude integer;
  op_physician_confirmed integer;
  op_physician_modified integer;
  op_qc_accepted integer;
  op_causal_mode text;
  op_final_batch boolean;
  operation_row public.literature_reviewed_overlay_operations%rowtype;
  operation_completed boolean;
  record_count integer;
  record_value jsonb;
  record_ordinal integer := 0;
  rec_pmid text;
  rec_event_id_text text;
  rec_event_id uuid;
  rec_relevance text;
  rec_provenance text;
  rec_head_revision_text text;
  rec_head_revision integer;
  rec_note_correction jsonb;
  rec_coarse text;
  seen_pmids text[] := '{}';
  seen_event_ids uuid[] := '{}';
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
  total_confirmed integer;
  total_modified integer;
  total_qc integer;
  total_events integer;
begin
  if p_operation is null or jsonb_typeof(p_operation) <> 'object' then
    raise exception 'overlay operation must be a JSON object';
  end if;
  if p_records is null or jsonb_typeof(p_records) <> 'array' then
    raise exception 'overlay records must be a JSON array';
  end if;

  -- Closed key set before any value is inspected.
  select array_agg(key order by key)
  into operation_keys
  from jsonb_object_keys(p_operation) as key;
  if operation_keys is distinct from array[
    'artifactSha256', 'causalMode', 'curationReason', 'excludeCount', 'finalBatch',
    'includeAdjacentCount', 'includeCoreCount', 'operationId',
    'physicianConfirmedCount', 'physicianModifiedCount', 'qcAcceptedCount',
    'recordCount', 'reviewedAt', 'sourceIdentity', 'writerIdentity'
  ] then
    raise exception 'overlay operation carries missing or unexpected fields';
  end if;

  -- Grammar before every cast; no raw rejected value enters an error.
  if jsonb_typeof(p_operation -> 'operationId') <> 'string'
    or (p_operation ->> 'operationId')
      !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    raise exception 'overlay operation id is not a well-formed UUID';
  end if;
  op_id := (p_operation ->> 'operationId')::uuid;

  op_writer := p_operation ->> 'writerIdentity';
  if jsonb_typeof(p_operation -> 'writerIdentity') <> 'string'
    or op_writer !~ '^[a-z0-9][a-z0-9-]{0,99}$'
  then
    raise exception 'overlay operation writer identity is not well-formed';
  end if;

  op_artifact := p_operation ->> 'artifactSha256';
  if jsonb_typeof(p_operation -> 'artifactSha256') <> 'string'
    or op_artifact !~ '^[a-f0-9]{64}$'
  then
    raise exception 'overlay operation artifact digest is not well-formed';
  end if;

  op_source := p_operation ->> 'sourceIdentity';
  if jsonb_typeof(p_operation -> 'sourceIdentity') <> 'string'
    or length(trim(op_source)) = 0
    or length(op_source) > 200
  then
    raise exception 'overlay operation source identity is not well-formed';
  end if;

  op_reason := p_operation ->> 'curationReason';
  if jsonb_typeof(p_operation -> 'curationReason') <> 'string'
    or length(trim(op_reason)) = 0
    or length(op_reason) > 2000
  then
    raise exception 'overlay operation curation reason is missing or invalid';
  end if;

  op_reviewed_at_text := p_operation ->> 'reviewedAt';
  if jsonb_typeof(p_operation -> 'reviewedAt') <> 'string'
    or op_reviewed_at_text
      !~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:?\d{2})$'
  then
    raise exception 'overlay operation reviewed-at timestamp is not well-formed';
  end if;
  begin
    op_reviewed_at := op_reviewed_at_text::timestamptz;
  exception when others then
    raise exception 'overlay operation reviewed-at timestamp is not well-formed';
  end;

  if jsonb_typeof(p_operation -> 'recordCount') <> 'number'
    or (p_operation ->> 'recordCount') !~ '^[1-9][0-9]{0,8}$'
    or jsonb_typeof(p_operation -> 'includeCoreCount') <> 'number'
    or (p_operation ->> 'includeCoreCount') !~ '^(0|[1-9][0-9]{0,8})$'
    or jsonb_typeof(p_operation -> 'includeAdjacentCount') <> 'number'
    or (p_operation ->> 'includeAdjacentCount') !~ '^(0|[1-9][0-9]{0,8})$'
    or jsonb_typeof(p_operation -> 'excludeCount') <> 'number'
    or (p_operation ->> 'excludeCount') !~ '^(0|[1-9][0-9]{0,8})$'
    or jsonb_typeof(p_operation -> 'physicianConfirmedCount') <> 'number'
    or (p_operation ->> 'physicianConfirmedCount') !~ '^(0|[1-9][0-9]{0,8})$'
    or jsonb_typeof(p_operation -> 'physicianModifiedCount') <> 'number'
    or (p_operation ->> 'physicianModifiedCount') !~ '^(0|[1-9][0-9]{0,8})$'
    or jsonb_typeof(p_operation -> 'qcAcceptedCount') <> 'number'
    or (p_operation ->> 'qcAcceptedCount') !~ '^(0|[1-9][0-9]{0,8})$'
  then
    raise exception 'overlay operation counts are not well-formed';
  end if;
  op_record_count := (p_operation ->> 'recordCount')::integer;
  op_include_core := (p_operation ->> 'includeCoreCount')::integer;
  op_include_adjacent := (p_operation ->> 'includeAdjacentCount')::integer;
  op_exclude := (p_operation ->> 'excludeCount')::integer;
  op_physician_confirmed := (p_operation ->> 'physicianConfirmedCount')::integer;
  op_physician_modified := (p_operation ->> 'physicianModifiedCount')::integer;
  op_qc_accepted := (p_operation ->> 'qcAcceptedCount')::integer;

  -- Both partitions must sum exactly, validated here so an arithmetic-invalid envelope gets a
  -- generic refusal instead of reaching the registry insert (a table-constraint violation
  -- would echo the attempted row into the error detail).
  if op_include_core + op_include_adjacent + op_exclude <> op_record_count
    or op_physician_confirmed + op_physician_modified + op_qc_accepted <> op_record_count
  then
    raise exception 'overlay operation counts are not well-formed';
  end if;

  -- The caller's durable causal context, validated by grammar and then enforced against the
  -- registered operation's status below: a fresh-mode request cannot target a completed
  -- operation, and a replay-mode request cannot target anything else.
  op_causal_mode := p_operation ->> 'causalMode';
  if jsonb_typeof(p_operation -> 'causalMode') <> 'string'
    or op_causal_mode not in ('fresh', 'replay')
  then
    raise exception 'overlay operation causal mode is not well-formed';
  end if;

  if jsonb_typeof(p_operation -> 'finalBatch') <> 'boolean' then
    raise exception 'overlay operation final-batch flag is not well-formed';
  end if;
  op_final_batch := (p_operation ->> 'finalBatch')::boolean;

  record_count := jsonb_array_length(p_records);
  if record_count < 1 or record_count > 250 then
    raise exception 'overlay batch must contain between 1 and 250 records';
  end if;

  -- Register or authenticate the operation. A deterministic-id collision with different
  -- identity content — the frozen curation reason included — is a foreign operation and is
  -- never overwritten.
  insert into public.literature_reviewed_overlay_operations (
    id,
    writer_identity,
    artifact_sha256,
    source_identity,
    curation_reason,
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
    op_reason,
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
    or operation_row.curation_reason is distinct from op_reason
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

  operation_completed := operation_row.status = 'completed';

  -- Causal consistency, transactionally: the request's recorded mode must agree with the
  -- registered operation's status at execution time. A fresh request replayed against a
  -- completed operation (or a replay request against anything else) is refused whole, so a
  -- stale or rewritten causal context can never be silently re-acknowledged. On the fresh
  -- registration path above, a refused replay rolls the registration back with the call.
  if op_causal_mode = 'fresh' and operation_completed then
    raise exception 'overlay fresh-mode request targets a completed operation';
  end if;
  if op_causal_mode = 'replay' and not operation_completed then
    raise exception 'overlay replay-mode request targets an operation that is not completed';
  end if;

  for record_value in select value from jsonb_array_elements(p_records)
  loop
    record_ordinal := record_ordinal + 1;

    if record_value is null or jsonb_typeof(record_value) <> 'object' then
      raise exception 'overlay record % is not a JSON object', record_ordinal;
    end if;
    select array_agg(key order by key)
    into record_keys
    from jsonb_object_keys(record_value) as key;
    if record_keys is distinct from array[
      'enrichmentProvenance', 'eventId', 'noteCorrection', 'persistedHeadRevision',
      'pmid', 'reviewedRelevance'
    ] then
      raise exception 'overlay record % carries missing or unexpected fields', record_ordinal;
    end if;

    rec_pmid := record_value ->> 'pmid';
    if jsonb_typeof(record_value -> 'pmid') <> 'string'
      or rec_pmid !~ '^[0-9]{1,12}$'
    then
      raise exception 'overlay record % has an invalid PMID', record_ordinal;
    end if;
    if rec_pmid = any (seen_pmids) then
      raise exception 'overlay record % repeats a PMID within the batch', record_ordinal;
    end if;
    seen_pmids := seen_pmids || rec_pmid;

    rec_event_id_text := record_value ->> 'eventId';
    if jsonb_typeof(record_value -> 'eventId') <> 'string'
      or rec_event_id_text
        !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then
      raise exception 'overlay record % has an invalid event id', record_ordinal;
    end if;
    rec_event_id := rec_event_id_text::uuid;
    if rec_event_id = any (seen_event_ids) then
      raise exception 'overlay record % repeats an event id within the batch', record_ordinal;
    end if;
    seen_event_ids := seen_event_ids || rec_event_id;

    rec_relevance := record_value ->> 'reviewedRelevance';
    if jsonb_typeof(record_value -> 'reviewedRelevance') <> 'string'
      or rec_relevance not in ('include_core', 'include_adjacent', 'exclude')
    then
      raise exception 'overlay record % has an unknown reviewed relevance', record_ordinal;
    end if;

    rec_provenance := record_value ->> 'enrichmentProvenance';
    if jsonb_typeof(record_value -> 'enrichmentProvenance') <> 'string'
      or rec_provenance not in ('physician_confirmed', 'physician_modified', 'qc_accepted')
    then
      raise exception 'overlay record % has an unknown enrichment provenance', record_ordinal;
    end if;

    -- A null persisted head revision is the common case: most cohort items have no persisted
    -- local review row, and their truth comes exclusively from the finalized artifact.
    if jsonb_typeof(record_value -> 'persistedHeadRevision') = 'null' then
      rec_head_revision := null;
    elsif jsonb_typeof(record_value -> 'persistedHeadRevision') = 'number' then
      rec_head_revision_text := record_value ->> 'persistedHeadRevision';
      if rec_head_revision_text !~ '^[1-9][0-9]{0,3}$' then
        raise exception 'overlay record % has an invalid persisted head revision', record_ordinal;
      end if;
      rec_head_revision := rec_head_revision_text::integer;
    else
      raise exception 'overlay record % has an invalid persisted head revision', record_ordinal;
    end if;

    rec_note_correction := record_value -> 'noteCorrection';
    if jsonb_typeof(rec_note_correction) = 'null' then
      rec_note_correction := null;
    elsif jsonb_typeof(rec_note_correction) = 'object' then
      select array_agg(key order by key)
      into correction_keys
      from jsonb_object_keys(rec_note_correction) as key;
      if correction_keys is distinct from array[
        'authorizationSha256', 'rationaleSha256', 'ruleVersion'
      ] then
        raise exception 'overlay record % has an invalid note correction', record_ordinal;
      end if;
      if jsonb_typeof(rec_note_correction -> 'authorizationSha256') <> 'string'
        or (rec_note_correction ->> 'authorizationSha256') !~ '^[a-f0-9]{64}$'
        or jsonb_typeof(rec_note_correction -> 'rationaleSha256') <> 'string'
        or (rec_note_correction ->> 'rationaleSha256') !~ '^[a-f0-9]{64}$'
        or jsonb_typeof(rec_note_correction -> 'ruleVersion') <> 'string'
        or (rec_note_correction ->> 'ruleVersion') !~ '^[a-z0-9][a-z0-9./-]{0,99}$'
      then
        raise exception 'overlay record % has an invalid note correction', record_ordinal;
      end if;
    else
      raise exception 'overlay record % has an invalid note correction', record_ordinal;
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
      -- Replay path: the article must be in the exact target state — every protected field,
      -- not only the reviewed columns — and the deterministic event must already exist with
      -- the exact payload, actor, and frozen reason. A published, landmark-flagged,
      -- classifier-touched, or reason-drifted record is drift, never a silent replay.
      if current_article.reviewed_relevance is distinct from rec_relevance
        or current_article.reviewed_enrichment_provenance is distinct from rec_provenance
        or current_article.reviewed_source_identity is distinct from op_source
        or current_article.reviewed_at is distinct from op_reviewed_at
        or current_article.relevance_state is distinct from rec_coarse
        or current_article.visibility_state is distinct from 'draft'
        or current_article.manual_override is distinct from true
        or current_article.is_landmark is distinct from false
        or current_article.curation_reason is distinct from operation_row.curation_reason
        or current_article.classifier_version is not null
        or current_article.classifier_payload is not null
      then
        raise exception
          'overlay record % has drifted from the applied state and requires reconciliation',
          record_ordinal;
      end if;

      select *
      into existing_event
      from public.literature_curation_events
      where literature_curation_events.id = rec_event_id;

      if not found
        or existing_event.pmid is distinct from rec_pmid
        or existing_event.event_type is distinct from 'relevance_changed'
        or existing_event.actor_user_id is not null
        or existing_event.actor_email is distinct from op_writer
        or existing_event.before_value is distinct from expected_before
        or existing_event.after_value is distinct from expected_after
        or existing_event.reason is distinct from operation_row.curation_reason
      then
        raise exception
          'overlay record % does not match its recorded history', record_ordinal;
      end if;

      dispositions := dispositions || to_jsonb('already_applied'::text);
      already_applied_count := already_applied_count + 1;
      continue;
    end if;

    -- A completed operation is immutable: no fresh article may enter it, whatever the caller
    -- claims. Only exact replays of already-applied records are acceptable above.
    if operation_completed then
      raise exception
        'overlay record % attempts to extend a completed operation', record_ordinal;
    end if;

    -- Fresh-application path: only the complete untouched imported state is acceptable.
    if current_article.relevance_state is distinct from 'unreviewed'
      or current_article.visibility_state is distinct from 'draft'
      or current_article.manual_override is distinct from false
      or current_article.is_landmark is distinct from false
      or current_article.curation_reason is not null
      or current_article.classifier_version is not null
      or current_article.classifier_payload is not null
      or current_article.reviewed_relevance is not null
      or current_article.reviewed_enrichment_provenance is not null
      or current_article.reviewed_source_identity is not null
      or current_article.reviewed_at is not null
      or current_article.reviewed_operation_id is not null
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
      operation_row.curation_reason
    );

    update public.literature_articles
    set
      relevance_state = rec_coarse,
      manual_override = true,
      curation_reason = operation_row.curation_reason,
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
    -- Completion is licensed by the ACTUAL article and event state, never by the registry
    -- metadata: total, every class, every provenance, and the deterministic event count must
    -- all equal the registered expectation exactly.
    select
      count(*),
      count(*) filter (where reviewed_relevance = 'include_core'),
      count(*) filter (where reviewed_relevance = 'include_adjacent'),
      count(*) filter (where reviewed_relevance = 'exclude'),
      count(*) filter (where reviewed_enrichment_provenance = 'physician_confirmed'),
      count(*) filter (where reviewed_enrichment_provenance = 'physician_modified'),
      count(*) filter (where reviewed_enrichment_provenance = 'qc_accepted')
    into
      total_reviewed, total_core, total_adjacent, total_exclude,
      total_confirmed, total_modified, total_qc
    from public.literature_articles
    where literature_articles.reviewed_operation_id = op_id;

    if total_reviewed is distinct from op_record_count
      or total_core is distinct from op_include_core
      or total_adjacent is distinct from op_include_adjacent
      or total_exclude is distinct from op_exclude
      or total_confirmed is distinct from op_physician_confirmed
      or total_modified is distinct from op_physician_modified
      or total_qc is distinct from op_qc_accepted
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
    'causalMode', op_causal_mode,
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

-- The read-only observation pathway: every precondition, reconciliation, post-mutation
-- observation, and verification read travels through this one bounded, body-based function,
-- so no PMID ever appears in a request URL and no generic table-read surface exists. Reads
-- only; service_role only; strictly validated bounded input; never a schema executor.
create function public.observe_literature_reviewed_overlay_v1(
  p_request jsonb
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  request_keys text[];
  req_operation_id uuid;
  req_pmids text[];
  req_event_ids uuid[];
  pmid_value jsonb;
  event_value jsonb;
  pmid_count integer;
  event_count integer;
  operation_json jsonb;
  totals_json jsonb;
  articles_json jsonb;
  events_json jsonb;
begin
  if p_request is null or jsonb_typeof(p_request) <> 'object' then
    raise exception 'overlay observation request must be a JSON object';
  end if;
  select array_agg(key order by key)
  into request_keys
  from jsonb_object_keys(p_request) as key;
  if request_keys is distinct from array['eventIds', 'operationId', 'pmids'] then
    raise exception 'overlay observation request carries missing or unexpected fields';
  end if;

  if jsonb_typeof(p_request -> 'operationId') <> 'string'
    or (p_request ->> 'operationId')
      !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    raise exception 'overlay observation operation id is not a well-formed UUID';
  end if;
  req_operation_id := (p_request ->> 'operationId')::uuid;

  if jsonb_typeof(p_request -> 'pmids') <> 'array' then
    raise exception 'overlay observation pmids must be a JSON array';
  end if;
  pmid_count := jsonb_array_length(p_request -> 'pmids');
  if pmid_count > 250 then
    raise exception 'overlay observation pmids exceed the bounded request size';
  end if;
  req_pmids := '{}';
  for pmid_value in select value from jsonb_array_elements(p_request -> 'pmids')
  loop
    if jsonb_typeof(pmid_value) <> 'string' or (pmid_value #>> '{}') !~ '^[0-9]{1,12}$' then
      raise exception 'overlay observation pmids are not well-formed';
    end if;
    req_pmids := req_pmids || (pmid_value #>> '{}');
  end loop;

  if jsonb_typeof(p_request -> 'eventIds') <> 'array' then
    raise exception 'overlay observation event ids must be a JSON array';
  end if;
  event_count := jsonb_array_length(p_request -> 'eventIds');
  if event_count > 250 then
    raise exception 'overlay observation event ids exceed the bounded request size';
  end if;
  req_event_ids := '{}';
  for event_value in select value from jsonb_array_elements(p_request -> 'eventIds')
  loop
    if jsonb_typeof(event_value) <> 'string'
      or (event_value #>> '{}')
        !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then
      raise exception 'overlay observation event ids are not well-formed';
    end if;
    req_event_ids := req_event_ids || (event_value #>> '{}')::uuid;
  end loop;

  select jsonb_build_object(
    'id', operation_registry.id,
    'writer_identity', operation_registry.writer_identity,
    'artifact_sha256', operation_registry.artifact_sha256,
    'source_identity', operation_registry.source_identity,
    'curation_reason', operation_registry.curation_reason,
    'reviewed_at', operation_registry.reviewed_at,
    'record_count', operation_registry.record_count,
    'include_core_count', operation_registry.include_core_count,
    'include_adjacent_count', operation_registry.include_adjacent_count,
    'exclude_count', operation_registry.exclude_count,
    'physician_confirmed_count', operation_registry.physician_confirmed_count,
    'physician_modified_count', operation_registry.physician_modified_count,
    'qc_accepted_count', operation_registry.qc_accepted_count,
    'status', operation_registry.status,
    'started_at', operation_registry.started_at,
    'completed_at', operation_registry.completed_at
  )
  into operation_json
  from public.literature_reviewed_overlay_operations as operation_registry
  where operation_registry.id = req_operation_id;
  if not found then
    operation_json := null;
  end if;

  select jsonb_build_object(
    'corpusArticles', (select count(*) from public.literature_articles),
    'reviewedForOperation', (
      select count(*) from public.literature_articles
      where reviewed_operation_id = req_operation_id
    ),
    'includeCore', (
      select count(*) from public.literature_articles
      where reviewed_operation_id = req_operation_id
        and reviewed_relevance = 'include_core'
    ),
    'includeAdjacent', (
      select count(*) from public.literature_articles
      where reviewed_operation_id = req_operation_id
        and reviewed_relevance = 'include_adjacent'
    ),
    'exclude', (
      select count(*) from public.literature_articles
      where reviewed_operation_id = req_operation_id
        and reviewed_relevance = 'exclude'
    ),
    'physicianConfirmed', (
      select count(*) from public.literature_articles
      where reviewed_operation_id = req_operation_id
        and reviewed_enrichment_provenance = 'physician_confirmed'
    ),
    'physicianModified', (
      select count(*) from public.literature_articles
      where reviewed_operation_id = req_operation_id
        and reviewed_enrichment_provenance = 'physician_modified'
    ),
    'qcAccepted', (
      select count(*) from public.literature_articles
      where reviewed_operation_id = req_operation_id
        and reviewed_enrichment_provenance = 'qc_accepted'
    ),
    'eventsForOperation', (
      select count(*) from public.literature_curation_events
      where event_type = 'relevance_changed'
        and after_value ->> 'reviewed_operation_id' = req_operation_id::text
    ),
    'foreignReviewed', (
      select count(*) from public.literature_articles
      where reviewed_operation_id is not null
        and reviewed_operation_id <> req_operation_id
    )
  )
  into totals_json;

  select coalesce(jsonb_agg(jsonb_build_object(
    'pmid', article.pmid,
    'relevance_state', article.relevance_state,
    'visibility_state', article.visibility_state,
    'manual_override', article.manual_override,
    'is_landmark', article.is_landmark,
    'curation_reason', article.curation_reason,
    'classifier_version_is_null', article.classifier_version is null,
    'classifier_payload_is_null', article.classifier_payload is null,
    'reviewed_relevance', article.reviewed_relevance,
    'reviewed_enrichment_provenance', article.reviewed_enrichment_provenance,
    'reviewed_source_identity', article.reviewed_source_identity,
    'reviewed_at', article.reviewed_at,
    'reviewed_operation_id', article.reviewed_operation_id
  ) order by article.pmid), '[]'::jsonb)
  into articles_json
  from public.literature_articles as article
  where article.pmid = any (req_pmids);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', overlay_event.id,
    'pmid', overlay_event.pmid,
    'event_type', overlay_event.event_type,
    'actor_user_id', overlay_event.actor_user_id,
    'actor_email', overlay_event.actor_email,
    'reason', overlay_event.reason,
    'before_value', overlay_event.before_value,
    'after_value', overlay_event.after_value
  ) order by overlay_event.id), '[]'::jsonb)
  into events_json
  from public.literature_curation_events as overlay_event
  where overlay_event.id = any (req_event_ids);

  return jsonb_build_object(
    'operation', operation_json,
    'totals', totals_json,
    'articles', articles_json,
    'events', events_json
  );
end;
$$;

revoke all on function public.observe_literature_reviewed_overlay_v1(jsonb)
  from public, anon, authenticated;
grant execute on function public.observe_literature_reviewed_overlay_v1(jsonb)
  to service_role;

commit;
