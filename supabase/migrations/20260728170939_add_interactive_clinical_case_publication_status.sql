-- Expand the controlled publication-status vocabulary without modifying any
-- existing draft or immutable completed review.
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
    $needle$    'protocol',
    'not-assessable-from-available-metadata'
  ]::text[])$needle$,
    $replacement$    'protocol',
    'interactive-clinical-case',
    'not-assessable-from-available-metadata'
  ]::text[])$replacement$
  );
  if updated_sql = function_sql then
    raise exception 'publication-status allowlist was not found';
  end if;

  execute updated_sql;
end;
$migration$;
