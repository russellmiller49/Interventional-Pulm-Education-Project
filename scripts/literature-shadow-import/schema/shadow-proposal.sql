-- Literature AI shadow V1 — additive, forward-only schema proposal.
--
-- STATUS: PROPOSAL / DISPOSABLE REHEARSAL ONLY.
-- This file is intentionally outside supabase/migrations. It is not authorized for application to
-- the dedicated hosted Literature project. It does not alter literature_articles or any reviewed
-- field. Promoting it into migrations requires a separate owner-reviewed change and provider-bound
-- rehearsal evidence.

begin;

create table public.literature_shadow_runs (
  id bigint generated always as identity primary key,
  run_key text not null unique,
  source_kind text not null,
  source_repository text not null,
  source_release_tag text not null,
  source_artifact_sha256 text not null,
  model_key text not null,
  model_metadata jsonb not null default '{}'::jsonb,
  status text not null default 'prepared',
  classification_count integer not null,
  enhancement_count integer not null default 0,
  term_count integer not null default 0,
  class_counts jsonb not null default '{}'::jsonb,
  zone_counts jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  constraint literature_shadow_runs_key_check check (
    run_key ~ '^[a-z0-9][a-z0-9._-]{0,159}$'
  ),
  constraint literature_shadow_runs_source_kind_check check (
    source_kind in ('conference_projection', 'screening_ml')
  ),
  constraint literature_shadow_runs_source_repository_check check (
    source_repository ~ '^https://github.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'
  ),
  constraint literature_shadow_runs_release_check check (
    length(trim(source_release_tag)) between 1 and 160
  ),
  constraint literature_shadow_runs_artifact_check check (
    source_artifact_sha256 ~ '^[a-f0-9]{64}$'
  ),
  constraint literature_shadow_runs_model_key_check check (
    length(trim(model_key)) between 1 and 160
  ),
  constraint literature_shadow_runs_status_check check (
    status in ('prepared', 'verified', 'retired')
  ),
  constraint literature_shadow_runs_counts_check check (
    classification_count > 0 and enhancement_count >= 0 and term_count >= 0
  ),
  constraint literature_shadow_runs_metadata_check check (
    jsonb_typeof(model_metadata) = 'object'
    and jsonb_typeof(class_counts) = 'object'
    and jsonb_typeof(zone_counts) = 'object'
  )
);

create table public.literature_shadow_classifications (
  run_id bigint not null references public.literature_shadow_runs (id) on delete restrict,
  pmid text not null references public.literature_articles (pmid) on delete restrict,
  source_title text not null,
  source_journal text,
  source_publication_year integer,
  predicted_relevance text not null,
  predicted_confidence text,
  inclusion_probability double precision,
  decision_zone text not null,
  predicted_category text,
  predicted_category_probability double precision,
  review_priority text,
  display_summary text,
  classifier_payload jsonb not null default '{}'::jsonb,
  primary key (run_id, pmid),
  constraint literature_shadow_classifications_pmid_check check (pmid ~ '^[0-9]{1,12}$'),
  constraint literature_shadow_classifications_relevance_check check (
    predicted_relevance in ('include_core', 'include_adjacent', 'include', 'exclude')
  ),
  constraint literature_shadow_classifications_confidence_check check (
    predicted_confidence is null or predicted_confidence in ('high', 'medium', 'low')
  ),
  constraint literature_shadow_classifications_probability_check check (
    inclusion_probability is null or inclusion_probability between 0 and 1
  ),
  constraint literature_shadow_classifications_zone_check check (
    decision_zone in ('conference_projection', 'auto_exclude', 'review', 'auto_include')
  ),
  constraint literature_shadow_classifications_category_probability_check check (
    predicted_category_probability is null
    or predicted_category_probability between 0 and 1
  ),
  constraint literature_shadow_classifications_priority_check check (
    review_priority is null or review_priority in ('high', 'medium', 'low')
  ),
  constraint literature_shadow_classifications_payload_check check (
    jsonb_typeof(classifier_payload) = 'object'
  )
);

create index literature_shadow_classifications_pmid_idx
  on public.literature_shadow_classifications (pmid, run_id);
