# External catalog review remediation plan

## Evidence and decision boundary

This milestone converts two external workbooks into governed repository data. The workbooks
remain read-only evidence and are not copied into Git.

| Evidence                                                           | SHA-256                                                            | Interpretation                                                                                                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `IP_Full_Catalog_Clinical_Use_Review_1.xlsx`                       | `a6ca5702e4fd173490760239e8ebe5ae39bc5a78b0151641d0b783ec7ea21388` | Complete current-state reference. The 1,566 product-role and 2,080 current-slot reviewer decision rows are blank.                            |
| `IP_Full_Catalog_Clinical_Use_Review_2.xlsx`                       | `ec21731456d34011c8434ebb7252d26584fd620eef48d63f958c41402a3a9180` | Recommendations only: 23 findings, 563 product-level corrections, 10 structural findings, six role recommendations, and a proposed taxonomy. |
| External remediation task                                          | `0b7967b40e56243e183c323a231bc7356dc4d8adbb17ab69f6686930a381edd8` | Milestone scope, required decisions, and stop conditions.                                                                                    |
| `IP_External_Review_Focused_Remediation_2026-07-30_completed.xlsx` | `78b112baa0cd84f213eef0c1f014c438e811ac7bafe3e5004c7b4e51dd119b4e` | Completed focused review: 97 valid decisions, including 20 approvals with modification and four rejections.                                  |

The versioned ledger is
`data/ip-preference-cards/reviewed/external-review-remediation.json`. It contains exactly
`F-01` through `F-23`, `S-01` through `S-10`, and `R-01` through `R-06`. Its disposition
counts are:

| Disposition                | Count |
| -------------------------- | ----: |
| `accept_now`               |    15 |
| `accept_with_modification` |    14 |
| `needs_source_enrichment`  |     4 |
| `needs_clinician_review`   |     2 |
| `defer`                    |     4 |

No workbook row applies itself. Changes enter canonical generated artifacts only through the
reviewed correction overlay, the normalized decision artifact, the guarded completed-review
implementation, and the deterministic import pipeline.

The completed workbook is normalized in
`data/ip-preference-cards/reviewed/external-review-remediation-decisions.json`. It contains
all 63 product-role and 34 exact-slot decisions, no patient-like data or local paths, and a
SHA-256 binding to both the returned workbook and the original proposal corrections. Six
plain approvals have blank rationale cells; they are preserved as audit warnings rather than
silently backfilled. Every modification and rejection has a rationale.

## Additive governance model

External distribution evidence is not catalog lifecycle.

```ts
type CatalogLifecycleContext =
  | 'current_market'
  | 'legacy_active_installed_base'
  | 'historical_reference'
  | 'unknown'

type SlottingScope =
  | 'standard'
  | 'installed_base'
  | 'catalog_only'
  | 'hospital_local'
  | 'not_applicable'
```

The concepts have separate responsibilities:

- **Distribution evidence** records the exact current GUDID confirmation rows. Mixed strong
  matches produce `conflicting`; they are not collapsed to an in- or out-of-distribution
  family conclusion.
- **Catalog lifecycle context** explains why a clinically relevant record remains represented.
  It is never inferred from distribution status.
- **Slotting scope** distinguishes standard, installed-base, catalog-only, hospital-local, and
  not-applicable behavior. An absent canonical option is not automatically a generation defect.
- **Visibility** controls discovery and default UI exposure.
- **Verification** records evidence quality and review state.
- **Local orderability** remains a hospital and time-specific determination; this catalog does
  not infer it from GUDID.

Precedence is additive and fail-closed:

1. Preserve workbook identifiers and provenance.
2. Apply product overrides and catalog additions.
3. Validate and apply the versioned external-review correction overlay.
4. Validate the normalized completed-workbook decisions and apply the separately versioned
   completed-review implementation.
5. Enforce product-visibility boundaries on exact-slot defaults and selectability.
6. Generate nonselectable proposals from the resulting reviewed roles and slots.

The overlay must match its expected old role or slot before changing it. A mismatch is a hard
import error rather than a silent partial migration.

## Slotting concepts

- **Role discovery** makes a product searchable through a clinically meaningful broad role.
- **Curated exact-slot option** is an explicitly reviewed relationship, not a role join.
- **Unreviewed proposal** is a nonselectable candidate for clinician review.
- **Installed-base alternative** is selectable for programs that own the product but is not a
  preferred default or new-purchase recommendation.
- **Catalog-only product** remains searchable without an implied procedure pull-list mapping.
- **Hospital-local/custom requirement** resolves through the existing custom-item workflow
  instead of a fictitious commercial SKU.

Broad role equality alone never creates a canonical exact-slot option. Distribution evidence
alone never removes a product or makes it hidden.

