alter table public.literature_gold_set_batches
  add column test_unlocked_at timestamptz,
  add column test_unlocked_by_user_id uuid,
  add column test_unlocked_by_email text,
  add column test_unlock_reason text,
  add constraint literature_gold_set_batches_test_unlock_check check (
    (
      test_unlocked_at is null
      and test_unlocked_by_user_id is null
      and test_unlocked_by_email is null
      and test_unlock_reason is null
    )
    or (
      test_unlocked_at is not null
      and test_unlock_reason is not null
      and (test_unlocked_by_user_id is not null or test_unlocked_by_email is not null)
      and (
        test_unlocked_by_email is null
        or length(trim(test_unlocked_by_email)) > 0
      )
      and length(trim(test_unlock_reason)) between 5 and 2000
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
      'batch_frozen'
    )
  );

alter table public.literature_gold_set_batches
  disable trigger protect_frozen_literature_gold_set_batches;

update public.literature_gold_set_batches
set
  test_unlocked_at = now(),
  test_unlocked_by_email = 'literature-gold-test-lock-migration',
  test_unlock_reason = 'Legacy batch predated technical test locking.'
where kind = 'gold_standard'
  and test_unlocked_at is null;

alter table public.literature_gold_set_batches
  enable trigger protect_frozen_literature_gold_set_batches;

insert into public.literature_gold_set_events (
  batch_id,
  actor_email,
  event_type,
  after_value
)
select
  batch.id,
  batch.test_unlocked_by_email,
  'test_split_unlocked',
  jsonb_build_object(
    'unlockedAt', batch.test_unlocked_at,
    'reason', batch.test_unlock_reason,
    'testItemCount', count(item.id) filter (where item.dataset_split = 'test'),
    'legacyBackfill', true
  )
from public.literature_gold_set_batches as batch
left join public.literature_gold_set_items as item on item.batch_id = batch.id
where batch.kind = 'gold_standard'
  and batch.test_unlock_reason = 'Legacy batch predated technical test locking.'
group by batch.id;

create unique index literature_gold_set_events_one_test_unlock_idx
  on public.literature_gold_set_events (batch_id)
  where event_type = 'test_split_unlocked';

create or replace function public.prevent_literature_gold_set_composition_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  prior_batch_created boolean := false;
  next_batch_created boolean := false;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    select exists (
      select 1
      from public.literature_gold_set_events as event
      where event.batch_id = old.batch_id
        and event.event_type = 'batch_created'
    )
    into prior_batch_created;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select exists (
      select 1
      from public.literature_gold_set_events as event
      where event.batch_id = new.batch_id
        and event.event_type = 'batch_created'
    )
    into next_batch_created;
  end if;

  if tg_op = 'INSERT' and next_batch_created then
    raise exception 'gold-set composition is immutable after batch creation';
  end if;
  if tg_op = 'DELETE' and prior_batch_created then
    raise exception 'gold-set composition is immutable after batch creation';
  end if;
  if tg_op = 'UPDATE'
    and (prior_batch_created or next_batch_created)
    and (
      new.batch_id is distinct from old.batch_id
      or new.pmid is distinct from old.pmid
      or new.sample_stratum is distinct from old.sample_stratum
      or new.sampling_reason is distinct from old.sampling_reason
      or new.sampling_metadata is distinct from old.sampling_metadata
      or new.dataset_split is distinct from old.dataset_split
      or new.display_order is distinct from old.display_order
      or new.created_at is distinct from old.created_at
    ) then
    raise exception 'gold-set composition is immutable after batch creation';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.prevent_literature_gold_set_composition_mutation()
  from public, anon, authenticated;

create trigger protect_literature_gold_set_composition
  before insert or update or delete on public.literature_gold_set_items
  for each row
  execute function public.prevent_literature_gold_set_composition_mutation();

create or replace function public.prevent_locked_literature_gold_test_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  prior_batch_id uuid;
  prior_split text;
  next_batch_id uuid;
  next_split text;
  prior_locked boolean := false;
  next_locked boolean := false;
