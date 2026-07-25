-- IP Preference Card Builder v0.1
-- Additive prototype schema. Imported catalog records remain read-only and
-- generated case-card snapshots are append-only.

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
        'socrates_editor',
        'preference_cards_builder'
      ]
    )
  );

create table public.ip_catalog_imports (
  id text primary key,
  workbook_sha256 text not null unique
    check (workbook_sha256 ~ '^[a-f0-9]{64}$'),
  workbook_filename text not null,
  source_as_of date,
  row_counts jsonb not null default '{}'::jsonb
    check (jsonb_typeof(row_counts) = 'object'),
  import_report jsonb not null default '{}'::jsonb
    check (jsonb_typeof(import_report) = 'object'),
  imported_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.ip_catalog_manufacturers (
  catalog_import_id text not null
    references public.ip_catalog_imports(id) on delete restrict,
  manufacturer_id text not null,
  manufacturer_name text not null,
  source_row jsonb not null default '{}'::jsonb,
  primary key (catalog_import_id, manufacturer_id)
);

create table public.ip_catalog_sources (
  catalog_import_id text not null
    references public.ip_catalog_imports(id) on delete restrict,
  source_id text not null,
  source_type text,
  title text,
  url text,
  source_as_of date,
  source_row jsonb not null default '{}'::jsonb,
  primary key (catalog_import_id, source_id)
);

create table public.ip_catalog_products (
  catalog_import_id text not null
    references public.ip_catalog_imports(id) on delete restrict,
  product_id text not null,
  manufacturer_id text not null,
  manufacturer text,
  distributor text,
  brand_family text,
  product_name text not null,
  catalog_number text,
  alternate_ids text,
  gtin text check (gtin is null or gtin ~ '^[0-9]{14}$'),
  primary_category text,
  subcategory text,
  product_kind text,
  reuse_status text,
  sterile_status text,
  implantable boolean,
  material text,
  coverage text,
  placement_method text,
  size_display text,
  diameter_mm numeric,
  length_mm numeric,
  french_size numeric,
  gauge numeric,
  working_length_cm numeric,
  min_working_channel_mm numeric,
  delivery_system_od_mm numeric,
  package_uom text,
  adult_peds text,
  description text,
  compatibility_text text,
  verification_status text,
  verification_state text not null default 'unknown'
    check (verification_state = any (array['verified_source', 'candidate', 'unknown'])),
  live_dropdown_status text,
  visibility_state text not null default 'hidden'
    check (visibility_state = any (array['prototype_visible', 'hidden'])),
  primary_source_id text,
  primary_source_location text,
  source_as_of date,
  availability_note text,
  notes text,
  spec_json jsonb,
  spec_json_raw text,
  global_part_number text,
  reference_part_number text,
  source_row jsonb not null default '{}'::jsonb,
  primary key (catalog_import_id, product_id),
  foreign key (catalog_import_id, manufacturer_id)
    references public.ip_catalog_manufacturers(catalog_import_id, manufacturer_id)
    on delete restrict,
  foreign key (catalog_import_id, primary_source_id)
    references public.ip_catalog_sources(catalog_import_id, source_id)
    on delete restrict
);

create index ip_catalog_products_role_lookup_idx
  on public.ip_catalog_products (catalog_import_id, visibility_state, manufacturer);

create table public.ip_catalog_product_sources (
  catalog_import_id text not null,
  product_id text not null,
  source_id text not null,
  source_location text,
  source_row jsonb not null default '{}'::jsonb,
  primary key (catalog_import_id, product_id, source_id),
  foreign key (catalog_import_id, product_id)
    references public.ip_catalog_products(catalog_import_id, product_id)
    on delete restrict,
  foreign key (catalog_import_id, source_id)
    references public.ip_catalog_sources(catalog_import_id, source_id)
    on delete restrict
);

create table public.ip_catalog_roles (
  catalog_import_id text not null,
  role_code text not null,
  category text,
  role_name text not null,
  description text,
  selection_guidance text,
  requires_current_ifu boolean not null default false,
  source_row jsonb not null default '{}'::jsonb,
  primary key (catalog_import_id, role_code),
  foreign key (catalog_import_id)
    references public.ip_catalog_imports(id) on delete restrict
);

create table public.ip_catalog_product_roles (
  catalog_import_id text not null,
  product_id text not null,
  role_code text not null,
  role_fit text,
  notes text,
  source_row jsonb not null default '{}'::jsonb,
  primary key (catalog_import_id, product_id, role_code),
  foreign key (catalog_import_id, product_id)
    references public.ip_catalog_products(catalog_import_id, product_id)
    on delete restrict,
  foreign key (catalog_import_id, role_code)
    references public.ip_catalog_roles(catalog_import_id, role_code)
    on delete restrict
);

create index ip_catalog_product_roles_role_idx
  on public.ip_catalog_product_roles (catalog_import_id, role_code);

create table public.ip_catalog_procedures (
  catalog_import_id text not null,
  procedure_code text not null,
  procedure_name text not null,
  template_version text not null,
  scope text,
  status text,
  clinical_owner text,
  notes text,
  source_row jsonb not null default '{}'::jsonb,
  primary key (catalog_import_id, procedure_code),
  foreign key (catalog_import_id)
    references public.ip_catalog_imports(id) on delete restrict
);

create table public.ip_catalog_procedure_slots (
  catalog_import_id text not null,
  slot_id text not null,
  procedure_code text not null,
  section text not null,
  display_order integer not null,
  role_code text not null,
  slot_label text not null,
  generic_requirement text not null,
  requiredness text not null
    check (requiredness = any (array['required', 'conditional', 'optional'])),
  default_qty integer not null check (default_qty >= 0),
  selection_mode text not null
    check (selection_mode = any (array['single', 'multiple'])),
  allow_custom boolean not null default false,
  dependency_rule text,
  notes text,
  source_row jsonb not null default '{}'::jsonb,
  primary key (catalog_import_id, slot_id),
  foreign key (catalog_import_id, procedure_code)
    references public.ip_catalog_procedures(catalog_import_id, procedure_code)
    on delete restrict,
  foreign key (catalog_import_id, role_code)
    references public.ip_catalog_roles(catalog_import_id, role_code)
    on delete restrict
);

create index ip_catalog_procedure_slots_procedure_idx
  on public.ip_catalog_procedure_slots
  (catalog_import_id, procedure_code, display_order);

create table public.ip_catalog_slot_product_options (
  catalog_import_id text not null,
  slot_id text not null,
  product_id text not null,
  role_code text not null,
  eligibility_status text,
  visible_by_default boolean not null default false,
  selectable boolean not null default false,
  reason text,
  source_row jsonb not null default '{}'::jsonb,
  primary key (catalog_import_id, slot_id, product_id),
  foreign key (catalog_import_id, slot_id)
    references public.ip_catalog_procedure_slots(catalog_import_id, slot_id)
    on delete restrict,
  foreign key (catalog_import_id, product_id)
    references public.ip_catalog_products(catalog_import_id, product_id)
    on delete restrict
);

create table public.ip_catalog_compatibility_raw (
  catalog_import_id text not null,
  rule_id text not null,
  source_product_or_role text not null,
  relationship text,
  target_product_or_role text,
  rule_text text,
  verification_status text,
  verification_state text not null default 'unknown',
  source_id text,
  resolved_source_type text,
  resolved_source_id text,
  resolved_target_type text,
  resolved_target_id text,
  source_row jsonb not null default '{}'::jsonb,
  primary key (catalog_import_id, rule_id),
  foreign key (catalog_import_id)
    references public.ip_catalog_imports(id) on delete restrict
);

create table public.ip_catalog_verification_backlog (
  catalog_import_id text not null,
  product_id text not null,
  priority text,
  workstream text,
  review_status text,
  manufacturer text,
  product_name text,
  catalog_number text,
  existing_gtin_audit text,
  roles text,
  procedures text,
  required_slots text,
  conditional_slots text,
  optional_slots text,
  current_verification_status text,
  current_live_status text,
  gudid_result text,
  match_confidence text,
  suggested_primary_di text,
  distribution_status text,
  verification_remaining text,
  recommended_action text,
  decision text,
  evidence_url text,
  notes text,
  source_row jsonb not null default '{}'::jsonb,
  primary key (catalog_import_id, product_id),
  foreign key (catalog_import_id, product_id)
    references public.ip_catalog_products(catalog_import_id, product_id)
    on delete restrict
);

create table public.ip_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.ip_organization_members (
  organization_id uuid not null
    references public.ip_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null
    check (role = any (array['viewer', 'builder', 'admin', 'content_owner'])),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (organization_id, user_id)
);

create index ip_organization_members_user_idx
  on public.ip_organization_members (user_id, active);

create table public.ip_sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.ip_organizations(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.ip_procedure_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.ip_organizations(id) on delete cascade,
  site_id uuid not null references public.ip_sites(id) on delete cascade,
  name text not null,
  capabilities jsonb not null default '[]'::jsonb
    check (jsonb_typeof(capabilities) = 'array'),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.ip_hospital_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.ip_organizations(id) on delete cascade,
  site_id uuid references public.ip_sites(id) on delete cascade,
  location_id uuid references public.ip_procedure_locations(id) on delete cascade,
  item_type text not null check (
    item_type = any (
      array[
        'commercial_product',
        'hospital_local_disposable',
        'capital_asset',
        'reusable_instrument',
        'instrument_tray',
        'procedure_kit',
        'medication_or_solution_prompt',
        'room_resource',
        'personnel_or_service',
        'protocol_or_readiness_check',
        'specimen_or_laboratory_requirement'
      ]
    )
  ),
  catalog_import_id text,
  catalog_product_id text,
  role_code text,
  local_item_number text,
  local_description text not null,
  local_uom text,
  storage_location text,
  par_level numeric,
  active boolean not null default true,
  verification_state text not null default 'unverified'
    check (
      verification_state = any (
        array['locally_approved', 'prototype_visible', 'demo_only', 'unverified', 'hidden']
      )
    ),
  last_reviewed_at timestamptz,
  review_due_at timestamptz,
  notes text,
  attributes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(attributes) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (catalog_import_id, catalog_product_id)
    references public.ip_catalog_products(catalog_import_id, product_id)
    on delete restrict,
  check (
    (catalog_import_id is null and catalog_product_id is null)
    or (catalog_import_id is not null and catalog_product_id is not null)
  )
);

create index ip_hospital_items_org_role_idx
  on public.ip_hospital_items (organization_id, role_code, active);

create table public.ip_hospital_role_options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.ip_organizations(id) on delete cascade,
  site_id uuid references public.ip_sites(id) on delete cascade,
  role_code text not null,
  hospital_item_id uuid not null
    references public.ip_hospital_items(id) on delete cascade,
  preference_rank integer not null default 1 check (preference_rank > 0),
  substitution_class text not null check (
    substitution_class = any (
      array[
        'preferred',
        'acceptable',
        'shortage_substitute',
        'backup',
        'emergency_only',
        'no_substitute'
      ]
    )
  ),
  no_substitute boolean not null default false,
  rationale text,
  effective_from timestamptz,
  effective_to timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index ip_hospital_role_options_lookup_idx
  on public.ip_hospital_role_options
  (organization_id, site_id, role_code, active, preference_rank);

create table public.ip_recipe_versions (
  id text primary key,
  organization_id uuid
    references public.ip_organizations(id) on delete cascade,
  source_procedure_code text not null,
  name text not null,
  version text not null,
  governance_state text not null default 'draft'
    check (governance_state = any (array['draft', 'in_review', 'approved', 'retired'])),
  clinical_owner_id uuid references auth.users(id) on delete set null,
  operational_owner_id uuid references auth.users(id) on delete set null,
  effective_at timestamptz,
  review_due_at timestamptz,
  source_catalog_import_id text not null
    references public.ip_catalog_imports(id) on delete restrict,
  parent_version_id text references public.ip_recipe_versions(id) on delete set null,
  change_summary text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.ip_recipe_slots (
  id text primary key,
  recipe_version_id text not null
    references public.ip_recipe_versions(id) on delete cascade,
  source_slot_id text,
  role_code text not null,
  label text not null,
  generic_requirement text not null,
  requiredness text not null check (
    requiredness = any (
      array['required', 'conditional', 'optional', 'backup', 'emergency_only']
    )
  ),
  dependency_rule text,
  quantity_expression jsonb not null
    check (
      jsonb_typeof(quantity_expression) = 'object'
      and quantity_expression ->> 'op' = 'literal'
    ),
  selection_mode text not null
    check (selection_mode = any (array['single', 'multiple'])),
  setup_zone text not null check (
    setup_zone = any (
      array[
        'room_capital_equipment',
        'equipment_tower',
        'back_table',
        'mayo_stand',
        'sterile_field',
        'specimen_station',
        'emergency_cart',
        'other',
        'unassigned'
      ]
    )
  ),
  procedural_phase text not null check (
    procedural_phase = any (
      array[
        'pre_room',
        'pre_induction_or_sedation',
        'airway_access',
        'diagnostic',
        'therapeutic',
        'specimen_handling',
        'rescue_or_contingency',
        'post_procedure',
        'unassigned'
      ]
    )
  ),
  setup_sequence integer not null,
  open_hold_status text not null check (
    open_hold_status = any (
      array[
        'open_or_set_up_now',
        'have_in_room',
        'hold_unopened',
        'emergency_pull',
        'do_not_substitute'
      ]
    )
  ),
  responsible_role text,
  sterile_status text,
  allow_custom boolean not null default false,
  notes text
);

create table public.ip_modifiers (
  code text primary key,
  name text not null,
  group_code text not null check (
    group_code = any (
      array[
        'location',
        'anesthesia_airway',
        'imaging_navigation',
        'sampling',
        'therapeutic',
        'risk_rescue',
        'pleural'
      ]
    )
  ),
  description text not null,
  applies_to_json jsonb not null default '[]'::jsonb,
  release_state text not null
    check (release_state = any (array['mvp', 'phase_1_1', 'phase_2'])),
  active boolean not null default true
);

create table public.ip_modifier_actions (
  id text primary key,
  modifier_code text not null references public.ip_modifiers(code) on delete cascade,
  sequence integer not null,
  action_type text not null check (
    action_type = any (
      array[
        'add_slot',
        'remove_slot',
        'replace_role',
        'set_requiredness',
        'set_quantity',
        'set_setup_zone',
        'set_procedural_phase',
        'set_open_hold_status',
        'append_note',
        'require_room_capability',
        'add_rescue_module',
        'validate_compatibility',
        'raise_warning',
        'raise_blocking_error'
      ]
    )
  ),
  target_slot_id text,
  target_role_code text,
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object'),
  condition_json jsonb,
  unique (modifier_code, sequence)
);

create table public.ip_rescue_modules (
  code text primary key,
  name text not null,
  description text not null,
  active boolean not null default true
);

create table public.ip_rescue_module_items (
  id text primary key,
  rescue_module_code text not null
    references public.ip_rescue_modules(code) on delete cascade,
  sequence integer not null,
  role_code text not null,
  label text not null,
  requiredness text not null,
  quantity_expression jsonb not null,
  setup_zone text not null,
  procedural_phase text not null,
  open_hold_status text not null,
  notes text,
  unique (rescue_module_code, sequence)
);

create table public.ip_compatibility_rules (
  id text primary key,
  organization_id uuid
    references public.ip_organizations(id) on delete cascade,
  source_type text not null
    check (source_type = any (array['product', 'role', 'hospital_item', 'room_capability', 'modifier'])),
  source_id text not null,
  relation_type text not null,
  target_type text
    check (target_type is null or target_type = any (array['product', 'role', 'hospital_item', 'room_capability', 'modifier'])),
  target_id text,
  attribute text not null,
  operator text not null
    check (operator = any (array['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in', 'not_in', 'exists', 'requires'])),
  expected_value jsonb,
  unit text,
  severity text not null
    check (severity = any (array['info', 'warning', 'blocking'])),
  message text not null,
  missing_value_message text,
  evidence_source_id text,
  active boolean not null default true
);

create table public.ip_kits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.ip_organizations(id) on delete cascade,
  hospital_item_id uuid not null unique
    references public.ip_hospital_items(id) on delete cascade,
  name text not null,
  active boolean not null default true
);

create table public.ip_kit_components (
  id uuid primary key default gen_random_uuid(),
  kit_id uuid not null references public.ip_kits(id) on delete cascade,
  role_code text not null,
  inclusion text not null
    check (inclusion = any (array['included', 'optional', 'excluded'])),
  quantity integer not null default 1 check (quantity >= 0),
  unique (kit_id, role_code)
);

create table public.ip_user_preference_overlays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_version_id text not null
    references public.ip_recipe_versions(id) on delete cascade,
  slot_id text,
  role_code text,
  override_json jsonb not null
    check (jsonb_typeof(override_json) = 'object'),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (slot_id is not null or role_code is not null)
);

