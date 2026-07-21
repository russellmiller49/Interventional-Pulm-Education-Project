create table public.socrates_sandbox_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  document jsonb not null,
  edit_token_hash text not null,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  constraint socrates_sandbox_documents_slug_check check (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint socrates_sandbox_documents_title_check check (
    length(trim(title)) between 1 and 160
  ),
  constraint socrates_sandbox_documents_document_check check (
    jsonb_typeof(document) = 'object'
    and octet_length(document::text) <= 262144
  ),
  constraint socrates_sandbox_documents_edit_token_hash_check check (
    edit_token_hash ~ '^[a-f0-9]{64}$'
  )
);

comment on table public.socrates_sandbox_documents is
  'Disposable, unlisted SOCRATES company-demo drafts. Kept separate from reviewed/published slide records.';

create index socrates_sandbox_documents_updated_idx
  on public.socrates_sandbox_documents (updated_at desc);

drop trigger if exists set_socrates_sandbox_documents_updated_at
  on public.socrates_sandbox_documents;
create trigger set_socrates_sandbox_documents_updated_at
  before update on public.socrates_sandbox_documents
  for each row execute function public.set_site_updated_at();

alter table public.socrates_sandbox_documents enable row level security;

revoke all on table public.socrates_sandbox_documents
  from public, anon, authenticated;
grant all on table public.socrates_sandbox_documents to service_role;

create or replace function public.list_socrates_sandbox_documents()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(recent.document order by recent.updated_at desc), '[]'::jsonb)
  from (
    select document, updated_at
    from public.socrates_sandbox_documents
    order by updated_at desc
    limit 50
  ) as recent;
$$;

comment on function public.list_socrates_sandbox_documents() is
  'Returns only sanitized sandbox documents; edit-token hashes and table metadata are never exposed.';

revoke execute on function public.list_socrates_sandbox_documents()
  from public, anon, authenticated;
grant execute on function public.list_socrates_sandbox_documents()
  to anon, authenticated;