begin
  if tg_table_name = 'literature_gold_set_items' then
    if tg_op in ('UPDATE', 'DELETE') then
      prior_batch_id := old.batch_id;
      prior_split := old.dataset_split;
    end if;
    if tg_op in ('INSERT', 'UPDATE') then
      next_batch_id := new.batch_id;
      next_split := new.dataset_split;
    end if;
  else
    if tg_op in ('UPDATE', 'DELETE') then
      select item.batch_id, item.dataset_split
      into prior_batch_id, prior_split
      from public.literature_gold_set_items as item
      where item.id = old.item_id;
    end if;
    if tg_op in ('INSERT', 'UPDATE') then
      select item.batch_id, item.dataset_split
      into next_batch_id, next_split
      from public.literature_gold_set_items as item
      where item.id = new.item_id;
    end if;
  end if;

  if prior_split = 'test' then
    select exists (
      select 1
      from public.literature_gold_set_batches as batch
      where batch.id = prior_batch_id
        and batch.kind = 'gold_standard'
        and batch.test_unlocked_at is null
    )
    into prior_locked;
  end if;

  if next_split = 'test' then
    select exists (
      select 1
      from public.literature_gold_set_batches as batch
      where batch.id = next_batch_id
        and batch.kind = 'gold_standard'
        and batch.test_unlocked_at is null
    )
    into next_locked;
  end if;

  if tg_table_name = 'literature_gold_set_items'
    and tg_op = 'INSERT'
    and next_locked
    and not exists (
      select 1
      from public.literature_gold_set_events as event
      where event.batch_id = next_batch_id
        and event.event_type = 'batch_created'
    ) then
    return new;
  end if;

  if prior_locked or next_locked then
    raise exception 'the locked test split cannot be changed before its audited unlock';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.prevent_locked_literature_gold_test_mutation()
  from public, anon, authenticated;

create trigger protect_locked_literature_gold_test_items
  before insert or update or delete on public.literature_gold_set_items
  for each row
  execute function public.prevent_locked_literature_gold_test_mutation();

create trigger protect_locked_literature_gold_test_drafts
  before insert or update or delete on public.literature_gold_set_review_drafts
  for each row
  execute function public.prevent_locked_literature_gold_test_mutation();

create trigger protect_locked_literature_gold_test_reviews
  before insert on public.literature_gold_set_reviews
  for each row
  execute function public.prevent_locked_literature_gold_test_mutation();

create or replace function public.validate_literature_gold_batch_created_event()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  selected_batch public.literature_gold_set_batches%rowtype;
  total_count integer;
  development_count integer;
  test_count integer;
begin
  select *
  into selected_batch
  from public.literature_gold_set_batches as batch
  where batch.id = new.batch_id;

  if new.event_type = 'test_split_unlocked' then
    select count(*)::integer
    into test_count
    from public.literature_gold_set_items as item
    where item.batch_id = new.batch_id
      and item.dataset_split = 'test';

    if selected_batch.test_unlocked_at is null
      or new.actor_user_id is distinct from selected_batch.test_unlocked_by_user_id
      or new.actor_email is distinct from selected_batch.test_unlocked_by_email
      or new.after_value is null
      or jsonb_typeof(new.after_value) <> 'object'
      or new.after_value ->> 'reason' is distinct from selected_batch.test_unlock_reason
      or (new.after_value ->> 'unlockedAt')::timestamptz
        is distinct from selected_batch.test_unlocked_at
      or (new.after_value ->> 'testItemCount')::integer is distinct from test_count then
      raise exception 'test unlock events must match the audited batch transition';
    end if;
    return new;
  end if;

  if new.event_type <> 'batch_created'
    or selected_batch.kind <> 'gold_standard' then
    return new;
  end if;

  select
    count(*)::integer,
    count(*) filter (where item.dataset_split = 'development')::integer,
    count(*) filter (where item.dataset_split = 'test')::integer
  into total_count, development_count, test_count
  from public.literature_gold_set_items as item
  where item.batch_id = new.batch_id;

  if selected_batch.test_percent = 0
    or total_count <> selected_batch.requested_size
    or development_count = 0
    or test_count = 0
    or test_count <> round(
      selected_batch.requested_size::numeric * selected_batch.test_percent::numeric / 100
    )::integer then
    raise exception 'gold-standard batches require complete non-empty development and test splits';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_literature_gold_batch_created_event()
  from public, anon, authenticated;

create trigger validate_literature_gold_batch_created_event
  before insert on public.literature_gold_set_events
  for each row
  execute function public.validate_literature_gold_batch_created_event();

create or replace function public.guard_literature_gold_test_unlock_transition()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  development_count integer;
  development_incomplete_count integer;
  development_draft_count integer;
  test_count integer;
  test_started_count integer;
