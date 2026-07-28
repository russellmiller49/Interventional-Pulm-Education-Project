create extension if not exists pg_trgm with schema extensions;

create table public.literature_journals (
  id text primary key,
  canonical_name text not null,
  pubmed_abbreviation text,
  nlm_id text,
  issn_print text,
  issn_electronic text,
  aliases text[] not null default '{}'::text[],
  source_tier text not null,
  active_from integer,
  active_to integer,
  notes text,
  registry_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint literature_journals_id_check check (id ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint literature_journals_source_tier_check check (
    source_tier in (
      'core',
      'optional_core_continuity',
      'expanded',
      'core_historical_gap',
      'core_non_pubmed',
      'other'
    )
  ),
  constraint literature_journals_active_years_check check (
    active_from is null or active_to is null or active_from <= active_to
  )
);

create table public.literature_articles (
  pmid text primary key,
  doi text,
  pmcid text,
  title text not null,
  abstract text,
  abstract_display_policy text not null default 'snippet_only',
  journal_id text references public.literature_journals(id) on update cascade on delete set null,
  journal_title text,
  journal_abbreviation text,
  nlm_journal_id text,
  issn_values text[] not null default '{}'::text[],
  publication_date_raw text,
  publication_year integer,
  publication_month integer,
  publication_day integer,
  publication_date_precision text not null default 'unknown',
  publication_types text[] not null default '{}'::text[],
  mesh_terms text[] not null default '{}'::text[],
  author_keywords text[] not null default '{}'::text[],
  languages text[] not null default '{}'::text[],
  authors jsonb not null default '[]'::jsonb,
  collective_authors text[] not null default '{}'::text[],
  affiliations text[] not null default '{}'::text[],
  volume text,
  issue text,
  pages text,
  article_number text,
  place_of_publication text,
  citation_source text,
  conflict_of_interest text,
  pubmed_status text,
  pubmed_last_revised_at timestamptz,
  pubmed_created_at timestamptz,
  raw_nbib_tags jsonb not null default '{}'::jsonb,
  metadata_hash text not null,
  normalized_title text not null,
  normalized_title_hash text not null,
  relevance_state text not null default 'unreviewed',
  visibility_state text not null default 'draft',
  curation_reason text,
  is_landmark boolean not null default false,
  is_retracted boolean not null default false,
  is_correction boolean not null default false,
  is_conference_abstract boolean not null default false,
  manual_override boolean not null default false,
  classifier_version text,
  classifier_payload jsonb,
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint literature_articles_pmid_check check (pmid ~ '^[0-9]{1,12}$'),
  constraint literature_articles_title_check check (
    length(trim(title)) > 0 and length(title) <= 50000
  ),
  constraint literature_articles_abstract_check check (
    abstract is null or length(abstract) <= 2000000
  ),
  constraint literature_articles_abstract_policy_check check (
    abstract_display_policy in ('hidden', 'snippet_only', 'full_allowed')
  ),
  constraint literature_articles_date_precision_check check (
    publication_date_precision in ('day', 'month', 'year', 'season', 'unknown')
  ),
  constraint literature_articles_year_check check (
    publication_year is null or publication_year between 1800 and 3000
  ),
  constraint literature_articles_month_check check (
    publication_month is null or publication_month between 1 and 12
  ),
  constraint literature_articles_day_check check (
    publication_day is null or publication_day between 1 and 31
  ),
  constraint literature_articles_authors_check check (jsonb_typeof(authors) = 'array'),
  constraint literature_articles_raw_tags_check check (jsonb_typeof(raw_nbib_tags) = 'object'),
  constraint literature_articles_metadata_hash_check check (
    metadata_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint literature_articles_normalized_title_hash_check check (
    normalized_title_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint literature_articles_relevance_state_check check (
    relevance_state in ('unreviewed', 'candidate', 'included', 'excluded')
  ),
  constraint literature_articles_visibility_state_check check (
    visibility_state in ('draft', 'published', 'hidden')
  ),
  constraint literature_articles_classifier_payload_check check (
    classifier_payload is null or jsonb_typeof(classifier_payload) = 'object'
  )
);

create table public.literature_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_filename text not null,
  source_file_sha256 text not null,
  manifest_version text not null,
  query_registry_version text,
  source_kind text not null,
  source_id text,
  query_id text,
  date_from date,
  date_to date,
  status text not null default 'started',
  records_read integer not null default 0,
  unique_pmids integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  duplicate_count integer not null default 0,
  error_count integer not null default 0,
  record_limit integer,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  report jsonb,
  created_by text,
  constraint literature_import_batches_source_filename_check check (
    length(trim(source_filename)) > 0 and length(source_filename) <= 4096
  ),
  constraint literature_import_batches_sha_check check (
    source_file_sha256 ~ '^[a-f0-9]{64}$'
  ),
  constraint literature_import_batches_source_kind_check check (
    source_kind in (
      'core_journal',
      'expanded_journal',
      'all_pubmed_discovery',
      'manual_landmark',
      'publisher_supplement',
      'unmapped'
    )
  ),
  constraint literature_import_batches_status_check check (
    status in ('started', 'completed', 'failed', 'skipped')
  ),
  constraint literature_import_batches_counts_check check (
    records_read >= 0
    and unique_pmids >= 0
    and inserted_count >= 0
    and updated_count >= 0
    and duplicate_count >= 0
    and error_count >= 0
  ),
  constraint literature_import_batches_dates_check check (
    date_from is null or date_to is null or date_from <= date_to
  ),
  constraint literature_import_batches_record_limit_check check (
    record_limit is null or record_limit > 0
  ),
  constraint literature_import_batches_report_check check (
    report is null or jsonb_typeof(report) = 'object'
  )
);

create unique index literature_import_batches_identity_uidx
  on public.literature_import_batches (
    source_file_sha256,
    manifest_version,
    coalesce(query_registry_version, ''),
    source_kind,
    coalesce(source_id, ''),
    coalesce(query_id, ''),
    coalesce(record_limit, -1)
  )
  where status = 'completed';

create table public.literature_article_sources (
  pmid text not null references public.literature_articles(pmid) on update cascade on delete cascade,
  batch_id uuid not null references public.literature_import_batches(id) on delete cascade,
  source_kind text not null,
  source_id text,
  query_id text,
  source_filename text not null,
  first_seen_at timestamptz not null default now(),
  primary key (pmid, batch_id),
  constraint literature_article_sources_source_kind_check check (
    source_kind in (
      'core_journal',
      'expanded_journal',
      'all_pubmed_discovery',
      'manual_landmark',
      'publisher_supplement',
      'unmapped'
    )
  )
);

create table public.literature_topics (
  id text primary key,
  parent_id text references public.literature_topics(id) on update cascade on delete restrict,
  label_en text not null,
  label_es text,
  label_zh_cn text,
  description_en text,
  synonyms text[] not null default '{}'::text[],
  taxonomy_version text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint literature_topics_id_check check (
    id ~ '^[a-z0-9][a-z0-9.-]*$'
  ),
  constraint literature_topics_label_en_check check (length(trim(label_en)) > 0)
);

create table public.literature_article_topics (
  pmid text not null references public.literature_articles(pmid) on update cascade on delete cascade,
  topic_id text not null references public.literature_topics(id) on update cascade on delete restrict,
  confidence numeric,
  assignment_source text not null,
  assignment_state text not null default 'suggested',
  model_or_rule_version text not null,
  evidence jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (pmid, topic_id, assignment_source, model_or_rule_version),
  constraint literature_article_topics_confidence_check check (
    confidence is null or confidence between 0 and 1
  ),
  constraint literature_article_topics_source_check check (
    assignment_source in ('query', 'rule', 'ai', 'human')
  ),
  constraint literature_article_topics_state_check check (
    assignment_state in ('suggested', 'confirmed', 'rejected')
  ),
  constraint literature_article_topics_evidence_check check (
    evidence is null or jsonb_typeof(evidence) = 'object'
  )
);

create table public.literature_curation_events (
  id uuid primary key default gen_random_uuid(),
  pmid text not null references public.literature_articles(pmid) on update cascade on delete cascade,
  actor_user_id uuid,
  actor_email text,
  event_type text not null,
  before_value jsonb,
  after_value jsonb,
  reason text,
  created_at timestamptz not null default now(),
  constraint literature_curation_events_event_type_check check (
    event_type in (
      'relevance_changed',
      'visibility_changed',
      'landmark_changed',
      'topic_confirmed',
      'topic_rejected',
      'bulk_review'
    )
  ),
  constraint literature_curation_events_before_check check (
    before_value is null or jsonb_typeof(before_value) in ('object', 'array', 'string', 'number', 'boolean', 'null')
  ),
  constraint literature_curation_events_after_check check (
    after_value is null or jsonb_typeof(after_value) in ('object', 'array', 'string', 'number', 'boolean', 'null')
  ),
  constraint literature_curation_events_reason_check check (
    reason is null or length(reason) <= 2000
  )
);

create table public.literature_import_errors (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.literature_import_batches(id) on delete cascade,
  source_filename text,
  record_number integer,
  pmid text,
  error_code text not null,
  error_message text not null,
  raw_excerpt text,
  created_at timestamptz not null default now(),
  constraint literature_import_errors_record_number_check check (
    record_number is null or record_number > 0
  ),
  constraint literature_import_errors_excerpt_check check (
    raw_excerpt is null or length(raw_excerpt) <= 4000
  )
);

create index literature_articles_publication_year_idx
  on public.literature_articles (publication_year);
create index literature_articles_journal_id_idx
  on public.literature_articles (journal_id);
create index literature_articles_workflow_idx
  on public.literature_articles (relevance_state, visibility_state, publication_year desc);
create index literature_articles_review_queue_idx
  on public.literature_articles (relevance_state, updated_at desc, pmid);
create index literature_articles_doi_idx
  on public.literature_articles (doi)
  where doi is not null;
create index literature_articles_publication_types_idx
  on public.literature_articles using gin (publication_types);
create index literature_articles_mesh_terms_idx
  on public.literature_articles using gin (mesh_terms);
create index literature_articles_author_keywords_idx
  on public.literature_articles using gin (author_keywords);
create index literature_articles_normalized_title_trgm_idx
  on public.literature_articles using gin (normalized_title extensions.gin_trgm_ops);
create index literature_article_sources_batch_id_idx
  on public.literature_article_sources (batch_id);
create index literature_article_sources_query_id_idx
  on public.literature_article_sources (query_id, pmid)
  where query_id is not null;
create index literature_article_sources_source_id_idx
  on public.literature_article_sources (source_id, pmid)
  where source_id is not null;
create index literature_import_batches_status_started_idx
  on public.literature_import_batches (status, started_at desc);
create index literature_topics_parent_id_idx
  on public.literature_topics (parent_id)
  where parent_id is not null;
create index literature_article_topics_topic_state_idx
  on public.literature_article_topics (topic_id, assignment_state, pmid);
create index literature_curation_events_pmid_created_idx
  on public.literature_curation_events (pmid, created_at desc);
create index literature_curation_events_actor_created_idx
  on public.literature_curation_events (actor_user_id, created_at desc)
  where actor_user_id is not null;
create index literature_import_errors_batch_id_idx
  on public.literature_import_errors (batch_id, created_at);

create or replace function public.literature_articles_search_vector_update()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A')
    || setweight(
      to_tsvector(
        'english',
        coalesce(array_to_string(new.mesh_terms, ' '), '')
        || ' '
        || coalesce(array_to_string(new.author_keywords, ' '), '')
      ),
      'B'
    )
    || setweight(to_tsvector('english', coalesce(new.abstract, '')), 'C')
    || setweight(
      to_tsvector(
        'english',
        coalesce(new.journal_title, '')
        || ' '
        || coalesce(new.journal_abbreviation, '')
        || ' '
        || coalesce(new.doi, '')
        || ' '
        || coalesce(new.pmid, '')
        || ' '
        || coalesce(new.authors::text, '')
        || ' '
        || coalesce(array_to_string(new.collective_authors, ' '), '')
      ),
      'D'
    );
  return new;
end;
$$;

revoke execute on function public.literature_articles_search_vector_update()
  from public, anon, authenticated;

create trigger set_literature_articles_search_vector
  before insert or update of
    title,
    abstract,
    mesh_terms,
    author_keywords,
    journal_title,
    journal_abbreviation,
    doi,
    pmid,
    authors,
    collective_authors
  on public.literature_articles
  for each row
  execute function public.literature_articles_search_vector_update();

create index literature_articles_search_vector_idx
  on public.literature_articles using gin (search_vector);

create or replace function public.set_literature_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_literature_updated_at()
  from public, anon, authenticated;

create trigger set_literature_journals_updated_at
  before update on public.literature_journals
  for each row
  execute function public.set_literature_updated_at();

create trigger set_literature_articles_updated_at
  before update on public.literature_articles
  for each row
  execute function public.set_literature_updated_at();

create trigger set_literature_topics_updated_at
  before update on public.literature_topics
  for each row
  execute function public.set_literature_updated_at();

create trigger set_literature_article_topics_updated_at
  before update on public.literature_article_topics
  for each row
  execute function public.set_literature_updated_at();

create or replace function public.prevent_literature_curation_event_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'literature_curation_events is append-only';
end;
$$;

revoke execute on function public.prevent_literature_curation_event_mutation()
  from public, anon, authenticated;

create trigger prevent_literature_curation_event_update
  before update or delete on public.literature_curation_events
  for each row
  execute function public.prevent_literature_curation_event_mutation();

create or replace function public.curate_literature_article_v1(
  p_pmid text,
  p_actor_user_id uuid,
  p_actor_email text,
  p_relevance_state text default null,
  p_visibility_state text default null,
  p_is_landmark boolean default null,
  p_topic_decisions jsonb default '[]'::jsonb,
  p_reason text default null
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, public
as $$
declare
  current_article public.literature_articles%rowtype;
  decision jsonb;
  decision_topic_id text;
  decision_state text;
  prior_topic_state text;
  next_relevance_state text;
  next_visibility_state text;
  next_landmark boolean;
begin
  if p_pmid is null or p_pmid !~ '^[0-9]{1,12}$' then
    raise exception 'invalid PMID';
  end if;
  if p_reason is not null and length(p_reason) > 2000 then
    raise exception 'curation reason is too long';
  end if;
  if p_topic_decisions is null or jsonb_typeof(p_topic_decisions) <> 'array' then
    raise exception 'topic decisions must be a JSON array';
  end if;

  select *
  into current_article
  from public.literature_articles
  where literature_articles.pmid = p_pmid
  for update;

  if not found then
    raise exception 'literature article not found';
  end if;

  next_relevance_state := coalesce(p_relevance_state, current_article.relevance_state);
  next_visibility_state := coalesce(p_visibility_state, current_article.visibility_state);
  next_landmark := coalesce(p_is_landmark, current_article.is_landmark);

  if next_relevance_state not in ('unreviewed', 'candidate', 'included', 'excluded') then
    raise exception 'invalid relevance state';
  end if;
  if next_visibility_state not in ('draft', 'published', 'hidden') then
    raise exception 'invalid visibility state';
  end if;
  if next_visibility_state = 'published' and next_relevance_state <> 'included' then
    raise exception 'only included articles may be published';
  end if;
  if next_relevance_state = 'excluded' and nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'an exclusion reason is required';
  end if;

  if current_article.relevance_state is distinct from next_relevance_state then
    insert into public.literature_curation_events (
      pmid,
      actor_user_id,
      actor_email,
      event_type,
      before_value,
      after_value,
      reason
    )
    values (
      p_pmid,
      p_actor_user_id,
      p_actor_email,
      'relevance_changed',
      jsonb_build_object('relevance_state', current_article.relevance_state),
      jsonb_build_object('relevance_state', next_relevance_state),
      p_reason
    );
  end if;

  if current_article.visibility_state is distinct from next_visibility_state then
    insert into public.literature_curation_events (
      pmid,
      actor_user_id,
      actor_email,
      event_type,
      before_value,
      after_value,
      reason
    )
    values (
      p_pmid,
      p_actor_user_id,
      p_actor_email,
      'visibility_changed',
      jsonb_build_object('visibility_state', current_article.visibility_state),
      jsonb_build_object('visibility_state', next_visibility_state),
      p_reason
    );
  end if;

  if current_article.is_landmark is distinct from next_landmark then
    insert into public.literature_curation_events (
      pmid,
      actor_user_id,
      actor_email,
      event_type,
      before_value,
      after_value,
      reason
    )
    values (
      p_pmid,
      p_actor_user_id,
      p_actor_email,
      'landmark_changed',
      jsonb_build_object('is_landmark', current_article.is_landmark),
      jsonb_build_object('is_landmark', next_landmark),
      p_reason
    );
  end if;

  update public.literature_articles
  set
    relevance_state = next_relevance_state,
    visibility_state = next_visibility_state,
    is_landmark = next_landmark,
    manual_override = true,
    curation_reason = case
      when p_reason is null then curation_reason
      else p_reason
    end
  where literature_articles.pmid = p_pmid;

  for decision in
    select value
    from jsonb_array_elements(p_topic_decisions)
  loop
    decision_topic_id := nullif(trim(decision ->> 'topicId'), '');
    decision_state := decision ->> 'state';

    if decision_topic_id is null or decision_state not in ('confirmed', 'rejected') then
      raise exception 'invalid topic decision';
    end if;
    if not exists (
      select 1
      from public.literature_topics
      where literature_topics.id = decision_topic_id
    ) then
      raise exception 'unknown literature topic';
    end if;

    prior_topic_state := null;
    select assignment_state
    into prior_topic_state
    from public.literature_article_topics
    where literature_article_topics.pmid = p_pmid
      and literature_article_topics.topic_id = decision_topic_id
      and assignment_source = 'human'
      and model_or_rule_version = 'human-v1';

    insert into public.literature_article_topics (
      pmid,
      topic_id,
      confidence,
      assignment_source,
      assignment_state,
      model_or_rule_version,
      evidence
    )
    values (
      p_pmid,
      decision_topic_id,
      null,
      'human',
      decision_state,
      'human-v1',
      jsonb_build_object(
        'actor_user_id', p_actor_user_id,
        'actor_email', p_actor_email,
        'reason', p_reason
      )
    )
    on conflict (pmid, topic_id, assignment_source, model_or_rule_version)
    do update set
      assignment_state = excluded.assignment_state,
      evidence = excluded.evidence,
      updated_at = now();

    if prior_topic_state is distinct from decision_state then
      insert into public.literature_curation_events (
        pmid,
        actor_user_id,
        actor_email,
        event_type,
        before_value,
        after_value,
        reason
      )
      values (
        p_pmid,
        p_actor_user_id,
        p_actor_email,
        case
          when decision_state = 'confirmed' then 'topic_confirmed'
          else 'topic_rejected'
        end,
        case
          when prior_topic_state is null then null
          else jsonb_build_object(
            'topic_id', decision_topic_id,
            'assignment_state', prior_topic_state
          )
        end,
        jsonb_build_object(
          'topic_id', decision_topic_id,
          'assignment_state', decision_state
        ),
        p_reason
      );
    end if;
  end loop;

  return jsonb_build_object(
    'pmid', p_pmid,
    'relevance_state', next_relevance_state,
    'visibility_state', next_visibility_state,
    'is_landmark', next_landmark
  );
end;
$$;

revoke all on function public.curate_literature_article_v1(
  text,
  uuid,
  text,
  text,
  text,
  boolean,
  jsonb,
  text
) from public, anon, authenticated;
grant execute on function public.curate_literature_article_v1(
  text,
  uuid,
  text,
  text,
  text,
  boolean,
  jsonb,
  text
) to service_role;

create or replace function public.literature_admin_stats_v1()
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'total_articles', (
      select count(*) from public.literature_articles
    ),
    'with_abstract', (
      select count(*) from public.literature_articles where abstract is not null
    ),
    'without_abstract', (
      select count(*) from public.literature_articles where abstract is null
    ),
    'relevance_counts', coalesce((
      select jsonb_object_agg(relevance_state, state_count)
      from (
        select relevance_state, count(*) as state_count
        from public.literature_articles
        group by relevance_state
      ) as relevance_summary
    ), '{}'::jsonb),
    'visibility_counts', coalesce((
      select jsonb_object_agg(visibility_state, state_count)
      from (
        select visibility_state, count(*) as state_count
        from public.literature_articles
        group by visibility_state
      ) as visibility_summary
    ), '{}'::jsonb),
    'source_kind_counts', coalesce((
      select jsonb_object_agg(source_kind, source_count)
      from (
        select source_kind, count(distinct pmid) as source_count
        from public.literature_article_sources
        group by source_kind
      ) as source_summary
    ), '{}'::jsonb),
    'journal_counts', coalesce((
      select jsonb_object_agg(journal_label, journal_count)
      from (
        select
          coalesce(journal_id, journal_abbreviation, journal_title, 'unmatched') as journal_label,
          count(*) as journal_count
        from public.literature_articles
        group by coalesce(journal_id, journal_abbreviation, journal_title, 'unmatched')
      ) as journal_summary
    ), '{}'::jsonb),
    'topic_suggestion_count', (
      select count(*)
      from public.literature_article_topics
      where assignment_state = 'suggested'
    ),
    'import_error_count', (
      select count(*) from public.literature_import_errors
    ),
    'unmapped_file_count', (
      select count(distinct source_filename)
      from public.literature_import_batches
      where source_kind = 'unmapped'
    ),
    'last_import', (
      select to_jsonb(latest)
      from (
        select
          id,
          source_filename,
          source_kind,
          status,
          records_read,
          inserted_count,
          updated_count,
          error_count,
          record_limit,
          started_at,
          completed_at
        from public.literature_import_batches
        order by started_at desc
        limit 1
      ) as latest
    ),
    'last_successful_import', (
      select to_jsonb(latest_successful)
      from (
        select
          id,
          source_filename,
          source_kind,
          status,
          records_read,
          inserted_count,
          updated_count,
          error_count,
          record_limit,
          started_at,
          completed_at
        from public.literature_import_batches
        where status = 'completed'
        order by completed_at desc nulls last, started_at desc
        limit 1
      ) as latest_successful
    )
  );
$$;

revoke all on function public.literature_admin_stats_v1()
  from public, anon, authenticated;
grant execute on function public.literature_admin_stats_v1()
  to service_role;

create or replace function public.search_literature_v1(
  p_query text default '',
  p_journal_ids text[] default '{}'::text[],
  p_topic_ids text[] default '{}'::text[],
  p_year_from integer default null,
  p_year_to integer default null,
  p_publication_types text[] default '{}'::text[],
  p_landmark_only boolean default false,
  p_sort text default 'relevance',
  p_page integer default 1,
  p_page_size integer default 20,
  p_admin_preview boolean default false
)
returns table (
  pmid text,
  doi text,
  title text,
  authors jsonb,
  journal_id text,
  journal_title text,
  journal_abbreviation text,
  publication_year integer,
  volume text,
  issue text,
  pages text,
  abstract_snippet text,
  publication_types text[],
  is_landmark boolean,
  is_retracted boolean,
  is_correction boolean,
  is_conference_abstract boolean,
  relevance_state text,
  visibility_state text,
  confirmed_topics jsonb,
  suggested_topics jsonb,
  matched_by text[],
  rank_score real,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
begin
  if length(coalesce(p_query, '')) > 300 then
    raise exception 'query is too long';
  end if;
  if p_page < 1 or p_page > 10000 then
    raise exception 'page is outside the supported range';
  end if;
  if p_page_size < 1 or p_page_size > 50 then
    raise exception 'page_size is outside the supported range';
  end if;
  if p_sort not in ('relevance', 'newest', 'oldest', 'journal') then
    raise exception 'unsupported literature sort';
  end if;
  if p_year_from is not null and p_year_to is not null and p_year_from > p_year_to then
    raise exception 'year_from must not exceed year_to';
  end if;
  if cardinality(coalesce(p_journal_ids, '{}'::text[])) > 20
    or cardinality(coalesce(p_topic_ids, '{}'::text[])) > 20
    or cardinality(coalesce(p_publication_types, '{}'::text[])) > 20 then
    raise exception 'too many filter values';
  end if;

  return query
  with search_input as (
    select case
      when nullif(trim(coalesce(p_query, '')), '') is null then null::tsquery
      else websearch_to_tsquery('english', trim(p_query))
    end as parsed_query
  ),
  filtered as (
    select
      article.*,
      input.parsed_query,
      case
        when input.parsed_query is null then 0::real
        else ts_rank_cd(article.search_vector, input.parsed_query)
      end as computed_rank,
      count(*) over () as computed_total
    from public.literature_articles as article
    cross join search_input as input
    where
      (p_admin_preview or (
        article.relevance_state = 'included'
        and article.visibility_state = 'published'
      ))
      and (
        input.parsed_query is null
        or article.search_vector @@ input.parsed_query
      )
      and (
        cardinality(coalesce(p_journal_ids, '{}'::text[])) = 0
        or article.journal_id = any(p_journal_ids)
      )
      and (p_year_from is null or article.publication_year >= p_year_from)
      and (p_year_to is null or article.publication_year <= p_year_to)
      and (
        cardinality(coalesce(p_publication_types, '{}'::text[])) = 0
        or article.publication_types && p_publication_types
      )
      and (not p_landmark_only or article.is_landmark)
      and (
        cardinality(coalesce(p_topic_ids, '{}'::text[])) = 0
        or exists (
          select 1
          from public.literature_article_topics as assignment
          where assignment.pmid = article.pmid
            and assignment.topic_id = any(p_topic_ids)
            and (
              assignment.assignment_state = 'confirmed'
              or (
                p_admin_preview
                and assignment.assignment_state = 'suggested'
                and not exists (
                  select 1
                  from public.literature_article_topics as human_assignment
                  where human_assignment.pmid = assignment.pmid
                    and human_assignment.topic_id = assignment.topic_id
                    and human_assignment.assignment_source = 'human'
                )
              )
            )
        )
      )
  ),
  paged as (
    select candidate.*
    from filtered as candidate
    order by
      case
        when p_sort = 'relevance' and candidate.parsed_query is not null
        then candidate.computed_rank
      end desc nulls last,
      case
        when p_sort = 'newest'
          or (p_sort = 'relevance' and candidate.parsed_query is null)
        then candidate.publication_year
      end desc nulls last,
      case when p_sort = 'oldest' then candidate.publication_year end asc nulls last,
      case
        when p_sort = 'journal'
        then coalesce(candidate.journal_title, candidate.journal_abbreviation)
      end asc nulls last,
      candidate.pmid desc
    limit p_page_size
    offset ((p_page - 1) * p_page_size)
  )
  select
    result.pmid,
    result.doi,
    result.title,
    result.authors,
    result.journal_id,
    result.journal_title,
    result.journal_abbreviation,
    result.publication_year,
    result.volume,
    result.issue,
    result.pages,
    case
      when result.abstract is null or result.abstract_display_policy = 'hidden' then null
      else left(result.abstract, 600)
    end as abstract_snippet,
    result.publication_types,
    result.is_landmark,
    result.is_retracted,
    result.is_correction,
    result.is_conference_abstract,
    result.relevance_state,
    result.visibility_state,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', topic.id,
          'label_en', topic.label_en,
          'label_es', topic.label_es,
          'label_zh_cn', topic.label_zh_cn
        )
        order by topic.sort_order, topic.id
      )
      from public.literature_topics as topic
      where exists (
        select 1
        from public.literature_article_topics as assignment
        where assignment.pmid = result.pmid
          and assignment.topic_id = topic.id
          and assignment.assignment_state = 'confirmed'
      )
    ), '[]'::jsonb) as confirmed_topics,
    case
      when p_admin_preview then coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', topic.id,
            'label_en', topic.label_en,
            'label_es', topic.label_es,
            'label_zh_cn', topic.label_zh_cn
          )
          order by topic.sort_order, topic.id
        )
        from public.literature_topics as topic
        where exists (
          select 1
          from public.literature_article_topics as assignment
          where assignment.pmid = result.pmid
            and assignment.topic_id = topic.id
            and assignment.assignment_state = 'suggested'
            and not exists (
              select 1
              from public.literature_article_topics as human_assignment
              where human_assignment.pmid = assignment.pmid
                and human_assignment.topic_id = assignment.topic_id
                and human_assignment.assignment_source = 'human'
            )
        )
      ), '[]'::jsonb)
      else '[]'::jsonb
    end as suggested_topics,
    array_remove(array[
      case
        when result.parsed_query is not null
          and to_tsvector('english', coalesce(result.title, '')) @@ result.parsed_query
        then 'title'
      end,
      case
        when result.parsed_query is not null
          and to_tsvector(
            'english',
            coalesce(array_to_string(result.mesh_terms, ' '), '')
            || ' '
            || coalesce(array_to_string(result.author_keywords, ' '), '')
          ) @@ result.parsed_query
        then 'subject_terms'
      end,
      case
        when result.parsed_query is not null
          and to_tsvector('english', coalesce(result.abstract, '')) @@ result.parsed_query
        then 'abstract'
      end,
      case when nullif(trim(coalesce(p_query, '')), '') = result.pmid then 'pmid' end,
      case when lower(nullif(trim(coalesce(p_query, '')), '')) = lower(result.doi) then 'doi' end
    ]::text[], null) as matched_by,
    result.computed_rank,
    result.computed_total
  from paged as result
  order by
    case
      when p_sort = 'relevance' and result.parsed_query is not null then result.computed_rank
    end desc nulls last,
    case
      when p_sort = 'newest'
        or (p_sort = 'relevance' and result.parsed_query is null)
      then result.publication_year
    end desc nulls last,
    case when p_sort = 'oldest' then result.publication_year end asc nulls last,
    case
      when p_sort = 'journal'
      then coalesce(result.journal_title, result.journal_abbreviation)
    end asc nulls last,
    result.pmid desc;