create table public.ip_case_cards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.ip_organizations(id) on delete restrict,
  site_id uuid not null references public.ip_sites(id) on delete restrict,
  location_id uuid not null
    references public.ip_procedure_locations(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  recipe_version_id text not null
    references public.ip_recipe_versions(id) on delete restrict,
  governance_state_snapshot text not null,
  readiness_state text not null
    check (readiness_state = any (array['blocked', 'complete_with_warnings', 'complete'])),
  selected_modifier_codes jsonb not null default '[]'::jsonb
    check (jsonb_typeof(selected_modifier_codes) = 'array'),
  input_variables jsonb not null default '{}'::jsonb
    check (jsonb_typeof(input_variables) = 'object'),
  engine_version text not null,
  catalog_import_id text not null
    references public.ip_catalog_imports(id) on delete restrict,
  snapshot_hash text not null check (snapshot_hash ~ '^[a-f0-9]{64}$'),
  snapshot_json jsonb not null check (jsonb_typeof(snapshot_json) = 'object'),
  generated_at timestamptz not null,
  supersedes_case_card_id uuid
    references public.ip_case_cards(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

create index ip_case_cards_org_generated_idx
  on public.ip_case_cards (organization_id, generated_at desc);

create table public.ip_case_card_modifiers (
  case_card_id uuid not null
    references public.ip_case_cards(id) on delete restrict,
  modifier_code text not null
    references public.ip_modifiers(code) on delete restrict,
  sequence integer not null,
  primary key (case_card_id, modifier_code)
);

create table public.ip_case_card_items (
  id uuid primary key default gen_random_uuid(),
  case_card_id uuid not null
    references public.ip_case_cards(id) on delete restrict,
  snapshot_item_id text not null,
  source_slot_id text,
  role_code text not null,
  label text not null,
  generic_requirement text not null,
  requiredness text not null,
  conditional_state text,
  conditional_set_by uuid references auth.users(id) on delete set null,
  quantity_display text not null,
  setup_zone text not null,
  procedural_phase text not null,
  setup_sequence integer not null,
  open_hold_status text not null,
  selected_hospital_item_id text,
  selected_catalog_product_id text,
  selected_item_snapshot jsonb,
  resolution_state text not null,
  verification_state_snapshot text not null,
  compatibility_state text not null,
  rationale text,
  rule_trace jsonb not null default '[]'::jsonb,
  unique (case_card_id, snapshot_item_id)
);

create table public.ip_case_card_warnings (
  id uuid primary key default gen_random_uuid(),
  case_card_id uuid not null
    references public.ip_case_cards(id) on delete restrict,
  snapshot_warning_id text not null,
  severity text not null
    check (severity = any (array['info', 'warning', 'blocking'])),
  code text not null,
  message text not null,
  source_type text not null,
  source_id text,
  acknowledged_by uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  waiver_reason text,
  unique (case_card_id, snapshot_warning_id)
);

create table public.ip_approval_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.ip_organizations(id) on delete restrict,
  case_card_id uuid references public.ip_case_cards(id) on delete restrict,
  recipe_version_id text references public.ip_recipe_versions(id) on delete restrict,
  event_type text not null,
  reason text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  check (case_card_id is not null or recipe_version_id is not null)
);

create function public.ip_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger ip_organizations_touch_updated_at
  before update on public.ip_organizations
  for each row execute function public.ip_touch_updated_at();
create trigger ip_organization_members_touch_updated_at
  before update on public.ip_organization_members
  for each row execute function public.ip_touch_updated_at();
create trigger ip_sites_touch_updated_at
  before update on public.ip_sites
  for each row execute function public.ip_touch_updated_at();
create trigger ip_locations_touch_updated_at
  before update on public.ip_procedure_locations
  for each row execute function public.ip_touch_updated_at();
create trigger ip_hospital_items_touch_updated_at
  before update on public.ip_hospital_items
  for each row execute function public.ip_touch_updated_at();
create trigger ip_hospital_role_options_touch_updated_at
  before update on public.ip_hospital_role_options
  for each row execute function public.ip_touch_updated_at();
create trigger ip_overlays_touch_updated_at
  before update on public.ip_user_preference_overlays
  for each row execute function public.ip_touch_updated_at();

create function public.ip_has_active_entitlement(target_entitlement text)
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
      and entitlement = target_entitlement
      and status = 'active'
      and (expires_at is null or expires_at > timezone('utc', now()))
  );
