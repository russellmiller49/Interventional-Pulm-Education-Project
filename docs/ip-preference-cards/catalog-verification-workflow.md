# Catalog verification workflow

## Scope

The admin verification workflow has two deliberately separate surfaces:

- The website is a read-only evidence workbench. It makes the current catalog
  quality-assurance inputs reviewable without changing the source workbook, generated catalog,
  visibility state, verification grade, GUDID proposals, exact-slot options, or formulary
  staging.
- Two Excel-first clinician review workflows provide portable recommendation layers. The
  Exact-slot workbook covers derived, noncanonical proposals. The full-catalog clinical-use
  workbook covers current product-role mappings and authored exact-slot assignments. Clinicians
  enter recommendations in generated workbooks and return completed `.xlsx` files for strict
  validation and preview. Exporting or importing either workbook does not apply a recommendation.

It does not create clinical or procurement decisions. Product identity/specification evidence,
catalog visibility, GUDID distribution evidence, exact-slot curation, compatibility, and
institutional formulary approval remain separate concepts.

## Routes

```text
/{locale}/admin/preference-cards/catalog-qa
/{locale}/admin/preference-cards/catalog-qa/[productId]
/{locale}/admin/preference-cards/catalog-qa/clinical-use
/{locale}/admin/preference-cards/catalog-qa/clinical-use/import
/{locale}/admin/preference-cards/catalog-qa/slot-options
/{locale}/admin/preference-cards/catalog-qa/slot-options/import
/{locale}/admin/preference-cards/catalog-qa/openfda
```

The corresponding site-admin-only APIs are:

```text
POST /api/preference-cards/exact-slot-review/export
POST /api/preference-cards/exact-slot-review/import?filename=<workbook.xlsx>&locale=<locale>
POST /api/preference-cards/clinical-use-review/export
POST /api/preference-cards/clinical-use-review/import?filename=<workbook.xlsx>&locale=<locale>
```

The catalog-QA landing page covers the effective 1,532-product merged catalog rather than only
the 1,221 workbook backlog rows. The remaining 311 reviewed additions are explicitly marked as
having no backlog row. Across the current catalog, 779 products are hidden and 753 are
prototype-visible.

The product workspace joins:

- the current effective catalog record;
- workbook backlog context, when present;
- claim-level source links and source use policies;
- every local GUDID confirmation candidate, including weak cross-manufacturer collisions;
- mapped product roles and authored procedure-slot uses; and
- unreviewed exact-slot proposals for the product.

The exact-slot review route exposes all 831 deterministic proposals with procedure, slot,
role, requiredness, product verification/visibility, source locator, and GUDID distribution
context, including conflicts. Every proposal remains `unreviewed`, `selectable: false`, and
`visible_by_default: false`.

## Evidence viewer and workbook responsibilities

The website is the place to inspect current product identity, verification, distribution,
visibility, role, procedure-slot, source, and conflict context. The workbook is the place to
record a clinician's exact-slot recommendation. A `Verified` badge is an evidence state, not
clinician approval, and a workbook decision does not change that state.

Each workbook row carries an `Evidence Page URL` back to the website. The export can contain
the current filtered result set, all proposals, required-slot proposals, or proposals for one
product. After a completed workbook is imported, the reviewer can also generate a fresh
workbook containing only current proposals that lack a valid completed decision in that
preview.

## Current U.S. status research proposals

Current U.S. status research is a third, isolated recommendation layer. It computes a
deterministic cohort from all 779 hidden products, preserves the distinction between hidden
`verified_source` products and hidden `candidate`/`unknown` products, and writes only dated
artifacts under `data/ip-preference-cards/research/us-status/<YYYY-MM-DD>/`. It is not an
application route, server action, runtime data source, or automatic extension of either workbook
workflow.

