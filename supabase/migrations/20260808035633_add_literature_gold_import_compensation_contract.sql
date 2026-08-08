-- Gold-set import and compensation contract.
--
-- Reviews and events remain append-only.  A failed operation records a durable
-- failed journal entry but leaves no review or item-pointer mutation.  A
-- successful compensation appends a new chain head; it never rewinds a
-- current_review_id and never edits an earlier review.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.literature_gold_canonical_json_v1(p_value jsonb)
returns text
language plpgsql
immutable
strict
security invoker
set search_path = pg_catalog, public
as $$
declare
  value_type text := jsonb_typeof(p_value);
  result text;
begin
  if value_type in ('null', 'boolean', 'number', 'string') then
    return p_value::text;
  end if;

  if value_type = 'array' then
    select '[' || coalesce(
      string_agg(public.literature_gold_canonical_json_v1(element.value), ',' order by element.ordinality),
      ''
    ) || ']'
    into result
    from jsonb_array_elements(p_value) with ordinality as element(value, ordinality);
    return result;
  end if;

  if value_type = 'object' then
    select '{' || coalesce(
      string_agg(
        to_jsonb(member.key)::text || ':' ||
          public.literature_gold_canonical_json_v1(member.value),
        ',' order by member.key collate "C"
      ),
      ''
    ) || '}'
    into result
    from jsonb_each(p_value) as member(key, value);
    return result;
  end if;

  raise exception using
    errcode = 'P7600',
    message = 'unsupported JSON value in canonical gold-set checksum';
end;
$$;

