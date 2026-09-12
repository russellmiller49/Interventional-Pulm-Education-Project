# Device Intelligence reference beta

Implemented September 11, 2026. This is the first increment of the production-readiness plan: make the existing reference trustworthy and easier to inspect. It does not enable institutional workflows or certify the catalog for clinical use.

## User-visible changes

- A reviewed product summary now leads the device page and its metadata. An insufficient-evidence profile suppresses catalog fallback. Products without a reviewed profile retain a labeled catalog description. The CLR Irrigator regression explicitly prevents the superseded “separate suction and irrigation controls” claim from reappearing on the page or in metadata. Canonical catalog records and physician-approved profile claims are unchanged.
- Regulatory citations resolve to the reviewed primary DI in AccessGUDID or the exact FDA 510(k) record. Acquisition queries and internal query IDs remain private. A source associated with multiple records does not receive a misleading single-record or generic endpoint fallback.
- Device headers include catalog number and size. The source badge says “Verified source.” For researched products, the dated market overlay supplies the market label without an additional legacy “US status unconfirmed” badge. Regulatory and installed-base labels are retained.
- The safety panel appears before extended profile/specification sections. A header link jumps to notices. Each notice shows its recall number, recorded state, FDA-reported reason, matched product identifiers, reported scope, initiation date, published statuses/classification, source dates, and a link to the complete FDA record and its action instructions. Historical notices have their own label even on a product that also has an active notice.
- Search results distinguish exact identifier equality from prefix/fuzzy matches. One semantic table becomes cards below the desktop breakpoint; identity and material safety labels remain visible without horizontal scrolling. Search has an expandable filter form, and active filters remain expanded after submission.
- The Atlas states its coverage: 1,957 products, 578 with dated U.S. status research and 10 with reviewed descriptions. Plain-language evidence guidance replaces implementation terminology in the main flow. Source prose remains in English and is marked as such; existing translated evidence labels are preserved.

## Safety evidence contract

`product-safety-evidence.json` is a separate strict projection. It does not widen or replace the existing status overlay or change inclusion, selection, compatibility, or institutional rules.

The artifact contains 578 product rows, 46 product/notice associations across 25 products, and 28 distinct exact-match recall numbers. The 25 products include the existing 23 with active notices and two with historical notices. Family-only matches are not promoted to exact matches. A known exact notice is retained if a subsequent search is incomplete.

The public allowlist contains only selected FDA facts and provenance dates. It excludes research rationale, raw query strings, response caches, internal source IDs, manufacturer acquisition text, and partial lot lists. Full `code_info` is not present in the old research input; its truncated excerpt cannot support a lot checker. The UI sends users to the complete official record and manufacturer notice rather than inferring that a local unit is affected or prescribing removal for every recall.

The deterministic builder pins all three inputs by SHA-256:

1. The existing August 13, 2026 research package.
2. The existing market/safety status overlay, which must pin those same research bytes.
3. An identifier-only FDA recall-link receipt.

The link receipt was acquired using the existing paced/retrying openFDA client. Each of the 28 known recall numbers returned exactly one matching record. The receipt retains the recall number, event ID, FDA record ID, dataset date, retrieval timestamp and response digest. It deliberately does not publish newer reason, action, classification or lifecycle conclusions. Query errors, empty results, ambiguity and identifier mismatches fail acquisition before the prior receipt is replaced. Generation also rejects a recall/event identity conflict.

## Freshness and uncertainty

The 14-day review interval is an application editorial policy, not an FDA requirement or a clinically validated threshold. It uses source dataset dates and the current UTC date, not the page-build time or the date a citation link was resolved. Fetching a link cannot make an old safety assessment appear newly checked.

- Both FDA systems with dated responses: show whether the review interval has elapsed.
- Missing endpoint coverage, query failure, future/invalid dates, or undated responses: freshness is incomplete.
- No search: explicitly not checked.
- A source-date gap does not delete a known notice. A no-match statement is withheld when coverage/freshness cannot be verified.

The old research package contains 567 searched and 11 not-searched products. At implementation, 558 rows lack sufficient response-date coverage for a complete freshness assessment; the nine fully dated rows are past the interval. For partially dated endpoints, the UI shows the oldest available dataset date and explicitly identifies undated responses. This is a limitation of the recorded metadata, not proof that 558 API requests failed.