## Olympus 180-series installed-base policy

The following products use lifecycle `legacy_active_installed_base`, slotting scope
`installed_base`, and `preferredNewPurchase: false`:

- `PRD-88E003F12B` — BF-1T180
- `PRD-815B93A920` — BF-1TQ180
- `PRD-57DAB5ECAE` — BF-P180
- `PRD-7240BD99DA` — BF-Q180
- `PRD-FB075DFB2D` — BF-Q180-AC
- `PRD-F586C51621` — BF-UC180F

They remain eligible as nondefault installed-base exact-slot alternatives. BF-P180 is now
primary under `FLEX_SCOPE_THIN` and compatible under `FLEX_SCOPE_DIAGNOSTIC`, preserving its
separately approved diagnostic installed-base option. The other models retain their reviewed
diagnostic, therapeutic, or EBUS roles. UI copy is:

> Legacy / active installed base
>
> This model remains relevant to programs that own and use it. Verify current new-purchase
> availability, service support, and accessory availability locally.

This does not rewrite their GUDID distribution evidence or verification dates.

## Reviewed role migrations

### TBNA

The deprecated broad `TBNA_NEEDLE` meaning is replaced by:

- `TBNA_NEEDLE_CONVENTIONAL` for the eight reviewed flexible conventional products.
- `NAV_TBNA_NEEDLE` for the six reviewed superDimension, Arcpoint, and PeriView FLEX
  navigation/EWC products.
- `ROBOTIC_BIOPSY_NEEDLE` for Monarch and the three Ion Flexision products.
- `RIGID_BRONCH_ASPIRATION_BIOPSY_NEEDLE` for Karl Storz 10436 and 10438.
- `RIGID_BRONCH_PUNCTURE_NEEDLE` for Karl Storz 10435A.

`SLOT-9363E589C4` becomes flexible-conventional-only. The three rigid needles are removed
from it, and navigation, robotic, and rigid product-role mappings do not automatically create
canonical exact-slot choices. Karl Storz 10435A carries reviewed product relationships to
guide 10329A, telescope 10320AA, and Universal Bronchoscopes 10318B-D.

### Peripheral navigation and robotics

The deprecated broad `GUIDING_DEVICE` meaning is replaced by:

- `ROBOTIC_BRONCH_PLATFORM`
- `ROBOTIC_BRONCHOSCOPE`
- `ROBOTIC_PROCEDURE_KIT`
- `ROBOTIC_CATHETER`
- `NAV_CATHETER_GUIDE`
- `NAV_ACCESSORY_SENSOR`
- `ENB_PROCEDURE_KIT`
- `NAV_BRONCHOSCOPE_ADAPTER`
- `NAV_PLATFORM_ACCESSORY`

The mapping covers all 34 former `GUIDING_DEVICE` products using product semantics rather than
keyword inference. `SLOT-09EF760638` becomes a catheter/guide slot and cannot contain a capital
robot, bronchoscope, patient sensor, procedure kit, adapter, or platform accessory. Other child
roles remain reviewable rather than being bulk-promoted by role equality.

The completed review moves the Ion Fully Articulating Catheter from the generic navigation
guide role to `ROBOTIC_CATHETER`, removes its generic guide-slot option, and binds it to the
Ion Endoluminal System with a product-to-product compatibility rule.

### Targeted corrections

- `PRD-FDAC925AF1` Scivita Bracket moves from `GENERIC_AIRWAY_ADAPTER`, through the original
  proposal state, to `ENDOSCOPY_PROCESSOR_MOUNT_ACCESSORY`; its ordinary airway-adapter
  exact-slot options remain removed and it is linked to the Scivita HDVS-S300D processor.
- `PRD-58DE7D49C4` Hot Biopsy Forceps moves from `BIOPSY_FORCEPS_FLEX` to
  `BIOPSY_FORCEPS_ENERGY_ENABLED`; ordinary cold-forceps options are removed, and the energy
  platform dependency remains reviewable compatibility evidence.
- `DRESSING_SECUREMENT` replaces `GENERIC_SPECIMEN` on
  `SLOT-01010CB364`, `SLOT-126F71E1BD`, `SLOT-23A6DA3B89`, and
  `SLOT-4BE1D79D6C`.

## Visibility and ViziShot

`PRD-0D6E4DB711` remains hidden and in the product-verification workflow. The importer evaluates
product visibility, authored default visibility, and authored selectability independently:

- a hidden product is always nondefault and nonselectable;
- a visible product may be selectable without being a default;
- a default can only remain enabled when the option is also selectable.

The external suggestion to promote both ViziShot rows to Yes/Yes is not accepted without
separate product-verification evidence.

## Generic roles and proposals

