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
3. **Recipes and rules** — separately governed recipe versions, reviewed setup-zone/phase assignments, typed modifiers/actions, rescue modules, typed compatibility rules, and kit/BOM components. A recipe version is a _composition_: it names the exact recipe-module versions it is assembled from rather than owning a flat slot list. See [`recipe-composition.md`](./recipe-composition.md).
4. **User differences** — sparse preference overlays only; complete recipes are not cloned.
5. **Generated output** — a case-card header plus denormalized modifiers, items, warnings, trace, and complete JSON snapshot.

All imported recipes remain `draft`. A catalog visibility state, manufacturer source, or GUDID match never creates local approval. Production eligibility requires an explicit hospital-local mapping and current governance review. A composed card is never represented as stronger than its weakest component: one draft module keeps the whole card draft, and a retired module blocks it.

## Recipe modules (v0.3)

A procedure composition is a versioned manifest of **recipe modules**, not a recipe that
inherits from a parent:

- **core module** — requirements shared by more than one procedure (Flexible Bronchoscopy
  Core, Therapeutic Bronchoscopy Core, Pleural Procedure Core);
- **procedure-specific module** — what one procedure needs beyond its cores;
- **optional module** — a selectable workflow such as Procedural Fluoroscopy.

Each reference carries a selection behaviour — `required` (locked), `default_on` (starts
selected, removable), `optional` (starts unselected) — and the builder stores the exact
`selectedModuleVersionIds` it used. Every requirement carries a reviewed `requirementKey`,
and imported slot ids a shared requirement absorbed are kept as `sourceSlotAliases` so
modifier targeting and audit trails survive the move. The complete rules, including why
composition was chosen over inheritance and what happens when two modules disagree, are in
[`recipe-composition.md`](./recipe-composition.md).

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

## Equipment sets (v0.2)

An equipment set is a user-defined tray — "Rigid set 1", "Pleuroscopy cart" — described once
and reused on any card. Sets are built from catalog products on `/preference-cards/sets`.

A set is expressed as a `procedure_kit` hospital item whose `kitComponents` list every role
it covers, so the existing kit-suppression pass in `domain/kit-suppression.ts` does the work:
choosing the set on one requirement resolves that requirement and suppresses the others the
set already contains. No new resolution rules were added.

Two kinds of coverage:

- **Member products** — a product in the set contributes its own role.
- **`additionalCoveredRoles`** — a requirement the set satisfies without a distinct product.

The second exists because rigid bronchoscopy platforms differ. Karl Storz builds the scope
and head as one piece, so a Storz set covers `RIGID_BRONCHOSCOPE_HEAD` without a separate
head product, and the card stops asking for one. An Efer- or Novatech/Dumon-style platform
has a genuinely separate universal base, so a set covering only the barrel leaves the
head/base requirement standing. This is modelled per set rather than hardcoded per
manufacturer, because what matters is what is actually in _this_ hospital's tray.

A set is only as confirmed as its least-confirmed member: one unverified product makes the
whole set `unverified` on the card.

Sets are stored in browser localStorage under a versioned key
(`ip-preference-cards:equipment-sets:v1`) until per-user database persistence lands; the
stored shape is designed to lift into Postgres unchanged. As with individual catalog picks,
only product ids cross the wire on save and the server rebuilds each member from the
catalog.

## Product families and sizes (v0.2)

Several roles hold far more products than a person can scan: silicone straight stents alone
carry 105 entries that are really four Dumon product lines in many diameters and lengths.
Across the twelve most crowded roles, 1,042 products belong to 123 product lines.

The explorer therefore groups by **family** — manufacturer group + brand family (falling back
to subcategory) + product kind — and shows one row per line with the numeric spec _ranges_
across its variants, expanding to the individual catalog numbers. Families are derived from
data already in the catalog, so nothing has to be re-authored, and a re-import regroups
automatically. A "show all N individual products" link switches back to the flat
manufacturer-grouped table when someone wants to scan every SKU.

Expansion uses `<details>`, so the family view stays server-rendered with no client
JavaScript.

### Size chosen at time of procedure

Airway stents are sized once the stenosis is measured, so `domain/size-at-procedure.ts`
allows a card to reference a stent _family_ without committing to a size — "Dumon TD
silicone stent, size at time of procedure" — with the expectation that the family is
available in the room. The stent sizing device is excluded, since it is an instrument rather
than something sized to the lesion. Every other role requires a specific catalog number,
because the card's job is to be a pull list.
