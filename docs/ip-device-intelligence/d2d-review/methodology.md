# D2D-A evidence and review methodology

Snapshot: **2026-08-24**
Method family: **D2D v1**
Pilot size: **10 frozen products**

This package creates review proposals for evidence-derived product profiles and regulatory
evidence. It does not change the canonical catalog, Atlas inclusion, taxonomy, roles,
selectability, releases, recommendation gates, or the D2B market/safety overlay. It also does
not add runtime readers or UI.

## Authority and publication wall

The repository artifacts under `data/ip-device-intelligence/research/d2d/` are proposals only.
They are not public content and cannot be imported by runtime code. The two files under
`data/ip-device-intelligence/reviewed/` named `product-description-reviews.json` and
`product-regulatory-matches.json` are the authoritative review records.

Every public row requires one accountable physician-owner decision. The implementation agent
does not approve a profile or a regulatory conclusion. Until the owner records a final decision,
the compact overlays contain no row for that product. A correction is represented by a new
review record with `supersedes_review_id`; the v1 correction-pass limit is one.

## Evidence hierarchy

Claims are evaluated in this order:

1. Exact manufacturer IFU, labeling, or operator manual.
2. Exact official manufacturer product page or catalog.
3. Exact AccessGUDID/GUDID DI record.
4. Exact official FDA premarket record.
5. FDA classification or regulation record.
6. Official establishment registration or listing record.
7. Family-level manufacturer or FDA evidence.
8. Governed catalog identity, limited to minimal identity.

Each claim must cite a controlled source ID and an exact page, section, field, or record locator.
Family evidence cannot support an exact-product claim. GUDID supports identity, not authorization.
Registration/listing is a separate axis and cannot be described as clearance or approval.
Commercial-distribution evidence is not evidence of present orderability.

## Acquisition

Only `npm run ip-intel:d2d-acquire -- --snapshot 2026-08-24` may use the network. It is bounded to
the frozen cohort and the `udi`, `510k`, `pma`, `classification`, and `registrationlisting`
openFDA datasets. Recall, enforcement, adverse-event, and safety endpoints are prohibited.

Raw responses are content-addressed beneath the ignored directory
`local-data/ip-device-intelligence/d2d/2026-08-24/`. The committed acquisition manifest pins the
query, endpoint, retrieval timestamp, API version, result completeness, HTTP status, response
hash, and portable cache reference. Once written, the snapshot is immutable. Proposal, review,
overlay, test, and `--check` commands are offline.

## Deterministic matching

Normalization changes Unicode representation, case, whitespace, and punctuation only. It
preserves leading zeroes, sizes, suffixes, package identifiers, and meaningful delimiters.
Manufacturer names resolve only through the alias rows in `d2d-pilot-cohort.json`. A fuzzy result
cannot become an exact match.

Proposal precedence is:

1. `exact_udi_catalog_match`
2. `exact_model_manufacturer_match`
3. `exact_premarket_submission_match`
4. `strong_exact_identity_match`
5. `family_level_match`
6. `product_code_only`
7. `ambiguous`
8. `no_exact_record_found`
9. `not_searched`

A material manufacturer or model conflict forces `ambiguous`. `no_exact_record_found` requires
a complete logged search across every configured official search purpose. It never means that a
device is unregulated. The owner affirms the final scope and conclusion.

## Profile drafts

Exactly two pilot drafts exercise assisted drafting:

- `PRD-2632FFBF07` — exact-product evidence.
- `PRD-F4AE2A74E6` — family/configuration inheritance.

Their generation provenance records the method, prompt version, pinned snapshot, ordered source
IDs and hashes, and draft SHA-256. The other eight drafts are deterministic governed-catalog
projections. All ten remain pending owner review. Drafting cannot set regulatory conclusions,
orderability, compatibility, equivalence, substitution, preference, formulary, or procurement
fields.

## Owner review procedure

1. Review `pilot-products.csv` and `source-manifest.json`.
2. Review every claim and locator in `description-review.csv`; record the authoritative result in
   `product-description-reviews.json`.
3. Review exact, family, ambiguous, and no-match queues plus `regulatory-review.csv`; record the
   authoritative result in `product-regulatory-matches.json`.
4. Use `insufficient_evidence` for a profile that cannot support public prose. Use `unresolved`
   for ambiguous or no-exact regulatory identity. Do not strengthen a disposition to make a test
   pass.
5. Run the review and overlay checks. Only approved or explicitly unresolved/insufficient final
   records can enter the compact overlays.

The generated CSV files are projections for review convenience. JSON review records are
authoritative.

## Stop rules

The cohort cannot grow or substitute products. One immutable snapshot, one owner review, and one
bounded correction pass are allowed. D2D-A stops at the owner review gate until all ten profile
and regulatory rows are dispositioned. Catalog-wide acquisition and D2D-B runtime/UI work require
separate authorization.