The pre-remediation queue contained 475 unreviewed proposals. Deterministic regeneration after
the reviewed role splits contained 447. The completed review promoted exactly the selected
six-product by three-slot drainage subset, leaving 429 proposals. All remaining proposals are
unreviewed, nonselectable, and not visible by default.

The `GENERIC_DRAINAGE_UNIT` cohort now contains 18 reviewed canonical options across six
products and three slots plus 45 unreviewed proposals across the other 15 products. Every
reviewed drainage option is selectable but not visible by default; no brand or model preference
is implied, and stocking remains hospital-local. The infant/pediatric product retains its
population metadata. PPE, suction, specimen support, WLL supplies, dressings, and comparable
local resources retain hospital-local/custom resolution where no governed commercial product
relationship exists.

## Focused clinician review

The focused workbook contains only the bounded remediation surface:

- 63 unique product-role rows: six Olympus 180 scopes, all 21 former `TBNA_NEEDLE`
  products, all 34 former `GUIDING_DEVICE` products, Scivita Bracket, and Hot Biopsy Forceps;
- 34 exact-slot rows: ten Olympus installed-base policy rows, four dressing/securement rows,
  two ViziShot rows, and the 18-row focused drainage subset.

It displays current and proposed state, reason, lifecycle context, slotting scope, role decision,
exact-slot decision, reviewer decision, and rationale. The returned workbook contains all 97
decisions: 73 approvals as proposed, 20 approvals with modification, and four rejections. The
normalized artifact is fail-closed for metadata, hash, protected-field, identifier, decision,
formula, privacy, and required-rationale defects.

## Deferred work

This milestone does not add Chartis, electrosurgical/APC generators, ERBECRYO 2, snares, or other
missing products. It also does not perform taxonomy v2, full Product Kind normalization,
manufacturer consolidation, typed multi-GTIN migration, the 140-row variant campaign, or
automatic acceptance of the proposal artifact.

### Closed by taxonomy v2 — 2026-07-30

Four of the items deferred above are now done. Their ledger dispositions in
`reviewed/external-review-remediation.json` are unchanged — `needs_source_enrichment` is still
the correct description of what F-02 and F-03 were waiting for — but the evidence arrived and
the enrichment happened, so their `status` moved to `implemented`.

| Finding  | Was                                                       | Now                                                                                                                                                                                                                    |
| -------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F-02** | Chartis missing; `GENERIC_COLLATERAL_VENT` had 0 products | `COLLATERAL_VENTILATION_SYSTEM` holds the Chartis Catheter (`CHR-CA-12.0`), Precision Catheter (`CHR-CA-15.0`), and both consoles, with the ≥2.8 mm working-channel requirement and 72 cm working length from the IFU. |
| **F-03** | No electrosurgical/APC generator                          | `ENERGY_PLATFORM` holds the ERBE VIO 3 (`10160-000`) and APC 3 (`10135-000`); `ENERGY_PLATFORM_ACCESSORY` holds both VIO 3 footswitches. The reviewed compatibility rule `CMP-58DE7D49C4` now resolves.                |
| **F-07** | Role/category vocabulary drifted into synonyms            | `domain/role-taxonomy.ts` defines a closed 19-heading vocabulary; the import canonicalizes against it and fails closed on anything unmapped. 33 free-text headings → a closed set of 19.                               |
| **R-05** | Role codes drifted, `PDT_KIT` collided with PDT           | Eight role codes renamed behind a permanent alias table, freeing the photodynamic-therapy namespace for the real thing.                                                                                                |

**Still deferred, still for lack of evidence:**

- **F-04** — no ERBECRYO 2 console document was supplied, so the fourteen ERBECRYO accessories
  in the catalog still have no console to attach to. The AccessGUDID release does carry
  `20402-000 ERBECRYO 2 Cryosurgical unit`; adding it needs the same manufacturer document the
  VIO 3 had.
- **F-05** — the Steris catalog's snares are GI cold snares, not airway electrocautery snares.
  No airway snare evidence has arrived.

## Validation and protected data

Regeneration must preserve every existing product ID, catalog number, primary source ID, source
location, and source artifact. Tests cover the reviewed role and slot mappings, lifecycle versus
distribution independence, hidden/default/selectable combinations, proposal nonselectability,
custom-item resolution, workbook AutoFilters, and identifier/provenance stability.

The required validation sequence is:

```text
npm run ip-cards:import
npm run ip-cards:coverage
npm run ip-cards:scenarios
npm run ip-cards:validate-data
npm run ip-cards:seed
npx jest scripts/ip-preference-cards src/features/preference-cards --runInBand
npm run type-check
npm run lint
npm run build
```

No validation step makes a live OpenFDA request or runs the bulk UDI downloader.
