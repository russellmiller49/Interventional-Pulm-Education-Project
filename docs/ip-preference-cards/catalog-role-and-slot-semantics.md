# Catalog roles, exact-slot options, and card readiness

## The four separate concepts

The preference-card module uses four relationships that must not be collapsed into one.

### 1. `Product_Roles`: broad catalog discovery

An exact `(product_id, role_code)` row means:

> This product has been classified under this broad clinical/equipment role and may be found
> in the role-scoped catalog browser.

It does not establish exact-slot eligibility, platform compatibility, adult/pediatric
appropriateness, package identity, current orderability, local availability, formulary
approval, or clinical suitability.

The catalog browser deliberately includes candidate and unverified products. Their
verification and known distribution states are displayed as badges rather than used to hide
them. A catalog product can be added to a card only for a role it actually carries. The server
checks the exact `Product_Roles` pair again during save, including equipment-set members, so a
tampered browser request cannot attach a real product to an arbitrary role.

### 2. `Slot_Product_Options`: curated exact-slot defaults

An exact `(slot_id, product_id)` row means:

> This product was specifically authored or reviewed as an option for this exact procedure
> slot.

The option role must equal the slot role, and the product must carry that same role in
`Product_Roles`. Canonical rows come from the workbook and remain authoritative. Their
`selectable` state continues to follow the authored `visible_by_default` flag constrained by
product visibility.

Role equality alone is not exact-slot review. It does not establish dimensional or
platform compatibility, package choice, local formulary approval, or clinical approval.

### 3. Custom items: per-user local requirements

Where a recipe has `allow_custom === true`, a user may add a bounded free-text local item or
resource that is not in the catalog. Custom items remain per-user inputs, are always presented
as unverified, and do not claim a manufacturer. This layer is not an organization/site
formulary and does not create a reusable institutional approval.

### 4. `ResolvedCard.readinessState`: post-resolution card state

Readiness is calculated only after an actual card has been resolved against its selected
items, modifiers, conditional states, compatibility rules, and warnings. Source-data coverage
does not set or predict `ResolvedCard.readinessState`.

## Review proposals for missing pairs

`scripts/ip-preference-cards/derive-slot-option-proposals.ts` computes:

```text
Procedure_Slots
  JOIN Product_Roles ON role_code
  JOIN Products ON product_id
  MINUS authored Slot_Product_Options
  MINUS validated explicit exceptions
```

It writes `generated/slot-product-option-proposals.json`. The artifact is deterministic and
currently records:

- 2,080 authored canonical options;
- 475 generated unreviewed proposals;
- 0 excluded proposal pairs;
- 0 stale exceptions; and
- 0 authored-row or proposal-generation errors.

Every proposal is:

- `proposal_origin: "product_role_join"`;
- `proposal_status: "unreviewed"`;
- `selectable: false`; and
- `visible_by_default: false`.

Proposal context includes the slot, procedure, role, product identity, manufacturer, catalog
number, `role_fit`, verification grade, visibility state, locally available exact distribution
evidence, reason code, warning text, and review source identifiers. Distribution context uses
reviewed GUDID metadata already stored on the canonical local product plus exact
manufacturer-and-catalog confirmation rows. It is populated only when all such local records
agree; conflicting records remain unset for review. This context does not imply compatibility,
current orderability, or clinical approval.

Proposals are never merged into canonical `slot-product-options.json`. An authored row takes
precedence automatically because it is subtracted before proposal generation.

## Narrow proposal exceptions

`seed/slot-option-exceptions.json` may suppress a known false-positive proposal. The file is
parsed with Zod. Every exception requires:

- an exact `product_id`;
- an exact `slot_id` or `role_code`;
- an optional exact `procedure_code`;
- a rationale category of `clinical`, `dimensional`, `kit`, or `compatibility`; and
- a substantive human-readable rationale.

Generation fails for unknown identifiers, duplicate or overlapping scopes, contradictory
slot/procedure/role fields, product-only global suppression, trivial rationales, and stale
exceptions. An exception matches proposals only; it cannot remove, hide, or change an authored
canonical option.

## The two coverage metrics

Both generators use the same pure helper in
`scripts/ip-preference-cards/coverage-metrics.ts`.

### Required catalog coverage

This is the percentage and count of required slots whose role has at least one existing
product in `Product_Roles`. Candidate and unverified products count because the role-scoped
browser exposes them with badges.

The UI labels the count:

```text
Catalog alternatives: N of M required lines
```

This is catalog-discovery coverage, not exact-slot eligibility or readiness.

### Required curated-default coverage

This is the percentage and count of required slots with at least one canonical
`Slot_Product_Options` row whose `selectable === true`.

The UI labels the count:

```text
Curated defaults: N of M required lines
```

Unreviewed proposal rows never count. A curated default is still not a compatibility,
formulary, or clinical approval decision.

The report may also count required lines with `allow_custom === true`, but that is descriptive
only and is not converted into an approval or readiness percentage.

## Identity enrichment is independent

GUDID and openFDA workflows support product-identity review. They do not add
`Product_Roles`, create `Slot_Product_Options`, accept proposal rows, change either coverage
metric, or change resolved-card readiness. Likewise, a product-role or exact-slot relationship
does not confirm a DI/GTIN, current distribution, package identity, or orderability.

## Deterministic validation

The normal sequence is:

```bash
npm run ip-cards:import
npm run ip-cards:coverage
npm run ip-cards:scenarios
npm run ip-cards:validate-data
npm run ip-cards:seed
```

Import regenerates canonical workbook output and the separate proposal artifact.
`ip-cards:validate-data` then checks authored foreign keys, uniqueness, slot-role agreement,
the matching `Product_Roles` relationship, visibility/selectability rules, exception validity,
proposal completeness, and byte-for-byte equality with a fresh deterministic proposal
regeneration.
