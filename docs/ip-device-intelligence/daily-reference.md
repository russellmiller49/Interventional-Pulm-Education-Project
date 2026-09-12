# Device Intelligence daily-reference increment

Implemented September 11–12, 2026, on top of the reference-beta work in PR #175.

The reference now supports saving exact devices, comparing two to four items, and printing a dated comparison or draft setup worksheet. Clinicians can inspect specifications and their evidence scope; office managers can retain a short list and identify questions for local equipment review. This is a reference workflow at the “knows how” level. It has no assessment, patient simulation or competence claim, so lesson sequencing and retrieval exercises are not added to these utility pages.

## Saved devices

Save controls appear on search results and device pages. `/devices/saved` supports removal and comparison selection. The browser stores only a versioned array of product IDs, limited to 100, with strict shape/length validation. Storage failures retain a usable session list and explain that changes are not persistent. Unsupported stored versions are preserved, and other-tab storage changes are reconciled. People sharing a browser profile share this list; it is not an institutional formulary or a signed-in account feature.

The GET-only `/api/device-intelligence/saved` endpoint validates a bounded identifier list, checks the feature flag, and returns a compact allowlist from the existing Atlas cohort with `Cache-Control: no-store`. Invalid or oversized requests return 400. Unknown and non-cohort items return only an unavailable count, never their identity. The client aborts obsolete requests, ignores late responses, supports retry, and leaves unavailable identifiers saved until the user removes them. Facts and status are reloaded when the list opens; no descriptions or safety status are stored in the browser.

## Comparisons

`/devices/compare?ids=…` resolves at most four exact cohort IDs on the server. A single physical class gets relevant fields; mixed classes show identity, description, configuration and safety evidence together without a measurement matrix. Classification remains discovery metadata and never changes inclusion or selectability.

Reviewed specifications supersede matching catalog fields and retain exact/family/configuration scope plus source locators and dates. Missing values stay unknown. Generic catalog diameter, insertion-tube diameter, distal-end diameter, scope working-channel diameter and the tool’s minimum channel requirement are distinct. There is no automatic fit, interchangeability, substitution, preferred-product or safety ranking calculation.

The comparison uses the same reviewed-description precedence as the device page. Reviewed configuration statements take precedence over catalog compatibility notes; the latter have already passed the Atlas identity-disclosure boundary. Catalog fields link back to their evidence and explicitly lack field-level citations in this view. Safety notices, research dates, source-coverage limitations and applicable procedure-selection gates remain visible. A new print date does not refresh evidence. Print styles hide site navigation and controls and preserve readable identities, warnings and references.

## Procedure review

Authored option cards now display catalog number and size, without changing their ordering or eligibility. The three existing procedure workspaces show a derived review panel and link to `/procedures/{code}/setup`. The worksheet uses the existing composed demonstration output, keeps conditional requirements and current-IFU flags, and lists kit-suppressed requirements separately. It makes no new device selections and does not invent quantities, staff assignments or local item mappings.

The worksheet is explicitly a draft for clinical and operational review. Its table repeats the draft label in the printed header, and handwritten notes do not change readiness. Current gaps include absent clinical owners, responsibility assignments and some selectable-device coverage. These are reported as authoring gaps, not conclusions about a real procedure or institution.

## Evidence expansion prepared for review

The [review packet](daily-reference-review/README.md) includes 50 exact products, led by all 23 stored active-notice products, followed by authored procedure examples with family rotation. Actual usage data was unavailable, so this is a proposed pilot rather than a most-used ranking.

All 50 bounded UDI queries completed: 65 exact catalog/model-string candidates across 33 products, with no candidate for 17. Manufacturer/package adjudication remains pending. Four official web sources have acquisition receipts, and two new manufacturer-grounded profile/specification drafts are ready for owner review. Research artifacts are isolated from runtime. No new description, regulatory match or safety conclusion was approved or published; the existing ten-product reviewed pilot and its gates remain intact.

The new offline review command checks deterministic source pins; the acquisition command uses the existing paced/retrying FDA client and creates immutable snapshots. See the packet for commands, dates, limitations and the accountable-owner publication workflow.

## Validation

- The scoped Jest run passed 884 tests across 62 suites, with one live FDA contract test/suite skipped. This includes 33 new tests for browser persistence, failures and cross-tab changes, bounded API access, comparison provenance and unknown values, accessible draft worksheets, candidate acquisition and immutable receipts.
- `npm run build` passed, including both training apps, content generation, asset validation, the production Next.js build and standalone packaging. The four new routes are dynamic. `npm run type-check` and ESLint on changed TypeScript files passed.
- Status, taxonomy, D2D, safety-evidence and daily-reference generation checks passed. No canonical catalog or approved clinical overlay changed in this increment.
- Browser checks covered saving from the Atlas, persistence after reload, selection/comparison, exact identifier labels, removal, two- and four-device comparisons, mixed-class handling, all three English procedure worksheets and the new route families in all three locales. At 390 px, pages had no document overflow; comparison and worksheet tables scrolled within their own regions.
- Desktop print-media inspection confirmed hidden navigation/controls, white backgrounds, legible identifiers, evidence dates, warnings, references and worksheet columns. Physical printing and exported-PDF pagination were not tested. The temporary tab, viewport override and test saved items were removed afterward.

New message keys are present in all locale bundles, with English interface copy seeded for this increment; existing translated evidence labels remain intact. Locale-route checks do not constitute a clinical translation review. Local analytics calls lacked the existing Supabase URL/key configuration, while reference pages and the saved-device GET endpoint worked; authenticated analytics were not validated. No shared database, protected source mount, Supabase configuration, institutional data, deployment or merge is part of this increment.