end;
$$;

revoke all on function public.search_literature_v1(
  text,
  text[],
  text[],
  integer,
  integer,
  text[],
  boolean,
  text,
  integer,
  integer,
  boolean
) from public, anon, authenticated;
grant execute on function public.search_literature_v1(
  text,
  text[],
  text[],
  integer,
  integer,
  text[],
  boolean,
  text,
  integer,
  integer,
  boolean
) to service_role;

alter table public.literature_journals enable row level security;
alter table public.literature_articles enable row level security;
alter table public.literature_import_batches enable row level security;
alter table public.literature_article_sources enable row level security;
alter table public.literature_topics enable row level security;
alter table public.literature_article_topics enable row level security;
alter table public.literature_curation_events enable row level security;
alter table public.literature_import_errors enable row level security;

revoke all on table public.literature_journals from public, anon, authenticated;
revoke all on table public.literature_articles from public, anon, authenticated;
revoke all on table public.literature_import_batches from public, anon, authenticated;
revoke all on table public.literature_article_sources from public, anon, authenticated;
revoke all on table public.literature_topics from public, anon, authenticated;
revoke all on table public.literature_article_topics from public, anon, authenticated;
revoke all on table public.literature_curation_events from public, anon, authenticated;
revoke all on table public.literature_import_errors from public, anon, authenticated;

grant all on table public.literature_journals to service_role;
grant all on table public.literature_articles to service_role;
grant all on table public.literature_import_batches to service_role;
grant all on table public.literature_article_sources to service_role;
grant all on table public.literature_topics to service_role;
grant all on table public.literature_article_topics to service_role;
grant all on table public.literature_curation_events to service_role;
grant all on table public.literature_import_errors to service_role;

notify pgrst, 'reload schema';