begin
  if tg_op = 'INSERT' then
    if new.test_unlocked_at is not null
      or new.test_unlocked_by_user_id is not null
      or new.test_unlocked_by_email is not null
      or new.test_unlock_reason is not null then
      raise exception 'new gold-set batches must begin with the test lock intact';
    end if;
    return new;
  end if;

  if old.kind = 'gold_standard'
    and old.test_unlocked_at is null
    and new.kind is distinct from old.kind then
    raise exception 'a locked gold-standard batch cannot change kind';
  end if;

  if exists (
    select 1
    from public.literature_gold_set_events as event
    where event.batch_id = old.id
      and event.event_type = 'batch_created'
  )
    and (
      new.name is distinct from old.name
      or new.kind is distinct from old.kind
      or new.taxonomy_version is distinct from old.taxonomy_version
      or new.label_schema_version is distinct from old.label_schema_version
      or new.relevance_definition_version is distinct from old.relevance_definition_version
      or new.sampling_algorithm_version is distinct from old.sampling_algorithm_version
      or new.sampling_seed is distinct from old.sampling_seed
      or new.requested_size is distinct from old.requested_size
      or new.test_percent is distinct from old.test_percent
      or new.sampling_report is distinct from old.sampling_report
      or new.created_by_user_id is distinct from old.created_by_user_id
      or new.created_by_email is distinct from old.created_by_email
      or new.created_at is distinct from old.created_at
    ) then
    raise exception 'gold-set batch definitions are immutable after creation';
  end if;

  if old.test_unlocked_at is not null then
    if new.test_unlocked_at is distinct from old.test_unlocked_at
      or new.test_unlocked_by_user_id is distinct from old.test_unlocked_by_user_id
      or new.test_unlocked_by_email is distinct from old.test_unlocked_by_email
      or new.test_unlock_reason is distinct from old.test_unlock_reason then
      raise exception 'the audited gold-set test unlock is immutable';
    end if;
    return new;
  end if;

  if new.test_unlocked_at is null then return new; end if;

  if old.status <> 'active'
    or old.kind <> 'gold_standard'
    or old.test_percent = 0 then
    raise exception 'only an active gold-standard batch with a test split can be unlocked';
  end if;
  if not exists (
    select 1
    from public.literature_gold_set_events as event
    where event.batch_id = old.id
      and event.event_type = 'batch_created'
  ) then
    raise exception 'the gold-standard batch composition must be sealed before test unlock';
  end if;

  if (
    to_jsonb(new) - array[
      'test_unlocked_at',
      'test_unlocked_by_user_id',
      'test_unlocked_by_email',
      'test_unlock_reason',
      'updated_at'
    ]
  ) is distinct from (
    to_jsonb(old) - array[
      'test_unlocked_at',
      'test_unlocked_by_user_id',
      'test_unlocked_by_email',
      'test_unlock_reason',
      'updated_at'
    ]
  ) then
    raise exception 'the test unlock cannot change other batch fields';
  end if;

  new.test_unlocked_by_email :=
    nullif(trim(coalesce(new.test_unlocked_by_email, '')), '');
  new.test_unlock_reason :=
    nullif(trim(coalesce(new.test_unlock_reason, '')), '');
  if new.test_unlocked_by_user_id is null and new.test_unlocked_by_email is null then
    raise exception 'an unlock actor is required';
  end if;
  if new.test_unlock_reason is null
    or length(new.test_unlock_reason) not between 5 and 2000 then
    raise exception 'an unlock reason between 5 and 2000 characters is required';
  end if;

  select
    count(*) filter (where item.dataset_split = 'development')::integer,
    count(*) filter (
      where item.dataset_split = 'development'
        and item.review_status <> 'completed'
    )::integer,
    count(*) filter (where item.dataset_split = 'test')::integer,
    count(*) filter (
      where item.dataset_split = 'test'
        and (
          item.review_status <> 'pending'
          or item.started_at is not null
          or item.current_review_id is not null
          or item.supplemental_metadata_revealed_at is not null
          or item.automated_signals_revealed_at is not null
        )
    )::integer
  into development_count, development_incomplete_count, test_count, test_started_count
  from public.literature_gold_set_items as item
  where item.batch_id = old.id;

  select count(*)::integer
  into development_draft_count
  from public.literature_gold_set_review_drafts as draft
  join public.literature_gold_set_items as item on item.id = draft.item_id
  where item.batch_id = old.id
    and item.dataset_split = 'development';

  if development_count = 0 then
    raise exception 'the gold-set batch has no development items';
  end if;
  if development_incomplete_count > 0 or development_draft_count > 0 then
    raise exception 'complete the development split and clear its drafts before unlocking test';
  end if;
  if test_count = 0 then
    raise exception 'the gold-set batch has no test items';
  end if;
  if test_started_count > 0
    or exists (
      select 1
      from public.literature_gold_set_review_drafts as draft
      join public.literature_gold_set_items as item on item.id = draft.item_id
      where item.batch_id = old.id
        and item.dataset_split = 'test'
    )
    or exists (
      select 1
      from public.literature_gold_set_events as event
      join public.literature_gold_set_items as item on item.id = event.item_id
      where item.batch_id = old.id
        and item.dataset_split = 'test'
    ) then
    raise exception 'the test split was accessed before unlock; create a fresh gold-standard batch';
  end if;

  new.test_unlocked_at := now();
  return new;
