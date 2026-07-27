create table public.literature_gold_set_batches (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind text not null,
  taxonomy_version text not null,
  label_schema_version text not null,
  relevance_definition_version text not null,
  sampling_algorithm_version text not null,
  sampling_seed bigint not null,
  requested_size integer not null,
  test_percent integer not null,
  status text not null default 'active',
  sampling_report jsonb not null default '{}'::jsonb,
  created_by_user_id uuid,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  frozen_at timestamptz,
  constraint literature_gold_set_batches_name_check check (
    name ~ '^[a-z0-9][a-z0-9._-]{2,79}$'
  ),
  constraint literature_gold_set_batches_kind_check check (
    kind in (
      'pilot',
      'gold_standard',
      'landmark_regression',
      'hard_negative_regression'
    )
  ),
  constraint literature_gold_set_batches_sampling_seed_check check (
    sampling_seed > 0
  ),
  constraint literature_gold_set_batches_requested_size_check check (
    requested_size between 1 and 5000
  ),
  constraint literature_gold_set_batches_test_percent_check check (
    test_percent between 0 and 50
  ),
  constraint literature_gold_set_batches_status_check check (
    status in ('active', 'frozen', 'archived')
  ),
  constraint literature_gold_set_batches_report_check check (
    jsonb_typeof(sampling_report) = 'object'
  ),
  constraint literature_gold_set_batches_frozen_state_check check (
    (status = 'frozen' and frozen_at is not null)
    or (status <> 'frozen' and frozen_at is null)
  )
);

create table public.literature_gold_set_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.literature_gold_set_batches(id) on delete restrict,
  pmid text not null references public.literature_articles(pmid) on update cascade on delete restrict,
  sample_stratum text not null,
  sampling_reason text not null,
  sampling_metadata jsonb not null default '{}'::jsonb,
  dataset_split text not null,
  display_order integer not null,
  review_status text not null default 'pending',
  current_review_id uuid,
  supplemental_metadata_revealed_at timestamptz,
  automated_signals_revealed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, pmid),
  unique (batch_id, display_order),
  constraint literature_gold_set_items_stratum_check check (
    sample_stratum in (
      'strong_likely_ip',
      'likely_non_ip',
      'ambiguous_boundary',
      'discovery_only',
      'challenging_metadata',
      'landmark_regression',
      'hard_negative_regression'
    )
  ),
  constraint literature_gold_set_items_sampling_reason_check check (
    length(trim(sampling_reason)) between 1 and 2000
  ),
  constraint literature_gold_set_items_sampling_metadata_check check (
    jsonb_typeof(sampling_metadata) = 'object'
  ),
  constraint literature_gold_set_items_dataset_split_check check (
    dataset_split in ('development', 'test')
  ),
  constraint literature_gold_set_items_display_order_check check (
    display_order > 0
  ),
  constraint literature_gold_set_items_review_status_check check (
    review_status in ('pending', 'in_progress', 'return_later', 'completed')
  ),
  constraint literature_gold_set_items_completion_check check (
    (review_status = 'completed' and current_review_id is not null and completed_at is not null)
    or review_status <> 'completed'
  )
);

create table public.literature_gold_set_review_drafts (
  item_id uuid primary key references public.literature_gold_set_items(id) on delete cascade,
  reviewer_user_id uuid,
  reviewer_email text,
  relevance_label text,
  metadata_sufficiency text,
  reviewer_confidence text,
  topic_ids text[] not null default '{}'::text[],
  technology_tags text[] not null default '{}'::text[],
  clinical_purposes text[] not null default '{}'::text[],
  disease_tags text[] not null default '{}'::text[],
  study_design text,
  publication_status text,
  notes text not null default '',
  used_supplemental_metadata boolean not null default false,
  review_seconds integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint literature_gold_set_review_drafts_relevance_check check (
    relevance_label is null
    or relevance_label in ('include_core', 'include_adjacent', 'exclude', 'uncertain')
  ),
  constraint literature_gold_set_review_drafts_metadata_check check (
    metadata_sufficiency is null
    or metadata_sufficiency in (
      'adequate_abstract',
      'limited_abstract',
      'no_abstract',
      'conflicting_metadata'
    )
  ),
  constraint literature_gold_set_review_drafts_confidence_check check (
    reviewer_confidence is null
    or reviewer_confidence in ('high', 'moderate', 'low')
  ),
  constraint literature_gold_set_review_drafts_notes_check check (
    length(notes) <= 4000
  ),
  constraint literature_gold_set_review_drafts_seconds_check check (
    review_seconds between 0 and 86400
  )
);

create table public.literature_gold_set_reviews (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.literature_gold_set_items(id) on delete restrict,
  revision integer not null,
  supersedes_review_id uuid,
  reviewer_user_id uuid,
  reviewer_email text,
  relevance_label text not null,
  metadata_sufficiency text not null,
  reviewer_confidence text not null,
  topic_ids text[] not null default '{}'::text[],
  technology_tags text[] not null default '{}'::text[],
  clinical_purposes text[] not null default '{}'::text[],
  disease_tags text[] not null default '{}'::text[],
  study_design text,
  publication_status text,
  notes text not null default '',
  used_supplemental_metadata boolean not null default false,
  review_seconds integer not null default 0,
  is_blinded boolean not null,
  started_at timestamptz not null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (item_id, revision),
  unique (id, item_id),
  constraint literature_gold_set_reviews_revision_check check (revision > 0),
  constraint literature_gold_set_reviews_relevance_check check (
    relevance_label in ('include_core', 'include_adjacent', 'exclude', 'uncertain')
  ),
  constraint literature_gold_set_reviews_metadata_check check (
    metadata_sufficiency in (
      'adequate_abstract',
      'limited_abstract',
      'no_abstract',
      'conflicting_metadata'
    )
  ),
  constraint literature_gold_set_reviews_confidence_check check (
    reviewer_confidence in ('high', 'moderate', 'low')
  ),
  constraint literature_gold_set_reviews_notes_check check (
    length(notes) <= 4000
  ),
  constraint literature_gold_set_reviews_seconds_check check (
    review_seconds between 0 and 86400
  ),
  constraint literature_gold_set_reviews_time_check check (
    completed_at >= started_at
  ),
  constraint literature_gold_set_reviews_included_labels_check check (
    (
      relevance_label in ('include_core', 'include_adjacent')
      and cardinality(topic_ids) > 0
      and cardinality(clinical_purposes) > 0
      and study_design is not null
      and publication_status is not null
    )
    or (
      relevance_label in ('exclude', 'uncertain')
      and cardinality(topic_ids) = 0
      and cardinality(technology_tags) = 0
      and cardinality(clinical_purposes) = 0
      and cardinality(disease_tags) = 0
      and study_design is null
      and publication_status is null
    )
  )
);

