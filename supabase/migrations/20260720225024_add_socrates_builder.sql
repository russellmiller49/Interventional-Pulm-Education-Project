alter table public.site_entitlements
  drop constraint if exists site_entitlements_entitlement_check;

alter table public.site_entitlements
  add constraint site_entitlements_entitlement_check check (
    entitlement = any (
      array[
        'socal_ebus_course',
        'ip_registry',
        'site_admin',
        'pccm_intro_course',
        'pccm_intro_course_admin_ucsd',
        'pccm_intro_course_admin_loma_linda',
        'socrates_editor'
      ]
    )
  );

create table if not exists public.socrates_slides (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  slide_key text not null,
  descriptor_url text not null,
  source_width integer not null,
  source_height integer not null,
  initial_x double precision not null,
  initial_y double precision not null,
  initial_width double precision not null,
  initial_height double precision not null,
  attribution_label text not null,
  attribution_url text not null,
  content_status text not null default 'Placeholder annotations—not clinically reviewed',
  workflow_status text not null default 'draft',
  revision integer not null default 1,
  published_snapshot jsonb,
  published_at timestamp with time zone,
  published_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  constraint socrates_slides_slug_check check (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint socrates_slides_title_check check (length(trim(title)) between 1 and 160),
  constraint socrates_slides_slide_key_check check (
    length(trim(slide_key)) between 1 and 200
  ),
  constraint socrates_slides_descriptor_url_check check (
    descriptor_url ~ '^https://www\\.invenio-cloud\\.com/api/thinslides/[A-Za-z0-9._-]+\\.dzi$'
  ),
  constraint socrates_slides_dimensions_check check (
    source_width > 0 and source_height > 0
  ),
  constraint socrates_slides_initial_view_check check (
    initial_x >= 0
    and initial_y >= 0
    and initial_width > 0
    and initial_height > 0
    and initial_x + initial_width <= source_width
    and initial_y + initial_height <= source_height
  ),
  constraint socrates_slides_attribution_check check (
    length(trim(attribution_label)) > 0 and attribution_url ~ '^https://'
  ),
  constraint socrates_slides_content_status_check check (
    length(trim(content_status)) > 0
  ),
  constraint socrates_slides_workflow_status_check check (
    workflow_status = any (array['draft', 'review', 'published'])
  ),
  constraint socrates_slides_revision_check check (revision > 0),
  constraint socrates_slides_published_snapshot_check check (
    published_snapshot is null or jsonb_typeof(published_snapshot) = 'object'
  )
);

create index if not exists socrates_slides_status_updated_idx
  on public.socrates_slides (workflow_status, updated_at desc);

create index if not exists socrates_slides_published_idx
  on public.socrates_slides (published_at desc)
  where published_snapshot is not null;

create index if not exists socrates_slides_created_by_idx
  on public.socrates_slides (created_by);

create index if not exists socrates_slides_updated_by_idx
  on public.socrates_slides (updated_by);

create index if not exists socrates_slides_published_by_idx
  on public.socrates_slides (published_by)
  where published_by is not null;

create table if not exists public.socrates_annotations (
  slide_id uuid not null references public.socrates_slides(id) on delete cascade,
  id text not null,
  parent_id text,
  label text not null,
  polygon jsonb not null,
  style text not null,
  enter_zoom_ratio double precision not null,
  exit_zoom_ratio double precision not null,
  summary text not null default '',
  placeholder_note text not null default '',
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  primary key (slide_id, id),
  constraint socrates_annotations_parent_fkey
    foreign key (slide_id, parent_id)
    references public.socrates_annotations(slide_id, id)
    on delete cascade
    deferrable initially deferred,
  constraint socrates_annotations_id_check check (
    id ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$'
  ),
  constraint socrates_annotations_parent_check check (parent_id is null or parent_id <> id),
  constraint socrates_annotations_label_check check (length(trim(label)) between 1 and 120),
  constraint socrates_annotations_polygon_check check (
    jsonb_typeof(polygon) = 'array' and jsonb_array_length(polygon) = 4
  ),
  constraint socrates_annotations_style_check check (
    style = any (array['parent', 'detail'])
  ),
  constraint socrates_annotations_zoom_check check (
    enter_zoom_ratio >= 0
    and exit_zoom_ratio >= 0
    and enter_zoom_ratio >= exit_zoom_ratio
  ),
  constraint socrates_annotations_sort_order_check check (sort_order >= 0)
);

create index if not exists socrates_annotations_slide_order_idx
  on public.socrates_annotations (slide_id, sort_order, id);

create index if not exists socrates_annotations_parent_idx
  on public.socrates_annotations (slide_id, parent_id)
  where parent_id is not null;

create table if not exists public.socrates_revisions (
  id uuid primary key default gen_random_uuid(),
  slide_id uuid not null references public.socrates_slides(id) on delete cascade,
  revision integer not null,
  workflow_status text not null,
  snapshot jsonb not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamp with time zone not null default timezone('utc', now()),
  unique (slide_id, revision),
  constraint socrates_revisions_revision_check check (revision > 0),
  constraint socrates_revisions_workflow_status_check check (
    workflow_status = any (array['draft', 'review', 'published'])
  ),
  constraint socrates_revisions_snapshot_check check (jsonb_typeof(snapshot) = 'object')
);

create index if not exists socrates_revisions_slide_created_idx
  on public.socrates_revisions (slide_id, created_at desc);

create index if not exists socrates_revisions_created_by_idx
  on public.socrates_revisions (created_by);

drop trigger if exists set_socrates_slides_updated_at on public.socrates_slides;
create trigger set_socrates_slides_updated_at
  before update on public.socrates_slides
  for each row execute function public.set_site_updated_at();

drop trigger if exists set_socrates_annotations_updated_at on public.socrates_annotations;
create trigger set_socrates_annotations_updated_at
  before update on public.socrates_annotations
  for each row execute function public.set_site_updated_at();

create or replace function public.current_user_can_edit_socrates()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.site_entitlements
    where user_id = (select auth.uid())
      and entitlement = any (array['socrates_editor', 'site_admin'])
      and status = 'active'
      and (expires_at is null or expires_at > timezone('utc', now()))
  );
