# AI Coding-Assistant Instructions

## Build IP Preference Card Builder v0.1 for interventionalpulm.com

**Prepared:** July 25, 2026  
**Primary source workbook:** `IP_Procedure_Equipment_Catalog_v0_5_with_GUDID_Verification_Backlog.xlsx`  
**Product blueprint:** `IP_Preference_Card_Builder_MVP_Blueprint.md`

---

# Copy/paste master prompt

You are a senior full-stack engineer working inside the existing **interventionalpulm.com** repository. Build the first functional version of the **IP Preference Card Builder** as a thin, end-to-end vertical slice.

The product is an **interventional-pulmonology equipment and room-setup configuration engine**. It is not a clinical decision-support system, order set, inventory system, or substitute for device IFUs, institutional policies, credentialing, or clinical judgment.

The core abstraction is:

```text
Clinical requirement
    → compatible commercial options
    → hospital-local item/resource selection
    → immutable generated preference-card snapshot
```

The first version must prove that a clinician can select a procedure and modifiers, the system can deterministically produce and resolve the required setup, and a technician can print a spatial or chronological card.

Do not redesign unrelated areas of the website. Do not create a second application, authentication system, design system, internationalization system, or database stack.

## Working behavior

1. Begin by inspecting the repository structure, `package.json`, route conventions, authentication, Supabase client/server helpers, database migrations, component library, testing setup, and localization implementation.
2. Use the repository's existing package manager and conventions.
3. Use the existing Next.js application, Supabase project, authentication, role/access-control pattern, Tailwind configuration, shadcn/ui components, and locale resolver.
4. Put all new UI strings into the existing translation-file structure, but provide English strings only for v0.1. Do not create a second i18n implementation.
5. Preserve existing server/client boundaries and access-control behavior.
6. Create a feature branch named:

```text
codex/ip-preference-card-builder-v0-1
```

7. Before implementation, create:

```text
docs/ip-preference-cards/implementation-plan.md
```

The plan should summarize the existing architecture, files to add or modify, migration strategy, import strategy, and any assumptions. Then proceed with implementation without waiting for approval unless a truly blocking ambiguity remains after inspecting the repository and supplied files.

---

# 1. Product boundary and safety rules

## Include in v0.1

- English UI within the site's existing locale-aware architecture.
- One organization with one or more sites and procedure locations.
- Existing authenticated users.
- Builder/Admin and Viewer/Print permissions, implemented through the site's existing role system.
- Deterministic recipe and modifier resolution.
- Generic-role-to-hospital-item mapping.
- Compatibility and readiness warnings.
- Reusable emergency-pull modules.
- Immutable generated-card snapshots.
- Spatial and chronological views.
- Print-optimized HTML using the browser's Print/Save as PDF function.
- A minimal read-only catalog verification view.
- No patient identifiers.

## Explicitly exclude from v0.1

- PHI or patient-specific fields.
- EMR integration.
- Live inventory or par-level synchronization.
- Cost analytics.
- Automated product substitution.
- AI/LLM selection of products or clinical equipment.
- Automatic product approval based on GUDID.
- Automatic parsing of all free-text compatibility statements into enforceable rules.
- A multi-institution recipe marketplace.
- A separate PDF microservice.
- Full verification of all 1,221 catalog products.
- Clinical recommendations, procedural indications, doses, device sizing recommendations, or treatment decisions.

## Required prototype warning

All imported procedure templates are currently draft and have no populated clinical owner. Until an approved recipe, approved local mapping, and current product verification exist, every generated output must display:

```text
DRAFT PROTOTYPE — NOT APPROVED FOR CLINICAL USE
```

Do not automatically mark any imported recipe or product as clinically approved.

AccessGUDID data is identity enrichment only. A GUDID match does not prove current orderability, compatibility, local availability, or clinical suitability.

---

# 2. Use the existing stack

Use the existing repository's implementation where available. The expected architecture is:

- Next.js App Router
- TypeScript with strict typing
- Tailwind CSS and shadcn/ui
- Supabase Postgres, Auth, and Row Level Security
- Zod for shared validation
- Server components for data loading where appropriate
- Client components only for interactive portions of the builder
- Server actions or existing API conventions for writes
- Deterministic TypeScript rules engine implemented as pure functions
- Existing test runner plus Playwright if already configured

Do not replace the current stack merely because another approach would be easier.

Add a feature flag using the repository's existing feature-flag convention. If no convention exists, add:

```text
NEXT_PUBLIC_ENABLE_PREFERENCE_CARDS
```

Enable it in development. Default it to disabled in production until explicitly configured.

---

# 3. Supplied data files

Use these source artifacts:

```text
IP_Procedure_Equipment_Catalog_v0_5_with_GUDID_Verification_Backlog.xlsx
IP_Preference_Card_Builder_MVP_Blueprint.md
```

Place or reference them in a clearly documented import location such as:

```text
data/ip-preference-cards/source/
```

Do not parse the Excel workbook in the browser or on every application request. Build a deterministic import/generation script that converts the workbook into normalized JSON or database seed data.

Suggested commands:

```text
npm run ip-cards:import
npm run ip-cards:validate-data
npm run ip-cards:seed
```

Use existing naming conventions if the repository has a different script pattern.

## Workbook structure

The workbook uses title and description rows. For the tabular sheets, the actual column headers are on Excel row 4 and data begins on row 5.

Import the following sheets for application use:

```text
Products
Product_Roles
Procedures
Procedure_Slots
Slot_Product_Options
Roles
Compatibility
Manufacturers
Sources
Product_Sources
Hospital_Formulary
Modifier_Catalog
Product_Verification_Backlog
```

Do not use summary/audit sheets as runtime source tables. They may be retained for human reference.

`GUDID_Candidate_Matches` is deliberately not imported in v0.1; the backlog sheet carries the fields the QA page needs.

The current workbook contains approximately:

```text
1,221 products
98 normalized roles
13 procedure templates
174 procedure slots
2,080 slot-product options
179 compatibility statements
```

The import script should report counts and warn when they differ substantially. Do not hard-fail solely because a later workbook version contains more rows.

## Preserve source identifiers

Preserve these workbook identifiers exactly:

```text
product_id
manufacturer_id
role_code
procedure_code
slot_id
source_id
rule_id
```

Do not generate replacement identifiers for imported records.

## Important source fields

### Products

Import at minimum:

```text
product_id
manufacturer_id
manufacturer
distributor
brand_family
product_name
catalog_number
alternate_ids
gtin
primary_category
subcategory
product_kind
reuse_status
sterile_status
implantable
material
coverage
placement_method
size_display
diameter_mm
length_mm
french_size
gauge
working_length_cm
min_working_channel_mm
delivery_system_od_mm
package_uom
adult_peds
description
compatibility_text
verification_status
live_dropdown_status
primary_source_id
primary_source_location
source_as_of
availability_note
notes
spec_json
global_part_number
reference_part_number
```