alter table public.literature_gold_set_items
  add constraint literature_gold_set_items_current_review_fk
  foreign key (current_review_id, id)
  references public.literature_gold_set_reviews(id, item_id)
  on delete restrict;

alter table public.literature_gold_set_reviews
  add constraint literature_gold_set_reviews_supersedes_fk
  foreign key (supersedes_review_id, item_id)
  references public.literature_gold_set_reviews(id, item_id)
  on delete restrict;

create table public.literature_gold_set_events (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.literature_gold_set_batches(id) on delete restrict,
  item_id uuid references public.literature_gold_set_items(id) on delete restrict,
  actor_user_id uuid,
  actor_email text,
  event_type text not null,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now(),
  constraint literature_gold_set_events_type_check check (
    event_type in (
      'batch_created',
      'draft_saved',
      'review_completed',
      'review_revised',
      'returned_later',
      'review_resumed',
      'supplemental_metadata_revealed',
      'automated_signals_revealed',
      'batch_frozen'
    )
  ),
  constraint literature_gold_set_events_before_check check (
    before_value is null
    or jsonb_typeof(before_value) in (
      'object',
      'array',
      'string',
      'number',
      'boolean',
      'null'
    )
  ),
  constraint literature_gold_set_events_after_check check (
    after_value is null
    or jsonb_typeof(after_value) in (
      'object',
      'array',
      'string',
      'number',
      'boolean',
      'null'
    )
  )
);

create index literature_gold_set_items_batch_status_order_idx
  on public.literature_gold_set_items (batch_id, review_status, display_order);
create index literature_gold_set_items_pmid_idx
  on public.literature_gold_set_items (pmid);
create index literature_gold_set_items_unresolved_idx
  on public.literature_gold_set_items (batch_id, display_order)
  where review_status <> 'completed';
create index literature_gold_set_items_split_idx
  on public.literature_gold_set_items (batch_id, dataset_split, display_order);
create index literature_gold_set_reviews_item_completed_idx
  on public.literature_gold_set_reviews (item_id, completed_at desc);
create index literature_gold_set_reviews_supersedes_idx
  on public.literature_gold_set_reviews (supersedes_review_id)
  where supersedes_review_id is not null;
create index literature_gold_set_events_batch_created_idx
  on public.literature_gold_set_events (batch_id, created_at desc);
create index literature_gold_set_events_item_created_idx
  on public.literature_gold_set_events (item_id, created_at desc)
  where item_id is not null;

create trigger set_literature_gold_set_batches_updated_at
  before update on public.literature_gold_set_batches
  for each row
  execute function public.set_literature_updated_at();

create trigger set_literature_gold_set_items_updated_at
  before update on public.literature_gold_set_items
  for each row
  execute function public.set_literature_updated_at();

create trigger set_literature_gold_set_review_drafts_updated_at
  before update on public.literature_gold_set_review_drafts
  for each row
  execute function public.set_literature_updated_at();

create or replace function public.prevent_literature_gold_set_append_only_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;

revoke execute on function public.prevent_literature_gold_set_append_only_mutation()
  from public, anon, authenticated;

create trigger prevent_literature_gold_set_reviews_mutation
  before update or delete on public.literature_gold_set_reviews
  for each row
  execute function public.prevent_literature_gold_set_append_only_mutation();

create trigger prevent_literature_gold_set_events_mutation
  before update or delete on public.literature_gold_set_events
  for each row
  execute function public.prevent_literature_gold_set_append_only_mutation();

create or replace function public.prevent_frozen_literature_gold_set_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  resolved_batch_id uuid;
begin
  if tg_table_name = 'literature_gold_set_batches' then
    if tg_op = 'DELETE' and old.status = 'frozen' then
      raise exception 'frozen gold-set batches are immutable';
    end if;
    if tg_op = 'UPDATE' and old.status = 'frozen' and new is distinct from old then
      raise exception 'frozen gold-set batches are immutable';
    end if;
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_table_name = 'literature_gold_set_review_drafts' then
    select item.batch_id
    into resolved_batch_id
    from public.literature_gold_set_items as item
    where item.id = coalesce(new.item_id, old.item_id);
  elsif tg_table_name = 'literature_gold_set_reviews' then
    select item.batch_id
    into resolved_batch_id
    from public.literature_gold_set_items as item
    where item.id = coalesce(new.item_id, old.item_id);
  else
    resolved_batch_id := coalesce(new.batch_id, old.batch_id);
  end if;

  if exists (
    select 1
    from public.literature_gold_set_batches as batch
    where batch.id = resolved_batch_id
      and batch.status = 'frozen'
  ) then
    raise exception 'frozen gold-set batches are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function public.prevent_frozen_literature_gold_set_mutation()
  from public, anon, authenticated;

create trigger protect_frozen_literature_gold_set_batches
  before update or delete on public.literature_gold_set_batches
  for each row
  execute function public.prevent_frozen_literature_gold_set_mutation();

create trigger protect_frozen_literature_gold_set_items
  before insert or update or delete on public.literature_gold_set_items
  for each row
  execute function public.prevent_frozen_literature_gold_set_mutation();

create trigger protect_frozen_literature_gold_set_review_drafts
  before insert or update or delete on public.literature_gold_set_review_drafts
  for each row
  execute function public.prevent_frozen_literature_gold_set_mutation();

create trigger protect_frozen_literature_gold_set_reviews
  before insert on public.literature_gold_set_reviews
  for each row
  execute function public.prevent_frozen_literature_gold_set_mutation();

