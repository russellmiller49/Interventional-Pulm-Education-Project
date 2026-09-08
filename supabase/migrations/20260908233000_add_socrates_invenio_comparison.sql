-- Keep the existing editor, administrator, and sandbox access model.
-- The comparison image is derived from the approved tissue descriptor's slide ID,
-- so saved documents cannot accidentally pair images from different cases.
create or replace function public.is_approved_socrates_descriptor_url(value text)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce(value ~ '^(https://www[.]invenio-cloud[.]com/api/thinslides/[A-Za-z0-9._-]+[.]dzi|https://ucsd-slide-viewer-1080580899927[.]us-central1[.]run[.]app/generated/tiles/nio-[0-9]+-series-[0-9]+-barcode-[a-z0-9]+/(original|analysis)[.]dzi)$', false);
$$;

revoke all on function public.is_approved_socrates_descriptor_url(text) from public, anon;
grant execute on function public.is_approved_socrates_descriptor_url(text) to authenticated, service_role;

alter table public.socrates_slides
  drop constraint socrates_slides_descriptor_url_check;
alter table public.socrates_slides
  add constraint socrates_slides_descriptor_url_check
  check (public.is_approved_socrates_descriptor_url(descriptor_url));

alter table public.socrates_annotations
  add column explanation text not null default ''
  constraint socrates_annotations_explanation_check check (length(explanation) <= 8000);