$$;

create function public.ip_is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.ip_organization_members
    where organization_id = target_organization_id
      and user_id = (select auth.uid())
      and active
  );
$$;

create function public.ip_can_build_org(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.ip_has_active_entitlement('site_admin')
    or (
      public.ip_is_org_member(target_organization_id)
      and (
        public.ip_has_active_entitlement('preference_cards_builder')
        or exists (
          select 1
          from public.ip_organization_members
          where organization_id = target_organization_id
            and user_id = (select auth.uid())
            and active
            and role = any (array['builder', 'admin', 'content_owner'])
        )
      )
    );
$$;

create function public.ip_can_admin_org(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.ip_has_active_entitlement('site_admin')
    or exists (
      select 1
      from public.ip_organization_members
      where organization_id = target_organization_id
        and user_id = (select auth.uid())
        and active
        and role = any (array['admin', 'content_owner'])
    );
$$;

create function public.ip_prevent_snapshot_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Generated IP preference-card snapshots are immutable';
end;
$$;

create trigger ip_case_cards_immutable
  before update or delete on public.ip_case_cards
  for each row execute function public.ip_prevent_snapshot_mutation();
create trigger ip_case_card_modifiers_immutable
  before update or delete on public.ip_case_card_modifiers
  for each row execute function public.ip_prevent_snapshot_mutation();
create trigger ip_case_card_items_immutable
  before update or delete on public.ip_case_card_items
  for each row execute function public.ip_prevent_snapshot_mutation();
create trigger ip_case_card_warnings_immutable
  before update or delete on public.ip_case_card_warnings
  for each row execute function public.ip_prevent_snapshot_mutation();

create function public.ip_create_case_card_snapshot(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_card_id uuid := gen_random_uuid();
  organization_uuid uuid := (payload ->> 'organization_id')::uuid;
  creator_uuid uuid := (select auth.uid());
  item jsonb;
  warning jsonb;
  modifier_code text;
  modifier_sequence integer := 0;
begin
  if creator_uuid is null or not public.ip_can_build_org(organization_uuid) then
    raise exception 'Preference-card builder access is required';
  end if;
  if payload ->> 'created_by' is distinct from creator_uuid::text then
    raise exception 'Snapshot creator does not match the authenticated user';
  end if;
  if payload ->> 'snapshot_hash' !~ '^[a-f0-9]{64}$' then
    raise exception 'Snapshot hash is invalid';
  end if;
  if jsonb_typeof(payload -> 'snapshot') is distinct from 'object' then
    raise exception 'Snapshot JSON is required';
  end if;
  if not exists (
    select 1 from public.ip_sites
    where id = (payload ->> 'site_id')::uuid
      and organization_id = organization_uuid
      and active
  ) then
    raise exception 'Snapshot site does not belong to the selected organization';
  end if;
  if not exists (
    select 1 from public.ip_procedure_locations
    where id = (payload ->> 'location_id')::uuid
      and site_id = (payload ->> 'site_id')::uuid
      and organization_id = organization_uuid
      and active
  ) then
    raise exception 'Snapshot location does not belong to the selected site';
  end if;
  if not exists (
    select 1 from public.ip_recipe_versions
    where id = payload ->> 'recipe_version_id'
      and (
        organization_id is null
        or organization_id = organization_uuid
      )
  ) then
    raise exception 'Snapshot recipe is unavailable for the selected organization';
  end if;

  insert into public.ip_case_cards (
    id,
    organization_id,
    site_id,
    location_id,
    created_by,
    recipe_version_id,
    governance_state_snapshot,
    readiness_state,
    selected_modifier_codes,
    input_variables,
    engine_version,
    catalog_import_id,
    snapshot_hash,
    snapshot_json,
    generated_at
  )
  values (
    new_card_id,
    organization_uuid,
    (payload ->> 'site_id')::uuid,
    (payload ->> 'location_id')::uuid,
    creator_uuid,
    payload ->> 'recipe_version_id',
    payload ->> 'governance_state_snapshot',
    payload ->> 'readiness_state',
    coalesce(payload -> 'selected_modifier_codes', '[]'::jsonb),
    coalesce(payload -> 'input_variables', '{}'::jsonb),
    payload ->> 'engine_version',
    payload ->> 'catalog_import_id',
    payload ->> 'snapshot_hash',
    payload -> 'snapshot',
    (payload ->> 'generated_at')::timestamptz
  );

  for modifier_code in
    select jsonb_array_elements_text(
      coalesce(payload -> 'selected_modifier_codes', '[]'::jsonb)
    )
  loop
    modifier_sequence := modifier_sequence + 1;
    insert into public.ip_case_card_modifiers (
      case_card_id,
      modifier_code,
      sequence
    ) values (new_card_id, modifier_code, modifier_sequence);
  end loop;

  for item in
    select value from jsonb_array_elements(coalesce(payload -> 'items', '[]'::jsonb))
  loop
    insert into public.ip_case_card_items (
      case_card_id,
      snapshot_item_id,
      source_slot_id,
      role_code,
      label,
      generic_requirement,
      requiredness,
      conditional_state,
      conditional_set_by,
      quantity_display,
      setup_zone,
      procedural_phase,
      setup_sequence,
      open_hold_status,
      selected_hospital_item_id,
      selected_catalog_product_id,
      selected_item_snapshot,
      resolution_state,
      verification_state_snapshot,
      compatibility_state,
      rationale,
      rule_trace
    ) values (
      new_card_id,
      item ->> 'id',
      item ->> 'sourceSlotId',
      item ->> 'roleCode',
      item ->> 'label',
      item ->> 'genericRequirement',
      item ->> 'requiredness',
      item ->> 'conditionalState',
      case
        when coalesce(payload -> 'conditional_states', '{}'::jsonb)
          ? (item ->> 'id')
        then creator_uuid
        else null
      end,
      item ->> 'quantityDisplay',
      item ->> 'setupZone',
      item ->> 'proceduralPhase',
      (item ->> 'setupSequence')::integer,
      item ->> 'openHoldStatus',
      item ->> 'selectedHospitalItemId',
      item ->> 'selectedCatalogProductId',
      item -> 'selectedItemSnapshot',
      item ->> 'resolutionState',
      item ->> 'verificationState',
      item ->> 'compatibilityState',
      item ->> 'rationale',
      coalesce(
        (
          select jsonb_agg(trace_event)
          from jsonb_array_elements(payload -> 'snapshot' -> 'ruleTrace') trace_event
          where trace_event ->> 'slotId' = item ->> 'id'
        ),
        '[]'::jsonb
      )
    );
  end loop;

  for warning in
    select value from jsonb_array_elements(coalesce(payload -> 'warnings', '[]'::jsonb))
  loop
    insert into public.ip_case_card_warnings (
      case_card_id,
      snapshot_warning_id,
      severity,
      code,
      message,
      source_type,
      source_id,
      acknowledged_by,
      acknowledged_at,
      waiver_reason
    ) values (
      new_card_id,
      warning ->> 'id',
      warning ->> 'severity',
      warning ->> 'code',
      warning ->> 'message',
      warning ->> 'sourceType',
      warning ->> 'sourceId',
      case
        when coalesce((warning ->> 'acknowledged')::boolean, false)
        then creator_uuid
        else null
      end,
      case
        when coalesce((warning ->> 'acknowledged')::boolean, false)
        then timezone('utc', now())
        else null
      end,
      warning ->> 'waiverReason'
    );
  end loop;

  return new_card_id;
end;
$$;

create function public.ip_save_hospital_mapping(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  organization_uuid uuid := (payload ->> 'organization_id')::uuid;
  site_uuid uuid := (payload ->> 'site_id')::uuid;
  location_uuid uuid := (payload ->> 'location_id')::uuid;
  item_uuid uuid := gen_random_uuid();
  catalog_id text := nullif(payload ->> 'catalog_import_id', '');
  catalog_product_key text := nullif(payload ->> 'catalog_product_id', '');
begin
  if (select auth.uid()) is null
    or not public.ip_can_admin_org(organization_uuid)
  then
    raise exception 'Preference-card content-owner access is required';
  end if;
  if length(trim(coalesce(payload ->> 'role_code', ''))) = 0
    or length(trim(coalesce(payload ->> 'local_description', ''))) = 0
  then
    raise exception 'Role and local description are required';
  end if;
  if not exists (
    select 1 from public.ip_sites
    where id = site_uuid and organization_id = organization_uuid and active
  ) then
    raise exception 'The selected site is unavailable';
  end if;
  if not exists (
    select 1 from public.ip_procedure_locations
    where id = location_uuid
      and site_id = site_uuid
      and organization_id = organization_uuid
      and active
  ) then
    raise exception 'The selected procedure location is unavailable';
  end if;
  if (catalog_id is null) is distinct from (catalog_product_key is null) then
    raise exception 'Catalog import and product identifiers must be supplied together';
  end if;
  if catalog_product_key is not null and not exists (
    select 1 from public.ip_catalog_products catalog_product
    where catalog_product.catalog_import_id = catalog_id
      and catalog_product.product_id = catalog_product_key
  ) then
    raise exception 'The selected catalog product is unavailable';
  end if;

  insert into public.ip_hospital_items (
    id,
    organization_id,
    site_id,
    location_id,
    item_type,
    catalog_import_id,
    catalog_product_id,
    role_code,
    local_item_number,
    local_description,
    local_uom,
    storage_location,
    active,
    verification_state,
    notes
  ) values (
    item_uuid,
    organization_uuid,
    site_uuid,
    location_uuid,
    payload ->> 'item_type',
    catalog_id,
    catalog_product_key,
    payload ->> 'role_code',
    nullif(payload ->> 'local_item_number', ''),
    payload ->> 'local_description',
    nullif(payload ->> 'local_uom', ''),
    nullif(payload ->> 'storage_location', ''),
    true,
    payload ->> 'verification_state',
    nullif(payload ->> 'notes', '')
  );

  insert into public.ip_hospital_role_options (
    organization_id,
    site_id,
    role_code,
    hospital_item_id,
    preference_rank,
    substitution_class,
    no_substitute,
    rationale,
    active
  ) values (
    organization_uuid,
    site_uuid,
    payload ->> 'role_code',
    item_uuid,
    coalesce((payload ->> 'preference_rank')::integer, 1),
    payload ->> 'substitution_class',
    payload ->> 'substitution_class' = 'no_substitute',
    nullif(payload ->> 'rationale', ''),
    true
  );

  return item_uuid;
end;
$$;

revoke all on function public.ip_has_active_entitlement(text)
  from public, anon, authenticated;
revoke all on function public.ip_is_org_member(uuid)
  from public, anon, authenticated;
revoke all on function public.ip_can_build_org(uuid)
  from public, anon, authenticated;
revoke all on function public.ip_can_admin_org(uuid)
  from public, anon, authenticated;
revoke all on function public.ip_create_case_card_snapshot(jsonb)
  from public, anon, authenticated;
revoke all on function public.ip_save_hospital_mapping(jsonb)
  from public, anon, authenticated;
grant execute on function public.ip_has_active_entitlement(text) to authenticated;
grant execute on function public.ip_is_org_member(uuid) to authenticated;
grant execute on function public.ip_can_build_org(uuid) to authenticated;
grant execute on function public.ip_can_admin_org(uuid) to authenticated;
grant execute on function public.ip_create_case_card_snapshot(jsonb) to authenticated;
grant execute on function public.ip_save_hospital_mapping(jsonb) to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'ip_catalog_imports',
    'ip_catalog_manufacturers',
    'ip_catalog_sources',
    'ip_catalog_products',
    'ip_catalog_product_sources',
    'ip_catalog_roles',
    'ip_catalog_product_roles',
    'ip_catalog_procedures',
    'ip_catalog_procedure_slots',
    'ip_catalog_slot_product_options',
    'ip_catalog_compatibility_raw',
    'ip_catalog_verification_backlog',
    'ip_organizations',
    'ip_organization_members',
    'ip_sites',
    'ip_procedure_locations',
    'ip_hospital_items',
    'ip_hospital_role_options',
    'ip_recipe_versions',
    'ip_recipe_slots',
    'ip_modifiers',
    'ip_modifier_actions',
    'ip_rescue_modules',
    'ip_rescue_module_items',
    'ip_compatibility_rules',
    'ip_kits',
    'ip_kit_components',
    'ip_user_preference_overlays',
    'ip_case_cards',
    'ip_case_card_modifiers',
    'ip_case_card_items',
    'ip_case_card_warnings',
    'ip_approval_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'revoke all on table public.%I from public, anon, authenticated',
      table_name
    );
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;
end;
$$;

-- Read-only imported catalog data.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'ip_catalog_imports',
    'ip_catalog_manufacturers',
    'ip_catalog_sources',
    'ip_catalog_products',
    'ip_catalog_product_sources',
    'ip_catalog_roles',
    'ip_catalog_product_roles',
    'ip_catalog_procedures',
    'ip_catalog_procedure_slots',
    'ip_catalog_slot_product_options',
    'ip_catalog_compatibility_raw',
    'ip_catalog_verification_backlog'
  ]
  loop
    execute format('grant select on table public.%I to authenticated', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      table_name || '_select_authenticated',
      table_name
    );
  end loop;
end;
$$;

grant select on public.ip_organizations,
  public.ip_organization_members,
  public.ip_sites,
  public.ip_procedure_locations,
  public.ip_hospital_items,
  public.ip_hospital_role_options,
  public.ip_recipe_versions,
  public.ip_recipe_slots,
  public.ip_modifiers,
  public.ip_modifier_actions,
  public.ip_rescue_modules,
  public.ip_rescue_module_items,
  public.ip_compatibility_rules,
  public.ip_kits,
  public.ip_kit_components,
  public.ip_user_preference_overlays,
  public.ip_case_cards,
  public.ip_case_card_modifiers,
  public.ip_case_card_items,
  public.ip_case_card_warnings,
  public.ip_approval_events
to authenticated;

grant insert, update on public.ip_hospital_items,
  public.ip_hospital_role_options,
  public.ip_recipe_versions,
  public.ip_recipe_slots,
  public.ip_modifiers,
  public.ip_modifier_actions,
  public.ip_rescue_modules,
  public.ip_rescue_module_items,
  public.ip_compatibility_rules,
  public.ip_kits,
  public.ip_kit_components
to authenticated;
grant insert, update, delete on public.ip_user_preference_overlays to authenticated;
grant insert on public.ip_case_cards,
  public.ip_case_card_modifiers,
  public.ip_case_card_items,
  public.ip_case_card_warnings,
  public.ip_approval_events
to authenticated;

create policy ip_organizations_select_member
  on public.ip_organizations for select to authenticated
  using (public.ip_is_org_member(id) or public.ip_has_active_entitlement('site_admin'));
create policy ip_members_select_member
  on public.ip_organization_members for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.ip_can_admin_org(organization_id)
  );
create policy ip_sites_select_member
  on public.ip_sites for select to authenticated
  using (public.ip_is_org_member(organization_id) or public.ip_has_active_entitlement('site_admin'));
create policy ip_locations_select_member
  on public.ip_procedure_locations for select to authenticated
  using (public.ip_is_org_member(organization_id) or public.ip_has_active_entitlement('site_admin'));

create policy ip_hospital_items_select_member
  on public.ip_hospital_items for select to authenticated
  using (public.ip_is_org_member(organization_id) or public.ip_has_active_entitlement('site_admin'));
create policy ip_hospital_items_insert_admin
  on public.ip_hospital_items for insert to authenticated
  with check (public.ip_can_admin_org(organization_id));
create policy ip_hospital_items_update_admin
  on public.ip_hospital_items for update to authenticated
  using (public.ip_can_admin_org(organization_id))
  with check (public.ip_can_admin_org(organization_id));

create policy ip_role_options_select_member
  on public.ip_hospital_role_options for select to authenticated
  using (public.ip_is_org_member(organization_id) or public.ip_has_active_entitlement('site_admin'));
create policy ip_role_options_insert_admin
  on public.ip_hospital_role_options for insert to authenticated
  with check (public.ip_can_admin_org(organization_id));
create policy ip_role_options_update_admin
  on public.ip_hospital_role_options for update to authenticated
  using (public.ip_can_admin_org(organization_id))
  with check (public.ip_can_admin_org(organization_id));

create policy ip_recipe_versions_select
  on public.ip_recipe_versions for select to authenticated
  using (
    organization_id is null
    or public.ip_is_org_member(organization_id)
    or public.ip_has_active_entitlement('site_admin')
  );
create policy ip_recipe_versions_admin_write
  on public.ip_recipe_versions for all to authenticated
  using (
    organization_id is not null and public.ip_can_admin_org(organization_id)
  )
  with check (
    organization_id is not null and public.ip_can_admin_org(organization_id)
  );
create policy ip_recipe_slots_select
  on public.ip_recipe_slots for select to authenticated
  using (
    exists (
      select 1 from public.ip_recipe_versions recipe
      where recipe.id = recipe_version_id
        and (
          recipe.organization_id is null
          or public.ip_is_org_member(recipe.organization_id)
          or public.ip_has_active_entitlement('site_admin')
        )
    )
  );
create policy ip_recipe_slots_admin_write
  on public.ip_recipe_slots for all to authenticated
  using (
    exists (
      select 1 from public.ip_recipe_versions recipe
      where recipe.id = recipe_version_id
        and recipe.organization_id is not null
        and public.ip_can_admin_org(recipe.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.ip_recipe_versions recipe
      where recipe.id = recipe_version_id
        and recipe.organization_id is not null
        and public.ip_can_admin_org(recipe.organization_id)
    )
  );

create policy ip_global_modifiers_select
  on public.ip_modifiers for select to authenticated using (true);
create policy ip_global_modifier_actions_select
  on public.ip_modifier_actions for select to authenticated using (true);
create policy ip_global_rescue_modules_select
  on public.ip_rescue_modules for select to authenticated using (true);
create policy ip_global_rescue_items_select
  on public.ip_rescue_module_items for select to authenticated using (true);
create policy ip_global_modifiers_admin
  on public.ip_modifiers for all to authenticated
  using (public.ip_has_active_entitlement('site_admin'))
  with check (public.ip_has_active_entitlement('site_admin'));
create policy ip_global_modifier_actions_admin
  on public.ip_modifier_actions for all to authenticated
  using (public.ip_has_active_entitlement('site_admin'))
  with check (public.ip_has_active_entitlement('site_admin'));
create policy ip_global_rescue_modules_admin
  on public.ip_rescue_modules for all to authenticated
  using (public.ip_has_active_entitlement('site_admin'))
  with check (public.ip_has_active_entitlement('site_admin'));
create policy ip_global_rescue_items_admin
  on public.ip_rescue_module_items for all to authenticated
  using (public.ip_has_active_entitlement('site_admin'))
  with check (public.ip_has_active_entitlement('site_admin'));

create policy ip_compatibility_rules_select
  on public.ip_compatibility_rules for select to authenticated
  using (
    organization_id is null
    or public.ip_is_org_member(organization_id)
    or public.ip_has_active_entitlement('site_admin')
  );
create policy ip_compatibility_rules_admin
  on public.ip_compatibility_rules for all to authenticated
  using (
    (organization_id is null and public.ip_has_active_entitlement('site_admin'))
    or (organization_id is not null and public.ip_can_admin_org(organization_id))
  )
  with check (
    (organization_id is null and public.ip_has_active_entitlement('site_admin'))
    or (organization_id is not null and public.ip_can_admin_org(organization_id))
  );

create policy ip_kits_select_member
  on public.ip_kits for select to authenticated
  using (public.ip_is_org_member(organization_id) or public.ip_has_active_entitlement('site_admin'));
create policy ip_kits_admin
  on public.ip_kits for all to authenticated
  using (public.ip_can_admin_org(organization_id))
  with check (public.ip_can_admin_org(organization_id));
create policy ip_kit_components_select_member
  on public.ip_kit_components for select to authenticated
  using (
    exists (
      select 1 from public.ip_kits kit
      where kit.id = kit_id
        and (
          public.ip_is_org_member(kit.organization_id)
          or public.ip_has_active_entitlement('site_admin')
        )
    )
  );
create policy ip_kit_components_admin
  on public.ip_kit_components for all to authenticated
  using (
    exists (
      select 1 from public.ip_kits kit
      where kit.id = kit_id and public.ip_can_admin_org(kit.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.ip_kits kit
      where kit.id = kit_id and public.ip_can_admin_org(kit.organization_id)
    )
  );

create policy ip_overlays_owner
  on public.ip_user_preference_overlays for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.ip_recipe_versions recipe
      where recipe.id = recipe_version_id
        and recipe.organization_id is not null
        and public.ip_can_build_org(recipe.organization_id)
    )
  );

create policy ip_case_cards_select_member
  on public.ip_case_cards for select to authenticated
  using (public.ip_is_org_member(organization_id) or public.ip_has_active_entitlement('site_admin'));
create policy ip_case_cards_insert_builder
  on public.ip_case_cards for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.ip_can_build_org(organization_id)
  );