create or replace function public.list_literature_gold_sampling_candidates_v1(
  p_after_pmid text default null,
  p_limit integer default 1000
)
returns table (
  pmid text,
  journal_id text,
  journal_label text,
  publication_year integer,
  has_abstract boolean,
  is_conference_abstract boolean,
  is_landmark boolean,
  source_kinds text[],
  source_count integer,
  source_file_count integer,
  query_ids text[],
  suggested_topic_ids text[],
  suggestion_count integer,
  max_suggestion_confidence numeric
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with source_summary as (
    select
      source.pmid,
      array_agg(distinct source.source_kind order by source.source_kind) as source_kinds,
      count(distinct source.source_kind)::integer as source_count,
      count(distinct source.batch_id)::integer as source_file_count,
      coalesce(
        array_agg(distinct source.query_id order by source.query_id)
          filter (where source.query_id is not null),
        '{}'::text[]
      ) as query_ids
    from public.literature_article_sources as source
    group by source.pmid
  ),
  suggestion_summary as (
    select
      assignment.pmid,
      array_agg(distinct assignment.topic_id order by assignment.topic_id) as suggested_topic_ids,
      count(distinct assignment.topic_id)::integer as suggestion_count,
      coalesce(max(assignment.confidence), 0)::numeric as max_suggestion_confidence
    from public.literature_article_topics as assignment
    where assignment.assignment_state = 'suggested'
      and assignment.assignment_source in ('query', 'rule', 'ai')
    group by assignment.pmid
  )
  select
    article.pmid,
    article.journal_id,
    coalesce(
      article.journal_title,
      article.journal_abbreviation,
      article.journal_id,
      'Unknown journal'
    ) as journal_label,
    article.publication_year,
    nullif(trim(coalesce(article.abstract, '')), '') is not null as has_abstract,
    article.is_conference_abstract,
    article.is_landmark,
    coalesce(source.source_kinds, '{}'::text[]) as source_kinds,
    coalesce(source.source_count, 0) as source_count,
    coalesce(source.source_file_count, 0) as source_file_count,
    coalesce(source.query_ids, '{}'::text[]) as query_ids,
    coalesce(suggestion.suggested_topic_ids, '{}'::text[]) as suggested_topic_ids,
    coalesce(suggestion.suggestion_count, 0) as suggestion_count,
    coalesce(suggestion.max_suggestion_confidence, 0) as max_suggestion_confidence
  from public.literature_articles as article
  left join source_summary as source on source.pmid = article.pmid
  left join suggestion_summary as suggestion on suggestion.pmid = article.pmid
  where
    p_after_pmid is null
    or article.pmid::numeric > p_after_pmid::numeric
  order by article.pmid::numeric
  limit greatest(1, least(coalesce(p_limit, 1000), 5000));
$$;

revoke all on function public.list_literature_gold_sampling_candidates_v1(text, integer)
  from public, anon, authenticated;
grant execute on function public.list_literature_gold_sampling_candidates_v1(text, integer)
  to service_role;

create or replace function public.create_literature_gold_set_batch_v1(
  p_batch jsonb,
  p_items jsonb,
  p_actor_user_id uuid default null,
  p_actor_email text default null
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, public
as $$
declare
  created_batch public.literature_gold_set_batches%rowtype;
  item jsonb;
  item_count integer;
  requested_size integer;
begin
  if p_batch is null or jsonb_typeof(p_batch) <> 'object' then
    raise exception 'batch must be a JSON object';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'items must be a JSON array';
  end if;

  item_count := jsonb_array_length(p_items);
  requested_size := (p_batch ->> 'requestedSize')::integer;
  if item_count < 1 or item_count > 5000 or item_count <> requested_size then
    raise exception 'item count must equal requested size and be between 1 and 5000';
  end if;
  if (
    select count(distinct value ->> 'pmid')
    from jsonb_array_elements(p_items)
  ) <> item_count then
    raise exception 'sampled PMIDs must be unique';
  end if;

  insert into public.literature_gold_set_batches (
    name,
    kind,
    taxonomy_version,
    label_schema_version,
    relevance_definition_version,
    sampling_algorithm_version,
    sampling_seed,
    requested_size,
    test_percent,
    sampling_report,
    created_by_user_id,
    created_by_email
  )
  values (
    p_batch ->> 'name',
    p_batch ->> 'kind',
    p_batch ->> 'taxonomyVersion',
    p_batch ->> 'labelSchemaVersion',
    p_batch ->> 'relevanceDefinitionVersion',
    p_batch ->> 'samplingAlgorithmVersion',
    (p_batch ->> 'samplingSeed')::bigint,
    requested_size,
    (p_batch ->> 'testPercent')::integer,
    coalesce(p_batch -> 'samplingReport', '{}'::jsonb),
    p_actor_user_id,
    nullif(trim(coalesce(p_actor_email, '')), '')
  )
  returning * into created_batch;

  for item in
    select value
    from jsonb_array_elements(p_items)
  loop
    if item ->> 'pmid' is null or item ->> 'pmid' !~ '^[0-9]{1,12}$' then
      raise exception 'every item needs a valid PMID';
    end if;
    if jsonb_typeof(coalesce(item -> 'samplingMetadata', '{}'::jsonb)) <> 'object' then
      raise exception 'sampling metadata must be a JSON object';
    end if;

    insert into public.literature_gold_set_items (
      batch_id,
      pmid,
      sample_stratum,
      sampling_reason,
      sampling_metadata,
      dataset_split,
      display_order
    )
    values (
      created_batch.id,
      item ->> 'pmid',
      item ->> 'sampleStratum',
      item ->> 'samplingReason',
      coalesce(item -> 'samplingMetadata', '{}'::jsonb),
      item ->> 'datasetSplit',
      (item ->> 'displayOrder')::integer
    );
  end loop;

  insert into public.literature_gold_set_events (
    batch_id,
    actor_user_id,
    actor_email,
    event_type,
    after_value
  )
  values (
    created_batch.id,
    p_actor_user_id,
    nullif(trim(coalesce(p_actor_email, '')), ''),
    'batch_created',
    jsonb_build_object(
      'name', created_batch.name,
      'kind', created_batch.kind,
      'requested_size', created_batch.requested_size,
      'sampling_seed', created_batch.sampling_seed
    )
  );

  return jsonb_build_object(
    'id', created_batch.id,
    'name', created_batch.name,
    'itemCount', item_count,
    'status', created_batch.status
  );
end;
$$;

revoke all on function public.create_literature_gold_set_batch_v1(
  jsonb,
  jsonb,
  uuid,
  text
) from public, anon, authenticated;
grant execute on function public.create_literature_gold_set_batch_v1(
  jsonb,
  jsonb,
  uuid,
  text
) to service_role;

create or replace function public.save_literature_gold_review_v1(
  p_item_id uuid,
  p_actor_user_id uuid,
  p_actor_email text,
  p_review jsonb,
  p_complete boolean default false
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, public
as $$
declare
  locked_item public.literature_gold_set_items%rowtype;
  locked_batch public.literature_gold_set_batches%rowtype;
  created_review public.literature_gold_set_reviews%rowtype;
  prior_review_id uuid;
  next_revision integer;
  relevance text;
  metadata_sufficiency text;
  confidence text;
  topic_ids text[];
  technology_tags text[];
  clinical_purposes text[];
  disease_tags text[];
  study_design text;
  publication_status text;
  notes text;
  used_supplemental boolean;
  review_seconds integer;
begin
  if p_review is null or jsonb_typeof(p_review) <> 'object' then
    raise exception 'review must be a JSON object';
  end if;

  select *
  into locked_item
  from public.literature_gold_set_items as item
  where item.id = p_item_id
  for update;
  if not found then
    raise exception 'gold-set item not found';
  end if;

  select *
  into locked_batch
  from public.literature_gold_set_batches as batch
  where batch.id = locked_item.batch_id;
  if locked_batch.status <> 'active' then
    raise exception 'only active gold-set batches may be reviewed';
  end if;

  if jsonb_typeof(coalesce(p_review -> 'topicIds', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_review -> 'technologyTags', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_review -> 'clinicalPurposes', '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_review -> 'diseaseTags', '[]'::jsonb)) <> 'array' then
    raise exception 'review multi-value fields must be JSON arrays';
  end if;

  relevance := nullif(trim(coalesce(p_review ->> 'relevanceLabel', '')), '');
  metadata_sufficiency := nullif(trim(coalesce(p_review ->> 'metadataSufficiency', '')), '');
  confidence := nullif(trim(coalesce(p_review ->> 'reviewerConfidence', '')), '');
  topic_ids := array(
    select distinct trim(value)
    from jsonb_array_elements_text(coalesce(p_review -> 'topicIds', '[]'::jsonb))
    where trim(value) <> ''
    order by trim(value)
  );
  technology_tags := array(
    select distinct trim(value)
    from jsonb_array_elements_text(coalesce(p_review -> 'technologyTags', '[]'::jsonb))
    where trim(value) <> ''
    order by trim(value)
  );
  clinical_purposes := array(
    select distinct trim(value)
    from jsonb_array_elements_text(coalesce(p_review -> 'clinicalPurposes', '[]'::jsonb))
    where trim(value) <> ''
    order by trim(value)
  );
  disease_tags := array(
    select distinct trim(value)
    from jsonb_array_elements_text(coalesce(p_review -> 'diseaseTags', '[]'::jsonb))
    where trim(value) <> ''
    order by trim(value)
  );
  study_design := nullif(trim(coalesce(p_review ->> 'studyDesign', '')), '');
  publication_status := nullif(trim(coalesce(p_review ->> 'publicationStatus', '')), '');
  notes := trim(coalesce(p_review ->> 'notes', ''));
  used_supplemental := coalesce((p_review ->> 'usedSupplementalMetadata')::boolean, false);
  review_seconds := coalesce((p_review ->> 'reviewSeconds')::integer, 0);

  if relevance is not null
    and relevance not in ('include_core', 'include_adjacent', 'exclude', 'uncertain') then
    raise exception 'invalid relevance label';
  end if;
  if metadata_sufficiency is not null
    and metadata_sufficiency not in (
      'adequate_abstract',
      'limited_abstract',
      'no_abstract',
      'conflicting_metadata'
    ) then
    raise exception 'invalid metadata sufficiency';
  end if;
  if confidence is not null and confidence not in ('high', 'moderate', 'low') then
    raise exception 'invalid reviewer confidence';
  end if;
  if length(notes) > 4000 or review_seconds not between 0 and 86400 then
    raise exception 'review notes or elapsed time are out of range';
  end if;
  if cardinality(topic_ids) > 100
    or cardinality(technology_tags) > 100
    or cardinality(clinical_purposes) > 30
    or cardinality(disease_tags) > 30 then
    raise exception 'too many review labels';
  end if;
  if exists (
    select 1
    from unnest(topic_ids) as supplied(topic_id)
    left join public.literature_topics as topic on topic.id = supplied.topic_id
    where topic.id is null or topic.parent_id is not null
  ) then
    raise exception 'topic labels must be known broad literature topics';
  end if;
  if exists (
    select 1
    from unnest(technology_tags) as supplied(tag)
    where supplied.tag <> all(array[
      'convex-ebus',
      'eus-b',
      'radial-ebus',
      'robotic-bronchoscopy',
      'electromagnetic-navigation',
      'cone-beam-ct',
      'augmented-fluoroscopy',
      'virtual-bronchoscopy',
      'transbronchial-cryobiopsy',
      'endobronchial-valve',
      'airway-stent',
      'rigid-bronchoscopy',
      'electrocautery',
      'argon-plasma-coagulation',
      'laser',
      'cryotherapy',
      'photodynamic-therapy',
      'brachytherapy',
      'indwelling-pleural-catheter',
      'medical-thoracoscopy',
      'bronchial-thermoplasty',
      'whole-lung-lavage',
      'percutaneous-tracheostomy'
    ]::text[])
  ) then
    raise exception 'unknown technology tag';
  end if;
  if exists (
    select 1
    from unnest(clinical_purposes) as supplied(purpose)
    where supplied.purpose <> all(array[
      'diagnosis',
      'staging',
      'treatment',
      'palliation',
      'surveillance',
      'localization',
      'training'
    ]::text[])
  ) then
    raise exception 'unknown clinical purpose';
  end if;
  if exists (
    select 1
    from unnest(disease_tags) as supplied(disease)
    where supplied.disease <> all(array[
      'lung-cancer',
      'mesothelioma',
      'emphysema',
      'interstitial-lung-disease',
      'infection',
      'transplant',
      'benign-airway-stenosis',
      'pleural-disease'
    ]::text[])
  ) then
    raise exception 'unknown disease tag';
  end if;
  if study_design is not null and study_design <> all(array[
    'randomized-trial',
    'prospective-cohort',
    'retrospective-cohort',
    'diagnostic-accuracy',
    'systematic-review',
    'meta-analysis',
    'guideline',
    'consensus',
    'case-series',
    'case-report',
    'technical-note',
    'editorial'
  ]::text[]) then
    raise exception 'unknown study design';
  end if;
  if publication_status is not null and publication_status <> all(array[
    'full-article',
    'conference-abstract',
    'letter',
    'editorial',
    'correction',
    'retraction',
    'protocol'
  ]::text[]) then
    raise exception 'unknown publication status';
  end if;
  if used_supplemental and locked_item.supplemental_metadata_revealed_at is null then
    raise exception 'supplemental metadata must be revealed before recording its use';
  end if;
  if locked_item.supplemental_metadata_revealed_at is not null
    and not used_supplemental then
    raise exception 'revealed supplemental metadata must be recorded as used';
  end if;

  if not p_complete then
    insert into public.literature_gold_set_review_drafts (
      item_id,
      reviewer_user_id,
      reviewer_email,
      relevance_label,
      metadata_sufficiency,
      reviewer_confidence,
      topic_ids,
      technology_tags,
      clinical_purposes,
      disease_tags,
      study_design,
      publication_status,
      notes,
      used_supplemental_metadata,
      review_seconds
    )
    values (
      p_item_id,
      p_actor_user_id,
      nullif(trim(coalesce(p_actor_email, '')), ''),
      relevance,
      metadata_sufficiency,
      confidence,
      topic_ids,
      technology_tags,
      clinical_purposes,
      disease_tags,
      study_design,
      publication_status,
      notes,
      used_supplemental,
      review_seconds
    )
    on conflict (item_id)
    do update set
      reviewer_user_id = excluded.reviewer_user_id,
      reviewer_email = excluded.reviewer_email,
      relevance_label = excluded.relevance_label,
      metadata_sufficiency = excluded.metadata_sufficiency,
      reviewer_confidence = excluded.reviewer_confidence,
      topic_ids = excluded.topic_ids,
      technology_tags = excluded.technology_tags,
      clinical_purposes = excluded.clinical_purposes,
      disease_tags = excluded.disease_tags,
      study_design = excluded.study_design,
      publication_status = excluded.publication_status,
      notes = excluded.notes,
      used_supplemental_metadata = excluded.used_supplemental_metadata,
      review_seconds = excluded.review_seconds,
      updated_at = now();

    update public.literature_gold_set_items
    set
      review_status = 'in_progress',
      started_at = coalesce(started_at, now())
    where id = p_item_id;

    insert into public.literature_gold_set_events (
      batch_id,
      item_id,
      actor_user_id,
      actor_email,
      event_type,
      after_value
    )
    values (
      locked_item.batch_id,
      p_item_id,
      p_actor_user_id,
      nullif(trim(coalesce(p_actor_email, '')), ''),
      'draft_saved',
      jsonb_build_object('review_seconds', review_seconds)
    );

    return jsonb_build_object(
      'itemId', p_item_id,
      'reviewStatus', 'in_progress',
      'saved', true,
      'completed', false
    );
  end if;

  if relevance is null or metadata_sufficiency is null or confidence is null then
    raise exception 'relevance, metadata sufficiency, and confidence are required';
  end if;
  if relevance in ('include_core', 'include_adjacent') then
    if cardinality(topic_ids) = 0
      or cardinality(clinical_purposes) = 0
      or study_design is null
      or publication_status is null then
      raise exception 'included articles require topic, purpose, study design, and publication status';
    end if;
  elsif cardinality(topic_ids) > 0
    or cardinality(technology_tags) > 0
    or cardinality(clinical_purposes) > 0
    or cardinality(disease_tags) > 0
    or study_design is not null
    or publication_status is not null then
    raise exception 'categorization labels are only valid for included articles';
  end if;
  if locked_item.current_review_id is null
    and locked_item.automated_signals_revealed_at is not null then
    raise exception 'the first completed review must remain blinded';
  end if;

  prior_review_id := locked_item.current_review_id;
  select coalesce(max(review.revision), 0) + 1
  into next_revision
  from public.literature_gold_set_reviews as review
  where review.item_id = p_item_id;

  insert into public.literature_gold_set_reviews (
    item_id,
    revision,
    supersedes_review_id,
    reviewer_user_id,
    reviewer_email,
    relevance_label,
    metadata_sufficiency,
    reviewer_confidence,
    topic_ids,
    technology_tags,
    clinical_purposes,
    disease_tags,
    study_design,
    publication_status,
    notes,
    used_supplemental_metadata,
    review_seconds,
    is_blinded,
    started_at
  )
  values (
    p_item_id,
    next_revision,
    prior_review_id,
    p_actor_user_id,
    nullif(trim(coalesce(p_actor_email, '')), ''),
    relevance,
    metadata_sufficiency,
    confidence,
    topic_ids,
    technology_tags,
    clinical_purposes,
    disease_tags,
    study_design,
    publication_status,
    notes,
    used_supplemental,
    review_seconds,
    locked_item.automated_signals_revealed_at is null,
    case
      when prior_review_id is null then coalesce(locked_item.started_at, now())
      else now() - make_interval(secs => review_seconds)
    end
  )
  returning * into created_review;

  update public.literature_gold_set_items
  set
    review_status = 'completed',
    current_review_id = created_review.id,
    started_at = coalesce(started_at, created_review.started_at),
    completed_at = created_review.completed_at
  where id = p_item_id;

  delete from public.literature_gold_set_review_drafts
  where item_id = p_item_id;

  insert into public.literature_gold_set_events (
    batch_id,
    item_id,
    actor_user_id,
    actor_email,
    event_type,
    before_value,
    after_value
  )
  values (
    locked_item.batch_id,
    p_item_id,
    p_actor_user_id,
    nullif(trim(coalesce(p_actor_email, '')), ''),
    case when prior_review_id is null then 'review_completed' else 'review_revised' end,
    case
      when prior_review_id is null then null
      else jsonb_build_object('review_id', prior_review_id)
    end,
    jsonb_build_object(
      'review_id', created_review.id,
      'revision', created_review.revision,
      'relevance_label', created_review.relevance_label,
      'is_blinded', created_review.is_blinded
    )
  );

  return jsonb_build_object(
    'itemId', p_item_id,
    'reviewId', created_review.id,
    'revision', created_review.revision,
    'reviewStatus', 'completed',
    'saved', true,
    'completed', true,
    'isBlinded', created_review.is_blinded
  );
end;
$$;

revoke all on function public.save_literature_gold_review_v1(
  uuid,
  uuid,
  text,
  jsonb,
  boolean
) from public, anon, authenticated;
grant execute on function public.save_literature_gold_review_v1(
  uuid,
  uuid,
  text,
  jsonb,
  boolean
) to service_role;

create or replace function public.update_literature_gold_item_v1(
  p_item_id uuid,
  p_actor_user_id uuid,
  p_actor_email text,
  p_action text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, public
as $$
declare
  locked_item public.literature_gold_set_items%rowtype;
  batch_status text;
  next_status text;
  event_name text;
begin
  if p_action not in (
    'return_later',
    'resume',
    'reveal_supplemental',
    'reveal_automated'
  ) then
    raise exception 'invalid gold-set item action';
  end if;

  select *
  into locked_item
  from public.literature_gold_set_items as item
  where item.id = p_item_id
  for update;
  if not found then
    raise exception 'gold-set item not found';
  end if;

  select status
  into batch_status
  from public.literature_gold_set_batches
  where id = locked_item.batch_id;
  if batch_status <> 'active' then
    raise exception 'only active gold-set batches may be changed';
  end if;

  if p_action = 'return_later' then
    if locked_item.current_review_id is not null then
      raise exception 'completed items cannot be returned later';
    end if;
    next_status := 'return_later';
    event_name := 'returned_later';
    update public.literature_gold_set_items
    set review_status = next_status
    where id = p_item_id;
  elsif p_action = 'resume' then
    if locked_item.current_review_id is not null then
      raise exception 'completed items do not need to be resumed';
    end if;
    next_status := case
      when exists (
        select 1
        from public.literature_gold_set_review_drafts
        where item_id = p_item_id
      ) then 'in_progress'
      else 'pending'
    end;
    event_name := 'review_resumed';
    update public.literature_gold_set_items
    set review_status = next_status
    where id = p_item_id;
  elsif p_action = 'reveal_supplemental' then
    next_status := case
      when locked_item.current_review_id is null and locked_item.review_status = 'pending'
        then 'in_progress'
      else locked_item.review_status
    end;
    event_name := 'supplemental_metadata_revealed';
    update public.literature_gold_set_items
    set
      supplemental_metadata_revealed_at = coalesce(supplemental_metadata_revealed_at, now()),
      started_at = coalesce(started_at, now()),
      review_status = case
        when current_review_id is null and review_status = 'pending' then 'in_progress'
        else review_status
      end
    where id = p_item_id;
  else
    if locked_item.current_review_id is null then
      raise exception 'automated signals may only be revealed after the first completed review';
    end if;
    next_status := locked_item.review_status;
    event_name := 'automated_signals_revealed';
    update public.literature_gold_set_items
    set automated_signals_revealed_at = coalesce(automated_signals_revealed_at, now())
    where id = p_item_id;
  end if;

  insert into public.literature_gold_set_events (
    batch_id,
    item_id,
    actor_user_id,
    actor_email,
    event_type,
    before_value,
    after_value
  )
  values (
    locked_item.batch_id,
    p_item_id,
    p_actor_user_id,
    nullif(trim(coalesce(p_actor_email, '')), ''),
    event_name,
    jsonb_build_object('review_status', locked_item.review_status),
    jsonb_build_object('review_status', next_status)
  );

  return jsonb_build_object(
    'itemId', p_item_id,
    'reviewStatus', next_status,
    'action', p_action
  );
end;
$$;

revoke all on function public.update_literature_gold_item_v1(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.update_literature_gold_item_v1(uuid, uuid, text, text)
  to service_role;

create or replace function public.freeze_literature_gold_batch_v1(
  p_batch_id uuid,
  p_actor_user_id uuid default null,
  p_actor_email text default null
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, public
as $$
declare
  locked_batch public.literature_gold_set_batches%rowtype;
  total_count integer;
  incomplete_count integer;
  draft_count integer;
  freeze_time timestamptz := now();
begin
  select *
  into locked_batch
  from public.literature_gold_set_batches as batch
  where batch.id = p_batch_id
  for update;
  if not found then
    raise exception 'gold-set batch not found';
  end if;
  if locked_batch.status = 'frozen' then
    return jsonb_build_object(
      'batchId', p_batch_id,
      'status', 'frozen',
      'frozenAt', locked_batch.frozen_at
    );
  end if;
  if locked_batch.status <> 'active' then
    raise exception 'only active gold-set batches can be frozen';
  end if;

  select
    count(*)::integer,
    count(*) filter (where review_status <> 'completed')::integer
  into total_count, incomplete_count
  from public.literature_gold_set_items
  where batch_id = p_batch_id;

  select count(*)::integer
  into draft_count
  from public.literature_gold_set_review_drafts as draft
  join public.literature_gold_set_items as item on item.id = draft.item_id
  where item.batch_id = p_batch_id;

  if total_count = 0 or incomplete_count > 0 or draft_count > 0 then
    raise exception 'a batch can only be frozen after every item is completed and drafts are cleared';
  end if;

  update public.literature_gold_set_batches
  set status = 'frozen', frozen_at = freeze_time
  where id = p_batch_id;

  insert into public.literature_gold_set_events (
    batch_id,
    actor_user_id,
    actor_email,
    event_type,
    before_value,
    after_value
  )
  values (
    p_batch_id,
    p_actor_user_id,
    nullif(trim(coalesce(p_actor_email, '')), ''),
    'batch_frozen',
    jsonb_build_object('status', locked_batch.status),
    jsonb_build_object('status', 'frozen', 'frozen_at', freeze_time)
  );

  return jsonb_build_object(
    'batchId', p_batch_id,
    'status', 'frozen',
    'frozenAt', freeze_time,
    'itemCount', total_count
  );
end;
$$;

revoke all on function public.freeze_literature_gold_batch_v1(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.freeze_literature_gold_batch_v1(uuid, uuid, text)
  to service_role;

create or replace function public.list_literature_gold_batches_v1()
returns table (
  id uuid,
  name text,
  kind text,
  status text,
  requested_size integer,
  total_count integer,
  completed_count integer,
  remaining_count integer,
  return_later_count integer,
  development_count integer,
  test_count integer,
  sampling_seed bigint,
  sampling_report jsonb,
  created_at timestamptz,
  frozen_at timestamptz
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select
    batch.id,
    batch.name,
    batch.kind,
    batch.status,
    batch.requested_size,
    count(item.id)::integer as total_count,
    count(item.id) filter (where item.review_status = 'completed')::integer
      as completed_count,
    count(item.id) filter (where item.review_status <> 'completed')::integer
      as remaining_count,
    count(item.id) filter (where item.review_status = 'return_later')::integer
      as return_later_count,
    count(item.id) filter (where item.dataset_split = 'development')::integer
      as development_count,
    count(item.id) filter (where item.dataset_split = 'test')::integer
      as test_count,
    batch.sampling_seed,
    batch.sampling_report,
    batch.created_at,
    batch.frozen_at
  from public.literature_gold_set_batches as batch
  left join public.literature_gold_set_items as item on item.batch_id = batch.id
  group by batch.id
  order by batch.created_at desc, batch.id;
$$;

revoke all on function public.list_literature_gold_batches_v1()
  from public, anon, authenticated;
grant execute on function public.list_literature_gold_batches_v1()
  to service_role;

create or replace function public.get_literature_gold_review_item_v1(
  p_batch_id uuid default null,
  p_item_id uuid default null,
  p_status text default 'unresolved',
  p_split text default 'development'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  selected_item public.literature_gold_set_items%rowtype;
  selected_batch public.literature_gold_set_batches%rowtype;
  selected_article public.literature_articles%rowtype;
  draft_json jsonb;
  current_review_json jsonb;
  history_json jsonb;
  automated_json jsonb;
  total_count integer;
  completed_count integer;
  remaining_count integer;
  previous_item_id uuid;
  next_item_id uuid;
  next_unresolved_item_id uuid;
  queue_position integer;
begin
  if p_status not in ('all', 'unresolved', 'return_later', 'completed') then
    raise exception 'invalid gold-set review filter';
  end if;
  if p_split not in ('development', 'test', 'all') then
    raise exception 'invalid gold-set dataset split';
  end if;

  if p_batch_id is null and p_item_id is not null then
    select batch.*
    into selected_batch
    from public.literature_gold_set_batches as batch
    join public.literature_gold_set_items as item on item.batch_id = batch.id
    where item.id = p_item_id;
  elsif p_batch_id is null then
    select *
    into selected_batch
    from public.literature_gold_set_batches as batch
    order by
      case when batch.status = 'active' then 0 else 1 end,
      batch.created_at desc
    limit 1;
  else
    select *
    into selected_batch
    from public.literature_gold_set_batches as batch
    where batch.id = p_batch_id;
  end if;
  if not found then
    return null;
  end if;

  if p_item_id is not null then
    select *
    into selected_item
    from public.literature_gold_set_items as item
    where item.id = p_item_id
      and item.batch_id = selected_batch.id;
  else
    select *
    into selected_item
    from public.literature_gold_set_items as item
    where item.batch_id = selected_batch.id
      and (p_split = 'all' or item.dataset_split = p_split)
      and (
        p_status = 'all'
        or (p_status = 'unresolved' and item.review_status <> 'completed')
        or (p_status = 'return_later' and item.review_status = 'return_later')
        or (p_status = 'completed' and item.review_status = 'completed')
      )
    order by item.display_order
    limit 1;
  end if;
  if not found then
    return jsonb_build_object(
      'batchId', selected_batch.id,
      'batchName', selected_batch.name,
      'batchStatus', selected_batch.status,
      'item', null
    );
  end if;

  select *
  into selected_article
  from public.literature_articles as article
  where article.pmid = selected_item.pmid;

  select
    count(*)::integer,
    count(*) filter (where item.review_status = 'completed')::integer,
    count(*) filter (where item.review_status <> 'completed')::integer,
    count(*) filter (where item.display_order <= selected_item.display_order)::integer
  into total_count, completed_count, remaining_count, queue_position
  from public.literature_gold_set_items as item
  where item.batch_id = selected_batch.id
    and (p_split = 'all' or item.dataset_split = p_split);

  select item.id
  into previous_item_id
  from public.literature_gold_set_items as item
  where item.batch_id = selected_batch.id
    and (p_split = 'all' or item.dataset_split = p_split)
    and item.display_order < selected_item.display_order
  order by item.display_order desc
  limit 1;

  select item.id
  into next_item_id
  from public.literature_gold_set_items as item
  where item.batch_id = selected_batch.id
    and (p_split = 'all' or item.dataset_split = p_split)
    and item.display_order > selected_item.display_order
  order by item.display_order
  limit 1;

  select item.id
  into next_unresolved_item_id
  from public.literature_gold_set_items as item
  where item.batch_id = selected_batch.id
    and (p_split = 'all' or item.dataset_split = p_split)
    and item.review_status <> 'completed'
    and item.id <> selected_item.id
  order by
    case when item.display_order > selected_item.display_order then 0 else 1 end,
    item.display_order
  limit 1;

  select jsonb_build_object(
    'relevanceLabel', draft.relevance_label,
    'metadataSufficiency', draft.metadata_sufficiency,
    'reviewerConfidence', draft.reviewer_confidence,
    'topicIds', draft.topic_ids,
    'technologyTags', draft.technology_tags,
    'clinicalPurposes', draft.clinical_purposes,
    'diseaseTags', draft.disease_tags,
    'studyDesign', draft.study_design,
    'publicationStatus', draft.publication_status,
    'notes', draft.notes,
    'usedSupplementalMetadata', draft.used_supplemental_metadata,
    'reviewSeconds', draft.review_seconds
  )
  into draft_json
  from public.literature_gold_set_review_drafts as draft
  where draft.item_id = selected_item.id;

  select jsonb_build_object(
    'id', review.id,
    'revision', review.revision,
    'reviewerEmail', review.reviewer_email,
    'relevanceLabel', review.relevance_label,
    'metadataSufficiency', review.metadata_sufficiency,
    'reviewerConfidence', review.reviewer_confidence,
    'topicIds', review.topic_ids,
    'technologyTags', review.technology_tags,
    'clinicalPurposes', review.clinical_purposes,
    'diseaseTags', review.disease_tags,
    'studyDesign', review.study_design,
    'publicationStatus', review.publication_status,
    'notes', review.notes,
    'usedSupplementalMetadata', review.used_supplemental_metadata,
    'reviewSeconds', review.review_seconds,
    'isBlinded', review.is_blinded,
    'completedAt', review.completed_at
  )
  into current_review_json
  from public.literature_gold_set_reviews as review
  where review.id = selected_item.current_review_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', review.id,
        'revision', review.revision,
        'reviewerEmail', review.reviewer_email,
        'relevanceLabel', review.relevance_label,
        'metadataSufficiency', review.metadata_sufficiency,
        'reviewerConfidence', review.reviewer_confidence,
        'topicIds', review.topic_ids,
        'technologyTags', review.technology_tags,
        'clinicalPurposes', review.clinical_purposes,
        'diseaseTags', review.disease_tags,
        'studyDesign', review.study_design,
        'publicationStatus', review.publication_status,
        'notes', review.notes,
        'usedSupplementalMetadata', review.used_supplemental_metadata,
        'reviewSeconds', review.review_seconds,
        'isBlinded', review.is_blinded,
        'completedAt', review.completed_at
      )
      order by review.revision desc
    ),
    '[]'::jsonb
  )
  into history_json
  from public.literature_gold_set_reviews as review
  where review.item_id = selected_item.id;

  if selected_item.current_review_id is not null
    and selected_item.automated_signals_revealed_at is not null then
    automated_json := jsonb_build_object(
      'sampleStratum', selected_item.sample_stratum,
      'samplingReason', selected_item.sampling_reason,
      'samplingMetadata', selected_item.sampling_metadata,
      'sources', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'sourceKind', source.source_kind,
            'sourceId', source.source_id,
            'queryId', source.query_id,
            'sourceFilename', source.source_filename
          )
          order by source.source_kind, source.source_filename
        )
        from public.literature_article_sources as source
        where source.pmid = selected_item.pmid
      ), '[]'::jsonb),
      'suggestions', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'topicId', assignment.topic_id,
            'confidence', assignment.confidence,
            'assignmentSource', assignment.assignment_source,
            'evidence', assignment.evidence
          )
          order by assignment.confidence desc nulls last, assignment.topic_id
        )
        from public.literature_article_topics as assignment
        where assignment.pmid = selected_item.pmid
          and assignment.assignment_state = 'suggested'
          and assignment.assignment_source in ('query', 'rule', 'ai')
      ), '[]'::jsonb)
    );
  end if;

  return jsonb_build_object(
    'id', selected_item.id,
    'batchId', selected_batch.id,
    'batchName', selected_batch.name,
    'batchStatus', selected_batch.status,
    'displayOrder', queue_position,
    'totalCount', total_count,
    'completedCount', completed_count,
    'remainingCount', remaining_count,
    'reviewStatus', selected_item.review_status,
    'article', jsonb_build_object(
      'pmid', selected_article.pmid,
      'title', selected_article.title,
      'abstract', selected_article.abstract,
      'authors', selected_article.authors,
      'journalTitle', selected_article.journal_title,
      'journalAbbreviation', selected_article.journal_abbreviation,
      'publicationYear', selected_article.publication_year,
      'publicationTypes', selected_article.publication_types,
      'meshTerms', case
        when selected_item.supplemental_metadata_revealed_at is null then null
        else to_jsonb(selected_article.mesh_terms)
      end,
      'authorKeywords', case
        when selected_item.supplemental_metadata_revealed_at is null then null
        else to_jsonb(selected_article.author_keywords)
      end
    ),
    'draft', draft_json,
    'currentReview', current_review_json,
    'reviewHistory', history_json,
    'supplementalMetadataRevealed',
      selected_item.supplemental_metadata_revealed_at is not null,
    'automatedSignalsRevealed',
      selected_item.automated_signals_revealed_at is not null,
    'automatedSignals', automated_json,
    'previousItemId', previous_item_id,
    'nextItemId', next_item_id,
    'nextUnresolvedItemId', next_unresolved_item_id
  );
