-- Expand the controlled gold-set review vocabulary without replacing the
-- in-progress batch or mutating any saved drafts and immutable reviews.
--
-- The initial function keeps its controlled values inline. Rebuild that
-- function from PostgreSQL's canonical definition so this additive migration
-- changes only the three allowlists and preserves the rest of the workflow.
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
    $needle$      'training'
    ]::text[])$needle$,
    $replacement$      'training',
      'multiple-general-overview',
      'not-assessable-from-available-metadata'
    ]::text[])$replacement$
  );
  if updated_sql = function_sql then
    raise exception 'clinical-purpose allowlist was not found';
  end if;
  function_sql := updated_sql;

  updated_sql := replace(
    function_sql,
    $needle$    'technical-note',
    'editorial'
  ]::text[])$needle$,
    $replacement$    'technical-note',
    'editorial',
    'review-article',
    'not-assessable-from-available-metadata'
  ]::text[])$replacement$
  );
  if updated_sql = function_sql then
    raise exception 'study-design allowlist was not found';
  end if;
  function_sql := updated_sql;

  updated_sql := replace(
    function_sql,
    $needle$    'retraction',
    'protocol'
  ]::text[])$needle$,
    $replacement$    'retraction',
    'protocol',
    'not-assessable-from-available-metadata'
  ]::text[])$replacement$
  );
  if updated_sql = function_sql then
    raise exception 'publication-status allowlist was not found';
  end if;

  execute updated_sql;
end;
$migration$;