create or replace function public.literature_gold_jsonb_sha256_v1(p_value jsonb)
returns text
language sql
immutable
strict
security invoker
set search_path = pg_catalog, public, extensions
as $$
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(public.literature_gold_canonical_json_v1(p_value), 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$$;

revoke all on function public.literature_gold_canonical_json_v1(jsonb)
  from public, anon, authenticated;
revoke all on function public.literature_gold_jsonb_sha256_v1(jsonb)
  from public, anon, authenticated;
grant execute on function public.literature_gold_canonical_json_v1(jsonb)
  to service_role;
grant execute on function public.literature_gold_jsonb_sha256_v1(jsonb)
  to service_role;

alter table public.literature_gold_set_reviews
  add column revision_kind text not null default 'standard',
  add column lifecycle_state text not null default 'effective',
  add column operation_action_id uuid,
  add column compensates_review_id uuid,
  add column effective_source_review_id uuid,
  add column technology_tag_status text,
  add column disease_tag_status text,
  add column taxonomy_version text,
  add column label_schema_version text,
  add column enrichment_schema_version text,
  add column enrichment_provenance text,
  add constraint literature_gold_set_reviews_revision_kind_check check (
    revision_kind in ('standard', 'import', 'compensation')
  ),
  add constraint literature_gold_set_reviews_lifecycle_state_check check (
    lifecycle_state in ('effective', 'withdrawn')
  ),
  add constraint literature_gold_set_reviews_enrichment_status_check check (
    (technology_tag_status is null or technology_tag_status in (
      'tagged', 'not_applicable', 'not_assessable'
    ))
    and (disease_tag_status is null or disease_tag_status in (
      'tagged', 'not_applicable', 'not_assessable'
    ))
    and (technology_tag_status is null
      or (cardinality(technology_tags) > 0) = (technology_tag_status = 'tagged'))
    and (disease_tag_status is null
      or (cardinality(disease_tags) > 0) = (disease_tag_status = 'tagged'))
  ),
  add constraint literature_gold_set_reviews_enrichment_versions_check check (
    (revision_kind = 'import' and technology_tag_status is not null
      and disease_tag_status is not null and taxonomy_version is not null
      and label_schema_version is not null and enrichment_schema_version is not null
      and enrichment_provenance is not null)
    or revision_kind <> 'import'
  ),
  add constraint literature_gold_set_reviews_revision_contract_check check (
    (
      revision_kind = 'standard'
      and lifecycle_state = 'effective'
      and operation_action_id is null
      and compensates_review_id is null
      and effective_source_review_id is null
    )
    or (
      revision_kind = 'import'
      and lifecycle_state = 'effective'
      and operation_action_id is not null
      and compensates_review_id is null
      and effective_source_review_id is null
    )
    or (
      revision_kind = 'compensation'
      and operation_action_id is not null
      and compensates_review_id is not null
      and (
        (lifecycle_state = 'effective' and effective_source_review_id is not null)
        or (lifecycle_state = 'withdrawn' and effective_source_review_id is null)
      )
    )
  );

comment on column public.literature_gold_set_reviews.revision_kind is
  'standard is an ordinary reviewer save, import is a checksum-authorized import node, and compensation is an append-only restoring or voiding node.';
comment on column public.literature_gold_set_reviews.lifecycle_state is
  'effective means this head supplies an effective review; withdrawn means the chain has a physical head but no effective completed review.';
comment on column public.literature_gold_set_reviews.effective_source_review_id is
  'For compensation restores, identifies the earlier effective payload copied into this node. NULL on ordinary effective nodes means this node owns its payload; NULL on withdrawn nodes means no effective review.';

create table public.literature_gold_review_operations (
  id uuid primary key,
  batch_id uuid not null references public.literature_gold_set_batches(id) on delete restrict,
  dataset_split text not null default 'development',
  operation_kind text not null,
  target_import_operation_id uuid references public.literature_gold_review_operations(id) on delete restrict,
  idempotency_key text not null,
  status text not null default 'started',
  artifact_sha256 text not null,
  plan_sha256 text not null,
  plan jsonb not null,
  authorization_sha256 text not null,
  authorization_payload jsonb not null,
  actor_user_id uuid,
  actor_email text,
  planned_action_count integer not null,
  planned_apply_count integer not null,
  planned_noop_count integer not null,
  applied_action_count integer not null default 0,
  noop_action_count integer not null default 0,
  pre_physical_state_sha256 text not null,
  post_physical_state_sha256 text,
  pre_effective_state_sha256 text not null,
  post_effective_state_sha256 text,
  error_sqlstate text,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint literature_gold_review_operations_split_check check (
    dataset_split = 'development'
  ),
  constraint literature_gold_review_operations_kind_check check (
    operation_kind in ('import', 'compensation')
  ),
  constraint literature_gold_review_operations_target_check check (
    (operation_kind = 'import' and target_import_operation_id is null)
    or (operation_kind = 'compensation' and target_import_operation_id is not null)
  ),
  constraint literature_gold_review_operations_key_check check (
    length(trim(idempotency_key)) between 8 and 200
  ),
  constraint literature_gold_review_operations_status_check check (
    status in ('started', 'completed', 'failed')
  ),
  constraint literature_gold_review_operations_sha_check check (
    artifact_sha256 ~ '^[a-f0-9]{64}$'
    and plan_sha256 ~ '^[a-f0-9]{64}$'
    and authorization_sha256 ~ '^[a-f0-9]{64}$'
    and pre_physical_state_sha256 ~ '^[a-f0-9]{64}$'
    and (post_physical_state_sha256 is null or post_physical_state_sha256 ~ '^[a-f0-9]{64}$')
    and pre_effective_state_sha256 ~ '^[a-f0-9]{64}$'
    and (post_effective_state_sha256 is null or post_effective_state_sha256 ~ '^[a-f0-9]{64}$')
  ),
  constraint literature_gold_review_operations_json_check check (
    jsonb_typeof(plan) = 'object'
    and jsonb_typeof(authorization_payload) = 'object'
  ),
  constraint literature_gold_review_operations_actor_check check (
    actor_user_id is not null
    or (actor_email is not null and length(trim(actor_email)) > 0)
  ),
  constraint literature_gold_review_operations_counts_check check (
    planned_action_count > 0
    and planned_apply_count >= 0
    and planned_noop_count >= 0
    and planned_apply_count + planned_noop_count = planned_action_count
    and applied_action_count between 0 and planned_apply_count
    and noop_action_count between 0 and planned_noop_count
  ),
  constraint literature_gold_review_operations_terminal_check check (
    (
      status = 'started'
      and completed_at is null
      and error_sqlstate is null
      and error_message is null
    )
    or (
      status = 'completed'
      and completed_at is not null
      and applied_action_count = planned_apply_count
      and noop_action_count = planned_noop_count
      and error_sqlstate is null
      and error_message is null
    )
    or (
      status = 'failed'
      and completed_at is not null
      and applied_action_count = 0
      and noop_action_count = 0
      and error_sqlstate ~ '^[0-9A-Z]{5}$'
      and length(error_message) between 1 and 4000
    )
  ),
  unique (operation_kind, idempotency_key)
);

create table public.literature_gold_review_operation_actions (
  id uuid primary key,
  operation_id uuid not null references public.literature_gold_review_operations(id) on delete restrict,
  action_sequence integer not null,
  item_id uuid not null references public.literature_gold_set_items(id) on delete restrict,
  pmid text not null,
  action_kind text not null,
  action_status text not null default 'planned',
  source_operation_action_id uuid references public.literature_gold_review_operation_actions(id) on delete restrict,
  planned_review_id uuid,
  result_review_id uuid,
  pre_current_review_id uuid,
  pre_effective_review_id uuid,
  expected_revision integer,
  expected_supersedes_review_id uuid,
  planned_state jsonb not null,
  result_state jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint literature_gold_review_operation_actions_sequence_check check (
    action_sequence > 0
  ),
  constraint literature_gold_review_operation_actions_kind_check check (
    action_kind in (
      'import_initial',
      'import_revision',
      'import_noop',
      'compensate_restore',
      'compensate_void',
      'compensate_noop'
    )
  ),
  constraint literature_gold_review_operation_actions_status_check check (
    action_status in ('planned', 'applied', 'noop', 'failed')
  ),
  constraint literature_gold_review_operation_actions_shape_check check (
    (
      action_kind in ('import_initial', 'import_revision')
      and source_operation_action_id is null
      and planned_review_id is not null
      and expected_revision is not null
    )
    or (
      action_kind = 'import_noop'
      and source_operation_action_id is null
      and planned_review_id is null
      and expected_revision is null
      and expected_supersedes_review_id is null
    )
    or (
      action_kind in ('compensate_restore', 'compensate_void')
      and source_operation_action_id is not null
      and planned_review_id is not null
      and expected_revision is not null
      and expected_supersedes_review_id is not null
    )
    or (
      action_kind = 'compensate_noop'
      and source_operation_action_id is not null
      and planned_review_id is null
      and expected_revision is null
      and expected_supersedes_review_id is null
    )
  ),
  constraint literature_gold_review_operation_actions_result_check check (
    (action_status = 'planned' and result_review_id is null and result_state is null and processed_at is null)
    or (action_status = 'applied' and result_review_id is not null and result_state is not null and processed_at is not null)
    or (action_status = 'noop' and result_review_id is null and result_state is not null and processed_at is not null)
    or (action_status = 'failed' and result_review_id is null and result_state is not null and processed_at is not null)
  ),
  constraint literature_gold_review_operation_actions_pmid_check check (
    pmid ~ '^[0-9]{1,12}$'
  ),
  constraint literature_gold_review_operation_actions_state_check check (
    jsonb_typeof(planned_state) = 'object'
    and (result_state is null or jsonb_typeof(result_state) = 'object')
  ),
  unique (operation_id, action_sequence),
  unique (operation_id, item_id),
  unique (id, operation_id),
  unique (id, item_id),
  unique (id, operation_id, item_id)
);

create index literature_gold_review_operations_batch_started_idx
  on public.literature_gold_review_operations (batch_id, started_at desc);
create unique index literature_gold_review_operations_one_live_compensation_idx
  on public.literature_gold_review_operations (target_import_operation_id)
  where operation_kind = 'compensation' and status in ('started', 'completed');
create index literature_gold_review_operation_actions_item_idx
  on public.literature_gold_review_operation_actions (item_id, created_at desc);
create index literature_gold_review_operation_actions_source_idx
  on public.literature_gold_review_operation_actions (source_operation_action_id)
  where source_operation_action_id is not null;

alter table public.literature_gold_set_reviews
  add constraint literature_gold_set_reviews_operation_action_fk
    foreign key (operation_action_id, item_id)
    references public.literature_gold_review_operation_actions(id, item_id)
    on delete restrict,
  add constraint literature_gold_set_reviews_compensates_fk
    foreign key (compensates_review_id, item_id)
    references public.literature_gold_set_reviews(id, item_id)
    on delete restrict,
  add constraint literature_gold_set_reviews_effective_source_fk
    foreign key (effective_source_review_id, item_id)
    references public.literature_gold_set_reviews(id, item_id)
    on delete restrict;

do $migration$
begin
  if exists (
    select 1
    from public.literature_gold_set_reviews as child
    join public.literature_gold_set_reviews as parent
      on parent.id = child.supersedes_review_id
     and parent.item_id = child.item_id
    where child.revision <> parent.revision + 1
  ) or exists (
    select 1
    from public.literature_gold_set_reviews as review
    where (review.revision = 1) is distinct from (review.supersedes_review_id is null)
  ) then
    raise exception using
      errcode = 'P7501',
      message = 'existing literature gold review chains are not linear and adjacent';
  end if;
end;
$migration$;

do $migration$
begin
  if exists (
    select 1
    from public.literature_gold_set_items as item
    left join lateral (
      select review.id
      from public.literature_gold_set_reviews as review
      where review.item_id = item.id
      order by review.revision desc
      limit 1
    ) as latest on true
    where item.current_review_id is distinct from latest.id
  ) then
    raise exception using
      errcode = 'P7502',
      message = 'existing current_review_id values do not identify the latest review-chain heads';
  end if;
end;
$migration$;

alter table public.literature_gold_review_operations enable row level security;
alter table public.literature_gold_review_operation_actions enable row level security;

revoke all on table public.literature_gold_review_operations
  from public, anon, authenticated, service_role;
revoke all on table public.literature_gold_review_operation_actions
  from public, anon, authenticated, service_role;
-- The operation journal is written only by the SECURITY DEFINER contract RPCs.
-- In particular, service_role must not be able to fabricate a sealed receipt by
-- inserting/updating journal rows directly.
grant select on table public.literature_gold_review_operations to service_role;
grant select on table public.literature_gold_review_operation_actions to service_role;

create policy literature_gold_review_operations_service_policy
  on public.literature_gold_review_operations
  for all
  to service_role
  using (dataset_split = 'development')
  with check (dataset_split = 'development');
create policy literature_gold_review_operation_actions_service_policy
  on public.literature_gold_review_operation_actions
  for all
  to service_role
  using (exists (
    select 1
    from public.literature_gold_review_operations as operation
    where operation.id = operation_id
      and operation.dataset_split = 'development'
  ))
  with check (exists (
    select 1
    from public.literature_gold_review_operations as operation
    where operation.id = operation_id
      and operation.dataset_split = 'development'
  ));

drop index public.literature_gold_set_reviews_supersedes_idx;
create unique index literature_gold_set_reviews_one_child_idx
  on public.literature_gold_set_reviews (supersedes_review_id)
  where supersedes_review_id is not null;
create unique index literature_gold_set_reviews_one_operation_action_idx
  on public.literature_gold_set_reviews (operation_action_id)
  where operation_action_id is not null;

alter table public.literature_gold_set_events
  add column operation_id uuid,
  add column operation_action_id uuid,
  add column operation_event_sequence integer,
  add constraint literature_gold_set_events_operation_fk
    foreign key (operation_id)
    references public.literature_gold_review_operations(id)
    on delete restrict,
  add constraint literature_gold_set_events_operation_action_fk
    foreign key (operation_action_id, operation_id)
    references public.literature_gold_review_operation_actions(id, operation_id)
    on delete restrict,
  add constraint literature_gold_set_events_operation_shape_check check (
    (
      operation_id is null
      and operation_action_id is null
      and operation_event_sequence is null
    )
    or (
      operation_id is not null
      and operation_event_sequence is not null
      and operation_event_sequence > 0
    )
  );

alter table public.literature_gold_set_events
  drop constraint literature_gold_set_events_type_check,
  add constraint literature_gold_set_events_type_check check (
    event_type in (
      'batch_created',
      'draft_saved',
      'review_completed',
      'review_revised',
      'returned_later',
      'review_resumed',
      'supplemental_metadata_revealed',
      'automated_signals_revealed',
      'test_split_unlocked',
      'batch_frozen',
      'import_started',
      'review_imported',
      'import_completed',
      'import_failed',
      'import_compensation_started',
      'review_compensated',
      'review_voided',
      'import_compensation_completed',
      'import_compensation_failed'
    )
  );

create unique index literature_gold_set_events_operation_sequence_idx
  on public.literature_gold_set_events (operation_id, operation_event_sequence)
  where operation_id is not null;
create index literature_gold_set_events_operation_action_idx
  on public.literature_gold_set_events (operation_action_id)
  where operation_action_id is not null;

create or replace function public.guard_literature_gold_review_operation_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using
      errcode = 'P7510',
      message = 'literature gold review operations are append-only';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'started'
      or new.applied_action_count <> 0
      or new.noop_action_count <> 0
      or new.completed_at is not null
      or new.post_physical_state_sha256 is not null
      or new.post_effective_state_sha256 is not null
      or new.error_sqlstate is not null
      or new.error_message is not null then
      raise exception using
        errcode = 'P7511',
        message = 'new literature gold review operations must begin in the unsealed started state';
    end if;
    return new;
  end if;

  if old.status = 'started' and new.status in ('completed', 'failed') then
    if (
      to_jsonb(new) - array[
        'status',
        'applied_action_count',
        'noop_action_count',
        'post_physical_state_sha256',
        'post_effective_state_sha256',
        'error_sqlstate',
        'error_message',
        'completed_at'
      ]
    ) is distinct from (
      to_jsonb(old) - array[
        'status',
        'applied_action_count',
        'noop_action_count',
        'post_physical_state_sha256',
        'post_effective_state_sha256',
        'error_sqlstate',
        'error_message',
        'completed_at'
      ]
    ) then
      raise exception using
        errcode = 'P7512',
        message = 'operation terminal transition attempted to change immutable journal fields';
    end if;
    return new;
  end if;

  -- A terminal operation may be sealed exactly once after its terminal event
  -- has been inserted.  Hash columns are excluded from their own projection.
  if old.status in ('completed', 'failed')
    and new.status = old.status
    and old.post_physical_state_sha256 is null
    and new.post_physical_state_sha256 is not null
    and new.post_effective_state_sha256 is not null
    and (
      to_jsonb(new) - array['post_physical_state_sha256', 'post_effective_state_sha256']
    ) is not distinct from (
      to_jsonb(old) - array['post_physical_state_sha256', 'post_effective_state_sha256']
    ) then
    return new;
  end if;

  raise exception using
    errcode = 'P7513',
    message = 'terminal literature gold review operation journals are immutable';
end;
$$;

create trigger guard_literature_gold_review_operations
  before insert or update or delete on public.literature_gold_review_operations
  for each row
  execute function public.guard_literature_gold_review_operation_mutation();

create or replace function public.guard_literature_gold_review_action_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using
      errcode = 'P7520',
      message = 'literature gold review operation actions are append-only';
  end if;

  if tg_op = 'INSERT' then
    if new.action_status <> 'planned'
      or new.result_review_id is not null
      or new.result_state is not null
      or new.processed_at is not null then
      raise exception using
        errcode = 'P7521',
        message = 'new literature gold review actions must begin in the planned state';
    end if;
    return new;
  end if;

  if old.action_status = 'planned'
    and new.action_status in ('applied', 'noop', 'failed')
    and (
      to_jsonb(new) - array[
        'action_status', 'result_review_id', 'result_state', 'processed_at'
      ]
    ) is not distinct from (
      to_jsonb(old) - array[
        'action_status', 'result_review_id', 'result_state', 'processed_at'
      ]
    ) then
    return new;
  end if;

  raise exception using
    errcode = 'P7522',
    message = 'terminal literature gold review action journals are immutable';
end;
$$;

create trigger guard_literature_gold_review_operation_actions
  before insert or update or delete on public.literature_gold_review_operation_actions
  for each row
  execute function public.guard_literature_gold_review_action_mutation();

create or replace function public.guard_literature_gold_review_chain_insert()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  current_head_id uuid;
  parent_revision integer;
  linked_action public.literature_gold_review_operation_actions%rowtype;
  linked_operation public.literature_gold_review_operations%rowtype;
begin
  select item.current_review_id
  into current_head_id
  from public.literature_gold_set_items as item
  where item.id = new.item_id;

  if new.revision = 1 then
    if new.supersedes_review_id is not null
      or current_head_id is not null
      or exists (
        select 1
        from public.literature_gold_set_reviews as review
        where review.item_id = new.item_id
      ) then
      raise exception using
        errcode = 'P7530',
        message = 'revision 1 must be the only root of an empty review chain';
    end if;
  else
    if new.supersedes_review_id is null
      or new.supersedes_review_id is distinct from current_head_id then
      raise exception using
        errcode = 'P7531',
        message = 'a review must supersede the current physical chain head';
    end if;

    select parent.revision
    into parent_revision
    from public.literature_gold_set_reviews as parent
    where parent.id = new.supersedes_review_id
      and parent.item_id = new.item_id;

    if not found or new.revision <> parent_revision + 1 then
      raise exception using
        errcode = 'P7532',
        message = 'a review revision must be exactly one greater than its parent';
    end if;
  end if;

  if new.revision_kind = 'standard' then
    return new;
  end if;

  select action.*
  into linked_action
  from public.literature_gold_review_operation_actions as action
  where action.id = new.operation_action_id
    and action.item_id = new.item_id;

  if not found or linked_action.action_status <> 'planned'
    or linked_action.planned_review_id is distinct from new.id
    or linked_action.expected_revision is distinct from new.revision
    or linked_action.expected_supersedes_review_id is distinct from new.supersedes_review_id then
    raise exception using
      errcode = 'P7533',
      message = 'operation review does not match its planned action identity or chain position';
  end if;

  select operation.*
  into linked_operation
  from public.literature_gold_review_operations as operation
  where operation.id = linked_action.operation_id;

  if linked_operation.status <> 'started'
    or (new.revision_kind = 'import' and linked_operation.operation_kind <> 'import')
    or (new.revision_kind = 'compensation' and linked_operation.operation_kind <> 'compensation')
    or (new.revision_kind = 'import' and linked_action.action_kind not in ('import_initial', 'import_revision'))
    or (new.revision_kind = 'compensation' and linked_action.action_kind not in ('compensate_restore', 'compensate_void')) then
    raise exception using
      errcode = 'P7534',
      message = 'operation review kind does not match an active planned operation action';
  end if;

  if new.revision_kind = 'compensation'
    and new.compensates_review_id is distinct from new.supersedes_review_id then
    raise exception using
      errcode = 'P7535',
      message = 'a compensation node must supersede the imported review it compensates';
  end if;

  if new.revision_kind = 'compensation' then
    if new.lifecycle_state = 'effective' and not exists (
      select 1
      from public.literature_gold_set_reviews as source
      where source.id = new.effective_source_review_id
        and source.item_id = new.item_id
        and row(
          source.relevance_label, source.metadata_sufficiency,
          source.reviewer_confidence, source.topic_ids, source.technology_tags,
          source.clinical_purposes, source.disease_tags, source.study_design,
          source.publication_status, source.categorization_from_full_text,
          source.notes, source.used_supplemental_metadata,
          source.review_seconds, source.is_blinded,
          source.reviewer_user_id, source.reviewer_email,
          source.technology_tag_status, source.disease_tag_status,
          source.taxonomy_version, source.label_schema_version,
          source.enrichment_schema_version, source.enrichment_provenance
        ) is not distinct from row(
          new.relevance_label, new.metadata_sufficiency,
          new.reviewer_confidence, new.topic_ids, new.technology_tags,
          new.clinical_purposes, new.disease_tags, new.study_design,
          new.publication_status, new.categorization_from_full_text,
          new.notes, new.used_supplemental_metadata,
          new.review_seconds, new.is_blinded,
          new.reviewer_user_id, new.reviewer_email,
          new.technology_tag_status, new.disease_tag_status,
          new.taxonomy_version, new.label_schema_version,
          new.enrichment_schema_version, new.enrichment_provenance
        )
    ) then
      raise exception using
        errcode = 'P7536',
        message = 'an effective compensation node must copy its prior effective source payload exactly';
    end if;
    if new.lifecycle_state = 'withdrawn' and not exists (
      select 1
      from public.literature_gold_set_reviews as imported
      where imported.id = new.compensates_review_id
        and imported.item_id = new.item_id
        and row(
          imported.relevance_label, imported.metadata_sufficiency,
          imported.reviewer_confidence, imported.topic_ids, imported.technology_tags,
          imported.clinical_purposes, imported.disease_tags, imported.study_design,
          imported.publication_status, imported.categorization_from_full_text,
          imported.notes, imported.used_supplemental_metadata,
          imported.review_seconds, imported.is_blinded,
          imported.reviewer_user_id, imported.reviewer_email,
          imported.technology_tag_status, imported.disease_tag_status,
          imported.taxonomy_version, imported.label_schema_version,
          imported.enrichment_schema_version, imported.enrichment_provenance
        ) is not distinct from row(
          new.relevance_label, new.metadata_sufficiency,
          new.reviewer_confidence, new.topic_ids, new.technology_tags,
          new.clinical_purposes, new.disease_tags, new.study_design,
          new.publication_status, new.categorization_from_full_text,
          new.notes, new.used_supplemental_metadata,
          new.review_seconds, new.is_blinded,
          new.reviewer_user_id, new.reviewer_email,
          new.technology_tag_status, new.disease_tag_status,
          new.taxonomy_version, new.label_schema_version,
          new.enrichment_schema_version, new.enrichment_provenance
        )
    ) then
      raise exception using
        errcode = 'P7537',
        message = 'a withdrawn compensation node must copy the imported payload it voids';
    end if;
  end if;

  return new;
end;
$$;

create trigger guard_literature_gold_review_chain_insert
  before insert on public.literature_gold_set_reviews
  for each row
  execute function public.guard_literature_gold_review_chain_insert();

create or replace function public.assert_literature_gold_review_chain_head_v1(p_item_id uuid)
returns void
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  selected_item public.literature_gold_set_items%rowtype;
  latest_review public.literature_gold_set_reviews%rowtype;
  review_count integer;
begin
  select *
  into selected_item
  from public.literature_gold_set_items as item
  where item.id = p_item_id;

  if not found then
    raise exception using errcode = 'P7540', message = 'gold-set item not found';
  end if;

  select count(*)::integer
  into review_count
  from public.literature_gold_set_reviews as review
  where review.item_id = p_item_id;

  if review_count = 0 then
    if selected_item.current_review_id is not null then
      raise exception using
        errcode = 'P7541',
        message = 'an empty review chain cannot have a current physical head';
    end if;
    return;
  end if;

  select *
  into latest_review
  from public.literature_gold_set_reviews as review
  where review.item_id = p_item_id
  order by review.revision desc
  limit 1;

  if selected_item.current_review_id is distinct from latest_review.id
    or exists (
      select 1
      from public.literature_gold_set_reviews as child
      where child.supersedes_review_id = latest_review.id
    ) then
    raise exception using
      errcode = 'P7542',
      message = 'current_review_id must reference the latest physical review-chain head';
  end if;

  if latest_review.lifecycle_state = 'effective'
    and selected_item.review_status = 'completed'
    and selected_item.completed_at is null then
    raise exception using
      errcode = 'P7543',
      message = 'completed item state with an effective head requires a completion timestamp';
  end if;

  if latest_review.lifecycle_state = 'withdrawn'
    and selected_item.review_status = 'completed' then
    raise exception using
      errcode = 'P7544',
      message = 'a withdrawn review head cannot expose a completed effective item state';
  end if;
end;
$$;

create or replace function public.check_literature_gold_review_chain_head()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if tg_table_name = 'literature_gold_set_items' then
    perform public.assert_literature_gold_review_chain_head_v1(new.id);
  else
    perform public.assert_literature_gold_review_chain_head_v1(new.item_id);
  end if;
  return new;
end;
$$;

create constraint trigger check_literature_gold_chain_head_after_review
  after insert on public.literature_gold_set_reviews
  deferrable initially deferred
  for each row
  execute function public.check_literature_gold_review_chain_head();
create constraint trigger check_literature_gold_chain_head_after_item
  after insert or update on public.literature_gold_set_items
  deferrable initially deferred
  for each row
  execute function public.check_literature_gold_review_chain_head();

create or replace function public.validate_literature_gold_operation_event()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  selected_operation public.literature_gold_review_operations%rowtype;
  selected_action public.literature_gold_review_operation_actions%rowtype;
begin
  if new.event_type not in (
    'import_started',
    'review_imported',
    'import_completed',
    'import_failed',
    'import_compensation_started',
    'review_compensated',
    'review_voided',
    'import_compensation_completed',
    'import_compensation_failed'
  ) then
    if new.operation_id is not null then
      raise exception using
        errcode = 'P7550',
        message = 'ordinary gold-set events cannot link to an import operation';
    end if;
    return new;
  end if;

  select * into selected_operation
  from public.literature_gold_review_operations as operation
  where operation.id = new.operation_id;

  if not found or selected_operation.batch_id is distinct from new.batch_id then
    raise exception using
      errcode = 'P7551',
      message = 'operation event must link to its gold-set batch';
  end if;

  if new.operation_action_id is null then
    if new.item_id is not null
      or new.operation_event_sequence not in (1, selected_operation.planned_action_count + 2) then
      raise exception using
        errcode = 'P7552',
        message = 'operation boundary event has invalid item or sequence linkage';
    end if;
    if new.operation_event_sequence = 1
      and new.event_type is distinct from (case selected_operation.operation_kind
        when 'import' then 'import_started'
        else 'import_compensation_started'
      end) then
      raise exception using
        errcode = 'P7552',
        message = 'operation sequence 1 must be the matching started event';
    end if;
    if new.operation_event_sequence = selected_operation.planned_action_count + 2
      and (
        (selected_operation.operation_kind = 'import'
          and new.event_type not in ('import_completed', 'import_failed'))
        or (selected_operation.operation_kind = 'compensation'
          and new.event_type not in (
            'import_compensation_completed', 'import_compensation_failed'
          ))
      ) then
      raise exception using
        errcode = 'P7552',
        message = 'operation final sequence must be its matching completed or failed event';
    end if;
  else
    select * into selected_action
    from public.literature_gold_review_operation_actions as action
    where action.id = new.operation_action_id
      and action.operation_id = new.operation_id;

    if not found
      or selected_action.item_id is distinct from new.item_id
      or new.operation_event_sequence <> selected_action.action_sequence + 1 then
      raise exception using
        errcode = 'P7553',
        message = 'operation review event must link to its exact planned action and sequence';
    end if;
    if (selected_action.action_kind in ('import_initial', 'import_revision')
        and new.event_type <> 'review_imported')
      or (selected_action.action_kind = 'compensate_restore'
        and new.event_type <> 'review_compensated')
      or (selected_action.action_kind = 'compensate_void'
        and new.event_type <> 'review_voided')
      or selected_action.action_kind in ('import_noop', 'compensate_noop') then
      raise exception using
        errcode = 'P7553',
        message = 'operation action event type does not match the exact action disposition';
    end if;
  end if;

  if (selected_operation.operation_kind = 'import') is distinct from
    (new.event_type in ('import_started', 'review_imported', 'import_completed', 'import_failed')) then
    raise exception using
      errcode = 'P7554',
      message = 'operation event type does not match its operation kind';
  end if;

  if new.event_type in ('review_imported', 'review_compensated', 'review_voided')
    and new.operation_action_id is null then
    raise exception using
      errcode = 'P7555',
      message = 'review operation events require an operation action';
  end if;

  if new.event_type not in ('review_imported', 'review_compensated', 'review_voided')
    and new.operation_action_id is not null then
    raise exception using
      errcode = 'P7556',
      message = 'operation boundary events cannot reference an action';
  end if;

  if (new.event_type in ('import_started', 'import_compensation_started',
      'review_imported', 'review_compensated', 'review_voided')
      and selected_operation.status <> 'started')
    or (new.event_type in ('import_completed', 'import_compensation_completed')
      and selected_operation.status <> 'completed')
    or (new.event_type in ('import_failed', 'import_compensation_failed')
      and selected_operation.status <> 'failed') then
    raise exception using
      errcode = 'P7557',
      message = 'operation event does not match the current operation status';
  end if;

  return new;
end;
$$;

create trigger validate_literature_gold_operation_event
  before insert on public.literature_gold_set_events
  for each row
  execute function public.validate_literature_gold_operation_event();

create or replace function public.assert_literature_gold_jsonb_object_v1(
  p_value jsonb,
  p_allowed_keys text[],
  p_required_keys text[],
  p_context text
)
returns void
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
begin
  if p_value is null or jsonb_typeof(p_value) <> 'object' then
    raise exception using
      errcode = 'P7558',
      message = format('%s must be a JSON object', p_context);
  end if;
  if exists (
    select 1
    from jsonb_object_keys(p_value) as supplied(key)
    where supplied.key <> all(p_allowed_keys)
  ) then
    raise exception using
      errcode = 'P7558',
      message = format('%s contains an unknown field', p_context);
  end if;
  if exists (
    select 1
    from unnest(p_required_keys) as required(key)
    where not (p_value ? required.key)
  ) then
    raise exception using
      errcode = 'P7558',
      message = format('%s is missing a required field', p_context);
  end if;
end;
$$;

create or replace function public.assert_literature_gold_jsonb_scalar_v1(
  p_value jsonb,
  p_key text,
  p_expected_type text,
  p_nullable boolean,
  p_context text
)
returns void
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $$
declare
  supplied jsonb;
begin
  supplied := p_value -> p_key;
  if supplied is null then
    raise exception using errcode = 'P7558', message = format('%s is missing %s', p_context, p_key);
  end if;
  if jsonb_typeof(supplied) = 'null' and p_nullable then
    return;
  end if;
  if jsonb_typeof(supplied) is distinct from p_expected_type then
    raise exception using
      errcode = 'P7558',
      message = format('%s field %s must be %s%s', p_context, p_key,
        p_expected_type, case when p_nullable then ' or null' else '' end);
  end if;
end;
$$;

create or replace function public.literature_gold_is_timestamptz_v1(p_value text)
returns boolean
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $$
begin
  if p_value is null
    or p_value !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then
    return false;
  end if;
  return pg_catalog.isfinite(p_value::timestamptz);
exception when others then
  return false;
end;
$$;

create or replace function public.literature_gold_development_membership_hash_v1(
  p_batch_id uuid
)
returns text
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, extensions
as $$
declare
  projection jsonb;
begin
  if not exists (
    select 1
    from public.literature_gold_set_batches as batch
    where batch.id = p_batch_id
  ) then
    raise exception using errcode = 'P7561', message = 'gold-set batch not found';
  end if;

  select jsonb_build_object(
    'projectionVersion', 'literature-gold-development-membership-v1',
    'datasetSplit', 'development',
    'items', coalesce(jsonb_agg(
      jsonb_build_object('itemId', item.id, 'pmid', item.pmid)
      order by item.id
    ), '[]'::jsonb)
  )
  into projection
  from public.literature_gold_set_items as item
  where item.batch_id = p_batch_id
    and item.dataset_split = 'development';

  return public.literature_gold_jsonb_sha256_v1(projection);
end;
$$;

-- Canonical clinical/effective payload shared by no-op comparison and the
-- effective-state hash.  Identity, reviewer, and timestamp metadata are
-- deliberately excluded; controlled-label arrays are sorted so semantically
-- identical rows have one cross-runtime representation.
create or replace function public.literature_gold_review_clinical_projection_v1(
  p_review_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'relevanceLabel', review.relevance_label,
    'metadataSufficiency', review.metadata_sufficiency,
    'reviewerConfidence', review.reviewer_confidence,
    'topicIds', to_jsonb(array(select value from unnest(review.topic_ids) value order by value collate "C")),
    'technologyTags', to_jsonb(array(select value from unnest(review.technology_tags) value order by value collate "C")),
    'technologyTagStatus', review.technology_tag_status,
    'clinicalPurposes', to_jsonb(array(select value from unnest(review.clinical_purposes) value order by value collate "C")),
    'diseaseTags', to_jsonb(array(select value from unnest(review.disease_tags) value order by value collate "C")),
    'diseaseTagStatus', review.disease_tag_status,
    'studyDesign', review.study_design,
    'publicationStatus', review.publication_status,
    'categorizationFromFullText', review.categorization_from_full_text,
    'notes', review.notes,
    'usedSupplementalMetadata', review.used_supplemental_metadata,
    'reviewSeconds', review.review_seconds,
    'taxonomyVersion', review.taxonomy_version,
    'labelSchemaVersion', review.label_schema_version,
    'enrichmentSchemaVersion', review.enrichment_schema_version,
    'enrichmentProvenance', review.enrichment_provenance,
    'isBlinded', review.is_blinded
  )
  from public.literature_gold_set_reviews as review
  where review.id = p_review_id;
$$;

create or replace function public.literature_gold_effective_state_hash_v1(
  p_batch_id uuid,
  p_split text default 'development'
)
returns text
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, extensions
as $$
declare
  projection jsonb;
begin
  if p_split is distinct from 'development' then
    raise exception using
      errcode = 'P7560',
      message = 'gold-set state hashes are restricted to the explicitly selected development split';
  end if;

  if not exists (
    select 1
    from public.literature_gold_set_batches as batch
    where batch.id = p_batch_id
  ) then
    raise exception using errcode = 'P7561', message = 'gold-set batch not found';
  end if;

  select jsonb_build_object(
    'projectionVersion', 'literature-gold-effective-state-v1',
    'datasetSplit', 'development',
    'items', coalesce(jsonb_agg(
      jsonb_build_object(
        'pmid', item.pmid,
        'reviewStatus', item.review_status,
        'review', case
          when head.lifecycle_state = 'withdrawn' or head.id is null then null
          else public.literature_gold_review_clinical_projection_v1(
            coalesce(head.effective_source_review_id, head.id)
          )
        end
      )
      order by item.pmid::numeric, item.id
    ), '[]'::jsonb)
  )
  into projection
  from public.literature_gold_set_items as item
  left join public.literature_gold_set_reviews as head
    on head.id = item.current_review_id
   and head.item_id = item.id
  where item.batch_id = p_batch_id
    and item.dataset_split = 'development';

  return public.literature_gold_jsonb_sha256_v1(projection);
end;
$$;

create or replace function public.literature_gold_physical_state_hash_v1(
  p_batch_id uuid,
  p_split text default 'development'
)
returns text
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, extensions
as $$
declare
  projection jsonb;
begin
  if p_split is distinct from 'development' then
    raise exception using
      errcode = 'P7560',
      message = 'gold-set state hashes are restricted to the explicitly selected development split';
  end if;

  if not exists (
    select 1
    from public.literature_gold_set_batches as batch
    where batch.id = p_batch_id
  ) then
    raise exception using errcode = 'P7561', message = 'gold-set batch not found';
  end if;

  select jsonb_build_object(
    'projectionVersion', 'literature-gold-physical-audit-state-v1',
    'datasetSplit', 'development',
    'batch', (
      select to_jsonb(batch)
      from public.literature_gold_set_batches as batch
      where batch.id = p_batch_id
    ),
    'items', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.pmid::numeric, item.id)
      from public.literature_gold_set_items as item
      where item.batch_id = p_batch_id
        and item.dataset_split = 'development'
    ), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(to_jsonb(review) order by item.pmid::numeric, review.revision, review.id)
      from public.literature_gold_set_reviews as review
      join public.literature_gold_set_items as item on item.id = review.item_id
      where item.batch_id = p_batch_id
        and item.dataset_split = 'development'
    ), '[]'::jsonb),
    'drafts', coalesce((
      select jsonb_agg(to_jsonb(draft) order by item.pmid::numeric, draft.item_id)
      from public.literature_gold_set_review_drafts as draft
      join public.literature_gold_set_items as item on item.id = draft.item_id
      where item.batch_id = p_batch_id
        and item.dataset_split = 'development'
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(to_jsonb(event) order by event.created_at, event.id)
      from public.literature_gold_set_events as event
      left join public.literature_gold_set_items as item on item.id = event.item_id
      where event.batch_id = p_batch_id
        and (event.item_id is null or item.dataset_split = 'development')
    ), '[]'::jsonb),
    'operations', coalesce((
      select jsonb_agg(
        to_jsonb(operation) - array[
          'pre_physical_state_sha256',
          'post_physical_state_sha256',
          'pre_effective_state_sha256',
          'post_effective_state_sha256'
        ]
        order by operation.started_at, operation.id
      )
      from public.literature_gold_review_operations as operation
      where operation.batch_id = p_batch_id
        and operation.dataset_split = 'development'
    ), '[]'::jsonb),
    'actions', coalesce((
      select jsonb_agg(
        to_jsonb(action)
        order by operation.started_at, operation.id, action.action_sequence
      )
      from public.literature_gold_review_operation_actions as action
      join public.literature_gold_review_operations as operation
        on operation.id = action.operation_id
      where operation.batch_id = p_batch_id
        and operation.dataset_split = 'development'
    ), '[]'::jsonb)
  )
  into projection;

  return public.literature_gold_jsonb_sha256_v1(projection);
end;
$$;

revoke all on function public.literature_gold_effective_state_hash_v1(uuid, text)
  from public, anon, authenticated;
revoke all on function public.literature_gold_physical_state_hash_v1(uuid, text)
  from public, anon, authenticated;
revoke all on function public.literature_gold_development_membership_hash_v1(uuid)
  from public, anon, authenticated;
revoke all on function public.assert_literature_gold_jsonb_object_v1(jsonb, text[], text[], text)
  from public, anon, authenticated;
revoke all on function public.assert_literature_gold_jsonb_scalar_v1(jsonb, text, text, boolean, text)
  from public, anon, authenticated;
revoke all on function public.literature_gold_is_timestamptz_v1(text)
  from public, anon, authenticated;