end;
$$;

revoke all on function public.guard_literature_gold_test_unlock_transition()
  from public, anon, authenticated;

create trigger guard_literature_gold_test_unlock_transition
  before insert or update on public.literature_gold_set_batches
  for each row
  execute function public.guard_literature_gold_test_unlock_transition();

create or replace function public.audit_literature_gold_test_unlock_transition()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  test_count integer;
begin
  if old.test_unlocked_at is null and new.test_unlocked_at is not null then
    select count(*)::integer
    into test_count
    from public.literature_gold_set_items as item
    where item.batch_id = new.id
      and item.dataset_split = 'test';

    insert into public.literature_gold_set_events (
      batch_id,
      actor_user_id,
      actor_email,
      event_type,
      after_value
    )
    values (
      new.id,
      new.test_unlocked_by_user_id,
      new.test_unlocked_by_email,
      'test_split_unlocked',
      jsonb_build_object(
        'unlockedAt', new.test_unlocked_at,
        'reason', new.test_unlock_reason,
        'testItemCount', test_count
      )
    );
  end if;
  return new;
end;
$$;

revoke all on function public.audit_literature_gold_test_unlock_transition()
  from public, anon, authenticated;

create trigger audit_literature_gold_test_unlock_transition
  after update on public.literature_gold_set_batches
  for each row
  execute function public.audit_literature_gold_test_unlock_transition();