### Roles

```text
role_code
category
role_name
description
selection_guidance
requires_current_ifu
```

### Product_Roles

```text
product_id
role_code
role_fit
notes
```

### Procedures

```text
procedure_code
procedure_name
template_version
scope
status
clinical_owner
notes
```

### Procedure_Slots

```text
slot_id
procedure_code
section
display_order
role_code
slot_label
generic_requirement
requiredness
default_qty
selection_mode
allow_custom
dependency_rule
notes
```

### Slot_Product_Options

```text
slot_id
product_id
role_code
eligibility_status
visible_by_default
reason
```

### Compatibility

Import the current fields as raw evidence:

```text
rule_id
source_product_or_role
relationship
target_product_or_role
rule_text
verification_status
source_id
```

Do not pretend these free-text rows are all machine enforceable. Store them as raw compatibility evidence and create a separate typed rule table for the limited v0.1 rules.

### Hospital_Formulary

Treat this sheet as a staging template, not as an active formulary. It currently contains one row per catalog product and is largely unmapped.

Relevant fields:

```text
formulary_id
product_id
manufacturer
product_name
catalog_number
role_codes
verification_status
live_dropdown_status
hospital_carries
preferred
local_item_number
local_description
local_uom
storage_location
par_level
last_reviewed
local_notes
global_part_number
reference_part_number
```

### Product_Verification_Backlog

Import a read-only subset for the admin QA page:

```text
Priority
Workstream
Review Status
Product ID
Manufacturer
Product Name
Catalog Number
Existing GTIN Audit
Roles
Procedures
Required Slots
Conditional Slots
Optional Slots
Current Verification Status
Current Live Status
GUDID Result
Match Confidence
Suggested Primary DI
Distribution Status
Verification Remaining
Recommended Action
Decision
Evidence URL
Notes
```

Do not copy a suggested GUDID identifier into the canonical product record automatically.

## Identifier columns must be read as raw text

Spreadsheet readers infer types. `pandas.read_excel` without an explicit dtype turns the `gtin` column into float64 and silently rewrites `08714729986225` as `8714729986225.0`. The cells are stored as text in the workbook; the corruption is introduced by the reader.

Read the following columns as raw strings with **no type inference, no coercion, no rounding**:

```text
product_id            manufacturer_id       role_code             procedure_code
slot_id               source_id             rule_id               formulary_id
gtin                  catalog_number        alternate_ids         global_part_number
reference_part_number local_item_number     Primary DI            Suggested Primary DI
Existing GTIN         Workbook Catalog Number
```

Requirements:

- If using SheetJS, read with `{ raw: false, defval: null }` and cast cells with `String(v)`.
- If using a Python step, pass `dtype=str` to every identifier column.
- Assert that every non-null `gtin` matches `/^\d{14}$/` after zero-padding to 14. Report, do not auto-correct, values that do not. There are 80 non-null GTINs: 78 are 13-digit EAN needing a leading zero, 1 is 14-digit, and 1 is 16-digit and should be flagged, not truncated.
- Add a regression test asserting `PRD-…` → `gtin === "08714729986225"` round-trips exactly.
- Catalog numbers include leading-zero values such as `02841S`. Any numeric coercion is a defect, not a formatting preference.

`french_size` (15 rows) and `gauge` (12 rows) are stored as numeric cells and may be parsed as numbers.

## Import normalization

- Trim whitespace.
- Convert blank cells to `null`.
- Convert Yes/No fields to booleans while preserving the raw value if useful for audit.
- Parse numeric dimension fields as numbers when valid.
- Parse Excel dates correctly.
- Validate JSON in `spec_json`; preserve raw text and report malformed rows.
- Validate foreign-key relationships using the strict/free-text scope below.
- Create an import report containing counts, warnings, unmatched references, duplicate IDs, and workbook SHA-256.
- Make the import idempotent.
- Do not silently delete application records on import. A destructive replacement must require an explicit flag.

### Foreign-key validation scope

These columns are true foreign keys and currently resolve at 100%. Validate them strictly and fail the import on any break:

```text
Product_Roles.product_id           → Products.product_id
Product_Roles.role_code            → Roles.role_code
Procedure_Slots.procedure_code     → Procedures.procedure_code
Procedure_Slots.role_code          → Roles.role_code
Slot_Product_Options.slot_id       → Procedure_Slots.slot_id
Slot_Product_Options.product_id    → Products.product_id
Products.manufacturer_id           → Manufacturers.manufacturer_id
Products.primary_source_id         → Sources.source_id
Product_Sources.product_id         → Products.product_id
Product_Sources.source_id          → Sources.source_id
```

These columns are **free text and are not foreign keys**, despite their names:

```text
Compatibility.source_product_or_role
Compatibility.target_product_or_role
```

Measured resolution against canonical IDs:

| Column                   | resolves to role_code | resolves to product_id | unresolvable free text |
| ------------------------ | --------------------- | ---------------------- | ---------------------- |
| `source_product_or_role` | 11                    | 35                     | **133**                |
| `target_product_or_role` | 28                    | 0                      | **151**                |

The unresolvable values are manufacturer model and catalog strings such as `BF-UC190F`, `ERBE APC/VIO`, `MAJ-1351`, `ERBECRYO 2`, `Aspira IPC`, and `02BRT30294/295/296/299`. Applying strict FK validation to these columns produces roughly 284 spurious failures and will either hard-fail the import or bury real errors in noise.

Correct handling: store the raw string, plus nullable enrichment columns `resolved_source_type` / `resolved_source_id` / `resolved_target_type` / `resolved_target_id`, populated only on exact match. Report the resolution rate in the import report. Never infer a match from fuzzy string similarity.

### Controlled vocabulary normalization

The workbook's controlled vocabularies are dirtier than §7 and §4.3 assume. Ship a single `vocab-map.ts` mapping raw value → canonical enum, with a **fail-closed** default, and emit every unmapped raw value into the import report.

#### `Procedure_Slots.selection_mode` — two spellings, one concept

```text
"Single"         (98 rows) → single
"Single select"  (30 rows) → single
"Multiple"       (46 rows) → multiple
```

Any importer that maps these one-to-one produces a three-member enum or a Zod failure on 30 rows.

#### `Procedure_Slots.requiredness` — only three values exist in source

```text
"Required"    (80) → required
"Conditional" (57) → conditional
"Optional"    (37) → optional
```