create policy ip_case_card_modifiers_select
  on public.ip_case_card_modifiers for select to authenticated
  using (
    exists (
      select 1 from public.ip_case_cards card
      where card.id = case_card_id
        and (
          public.ip_is_org_member(card.organization_id)
          or public.ip_has_active_entitlement('site_admin')
        )
    )
  );
create policy ip_case_card_items_select
  on public.ip_case_card_items for select to authenticated
  using (
    exists (
      select 1 from public.ip_case_cards card
      where card.id = case_card_id
        and (
          public.ip_is_org_member(card.organization_id)
          or public.ip_has_active_entitlement('site_admin')
        )
    )
  );
create policy ip_case_card_warnings_select
  on public.ip_case_card_warnings for select to authenticated
  using (
    exists (
      select 1 from public.ip_case_cards card
      where card.id = case_card_id
        and (
          public.ip_is_org_member(card.organization_id)
          or public.ip_has_active_entitlement('site_admin')
        )
    )
  );
create policy ip_case_card_children_insert_builder
  on public.ip_case_card_modifiers for insert to authenticated
  with check (
    exists (
      select 1 from public.ip_case_cards card
      where card.id = case_card_id
        and card.created_by = (select auth.uid())
        and public.ip_can_build_org(card.organization_id)
    )
  );
