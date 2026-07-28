alter table public.literature_gold_set_review_drafts
  add column categorization_from_full_text boolean not null default false;

alter table public.literature_gold_set_reviews
  add column categorization_from_full_text boolean not null default false;

alter table public.literature_gold_set_reviews
  add constraint literature_gold_set_reviews_full_text_categorization_check check (
    not categorization_from_full_text
    or relevance_label in ('include_core', 'include_adjacent')
  );

comment on column public.literature_gold_set_review_drafts.categorization_from_full_text is
  'True when Category 3 could not be assigned from the abstract and required full-text review.';

comment on column public.literature_gold_set_reviews.categorization_from_full_text is
  'True when Category 3 could not be assigned from the abstract and required full-text review.';

-- The gold-set RPCs intentionally keep their controlled workflow in database
-- functions. Rebuild each function from PostgreSQL's canonical definition so
-- this additive migration preserves the existing review and blinding logic.
do $migration$
declare
  function_sql text;
  updated_sql text;
begin
  select pg_get_functiondef(
    'public.save_literature_gold_review_v1(uuid,uuid,text,jsonb,boolean)'::regprocedure
  )
  into function_sql;

  if function_sql is null then
    raise exception 'save_literature_gold_review_v1 is required';
  end if;

  updated_sql := replace(
    function_sql,
    $needle$  publication_status text;
  notes text;$needle$,
    $replacement$  publication_status text;
  categorization_from_full_text boolean;
  notes text;$replacement$
  );
  if updated_sql = function_sql then
    raise exception 'save function declaration insertion point was not found';
  end if;
  function_sql := updated_sql;

  updated_sql := replace(
    function_sql,
    $needle$  publication_status := nullif(trim(coalesce(p_review ->> 'publicationStatus', '')), '');
  notes := trim(coalesce(p_review ->> 'notes', ''));$needle$,
    $replacement$  publication_status := nullif(trim(coalesce(p_review ->> 'publicationStatus', '')), '');
  categorization_from_full_text :=
    coalesce((p_review ->> 'categorizationFromFullText')::boolean, false);
  notes := trim(coalesce(p_review ->> 'notes', ''));$replacement$
  );
  if updated_sql = function_sql then
    raise exception 'save function payload insertion point was not found';
  end if;
  function_sql := updated_sql;

  updated_sql := replace(
    function_sql,
    $needle$      publication_status,
      notes,$needle$,
    $replacement$      publication_status,
      categorization_from_full_text,
      notes,$replacement$
  );
  if updated_sql = function_sql then
    raise exception 'save function draft insertions were not found';
  end if;
  function_sql := updated_sql;

  updated_sql := replace(
    function_sql,
    $needle$      publication_status = excluded.publication_status,
      notes = excluded.notes,$needle$,
    $replacement$      publication_status = excluded.publication_status,
      categorization_from_full_text = excluded.categorization_from_full_text,
      notes = excluded.notes,$replacement$
  );
  if updated_sql = function_sql then
    raise exception 'save function draft update insertion point was not found';
  end if;
  function_sql := updated_sql;

  updated_sql := replace(
    function_sql,
    $needle$    publication_status,
    notes,$needle$,
    $replacement$    publication_status,
    categorization_from_full_text,
    notes,$replacement$
  );
  if updated_sql = function_sql then
    raise exception 'save function completed-review insertions were not found';
  end if;
  function_sql := updated_sql;

  updated_sql := replace(
    function_sql,
    $needle$    or publication_status is not null then$needle$,
    $replacement$    or publication_status is not null
    or categorization_from_full_text then$replacement$
  );
  if updated_sql = function_sql then
    raise exception 'save function exclusion validation insertion point was not found';
  end if;

  execute updated_sql;
end;
$migration$;

do $migration$
declare
  function_sql text;
  updated_sql text;
begin
  select pg_get_functiondef(
    'public.get_literature_gold_review_item_v1(uuid,uuid,text,text)'::regprocedure
  )
  into function_sql;

  if function_sql is null then
    raise exception 'get_literature_gold_review_item_v1 is required';
  end if;

  updated_sql := replace(
    function_sql,
    $needle$    'publicationStatus', draft.publication_status,
    'notes', draft.notes,$needle$,
    $replacement$    'publicationStatus', draft.publication_status,
    'categorizationFromFullText', draft.categorization_from_full_text,
    'notes', draft.notes,$replacement$
  );
  if updated_sql = function_sql then
    raise exception 'draft response insertion point was not found';
  end if;
  function_sql := updated_sql;

  updated_sql := replace(
    function_sql,
    $needle$    'publicationStatus', review.publication_status,
    'notes', review.notes,$needle$,
    $replacement$    'publicationStatus', review.publication_status,
    'categorizationFromFullText', review.categorization_from_full_text,
    'notes', review.notes,$replacement$
  );
  if updated_sql = function_sql then
    raise exception 'current-review response insertion point was not found';
  end if;
  function_sql := updated_sql;

  updated_sql := replace(
    function_sql,
    $needle$        'publicationStatus', review.publication_status,
        'notes', review.notes,$needle$,
    $replacement$        'publicationStatus', review.publication_status,
        'categorizationFromFullText', review.categorization_from_full_text,
        'notes', review.notes,$replacement$
  );
  if updated_sql = function_sql then
    raise exception 'review-history response insertion point was not found';
  end if;

  execute updated_sql;
end;
$migration$;