`backup` and `emergency_only` appear nowhere in the workbook. They are v0.1-authored states produced only by modifier actions and rescue modules.

#### `Products.live_dropdown_status` — five values, not two

§7 defines behavior for two of these. The other three cover **577 products**.

```text
"Prototype visible - reverify before production"      (486) → prototype_visible
"Hidden - current U.S. status unverified"             (423) → hidden
"Hidden until verified"                               (158) → hidden
"Hidden - non-U.S. catalog / U.S. status unverified"  (126) → hidden
"Hidden - exact configuration table required"          (28) → hidden
<anything else / null>                                      → hidden
```

Default **must** be `hidden`. A product whose status string is unrecognized is not selectable.

#### `Products.verification_status` — 28 distinct free-text values

Do not enumerate these into an enum. Preserve raw, and derive a coarse canonical field:

```text
starts with "Verified"  → verified_source
starts with "Candidate" → candidate
else                    → unknown
```

`Compatibility.verification_status` has a further 24 distinct values; treat identically.

#### `Slot_Product_Options` visibility precedence

`visible_by_default` and product-level `live_dropdown_status` agree on 2,078 of 2,080 rows and disagree on 2. State the precedence explicitly: **product-level status always wins, and the restrictive value wins on conflict.** Log the conflicting rows in the import report.

#### `Modifier_Catalog` column naming

This is the only imported sheet using Title Case headers rather than snake_case. Its columns are:

```text
Modifier Code | Modifier Name | Applies To | Rule Action | Adds / Changes | Constraint or Localization | Release
```

`Release` holds `MVP` (25), `Phase 1.1` (4), `Phase 2` (1) and maps to `ip_modifiers.release_state`. There is **no group column** — the seven modifier groups in §10.2 must be authored in a reviewed seed file, not derived. `Rule Action` and `Adds / Changes` are prose; every `ip_modifier_actions` row is hand-authored.

All 10 modifier codes named in §8 were verified present: `ROSE`, `SPEC_MOLECULAR`, `RIGID_AIRWAY`, `APC`, `BALLOON_DILATION`, `STENT_PLACE`, `JET_VENT`, `FLUOROSCOPY`, `HIGH_BLEED_RISK`, `DIGITAL_DRAINAGE`.

### Pre-flight coverage report

`npm run ip-cards:coverage` must run after import and before any seeding, and must write `data/ip-preference-cards/generated/coverage-report.json` plus a human-readable summary.

For each of the three golden scenarios, for every slot, report:

- total product options,
- options that survive the visibility rules,
- whether the slot is `Required` with zero surviving options.

Current measured state:

| Procedure            | slots | required | slots with 0 selectable products |
| -------------------- | ----- | -------- | -------------------------------- |
| `EBUS_TBNA`          | 13    | 7        | 2                                |
| `CHEST_TUBE`         | 13    | 3        | 6                                |
| `THERAPEUTIC_BRONCH` | 22    | 3        | 8                                |
| `RIGID_BRONCH`       | 25    | 8        | 10                               |

Across the whole catalog, **45 of 98 roles have zero selectable product**: 7 `GENERIC_*` roles by design, plus 38 roles whose products exist but are all hidden.

The coverage report is a required input to the seed step, and the seed step must declare an explicit resolution for every required slot with zero selectable products.

Suggested generated files:

```text
data/ip-preference-cards/generated/catalog-products.json
data/ip-preference-cards/generated/roles.json
data/ip-preference-cards/generated/procedures.json
data/ip-preference-cards/generated/procedure-slots.json
data/ip-preference-cards/generated/slot-product-options.json
data/ip-preference-cards/generated/modifier-catalog.json
data/ip-preference-cards/generated/verification-backlog.json
data/ip-preference-cards/generated/import-report.json
```

Do not ship the entire product catalog to the client. Query or load only the products relevant to the current roles.

---

# 4. Data architecture

Keep imported catalog data logically separate from operational hospital data.

## 4.1 Imported catalog layer

Use read-mostly tables such as:

```text
ip_catalog_imports
ip_catalog_manufacturers
ip_catalog_sources
ip_catalog_products
ip_catalog_product_sources
ip_catalog_roles
ip_catalog_product_roles
ip_catalog_procedures
ip_catalog_procedure_slots
ip_catalog_slot_product_options
ip_catalog_compatibility_raw
ip_catalog_verification_backlog
```

Each imported row should include `catalog_import_id` or equivalent provenance.

## 4.2 Hospital-local layer

Create the following minimum entities:

```text
ip_organizations
ip_sites
ip_procedure_locations
ip_hospital_items
ip_hospital_role_options
```

For v0.1, store room/location capabilities as a validated `jsonb` array on `ip_procedure_locations`. Do not create a separate `ip_room_capabilities` table or admin rooms route until a second consumer exists.

### `ip_hospital_items`

A local item can resolve a global product, a generic local supply, a room resource, a tray, or a readiness requirement.

Minimum fields:

```text
id
organization_id
site_id nullable
location_id nullable
item_type
catalog_product_id nullable
role_code nullable
local_item_number nullable
local_description
local_uom nullable
storage_location nullable
par_level nullable
active
verification_state
last_reviewed_at nullable
review_due_at nullable
notes nullable
created_at
updated_at
```

Supported `item_type` values:

```text
commercial_product
hospital_local_disposable
capital_asset
reusable_instrument
instrument_tray
procedure_kit
medication_or_solution_prompt
room_resource
personnel_or_service
protocol_or_readiness_check
specimen_or_laboratory_requirement
```

### `ip_hospital_role_options`

Minimum fields:

```text
id
organization_id
site_id nullable
role_code
hospital_item_id
preference_rank
substitution_class
no_substitute
rationale nullable
effective_from nullable
effective_to nullable
active
```

Supported `substitution_class` values:

```text
preferred
acceptable
shortage_substitute
backup
emergency_only
no_substitute
```

## 4.3 Recipe and modifier layer

Create:

```text
ip_recipe_versions
ip_recipe_slots
ip_modifiers
ip_modifier_actions
ip_rescue_modules
ip_rescue_module_items
```

Imported procedure templates remain the source material. Operational recipe versions should reference their originating `procedure_code` and source version, but must be separately versioned and governed.

`Procedure_Slots` contains: `slot_id`, `procedure_code`, `section`, `display_order`, `role_code`, `slot_label`, `generic_requirement`, `requiredness`, `default_qty`, `selection_mode`, `allow_custom`, `dependency_rule`, and `notes`.

`setup_zone`, `procedural_phase`, `setup_sequence`, and `open_hold_status` have no source columns. The closest source field is `section`, which holds 38 free-text values that mix workflow categories and equipment classes. Author `data/ip-preference-cards/seed/section-zone-phase-map.json` as a reviewed artifact mapping each `section` value to a default `setup_zone` and `procedural_phase`; it is seed data, not importer logic.

