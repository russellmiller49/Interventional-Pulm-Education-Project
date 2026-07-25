# IP preference-card domain model

The stable abstraction is:

```text
generic clinical requirement
  → eligible commercial options
  → approved hospital-local item or resource
  → immutable generated snapshot
```

Imported catalog data and local operational decisions remain separate.

## Layers

1. **Imported catalog** — versioned workbook provenance, manufacturers, sources, products, roles, procedure templates, raw slot options, raw compatibility evidence, and verification backlog.
2. **Hospital-local operations** — organization, membership, site, procedure location and capabilities, hospital items, and ranked role mappings.
3. **Recipes and rules** — separately governed recipe versions, reviewed setup-zone/phase assignments, typed modifiers/actions, rescue modules, typed compatibility rules, and kit/BOM components.
4. **User differences** — sparse preference overlays only; complete recipes are not cloned.
5. **Generated output** — a case-card header plus denormalized modifiers, items, warnings, trace, and complete JSON snapshot.

All imported recipes remain `draft`. A catalog visibility state, manufacturer source, or GUDID match never creates local approval. Production eligibility requires an explicit hospital-local mapping and current governance review.

## Access and immutability

The migration uses the existing Supabase Auth and `site_entitlements` model:

- authenticated organization members can view and print their organization’s snapshots;
- builders/content owners/site administrators can create snapshots;
- organization content owners or site administrators can edit mappings and governed rule data;
- catalog tables are read-only to ordinary authenticated users;
- generated card, modifier, item, and warning rows reject update and delete operations;
- changes produce a new card, optionally linked through `supersedes_case_card_id`.

The schema has no patient name, MRN, date of birth, encounter, diagnosis, or patient procedure-date field.

## Demo profile

The development fixture is explicitly:

```text
Demo IP Program
Demo Hospital
Bronchoscopy Suite 1
```

It contains prototype-visible catalog selections and enumerated `demo_only` local stand-ins. Those stand-ins support layout and workflow testing only and cannot make an output production-ready.