revoke all on function public.literature_gold_review_clinical_projection_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.literature_gold_effective_state_hash_v1(uuid, text)
  to service_role;
grant execute on function public.literature_gold_physical_state_hash_v1(uuid, text)
  to service_role;
grant execute on function public.literature_gold_development_membership_hash_v1(uuid)
  to service_role;
grant execute on function public.assert_literature_gold_jsonb_object_v1(jsonb, text[], text[], text)
  to service_role;
grant execute on function public.assert_literature_gold_jsonb_scalar_v1(jsonb, text, text, boolean, text)
  to service_role;
grant execute on function public.literature_gold_is_timestamptz_v1(text)
  to service_role;
grant execute on function public.literature_gold_review_clinical_projection_v1(uuid)
  to service_role;

create or replace function public.literature_gold_review_operation_result_v1(
  p_operation_id uuid,
  p_idempotent boolean default false
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'operationId', operation.id,
    'operationKind', operation.operation_kind,
    'targetImportOperationId', operation.target_import_operation_id,
    'status', operation.status,
    'idempotent', p_idempotent,
    'plannedActionCount', operation.planned_action_count,
    'appliedActionCount', operation.applied_action_count,
    'noopActionCount', operation.noop_action_count,
    'prePhysicalStateSha256', operation.pre_physical_state_sha256,
    'postPhysicalStateSha256', operation.post_physical_state_sha256,
    'preEffectiveStateSha256', operation.pre_effective_state_sha256,
    'postEffectiveStateSha256', operation.post_effective_state_sha256,
    'errorSqlstate', operation.error_sqlstate,
    'errorMessage', operation.error_message,
    'startedAt', operation.started_at,
    'completedAt', operation.completed_at
  ))
  from public.literature_gold_review_operations as operation
  where operation.id = p_operation_id;
$$;