Any `section` absent from the map, and any slot whose mapping is marked `needs_review`, resolves to `setup_zone = 'unassigned'` and `procedural_phase = 'unassigned'`. The spatial and chronological views must render a visible **"Unassigned — needs zone/phase review"** group rather than silently bucketing these into `other`. Its count appears on the dashboard alongside unresolved required roles.

`setup_sequence` derives from `display_order` within a zone. `open_hold_status` has no source; default every slot to `have_in_room` and set the other values only through modifier actions, rescue modules, or the reviewed seed file.

### `ip_recipe_versions`

Minimum fields:

```text
id
organization_id nullable
source_procedure_code
name
version
governance_state
clinical_owner_id nullable
operational_owner_id nullable
effective_at nullable
review_due_at nullable
source_catalog_import_id
parent_version_id nullable
change_summary nullable
created_at
```

Supported `governance_state` values:

```text
draft
in_review
approved
retired
```

Do not set imported recipes to `approved`.

### `ip_recipe_slots`

Minimum fields:

```text
id
recipe_version_id
source_slot_id nullable
role_code
label
generic_requirement
requiredness
quantity_expression
selection_mode
setup_zone
procedural_phase
setup_sequence
open_hold_status
responsible_role nullable
sterile_status nullable
allow_custom
notes nullable
```

Supported `requiredness` values:

```text
required
conditional
optional
backup
emergency_only
```

Supported `setup_zone` values:

```text
room_capital_equipment
equipment_tower
back_table
mayo_stand
sterile_field
specimen_station
emergency_cart
other
unassigned
```

Supported `procedural_phase` values:

```text
pre_room
pre_induction_or_sedation
airway_access
diagnostic
therapeutic
specimen_handling
rescue_or_contingency
post_procedure
unassigned
```

Supported `open_hold_status` values:

```text
open_or_set_up_now
have_in_room
hold_unopened
emergency_pull
do_not_substitute
```

### `ip_modifiers`

Minimum fields:

```text
id
code
name
group_code
description
applies_to_json
release_state
active
```

Modifier groups:

```text
location
anesthesia_airway
imaging_navigation
sampling
therapeutic
risk_rescue
pleural
```

`backup` and `emergency_only` requiredness values are v0.1-authored states produced only by modifier actions and rescue modules; they do not appear in the workbook source rows.

Modifier codes are namespaced `TECH_`, `ENV_`, `ANES_`, `SPEC_` or are otherwise verified non-colliding with `role_code`. Add an import-time assertion that the modifier and role code sets are disjoint.

### `ip_modifier_actions`

Use typed actions rather than unparsed instructions.

Minimum fields:

```text
id
modifier_id
sequence
action_type
target_slot_id nullable
target_role_code nullable
payload jsonb
condition_json jsonb nullable
```

Supported v0.1 action types:

```text
add_slot
remove_slot
replace_role
set_requiredness
set_quantity
set_setup_zone
set_procedural_phase
set_open_hold_status
append_note
require_room_capability
add_rescue_module
validate_compatibility
raise_warning
raise_blocking_error
```

## 4.4 Typed compatibility layer

Create a separate typed table:

```text
ip_compatibility_rules
```

Minimum fields:

```text
id
source_type
source_id
relation_type
target_type
target_id nullable
attribute
operator
expected_value jsonb
unit nullable
severity
message
evidence_source_id nullable
active
```

Supported `source_type` and `target_type` values:

```text
product
role
hospital_item
room_capability
modifier
```

Supported operators for v0.1:

```text
eq
neq
lt
lte
gt
gte
in
not_in
exists
requires
```

Supported severity:

```text
info
warning
blocking
```

Only manually curate the typed rules needed by the three golden scenarios. Preserve the other 179 workbook rules as raw evidence for future conversion.

## 4.5 Preference and generated-card layer

Create:

```text
ip_user_preference_overlays
ip_case_cards
ip_case_card_modifiers
ip_case_card_items
ip_case_card_warnings
ip_approval_events
```

### `ip_user_preference_overlays`

Store only differences from the hospital standard. Do not clone complete recipes.

Minimum fields:

```text
id
user_id
recipe_version_id
slot_id nullable
role_code nullable
override_json
active
created_at
updated_at
```

### `ip_case_cards`

Minimum fields:

```text
id
organization_id
site_id
location_id
created_by
recipe_version_id
governance_state_snapshot
readiness_state
selected_modifier_codes jsonb
input_variables jsonb
engine_version
catalog_import_id
snapshot_hash
generated_at
supersedes_case_card_id nullable
```

Supported `readiness_state` values:

```text
blocked
complete_with_warnings
complete
```

A generated card must be immutable. To change it, generate a new card that optionally references the prior card through `supersedes_case_card_id`.

### `ip_case_card_items`

Denormalize enough information to reproduce the printed card after source data changes.

Minimum fields:

```text
id
case_card_id
source_slot_id nullable
role_code
label
generic_requirement
requiredness
conditional_state nullable
conditional_set_by nullable
quantity_display
setup_zone
procedural_phase
setup_sequence
open_hold_status
selected_hospital_item_id nullable
selected_catalog_product_id nullable
selected_item_snapshot jsonb
resolution_state
verification_state_snapshot
compatibility_state
rationale nullable
rule_trace jsonb
```

Supported `resolution_state` values:

```text
resolved
generic_local
warning
blocking
waived
unresolved
```

### `ip_case_card_warnings`

Minimum fields:

```text
id
case_card_id
severity
code
message
source_type
source_id nullable
acknowledged_by nullable
acknowledged_at nullable
waiver_reason nullable
```

Only an authorized admin/content-owner role may waive a blocking requirement, and the reason must be stored.

---

# 5. Row-level security and access control

Use the site's existing authentication and authorization implementation. Do not introduce another auth provider.

At minimum:

- Authenticated viewers may view cards belonging to their organization and print them.
- Builders may create cards and save their own preference overlays.
- Admin/content-owner users may edit hospital mappings, typed modifier actions, rescue modules, and governance fields.
- Catalog imports and canonical global product records are not editable by ordinary users.
- All organization/site-specific data must be protected with RLS.
- The browser must never receive a Supabase service-role key.
- No patient name, MRN, DOB, encounter number, diagnosis, or procedure date tied to a patient should be stored.

Add migration and RLS tests consistent with the repository's existing approach.

---

# 6. Deterministic rules engine

Implement the rules engine as pure TypeScript functions in a domain folder such as:

```text
src/features/preference-cards/domain/
```

Suggested files:

```text
types.ts
schemas.ts
resolve-card.ts
apply-modifier-actions.ts
resolve-hospital-items.ts
evaluate-compatibility.ts
evaluate-readiness.ts
quantity-expression.ts
kit-suppression.ts
rule-trace.ts
```

Do not put core rule logic inside React components or SQL triggers.

## Input contract

```ts
type BuildCardInput = {
  organizationId: string
  siteId: string
  locationId: string
  recipeVersionId: string
  userId?: string
  modifierCodes: string[]
  variables: Record<string, string | number | boolean | null>
}
```

## Output contract

```ts
type ResolvedCard = {
  recipeVersionId: string
  selectedModifiers: string[]
  items: ResolvedCardItem[]
  warnings: RuleMessage[]
  readinessState: 'blocked' | 'complete_with_warnings' | 'complete'
  governanceState: 'draft' | 'in_review' | 'approved' | 'retired'
  ruleTrace: RuleTraceEvent[]
  engineVersion: string
}
```

## Required resolution order

Use a stable, documented order:

1. Load the selected recipe version and base slots.
2. Apply site/location defaults.
3. Apply modifier actions in explicit sequence order.
4. Detect mutually exclusive modifiers and action collisions.
5. Add reusable rescue modules.
6. Apply physician preference overlays.
7. Resolve each generic role to hospital-local options.
8. Apply kit/BOM duplicate suppression when supported.
9. Evaluate quantity expressions.
10. Evaluate room capabilities.
11. Evaluate typed compatibility rules.
12. Compute each item's resolution state.
13. Compute card readiness.
14. Produce a human-readable rule trace.
15. Persist an immutable snapshot.

The same inputs and source versions must produce the same output and snapshot hash.

## Conditional slot semantics

57 of 174 slots are `Conditional`, and 69 carry a free-text `dependency_rule` such as `Planned biopsy`, `Reusable bronchoscope selected`, `Mechanically ventilated patient`, or `BAL/wash planned`.

For v0.1:

- A `conditional` slot is included in the resolved card and rendered with its `dependency_rule` text shown verbatim as its condition.
- It carries a tri-state user control: `include` / `exclude` / `undecided`, defaulting to `undecided`.
- `undecided` and `exclude` never block readiness. `include` promotes the slot to `required` for readiness purposes.
- The chosen state and who set it is recorded in the rule trace and denormalized onto `ip_case_card_items`.
- Do not parse `dependency_rule` into machine conditions in v0.1, and do not use an LLM to do so.

## Unknown is not compatible

`min_working_channel_mm` is populated on 126 of 1,221 products and `delivery_system_od_mm` on 124. Any dimensional rule will frequently encounter a null operand.

`evaluate-compatibility` must return a three-valued result — `pass` / `fail` / `unknown` — and `unknown` must surface as a warning naming the missing field, never as a silent pass. Add a unit test: a rule whose operand is null yields `unknown` and a warning, and does not produce a `complete` readiness state without acknowledgment.

This is also the highest-value typed rule available for v0.1, and it is computable from structured numeric columns rather than parsed from prose: **device `delivery_system_od_mm` must be ≤ scope `min_working_channel_mm`.** Prefer it over hand-transcribing free-text compatibility rows.

## Conflict behavior

- Two mutually exclusive modifiers must produce a blocking message.
- If two actions try to replace the same slot with different roles, produce a blocking conflict rather than silently choosing one.
- A required slot without an approved local resolution is blocking.
- A warning does not block draft export but must be visible.
- A blocking conflict prevents a `complete` readiness state.
- A draft recipe can never produce a production-approved card.

## Explainability

Every item should have a “Why is this included?” explanation derived from its rule trace, such as:

```text
Included by base recipe EBUS-TBNA v0.3
Added by modifier ROSE
Resolved to local item CYT-004 at NMCSD Bronchoscopy Suite
```

Do not generate these explanations with an LLM.

---

# 7. Product visibility and verification behavior

Preserve the raw workbook fields, but normalize behavior as follows:

## Hidden products

A product with `live_dropdown_status` equivalent to `Hidden until verified`:

- must not appear in normal builder selection;
- may appear in the admin catalog QA view;
- cannot resolve a production card.

## Prototype-visible products

A product with a status equivalent to `Prototype visible - reverify before production`:

- may appear in the prototype/demo builder;
- must display a verification warning;
- cannot independently make a card production-ready.

## Local approval

Do not infer local approval from manufacturer literature or GUDID. Production eligibility requires an explicit local mapping/approval field in `ip_hospital_items` or `ip_hospital_role_options`.

## Identifier discrepancies

The workbook contains candidate identifier corrections. Keep these as QA records. Do not overwrite the canonical GTIN automatically.

---

# 8. Seed only three golden scenarios

Do not attempt to operationalize all procedures in the first pass. Implement these three scenarios completely.

## Scenario 1 — EBUS-TBNA with ROSE and molecular testing

Base source procedure:

```text
EBUS_TBNA
```

Selected modifiers:

```text
ROSE
SPEC_MOLECULAR
```

Expected behavior:

- Load the base EBUS slots in stable display order.
- Add local cytology/ROSE supplies and resources.
- Add molecular-testing specimen requirements.
- Display unresolved local specimen workflows clearly.
- Group items spatially and chronologically.
- Show product verification and evidence status.
- Permit draft preview/print with the prototype watermark.

## Scenario 2 — Central airway obstruction / complex therapeutic bronchoscopy

Use the closest existing imported source recipe and create a separate v0.1 operational recipe named:

```text
Central airway obstruction / tumor debulking
```

It may inherit from `THERAPEUTIC_BRONCH` and/or `RIGID_BRONCH`, but do not mutate the imported source procedure.

Selected modifiers:

```text
RIGID_AIRWAY
APC
BALLOON_DILATION
STENT_PLACE
JET_VENT
FLUOROSCOPY
HIGH_BLEED_RISK
```

Expected behavior:

- Add or replace the flexible-only airway setup with rigid bronchoscopy components.
- Add jet-ventilation equipment and manual-ventilation backup.
- Add APC platform, probe/applicator, gas, cable, and fire-risk readiness lines.
- Add balloon, inflation device, guidewire when required, and compatibility checks.
- Add stent, deployment/loading tools, measurement tools, and backup-size lines.
- Add C-arm, sterile drape, and radiation-safety resources.
- Append a reusable major-airway-bleeding rescue module.
- Mark rescue items `emergency_pull` or `hold_unopened` as appropriate.
- Produce a blocking warning when a typed APC platform/probe rule is intentionally made incompatible in the test fixture.
- Produce a warning when a backup stent size is not mapped.

Do not invent clinical sizing guidance. The demo may use generic variables and placeholder local options labeled as prototype data.