end;
$$;

revoke all on function public.get_literature_gold_review_item_v1(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.get_literature_gold_review_item_v1(uuid, uuid, text, text)
  to service_role;

alter table public.literature_gold_set_batches enable row level security;
alter table public.literature_gold_set_items enable row level security;
alter table public.literature_gold_set_review_drafts enable row level security;
alter table public.literature_gold_set_reviews enable row level security;
alter table public.literature_gold_set_events enable row level security;

revoke all on table public.literature_gold_set_batches from public, anon, authenticated;
revoke all on table public.literature_gold_set_items from public, anon, authenticated;
revoke all on table public.literature_gold_set_review_drafts from public, anon, authenticated;
revoke all on table public.literature_gold_set_reviews from public, anon, authenticated;
revoke all on table public.literature_gold_set_events from public, anon, authenticated;

grant select, insert, update, delete
  on table public.literature_gold_set_batches to service_role;
grant select, insert, update, delete
  on table public.literature_gold_set_items to service_role;
grant select, insert, update, delete
  on table public.literature_gold_set_review_drafts to service_role;
grant select, insert, update, delete
  on table public.literature_gold_set_reviews to service_role;
grant select, insert, update, delete
  on table public.literature_gold_set_events to service_role;

notify pgrst, 'reload schema';