create index literature_shadow_classifications_filter_idx
  on public.literature_shadow_classifications
  (run_id, predicted_relevance, decision_zone, pmid);
create index literature_shadow_classifications_probability_idx
  on public.literature_shadow_classifications (run_id, inclusion_probability desc, pmid)
  where inclusion_probability is not null;

create table public.literature_shadow_enhancements (
  run_id bigint not null,
  pmid text not null,
  enhanced_display_summary text,
  enhanced_study_design text,
  primary_topic text,
  primary_technology text,
  primary_disease text,
  primary_clinical_purpose text,
  evidence_category text,
  metadata_confidence text,
  manual_review_priority text,
  proposed_relevance text,
  reclassification_action text,
  enhancement_payload jsonb not null default '{}'::jsonb,
  primary key (run_id, pmid),
  foreign key (run_id, pmid)
    references public.literature_shadow_classifications (run_id, pmid)
    on delete restrict,
  constraint literature_shadow_enhancements_confidence_check check (
    metadata_confidence is null or metadata_confidence in ('high', 'medium', 'low')
  ),
  constraint literature_shadow_enhancements_priority_check check (
    manual_review_priority is null or manual_review_priority in ('high', 'medium', 'low')
  ),
  constraint literature_shadow_enhancements_proposed_relevance_check check (
    proposed_relevance is null
    or proposed_relevance in ('include_core', 'include_adjacent', 'exclude')
  ),
  constraint literature_shadow_enhancements_payload_check check (
    jsonb_typeof(enhancement_payload) = 'object'
  )
);

create index literature_shadow_enhancements_topic_idx
  on public.literature_shadow_enhancements (run_id, primary_topic, pmid)
  where primary_topic is not null;
create index literature_shadow_enhancements_review_idx
  on public.literature_shadow_enhancements
  (run_id, manual_review_priority, proposed_relevance, pmid)
  where manual_review_priority is not null or proposed_relevance is not null;

create table public.literature_shadow_terms (
  run_id bigint not null,
  pmid text not null,
  facet text not null,
  term text not null,
  ordinal integer not null,
  source_field text not null,
  source_kind text not null,
  primary key (run_id, pmid, facet, term),
  foreign key (run_id, pmid)
    references public.literature_shadow_enhancements (run_id, pmid)
    on delete restrict,
  constraint literature_shadow_terms_facet_check check (
    facet ~ '^[a-z][a-z0-9_]{0,79}$'
  ),
  constraint literature_shadow_terms_term_check check (
    length(trim(term)) between 1 and 500
  ),
  constraint literature_shadow_terms_ordinal_check check (ordinal >= 0),
  constraint literature_shadow_terms_source_kind_check check (
    source_kind in ('enhancement', 'adjacent_enhancement')
  )
);

create index literature_shadow_terms_lookup_idx
  on public.literature_shadow_terms (run_id, facet, term, pmid);

alter table public.literature_shadow_runs enable row level security;
alter table public.literature_shadow_classifications enable row level security;
alter table public.literature_shadow_enhancements enable row level security;
alter table public.literature_shadow_terms enable row level security;

revoke all on table public.literature_shadow_runs from public, anon, authenticated;
revoke all on table public.literature_shadow_classifications from public, anon, authenticated;
revoke all on table public.literature_shadow_enhancements from public, anon, authenticated;
revoke all on table public.literature_shadow_terms from public, anon, authenticated;
revoke all on sequence public.literature_shadow_runs_id_seq from public, anon, authenticated;

grant select on table public.literature_shadow_runs to service_role;
grant select on table public.literature_shadow_classifications to service_role;
grant select on table public.literature_shadow_enhancements to service_role;
grant select on table public.literature_shadow_terms to service_role;

comment on table public.literature_shadow_runs is
  'AI/ML research runs isolated from physician-reviewed literature truth.';
comment on table public.literature_shadow_classifications is
  'Non-clinical AI/ML screening output; never a physician review or public classification.';
comment on table public.literature_shadow_enhancements is
  'Non-clinical proposed metadata isolated from canonical article fields.';
comment on table public.literature_shadow_terms is
  'Normalized terms derived from non-clinical shadow enhancements.';

commit;