## Scenario 3 — Chest tube insertion

Base source procedure:

```text
CHEST_TUBE
```

Add mutually exclusive v0.1 technique options:

```text
TECH_CHEST_TUBE_SMALL_BORE
TECH_CHEST_TUBE_LARGE_BORE
```

`CHEST_TUBE_SMALL_BORE` and `CHEST_TUBE_LARGE_BORE` already exist as role codes in the `Roles` sheet. Do not reuse them as modifier codes. The large-bore branch currently has no selectable product and must use the demo stand-in mechanism in §9.

Add the modifier:

```text
DIGITAL_DRAINAGE
```

Expected behavior:

- Small-bore and large-bore choices alter the relevant role/kit rows.
- Selecting both choices creates a blocking conflict.
- Digital drainage replaces or supplements the conventional drainage-system line according to a typed action.
- Kit/BOM logic prevents duplicate pulls when the selected local kit includes a component already represented by another slot.
- Spatial and chronological outputs remain stable.

---

# 9. Demo hospital profile

Create a clearly labeled seed profile for development and automated tests:

```text
Organization: Demo IP Program
Site: Demo Hospital
Location: Bronchoscopy Suite 1
```

Do not present this as NMCSD production data.

Seed only enough hospital items and role options to exercise the three golden scenarios. Prefer actual prototype-visible catalog records where a reasonable role match exists and one is selectable. For local resources without a commercial SKU, create clearly labeled generic local items, for example:

```text
Demo wall suction setup
Demo radiation-safety bundle
Demo cytology/ROSE station
Demo specimen-labeling and transport bundle
Demo C-arm resource
```

The import and seed steps must never write to `live_dropdown_status` or `verification_status`. These fields are catalog state and are changed only by the verification workstream.

When a required role has no selectable product, resolve it with a clearly labeled generic local item in `ip_hospital_items` carrying `verification_state = 'demo_only'` and a `local_description` that names the role it stands in for, e.g. `Demo stand-in — flexible APC probe (no verified catalog product)`. These items resolve the line for layout purposes only, always carry the prototype watermark, and can never contribute to a production-ready readiness state.

The seed file must list every such stand-in explicitly with a one-line reason. A reviewer must be able to read that list and see exactly where the demo is standing in for unverified reality.

Known roles with no selectable product include:

```text
APC_PROBE_FLEX          11 products, 0 visible
APC_APPLICATOR_RIGID     8 products, 0 visible
APC_GAS_ACCESSORY       12 products, 0 visible
ENERGY_CABLE_ADAPTER    69 products, 0 visible
RIGID_TELESCOPE         11 products, 0 visible
RIGID_BIPOLAR_FORCEPS    4 products, 0 visible
ENDOSCOPY_LIGHT_CABLE    1 product,  0 visible
ENDOSCOPY_MONITOR        1 product,  0 visible
CHEST_TUBE_LARGE_BORE    5 products, 0 visible
```

All demo-only records must have an explicit `verification_state` such as:

```text
demo_only
```

A demo-only mapping may resolve a line for prototype visualization, but the output must remain a draft prototype and retain the watermark.

Do not automatically choose the first product alphabetically when multiple products exist. Seed explicit deterministic mappings in a reviewed seed file.

---

# 10. User interface

Use the site's existing visual language. Build accessible, responsive screens with proper labels, keyboard navigation, visible focus states, and status indicators that do not rely on color alone.

## Routes

Use the existing locale-aware route structure. The logical routes are:

```text
/preference-cards
/preference-cards/new
/preference-cards/[cardId]
/preference-cards/[cardId]/print
/admin/preference-cards/recipes
/admin/preference-cards/formulary
/admin/preference-cards/catalog-qa
```

Adapt the physical folder structure to the repository's current locale and route conventions.

## 10.1 Dashboard

`/preference-cards`

Show:

- Create new card button.
- Three golden-scenario launch cards.
- Recent generated draft cards for the user's organization.
- Counts for unresolved required roles.
- Counts for unassigned zone/phase items.
- Counts for blocking compatibility conflicts.
- Percentage of required roles mapped for each golden scenario.
- Prototype/draft warning banner.

Do not build elaborate analytics.

## 10.2 New-card wizard

`/preference-cards/new`

Use four steps:

### Step 1 — Select procedure

Show clinically meaningful cards, not a single long dropdown.

Each procedure card shows:

- procedure name;
- source recipe/version;
- governance state;
- clinical owner or `Owner not assigned`;
- percentage of required roles mapped locally.

### Step 2 — Configure modifiers

Group modifiers under:

```text
Location
Anesthesia and airway
Imaging and navigation
Sampling
Therapeutic
Risk and rescue
Pleural
```

Each selected modifier should expose a concise deterministic preview:

```text
Adds 4 requirements
Replaces 1 requirement
Adds 1 compatibility check
Adds major-airway-bleeding rescue module
```

### Step 3 — Resolve requirements

Display one row per resolved generic requirement.

Required columns or responsive equivalents:

```text
Requirement
Requiredness
Why included
Selected local item/resource
Manufacturer and catalog number when applicable
Local item number
Quantity
Setup zone
Phase
Open/hold status
Verification
Compatibility
Resolution state
```

Support:

- preferred local option;
- acceptable substitute;
- backup or emergency-only option;
- generic local resource;
- unresolved state;
- admin waiver with required reason;
- search within eligible local options.

Do not expose hidden/unverified catalog products in the normal selector.

### Step 4 — Review and generate

Show tabs:

```text
Spatial setup
Chronological workflow
Exceptions
Rule trace
```

The user must be able to generate an immutable draft snapshot even when warnings exist. Blocking errors must remain prominent and prevent a `complete` readiness state.

## 10.3 Generated card view

`/preference-cards/[cardId]`

Header:

```text
Organization
Site
Procedure location
Procedure/recipe
Selected modifiers
Recipe version
Catalog import version
Generated timestamp
Generated by
Governance state
Readiness state
Prototype watermark when applicable
```

### Spatial view order

```text
Room/capital equipment
Equipment tower
Back table
Mayo stand
Sterile field
Specimen station
Emergency cart/pull list
Other
Unassigned — needs zone/phase review
```

### Chronological view order

```text
Pre-room preparation
Before induction or sedation
Airway access
Diagnostic phase
Therapeutic phase
Specimen handling
Rescue/contingency
Post-procedure
Unassigned — needs zone/phase review
```

### Exceptions view

Show:

- unresolved required roles;
- hidden or unapproved product attempts;
- product-verification warnings;
- compatibility warnings;
- required room capability failures;
- waivers and reasons.

### Rule-trace view