create or replace function public.save_socrates_slide_document(payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor_id uuid := (select auth.uid());
  document_id uuid;
  next_revision integer;
  next_status text := coalesce(payload ->> 'workflowStatus', 'draft');
  annotation jsonb;
  saved_snapshot jsonb;
begin
  if actor_id is null or not public.current_user_can_edit_socrates() then
    raise exception 'SOCRATES editor access is required' using errcode = '42501';
  end if;

  if jsonb_typeof(payload) <> 'object' then
    raise exception 'The SOCRATES document must be a JSON object' using errcode = '22023';
  end if;

  if jsonb_typeof(payload -> 'annotations') <> 'array' then
    raise exception 'The annotations field must be a JSON array' using errcode = '22023';
  end if;

  if next_status <> all (array['draft', 'review']) then
    raise exception 'Draft saves may only use draft or review status' using errcode = '22023';
  end if;

  document_id := nullif(payload ->> 'recordId', '')::uuid;

  if document_id is null then
    document_id := gen_random_uuid();
    next_revision := 1;

    insert into public.socrates_slides (
      id,
      slug,
      title,
      slide_key,
      descriptor_url,
      source_width,
      source_height,
      initial_x,
      initial_y,
      initial_width,
      initial_height,
      attribution_label,
      attribution_url,
      content_status,
      workflow_status,
      revision,
      created_by,
      updated_by
    ) values (
      document_id,
      payload ->> 'slug',
      payload ->> 'title',
      payload #>> '{slide,id}',
      payload #>> '{slide,descriptorUrl}',
      (payload #>> '{slide,expectedDimensions,width}')::integer,
      (payload #>> '{slide,expectedDimensions,height}')::integer,
      (payload #>> '{slide,initialImageRect,x}')::double precision,
      (payload #>> '{slide,initialImageRect,y}')::double precision,
      (payload #>> '{slide,initialImageRect,width}')::double precision,
      (payload #>> '{slide,initialImageRect,height}')::double precision,
      payload #>> '{slide,attribution,label}',
      payload #>> '{slide,attribution,href}',
      payload #>> '{slide,contentStatus}',
      next_status,
      next_revision,
      actor_id,
      actor_id
    );
  else
    update public.socrates_slides
    set
      slug = payload ->> 'slug',
      title = payload ->> 'title',
      slide_key = payload #>> '{slide,id}',
      descriptor_url = payload #>> '{slide,descriptorUrl}',
      source_width = (payload #>> '{slide,expectedDimensions,width}')::integer,
      source_height = (payload #>> '{slide,expectedDimensions,height}')::integer,
      initial_x = (payload #>> '{slide,initialImageRect,x}')::double precision,
      initial_y = (payload #>> '{slide,initialImageRect,y}')::double precision,
      initial_width = (payload #>> '{slide,initialImageRect,width}')::double precision,
      initial_height = (payload #>> '{slide,initialImageRect,height}')::double precision,
      attribution_label = payload #>> '{slide,attribution,label}',
      attribution_url = payload #>> '{slide,attribution,href}',
      content_status = payload #>> '{slide,contentStatus}',
      workflow_status = next_status,
      revision = revision + 1,
      updated_by = actor_id
    where id = document_id
    returning revision into next_revision;

    if not found then
      raise exception 'SOCRATES slide not found or not editable' using errcode = 'P0002';
    end if;

    delete from public.socrates_annotations where slide_id = document_id;
  end if;

  for annotation in select value from jsonb_array_elements(payload -> 'annotations')
  loop
    insert into public.socrates_annotations (
      slide_id,
      id,
      parent_id,
      label,
      polygon,
      style,
      enter_zoom_ratio,
      exit_zoom_ratio,
      summary,
      explanation,
      placeholder_note,
      sort_order
    ) values (
      document_id,
      annotation ->> 'id',
      nullif(annotation ->> 'parentId', ''),
      annotation ->> 'label',
      annotation -> 'polygon',
      annotation ->> 'style',
      (annotation ->> 'enterZoomRatio')::double precision,
      (annotation ->> 'exitZoomRatio')::double precision,
      coalesce(annotation ->> 'summary', ''),
      coalesce(annotation ->> 'explanation', ''),
      coalesce(annotation ->> 'placeholderNote', ''),
      coalesce((annotation ->> 'sortOrder')::integer, 0)
    );
  end loop;

  saved_snapshot := payload || jsonb_build_object(
    'recordId', document_id,
    'revision', next_revision,
    'workflowStatus', next_status
  );

  insert into public.socrates_revisions (
    slide_id,
    revision,
    workflow_status,
    snapshot,
    created_by
  ) values (
    document_id,
    next_revision,
    next_status,
    saved_snapshot,
    actor_id
  );

  return saved_snapshot;
end;
$$;

create or replace function public.publish_socrates_slide_document(target_slide_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := (select auth.uid());
  slide_record public.socrates_slides%rowtype;
  annotation_payload jsonb;
  published_document jsonb;
  next_revision integer;
  published_time timestamp with time zone := timezone('utc', now());
begin
  if actor_id is null or not public.current_user_has_site_admin() then
    raise exception 'Site administrator access is required to publish SOCRATES slides'
      using errcode = '42501';
  end if;

  select * into slide_record
  from public.socrates_slides
  where id = target_slide_id
  for update;

  if not found then
    raise exception 'SOCRATES slide not found' using errcode = 'P0002';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'parentId', parent_id,
        'label', label,
        'polygon', polygon,
        'style', style,
        'enterZoomRatio', enter_zoom_ratio,
        'exitZoomRatio', exit_zoom_ratio,
        'summary', summary,
        'explanation', explanation,
        'placeholderNote', placeholder_note,
        'sortOrder', sort_order
      ) order by sort_order, id
    ),
    '[]'::jsonb
  ) into annotation_payload
  from public.socrates_annotations
  where slide_id = target_slide_id;

  if jsonb_array_length(annotation_payload) = 0 then
    raise exception 'At least one annotation is required before publishing'
      using errcode = '23514';
  end if;

  next_revision := slide_record.revision + 1;
  published_document := jsonb_build_object(
    'recordId', slide_record.id,
    'slug', slide_record.slug,
    'title', slide_record.title,
    'workflowStatus', 'published',
    'revision', next_revision,
    'publishedAt', published_time,
    'slide', jsonb_build_object(
      'id', slide_record.slide_key,
      'descriptorUrl', slide_record.descriptor_url,
      'expectedDimensions', jsonb_build_object(
        'width', slide_record.source_width,
        'height', slide_record.source_height
      ),
      'initialImageRect', jsonb_build_object(
        'x', slide_record.initial_x,
        'y', slide_record.initial_y,
        'width', slide_record.initial_width,
        'height', slide_record.initial_height
      ),
      'attribution', jsonb_build_object(
        'label', slide_record.attribution_label,
        'href', slide_record.attribution_url
      ),
      'contentStatus', slide_record.content_status
    ),
    'annotations', annotation_payload
  );

  update public.socrates_slides
  set
    workflow_status = 'published',
    revision = next_revision,
    published_snapshot = published_document,
    published_at = published_time,
    published_by = actor_id,
    updated_by = actor_id
  where id = target_slide_id;

  insert into public.socrates_revisions (
    slide_id,
    revision,
    workflow_status,
    snapshot,
    created_by
  ) values (
    target_slide_id,
    next_revision,
    'published',
    published_document,
    actor_id
  );

  return published_document;
end;
$$;

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

  if not public.is_approved_socrates_descriptor_url(payload #>> '{slide,descriptorUrl}') then
    raise exception 'Use an approved Invenio slide descriptor URL' using errcode = '22023';
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

    if annotation ? 'explanation' and (
        pg_catalog.jsonb_typeof(annotation -> 'explanation') is distinct from 'string'
        or pg_catalog.length(annotation ->> 'explanation') > 8000
    ) then
      raise exception 'Detailed explanations must be text of at most 8000 characters' using errcode = '22023';
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

-- CREATE OR REPLACE retains privileges; repeat the existing grants explicitly.
revoke execute on function public.save_socrates_slide_document(jsonb) from public, anon, authenticated;
grant execute on function public.save_socrates_slide_document(jsonb) to authenticated;
revoke execute on function public.publish_socrates_slide_document(uuid) from public, anon, authenticated;
grant execute on function public.publish_socrates_slide_document(uuid) to authenticated;
revoke execute on function public.save_socrates_sandbox_document(jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.save_socrates_sandbox_document(jsonb, text, uuid) to anon, authenticated;
