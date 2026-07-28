-- Development-only seed for the IP Preference Card Builder v0.1.
-- This is prototype data and must never be presented as an approved formulary.

insert into public.ip_catalog_imports (
  id,
  workbook_sha256,
  workbook_filename,
  row_counts,
  import_report
) values (
  'fb25b24e4abb1a5225e76d0499f870f680c9cb07633491f1f63e63e2394b5abf',
  'fb25b24e4abb1a5225e76d0499f870f680c9cb07633491f1f63e63e2394b5abf',
  'IP_Procedure_Equipment_Catalog_v0_5_with_GUDID_Verification_Backlog.xlsx',
  '{
    "products": 1221,
    "roles": 98,
    "procedures": 13,
    "procedure_slots": 174,
    "slot_product_options": 2080,
    "compatibility_raw": 179
  }'::jsonb,
  '{"seed_scope":"provenance pointer only; run npm run ip-cards:import for normalized catalog rows"}'::jsonb
)
on conflict (id) do nothing;

insert into public.ip_organizations (id, name, active) values
  ('00000000-0000-4000-8000-000000000101', 'Demo IP Program', true)
on conflict (id) do nothing;

insert into public.ip_sites (id, organization_id, name, active) values
  (
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000101',
    'Demo Hospital',
    true
  )
on conflict (id) do nothing;

insert into public.ip_procedure_locations (
  id,
  organization_id,
  site_id,
  name,
  capabilities,
  active
) values (
  '00000000-0000-4000-8000-000000000103',
  '00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000102',
  'Bronchoscopy Suite 1',
  '["rigid_bronchoscopy","jet_ventilation","fluoroscopy"]'::jsonb,
  true
)
on conflict (id) do nothing;

insert into public.ip_recipe_versions (
  id,
  organization_id,
  source_procedure_code,
  name,
  version,
  governance_state,
  source_catalog_import_id,
  change_summary
) values
  (
    'recipe-ebus-tbna-v0-1',
    '00000000-0000-4000-8000-000000000101',
    'EBUS_TBNA',
    'EBUS-TBNA',
    '0.1',
    'draft',
    'fb25b24e4abb1a5225e76d0499f870f680c9cb07633491f1f63e63e2394b5abf',
    'Golden scenario prototype with ROSE and molecular-testing modifiers.'
  ),
  (
    'recipe-central-airway-obstruction-v0-1',
    '00000000-0000-4000-8000-000000000101',
    'THERAPEUTIC_BRONCH',
    'Central airway obstruction / tumor debulking',
    '0.1',
    'draft',
    'fb25b24e4abb1a5225e76d0499f870f680c9cb07633491f1f63e63e2394b5abf',
    'Golden scenario prototype; deliberately contains an incompatible APC test fixture.'
  ),
  (
    'recipe-chest-tube-v0-1',
    '00000000-0000-4000-8000-000000000101',
    'CHEST_TUBE',
    'Chest tube insertion',
    '0.1',
    'draft',
    'fb25b24e4abb1a5225e76d0499f870f680c9cb07633491f1f63e63e2394b5abf',
    'Golden scenario prototype with mutually exclusive technique branches and kit suppression.'
  )
on conflict (id) do nothing;

