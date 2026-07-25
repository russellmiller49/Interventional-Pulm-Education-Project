-- Interventional Pulmonology Procedure-Card Catalog (PostgreSQL / Supabase starter schema)
create extension if not exists pgcrypto;

create table manufacturers (
  manufacturer_id text primary key,
  name text not null,
  default_distributor text,
  website text,
  notes text
);

create table sources (
  source_id text primary key,
  title text not null,
  filename text,
  source_type text not null,
  publisher text,
  revision_date text,
  as_of_date date,
  reliability_tier text,
  use_policy text,
  notes text
);

create table products (
  product_id text primary key,
  manufacturer_id text references manufacturers(manufacturer_id),
  product_name text not null,
  brand_family text,
  catalog_number text not null,
  global_part_number text,
  reference_part_number text,
  alternate_ids text,
  gtin text,
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
  gauge text,
  working_length_cm numeric,
  min_working_channel_mm numeric,
  delivery_system_od_mm numeric,
  package_uom text,
  adult_peds text,
  description text,
  compatibility_text text,
  verification_status text not null,
  live_dropdown_status text not null,
  source_as_of date,
  availability_note text,
  notes text,
  spec jsonb not null default '{}'::jsonb,
  unique(manufacturer_id, catalog_number)
);

create table product_sources (
  product_id text references products(product_id) on delete cascade,
  source_id text references sources(source_id),
  source_location text,
  claim_type text,
  verification_status text,
  notes text,
  primary key(product_id, source_id, source_location)
);

create table roles (
  role_code text primary key,
  category text not null,
  role_name text not null,
  description text,
  selection_guidance text,
  requires_current_ifu boolean not null default true
);

create table product_roles (
  product_id text references products(product_id) on delete cascade,
  role_code text references roles(role_code),
  role_fit text,
  notes text,
  primary key(product_id, role_code)
);

create table procedures (
  procedure_code text primary key,
  procedure_name text not null,
  template_version text not null,
  scope text,
  status text,
  clinical_owner text,
  notes text
);

create table procedure_slots (
  slot_id text primary key,
  procedure_code text references procedures(procedure_code) on delete cascade,
  section text,
  display_order integer not null,
  role_code text references roles(role_code),
  slot_label text not null,
  generic_requirement text,
  requiredness text,
  default_qty numeric,
  selection_mode text,
  allow_custom boolean not null default true,
  dependency_rule text,
  notes text
);

create table compatibility_rules (
  rule_id text primary key,
  source_product_or_role text not null,
  relationship text not null,
  target_product_or_role text not null,
  rule_text text not null,
  verification_status text,
  source_id text references sources(source_id)
);

create table hospitals (
  hospital_id uuid primary key default gen_random_uuid(),
  name text not null,
  organization text,
  active boolean not null default true
);

create table hospital_formulary (
  hospital_id uuid references hospitals(hospital_id) on delete cascade,
  product_id text references products(product_id),
  stocked boolean not null default false,
  preferred boolean not null default false,
  local_item_number text,
  par_level numeric,
  storage_location text,
  substitution_notes text,
  last_verified_at timestamptz,
  primary key(hospital_id, product_id)
);

create table case_cards (
  case_card_id uuid primary key default gen_random_uuid(),
  hospital_id uuid references hospitals(hospital_id),
  procedure_code text references procedures(procedure_code),
  name text not null,
  version integer not null default 1,
  status text not null default 'draft',
  owner_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table case_card_items (
  case_card_item_id uuid primary key default gen_random_uuid(),
  case_card_id uuid references case_cards(case_card_id) on delete cascade,
  slot_id text references procedure_slots(slot_id),
  product_id text references products(product_id),
  quantity numeric not null default 1,
  local_notes text,
  custom_item_text text,
  sort_order integer
);

create table verification_events (
  verification_event_id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  verification_status text not null,
  verifier text,
  verified_at timestamptz not null default now(),
  expires_at timestamptz,
  evidence_source_id text references sources(source_id),
  evidence_location text,
  notes text
);