Each product packet keeps UDI/GUDID distribution, registration/listing, marketing authorization
or exemption, official manufacturer U.S. evidence, and recall context separate. Registration is
not approval, authorization is not current distribution, recall is not discontinuation, and the
absence of a manufacturer page is not negative evidence. See
[`openfda-enrichment.md`](./openfda-enrichment.md#dated-current-us-status-research-proposal-only)
for the local commands, dated output root, and ignored raw cache.

The resulting clinician-review rows and status files are research proposals with
`canonical_change_applied: false`. There is no runtime import, reviewer-to-catalog apply endpoint,
visibility release, verification promotion, slot/role change, formulary decision, or governed
release mutation in this work package.

## Full-catalog clinical-use workbook

The full-catalog workbook is deliberately separate from the 831-row proposal workbook. The
application's current effective catalog is generated, source-controlled data rather than a live
Supabase catalog database. Its current review surface contains:

- 1,532 catalog products: 779 hidden and 753 prototype-visible;
- 1,622 current `Product_Roles` mappings; and
- 2,035 current canonical `Slot_Product_Options` assignments.

The 1,176 products with canonical exact-slot assignments and the 401 products represented in the
proposal workbook are no longer disjoint: 157 products appear in both. A clinically incorrect
current assignment must still be reviewed through this full-catalog workflow. The
`Catalog Products` sheet also includes the remaining products, including products whose current
roles do not correspond to a procedure slot.

The macro-free format-version-1 workbook contains:

1. `Instructions` — purpose, recommendation boundary, editable-field rules, no-patient-data
   warning, return instructions, and provenance.
2. `Catalog Products` — one protected reference row per current effective product.
3. `Product Role Review` — one row per current `product_id:role_code` mapping.
4. `Current Slot Review` — one row per current `slot_id:product_id` authored option.
5. `Review Summary` — formula-driven completion and decision counts.
6. `Decision Definitions` — role-mapping and exact-slot recommendation definitions.
7. `Lookups` — protected dropdown values, current role/slot identifiers, and workbook metadata.

Product-role recommendations can confirm or remove the current mapping, propose replacing it or
adding another role, request evidence, identify a hospital-local/custom-only concept, or record
that the reviewer cannot determine the answer. Replacement and additional-role recommendations
require a valid `Suggested Role Code`.

Current-slot recommendations can confirm the current assignment, recommend removal from that
exact slot, propose moving it to another current slot, identify a broader product-role issue,
request evidence, identify a hospital-local/custom-only concept, or record that the reviewer
cannot determine the answer. Move recommendations require a valid `Suggested Slot ID`.

Every completed recommendation requires a rationale. Both review sheets reuse the reviewer,
confidence, date, evidence-needed, follow-up, and second-review fields from the proposal
workflow. Reference cells are protected and reviewer cells are visually distinct and unlocked.
Protection is an accidental-editing aid, not a security boundary.

Import is preview-only. It validates both mapping tables independently, rejects formulas and
non-text identifiers, compares protected values with the current effective catalog, and
reconciles mappings by their composite keys rather than row position. Normalized JSON uses a
discriminated `recordType` for product-role versus current-slot decisions, and normalized CSV
identifies the same record type explicitly. Neither output is an instruction to mutate
canonical data.

Workbook provenance includes SHA-256 values for the catalog products, product roles, roles,
procedures, procedure slots, and authored slot options plus a deterministic manifest SHA-256.
A changed manifest produces a stale-workbook warning and reconciliation preview. Normalized
downloads then require explicit stale acknowledgement, but acknowledgement never makes edited
reference cells authoritative.

## Exact-slot proposal workbook contract

Every generated workbook uses format version `1` and contains these five sheets:

1. `Instructions` — purpose, recommendation boundary, editing rules, patient-information
   warning, return instructions, and provenance.
2. `Exact Slot Review` — one proposal per row, protected reference columns, evidence links, and
   yellow clinician-editable columns.
3. `Review Summary` — recalculating completion, decision, confidence, and required-slot
   metrics, represented-procedure/manufacturer counts, and a procedure-by-decision breakdown.
4. `Decision Definitions` — the allowed recommendation vocabulary and its meaning.
5. `Lookups` — protected dropdown values and workbook metadata used by validation.

Only these ten columns are editable:

- `Decision`
- `Rationale`
- `Evidence Needed`
- `Reviewer Name`
- `Reviewer Confidence` (`High`, `Moderate`, or `Low`)
- `Review Date` (an Excel date or `YYYY-MM-DD`)
- `Follow-up Notes`
- `Ready for Second Review` (`Yes` or `No`)
- `Second Reviewer`
- `Second-review Comments`

All other columns are reference data. Sheet protection and color are usability aids, not a
security boundary; the current proposal artifact remains authoritative during import. Every
nonblank decision requires a nonblank rationale. Reviewer fields with a blank decision are
reported as incomplete and are not emitted as a normalized decision.

The six allowed decisions are:

| Workbook label                 | Normalized value                 | Definition                                                                                                                                                                                |
| ------------------------------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate for canonical option | `candidate_for_canonical_option` | Available evidence suggests that the product is clinically appropriate for this exact slot. This is a recommendation for a later governed proposal; it does not modify canonical options. |
| Reject for this exact slot     | `reject_exact_slot`              | The broad product role may remain valid, but the product should not be offered for this particular slot.                                                                                  |
| Needs more evidence            | `needs_more_evidence`            | Additional IFU, dimensional, platform, kit, package, or configuration evidence is required.                                                                                               |
| Product-role mapping issue     | `product_role_mapping_issue`     | The broader product-to-role classification may be incorrect and needs separate review.                                                                                                    |
| Hospital-local or custom only  | `hospital_local_or_custom_only`  | The requirement is better represented as a local resource, supply, protocol, service, or formulary item.                                                                                  |
| Unable to determine            | `unable_to_determine`            | The reviewer cannot reach a more specific conclusion from the available evidence.                                                                                                         |

## Export, return, and strict import preview

The intended handoff is:

1. Inspect evidence on the website and export the appropriate proposal scope.
2. Enter recommendations only in the yellow columns while using the linked evidence pages for
   context.
3. Save the completed file as a macro-free `.xlsx` workbook and return it through the import
   page.
4. Inspect the normalized preview, row-level warnings, blocking errors, protected-field
   comparisons, and provenance.
5. Correct and re-import the workbook when blockers exist. When validation passes, download
   normalized JSON or CSV for a later governed process.

Import is preview-only and fail-closed. It requires the five named sheets, exact ordered
headers on `Exact Slot Review`, complete format-version/provenance metadata, and a review-row
count matching the declared proposal count. It rejects malformed OOXML, macros/VBA, external
workbook links, executable/binary archive entries, unsafe archive paths, formulas in review
rows, non-text identifier cells, duplicate or unknown proposal keys, unsupported decision or
confidence values, invalid review dates or yes/no values, and completed decisions without a
rationale. Unsupported extra review columns are also rejected.

Protected-field edits are surfaced as warnings and never replace current values. Valid
normalized identifiers (`Proposal Key`, slot, procedure, product, and role) are taken from the
current proposal artifact. A returned workbook is not written back or silently repaired by the
application. The reviewer keeps and corrects the local `.xlsx` file, then imports it again. The
optional “unreviewed” download is a newly generated workbook from current proposal data; it is
not a persisted copy of the uploaded file.

## Artifact hashes and stale workbooks

Each export records the exact-slot proposal artifact SHA-256 in workbook metadata and in every
review row. Import also computes the SHA-256 of the returned workbook. The preview reports both
hashes and compares the workbook's proposal-artifact hash with the current artifact.

Rows are reconciled by `Proposal Key`, never by row position. The preview reports matched keys,
current proposals missing from the workbook, unknown workbook keys, duplicate keys, and
protected-field differences. A differing artifact hash marks the workbook stale and displays
those reconciliation counts. Import still produces a preview, but normalized JSON/CSV download
remains disabled until:

- all blocking row errors are resolved; and
- the reviewer explicitly acknowledges the stale-artifact warning.

The acknowledgement is recorded in the normalized artifact. It does not make workbook
reference fields authoritative and does not approve or apply a change.

## Normalized review artifacts and later governance

Normalized JSON and CSV contain only valid completed recommendations plus portable provenance:
format version, import timestamp, returned workbook filename and SHA-256, proposal-artifact
SHA-256, and stale-artifact acknowledgement. Each decision includes current proposal
identifiers and the reviewer-entered rationale, evidence request, reviewer/confidence/date,
follow-up, and second-review fields. Decisions are ordered by proposal key. CSV output also
guards cells that could otherwise be interpreted as spreadsheet formulas.

These files are handoff artifacts, not canonical data. This milestone has no decision-apply
endpoint, catalog-change action, catalog writer, migration, or decision database. In particular,
selecting `Candidate for canonical option` does not make the proposal selectable or visible and
does not alter product roles, verification, distribution, compatibility, formulary status, or
authored slot options. The normalized downloads are not cryptographically signed or bound to
the site-admin session and must not be treated as trusted submissions without later
revalidation.

A later governed proposal path may consume a normalized artifact only through a separate,
explicit workflow. That future workflow should revalidate the current proposal artifact and
protected identifiers, authenticate and authorize the submitter, preserve reviewer identity,
rationale, evidence, timestamps, stale-input state, and second-review history, and create an
auditable proposal before any canonical change. That governed apply path is intentionally not
implemented here.

## API, session, and privacy safety

Both review APIs require an authenticated, verified-email user with an active `site_admin`
entitlement; the tightly constrained localhost development credential remains development-only.
Responses use `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`.
Export bodies use a strict, bounded schema and are limited to 256 KB.

Imports accept only a nonempty `.xlsx` file up to 20 MB compressed. Request bodies are read
incrementally and rejected before buffering when they cross their route limit. Before
decompression, the OOXML reader inspects raw ZIP metadata and bounds uncompressed size (80 MB),
archive entries (200), and unsafe paths; it then checks ZIP CRC values and bounds worksheet
size, shared strings, rows (5,000), and columns (100). Parser failures return a generic
validation error rather than internal details.

The uploaded workbook is parsed in request memory. The returned preview is held in the current
browser page's component state, and normalized JSON/CSV are created as browser downloads. The
review endpoints do not intentionally persist the workbook, preview, or decisions in
application storage, browser storage, or a database; reloading the import page starts a new
preview state. Authentication/entitlement reads still occur to authorize each API request.
That session proves access to the workflow, not the identity of the clinicians named in the
workbook: `Reviewer Name` and `Second Reviewer` are unverified text fields, and stale
acknowledgement is client-side artifact metadata rather than a durable attestation.

Do not enter or upload patient information. This includes patient names, identifiers, dates of
birth, medical record numbers, encounter details, or patient information in the workbook
filename. The filename is supplied in the request URL and may be visible to ordinary
infrastructure request logging even though the application does not persist the workbook.

## Evidence semantics

GUDID rows are aggregated by unique catalog product.

- `manufacturer_and_catalog_number` rows are presented as strong **candidates**, not accepted
  identity.
- `catalog_number_only` rows are weak evidence. They never drive distribution, GTIN, or
  visibility signals.
- Multiple strong DIs and GTINs remain visible.
- Conflicting or mixed recognized/unrecognized strong distribution states are surfaced as a
  conflict rather than collapsed.
- An in-distribution record does not establish current orderability or justify releasing a
  hidden product.
- A visibility-review signal is emitted only when aggregate strong distribution evidence is
  unambiguously in distribution; a conflicting product cannot inherit that signal from one
  candidate row.

The workbook verification backlog is a planning snapshot. The workbench compares selected
identity/status fields with the current merged product, compares its suggested Primary DI
with current strong candidates, and flags drift without overwriting either record.

Source evidence is claim-specific. The UI carries the source type, publisher, filename,
location, revision/as-of context, reliability tier, claim type, link verification text, use
policy, and source/link notes when present.

## Safety invariants

The workflow has no accept, approve, apply, visibility, catalog, slot-option, formulary, or
database mutation action. Workbook export, import, preview, stale acknowledgement, normalized
download, and unreviewed-workbook generation remain non-applying operations.

Protected canonical artifacts remain guarded by
`scripts/ip-preference-cards/protected-artifacts.test.ts` and
`scripts/ip-preference-cards/us-status/__tests__/safety-boundaries.test.ts`. Any later decision
layer should be an independent, strictly validated overlay with reviewer identity, timestamp,
rationale, selected evidence, and stale-input protection. GUDID acceptance must remain unable to
change visibility or imply local approval.

## Verification

Focused coverage lives in:

```text
src/features/preference-cards/__tests__/catalog-verification-workflow.test.tsx
src/features/preference-cards/__tests__/clinical-use-review-data.test.ts
src/features/preference-cards/__tests__/clinical-use-review-workbook.test.ts
src/features/preference-cards/__tests__/clinical-use-review-workflow.test.tsx
src/features/preference-cards/__tests__/exact-slot-review-workbook.test.ts
src/features/preference-cards/__tests__/exact-slot-review-workflow.test.tsx
src/features/preference-cards/__tests__/slot-option-review.test.tsx
```

The tests pin:

- 1,532 unique effective products, including 311 post-workbook additions;
- 1,221 workbook backlog rows;
- strong-candidate aggregation by unique product;
- weak-match isolation;
- conflicting strong distribution/GTIN evidence;
- 99 unique products with GTIN mismatches or multiple strong GTINs;
- workbook suggested-DI agreement, divergence, and missing-current-strong states;
- text search across current strong and weak candidate DIs;
- product/source relationship failures and mixed unknown distribution states;
- strict backlog schema behavior;
- 1,622 current product-role mappings and 2,035 canonical exact-slot assignments in the
  full-catalog workbook;
- deterministic six-artifact clinical-use provenance, strict role/slot workbook validation,
  and normalized discriminated review records;
- 831 nonselectable exact-slot proposals affecting 401 products and 108 slots;
- 426 required-slot proposals;
- 32 not-in-distribution, 7 conflicting, and 231 unknown distribution signals; and
- the absence of approval/apply controls.