Show the origin of every line and every modifier effect in human-readable form.

## 10.4 Print view

`/preference-cards/[cardId]/print`

Implement print-optimized HTML/CSS first.

Requirements:

- A4/US Letter-friendly CSS with sensible page breaks.
- No navigation chrome.
- Repeat the card title/version on subsequent pages where practical.
- Preserve checkboxes or blank completion marks for setup use.
- Make emergency-pull content visually distinct without relying only on color.
- Include the prototype watermark and all blocking warnings.
- Provide both spatial and chronological print modes.
- Use `window.print()` or the repository's existing print utility.

Do not add a server PDF dependency in v0.1 unless the repository already has one.

## 10.5 Minimal admin views

### Formulary mapping

`/admin/preference-cards/formulary`

Build a role-centric mapping screen for the three golden scenarios. The user can:

- filter by unresolved required roles;
- view eligible prototype-visible products;
- map a role to a local product or generic local resource;
- enter local item number, UOM, and storage location;
- set preferred/acceptable/backup/emergency-only semantics;
- view verification status;
- save through protected server actions.

### Catalog QA

`/admin/preference-cards/catalog-qa`

Read-only in v0.1. Provide filters for:

```text
Priority
Manufacturer
Workstream
Review Status
Procedure
Role
GUDID result
Distribution status
```

Show evidence links as external links. Do not allow this page to overwrite canonical product identifiers.

### Recipes

`/admin/preference-cards/recipes`

Show imported and operational recipes with:

- version;
- governance state;
- owner;
- review date;
- required-role mapping percentage;
- unresolved/blocking counts.

Editing the full recipe authoring interface can be deferred, but the three golden recipes and typed modifiers must be represented in seed data rather than hard-coded into React components.

---

# 11. Quantity and kit logic

## Quantity expressions

Support fixed integer quantities and a small, safe expression system. Do not use `eval`.

`default_qty` is `1` on 173 of 174 slots and `2` on one. Keep the `quantity_expression` jsonb column and the Zod schema so the shape is stable, but implement only literal quantities in v0.1. Move arithmetic operators and variable references to the post-v0.1 list.

For v0.1, support only:

```text
{"op":"literal","value":n}
```

Post-v0.1 expression examples may use:

```json
{
  "op": "add",
  "args": [
    { "op": "literal", "value": 1 },
    { "op": "variable", "name": "backup_count", "default": 0 }
  ]
}
```

Validate all expression JSON with Zod.

## Kit/BOM support

Create minimum tables or seed structures:

```text
ip_kits
ip_kit_components
```

Minimum behavior:

- A selected kit may satisfy another role.
- A component may be included by default, optional, or excluded.
- A kit may suppress a duplicate role line unless the recipe explicitly requests an extra quantity.
- The rule trace must explain why a line was suppressed or retained.

Implement one working chest-tube example to prove the behavior.

---

# 12. Reusable rescue module

Create a reusable rescue module:

```text
MAJOR_AIRWAY_BLEEDING
```

Use existing role codes where available. If a required generic role is absent, create a clearly documented local operational role rather than inventing a commercial SKU.

The module should include generic requirements for:

- second/high-capacity suction setup;
- large-channel therapeutic bronchoscope or appropriate backup scope;
- blocker/tamponade balloon capability;
- rigid bronchoscopy backup;
- ventilation/lung-isolation backup as locally mapped;
- clearly labeled emergency-only tools.

The `HIGH_BLEED_RISK` modifier must append this module. Items should default to `hold_unopened` or `emergency_pull`, not `open_or_set_up_now`, unless the local seed explicitly says otherwise.

This is an equipment-readiness module, not a clinical management protocol.

---

# 13. Testing requirements

Use the repository's existing test tooling. Add missing test dependencies only when necessary.

## 13.1 Import tests

Test:

- header row 4 is recognized;
- blank rows are skipped;
- imported IDs are preserved;
- duplicate IDs are reported;
- foreign-key references resolve;
- Yes/No values normalize correctly;
- dates and numeric fields parse correctly;
- malformed `spec_json` is reported without crashing the entire import;
- import is idempotent;
- import report and workbook hash are generated.
- a known 13-digit GTIN imports as a zero-padded 14-character string, not a float;
- a catalog number with a leading zero survives import unchanged;
- `Single` and `Single select` both normalize to `single`;
- an unrecognized `live_dropdown_status` value normalizes to `hidden`;
- unresolvable `Compatibility` source/target strings are stored raw and do not fail the import;
- the coverage report is generated and names every required slot with zero selectable products.

## 13.2 Rules-engine unit tests

At minimum:

1. Same input produces identical output and snapshot hash.
2. Adding `ROSE` adds the expected roles and trace entries.
3. Removing a modifier removes only its effects and restores the base recipe.
4. `HIGH_BLEED_RISK` appends the bleeding rescue module.
5. Emergency-module items are labeled hold/emergency, not open-now.
6. A required unresolved role blocks readiness.
7. A warning produces `complete_with_warnings`, not `blocked`.
8. A blocking compatibility rule produces `blocked`.
9. Mutually exclusive chest-tube choices block readiness.
10. Kit-component suppression removes only true duplicates.
11. A physician override changes only the targeted field.
12. A later hospital mapping does not mutate an existing saved snapshot.
13. A hidden product cannot be selected through normal builder actions.
14. A prototype-visible product carries a verification warning.
15. A draft recipe cannot produce a production-approved card.
16. A conditional slot in `undecided` state does not block readiness.
17. The same conditional slot set to `include` blocks when unresolved.
18. A dimensional compatibility rule with a null operand yields `unknown` plus a warning, not `pass`.
19. A slot whose `section` is unmapped renders in the `unassigned` group.

## 13.3 Golden scenario snapshot tests

Create stable fixtures for:

```text
EBUS-TBNA + ROSE + molecular testing
Central airway obstruction + full therapeutic modifier set
Chest tube small-bore + digital drainage
Chest tube large-bore + conventional drainage
```

Store expected resolved cards as reviewable fixtures. Snapshot only stable domain output; do not create brittle snapshots of entire HTML pages.

## 13.4 UI smoke tests

Use Playwright if available. Test:

- user opens the preference-card dashboard;
- user creates the EBUS scenario;
- selected modifiers visibly add requirements;
- user reaches Review and generates a snapshot;
- spatial and chronological tabs render;
- print route renders without application chrome;
- high-bleeding-risk scenario shows an emergency pull section;
- intentionally incompatible APC fixture shows a blocking warning;
- hidden product does not appear in normal selection;
- admin QA page can filter verification backlog rows.

## 13.5 Build quality

All of these must pass:

```text
lint
typecheck
unit tests
rules-engine tests
build
```