create or replace function public.unlock_literature_gold_test_split_v1(
  p_batch_id uuid,
  p_actor_user_id uuid default null,
  p_actor_email text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, public
as $$
declare
  locked_batch public.literature_gold_set_batches%rowtype;
  development_count integer;
  development_incomplete_count integer;
  development_draft_count integer;
  test_count integer;
  test_started_count integer;
  unlock_time timestamptz := now();
  normalized_email text := nullif(trim(coalesce(p_actor_email, '')), '');
  normalized_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if p_actor_user_id is null and normalized_email is null then
    raise exception 'an unlock actor is required';
  end if;
  if normalized_reason is null or length(normalized_reason) not between 5 and 2000 then
    raise exception 'an unlock reason between 5 and 2000 characters is required';
  end if;

  select *
  into locked_batch
  from public.literature_gold_set_batches as batch
  where batch.id = p_batch_id
  for update;

  if not found then
    raise exception 'gold-set batch not found';
  end if;
  if locked_batch.status <> 'active' then
    raise exception 'only an active gold-set batch can unlock its test split';
  end if;
  if locked_batch.kind <> 'gold_standard' or locked_batch.test_percent = 0 then
    raise exception 'only a gold-standard batch with a test split can be unlocked';
  end if;
  if locked_batch.test_unlocked_at is not null then
    raise exception 'the gold-set test split is already unlocked';
  end if;

  select
    count(*) filter (where item.dataset_split = 'development')::integer,
    count(*) filter (
      where item.dataset_split = 'development'
        and item.review_status <> 'completed'
    )::integer,
    count(*) filter (where item.dataset_split = 'test')::integer,
    count(*) filter (
      where item.dataset_split = 'test'
        and (
          item.review_status <> 'pending'
          or item.started_at is not null
          or item.current_review_id is not null
          or item.supplemental_metadata_revealed_at is not null
          or item.automated_signals_revealed_at is not null
        )
    )::integer
  into development_count, development_incomplete_count, test_count, test_started_count
  from public.literature_gold_set_items as item
  where item.batch_id = p_batch_id;

  select count(*)::integer
  into development_draft_count
  from public.literature_gold_set_review_drafts as draft
  join public.literature_gold_set_items as item on item.id = draft.item_id
  where item.batch_id = p_batch_id
    and item.dataset_split = 'development';

  if development_count = 0 then
    raise exception 'the gold-set batch has no development items';
  end if;
  if development_incomplete_count > 0 or development_draft_count > 0 then
    raise exception 'complete the development split and clear its drafts before unlocking test';
  end if;
  if test_count = 0 then
    raise exception 'the gold-set batch has no test items';
  end if;
  if test_started_count > 0
    or exists (
      select 1
      from public.literature_gold_set_review_drafts as draft
      join public.literature_gold_set_items as item on item.id = draft.item_id
      where item.batch_id = p_batch_id
        and item.dataset_split = 'test'
    )
    or exists (
      select 1
      from public.literature_gold_set_events as event
      join public.literature_gold_set_items as item on item.id = event.item_id
      where item.batch_id = p_batch_id
        and item.dataset_split = 'test'
    ) then
    raise exception 'the test split was accessed before unlock; create a fresh gold-standard batch';
  end if;

  update public.literature_gold_set_batches
  set
    test_unlocked_at = unlock_time,
    test_unlocked_by_user_id = p_actor_user_id,
    test_unlocked_by_email = normalized_email,
    test_unlock_reason = normalized_reason
  where id = p_batch_id;

  return jsonb_build_object(
    'batchId', p_batch_id,
    'testUnlockedAt', unlock_time,
    'testItemCount', test_count
  );
end;
$$;

revoke all on function public.unlock_literature_gold_test_split_v1(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.unlock_literature_gold_test_split_v1(uuid, uuid, text, text)
  to service_role;

create or replace function public.list_literature_gold_batches_v2()
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
  development_completed_count integer,
  test_count integer,
  test_completed_count integer,
  test_unlocked_at timestamptz,
  test_unlocked_by_email text,
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
    count(item.id) filter (
      where item.dataset_split = 'development'
        and item.review_status = 'completed'
    )::integer as development_completed_count,
    count(item.id) filter (where item.dataset_split = 'test')::integer
      as test_count,
    count(item.id) filter (
      where item.dataset_split = 'test'
        and item.review_status = 'completed'
    )::integer as test_completed_count,
    batch.test_unlocked_at,
    batch.test_unlocked_by_email,
    batch.sampling_seed,
    batch.sampling_report,
    batch.created_at,
    batch.frozen_at
  from public.literature_gold_set_batches as batch
  left join public.literature_gold_set_items as item on item.batch_id = batch.id
  group by batch.id
  order by batch.created_at desc, batch.id;
$$;

revoke all on function public.list_literature_gold_batches_v2()
  from public, anon, authenticated;
grant execute on function public.list_literature_gold_batches_v2()
  to service_role;

create or replace function public.get_literature_gold_review_item_v2(
  p_batch_id uuid default null,
  p_item_id uuid default null,
  p_status text default 'unresolved',
  p_split text default 'development'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  selected_batch public.literature_gold_set_batches%rowtype;
  selected_item_split text;
begin
  if p_batch_id is null and p_item_id is not null then
    select batch.*
    into selected_batch
    from public.literature_gold_set_batches as batch
    join public.literature_gold_set_items as item on item.batch_id = batch.id
    where item.id = p_item_id;

    select item.dataset_split
    into selected_item_split
    from public.literature_gold_set_items as item
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

    if p_item_id is not null then
      select item.dataset_split
      into selected_item_split
      from public.literature_gold_set_items as item
      where item.id = p_item_id
        and item.batch_id = selected_batch.id;
    end if;
  end if;

  if selected_batch.id is not null
    and selected_batch.kind = 'gold_standard'
    and selected_batch.test_unlocked_at is null
    and (
      selected_item_split = 'test'
      or (
        p_split in ('test', 'all')
        and exists (
          select 1
          from public.literature_gold_set_items as item
          where item.batch_id = selected_batch.id
            and item.dataset_split = 'test'
        )
      )
    ) then
    raise exception 'the gold-set test split is locked until development review is complete';
  end if;

  return public.get_literature_gold_review_item_v1(
    p_batch_id,
    p_item_id,
    p_status,
    p_split
  );
end;
$$;

revoke all on function public.get_literature_gold_review_item_v1(uuid, uuid, text, text)
  from service_role;
revoke all on function public.get_literature_gold_review_item_v2(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.get_literature_gold_review_item_v2(uuid, uuid, text, text)
  to service_role;

notify pgrst, 'reload schema';