revoke all on function public.literature_gold_review_operation_result_v1(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.literature_gold_review_operation_result_v1(uuid, boolean)
  to service_role;

create or replace function public.literature_gold_review_operation_receipt_v1(
  p_operation_id uuid,
  p_idempotent boolean default false
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, extensions
as $$
declare
  selected_operation public.literature_gold_review_operations%rowtype;
  receipt jsonb;
  receipt_identity jsonb;
  event_sequence jsonb;
begin
  select * into selected_operation
  from public.literature_gold_review_operations as operation
  where operation.id = p_operation_id;

  if not found then
    return null;
  end if;
  if selected_operation.status = 'started'
    or selected_operation.post_physical_state_sha256 is null
    or selected_operation.post_effective_state_sha256 is null then
    raise exception using
      errcode = 'P7640',
      message = 'a terminal sealed operation is required to produce a receipt';
  end if;

  select coalesce(
    jsonb_agg(event.event_type order by event.operation_event_sequence),
    '[]'::jsonb
  ) into event_sequence
  from public.literature_gold_set_events as event
  where event.operation_id = p_operation_id;

  receipt := jsonb_build_object(
    'contractVersion', 'gold-review-import-compensation/1.0.0',
    'kind', case selected_operation.operation_kind
      when 'import' then 'import_receipt'
      else 'compensation_receipt'
    end,
    'operationId', selected_operation.id,
    'batchId', selected_operation.batch_id,
    'planSha256', selected_operation.plan_sha256,
    'idempotencyKey', selected_operation.idempotency_key,
    'outcome', case selected_operation.status
      when 'completed' then 'committed'
      else 'failed'
    end,
    'response', case when p_idempotent then 'idempotent_replay' else 'applied' end,
    'beforePhysicalStateSha256', selected_operation.pre_physical_state_sha256,
    'afterPhysicalStateSha256', selected_operation.post_physical_state_sha256,
    'beforeEffectiveStateSha256', selected_operation.pre_effective_state_sha256,
    'afterEffectiveStateSha256', selected_operation.post_effective_state_sha256,
    'counts', jsonb_build_object(
      'planned', selected_operation.planned_apply_count,
      'applied', selected_operation.applied_action_count,
      'noops', selected_operation.noop_action_count
    ),
    'eventSequence', event_sequence,
    'error', selected_operation.error_message
  );
  if selected_operation.operation_kind = 'compensation' then
    receipt := receipt || jsonb_build_object(
      'targetImportOperationId', selected_operation.target_import_operation_id
    );
  end if;

  -- Transport response classification is not terminal evidence, so an exact
  -- replay and the original response intentionally share one receipt identity.
  receipt_identity := receipt - 'response';
  return receipt || jsonb_build_object(
    'binding', jsonb_build_object(
      'contentSha256', public.literature_gold_jsonb_sha256_v1(receipt_identity)
    )
  );
end;
$$;

revoke all on function public.literature_gold_review_operation_receipt_v1(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.literature_gold_review_operation_receipt_v1(uuid, boolean)
  to service_role;

create or replace function public.reconcile_literature_gold_review_operation_v1(
  p_operation_id uuid,
  p_recovery_authorization_sha256 text,
  p_recovery_authorization jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  selected_operation public.literature_gold_review_operations%rowtype;
  authorized_batch_id uuid;
  current_physical_hash text;
  current_effective_hash text;
begin
  if p_recovery_authorization is null
    or jsonb_typeof(p_recovery_authorization) <> 'object' then
    raise exception using errcode = 'P7641', message = 'invalid non-mutating recovery authorization';
  end if;
  perform public.assert_literature_gold_jsonb_object_v1(
    p_recovery_authorization,
    array[
      'contractVersion', 'kind', 'authorizationId', 'authorized', 'authorizedBy',
      'authorizedAt', 'authorizationNote', 'targetDatabase', 'remoteWritesAllowed',
      'repositoryCommitSha', 'migrationId', 'recoveryAction', 'batchId',
      'targetOperationId', 'targetPlanSha256', 'targetIdempotencyKey',
      'observedPhysicalStateSha256', 'observedEffectiveStateSha256',
      'permitsMutation', 'binding'
    ],
    array[
      'contractVersion', 'kind', 'authorizationId', 'authorized', 'authorizedBy',
      'authorizedAt', 'authorizationNote', 'targetDatabase', 'remoteWritesAllowed',
      'repositoryCommitSha', 'migrationId', 'recoveryAction', 'batchId',
      'targetOperationId', 'targetPlanSha256', 'targetIdempotencyKey',
      'observedPhysicalStateSha256', 'observedEffectiveStateSha256',
      'permitsMutation', 'binding'
    ],
    'recovery authorization'
  );
  perform public.assert_literature_gold_jsonb_object_v1(
    p_recovery_authorization -> 'binding',
    array['contentSha256'], array['contentSha256'], 'recovery authorization binding'
  );
  if exists (
      select 1 from unnest(array[
        'contractVersion','kind','authorizationId','authorizedBy','authorizedAt',
        'authorizationNote','targetDatabase','repositoryCommitSha','migrationId',
        'recoveryAction','batchId','targetOperationId','targetPlanSha256',
        'targetIdempotencyKey','observedPhysicalStateSha256',
        'observedEffectiveStateSha256'
      ]) field
      where jsonb_typeof(p_recovery_authorization -> field) is distinct from 'string'
    )
    or jsonb_typeof(p_recovery_authorization #> '{binding,contentSha256}') is distinct from 'string'
    or p_recovery_authorization ->> 'authorizationId'
      !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(p_recovery_authorization -> 'authorized') <> 'boolean'
    or jsonb_typeof(p_recovery_authorization -> 'authorizedBy') <> 'string'
    or length(trim(p_recovery_authorization ->> 'authorizedBy')) not between 1 and 320
    or jsonb_typeof(p_recovery_authorization -> 'authorizedAt') <> 'string'
    or not public.literature_gold_is_timestamptz_v1(p_recovery_authorization ->> 'authorizedAt')
    or jsonb_typeof(p_recovery_authorization -> 'authorizationNote') <> 'string'
    or length(trim(p_recovery_authorization ->> 'authorizationNote')) not between 5 and 2000
    or jsonb_typeof(p_recovery_authorization -> 'remoteWritesAllowed') <> 'boolean'
    or jsonb_typeof(p_recovery_authorization -> 'permitsMutation') <> 'boolean'
    or p_recovery_authorization ->> 'repositoryCommitSha' !~ '^[a-f0-9]{40}$'
    or p_recovery_authorization ->> 'batchId'
      !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or p_recovery_authorization ->> 'targetOperationId'
      !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or p_recovery_authorization ->> 'targetPlanSha256' !~ '^[a-f0-9]{64}$'
    or p_recovery_authorization ->> 'targetIdempotencyKey' !~ '^[a-f0-9]{64}$'
    or p_recovery_authorization ->> 'observedPhysicalStateSha256' !~ '^[a-f0-9]{64}$'
    or p_recovery_authorization ->> 'observedEffectiveStateSha256' !~ '^[a-f0-9]{64}$'
    or p_recovery_authorization #>> '{binding,contentSha256}' !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = 'P7641', message = 'invalid non-mutating recovery authorization field types or values';
  end if;
  if p_operation_id is null
    or p_recovery_authorization_sha256 !~ '^[a-f0-9]{64}$'
    or p_recovery_authorization is null
    or jsonb_typeof(p_recovery_authorization) <> 'object'
    or public.literature_gold_jsonb_sha256_v1(
      p_recovery_authorization - 'binding'
    ) is distinct from p_recovery_authorization_sha256
    or p_recovery_authorization #>> '{binding,contentSha256}'
      is distinct from p_recovery_authorization_sha256
    or p_recovery_authorization ->> 'contractVersion'
      is distinct from 'gold-review-import-compensation/1.0.0'
    or p_recovery_authorization ->> 'kind'
      is distinct from 'recovery_authorization'
    or p_recovery_authorization ->> 'recoveryAction' not in (
      'resolve_ambiguous_import',
      'resolve_ambiguous_compensation'
    )
    or (p_recovery_authorization ->> 'authorized')::boolean is distinct from true
    or (p_recovery_authorization ->> 'permitsMutation')::boolean is distinct from false
    or p_recovery_authorization ->> 'targetDatabase' is distinct from 'local'
    or (p_recovery_authorization ->> 'remoteWritesAllowed')::boolean
      is distinct from false
    or p_recovery_authorization ->> 'migrationId'
      is distinct from '20260808035633_add_literature_gold_import_compensation_contract'
    or p_recovery_authorization ->> 'repositoryCommitSha' !~ '^[a-f0-9]{40}$'
    or p_recovery_authorization ->> 'targetOperationId'
      is distinct from p_operation_id::text then
    raise exception using errcode = 'P7641', message = 'invalid non-mutating recovery authorization';
  end if;

  authorized_batch_id := (p_recovery_authorization ->> 'batchId')::uuid;
  current_physical_hash := public.literature_gold_physical_state_hash_v1(
    authorized_batch_id,
    'development'
  );
  current_effective_hash := public.literature_gold_effective_state_hash_v1(
    authorized_batch_id,
    'development'
  );
  if p_recovery_authorization ->> 'observedPhysicalStateSha256'
      is distinct from current_physical_hash
    or p_recovery_authorization ->> 'observedEffectiveStateSha256'
      is distinct from current_effective_hash then
    raise exception using errcode = 'P7642', message = 'recovery authorization does not match current physical/effective evidence';
  end if;

  select * into selected_operation
  from public.literature_gold_review_operations as operation
  where operation.id = p_operation_id;
  if not found then
    return jsonb_build_object(
      'operationId', p_operation_id,
      'status', 'absent',
      'physicalStateSha256', current_physical_hash,
      'effectiveStateSha256', current_effective_hash,
      'permitsMutation', false,
      'requiresFreshPlanAndAuthorization', true
    );
  end if;

  if selected_operation.batch_id is distinct from authorized_batch_id
    or selected_operation.plan_sha256 is distinct from
      p_recovery_authorization ->> 'targetPlanSha256'
    or selected_operation.idempotency_key is distinct from
      p_recovery_authorization ->> 'targetIdempotencyKey' then
    raise exception using errcode = 'P7643', message = 'recovery authorization target binding is stale or mismatched';
  end if;

  if (selected_operation.operation_kind = 'import') is distinct from
      (p_recovery_authorization ->> 'recoveryAction' = 'resolve_ambiguous_import') then
    raise exception using errcode = 'P7643', message = 'recovery action does not match the target operation kind';
  end if;

  if selected_operation.status in ('completed', 'failed') then
    return public.literature_gold_review_operation_receipt_v1(p_operation_id, true);
  end if;

  return public.literature_gold_review_operation_result_v1(p_operation_id, false)
    || jsonb_build_object(
      'recoveryRequired', true,
      'permitsMutation', false
    );
end;
$$;

revoke all on function public.reconcile_literature_gold_review_operation_v1(
  uuid, text, jsonb
) from public, anon, authenticated;
grant execute on function public.reconcile_literature_gold_review_operation_v1(
  uuid, text, jsonb
) to service_role;

create or replace function public.validate_literature_gold_import_review_payload_v1(
  p_item_id uuid,
  p_review jsonb,
  p_expected_first_effective boolean
)
returns void
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  selected_item public.literature_gold_set_items%rowtype;
  relevance text;
  topic_ids text[];
  technology_tags text[];
  clinical_purposes text[];
  disease_tags text[];
  study_design text;
  publication_status text;
  used_supplemental boolean;
  is_blinded boolean;
begin
  select * into selected_item
  from public.literature_gold_set_items as item
  where item.id = p_item_id;

  if not found or p_review is null or jsonb_typeof(p_review) <> 'object'
    or jsonb_typeof(p_review -> 'topicIds') <> 'array'
    or jsonb_typeof(p_review -> 'technologyTags') <> 'array'
    or jsonb_typeof(p_review -> 'clinicalPurposes') <> 'array'
    or jsonb_typeof(p_review -> 'diseaseTags') <> 'array' then
    raise exception using errcode = 'P7650', message = 'import review payload is incomplete';
  end if;

  perform public.assert_literature_gold_jsonb_object_v1(
    p_review,
    array[
      'relevanceLabel', 'metadataSufficiency', 'reviewerConfidence', 'topicIds',
      'technologyTags', 'technologyTagStatus', 'clinicalPurposes', 'diseaseTags',
      'diseaseTagStatus', 'studyDesign', 'publicationStatus',
      'categorizationFromFullText', 'notes', 'usedSupplementalMetadata',
      'reviewSeconds', 'taxonomyVersion', 'labelSchemaVersion',
      'enrichmentSchemaVersion', 'enrichmentProvenance', 'reviewerUserId',
      'reviewerEmail', 'isBlinded', 'startedAt', 'completedAt', 'createdAt'
    ],
    array[
      'relevanceLabel', 'metadataSufficiency', 'reviewerConfidence', 'topicIds',
      'technologyTags', 'technologyTagStatus', 'clinicalPurposes', 'diseaseTags',
      'diseaseTagStatus', 'studyDesign', 'publicationStatus',
      'categorizationFromFullText', 'notes', 'usedSupplementalMetadata',
      'reviewSeconds', 'taxonomyVersion', 'labelSchemaVersion',
      'enrichmentSchemaVersion', 'enrichmentProvenance', 'reviewerUserId',
      'reviewerEmail', 'isBlinded', 'startedAt', 'completedAt', 'createdAt'
    ],
    'import review payload'
  );

  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'relevanceLabel', 'string', false, 'import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'metadataSufficiency', 'string', false, 'import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'reviewerConfidence', 'string', false, 'import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'technologyTagStatus', 'string', false, 'import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'diseaseTagStatus', 'string', false, 'import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'studyDesign', 'string', true, 'import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'publicationStatus', 'string', true, 'import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'categorizationFromFullText', 'boolean', false, 'import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'notes', 'string', false, 'import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'usedSupplementalMetadata', 'boolean', false, 'import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'reviewSeconds', 'number', false, 'import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'taxonomyVersion', 'string', false, 'import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'labelSchemaVersion', 'string', false, 'import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'enrichmentSchemaVersion', 'string', false, 'import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'enrichmentProvenance', 'string', false, 'import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'reviewerUserId', 'string', true, 'import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'reviewerEmail', 'string', true, 'import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'isBlinded', 'boolean', false, 'import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'startedAt', 'string', false, 'import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'completedAt', 'string', false, 'import review payload');
  perform public.assert_literature_gold_jsonb_scalar_v1(p_review, 'createdAt', 'string', false, 'import review payload');

  if exists (
    select 1
    from jsonb_array_elements(p_review -> 'topicIds') element
    where jsonb_typeof(element) <> 'string' or length(trim(element #>> '{}')) not between 1 and 160
  ) or exists (
    select 1
    from jsonb_array_elements(p_review -> 'technologyTags') element
    where jsonb_typeof(element) <> 'string' or length(trim(element #>> '{}')) not between 1 and 160
  ) or exists (
    select 1
    from jsonb_array_elements(p_review -> 'clinicalPurposes') element
    where jsonb_typeof(element) <> 'string' or length(trim(element #>> '{}')) not between 1 and 160
  ) or exists (
    select 1
    from jsonb_array_elements(p_review -> 'diseaseTags') element
    where jsonb_typeof(element) <> 'string' or length(trim(element #>> '{}')) not between 1 and 160
  ) or p_review ->> 'reviewSeconds' !~ '^(0|[1-9][0-9]*)$'
    or (jsonb_typeof(p_review -> 'reviewerUserId') <> 'null'
      and p_review ->> 'reviewerUserId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    or (jsonb_typeof(p_review -> 'reviewerEmail') <> 'null'
      and length(trim(p_review ->> 'reviewerEmail')) not between 1 and 320)
    or not public.literature_gold_is_timestamptz_v1(p_review ->> 'startedAt')
    or not public.literature_gold_is_timestamptz_v1(p_review ->> 'completedAt')
    or not public.literature_gold_is_timestamptz_v1(p_review ->> 'createdAt') then
    raise exception using errcode = 'P7650', message = 'import review payload has invalid JSON scalar or array element types';
  end if;

  relevance := p_review ->> 'relevanceLabel';
  topic_ids := array(select jsonb_array_elements_text(p_review -> 'topicIds'));
  technology_tags := array(select jsonb_array_elements_text(p_review -> 'technologyTags'));
  clinical_purposes := array(select jsonb_array_elements_text(p_review -> 'clinicalPurposes'));
  disease_tags := array(select jsonb_array_elements_text(p_review -> 'diseaseTags'));
  study_design := nullif(p_review ->> 'studyDesign', '');
  publication_status := nullif(p_review ->> 'publicationStatus', '');
  used_supplemental := coalesce((p_review ->> 'usedSupplementalMetadata')::boolean, false);
  is_blinded := (p_review ->> 'isBlinded')::boolean;

  if relevance not in ('include_core', 'include_adjacent', 'exclude', 'uncertain')
    or p_review ->> 'metadataSufficiency' not in (
      'adequate_abstract', 'limited_abstract', 'no_abstract', 'conflicting_metadata'
    )
    or p_review ->> 'reviewerConfidence' not in ('high', 'moderate', 'low')
    or length(coalesce(p_review ->> 'notes', '')) > 4000
    or (p_review ->> 'reviewSeconds')::integer not between 0 and 86400
    or cardinality(topic_ids) > 100
    or cardinality(technology_tags) > 100
    or cardinality(clinical_purposes) > 30
    or cardinality(disease_tags) > 30
    or cardinality(topic_ids) <> cardinality(array(select distinct value from unnest(topic_ids) as value))
    or cardinality(technology_tags) <> cardinality(array(select distinct value from unnest(technology_tags) as value))
    or cardinality(clinical_purposes) <> cardinality(array(select distinct value from unnest(clinical_purposes) as value))
    or cardinality(disease_tags) <> cardinality(array(select distinct value from unnest(disease_tags) as value)) then
    raise exception using errcode = 'P7651', message = 'import review labels, notes, elapsed time, or uniqueness are invalid';
  end if;

  if p_review ->> 'technologyTagStatus' not in (
      'tagged', 'not_applicable', 'not_assessable'
    )
    or p_review ->> 'diseaseTagStatus' not in (
      'tagged', 'not_applicable', 'not_assessable'
    )
    or (cardinality(technology_tags) > 0) is distinct from
      (p_review ->> 'technologyTagStatus' = 'tagged')
    or (cardinality(disease_tags) > 0) is distinct from
      (p_review ->> 'diseaseTagStatus' = 'tagged')
    or nullif(trim(coalesce(p_review ->> 'taxonomyVersion', '')), '') is null
    or nullif(trim(coalesce(p_review ->> 'labelSchemaVersion', '')), '') is null
    or nullif(trim(coalesce(p_review ->> 'enrichmentSchemaVersion', '')), '') is null
    or nullif(trim(coalesce(p_review ->> 'enrichmentProvenance', '')), '') is null then
    raise exception using errcode = 'P7651', message = 'import enrichment status, versions, or provenance are invalid';
  end if;

  if exists (
    select 1 from unnest(topic_ids) as supplied(value)
    where supplied.value <> all(array[
      'basic-bronchoscopy', 'ebus-mediastinal-staging', 'peripheral-navigation',
      'peripheral-biopsy-localization', 'central-airway-obstruction',
      'airway-stents-stenosis', 'pleural-interventions',
      'bronchoscopic-lung-volume-reduction', 'persistent-air-leak-fistula',
      'transbronchial-cryobiopsy', 'hemoptysis-airway-bleeding',
      'tracheostomy-airway-access', 'bronchoscopic-tumor-ablation',
      'other-advanced-bronchoscopy', 'safety-anesthesia-complications',
      'education-simulation-quality', 'ai-imaging-technology',
      'adjacent-surgical-procedural-analogue',
      'specimen-adequacy-molecular-pathology', 'health-services-economics'
    ]::text[])
  ) or exists (
    select 1 from unnest(technology_tags) as supplied(value)
    where supplied.value <> all(array[
      'convex-ebus', 'eus-b', 'radial-ebus', 'robotic-bronchoscopy',
      'electromagnetic-navigation', 'cone-beam-ct', 'augmented-fluoroscopy',
      'virtual-bronchoscopy', 'transbronchial-cryobiopsy', 'endobronchial-valve',
      'airway-stent', 'rigid-bronchoscopy', 'electrocautery',
      'argon-plasma-coagulation', 'laser', 'cryotherapy', 'photodynamic-therapy',
      'brachytherapy', 'indwelling-pleural-catheter', 'medical-thoracoscopy',
      'bronchial-thermoplasty', 'whole-lung-lavage', 'percutaneous-tracheostomy',
      'thoracentesis', 'chest-tube', 'pleurodesis', 'bronchoalveolar-lavage',
      'conventional-tbna', 'rapid-on-site-evaluation', 'endobronchial-coils',
      'balloon-bronchoplasty', 'mediastinal-cryobiopsy', 'foreign-body-removal',
      'bronchial-artery-embolization', 'narrow-band-imaging',
      'autofluorescence-bronchoscopy', 'confocal-laser-endomicroscopy',
      'topical-hemostatic-agent', 'transbronchial-thermal-ablation', 'surgical-vats'
    ]::text[])
  ) or exists (
    select 1 from unnest(clinical_purposes) as supplied(value)
    where supplied.value <> all(array[
      'diagnosis', 'staging', 'treatment', 'palliation', 'surveillance',
      'localization', 'training', 'safety-complication-prevention',
      'multiple-general-overview', 'not-assessable-from-available-metadata',
      'cost-effectiveness-health-services', 'specimen-adequacy',
      'workflow-operations-quality'
    ]::text[])
  ) or exists (
    select 1 from unnest(disease_tags) as supplied(value)
    where supplied.value <> all(array[
      'lung-cancer', 'mesothelioma', 'emphysema', 'interstitial-lung-disease',
      'immune-inflammatory-disease', 'infection', 'transplant',
      'benign-airway-stenosis', 'pleural-disease',
      'lymphoma-hematologic-malignancy', 'metastatic-extrathoracic-malignancy',
      'tracheobronchomalacia-edac', 'asthma', 'foreign-body-aspiration',
      'hemoptysis', 'bronchiectasis', 'pulmonary-alveolar-proteinosis',
      'airway-amyloidosis', 'congenital-airway-disorder'
    ]::text[])
  ) then
    raise exception using errcode = 'P7652', message = 'import review contains an unknown taxonomy 2.0 controlled label';
  end if;

  if study_design is not null and study_design <> all(array[
    'randomized-trial', 'prospective-cohort', 'retrospective-cohort',
    'diagnostic-accuracy', 'systematic-review', 'meta-analysis', 'guideline',
    'consensus', 'case-series', 'case-report', 'technical-note', 'editorial',
    'review-article', 'not-assessable-from-available-metadata',
    'cross-sectional-survey', 'economic-evaluation', 'animal-preclinical',
    'bench-in-vitro', 'qualitative-study', 'case-control'
  ]::text[]) then
    raise exception using errcode = 'P7652', message = 'import review contains an unknown study design';
  end if;
  if publication_status is not null and publication_status <> all(array[
    'full-article', 'conference-abstract', 'letter', 'editorial', 'correction',
    'retraction', 'protocol', 'interactive-clinical-case',
    'not-assessable-from-available-metadata'
  ]::text[]) then
    raise exception using errcode = 'P7652', message = 'import review contains an unknown publication status';
  end if;

  if relevance in ('include_core', 'include_adjacent') then
    if cardinality(topic_ids) = 0 or cardinality(clinical_purposes) = 0
      or study_design is null or publication_status is null then
      raise exception using errcode = 'P7653', message = 'included import reviews require topic, purpose, study design, and publication status';
    end if;
  elsif cardinality(topic_ids) > 0 or cardinality(technology_tags) > 0
    or cardinality(clinical_purposes) > 0 or cardinality(disease_tags) > 0
    or study_design is not null or publication_status is not null
    or coalesce((p_review ->> 'categorizationFromFullText')::boolean, false) then
    raise exception using errcode = 'P7653', message = 'excluded or uncertain import reviews cannot carry categorization';
  end if;

  if used_supplemental is distinct from
    (selected_item.supplemental_metadata_revealed_at is not null) then
    raise exception using errcode = 'P7654', message = 'import supplemental-metadata use does not match item reveal state';
  end if;
  if is_blinded is distinct from
    (selected_item.automated_signals_revealed_at is null) then
    raise exception using errcode = 'P7654', message = 'import blinding flag does not match automated-signal reveal state';
  end if;
  if p_expected_first_effective and not is_blinded then
    raise exception using errcode = 'P7654', message = 'the first effective review must remain blinded';
  end if;
  if (p_review ->> 'startedAt')::timestamptz is null
    or (p_review ->> 'completedAt')::timestamptz is null
    or (p_review ->> 'createdAt')::timestamptz is null
    or (p_review ->> 'completedAt')::timestamptz < (p_review ->> 'startedAt')::timestamptz then
    raise exception using errcode = 'P7655', message = 'import review requires valid checksum-bound timestamps';
  end if;
end;
$$;

revoke all on function public.validate_literature_gold_import_review_payload_v1(uuid, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.validate_literature_gold_import_review_payload_v1(uuid, jsonb, boolean)
  to service_role;

create or replace function public.apply_literature_gold_import_v1(
  p_operation_id uuid,
  p_idempotency_key text,
  p_batch_id uuid,
  p_artifact_sha256 text,
  p_plan_sha256 text,
  p_plan jsonb,
  p_authorization_sha256 text,
  p_authorization jsonb,
  p_actor_user_id uuid default null,
  p_actor_email text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  normalized_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  normalized_email text := nullif(trim(coalesce(p_actor_email, '')), '');
  existing_operation public.literature_gold_review_operations%rowtype;
  locked_batch public.literature_gold_set_batches%rowtype;
  action_json jsonb;
  review_json jsonb;
  action_row public.literature_gold_review_operation_actions%rowtype;
  locked_item public.literature_gold_set_items%rowtype;
  head_review public.literature_gold_set_reviews%rowtype;
  created_review public.literature_gold_set_reviews%rowtype;
  actual_effective_review_id uuid;
  expected_current_review_id uuid;
  expected_effective_review_id uuid;
  expected_supersedes_review_id uuid;
  expected_revision integer;
  planned_action_count integer;
  planned_initial_count integer;
  planned_revision_count integer;
  planned_apply_count integer;
  planned_noop_count integer;
  applied_count integer := 0;
  noop_count integer := 0;
  pre_physical_hash text;
  pre_effective_hash text;
  post_physical_hash text;
  post_effective_hash text;
  expected_post_effective_hash text;
  development_membership_hash text;
  current_effective_payload jsonb;
  fault_after_action integer;
  caught_sqlstate text;
  caught_message text;
begin
  if p_operation_id is null or p_batch_id is null then
    raise exception using errcode = 'P7601', message = 'operation and batch identities are required';
  end if;
  if normalized_key !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = 'P7601', message = 'a canonical lowercase SHA-256 idempotency key is required';
  end if;
  if p_actor_user_id is null and normalized_email is null then
    raise exception using errcode = 'P7601', message = 'an import actor is required';
  end if;
  if p_artifact_sha256 !~ '^[a-f0-9]{64}$'
    or p_plan_sha256 !~ '^[a-f0-9]{64}$'
    or p_authorization_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = 'P7601', message = 'import checksums must be lowercase SHA-256 values';
  end if;
  if p_plan is null or jsonb_typeof(p_plan) <> 'object'
    or jsonb_typeof(p_plan -> 'actions') <> 'array'
    or p_authorization is null or jsonb_typeof(p_authorization) <> 'object' then
    raise exception using errcode = 'P7601', message = 'import plan and authorization must be JSON objects with an actions array';
  end if;
  perform public.assert_literature_gold_jsonb_object_v1(
    p_plan,
    array[
      'contractVersion', 'kind', 'operationId', 'batchId', 'sourceArtifactSha256',
      'sourceAuthorizationSetSha256', 'expectedPhysicalStateSha256',
      'expectedEffectiveStateSha256', 'expectedPostEffectiveStateSha256',
      'executionContext', 'scope', 'counts', 'actions', 'faultAfterAction', 'binding'
    ],
    array[
      'contractVersion', 'kind', 'operationId', 'batchId', 'sourceArtifactSha256',
      'sourceAuthorizationSetSha256', 'expectedPhysicalStateSha256',
      'expectedEffectiveStateSha256', 'expectedPostEffectiveStateSha256',
      'executionContext', 'scope', 'counts', 'actions', 'binding'
    ],
    'import plan'
  );
  perform public.assert_literature_gold_jsonb_object_v1(
    p_plan -> 'executionContext',
    array[
      'targetDatabase', 'remoteWritesAllowed', 'repositoryCommitSha', 'migrationId',
      'importRpc', 'compensationRpc', 'reconciliationRpc', 'developmentMembershipHash',
      'physicalStateHash', 'effectiveStateHash'
    ],
    array[
      'targetDatabase', 'remoteWritesAllowed', 'repositoryCommitSha', 'migrationId',
      'importRpc', 'compensationRpc', 'reconciliationRpc', 'developmentMembershipHash',
      'physicalStateHash', 'effectiveStateHash'
    ],
    'import execution context'
  );
  perform public.assert_literature_gold_jsonb_object_v1(
    p_plan -> 'scope',
    array['datasetSplit', 'heldOutIdentitiesAccessed', 'developmentMembershipSha256'],
    array['datasetSplit', 'heldOutIdentitiesAccessed', 'developmentMembershipSha256'],
    'import scope'
  );
  perform public.assert_literature_gold_jsonb_object_v1(
    p_plan -> 'counts',
    array['total', 'initial', 'revisions', 'noops', 'inserts'],
    array['total', 'initial', 'revisions', 'noops', 'inserts'],
    'import counts'
  );
  perform public.assert_literature_gold_jsonb_object_v1(
    p_plan -> 'binding',
    array['contentSha256', 'idempotencyKey'],
    array['contentSha256', 'idempotencyKey'],
    'import plan binding'
  );
  perform public.assert_literature_gold_jsonb_object_v1(
    p_authorization,
    array[
      'contractVersion', 'kind', 'authorizationId', 'authorized', 'authorizedBy',
      'authorizedAt', 'authorizationNote', 'targetDatabase', 'remoteWritesAllowed',
      'repositoryCommitSha', 'migrationId', 'operationId', 'batchId', 'planSha256',
      'idempotencyKey', 'sourceArtifactSha256', 'expectedPhysicalStateSha256',
      'expectedEffectiveStateSha256', 'expectedPostEffectiveStateSha256', 'binding'
    ],
    array[
      'contractVersion', 'kind', 'authorizationId', 'authorized', 'authorizedBy',
      'authorizedAt', 'authorizationNote', 'targetDatabase', 'remoteWritesAllowed',
      'repositoryCommitSha', 'migrationId', 'operationId', 'batchId', 'planSha256',
      'idempotencyKey', 'sourceArtifactSha256', 'expectedPhysicalStateSha256',
      'expectedEffectiveStateSha256', 'expectedPostEffectiveStateSha256', 'binding'
    ],
    'import authorization'
  );
  perform public.assert_literature_gold_jsonb_object_v1(
    p_authorization -> 'binding',
    array['contentSha256'], array['contentSha256'], 'import authorization binding'
  );
  if exists (
      select 1 from unnest(array[
        'contractVersion','kind','operationId','batchId','sourceArtifactSha256',
        'sourceAuthorizationSetSha256','expectedPhysicalStateSha256',
        'expectedEffectiveStateSha256','expectedPostEffectiveStateSha256'
      ]) field where jsonb_typeof(p_plan -> field) is distinct from 'string'
    )
    or exists (
      select 1 from unnest(array[
        'targetDatabase','repositoryCommitSha','migrationId','importRpc',
        'compensationRpc','reconciliationRpc','developmentMembershipHash',
        'physicalStateHash','effectiveStateHash'
      ]) field where jsonb_typeof(p_plan -> 'executionContext' -> field) is distinct from 'string'
    )
    or exists (
      select 1 from unnest(array['datasetSplit','developmentMembershipSha256']) field
      where jsonb_typeof(p_plan -> 'scope' -> field) is distinct from 'string'
    )
    or exists (
      select 1 from unnest(array[
        'contractVersion','kind','authorizationId','authorizedBy','authorizedAt',
        'authorizationNote','targetDatabase','repositoryCommitSha','migrationId',
        'operationId','batchId','planSha256','idempotencyKey','sourceArtifactSha256',
        'expectedPhysicalStateSha256','expectedEffectiveStateSha256',
        'expectedPostEffectiveStateSha256'
      ]) field where jsonb_typeof(p_authorization -> field) is distinct from 'string'
    )
    or jsonb_typeof(p_plan -> 'contractVersion') <> 'string'
    or jsonb_typeof(p_plan -> 'kind') <> 'string'
    or p_plan ->> 'operationId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or p_plan ->> 'batchId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or p_plan ->> 'sourceAuthorizationSetSha256' !~ '^[a-f0-9]{64}$'
    or p_plan ->> 'expectedPhysicalStateSha256' !~ '^[a-f0-9]{64}$'
    or p_plan ->> 'expectedEffectiveStateSha256' !~ '^[a-f0-9]{64}$'
    or p_plan ->> 'expectedPostEffectiveStateSha256' !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_plan #> '{binding,contentSha256}') is distinct from 'string'
    or jsonb_typeof(p_plan #> '{binding,idempotencyKey}') is distinct from 'string'
    or jsonb_typeof(p_plan #> '{executionContext,remoteWritesAllowed}') <> 'boolean'
    or jsonb_typeof(p_plan #> '{scope,heldOutIdentitiesAccessed}') <> 'boolean'
    or p_plan #>> '{binding,contentSha256}' !~ '^[a-f0-9]{64}$'
    or p_plan #>> '{binding,idempotencyKey}' !~ '^[a-f0-9]{64}$'
    or exists (
      select 1 from jsonb_each(p_plan -> 'counts') field
      where jsonb_typeof(field.value) <> 'number'
        or field.value #>> '{}' !~ '^(0|[1-9][0-9]*)$'
    )
    or (p_plan ? 'faultAfterAction' and (
      jsonb_typeof(p_plan -> 'faultAfterAction') <> 'number'
      or p_plan ->> 'faultAfterAction' !~ '^[1-9][0-9]*$'
    ))
    or p_authorization ->> 'authorizationId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(p_authorization -> 'authorized') <> 'boolean'
    or jsonb_typeof(p_authorization -> 'authorizedBy') <> 'string'
    or length(trim(p_authorization ->> 'authorizedBy')) not between 1 and 320
    or jsonb_typeof(p_authorization -> 'authorizedAt') <> 'string'
    or not public.literature_gold_is_timestamptz_v1(p_authorization ->> 'authorizedAt')
    or jsonb_typeof(p_authorization -> 'authorizationNote') <> 'string'
    or length(trim(p_authorization ->> 'authorizationNote')) not between 5 and 2000
    or jsonb_typeof(p_authorization -> 'remoteWritesAllowed') <> 'boolean'
    or p_authorization ->> 'operationId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or p_authorization ->> 'batchId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or p_authorization ->> 'planSha256' !~ '^[a-f0-9]{64}$'
    or p_authorization ->> 'idempotencyKey' !~ '^[a-f0-9]{64}$'
    or p_authorization ->> 'sourceArtifactSha256' !~ '^[a-f0-9]{64}$'
    or p_authorization ->> 'expectedPhysicalStateSha256' !~ '^[a-f0-9]{64}$'
    or p_authorization ->> 'expectedEffectiveStateSha256' !~ '^[a-f0-9]{64}$'
    or p_authorization ->> 'expectedPostEffectiveStateSha256' !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_authorization #> '{binding,contentSha256}') is distinct from 'string'
    or p_authorization #>> '{binding,contentSha256}' !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = 'P7602', message = 'import plan or authorization has null, malformed, or incorrectly typed contract fields';
  end if;
  if public.literature_gold_jsonb_sha256_v1(p_plan - 'binding') is distinct from p_plan_sha256
    or p_plan #>> '{binding,contentSha256}' is distinct from p_plan_sha256
    or p_plan #>> '{binding,idempotencyKey}' is distinct from normalized_key
    or normalized_key is distinct from public.literature_gold_jsonb_sha256_v1(
      jsonb_build_object(
        'contractVersion', 'gold-review-import-compensation/1.0.0',
        'kind', 'import',
        'operationId', p_operation_id,
        'contentSha256', p_plan_sha256
      )
    ) then
    raise exception using errcode = 'P7602', message = 'import plan checksum does not match its canonical JSON payload';
  end if;
  if public.literature_gold_jsonb_sha256_v1(p_authorization - 'binding')
      is distinct from p_authorization_sha256
    or p_authorization #>> '{binding,contentSha256}' is distinct from p_authorization_sha256 then
    raise exception using errcode = 'P7602', message = 'import authorization checksum does not match its canonical JSON payload';
  end if;
  if p_plan ->> 'contractVersion'
      is distinct from 'gold-review-import-compensation/1.0.0'
    or p_plan ->> 'kind' is distinct from 'import'
    or p_plan ->> 'operationId' is distinct from p_operation_id::text
    or p_plan ->> 'batchId' is distinct from p_batch_id::text
    or p_plan #>> '{scope,datasetSplit}' is distinct from 'development'
    or (p_plan #>> '{scope,heldOutIdentitiesAccessed}')::boolean is distinct from false
    or p_plan #>> '{executionContext,targetDatabase}' is distinct from 'local'
    or (p_plan #>> '{executionContext,remoteWritesAllowed}')::boolean is distinct from false
    or p_plan #>> '{executionContext,migrationId}'
      is distinct from '20260808035633_add_literature_gold_import_compensation_contract'
    or p_plan #>> '{executionContext,importRpc}'
      is distinct from 'apply_literature_gold_import_v1'
    or p_plan #>> '{executionContext,compensationRpc}'
      is distinct from 'compensate_literature_gold_import_v1'
    or p_plan #>> '{executionContext,reconciliationRpc}'
      is distinct from 'reconcile_literature_gold_review_operation_v1'
    or p_plan #>> '{executionContext,developmentMembershipHash}'
      is distinct from 'literature_gold_development_membership_hash_v1'
    or p_plan #>> '{executionContext,physicalStateHash}'
      is distinct from 'literature_gold_physical_state_hash_v1'
    or p_plan #>> '{executionContext,effectiveStateHash}'
      is distinct from 'literature_gold_effective_state_hash_v1'
    or p_plan #>> '{executionContext,repositoryCommitSha}' !~ '^[a-f0-9]{40}$'
    or p_plan ->> 'sourceArtifactSha256' is distinct from p_artifact_sha256
    or p_plan ->> 'sourceAuthorizationSetSha256' !~ '^[a-f0-9]{64}$'
    or p_plan #>> '{scope,developmentMembershipSha256}' !~ '^[a-f0-9]{64}$'
    or p_authorization ->> 'contractVersion'
      is distinct from 'gold-review-import-compensation/1.0.0'
    or p_authorization ->> 'kind' is distinct from 'import_authorization'
    or (p_authorization ->> 'authorized')::boolean is distinct from true
    or p_authorization ->> 'operationId' is distinct from p_operation_id::text
    or p_authorization ->> 'batchId' is distinct from p_batch_id::text
    or p_authorization ->> 'targetDatabase' is distinct from 'local'
    or (p_authorization ->> 'remoteWritesAllowed')::boolean is distinct from false
    or p_authorization ->> 'repositoryCommitSha'
      is distinct from p_plan #>> '{executionContext,repositoryCommitSha}'
    or p_authorization ->> 'migrationId'
      is distinct from p_plan #>> '{executionContext,migrationId}'
    or p_authorization ->> 'sourceArtifactSha256' is distinct from p_artifact_sha256
    or p_authorization ->> 'planSha256' is distinct from p_plan_sha256
    or p_authorization ->> 'idempotencyKey' is distinct from normalized_key
    or p_authorization ->> 'expectedPhysicalStateSha256'
      is distinct from p_plan ->> 'expectedPhysicalStateSha256'
    or p_authorization ->> 'expectedEffectiveStateSha256'
      is distinct from p_plan ->> 'expectedEffectiveStateSha256'
    or p_authorization ->> 'expectedPostEffectiveStateSha256'
      is distinct from p_plan ->> 'expectedPostEffectiveStateSha256' then
    raise exception using errcode = 'P7602', message = 'import plan or authorization is not bound to this exact operation, artifact, batch, and development split';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(least(p_operation_id::text, 'import:' || normalized_key), 0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(p_operation_id::text, 'import:' || normalized_key), 0));

  select * into existing_operation
  from public.literature_gold_review_operations as operation
  where operation.id = p_operation_id
     or (operation.operation_kind = 'import' and operation.idempotency_key = normalized_key)
  order by case when operation.id = p_operation_id then 0 else 1 end
  limit 1
  for update;

  if found then
    if existing_operation.id is distinct from p_operation_id
      or existing_operation.operation_kind <> 'import'
      or existing_operation.idempotency_key is distinct from normalized_key
      or existing_operation.batch_id is distinct from p_batch_id
      or existing_operation.artifact_sha256 is distinct from p_artifact_sha256
      or existing_operation.plan_sha256 is distinct from p_plan_sha256
      or existing_operation.plan is distinct from p_plan
      or existing_operation.authorization_sha256 is distinct from p_authorization_sha256
      or existing_operation.authorization_payload is distinct from p_authorization then
      raise exception using errcode = 'P7603', message = 'idempotency identity was reused with different import inputs';
    end if;
    if existing_operation.status = 'started' then
      raise exception using errcode = 'P7604', message = 'an existing started import requires explicit recovery authorization';
    end if;
    return public.literature_gold_review_operation_receipt_v1(existing_operation.id, true);
  end if;

  planned_action_count := jsonb_array_length(p_plan -> 'actions');
  select
    count(*) filter (where value ->> 'action' = 'import_initial')::integer,
    count(*) filter (where value ->> 'action' = 'import_revision')::integer,
    count(*) filter (where value ->> 'action' in ('import_initial', 'import_revision'))::integer,
    count(*) filter (where value ->> 'action' = 'import_noop')::integer
  into planned_initial_count, planned_revision_count, planned_apply_count, planned_noop_count
  from jsonb_array_elements(p_plan -> 'actions');

  if planned_action_count < 1 or planned_action_count > 5000
    or planned_apply_count + planned_noop_count <> planned_action_count
    or (p_plan #>> '{counts,total}')::integer is distinct from planned_action_count
    or (p_plan #>> '{counts,initial}')::integer is distinct from planned_initial_count
    or (p_plan #>> '{counts,revisions}')::integer is distinct from planned_revision_count
    or (p_plan #>> '{counts,inserts}')::integer is distinct from planned_apply_count
    or (p_plan #>> '{counts,noops}')::integer is distinct from planned_noop_count then
    raise exception using errcode = 'P7605', message = 'import plan counts or action dispositions are invalid';
  end if;

  for action_json in select value from jsonb_array_elements(p_plan -> 'actions') loop
    if action_json ->> 'action' in ('import_initial', 'import_revision') then
      perform public.assert_literature_gold_jsonb_object_v1(
        action_json,
        array[
          'actionId', 'sequence', 'itemId', 'pmid', 'datasetSplit',
          'expectedCurrentReviewId', 'expectedEffectiveReviewId', 'preImportItemState',
          'action', 'expectedRevision', 'expectedSupersedesReviewId', 'importedReviewId',
          'expectedHeadReviewIdAfter', 'expectedEffectiveReviewIdAfter', 'review',
          'reviewSha256', 'compensationAction', 'expectedEventSequence'
        ],
        array[
          'actionId', 'sequence', 'itemId', 'pmid', 'datasetSplit',
          'expectedCurrentReviewId', 'expectedEffectiveReviewId', 'preImportItemState',
          'action', 'expectedRevision', 'expectedSupersedesReviewId', 'importedReviewId',
          'expectedHeadReviewIdAfter', 'expectedEffectiveReviewIdAfter', 'review',
          'reviewSha256', 'compensationAction', 'expectedEventSequence'
        ],
        'applied import action'
      );
    else
      perform public.assert_literature_gold_jsonb_object_v1(
        action_json,
        array[
          'actionId', 'sequence', 'itemId', 'pmid', 'datasetSplit',
          'expectedCurrentReviewId', 'expectedEffectiveReviewId', 'preImportItemState',
          'action', 'expectedRevision', 'expectedSupersedesReviewId', 'importedReviewId',
          'expectedHeadReviewIdAfter', 'expectedEffectiveReviewIdAfter',
          'candidateReview', 'candidateReviewSha256', 'compensationAction', 'expectedEventSequence'
        ],
        array[
          'actionId', 'sequence', 'itemId', 'pmid', 'datasetSplit',
          'expectedCurrentReviewId', 'expectedEffectiveReviewId', 'preImportItemState',
          'action', 'expectedRevision', 'expectedSupersedesReviewId', 'importedReviewId',
          'expectedHeadReviewIdAfter', 'expectedEffectiveReviewIdAfter',
          'candidateReview', 'candidateReviewSha256', 'compensationAction', 'expectedEventSequence'
        ],
        'import no-op action'
      );
    end if;
    perform public.assert_literature_gold_jsonb_object_v1(
      action_json -> 'preImportItemState',
      array[
        'reviewStatus', 'startedAt', 'completedAt',
        'supplementalMetadataRevealedAt', 'automatedSignalsRevealedAt'
      ],
      array[
        'reviewStatus', 'startedAt', 'completedAt',
        'supplementalMetadataRevealedAt', 'automatedSignalsRevealedAt'
      ],
      'import action pre-state'
    );
    if exists (
        select 1 from unnest(array[
          'actionId','itemId','pmid','datasetSplit','action','compensationAction'
        ]) field where jsonb_typeof(action_json -> field) is distinct from 'string'
      )
      or action_json ->> 'actionId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(action_json -> 'sequence') <> 'number'
      or action_json ->> 'sequence' !~ '^[1-9][0-9]*$'
      or action_json ->> 'itemId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or action_json ->> 'pmid' !~ '^[0-9]{1,12}$'
      or jsonb_typeof(action_json -> 'expectedEventSequence') <> 'array'
      or exists (select 1 from jsonb_array_elements(action_json -> 'expectedEventSequence') element where jsonb_typeof(element) <> 'string')
      or jsonb_typeof(action_json #> '{preImportItemState,reviewStatus}') <> 'string'
      or exists (
        select 1 from unnest(array['startedAt','completedAt','supplementalMetadataRevealedAt','automatedSignalsRevealedAt']) field
        where jsonb_typeof(action_json -> 'preImportItemState' -> field) not in ('string', 'null')
          or (jsonb_typeof(action_json -> 'preImportItemState' -> field) = 'string'
            and not public.literature_gold_is_timestamptz_v1(action_json -> 'preImportItemState' ->> field))
      )
      or exists (
        select 1 from unnest(array[
          'expectedCurrentReviewId','expectedEffectiveReviewId','expectedSupersedesReviewId',
          'importedReviewId','expectedHeadReviewIdAfter','expectedEffectiveReviewIdAfter'
        ]) field
        where jsonb_typeof(action_json -> field) not in ('string', 'null')
          or (jsonb_typeof(action_json -> field) = 'string'
            and action_json ->> field !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
      )
      or jsonb_typeof(action_json -> 'expectedRevision') not in ('number', 'null')
      or (jsonb_typeof(action_json -> 'expectedRevision') = 'number'
        and action_json ->> 'expectedRevision' !~ '^[1-9][0-9]*$')
      or (action_json ->> 'action' in ('import_initial', 'import_revision') and (
        jsonb_typeof(action_json -> 'reviewSha256') is distinct from 'string'
        or action_json ->> 'reviewSha256' !~ '^[a-f0-9]{64}$'
        or jsonb_typeof(action_json -> 'review') <> 'object'
      ))
      or (action_json ->> 'action' = 'import_noop' and (
        jsonb_typeof(action_json -> 'candidateReview') not in ('object', 'null')
        or jsonb_typeof(action_json -> 'candidateReviewSha256') is distinct from 'string'
        or action_json ->> 'candidateReviewSha256' !~ '^[a-f0-9]{64}$'
      )) then
      raise exception using errcode = 'P7605', message = 'import action has null, malformed, or incorrectly typed fields';
    end if;
  end loop;

  if (
    select count(distinct value ->> 'actionId') <> planned_action_count
      or count(distinct (value ->> 'sequence')::integer) <> planned_action_count
      or count(distinct value ->> 'itemId') <> planned_action_count
      or min((value ->> 'sequence')::integer) <> 1
      or max((value ->> 'sequence')::integer) <> planned_action_count
    from jsonb_array_elements(p_plan -> 'actions')
  ) then
    raise exception using errcode = 'P7605', message = 'import action identities, items, and contiguous sequences must be unique';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_plan -> 'actions') as planned(value)
    left join public.literature_gold_set_items as item
      on item.id = (planned.value ->> 'itemId')::uuid
    where item.id is null
      or item.batch_id is distinct from p_batch_id
      or item.dataset_split is distinct from 'development'
      or planned.value ->> 'datasetSplit' is distinct from 'development'
      or item.pmid is distinct from planned.value ->> 'pmid'
      or (planned.value ->> 'action' = 'import_initial'
        and planned.value ->> 'compensationAction' is distinct from 'compensate_void')
      or (planned.value ->> 'action' = 'import_revision'
        and nullif(planned.value ->> 'expectedEffectiveReviewId', '') is null
        and planned.value ->> 'compensationAction' is distinct from 'compensate_void')
      or (planned.value ->> 'action' = 'import_revision'
        and nullif(planned.value ->> 'expectedEffectiveReviewId', '') is not null
        and planned.value ->> 'compensationAction' is distinct from 'compensate_restore')
      or (planned.value ->> 'action' = 'import_noop'
        and planned.value ->> 'compensationAction' is distinct from 'compensate_noop')
  ) then
    raise exception using errcode = 'P7606', message = 'every explicitly planned import target must match a development item and PMID in the selected batch';
  end if;

  select * into locked_batch
  from public.literature_gold_set_batches as batch
  where batch.id = p_batch_id
  for update;
  if not found then
    raise exception using errcode = 'P7606', message = 'gold-set batch not found';
  end if;
  if locked_batch.status <> 'active' then
    raise exception using errcode = 'P7606', message = 'only an active gold-set batch may receive an import';
  end if;
  if locked_batch.kind = 'gold_standard' and locked_batch.test_unlocked_at is not null then
    raise exception using errcode = 'P7606', message = 'gold-standard import is forbidden after the held-out test split is unlocked';
  end if;
  if exists (
    select 1 from public.literature_gold_review_operations operation
    where operation.batch_id = p_batch_id and operation.status = 'started'
  ) then
    raise exception using errcode = 'P7604', message = 'the batch has a started operation that requires explicit recovery';
  end if;

  perform item.id
  from public.literature_gold_set_items as item
  where item.batch_id = p_batch_id
    and item.dataset_split = 'development'
  order by item.display_order, item.id
  for update;

  development_membership_hash :=
    public.literature_gold_development_membership_hash_v1(p_batch_id);
  if p_plan #>> '{scope,developmentMembershipSha256}'
      is distinct from development_membership_hash
    or planned_action_count is distinct from (
      select count(*)::integer
      from public.literature_gold_set_items as item
      where item.batch_id = p_batch_id
        and item.dataset_split = 'development'
    ) then
    raise exception using
      errcode = 'P7606',
      message = 'import actions must cover the exact checksum-bound development membership';
  end if;

  pre_physical_hash := public.literature_gold_physical_state_hash_v1(p_batch_id, 'development');
  pre_effective_hash := public.literature_gold_effective_state_hash_v1(p_batch_id, 'development');
  expected_post_effective_hash := p_authorization ->> 'expectedPostEffectiveStateSha256';
  if p_plan ->> 'expectedPhysicalStateSha256' is distinct from pre_physical_hash
    or p_plan ->> 'expectedEffectiveStateSha256' is distinct from pre_effective_hash
    or p_authorization ->> 'expectedPhysicalStateSha256' is distinct from pre_physical_hash
    or p_authorization ->> 'expectedEffectiveStateSha256' is distinct from pre_effective_hash
    or expected_post_effective_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = 'P7607', message = 'import authorization pre-state or expected effective post-state does not match the database';
  end if;

  fault_after_action := nullif(p_plan ->> 'faultAfterAction', '')::integer;
  if fault_after_action is not null
    and fault_after_action not between 1 and planned_action_count then
    raise exception using errcode = 'P7605', message = 'faultAfterAction must identify a planned action';
  end if;

  insert into public.literature_gold_review_operations (
    id, batch_id, operation_kind, idempotency_key, artifact_sha256,
    plan_sha256, plan, authorization_sha256, authorization_payload,
    actor_user_id, actor_email, planned_action_count, planned_apply_count,
    planned_noop_count, pre_physical_state_sha256, pre_effective_state_sha256
  ) values (
    p_operation_id, p_batch_id, 'import', normalized_key, p_artifact_sha256,
    p_plan_sha256, p_plan, p_authorization_sha256, p_authorization,
    p_actor_user_id, normalized_email, planned_action_count, planned_apply_count,
    planned_noop_count, pre_physical_hash, pre_effective_hash
  );

  insert into public.literature_gold_review_operation_actions (
    id, operation_id, action_sequence, item_id, pmid, action_kind,
    planned_review_id, pre_current_review_id, pre_effective_review_id,
    expected_revision, expected_supersedes_review_id, planned_state
  )
  select
    (planned.value ->> 'actionId')::uuid,
    p_operation_id,
    (planned.value ->> 'sequence')::integer,
    (planned.value ->> 'itemId')::uuid,
    planned.value ->> 'pmid',
    planned.value ->> 'action',
    nullif(planned.value ->> 'importedReviewId', '')::uuid,
    nullif(planned.value ->> 'expectedCurrentReviewId', '')::uuid,
    nullif(planned.value ->> 'expectedEffectiveReviewId', '')::uuid,
    nullif(planned.value ->> 'expectedRevision', '')::integer,
    nullif(planned.value ->> 'expectedSupersedesReviewId', '')::uuid,
    planned.value
  from jsonb_array_elements(p_plan -> 'actions') as planned(value);

  insert into public.literature_gold_set_events (
    batch_id, actor_user_id, actor_email, event_type, after_value,
    operation_id, operation_event_sequence
  ) values (
    p_batch_id, p_actor_user_id, normalized_email, 'import_started',
    jsonb_build_object(
      'operationId', p_operation_id,
      'artifactSha256', p_artifact_sha256,
      'planSha256', p_plan_sha256,
      'authorizationSha256', p_authorization_sha256,
      'plannedActionCount', planned_action_count,
      'prePhysicalStateSha256', pre_physical_hash,
      'preEffectiveStateSha256', pre_effective_hash
    ),
    p_operation_id, 1
  );

  begin
    perform item.id
    from public.literature_gold_set_items as item
    join jsonb_array_elements(p_plan -> 'actions') as planned(value)
      on item.id = (planned.value ->> 'itemId')::uuid
    order by item.display_order, item.id
    for update of item;

    for action_json in
      select value
      from jsonb_array_elements(p_plan -> 'actions')
      order by (value ->> 'sequence')::integer
    loop
      select * into action_row
      from public.literature_gold_review_operation_actions as action
      where action.id = (action_json ->> 'actionId')::uuid
        and action.operation_id = p_operation_id;

      select * into locked_item
      from public.literature_gold_set_items as item
      where item.id = action_row.item_id;

      if locked_item.dataset_split <> 'development' or locked_item.batch_id <> p_batch_id then
        raise exception using errcode = 'P7610', message = 'import action target left the authorized development batch';
      end if;

      select * into head_review
      from public.literature_gold_set_reviews as review
      where review.id = locked_item.current_review_id
        and review.item_id = locked_item.id;
      if found and head_review.lifecycle_state = 'effective' then
        actual_effective_review_id := coalesce(head_review.effective_source_review_id, head_review.id);
      else
        actual_effective_review_id := null;
      end if;

      expected_current_review_id := nullif(action_json ->> 'expectedCurrentReviewId', '')::uuid;
      expected_effective_review_id := nullif(action_json ->> 'expectedEffectiveReviewId', '')::uuid;
      if locked_item.current_review_id is distinct from expected_current_review_id
        or actual_effective_review_id is distinct from expected_effective_review_id
        or action_json #>> '{preImportItemState,reviewStatus}'
          is distinct from locked_item.review_status
        or nullif(action_json #>> '{preImportItemState,startedAt}', '')::timestamptz
          is distinct from locked_item.started_at
        or nullif(action_json #>> '{preImportItemState,completedAt}', '')::timestamptz
          is distinct from locked_item.completed_at
        or nullif(action_json #>> '{preImportItemState,supplementalMetadataRevealedAt}', '')::timestamptz
          is distinct from locked_item.supplemental_metadata_revealed_at
        or nullif(action_json #>> '{preImportItemState,automatedSignalsRevealedAt}', '')::timestamptz
          is distinct from locked_item.automated_signals_revealed_at then
        raise exception using errcode = 'P7611', message = 'import action pre-state review identity drifted from the checksum-bound plan';
      end if;
      perform public.assert_literature_gold_review_chain_head_v1(locked_item.id);

      if exists (
        select 1
        from public.literature_gold_set_review_drafts as draft
        where draft.item_id = locked_item.id
      ) then
        raise exception using
          errcode = 'P7612',
          message = 'an import cannot overwrite or ignore an unplanned review draft';
      end if;

      if action_row.action_kind = 'import_noop' then
        current_effective_payload :=
          public.literature_gold_review_clinical_projection_v1(actual_effective_review_id);

        if nullif(action_json ->> 'expectedHeadReviewIdAfter', '')::uuid
            is distinct from locked_item.current_review_id
          or nullif(action_json ->> 'expectedEffectiveReviewIdAfter', '')::uuid
            is distinct from actual_effective_review_id
          or action_json -> 'expectedEventSequence' is distinct from '[]'::jsonb
          or action_json -> 'candidateReview' is distinct from
            coalesce(current_effective_payload, 'null'::jsonb)
          or action_json ->> 'candidateReviewSha256' is distinct from
            public.literature_gold_jsonb_sha256_v1(
              coalesce(current_effective_payload, 'null'::jsonb)
            ) then
          raise exception using errcode = 'P7612', message = 'import no-op post-state or event contract is invalid';
        end if;
        update public.literature_gold_review_operation_actions
        set action_status = 'noop', processed_at = now(), result_state = jsonb_build_object(
          'currentReviewId', locked_item.current_review_id,
          'effectiveReviewId', actual_effective_review_id
        )
        where id = action_row.id;
        noop_count := noop_count + 1;
      else
        review_json := action_json -> 'review';
        if review_json is null or jsonb_typeof(review_json) <> 'object'
          or jsonb_typeof(review_json -> 'topicIds') <> 'array'
          or jsonb_typeof(review_json -> 'technologyTags') <> 'array'
          or jsonb_typeof(review_json -> 'clinicalPurposes') <> 'array'
          or jsonb_typeof(review_json -> 'diseaseTags') <> 'array' then
          raise exception using errcode = 'P7612', message = 'applied import actions require a complete review payload';
        end if;

        perform public.validate_literature_gold_import_review_payload_v1(
          locked_item.id,
          review_json,
          actual_effective_review_id is null
        );

        expected_revision := (action_json ->> 'expectedRevision')::integer;
        expected_supersedes_review_id := nullif(action_json ->> 'expectedSupersedesReviewId', '')::uuid;
        if expected_supersedes_review_id is distinct from locked_item.current_review_id
          or expected_revision is distinct from coalesce(head_review.revision, 0) + 1
          or (action_row.action_kind = 'import_initial' and locked_item.current_review_id is not null)
          or (action_row.action_kind = 'import_revision' and locked_item.current_review_id is null)
          or action_json ->> 'expectedHeadReviewIdAfter'
            is distinct from action_row.planned_review_id::text
          or action_json ->> 'expectedEffectiveReviewIdAfter'
            is distinct from action_row.planned_review_id::text
          or action_json -> 'expectedEventSequence'
            is distinct from '["review_imported"]'::jsonb
          or action_json ->> 'reviewSha256'
            is distinct from public.literature_gold_jsonb_sha256_v1(review_json) then
          raise exception using errcode = 'P7613', message = 'import action kind or expected chain position does not match the current head';
        end if;

        insert into public.literature_gold_set_reviews (
          id, item_id, revision, supersedes_review_id, reviewer_user_id,
          reviewer_email, relevance_label, metadata_sufficiency,
          reviewer_confidence, topic_ids, technology_tags, clinical_purposes,
          disease_tags, study_design, publication_status,
          categorization_from_full_text, notes, used_supplemental_metadata,
          review_seconds, is_blinded, started_at, completed_at, created_at,
          technology_tag_status, disease_tag_status, taxonomy_version,
          label_schema_version, enrichment_schema_version, enrichment_provenance,
          revision_kind, lifecycle_state, operation_action_id
        ) values (
          action_row.planned_review_id,
          locked_item.id,
          expected_revision,
          expected_supersedes_review_id,
          nullif(review_json ->> 'reviewerUserId', '')::uuid,
          nullif(trim(coalesce(review_json ->> 'reviewerEmail', '')), ''),
          review_json ->> 'relevanceLabel',
          review_json ->> 'metadataSufficiency',
          review_json ->> 'reviewerConfidence',
          array(select jsonb_array_elements_text(review_json -> 'topicIds')),
          array(select jsonb_array_elements_text(review_json -> 'technologyTags')),
          array(select jsonb_array_elements_text(review_json -> 'clinicalPurposes')),
          array(select jsonb_array_elements_text(review_json -> 'diseaseTags')),
          nullif(review_json ->> 'studyDesign', ''),
          nullif(review_json ->> 'publicationStatus', ''),
          coalesce((review_json ->> 'categorizationFromFullText')::boolean, false),
          coalesce(review_json ->> 'notes', ''),
          coalesce((review_json ->> 'usedSupplementalMetadata')::boolean, false),
          coalesce((review_json ->> 'reviewSeconds')::integer, 0),
          (review_json ->> 'isBlinded')::boolean,
          (review_json ->> 'startedAt')::timestamptz,
          (review_json ->> 'completedAt')::timestamptz,
          (review_json ->> 'createdAt')::timestamptz,
          review_json ->> 'technologyTagStatus',
          review_json ->> 'diseaseTagStatus',
          review_json ->> 'taxonomyVersion',
          review_json ->> 'labelSchemaVersion',
          review_json ->> 'enrichmentSchemaVersion',
          review_json ->> 'enrichmentProvenance',
          'import', 'effective', action_row.id
        ) returning * into created_review;

        update public.literature_gold_set_items
        set review_status = 'completed', current_review_id = created_review.id,
          started_at = coalesce(started_at, created_review.started_at),
          completed_at = created_review.completed_at
        where id = locked_item.id;

        update public.literature_gold_review_operation_actions
        set action_status = 'applied', result_review_id = created_review.id,
          processed_at = now(), result_state = jsonb_build_object(
            'reviewId', created_review.id,
            'revision', created_review.revision,
            'supersedesReviewId', created_review.supersedes_review_id,
            'currentReviewId', created_review.id,
            'effectiveReviewId', created_review.id
          )
        where id = action_row.id;

        insert into public.literature_gold_set_events (
          batch_id, item_id, actor_user_id, actor_email, event_type,
          before_value, after_value, operation_id, operation_action_id,
          operation_event_sequence
        ) values (
          p_batch_id, locked_item.id, p_actor_user_id, normalized_email,
          'review_imported',
          jsonb_build_object(
            'currentReviewId', locked_item.current_review_id,
            'effectiveReviewId', actual_effective_review_id
          ),
          jsonb_build_object(
            'reviewId', created_review.id,
            'revision', created_review.revision,
            'revisionKind', 'import',
            'lifecycleState', 'effective'
          ),
          p_operation_id, action_row.id, action_row.action_sequence + 1
        );
        applied_count := applied_count + 1;
      end if;

      if fault_after_action = action_row.action_sequence then
        raise exception using
          errcode = 'P7699',
          message = format('controlled import rehearsal fault after action %s', fault_after_action);
      end if;
    end loop;

    if applied_count <> planned_apply_count or noop_count <> planned_noop_count then
      raise exception using errcode = 'P7614', message = 'import action outcomes do not match planned counts';
    end if;

    for action_row in
      select action.*
      from public.literature_gold_review_operation_actions as action
      where action.operation_id = p_operation_id
      order by action.item_id
    loop
      perform public.assert_literature_gold_review_chain_head_v1(action_row.item_id);
    end loop;

    post_effective_hash := public.literature_gold_effective_state_hash_v1(p_batch_id, 'development');
    if post_effective_hash is distinct from expected_post_effective_hash then
      raise exception using errcode = 'P7615', message = 'import effective post-state hash does not match its authorization';
    end if;

    update public.literature_gold_review_operations
    set status = 'completed', applied_action_count = applied_count,
      noop_action_count = noop_count, completed_at = now()
    where id = p_operation_id;

    insert into public.literature_gold_set_events (
      batch_id, actor_user_id, actor_email, event_type, after_value,
      operation_id, operation_event_sequence
    ) values (
      p_batch_id, p_actor_user_id, normalized_email, 'import_completed',
      jsonb_build_object(
        'operationId', p_operation_id,
        'appliedActionCount', applied_count,
        'noopActionCount', noop_count,
        'postEffectiveStateSha256', post_effective_hash
      ),
      p_operation_id, planned_action_count + 2
    );

    post_physical_hash := public.literature_gold_physical_state_hash_v1(p_batch_id, 'development');
    update public.literature_gold_review_operations
    set post_physical_state_sha256 = post_physical_hash,
      post_effective_state_sha256 = post_effective_hash
    where id = p_operation_id;
  exception when others then
    get stacked diagnostics
      caught_sqlstate = returned_sqlstate,
      caught_message = message_text;

    update public.literature_gold_review_operation_actions
    set action_status = 'failed', processed_at = now(), result_state = jsonb_build_object(
      'errorSqlstate', caught_sqlstate,
      'errorMessage', left(caught_message, 4000)
    )
    where operation_id = p_operation_id and action_status = 'planned';

    update public.literature_gold_review_operations
    set status = 'failed', applied_action_count = 0, noop_action_count = 0,
      error_sqlstate = caught_sqlstate, error_message = left(caught_message, 4000),
      completed_at = now()
    where id = p_operation_id;

    insert into public.literature_gold_set_events (
      batch_id, actor_user_id, actor_email, event_type, after_value,
      operation_id, operation_event_sequence
    ) values (
      p_batch_id, p_actor_user_id, normalized_email, 'import_failed',
      jsonb_build_object(
        'operationId', p_operation_id,
        'errorSqlstate', caught_sqlstate,
        'errorMessage', left(caught_message, 4000),
        'reviewAndPointerMutationsCommitted', false
      ),
      p_operation_id, planned_action_count + 2
    );

    post_effective_hash := public.literature_gold_effective_state_hash_v1(p_batch_id, 'development');
    if post_effective_hash is distinct from pre_effective_hash then
      raise exception using
        errcode = 'P7698',
        message = format(
          'failed import changed effective state after rollback; original SQLSTATE %s: %s',
          caught_sqlstate,
          left(caught_message, 3500)
        );
    end if;
    post_physical_hash := public.literature_gold_physical_state_hash_v1(p_batch_id, 'development');
    update public.literature_gold_review_operations
    set post_physical_state_sha256 = post_physical_hash,
      post_effective_state_sha256 = post_effective_hash
    where id = p_operation_id;

    return public.literature_gold_review_operation_receipt_v1(p_operation_id, false);
  end;

  return public.literature_gold_review_operation_receipt_v1(p_operation_id, false);
end;
$$;

revoke all on function public.apply_literature_gold_import_v1(
  uuid, text, uuid, text, text, jsonb, text, jsonb, uuid, text
) from public, anon, authenticated;
grant execute on function public.apply_literature_gold_import_v1(
  uuid, text, uuid, text, text, jsonb, text, jsonb, uuid, text
) to service_role;

create or replace function public.compensate_literature_gold_import_v1(
  p_operation_id uuid,
  p_target_import_operation_id uuid,
  p_idempotency_key text,
  p_batch_id uuid,
  p_artifact_sha256 text,
  p_plan_sha256 text,
  p_plan jsonb,
  p_authorization_sha256 text,
  p_authorization jsonb,
  p_actor_user_id uuid default null,
  p_actor_email text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  normalized_key text := nullif(trim(coalesce(p_idempotency_key, '')), '');
  normalized_email text := nullif(trim(coalesce(p_actor_email, '')), '');
  existing_operation public.literature_gold_review_operations%rowtype;
  target_import public.literature_gold_review_operations%rowtype;
  locked_batch public.literature_gold_set_batches%rowtype;
  action_json jsonb;
  action_row public.literature_gold_review_operation_actions%rowtype;
  source_action public.literature_gold_review_operation_actions%rowtype;
  locked_item public.literature_gold_set_items%rowtype;
  imported_review public.literature_gold_set_reviews%rowtype;
  source_review public.literature_gold_set_reviews%rowtype;
  created_review public.literature_gold_set_reviews%rowtype;
  current_effective_review_id uuid;
  planned_action_count integer;
  planned_restored_count integer;
  planned_voided_count integer;
  planned_apply_count integer;
  planned_noop_count integer;
  applied_count integer := 0;
  noop_count integer := 0;
  pre_physical_hash text;
  pre_effective_hash text;
  post_physical_hash text;
  post_effective_hash text;
  expected_post_effective_hash text;
  development_membership_hash text;
  fault_after_action integer;
  restored_status text;
  restored_started_at timestamptz;
  restored_completed_at timestamptz;
  restored_supplemental_at timestamptz;
  restored_automated_at timestamptz;
  caught_sqlstate text;
  caught_message text;
begin
  if p_operation_id is null or p_target_import_operation_id is null or p_batch_id is null then
    raise exception using errcode = 'P7620', message = 'compensation, target import, and batch identities are required';
  end if;
  if p_operation_id = p_target_import_operation_id then
    raise exception using errcode = 'P7620', message = 'a compensation operation cannot target itself';
  end if;
  if normalized_key !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = 'P7620', message = 'a canonical lowercase SHA-256 compensation idempotency key is required';
  end if;
  if p_actor_user_id is null and normalized_email is null then
    raise exception using errcode = 'P7620', message = 'a compensation actor is required';
  end if;
  if p_artifact_sha256 !~ '^[a-f0-9]{64}$'
    or p_plan_sha256 !~ '^[a-f0-9]{64}$'
    or p_authorization_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = 'P7620', message = 'compensation checksums must be lowercase SHA-256 values';
  end if;
  if p_plan is null or jsonb_typeof(p_plan) <> 'object'
    or jsonb_typeof(p_plan -> 'actions') <> 'array'
    or p_authorization is null or jsonb_typeof(p_authorization) <> 'object' then
    raise exception using errcode = 'P7620', message = 'compensation plan and authorization must be JSON objects with an actions array';
  end if;
  perform public.assert_literature_gold_jsonb_object_v1(
    p_plan,
    array[
      'contractVersion', 'kind', 'operationId', 'targetImportOperationId', 'batchId',
      'importPlanSha256', 'importReceiptSha256', 'sourceArtifactSha256',
      'expectedPhysicalStateSha256', 'expectedEffectiveStateSha256',
      'expectedPostEffectiveStateSha256', 'executionContext', 'scope', 'counts',
      'actions', 'faultAfterAction', 'binding'
    ],
    array[
      'contractVersion', 'kind', 'operationId', 'targetImportOperationId', 'batchId',
      'importPlanSha256', 'importReceiptSha256', 'sourceArtifactSha256',
      'expectedPhysicalStateSha256', 'expectedEffectiveStateSha256',
      'expectedPostEffectiveStateSha256', 'executionContext', 'scope', 'counts',
      'actions', 'binding'
    ],
    'compensation plan'
  );
  perform public.assert_literature_gold_jsonb_object_v1(
    p_plan -> 'executionContext',
    array[
      'targetDatabase', 'remoteWritesAllowed', 'repositoryCommitSha', 'migrationId',
      'importRpc', 'compensationRpc', 'reconciliationRpc', 'developmentMembershipHash',
      'physicalStateHash', 'effectiveStateHash'
    ],
    array[
      'targetDatabase', 'remoteWritesAllowed', 'repositoryCommitSha', 'migrationId',
      'importRpc', 'compensationRpc', 'reconciliationRpc', 'developmentMembershipHash',
      'physicalStateHash', 'effectiveStateHash'
    ],
    'compensation execution context'
  );
  perform public.assert_literature_gold_jsonb_object_v1(
    p_plan -> 'scope',
    array['datasetSplit', 'heldOutIdentitiesAccessed', 'developmentMembershipSha256'],
    array['datasetSplit', 'heldOutIdentitiesAccessed', 'developmentMembershipSha256'],
    'compensation scope'
  );
  perform public.assert_literature_gold_jsonb_object_v1(
    p_plan -> 'counts',
    array['total', 'restored', 'voided', 'noops'],
    array['total', 'restored', 'voided', 'noops'],
    'compensation counts'
  );
  perform public.assert_literature_gold_jsonb_object_v1(
    p_plan -> 'binding',
    array['contentSha256', 'idempotencyKey'],
    array['contentSha256', 'idempotencyKey'],
    'compensation plan binding'
  );
  perform public.assert_literature_gold_jsonb_object_v1(
    p_authorization,
    array[
      'contractVersion', 'kind', 'authorizationId', 'authorized', 'authorizedBy',
      'authorizedAt', 'authorizationNote', 'targetDatabase', 'remoteWritesAllowed',
      'repositoryCommitSha', 'migrationId', 'operationId', 'targetImportOperationId',
      'batchId', 'planSha256', 'idempotencyKey', 'importReceiptSha256',
      'sourceArtifactSha256', 'expectedPhysicalStateSha256',
      'expectedEffectiveStateSha256', 'expectedPostEffectiveStateSha256', 'binding'
    ],
    array[
      'contractVersion', 'kind', 'authorizationId', 'authorized', 'authorizedBy',
      'authorizedAt', 'authorizationNote', 'targetDatabase', 'remoteWritesAllowed',
      'repositoryCommitSha', 'migrationId', 'operationId', 'targetImportOperationId',
      'batchId', 'planSha256', 'idempotencyKey', 'importReceiptSha256',
      'sourceArtifactSha256', 'expectedPhysicalStateSha256',
      'expectedEffectiveStateSha256', 'expectedPostEffectiveStateSha256', 'binding'
    ],
    'compensation authorization'
  );
  perform public.assert_literature_gold_jsonb_object_v1(
    p_authorization -> 'binding',
    array['contentSha256'], array['contentSha256'], 'compensation authorization binding'
  );
  if exists (
      select 1 from unnest(array[
        'contractVersion','kind','operationId','targetImportOperationId','batchId',
        'importPlanSha256','importReceiptSha256','sourceArtifactSha256',
        'expectedPhysicalStateSha256','expectedEffectiveStateSha256',
        'expectedPostEffectiveStateSha256'
      ]) field where jsonb_typeof(p_plan -> field) is distinct from 'string'
    )
    or exists (
      select 1 from unnest(array[
        'targetDatabase','repositoryCommitSha','migrationId','importRpc',
        'compensationRpc','reconciliationRpc','developmentMembershipHash',
        'physicalStateHash','effectiveStateHash'
      ]) field where jsonb_typeof(p_plan -> 'executionContext' -> field) is distinct from 'string'
    )
    or exists (
      select 1 from unnest(array['datasetSplit','developmentMembershipSha256']) field
      where jsonb_typeof(p_plan -> 'scope' -> field) is distinct from 'string'
    )
    or exists (
      select 1 from unnest(array[
        'contractVersion','kind','authorizationId','authorizedBy','authorizedAt',
        'authorizationNote','targetDatabase','repositoryCommitSha','migrationId',
        'operationId','targetImportOperationId','batchId','planSha256','idempotencyKey',
        'importReceiptSha256','sourceArtifactSha256','expectedPhysicalStateSha256',
        'expectedEffectiveStateSha256','expectedPostEffectiveStateSha256'
      ]) field where jsonb_typeof(p_authorization -> field) is distinct from 'string'
    )
    or p_plan ->> 'operationId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or p_plan ->> 'targetImportOperationId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or p_plan ->> 'batchId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or p_plan ->> 'importPlanSha256' !~ '^[a-f0-9]{64}$'
    or p_plan ->> 'importReceiptSha256' !~ '^[a-f0-9]{64}$'
    or p_plan ->> 'expectedPhysicalStateSha256' !~ '^[a-f0-9]{64}$'
    or p_plan ->> 'expectedEffectiveStateSha256' !~ '^[a-f0-9]{64}$'
    or p_plan ->> 'expectedPostEffectiveStateSha256' !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_plan #> '{binding,contentSha256}') is distinct from 'string'
    or jsonb_typeof(p_plan #> '{binding,idempotencyKey}') is distinct from 'string'
    or jsonb_typeof(p_plan #> '{executionContext,remoteWritesAllowed}') <> 'boolean'
    or jsonb_typeof(p_plan #> '{scope,heldOutIdentitiesAccessed}') <> 'boolean'
    or p_plan #>> '{binding,contentSha256}' !~ '^[a-f0-9]{64}$'
    or p_plan #>> '{binding,idempotencyKey}' !~ '^[a-f0-9]{64}$'
    or exists (
      select 1 from jsonb_each(p_plan -> 'counts') field
      where jsonb_typeof(field.value) <> 'number'
        or field.value #>> '{}' !~ '^(0|[1-9][0-9]*)$'
    )
    or (p_plan ? 'faultAfterAction' and (
      jsonb_typeof(p_plan -> 'faultAfterAction') <> 'number'
      or p_plan ->> 'faultAfterAction' !~ '^[1-9][0-9]*$'
    ))
    or p_authorization ->> 'authorizationId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(p_authorization -> 'authorized') <> 'boolean'
    or jsonb_typeof(p_authorization -> 'authorizedBy') <> 'string'
    or length(trim(p_authorization ->> 'authorizedBy')) not between 1 and 320
    or jsonb_typeof(p_authorization -> 'authorizedAt') <> 'string'
    or not public.literature_gold_is_timestamptz_v1(p_authorization ->> 'authorizedAt')
    or jsonb_typeof(p_authorization -> 'authorizationNote') <> 'string'
    or length(trim(p_authorization ->> 'authorizationNote')) not between 5 and 2000
    or jsonb_typeof(p_authorization -> 'remoteWritesAllowed') <> 'boolean'
    or p_authorization ->> 'operationId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or p_authorization ->> 'targetImportOperationId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or p_authorization ->> 'batchId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or p_authorization ->> 'planSha256' !~ '^[a-f0-9]{64}$'
    or p_authorization ->> 'idempotencyKey' !~ '^[a-f0-9]{64}$'
    or p_authorization ->> 'importReceiptSha256' !~ '^[a-f0-9]{64}$'
    or p_authorization ->> 'sourceArtifactSha256' !~ '^[a-f0-9]{64}$'
    or p_authorization ->> 'expectedPhysicalStateSha256' !~ '^[a-f0-9]{64}$'
    or p_authorization ->> 'expectedEffectiveStateSha256' !~ '^[a-f0-9]{64}$'
    or p_authorization ->> 'expectedPostEffectiveStateSha256' !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_authorization #> '{binding,contentSha256}') is distinct from 'string'
    or p_authorization #>> '{binding,contentSha256}' !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = 'P7621', message = 'compensation plan or authorization has null, malformed, or incorrectly typed contract fields';
  end if;
  if public.literature_gold_jsonb_sha256_v1(p_plan - 'binding') is distinct from p_plan_sha256
    or p_plan #>> '{binding,contentSha256}' is distinct from p_plan_sha256
    or p_plan #>> '{binding,idempotencyKey}' is distinct from normalized_key
    or normalized_key is distinct from public.literature_gold_jsonb_sha256_v1(
      jsonb_build_object(
        'contractVersion', 'gold-review-import-compensation/1.0.0',
        'kind', 'compensation',
        'operationId', p_operation_id,
        'contentSha256', p_plan_sha256
      )
    ) then
    raise exception using errcode = 'P7621', message = 'compensation plan checksum does not match its canonical JSON payload';
  end if;
  if public.literature_gold_jsonb_sha256_v1(p_authorization - 'binding')
      is distinct from p_authorization_sha256
    or p_authorization #>> '{binding,contentSha256}' is distinct from p_authorization_sha256 then
    raise exception using errcode = 'P7621', message = 'compensation authorization checksum does not match its canonical JSON payload';
  end if;
  if p_plan ->> 'contractVersion'
      is distinct from 'gold-review-import-compensation/1.0.0'
    or p_plan ->> 'kind' is distinct from 'compensation'
    or p_plan ->> 'operationId' is distinct from p_operation_id::text
    or p_plan ->> 'targetImportOperationId' is distinct from p_target_import_operation_id::text
    or p_plan ->> 'batchId' is distinct from p_batch_id::text
    or p_plan #>> '{scope,datasetSplit}' is distinct from 'development'
    or (p_plan #>> '{scope,heldOutIdentitiesAccessed}')::boolean is distinct from false
    or p_plan #>> '{executionContext,targetDatabase}' is distinct from 'local'
    or (p_plan #>> '{executionContext,remoteWritesAllowed}')::boolean is distinct from false
    or p_plan #>> '{executionContext,migrationId}'
      is distinct from '20260808035633_add_literature_gold_import_compensation_contract'
    or p_plan #>> '{executionContext,compensationRpc}'
      is distinct from 'compensate_literature_gold_import_v1'
    or p_plan #>> '{executionContext,importRpc}'
      is distinct from 'apply_literature_gold_import_v1'
    or p_plan #>> '{executionContext,reconciliationRpc}'
      is distinct from 'reconcile_literature_gold_review_operation_v1'
    or p_plan #>> '{executionContext,developmentMembershipHash}'
      is distinct from 'literature_gold_development_membership_hash_v1'
    or p_plan #>> '{executionContext,physicalStateHash}'
      is distinct from 'literature_gold_physical_state_hash_v1'
    or p_plan #>> '{executionContext,effectiveStateHash}'
      is distinct from 'literature_gold_effective_state_hash_v1'
    or p_plan #>> '{executionContext,repositoryCommitSha}' !~ '^[a-f0-9]{40}$'
    or p_plan ->> 'sourceArtifactSha256' is distinct from p_artifact_sha256
    or p_authorization ->> 'contractVersion'
      is distinct from 'gold-review-import-compensation/1.0.0'
    or p_authorization ->> 'kind' is distinct from 'compensation_authorization'
    or (p_authorization ->> 'authorized')::boolean is distinct from true
    or p_authorization ->> 'operationId' is distinct from p_operation_id::text
    or p_authorization ->> 'targetImportOperationId' is distinct from p_target_import_operation_id::text
    or p_authorization ->> 'batchId' is distinct from p_batch_id::text
    or p_authorization ->> 'targetDatabase' is distinct from 'local'
    or (p_authorization ->> 'remoteWritesAllowed')::boolean is distinct from false
    or p_authorization ->> 'repositoryCommitSha'
      is distinct from p_plan #>> '{executionContext,repositoryCommitSha}'
    or p_authorization ->> 'migrationId'
      is distinct from p_plan #>> '{executionContext,migrationId}'
    or p_authorization ->> 'sourceArtifactSha256' is distinct from p_artifact_sha256
    or p_authorization ->> 'planSha256' is distinct from p_plan_sha256
    or p_authorization ->> 'idempotencyKey' is distinct from normalized_key
    or p_authorization ->> 'importReceiptSha256'
      is distinct from p_plan ->> 'importReceiptSha256'
    or p_authorization ->> 'expectedPhysicalStateSha256'
      is distinct from p_plan ->> 'expectedPhysicalStateSha256'
    or p_authorization ->> 'expectedEffectiveStateSha256'
      is distinct from p_plan ->> 'expectedEffectiveStateSha256'
    or p_authorization ->> 'expectedPostEffectiveStateSha256'
      is distinct from p_plan ->> 'expectedPostEffectiveStateSha256' then
    raise exception using errcode = 'P7621', message = 'compensation plan or authorization is not bound to this exact operation, target import, artifact, batch, and development split';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(least(p_operation_id::text, 'compensation:' || normalized_key), 0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(p_operation_id::text, 'compensation:' || normalized_key), 0));

  select * into existing_operation
  from public.literature_gold_review_operations as operation
  where operation.id = p_operation_id
     or (operation.operation_kind = 'compensation' and operation.idempotency_key = normalized_key)
  order by case when operation.id = p_operation_id then 0 else 1 end
  limit 1
  for update;

  if found then
    if existing_operation.id is distinct from p_operation_id
      or existing_operation.operation_kind <> 'compensation'
      or existing_operation.target_import_operation_id is distinct from p_target_import_operation_id
      or existing_operation.idempotency_key is distinct from normalized_key
      or existing_operation.batch_id is distinct from p_batch_id
      or existing_operation.artifact_sha256 is distinct from p_artifact_sha256
      or existing_operation.plan_sha256 is distinct from p_plan_sha256
      or existing_operation.plan is distinct from p_plan
      or existing_operation.authorization_sha256 is distinct from p_authorization_sha256
      or existing_operation.authorization_payload is distinct from p_authorization then
      raise exception using errcode = 'P7622', message = 'idempotency identity was reused with different compensation inputs';
    end if;
    if existing_operation.status = 'started' then
      raise exception using errcode = 'P7623', message = 'an existing started compensation requires explicit recovery authorization';
    end if;
    return public.literature_gold_review_operation_receipt_v1(existing_operation.id, true);
  end if;

  select * into target_import
  from public.literature_gold_review_operations as operation
  where operation.id = p_target_import_operation_id
  for update;

  if not found or target_import.operation_kind <> 'import'
    or target_import.status <> 'completed'
    or target_import.batch_id is distinct from p_batch_id
    or target_import.dataset_split <> 'development'
    or target_import.post_physical_state_sha256 is null
    or target_import.post_effective_state_sha256 is null then
    raise exception using errcode = 'P7624', message = 'compensation requires a sealed completed development import in the same batch';
  end if;
  if target_import.artifact_sha256 is distinct from p_artifact_sha256
    or p_plan ->> 'importPlanSha256' is distinct from target_import.plan_sha256
    or p_plan ->> 'importReceiptSha256' is distinct from (
      public.literature_gold_review_operation_receipt_v1(
        p_target_import_operation_id,
        false
      ) #>> '{binding,contentSha256}'
    ) then
    raise exception using errcode = 'P7624', message = 'compensation is not bound to the sealed target import plan, receipt, and artifact';
  end if;

  if exists (
    select 1
    from public.literature_gold_review_operations as prior_compensation
    where prior_compensation.target_import_operation_id = p_target_import_operation_id
      and prior_compensation.operation_kind = 'compensation'
      and prior_compensation.status in ('started', 'completed')
  ) then
    raise exception using errcode = 'P7625', message = 'the target import already has an active or completed compensation';
  end if;

  planned_action_count := jsonb_array_length(p_plan -> 'actions');
  select
    count(*) filter (where value ->> 'action' = 'compensate_restore')::integer,
    count(*) filter (where value ->> 'action' = 'compensate_void')::integer,
    count(*) filter (where value ->> 'action' in ('compensate_restore', 'compensate_void'))::integer,
    count(*) filter (where value ->> 'action' = 'compensate_noop')::integer
  into planned_restored_count, planned_voided_count, planned_apply_count, planned_noop_count
  from jsonb_array_elements(p_plan -> 'actions');

  if planned_action_count <> target_import.planned_action_count
    or planned_action_count < 1
    or planned_apply_count + planned_noop_count <> planned_action_count
    or (p_plan #>> '{counts,total}')::integer is distinct from planned_action_count
    or (p_plan #>> '{counts,restored}')::integer is distinct from planned_restored_count
    or (p_plan #>> '{counts,voided}')::integer is distinct from planned_voided_count
    or (p_plan #>> '{counts,noops}')::integer is distinct from planned_noop_count then
    raise exception using errcode = 'P7626', message = 'compensation must account exactly once for every target import action';
  end if;

  for action_json in select value from jsonb_array_elements(p_plan -> 'actions') loop
    perform public.assert_literature_gold_jsonb_object_v1(
      action_json,
      array[
        'actionId', 'sourceActionId', 'sequence', 'itemId', 'pmid', 'datasetSplit',
        'importedReviewId', 'expectedCurrentReviewId', 'expectedEffectiveReviewId',
        'action', 'expectedRevision', 'expectedSupersedesReviewId',
        'compensationReviewId', 'effectiveSourceReviewId', 'expectedHeadReviewIdAfter',
        'expectedEffectiveReviewIdAfter', 'expectedEventSequence'
      ],
      array[
        'actionId', 'sourceActionId', 'sequence', 'itemId', 'pmid', 'datasetSplit',
        'importedReviewId', 'expectedCurrentReviewId', 'expectedEffectiveReviewId',
        'action', 'expectedRevision', 'expectedSupersedesReviewId',
        'compensationReviewId', 'effectiveSourceReviewId', 'expectedHeadReviewIdAfter',
        'expectedEffectiveReviewIdAfter', 'expectedEventSequence'
      ],
      'compensation action'
    );
    if exists (
        select 1 from unnest(array[
          'actionId','sourceActionId','itemId','pmid','datasetSplit','action'
        ]) field where jsonb_typeof(action_json -> field) is distinct from 'string'
      )
      or action_json ->> 'actionId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or action_json ->> 'sourceActionId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(action_json -> 'sequence') <> 'number'
      or action_json ->> 'sequence' !~ '^[1-9][0-9]*$'
      or action_json ->> 'itemId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or action_json ->> 'pmid' !~ '^[0-9]{1,12}$'
      or jsonb_typeof(action_json -> 'expectedEventSequence') <> 'array'
      or exists (select 1 from jsonb_array_elements(action_json -> 'expectedEventSequence') element where jsonb_typeof(element) <> 'string')
      or exists (
        select 1 from unnest(array[
          'importedReviewId','expectedCurrentReviewId','expectedEffectiveReviewId',
          'expectedSupersedesReviewId','compensationReviewId','effectiveSourceReviewId',
          'expectedHeadReviewIdAfter','expectedEffectiveReviewIdAfter'
        ]) field
        where jsonb_typeof(action_json -> field) not in ('string', 'null')
          or (jsonb_typeof(action_json -> field) = 'string'
            and action_json ->> field !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
      )
      or jsonb_typeof(action_json -> 'expectedRevision') not in ('number', 'null')
      or (jsonb_typeof(action_json -> 'expectedRevision') = 'number'
        and action_json ->> 'expectedRevision' !~ '^[1-9][0-9]*$')
      or (action_json ->> 'action' = 'compensate_noop' and (
        jsonb_typeof(action_json -> 'importedReviewId') is distinct from 'null'
        or action_json ->> 'effectiveSourceReviewId'
          is distinct from action_json ->> 'expectedEffectiveReviewId'
      )) then
      raise exception using errcode = 'P7626', message = 'compensation action has null, malformed, or incorrectly typed fields';
    end if;
  end loop;

  if (
    select count(distinct value ->> 'actionId') <> planned_action_count
      or count(distinct value ->> 'sourceActionId') <> planned_action_count
      or count(distinct (value ->> 'sequence')::integer) <> planned_action_count
      or count(distinct value ->> 'itemId') <> planned_action_count
      or min((value ->> 'sequence')::integer) <> 1
      or max((value ->> 'sequence')::integer) <> planned_action_count
    from jsonb_array_elements(p_plan -> 'actions')
  ) then
    raise exception using errcode = 'P7626', message = 'compensation action, source, item, and contiguous sequence identities must be unique';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_plan -> 'actions') as planned(value)
    left join public.literature_gold_review_operation_actions as source
      on source.id = (planned.value ->> 'sourceActionId')::uuid
     and source.operation_id = p_target_import_operation_id
    left join public.literature_gold_set_items as item
      on item.id = (planned.value ->> 'itemId')::uuid
    where source.id is null
      or source.item_id is distinct from item.id
      or source.pmid is distinct from planned.value ->> 'pmid'
      or item.batch_id is distinct from p_batch_id
      or item.dataset_split is distinct from 'development'
      or planned.value ->> 'datasetSplit' is distinct from 'development'
      or (
        source.action_kind = 'import_initial'
        and planned.value ->> 'action' is distinct from 'compensate_void'
      )
      or (
        source.action_kind = 'import_revision'
        and (
          (source.pre_effective_review_id is null
            and planned.value ->> 'action' is distinct from 'compensate_void')
          or (source.pre_effective_review_id is not null
            and planned.value ->> 'action' is distinct from 'compensate_restore')
        )
      )
      or (
        source.action_kind = 'import_noop'
        and planned.value ->> 'action' is distinct from 'compensate_noop'
      )
      or (
        source.action_kind in ('import_initial', 'import_revision')
        and (
          source.action_status <> 'applied'
          or (planned.value ->> 'importedReviewId')::uuid is distinct from source.result_review_id
        )
      )
      or (source.action_kind = 'import_noop' and source.action_status <> 'noop')
  ) then
    raise exception using errcode = 'P7627', message = 'compensation actions must map one-for-one to the same-item target import actions and outcomes';
  end if;

  if exists (
    select 1
    from public.literature_gold_review_operation_actions as source
    where source.operation_id = p_target_import_operation_id
      and not exists (
        select 1
        from jsonb_array_elements(p_plan -> 'actions') as planned(value)
        where (planned.value ->> 'sourceActionId')::uuid = source.id
      )
  ) then
    raise exception using errcode = 'P7627', message = 'compensation plan omitted a target import action';
  end if;

  select * into locked_batch
  from public.literature_gold_set_batches as batch
  where batch.id = p_batch_id
  for update;
  if not found or locked_batch.status <> 'active' then
    raise exception using errcode = 'P7628', message = 'only an active gold-set batch may be compensated';
  end if;
  if locked_batch.kind = 'gold_standard' and locked_batch.test_unlocked_at is not null then
    raise exception using errcode = 'P7628', message = 'gold-standard compensation is forbidden after the held-out test split is unlocked';
  end if;
  if exists (
    select 1 from public.literature_gold_review_operations operation
    where operation.batch_id = p_batch_id and operation.status = 'started'
  ) then
    raise exception using errcode = 'P7623', message = 'the batch has a started operation that requires explicit recovery';
  end if;

  perform item.id
  from public.literature_gold_set_items as item
  where item.batch_id = p_batch_id
    and item.dataset_split = 'development'
  order by item.display_order, item.id
  for update;

  development_membership_hash :=
    public.literature_gold_development_membership_hash_v1(p_batch_id);
  if p_plan #>> '{scope,developmentMembershipSha256}'
      is distinct from development_membership_hash
    or planned_action_count is distinct from (
      select count(*)::integer
      from public.literature_gold_set_items as item
      where item.batch_id = p_batch_id
        and item.dataset_split = 'development'
    ) then
    raise exception using
      errcode = 'P7628',
      message = 'compensation actions must cover the exact checksum-bound development membership';
  end if;

  pre_physical_hash := public.literature_gold_physical_state_hash_v1(p_batch_id, 'development');
  pre_effective_hash := public.literature_gold_effective_state_hash_v1(p_batch_id, 'development');
  expected_post_effective_hash := p_authorization ->> 'expectedPostEffectiveStateSha256';
  if pre_effective_hash is distinct from target_import.post_effective_state_sha256
    or p_plan ->> 'expectedPhysicalStateSha256' is distinct from pre_physical_hash
    or p_plan ->> 'expectedEffectiveStateSha256' is distinct from pre_effective_hash
    or p_authorization ->> 'expectedPhysicalStateSha256' is distinct from pre_physical_hash
    or p_authorization ->> 'expectedEffectiveStateSha256' is distinct from pre_effective_hash
    or expected_post_effective_hash is distinct from target_import.pre_effective_state_sha256 then
    raise exception using errcode = 'P7629', message = 'compensation authorization does not match the sealed target import or current/expected effective states';
  end if;

  fault_after_action := nullif(p_plan ->> 'faultAfterAction', '')::integer;
  if fault_after_action is not null
    and fault_after_action not between 1 and planned_action_count then
    raise exception using errcode = 'P7626', message = 'faultAfterAction must identify a planned compensation action';
  end if;

  insert into public.literature_gold_review_operations (
    id, batch_id, operation_kind, target_import_operation_id, idempotency_key,
    artifact_sha256, plan_sha256, plan, authorization_sha256, authorization_payload,
    actor_user_id, actor_email, planned_action_count, planned_apply_count,
    planned_noop_count, pre_physical_state_sha256, pre_effective_state_sha256
  ) values (
    p_operation_id, p_batch_id, 'compensation', p_target_import_operation_id,
    normalized_key, p_artifact_sha256, p_plan_sha256, p_plan,
    p_authorization_sha256, p_authorization, p_actor_user_id, normalized_email,
    planned_action_count, planned_apply_count, planned_noop_count,
    pre_physical_hash, pre_effective_hash
  );

  insert into public.literature_gold_review_operation_actions (
    id, operation_id, action_sequence, item_id, pmid, action_kind,
    source_operation_action_id, planned_review_id, pre_current_review_id,
    pre_effective_review_id, expected_revision,
    expected_supersedes_review_id, planned_state
  )
  select
    (planned.value ->> 'actionId')::uuid,
    p_operation_id,
    (planned.value ->> 'sequence')::integer,
    source.item_id,
    source.pmid,
    planned.value ->> 'action',
    source.id,
    nullif(planned.value ->> 'compensationReviewId', '')::uuid,
    source.pre_current_review_id,
    source.pre_effective_review_id,
    nullif(planned.value ->> 'expectedRevision', '')::integer,
    nullif(planned.value ->> 'expectedSupersedesReviewId', '')::uuid,
    planned.value
  from jsonb_array_elements(p_plan -> 'actions') as planned(value)
  join public.literature_gold_review_operation_actions as source
    on source.id = (planned.value ->> 'sourceActionId')::uuid
   and source.operation_id = p_target_import_operation_id;

  insert into public.literature_gold_set_events (
    batch_id, actor_user_id, actor_email, event_type, after_value,
    operation_id, operation_event_sequence
  ) values (
    p_batch_id, p_actor_user_id, normalized_email, 'import_compensation_started',
    jsonb_build_object(
      'operationId', p_operation_id,
      'targetImportOperationId', p_target_import_operation_id,
      'artifactSha256', p_artifact_sha256,
      'planSha256', p_plan_sha256,
      'authorizationSha256', p_authorization_sha256,
      'plannedActionCount', planned_action_count,
      'prePhysicalStateSha256', pre_physical_hash,
      'preEffectiveStateSha256', pre_effective_hash
    ),
    p_operation_id, 1
  );

  begin
    perform item.id
    from public.literature_gold_set_items as item
    join jsonb_array_elements(p_plan -> 'actions') as planned(value)
      on item.id = (planned.value ->> 'itemId')::uuid
    order by item.display_order, item.id
    for update of item;

    for action_json in
      select value
      from jsonb_array_elements(p_plan -> 'actions')
      order by (value ->> 'sequence')::integer
    loop
      select * into action_row
      from public.literature_gold_review_operation_actions as action
      where action.id = (action_json ->> 'actionId')::uuid
        and action.operation_id = p_operation_id;

      select * into source_action
      from public.literature_gold_review_operation_actions as action
      where action.id = action_row.source_operation_action_id
        and action.operation_id = p_target_import_operation_id
        and action.item_id = action_row.item_id;
      if not found then
        raise exception using errcode = 'P7630', message = 'compensation source action is not from the target import and same item';
      end if;

      select * into locked_item
      from public.literature_gold_set_items as item
      where item.id = action_row.item_id;

      select * into imported_review
      from public.literature_gold_set_reviews as review
      where review.id = source_action.result_review_id
        and review.item_id = locked_item.id
        and review.operation_action_id = source_action.id
        and review.revision_kind = 'import';

      if exists (
        select 1
        from public.literature_gold_set_review_drafts as draft
        where draft.item_id = locked_item.id
      ) then
        raise exception using errcode = 'P7631', message = 'compensation is blocked by an intervening review draft';
      end if;

      if source_action.action_kind = 'import_noop' then
        if locked_item.review_status is distinct from
            source_action.planned_state #>> '{preImportItemState,reviewStatus}'
          or locked_item.started_at is distinct from nullif(
            source_action.planned_state #>> '{preImportItemState,startedAt}', ''
          )::timestamptz
          or locked_item.completed_at is distinct from nullif(
            source_action.planned_state #>> '{preImportItemState,completedAt}', ''
          )::timestamptz
          or locked_item.supplemental_metadata_revealed_at is distinct from nullif(
            source_action.planned_state
              #>> '{preImportItemState,supplementalMetadataRevealedAt}', ''
          )::timestamptz
          or locked_item.automated_signals_revealed_at is distinct from nullif(
            source_action.planned_state
              #>> '{preImportItemState,automatedSignalsRevealedAt}', ''
          )::timestamptz then
          raise exception using errcode = 'P7631', message = 'no-op target item state changed after import';
        end if;
      else
        if locked_item.review_status <> 'completed'
          or locked_item.started_at is distinct from coalesce(
            nullif(
              source_action.planned_state #>> '{preImportItemState,startedAt}', ''
            )::timestamptz,
            imported_review.started_at
          )
          or locked_item.completed_at is distinct from imported_review.completed_at
          or locked_item.supplemental_metadata_revealed_at is distinct from nullif(
            source_action.planned_state
              #>> '{preImportItemState,supplementalMetadataRevealedAt}', ''
          )::timestamptz
          or locked_item.automated_signals_revealed_at is distinct from nullif(
            source_action.planned_state
              #>> '{preImportItemState,automatedSignalsRevealedAt}', ''
          )::timestamptz then
          raise exception using errcode = 'P7631', message = 'imported item state changed before compensation';
        end if;
      end if;

      select case
        when head.lifecycle_state = 'effective'
          then coalesce(head.effective_source_review_id, head.id)
        else null
      end
      into current_effective_review_id
      from public.literature_gold_set_reviews as head
      where head.id = locked_item.current_review_id;

      if nullif(action_json ->> 'expectedCurrentReviewId', '')::uuid
          is distinct from locked_item.current_review_id
        or nullif(action_json ->> 'expectedEffectiveReviewId', '')::uuid
          is distinct from current_effective_review_id then
        raise exception using errcode = 'P7631', message = 'compensation action current/effective head guard drifted';
      end if;

      if action_row.action_kind = 'compensate_noop' then
        if locked_item.current_review_id is distinct from source_action.pre_current_review_id
          or current_effective_review_id is distinct from source_action.pre_effective_review_id
          or nullif(action_json ->> 'expectedHeadReviewIdAfter', '')::uuid
            is distinct from locked_item.current_review_id
          or nullif(action_json ->> 'expectedEffectiveReviewIdAfter', '')::uuid
            is distinct from current_effective_review_id
          or action_json -> 'expectedEventSequence' is distinct from '[]'::jsonb then
          raise exception using errcode = 'P7631', message = 'no-op compensation target drifted after the import';
        end if;
        update public.literature_gold_review_operation_actions
        set action_status = 'noop', processed_at = now(), result_state = jsonb_build_object(
          'currentReviewId', locked_item.current_review_id,
          'effectiveReviewId', current_effective_review_id
        )
        where id = action_row.id;
        noop_count := noop_count + 1;
      else
        if imported_review.id is null
          or locked_item.current_review_id is distinct from imported_review.id
          or action_row.expected_supersedes_review_id is distinct from imported_review.id
          or action_row.expected_revision is distinct from imported_review.revision + 1
          or nullif(action_json ->> 'expectedHeadReviewIdAfter', '')::uuid
            is distinct from action_row.planned_review_id
          or (
            action_row.action_kind = 'compensate_restore'
            and nullif(action_json ->> 'expectedEffectiveReviewIdAfter', '')::uuid
              is distinct from source_action.pre_effective_review_id
          )
          or (
            action_row.action_kind = 'compensate_restore'
            and nullif(action_json ->> 'effectiveSourceReviewId', '')::uuid
              is distinct from source_action.pre_effective_review_id
          )
          or (
            action_row.action_kind = 'compensate_void'
            and (
              nullif(action_json ->> 'expectedEffectiveReviewIdAfter', '')::uuid is not null
              or nullif(action_json ->> 'effectiveSourceReviewId', '')::uuid is not null
            )
          )
          or action_json -> 'expectedEventSequence' is distinct from (case
            when action_row.action_kind = 'compensate_restore'
              then '["review_compensated"]'::jsonb
            else '["review_voided"]'::jsonb
          end) then
          raise exception using errcode = 'P7632', message = 'compensation requires the imported review to remain the exact current physical head';
        end if;
        perform public.assert_literature_gold_review_chain_head_v1(locked_item.id);

        restored_status := source_action.planned_state #>> '{preImportItemState,reviewStatus}';
        restored_started_at := nullif(
          source_action.planned_state #>> '{preImportItemState,startedAt}', ''
        )::timestamptz;
        restored_completed_at := nullif(
          source_action.planned_state #>> '{preImportItemState,completedAt}', ''
        )::timestamptz;
        restored_supplemental_at := nullif(
          source_action.planned_state #>> '{preImportItemState,supplementalMetadataRevealedAt}', ''
        )::timestamptz;
        restored_automated_at := nullif(
          source_action.planned_state #>> '{preImportItemState,automatedSignalsRevealedAt}', ''
        )::timestamptz;

        if restored_status not in ('pending', 'in_progress', 'return_later', 'completed') then
          raise exception using errcode = 'P7633', message = 'target import did not journal a valid pre-import item state';
        end if;

        if action_row.action_kind = 'compensate_restore' then
          select * into source_review
          from public.literature_gold_set_reviews as review
          where review.id = source_action.pre_effective_review_id
            and review.item_id = locked_item.id;
          if not found or restored_status <> 'completed' then
            raise exception using errcode = 'P7634', message = 'restore compensation requires the exact prior effective review and completed item state';
          end if;

          insert into public.literature_gold_set_reviews (
            id, item_id, revision, supersedes_review_id, reviewer_user_id,
            reviewer_email, relevance_label, metadata_sufficiency,
            reviewer_confidence, topic_ids, technology_tags, clinical_purposes,
            disease_tags, study_design, publication_status,
            categorization_from_full_text, notes, used_supplemental_metadata,
            review_seconds, is_blinded, started_at, completed_at,
            technology_tag_status, disease_tag_status, taxonomy_version,
            label_schema_version, enrichment_schema_version, enrichment_provenance,
            revision_kind, lifecycle_state, operation_action_id,
            compensates_review_id, effective_source_review_id
          ) values (
            action_row.planned_review_id, locked_item.id, action_row.expected_revision,
            imported_review.id, source_review.reviewer_user_id,
            source_review.reviewer_email, source_review.relevance_label,
            source_review.metadata_sufficiency, source_review.reviewer_confidence,
            source_review.topic_ids, source_review.technology_tags,
            source_review.clinical_purposes, source_review.disease_tags,
            source_review.study_design, source_review.publication_status,
            source_review.categorization_from_full_text, source_review.notes,
            source_review.used_supplemental_metadata, source_review.review_seconds,
            source_review.is_blinded, now(), now(),
            source_review.technology_tag_status, source_review.disease_tag_status,
            source_review.taxonomy_version, source_review.label_schema_version,
            source_review.enrichment_schema_version, source_review.enrichment_provenance,
            'compensation', 'effective',
            action_row.id, imported_review.id, source_review.id
          ) returning * into created_review;
        else
          if source_action.pre_effective_review_id is not null or restored_status = 'completed' then
            raise exception using errcode = 'P7635', message = 'void compensation is only valid for an import that created the first effective review';
          end if;

          insert into public.literature_gold_set_reviews (
            id, item_id, revision, supersedes_review_id, reviewer_user_id,
            reviewer_email, relevance_label, metadata_sufficiency,
            reviewer_confidence, topic_ids, technology_tags, clinical_purposes,
            disease_tags, study_design, publication_status,
            categorization_from_full_text, notes, used_supplemental_metadata,
            review_seconds, is_blinded, started_at, completed_at,
            technology_tag_status, disease_tag_status, taxonomy_version,
            label_schema_version, enrichment_schema_version, enrichment_provenance,
            revision_kind, lifecycle_state, operation_action_id,
            compensates_review_id, effective_source_review_id
          ) values (
            action_row.planned_review_id, locked_item.id, action_row.expected_revision,
            imported_review.id, imported_review.reviewer_user_id,
            imported_review.reviewer_email, imported_review.relevance_label,
            imported_review.metadata_sufficiency, imported_review.reviewer_confidence,
            imported_review.topic_ids, imported_review.technology_tags,
            imported_review.clinical_purposes, imported_review.disease_tags,
            imported_review.study_design, imported_review.publication_status,
            imported_review.categorization_from_full_text, imported_review.notes,
            imported_review.used_supplemental_metadata, imported_review.review_seconds,
            imported_review.is_blinded, now(), now(),
            imported_review.technology_tag_status, imported_review.disease_tag_status,
            imported_review.taxonomy_version, imported_review.label_schema_version,
            imported_review.enrichment_schema_version, imported_review.enrichment_provenance,
            'compensation', 'withdrawn',
            action_row.id, imported_review.id, null
          ) returning * into created_review;
        end if;

        update public.literature_gold_set_items
        set current_review_id = created_review.id,
          review_status = restored_status,
          started_at = restored_started_at,
          completed_at = restored_completed_at,
          supplemental_metadata_revealed_at = restored_supplemental_at,
          automated_signals_revealed_at = restored_automated_at
        where id = locked_item.id;

        update public.literature_gold_review_operation_actions
        set action_status = 'applied', result_review_id = created_review.id,
          processed_at = now(), result_state = jsonb_build_object(
            'reviewId', created_review.id,
            'revision', created_review.revision,
            'supersedesReviewId', created_review.supersedes_review_id,
            'lifecycleState', created_review.lifecycle_state,
            'currentReviewId', created_review.id,
            'effectiveReviewId', case
              when created_review.lifecycle_state = 'effective'
                then created_review.effective_source_review_id
              else null
            end
          )
        where id = action_row.id;

        insert into public.literature_gold_set_events (
          batch_id, item_id, actor_user_id, actor_email, event_type,
          before_value, after_value, operation_id, operation_action_id,
          operation_event_sequence
        ) values (
          p_batch_id, locked_item.id, p_actor_user_id, normalized_email,
          case when created_review.lifecycle_state = 'withdrawn'
            then 'review_voided' else 'review_compensated' end,
          jsonb_build_object(
            'importedReviewId', imported_review.id,
            'currentReviewId', locked_item.current_review_id
          ),
          jsonb_build_object(
            'reviewId', created_review.id,
            'revision', created_review.revision,
            'revisionKind', 'compensation',
            'lifecycleState', created_review.lifecycle_state,
            'effectiveSourceReviewId', created_review.effective_source_review_id
          ),
          p_operation_id, action_row.id, action_row.action_sequence + 1
        );
        applied_count := applied_count + 1;
      end if;

      if fault_after_action = action_row.action_sequence then
        raise exception using
          errcode = 'P7699',
          message = format('controlled compensation rehearsal fault after action %s', fault_after_action);
      end if;
    end loop;

    if applied_count <> planned_apply_count or noop_count <> planned_noop_count then
      raise exception using errcode = 'P7636', message = 'compensation action outcomes do not match planned counts';
    end if;

    for action_row in
      select action.*
      from public.literature_gold_review_operation_actions as action
      where action.operation_id = p_operation_id
      order by action.item_id
    loop
      perform public.assert_literature_gold_review_chain_head_v1(action_row.item_id);
    end loop;

    post_effective_hash := public.literature_gold_effective_state_hash_v1(p_batch_id, 'development');
    if post_effective_hash is distinct from expected_post_effective_hash then
      raise exception using errcode = 'P7637', message = 'compensation did not restore the checksum-authorized effective review state';
    end if;

    update public.literature_gold_review_operations
    set status = 'completed', applied_action_count = applied_count,
      noop_action_count = noop_count, completed_at = now()
    where id = p_operation_id;

    insert into public.literature_gold_set_events (
      batch_id, actor_user_id, actor_email, event_type, after_value,
      operation_id, operation_event_sequence
    ) values (
      p_batch_id, p_actor_user_id, normalized_email,
      'import_compensation_completed',
      jsonb_build_object(
        'operationId', p_operation_id,
        'targetImportOperationId', p_target_import_operation_id,
        'appliedActionCount', applied_count,
        'noopActionCount', noop_count,
        'restoredEffectiveStateSha256', post_effective_hash
      ),
      p_operation_id, planned_action_count + 2
    );

    post_physical_hash := public.literature_gold_physical_state_hash_v1(p_batch_id, 'development');
    update public.literature_gold_review_operations
    set post_physical_state_sha256 = post_physical_hash,
      post_effective_state_sha256 = post_effective_hash
    where id = p_operation_id;
  exception when others then
    get stacked diagnostics
      caught_sqlstate = returned_sqlstate,
      caught_message = message_text;

    update public.literature_gold_review_operation_actions
    set action_status = 'failed', processed_at = now(), result_state = jsonb_build_object(
      'errorSqlstate', caught_sqlstate,
      'errorMessage', left(caught_message, 4000)
    )
    where operation_id = p_operation_id and action_status = 'planned';

    update public.literature_gold_review_operations
    set status = 'failed', applied_action_count = 0, noop_action_count = 0,
      error_sqlstate = caught_sqlstate, error_message = left(caught_message, 4000),
      completed_at = now()
    where id = p_operation_id;

    insert into public.literature_gold_set_events (
      batch_id, actor_user_id, actor_email, event_type, after_value,
      operation_id, operation_event_sequence
    ) values (
      p_batch_id, p_actor_user_id, normalized_email,
      'import_compensation_failed',
      jsonb_build_object(
        'operationId', p_operation_id,
        'targetImportOperationId', p_target_import_operation_id,
        'errorSqlstate', caught_sqlstate,
        'errorMessage', left(caught_message, 4000),
        'reviewAndPointerMutationsCommitted', false
      ),
      p_operation_id, planned_action_count + 2
    );

    post_effective_hash := public.literature_gold_effective_state_hash_v1(p_batch_id, 'development');
    if post_effective_hash is distinct from pre_effective_hash then
      raise exception using
        errcode = 'P7698',
        message = format(
          'failed compensation changed effective state after rollback; original SQLSTATE %s: %s',
          caught_sqlstate,
          left(caught_message, 3500)
        );
    end if;
    post_physical_hash := public.literature_gold_physical_state_hash_v1(p_batch_id, 'development');
    update public.literature_gold_review_operations
    set post_physical_state_sha256 = post_physical_hash,
      post_effective_state_sha256 = post_effective_hash
    where id = p_operation_id;

    return public.literature_gold_review_operation_receipt_v1(p_operation_id, false);
  end;

  return public.literature_gold_review_operation_receipt_v1(p_operation_id, false);
end;
$$;

revoke all on function public.compensate_literature_gold_import_v1(
  uuid, uuid, text, uuid, text, text, jsonb, text, jsonb, uuid, text
) from public, anon, authenticated;
grant execute on function public.compensate_literature_gold_import_v1(
  uuid, uuid, text, uuid, text, text, jsonb, text, jsonb, uuid, text
) to service_role;

-- Keep the public standard-save API, but make it append from the physical head
-- and decide first-review behavior from effective state rather than pointer
-- nullability.  Canonical-definition patching preserves the vocabulary added
-- by intervening migrations.
do $migration$
declare
  function_sql text;
  updated_sql text;
begin
  select pg_get_functiondef(
    'public.save_literature_gold_review_v1(uuid,uuid,text,jsonb,boolean)'::regprocedure
  ) into function_sql;

  updated_sql := replace(
    function_sql,
    $needle$  prior_review_id uuid;
  next_revision integer;$needle$,
    $replacement$  prior_review_id uuid;
  prior_effective_review_id uuid;
  next_revision integer;$replacement$
  );
  if updated_sql = function_sql then
    raise exception 'save review effective-state declaration patch point was not found';
  end if;
  function_sql := updated_sql;

  updated_sql := replace(
    function_sql,
    $needle$  if locked_batch.status <> 'active' then
    raise exception 'only active gold-set batches may be reviewed';
  end if;

  if jsonb_typeof$needle$,
    $replacement$  if locked_batch.status <> 'active' then
    raise exception 'only active gold-set batches may be reviewed';
  end if;

  perform public.assert_literature_gold_review_chain_head_v1(p_item_id);
  select case
    when head.lifecycle_state = 'effective'
      then coalesce(head.effective_source_review_id, head.id)
    else null
  end
  into prior_effective_review_id
  from public.literature_gold_set_reviews as head
  where head.id = locked_item.current_review_id;

  if jsonb_typeof$replacement$
  );
  if updated_sql = function_sql then
    raise exception 'save review chain-head assertion patch point was not found';
  end if;
  function_sql := updated_sql;

  updated_sql := replace(
    function_sql,
    $needle$  if locked_item.current_review_id is null
    and locked_item.automated_signals_revealed_at is not null then
    raise exception 'the first completed review must remain blinded';
  end if;$needle$,
    $replacement$  if prior_effective_review_id is null
    and locked_item.automated_signals_revealed_at is not null then
    raise exception 'the first effective completed review must remain blinded';
  end if;$replacement$
  );
  if updated_sql = function_sql then
    raise exception 'save review first-effective blinding patch point was not found';
  end if;
  function_sql := updated_sql;

  updated_sql := replace(
    function_sql,
    $needle$    case when prior_review_id is null then 'review_completed' else 'review_revised' end,$needle$,
    $replacement$    case when prior_effective_review_id is null then 'review_completed' else 'review_revised' end,$replacement$
  );
  if updated_sql = function_sql then
    raise exception 'save review effective event patch point was not found';
  end if;

  execute updated_sql;
end;
$migration$;

revoke all on function public.guard_literature_gold_review_operation_mutation()
  from public, anon, authenticated;
revoke all on function public.guard_literature_gold_review_action_mutation()
  from public, anon, authenticated;
revoke all on function public.guard_literature_gold_review_chain_insert()
  from public, anon, authenticated;
revoke all on function public.assert_literature_gold_review_chain_head_v1(uuid)
  from public, anon, authenticated;
revoke all on function public.check_literature_gold_review_chain_head()
  from public, anon, authenticated;
revoke all on function public.validate_literature_gold_operation_event()
  from public, anon, authenticated;
grant execute on function public.assert_literature_gold_review_chain_head_v1(uuid)
  to service_role;

notify pgrst, 'reload schema';

-- A withdrawn physical head is unresolved/effectively unreviewed for item
-- actions even though it remains the immutable current chain head.
do $migration$
declare
  function_sql text;
  updated_sql text;
begin
  select pg_get_functiondef(
    'public.update_literature_gold_item_v1(uuid,uuid,text,text)'::regprocedure
  ) into function_sql;

  updated_sql := replace(
    function_sql,
    $needle$  event_name text;
begin$needle$,
    $replacement$  event_name text;
  has_effective_review boolean := false;
begin$replacement$
  );
  if updated_sql = function_sql then
    raise exception 'update item effective-state declaration patch point was not found';
  end if;
  function_sql := updated_sql;

  updated_sql := replace(
    function_sql,
    $needle$  if p_action = 'return_later' then$needle$,
    $replacement$  select coalesce((
    select head.lifecycle_state = 'effective'
    from public.literature_gold_set_reviews as head
    where head.id = locked_item.current_review_id
  ), false)
  into has_effective_review;

  if p_action = 'return_later' then$replacement$
  );
  if updated_sql = function_sql then
    raise exception 'update item effective lookup patch point was not found';
  end if;
  function_sql := updated_sql;

  updated_sql := replace(function_sql,
    'locked_item.current_review_id is not null', 'has_effective_review');
  if updated_sql = function_sql then
    raise exception 'update item effective positive checks were not found';
  end if;
  function_sql := updated_sql;

  updated_sql := replace(function_sql,
    'locked_item.current_review_id is null', 'not has_effective_review');
  if updated_sql = function_sql then
    raise exception 'update item effective negative checks were not found';
  end if;
  function_sql := updated_sql;

  updated_sql := replace(function_sql,
    'when current_review_id is null and review_status = ''pending''',
    'when not has_effective_review and review_status = ''pending''');
  if updated_sql = function_sql then
    raise exception 'update item effective row-status check was not found';
  end if;

  execute updated_sql;
end;
$migration$;

-- Resolve currentReview from effective state while retaining the physical head
-- and full history in the response.
do $migration$
declare
  function_sql text;
  updated_sql text;
begin
  select pg_get_functiondef(
    'public.get_literature_gold_review_item_v1(uuid,uuid,text,text)'::regprocedure
  ) into function_sql;

  updated_sql := replace(
    function_sql,
    $needle$    'revision', review.revision,
    'reviewerEmail', review.reviewer_email,$needle$,
    $replacement$    'revision', review.revision,
    'revisionKind', review.revision_kind,
    'lifecycleState', review.lifecycle_state,
    'supersedesReviewId', review.supersedes_review_id,
    'compensatesReviewId', review.compensates_review_id,
    'effectiveSourceReviewId', review.effective_source_review_id,
    'operationActionId', review.operation_action_id,
    'technologyTagStatus', review.technology_tag_status,
    'diseaseTagStatus', review.disease_tag_status,
    'taxonomyVersion', review.taxonomy_version,
    'labelSchemaVersion', review.label_schema_version,
    'enrichmentSchemaVersion', review.enrichment_schema_version,
    'enrichmentProvenance', review.enrichment_provenance,
    'reviewerEmail', review.reviewer_email,$replacement$
  );
  if updated_sql = function_sql then
    raise exception 'getter current-review chain metadata patch point was not found';
  end if;
  function_sql := updated_sql;

  updated_sql := replace(
    function_sql,
    $needle$  where review.id = selected_item.current_review_id;$needle$,
    $replacement$  where review.id = selected_item.current_review_id
    and review.lifecycle_state = 'effective';$replacement$
  );
  if updated_sql = function_sql then
    raise exception 'getter effective current-review filter patch point was not found';
  end if;
  function_sql := updated_sql;

  updated_sql := replace(
    function_sql,
    $needle$        'revision', review.revision,
        'reviewerEmail', review.reviewer_email,$needle$,
    $replacement$        'revision', review.revision,
        'revisionKind', review.revision_kind,
        'lifecycleState', review.lifecycle_state,
        'supersedesReviewId', review.supersedes_review_id,
        'compensatesReviewId', review.compensates_review_id,
        'effectiveSourceReviewId', review.effective_source_review_id,
        'operationActionId', review.operation_action_id,
        'technologyTagStatus', review.technology_tag_status,
        'diseaseTagStatus', review.disease_tag_status,
        'taxonomyVersion', review.taxonomy_version,
        'labelSchemaVersion', review.label_schema_version,
        'enrichmentSchemaVersion', review.enrichment_schema_version,
        'enrichmentProvenance', review.enrichment_provenance,
        'reviewerEmail', review.reviewer_email,$replacement$
  );
  if updated_sql = function_sql then
    raise exception 'getter review-history chain metadata patch point was not found';
  end if;
  function_sql := updated_sql;

  updated_sql := replace(
    function_sql,
    $needle$    'reviewStatus', selected_item.review_status,
    'article',$needle$,
    $replacement$    'reviewStatus', selected_item.review_status,
    'chainHeadReviewId', selected_item.current_review_id,
    'article',$replacement$
  );
  if updated_sql = function_sql then
    raise exception 'getter chain-head response patch point was not found';
  end if;

  execute updated_sql;
end;
$migration$;