create or replace function public.save_socrates_sandbox_document(
  payload jsonb,
  edit_token text,
  target_document_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  annotation jsonb;
  point_value jsonb;
  document_id uuid;
  normalized_payload jsonb;
  next_revision integer;
  expected_width numeric;
  expected_height numeric;
  initial_x numeric;
  initial_y numeric;
  initial_width numeric;
  initial_height numeric;
  annotation_x numeric;
  annotation_y numeric;
  supplied_token_hash text;
  stored_token_hash text;
begin
  if pg_catalog.jsonb_typeof(payload) is distinct from 'object' then
    raise exception 'The sandbox document must be a JSON object' using errcode = '22023';
  end if;

  if pg_catalog.octet_length(payload::text) > 262144 then
    raise exception 'Sandbox documents are limited to 256 KB' using errcode = '22023';
  end if;

  if edit_token is null or pg_catalog.length(edit_token) < 32 or pg_catalog.length(edit_token) > 256 then
    raise exception 'A valid sandbox edit key is required' using errcode = '22023';
  end if;

  supplied_token_hash := pg_catalog.encode(extensions.digest(edit_token, 'sha256'), 'hex');

  if coalesce(payload ->> 'slug', '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'The sandbox slug is invalid' using errcode = '22023';
  end if;

  if pg_catalog.length(pg_catalog.btrim(coalesce(payload ->> 'title', ''))) not between 1 and 160 then
    raise exception 'The sandbox title must contain 1 to 160 characters' using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(payload -> 'slide') is distinct from 'object' then
    raise exception 'The slide field must be an object' using errcode = '22023';
  end if;

  if pg_catalog.length(pg_catalog.btrim(coalesce(payload #>> '{slide,id}', ''))) not between 1 and 200 then
    raise exception 'The slide ID is invalid' using errcode = '22023';
  end if;

  if coalesce(payload #>> '{slide,descriptorUrl}', '')
      !~ '^https://www\.invenio-cloud\.com/api/thinslides/[A-Za-z0-9._-]+\.dzi$' then
    raise exception 'Use an approved Invenio Cloud DZI descriptor URL' using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(payload #> '{slide,expectedDimensions,width}') is distinct from 'number'
      or pg_catalog.jsonb_typeof(payload #> '{slide,expectedDimensions,height}') is distinct from 'number' then
    raise exception 'Slide dimensions must be numbers' using errcode = '22023';
  end if;

  expected_width := (payload #>> '{slide,expectedDimensions,width}')::numeric;
  expected_height := (payload #>> '{slide,expectedDimensions,height}')::numeric;
  if expected_width <> pg_catalog.trunc(expected_width)
      or expected_height <> pg_catalog.trunc(expected_height)
      or expected_width not between 1 and 500000
      or expected_height not between 1 and 500000 then
    raise exception 'Slide dimensions must be positive whole numbers no larger than 500000' using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(payload #> '{slide,initialImageRect,x}') is distinct from 'number'
      or pg_catalog.jsonb_typeof(payload #> '{slide,initialImageRect,y}') is distinct from 'number'
      or pg_catalog.jsonb_typeof(payload #> '{slide,initialImageRect,width}') is distinct from 'number'
      or pg_catalog.jsonb_typeof(payload #> '{slide,initialImageRect,height}') is distinct from 'number' then
    raise exception 'The starting crop must contain numeric coordinates' using errcode = '22023';
  end if;

  initial_x := (payload #>> '{slide,initialImageRect,x}')::numeric;
  initial_y := (payload #>> '{slide,initialImageRect,y}')::numeric;
  initial_width := (payload #>> '{slide,initialImageRect,width}')::numeric;
  initial_height := (payload #>> '{slide,initialImageRect,height}')::numeric;
  if initial_x < 0 or initial_y < 0 or initial_width <= 0 or initial_height <= 0
      or initial_x + initial_width > expected_width
      or initial_y + initial_height > expected_height then
    raise exception 'The starting crop must stay inside the slide' using errcode = '22023';
  end if;

  if pg_catalog.length(pg_catalog.btrim(coalesce(payload #>> '{slide,attribution,label}', ''))) not between 1 and 300
      or coalesce(payload #>> '{slide,attribution,href}', '') !~ '^https://'
      or pg_catalog.length(payload #>> '{slide,attribution,href}') > 2048 then
    raise exception 'The slide attribution is invalid' using errcode = '22023';
  end if;

  if pg_catalog.length(pg_catalog.btrim(coalesce(payload #>> '{slide,contentStatus}', ''))) not between 1 and 500 then
    raise exception 'The content status is invalid' using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(payload -> 'annotations') is distinct from 'array' then
    raise exception 'The annotations field must be an array' using errcode = '22023';
  end if;

  if pg_catalog.jsonb_array_length(payload -> 'annotations') > 200 then
    raise exception 'Sandbox documents are limited to 200 annotations' using errcode = '22023';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.jsonb_array_elements(payload -> 'annotations') as item(value)
  ) <> (
    select pg_catalog.count(distinct item.value ->> 'id')
    from pg_catalog.jsonb_array_elements(payload -> 'annotations') as item(value)
  ) then
    raise exception 'Annotation IDs must be unique' using errcode = '22023';
  end if;

  for annotation in
    select item.value
    from pg_catalog.jsonb_array_elements(payload -> 'annotations') as item(value)
  loop
    if pg_catalog.jsonb_typeof(annotation) is distinct from 'object'
        or coalesce(annotation ->> 'id', '') !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$'
        or pg_catalog.length(pg_catalog.btrim(coalesce(annotation ->> 'label', ''))) not between 1 and 120
        or coalesce(annotation ->> 'style', '') <> all (array['parent', 'detail']) then
      raise exception 'A sandbox annotation has invalid identity fields' using errcode = '22023';
    end if;

    if pg_catalog.length(coalesce(annotation ->> 'summary', '')) > 2000
        or pg_catalog.length(coalesce(annotation ->> 'placeholderNote', '')) > 2000 then
      raise exception 'Annotation notes are limited to 2000 characters' using errcode = '22023';
    end if;

    if pg_catalog.jsonb_typeof(annotation -> 'enterZoomRatio') is distinct from 'number'
        or pg_catalog.jsonb_typeof(annotation -> 'exitZoomRatio') is distinct from 'number'
        or (annotation ->> 'enterZoomRatio')::numeric < 0
        or (annotation ->> 'exitZoomRatio')::numeric < 0
        or (annotation ->> 'enterZoomRatio')::numeric < (annotation ->> 'exitZoomRatio')::numeric then
      raise exception 'Annotation zoom thresholds are invalid' using errcode = '22023';
    end if;

    if annotation ->> 'style' = 'parent' and nullif(annotation ->> 'parentId', '') is not null then
      raise exception 'Parent annotations cannot have a parent' using errcode = '22023';
    end if;

    if annotation ->> 'style' = 'detail' and not exists (
      select 1
      from pg_catalog.jsonb_array_elements(payload -> 'annotations') as parent(value)
      where parent.value ->> 'id' = annotation ->> 'parentId'
        and parent.value ->> 'style' = 'parent'
    ) then
      raise exception 'Detail annotations require a valid parent annotation' using errcode = '22023';
    end if;

    if pg_catalog.jsonb_typeof(annotation -> 'polygon') is distinct from 'array'
        or pg_catalog.jsonb_array_length(annotation -> 'polygon') <> 4 then
      raise exception 'Annotation polygons must contain exactly four points' using errcode = '22023';
    end if;

    for point_value in
      select point.item
      from pg_catalog.jsonb_array_elements(annotation -> 'polygon') as point(item)
    loop
      if pg_catalog.jsonb_typeof(point_value) is distinct from 'object'
          or pg_catalog.jsonb_typeof(point_value -> 'x') is distinct from 'number'
          or pg_catalog.jsonb_typeof(point_value -> 'y') is distinct from 'number' then
        raise exception 'Annotation polygon points must contain numeric x and y coordinates' using errcode = '22023';
      end if;

      annotation_x := (point_value ->> 'x')::numeric;
      annotation_y := (point_value ->> 'y')::numeric;
      if annotation_x < 0 or annotation_y < 0
          or annotation_x > expected_width or annotation_y > expected_height then
        raise exception 'Annotation polygon points must stay inside the slide' using errcode = '22023';
      end if;
    end loop;
  end loop;

  if target_document_id is null then
    if (select pg_catalog.count(*) from public.socrates_sandbox_documents) >= 100 then
      raise exception 'The company sandbox is full; ask the site owner to clear older drafts'
        using errcode = 'P0001';
    end if;

    document_id := extensions.gen_random_uuid();
    next_revision := 1;
  else
    select edit_token_hash, coalesce((document ->> 'revision')::integer, 0) + 1
      into stored_token_hash, next_revision
    from public.socrates_sandbox_documents
    where id = target_document_id
    for update;

    if not found or stored_token_hash <> supplied_token_hash then
      raise exception 'The sandbox draft was not found or its edit key is invalid'
        using errcode = '42501';
    end if;

    document_id := target_document_id;
  end if;

  normalized_payload := pg_catalog.jsonb_build_object(
    'recordId', document_id,
    'slug', payload ->> 'slug',
    'title', payload ->> 'title',
    'workflowStatus', 'draft',
    'revision', next_revision,
    'publishedAt', null,
    'slide', payload -> 'slide',
    'annotations', payload -> 'annotations'
  );

  if target_document_id is null then
    insert into public.socrates_sandbox_documents (
      id,
      slug,
      title,
      document,
      edit_token_hash
    ) values (
      document_id,
      payload ->> 'slug',
      payload ->> 'title',
      normalized_payload,
      supplied_token_hash
    );
  else
    update public.socrates_sandbox_documents
    set
      slug = payload ->> 'slug',
      title = payload ->> 'title',
      document = normalized_payload
    where id = document_id;
  end if;

  return normalized_payload;
end;
$$;

comment on function public.save_socrates_sandbox_document(jsonb, text, uuid) is
  'Creates or edits a disposable sandbox draft after strict payload validation and edit-key verification.';

revoke execute on function public.save_socrates_sandbox_document(jsonb, text, uuid)
  from public, anon, authenticated;
grant execute on function public.save_socrates_sandbox_document(jsonb, text, uuid)
  to anon, authenticated;

create or replace function public.delete_socrates_sandbox_document(
  target_document_id uuid,
  edit_token text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  supplied_token_hash text;
begin
  if edit_token is null or pg_catalog.length(edit_token) < 32 or pg_catalog.length(edit_token) > 256 then
    return false;
  end if;

  supplied_token_hash := pg_catalog.encode(extensions.digest(edit_token, 'sha256'), 'hex');

  delete from public.socrates_sandbox_documents
  where id = target_document_id
    and edit_token_hash = supplied_token_hash;

  return found;
end;
$$;

revoke execute on function public.delete_socrates_sandbox_document(uuid, text)
  from public, anon, authenticated;
grant execute on function public.delete_socrates_sandbox_document(uuid, text)
  to anon, authenticated;

create or replace function public.admin_delete_socrates_sandbox_document(
  target_document_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.current_user_has_site_admin() then
    raise exception 'Site administrator access is required to delete sandbox drafts'
      using errcode = '42501';
  end if;

  delete from public.socrates_sandbox_documents
  where id = target_document_id;

  return found;
end;
$$;

revoke execute on function public.admin_delete_socrates_sandbox_document(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_delete_socrates_sandbox_document(uuid)
  to authenticated;

notify pgrst, 'reload schema';