create policy ip_case_card_items_insert_builder
  on public.ip_case_card_items for insert to authenticated
  with check (
    exists (
      select 1 from public.ip_case_cards card
      where card.id = case_card_id
        and card.created_by = (select auth.uid())
        and public.ip_can_build_org(card.organization_id)
    )
  );
create policy ip_case_card_warnings_insert_builder
  on public.ip_case_card_warnings for insert to authenticated
  with check (
    exists (
      select 1 from public.ip_case_cards card
      where card.id = case_card_id
        and card.created_by = (select auth.uid())
        and public.ip_can_build_org(card.organization_id)
    )
  );

create policy ip_approval_events_select_member
  on public.ip_approval_events for select to authenticated
  using (public.ip_is_org_member(organization_id) or public.ip_has_active_entitlement('site_admin'));
create policy ip_approval_events_insert_admin
  on public.ip_approval_events for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.ip_can_admin_org(organization_id)
    and length(trim(reason)) > 0
  );

comment on table public.ip_case_cards is
  'Immutable, patient-free preference-card snapshots. Generate a superseding row rather than updating.';
comment on column public.ip_catalog_verification_backlog.suggested_primary_di is
  'QA candidate only. Never copied automatically into canonical product identifiers.';
comment on table public.ip_catalog_compatibility_raw is
  'Raw evidence; free-text source and target labels are not enforced foreign keys.';