Published openFDA statuses are presented verbatim and as dated observations. FDA states that these APIs should not be used for public alerting or recall-lifecycle tracking and that enforcement statuses may remain unchanged. Manufacturer communications, FDA early alerts and local inventory have not been systematically checked by this projection. These limits are available from the safety panel. Existing selection gates are unchanged; a refresh reminder cannot clear a block.

References: [openFDA device recall documentation](https://open.fda.gov/apis/device/recall/), [openFDA enforcement documentation](https://open.fda.gov/apis/device/enforcement/), [FDA recalls and early alerts](https://www.fda.gov/medical-devices/medical-device-safety/medical-device-recalls-and-early-alerts).

## Maintenance commands

```sh
# Offline reproducibility check; does not recheck external evidence.
npm run ip-intel:safety-evidence -- --check

# Resolve only already-known exact recall numbers to FDA record links.
# Makes bounded external API requests; does not refresh market/safety conclusions.
npm run ip-intel:safety-record-links -- --refresh

# Rebuild after reviewing a changed link receipt or approved source inputs.
npm run ip-intel:safety-evidence
```

Review and commit the receipt and generated artifact together. Do not edit the generated safety JSON directly. The old status, taxonomy and reviewed profile/regulatory generators retain their existing workflows. No network request runs during page rendering; malformed committed evidence fails the server import/build.

For a future substantive safety refresh, acquire exact identifiers, search both FDA datasets, examine current FDA public notices and the manufacturer's communication, reconcile identity and scope, and record reviewer disposition before changing public conclusions. Web search should discover official source material for that review; snippets and name similarity must not directly publish clinical claims or recall matches. This increment adds source visibility and reproducible citation acquisition, not a scheduled surveillance service.

## Verification

Validation of the final code:

- Focused Jest run: **58 suites passed; 851 tests passed; one live integration suite/test skipped**. Scope: Device Intelligence and its scripts, openFDA enrichment and U.S. status research.
- `npm run build`: passed, including embedded training-app builds, content generation, critical-care/cardiac asset validation, Next.js compilation and TypeScript validation, 709 static pages, and standalone packaging.
- `npm run type-check`: passed after the production build.
- Focused ESLint: passed without errors or warnings.
- Safety-evidence, status-overlay, taxonomy-overlay and D2D-overlay `--check`: all passed against their committed inputs.
- All 35 newly resolved record links (28 recall, six DI, one 510(k)) returned HTTP 200 and contained the expected identifier during the September 11 check.

Regression coverage includes description precedence, exact citations, failure/ambiguity handling, source-date boundaries, retained notices, historical/active distinctions, input reproducibility, source-prose boundaries and exact-search labels. The mobile Playwright regression file was updated; browser verification for this task used Codex's browser controls rather than executing that Playwright suite.

Browser checks covered 390, 1024, 1280 and 1600 px viewports, all three locale routes at mobile width, exact search, filter submission and persistence, keyboard navigation to the safety panel, and the CLR header/metadata/source-link correction. The Atlas had no document or results-region horizontal overflow at those widths. The mobile form was adjusted after browser inspection so the first result and its warning are visible sooner. The persistent browser viewport override was reset and the temporary tab was closed afterward.

Representative external destinations were opened and confirmed: [CLR DI](https://accessgudid.nlm.nih.gov/devices/00860003054901), [Storz 10350F DI](https://accessgudid.nlm.nih.gov/devices/04048551046692), [K261068](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=K261068), [Erbe recall record](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfres/res.cfm?id=218710), and [Olympus recall record](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfres/res.cfm?id=216176). This does not constitute a review of the current lifecycle or local applicability of all 28 notices.

The local analytics endpoint returns HTTP 500 without the checkout's Supabase URL/key configuration. Public reference pages render, but analytics and authenticated institutional integrations were not validated. No shared database, protected source mount, production data, or deployment was changed.

## Remaining increments

The next daily-reference increment is reviewed coverage of the most-used 50–100 exact products, category-specific comparisons, saved device lists, and review of the three procedure exemplars. The subsequent operational pilot requires an actual site's item mapping, scoped access, durable institutional data, a reviewed safety investigation queue, and dated exports. Those remain separate work from this reference beta.