$$;

revoke execute on function public.current_user_can_edit_socrates()
  from public, anon, authenticated;
grant execute on function public.current_user_can_edit_socrates()
  to authenticated;

alter table public.socrates_slides enable row level security;
alter table public.socrates_annotations enable row level security;
alter table public.socrates_revisions enable row level security;

revoke all on table public.socrates_slides from public, anon, authenticated;
revoke all on table public.socrates_annotations from public, anon, authenticated;
revoke all on table public.socrates_revisions from public, anon, authenticated;

grant select on table public.socrates_slides to authenticated;
grant insert (
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
) on table public.socrates_slides to authenticated;
grant update (
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
  updated_by
) on table public.socrates_slides to authenticated;
grant delete on table public.socrates_slides to authenticated;
grant select, insert, update, delete on table public.socrates_annotations to authenticated;
grant select, insert on table public.socrates_revisions to authenticated;

grant all on table public.socrates_slides to service_role;
grant all on table public.socrates_annotations to service_role;
grant all on table public.socrates_revisions to service_role;

drop policy if exists socrates_slides_select_authenticated on public.socrates_slides;
create policy socrates_slides_select_authenticated
  on public.socrates_slides
  for select
  to authenticated
  using (public.current_user_can_edit_socrates());

drop policy if exists socrates_slides_insert_editor on public.socrates_slides;
create policy socrates_slides_insert_editor
  on public.socrates_slides
  for insert
  to authenticated
  with check (
    public.current_user_can_edit_socrates()
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
    and workflow_status = any (array['draft', 'review'])
    and published_snapshot is null
  );

drop policy if exists socrates_slides_update_editor on public.socrates_slides;
create policy socrates_slides_update_editor
  on public.socrates_slides
  for update
  to authenticated
  using (public.current_user_can_edit_socrates())
  with check (
    public.current_user_can_edit_socrates()
    and updated_by = (select auth.uid())
    and (
      workflow_status <> 'published'
      or public.current_user_has_site_admin()
    )
  );

drop policy if exists socrates_slides_delete_editor on public.socrates_slides;
create policy socrates_slides_delete_editor
  on public.socrates_slides
  for delete
  to authenticated
  using (
    public.current_user_can_edit_socrates()
    and (
      published_snapshot is null
      or public.current_user_has_site_admin()
    )
  );

drop policy if exists socrates_annotations_select_editor on public.socrates_annotations;
create policy socrates_annotations_select_editor
  on public.socrates_annotations
  for select
  to authenticated
  using (public.current_user_can_edit_socrates());

drop policy if exists socrates_annotations_insert_editor on public.socrates_annotations;
create policy socrates_annotations_insert_editor
  on public.socrates_annotations
  for insert
  to authenticated
  with check (public.current_user_can_edit_socrates());

drop policy if exists socrates_annotations_update_editor on public.socrates_annotations;
create policy socrates_annotations_update_editor
  on public.socrates_annotations
  for update
  to authenticated
  using (public.current_user_can_edit_socrates())
  with check (public.current_user_can_edit_socrates());

drop policy if exists socrates_annotations_delete_editor on public.socrates_annotations;
create policy socrates_annotations_delete_editor
  on public.socrates_annotations
  for delete
  to authenticated
  using (public.current_user_can_edit_socrates());

drop policy if exists socrates_revisions_select_editor on public.socrates_revisions;
create policy socrates_revisions_select_editor
  on public.socrates_revisions
  for select
  to authenticated
  using (public.current_user_can_edit_socrates());

drop policy if exists socrates_revisions_insert_editor on public.socrates_revisions;
create policy socrates_revisions_insert_editor
  on public.socrates_revisions
  for insert
  to authenticated
  with check (
    public.current_user_can_edit_socrates()
    and created_by = (select auth.uid())
  );

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

revoke execute on function public.save_socrates_slide_document(jsonb)
  from public, anon, authenticated;
grant execute on function public.save_socrates_slide_document(jsonb)
  to authenticated;

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

revoke execute on function public.publish_socrates_slide_document(uuid)
  from public, anon, authenticated;
grant execute on function public.publish_socrates_slide_document(uuid)
  to authenticated;

create or replace function public.get_published_socrates_slide(requested_slug text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select published_snapshot
  from public.socrates_slides
  where published_snapshot is not null
    and (requested_slug is null or slug = requested_slug)
  order by
    case when requested_slug is not null and slug = requested_slug then 0 else 1 end,
    published_at desc nulls last,
    created_at asc
  limit 1;
$$;

revoke execute on function public.get_published_socrates_slide(text)
  from public, anon, authenticated;
grant execute on function public.get_published_socrates_slide(text)
  to anon, authenticated;

notify pgrst, 'reload schema';