Run the repository's existing commands rather than inventing parallel ones.

---

# 14. Suggested code organization

Adapt to the repository's conventions, but keep domain logic separated from UI.

```text
src/
  features/
    preference-cards/
      domain/
        types.ts
        schemas.ts
        resolve-card.ts
        apply-modifier-actions.ts
        resolve-hospital-items.ts
        evaluate-compatibility.ts
        evaluate-readiness.ts
        quantity-expression.ts
        kit-suppression.ts
        rule-trace.ts
      data/
        queries.ts
        mutations.ts
        mappers.ts
      components/
        ProcedurePicker.tsx
        ModifierPanel.tsx
        RequirementTable.tsx
        RequirementRow.tsx
        LocalItemSelector.tsx
        ReadinessSummary.tsx
        WarningPanel.tsx
        SpatialCardView.tsx
        ChronologicalCardView.tsx
        RuleTraceView.tsx
        PrototypeBanner.tsx
      server/
        generate-case-card.ts
        save-hospital-mapping.ts
        save-user-override.ts
      index.ts
scripts/
  import-ip-preference-card-catalog.ts
  validate-ip-preference-card-data.ts
supabase/
  migrations/
  seed/
docs/
  ip-preference-cards/
    implementation-plan.md
    data-import.md
    domain-model.md
    rule-engine.md
    pilot-readiness.md
```

Do not create this exact structure when it conflicts with the repository's established organization. Preserve the separation of concerns.

---

# 15. Implementation sequence

Work in small, verifiable phases.

## Phase A — Reconnaissance and plan

- Inspect repo.
- Identify existing auth/RLS/i18n/design patterns.
- Create implementation plan.
- Add feature flag.

## Phase B — Import pipeline

- Implement workbook parser.
- Generate normalized files and import report.
- Run `npm run ip-cards:coverage` and generate the blocking pre-seed coverage report.
- Add validation tests.
- Document the import command.

## Phase C — Database and seed

- Add catalog, local mapping, recipe, modifier, compatibility, and snapshot migrations.
- Add RLS.
- Seed demo organization/site/location.
- Seed three operational golden recipes, modifiers, typed actions, rescue module, and a minimal local mapping set.

## Phase D — Rules engine

- Implement pure resolver.
- Add rule trace.
- Add readiness calculation.
- Add unit and golden-fixture tests.

## Phase E — Builder UI

- Dashboard.
- Four-step wizard.
- Requirement resolution table.
- Warnings and explainability.

## Phase F — Snapshot and print

- Persist immutable card.
- Spatial view.
- Chronological view.
- Exceptions and trace views.
- Print CSS.

## Phase G — Minimal admin

- Role-centric formulary mapping.
- Read-only catalog QA.
- Recipe status overview.

## Phase H — Verification

- Run lint/typecheck/tests/build.
- Run Playwright smoke tests if configured.
- Test feature flag.
- Confirm no PHI fields or service-role keys are exposed.
- Confirm existing site routes still work.

Suggested commit checkpoints:

```text
feat(ip-cards): add catalog import and normalized schema
feat(ip-cards): add deterministic recipe and modifier engine
feat(ip-cards): add builder workflow and local resolution
feat(ip-cards): add immutable card views and print layout
feat(ip-cards): add admin mapping and catalog QA views
test(ip-cards): add golden scenarios and smoke coverage
docs(ip-cards): add import, domain, and pilot documentation
```

---

# 16. Acceptance criteria

The implementation is complete only when all of the following are true.

## Data

- The workbook import runs from a documented command.
- Imported IDs and provenance are preserved.
- Import report and workbook hash are created.
- The application can query the catalog without loading the whole workbook in the browser.
- Hidden products are excluded from normal selection.
- GUDID candidates do not overwrite canonical identifiers.

## Builder

- A user can select each of the three golden scenarios.
- Modifier effects are deterministic, visible, reversible, and explained.
- Every required requirement has a resolution state.
- Local commercial products and generic local resources can both resolve roles.
- Unresolved required roles and blocking compatibility conflicts are prominent.
- High-bleeding-risk adds a reusable emergency-pull module.
- Chest-tube technique choices are mutually exclusive.
- At least one working kit/BOM duplicate-suppression example exists.

## Output

- Generated cards are immutable snapshots.
- Spatial and chronological layouts work.
- Unassigned zone/phase items are visible as an explicit group and counted, never silently absorbed into `other`.
- Emergency-only and hold-unopened lines are clearly separated.
- Print output includes recipe/site/version/modifiers/timestamp/readiness/warnings.
- Draft outputs carry the prototype watermark.
- A saved card is unchanged after source recipe or local mapping edits.

## Governance and security

- No imported recipe is automatically approved.
- No product is automatically production-approved because of GUDID.
- Organization/site data has RLS.
- Admin writes are permission-protected.
- No PHI fields exist.
- No service-role credentials reach the browser.
- No import or seed step writes to `live_dropdown_status` or `verification_status`.
- Every `demo_only` stand-in item is enumerated in a reviewed seed file with a stated reason.

## Quality

- TypeScript is strict and avoids `any` in domain logic.
- Zod validates external/imported data and rule payloads.
- Rules-engine logic is not embedded in React components.
- Tests cover the required cases.
- Lint, typecheck, tests, and production build pass.
- Existing site behavior is not broken.

---

# 17. Required completion report

At the end, provide a concise but specific implementation report containing:

1. Summary of what was built.
2. Branch and commit hashes.
3. Routes added.
4. Migrations added.
5. Import command and resulting row counts.
6. Golden scenarios implemented.
7. Rules and compatibility checks implemented.
8. Test commands and results.
9. Screenshots or route references for the dashboard, builder, generated card, print view, formulary mapping, and catalog QA page.
10. Known limitations.
11. Exact manual steps required to run locally.
12. Exact environment variables added.
13. Any assumptions that need clinical or operational review.
14. A prioritized next-step list limited to true post-v0.1 work.

Do not claim production readiness. State clearly that clinical owners, operational owners, local formulary verification, current IFU review, and institutional approval remain required before clinical use.

---

# 18. Final implementation principles

- Build the smallest end-to-end system that proves the architecture.
- Keep imported catalog data separate from local operational decisions.
- Treat generic roles as the stable clinical layer and manufacturer SKUs as replaceable implementations.
- Never infer approval from visibility, marketing literature, or GUDID.
- Preserve provenance and versioning.
- Make every modifier effect explainable.
- Keep the rule engine deterministic and testable.
- Prefer explicit warnings and unresolved states over fabricated certainty.
- Do not hide safety-relevant exceptions to make the demo appear complete.
- Do not expand scope until the three golden scenarios work end to end.