insert into public.ip_modifiers (
  code,
  name,
  group_code,
  description,
  applies_to_json,
  release_state,
  active
) values
  ('ROSE', 'Rapid onsite evaluation', 'sampling', 'Adds local cytology supplies and ROSE readiness.', '["EBUS_TBNA"]', 'mvp', true),
  ('SPEC_MOLECULAR', 'Molecular testing', 'sampling', 'Adds local molecular specimen and transport requirements.', '["EBUS_TBNA"]', 'mvp', true),
  ('RIGID_AIRWAY', 'Rigid airway setup', 'anesthesia_airway', 'Adds rigid bronchoscopy equipment requirements.', '["THERAPEUTIC_BRONCH"]', 'mvp', true),
  ('APC', 'Argon plasma coagulation', 'therapeutic', 'Adds APC platform, probe, gas, cable, and readiness lines.', '["THERAPEUTIC_BRONCH"]', 'mvp', true),
  ('BALLOON_DILATION', 'Balloon dilation', 'therapeutic', 'Adds balloon, inflation device, guidewire, and compatibility checks.', '["THERAPEUTIC_BRONCH"]', 'mvp', true),
  ('STENT_PLACE', 'Airway stent placement', 'therapeutic', 'Adds stent, deployment, measurement, and backup lines.', '["THERAPEUTIC_BRONCH"]', 'mvp', true),
  ('JET_VENT', 'Jet ventilation', 'anesthesia_airway', 'Adds jet ventilation and manual ventilation backup.', '["THERAPEUTIC_BRONCH"]', 'mvp', true),
  ('FLUOROSCOPY', 'Fluoroscopy', 'imaging_navigation', 'Adds C-arm and radiation-safety resources.', '["THERAPEUTIC_BRONCH"]', 'mvp', true),
  ('HIGH_BLEED_RISK', 'High bleeding risk', 'risk_rescue', 'Adds the reusable major-airway-bleeding equipment-readiness module.', '["THERAPEUTIC_BRONCH"]', 'mvp', true),
  ('TECH_CHEST_TUBE_SMALL_BORE', 'Small-bore Seldinger technique', 'pleural', 'Selects the small-bore kit branch.', '["CHEST_TUBE"]', 'mvp', true),
  ('TECH_CHEST_TUBE_LARGE_BORE', 'Large-bore technique', 'pleural', 'Selects the explicit large-bore demo stand-in branch.', '["CHEST_TUBE"]', 'mvp', true),
  ('DIGITAL_DRAINAGE', 'Digital pleural drainage', 'pleural', 'Replaces the conventional drainage-system line.', '["CHEST_TUBE"]', 'phase_1_1', true)
on conflict (code) do nothing;

insert into public.ip_rescue_modules (code, name, description, active) values (
  'MAJOR_AIRWAY_BLEEDING',
  'Major airway bleeding equipment-readiness pull',
  'Reusable equipment-readiness module only; not a clinical management protocol.',
  true
)
on conflict (code) do nothing;

insert into public.ip_hospital_items (
  id,
  organization_id,
  site_id,
  location_id,
  item_type,
  role_code,
  local_item_number,
  local_description,
  storage_location,
  verification_state,
  notes
) values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000103',
    'room_resource',
    'GENERIC_SUCTION',
    'DEMO-SUCT-001',
    'Demo wall suction setup',
    'Procedure room wall',
    'demo_only',
    'Hospital-local room resource placeholder.'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000103',
    'personnel_or_service',
    'LOCAL_ROSE_STATION',
    'DEMO-ROSE-001',
    'Demo cytology/ROSE station and personnel readiness',
    'Specimen station',
    'demo_only',
    'Local cytology service workflow was not supplied.'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000103',
    'room_resource',
    'LOCAL_C_ARM',
    'DEMO-CARM-001',
    'Demo C-arm resource',
    'Imaging staging area',
    'demo_only',
    'Hospital-local fluoroscopy resource placeholder.'
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000103',
    'protocol_or_readiness_check',
    'LOCAL_RADIATION_SAFETY',
    'DEMO-RAD-001',
    'Demo radiation-safety bundle',
    'Imaging staging area',
    'demo_only',
    'Local radiation-safety workflow was not supplied.'
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000103',
    'specimen_or_laboratory_requirement',
    'GENERIC_SPECIMEN',
    'DEMO-SPEC-001',
    'Demo specimen-labeling and transport bundle',
    'Specimen station',
    'demo_only',
    'Hospital-local specimen workflow placeholder.'
  )
on conflict (id) do nothing;

-- The complete 31-item reviewed demo stand-in list, golden recipe slots,
-- typed modifier actions, compatibility fixtures, and kit/BOM fixture live in
-- src/features/preference-cards/seed/operational.ts and
-- data/ip-preference-cards/seed/demo-stand-ins.json. Run:
--   npm run ip-cards:seed
-- before using this profile.
