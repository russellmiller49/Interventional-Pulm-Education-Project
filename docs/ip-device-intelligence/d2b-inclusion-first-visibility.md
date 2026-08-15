# Phase D2B — Inclusion-first Device Atlas visibility

**Status:** implemented behind the existing (off-by-default) Device Intelligence feature flag.
Independent review pending. Not enabled in production.

**Owner decision date:** 2026-08-15. **Supersedes:** the atlas-cohort predicate recorded under
decision D-07 as modified (2026-08-08).

---

## 1. The decision

The physician owner decided that, for this educational catalog, **false exclusion is the
greater harm**:

> It is acceptable for a small number of legacy or no-longer-orderable products to appear and
> be corrected later. It is not acceptable for hundreds of adequately sourced products to
> remain absent merely because current availability has not been conclusively established.

Phase D1 required both `verification_grade = verified_source` **and** `visibility_state =
prototype_visible`. That second conjunct kept **578 adequately sourced products** out of the
Device Atlas because the merged PR #105 research pass could not conclusively establish their
current U.S. availability — a research limitation, not a defect in the products' sourcing.

D2B replaces that predicate:

```
include ⟺ verification_grade = verified_source
          AND NOT explicitly excluded by the owner
```

Everything else is metadata.

### What decides inclusion

| Fact                                    | Role in D2B                                                              |
| --------------------------------------- | ------------------------------------------------------------------------ |
| `verification_grade = verified_source`  | **Decides inclusion.** Sourced identity is the whole gate.               |
| Explicit reviewed owner exclusion       | **Decides exclusion.** Data-quality defects and owner decisions only.    |
| `visibility_state`                      | Governed preference-card data. **Not** an atlas gate.                    |
| Current U.S. distribution support       | Overlay label.                                                           |
| Current manufacturer page / FDA listing | Overlay input only.                                                      |
| Present orderability                    | Never asserted anywhere.                                                 |
| Discontinuation evidence                | Overlay label (`historical_or_discontinued`).                            |
| Recall / safety-action evidence         | Overlay label **and** a recommendation gate — never a visibility gate.   |
| Completed safety research               | Not required. Its absence is stated, never implied to be a clean result. |

`candidate`- and `unknown`-grade products remain outside Device Intelligence entirely, exactly
as in D1. D2B does not broaden to them.

### Error preference, implemented

| Situation                                       | D2B behavior                                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Uncertain market status                         | Included, labeled `current_status_unverified`                                                          |
| Affirmative historical/discontinued status      | Included, labeled `historical_or_discontinued`                                                         |
| Active safety action                            | Included, prominent notice, recommendation gate `blocked_active_safety_action`                         |
| Current-status conflict                         | Included, labeled `current_status_conflicted`                                                          |
| Current status never researched                 | Included, labeled `current_status_unverified` with an explicit "not covered by the snapshot" statement |
| Identity/data-quality defect, or owner decision | **Only** case that removes a verified-source product                                                   |

---

## 2. Measured cohort change

Recomputed from `data/ip-preference-cards/generated/catalog-products.json` at
`d93e210039aee3a0a28701f19ad550f38663d232`; nothing is hardcoded.

| Population                                           | Count     |
| ---------------------------------------------------- | --------- |
| Catalog products (unchanged)                         | 1,532     |
| **Atlas cohort — D1**                                | **753**   |
| **Atlas cohort — D2B**                               | **1,331** |
| Newly included (verified-source, canonically hidden) | **578**   |
| Still excluded — candidate grade                     | 200       |
| Still excluded — unknown grade                       | 1         |
| Explicit owner exclusions                            | **0**     |

Accounting artifact: [`d2b-review/newly-included-products.csv`](./d2b-review/newly-included-products.csv)
(578 rows) and [`d2b-review/newly-included-summary.json`](./d2b-review/newly-included-summary.json).
Regenerate with `npm run ip-intel:d2b-review`; `-- --check` fails on staleness.

**The review artifact is not a gate.** The runtime inclusion has already happened when it is
generated. A reviewer who finds a wrong admission removes it through the owner-exclusion
overlay, one row at a time.

---

## 3. The compact status overlay

The merged PR #105 research package
(`data/ip-preference-cards/research/us-status/2026-08-13/us-status-evidence-proposals.json`,
**14,567,158 bytes**) carries rationale prose, unresolved-question prose, manufacturer and FDA
response text, source URLs, raw cache references, API query strings, and free-text conflict
descriptions. **None of that may reach application runtime code or a client bundle.**

`npm run ip-intel:status-overlay` projects it down to
`data/ip-device-intelligence/generated/product-status-overlay.json` — **212,231 bytes, 578
rows**, 1.46% of the source, 68× smaller. Every field is a controlled vocabulary value, an ISO
date, a product id, or an FDA recall number:

```json
{
  "product_id": "PRD-05670F1B5F",
  "research_snapshot_date": "2026-08-13",
  "market_status": "confirmed_current_us",
  "market_confidence": "high",
  "safety_display": "active_safety_notice",
  "safety_action_scope": "lot_specific",
  "safety_reference_codes": ["Z-1568-2026"],
  "status_recommendation_gate": "blocked_active_safety_action"
}
```

The artifact pins the source proposal's SHA-256
(`1fe01cecc6f3c5e9cdac336fe2838c9d88d486add485455b24155a4e82bfbd2d`) and its research-as-of
date. The generator validates against the closed schema **before** writing, sorts rows by
product id, sorts and deduplicates recall numbers, and reads no clock or environment — so
running it twice is byte-identical.

**Row scope:** researched products whose _canonical_ verification grade is `verified_source`
(578 of the 779 researched). The 201 candidate/unknown-grade researched products contribute no
runtime row, because Device Intelligence can never display them. The 753 previously visible
products were outside the research cohort entirely and have no row either — they resolve to the
honest unresearched default.

### Market-status mapping

| PR #105 research state                              | Confidence | D2B market status                       |
| --------------------------------------------------- | ---------- | --------------------------------------- |
| `current_us_distribution_supported`                 | high       | `confirmed_current_us`                  |
| `current_us_distribution_supported`                 | moderate   | `likely_current_us`                     |
| `current_us_distribution_supported`                 | low        | `current_status_unverified`             |
| `current_status_conflicted`                         | any        | `current_status_conflicted`             |
| `not_currently_distributed_supported`               | any        | `historical_or_discontinued`            |
| `not_applicable_noncommercial_or_local`             | any        | `not_applicable_noncommercial_or_local` |
| `historically_authorized_current_status_unresolved` | any        | `current_status_unverified`             |
| `identity_unresolved`                               | any        | `current_status_unverified`             |
| `insufficient_evidence`                             | any        | `current_status_unverified`             |
| anything a future method version emits              | any        | `current_status_unverified`             |

`identity_unresolved` means the research method could not tie an exact regulatory identity to
the catalog product. It says nothing about whether the catalog product has sourced identity, so
it **must not** override the canonical `verified_source` inclusion decision — and it does not.

Neither `likely_current_us` nor `current_status_unverified` is ever worded as currently
orderable. Nothing anywhere claims current stock, local availability, formulary status,
clinical suitability, or procurement availability.

Public wording (`deviceIntelligence.status.market`):

| Status                                  | Label                                                    |
| --------------------------------------- | -------------------------------------------------------- |
| `confirmed_current_us`                  | Current U.S. distribution supported                      |
| `likely_current_us`                     | Likely current in the U.S.; orderability not established |
| `current_status_unverified`             | Current availability not recently verified               |
| `current_status_conflicted`             | Market status uncertain                                  |
| `historical_or_discontinued`            | Historical or no longer distributed                      |
| `not_applicable_noncommercial_or_local` | Commercial market status not applicable                  |

### Safety mapping

| PR #105 safety state                       | D2B safety display                     |
| ------------------------------------------ | -------------------------------------- |
| `active_exact_product_action`              | `active_safety_notice`                 |
| `historical_exact_product_action`          | `historical_safety_notice`             |
| `family_or_ambiguous_action`               | `safety_identity_review_required`      |
| `no_exact_action_found`                    | `no_exact_action_found_as_of_snapshot` |
| `unknown` / `not_searched` / `query_error` | `safety_status_unverified`             |

Rules the copy and the data both enforce:

- **"No exact action found" is never rendered as "safe" or "recall-free."** The vocabulary name
  carries its own as-of-snapshot qualifier, and the sentence explicitly denies the clean-bill
  reading.
- **An unverified safety status is never rendered as an absence of findings.**
- **Recall numbers ride along only for exact-product matches.** A family-level or ambiguous
  match reports `safety_identity_review_required` with _no_ reference codes — printing a recall
  number beside a product whose identity did not match exactly would assert something the
  research package explicitly did not establish.
- **Only controlled identifiers travel:** recall number, scope (`lot_specific` / `product_wide` /
  `family_level` / `unknown`), and the research snapshot date. No FDA prose of any kind.
- **Scope exists only when an action matched.** For the 533 products with no matched action the
  scope is `null`, not `"unknown"` — an "undetermined recall scope" on a product with no recall
  would be a false implication.

### Status / recommendation separation

The view-level gate is **only** a market/safety recommendation gate. It is not proof of
clinical compatibility, suitability, or availability, and it never affects visibility.

| Condition                              | Gate                           |
| -------------------------------------- | ------------------------------ |
| Active exact safety action             | `blocked_active_safety_action` |
| Family/ambiguous safety action         | `review_required`              |
| Safety search incomplete or unverified | `review_required`              |
| Current-status conflict                | `review_required`              |
| Otherwise                              | `clear`                        |

A blocked or review-required product **remains visible in the atlas, remains discoverable by
search and by role, retains its governed authored-option identity, and displays the appropriate
notice.** It simply must not become an automatic default or a recommendation.

Distribution across the 1,331 atlas products: 23 blocked, 787 review-required, 521 clear. The
787 includes the 753 products the research snapshot never covered — their safety status is
honestly unverified, so the same mapping applies.

**There is no automatic recommendation or default-selection mechanism in Device Intelligence
today.** Authored-option selectability comes from the canonical `slot_product_options.selectable`
values, copied verbatim; the workspace never marks an option chosen, preferred, recommended, or
default. D2B introduces none, and regression tests prove it: the option ordering rule is
`selectable` then product name with status as no term in it, the readiness and coverage-ladder
layers never import the status module, and `getProductStatus` appears at exactly one site in
`procedures.server.ts` — the option-link builder.

### The three ERBE flexible cryoprobes

Named explicitly by the owner. All three:

| Product                                                        | Market status          | Safety | Scope        | Recall      | Gate    |
| -------------------------------------------------------------- | ---------------------- | ------ | ------------ | ----------- | ------- |
| `PRD-05670F1B5F` Flexible Cryoprobe 2.4 mm                     | `confirmed_current_us` | active | lot-specific | Z-1568-2026 | blocked |
| `PRD-7DC3645CFA` Flexible Cryoprobe 1.7 mm                     | `confirmed_current_us` | active | lot-specific | Z-1567-2026 | blocked |
| `PRD-A2C49C9352` Flexible Cryoprobe 1.1 mm / 817 mm oversheath | `confirmed_current_us` | active | lot-specific | Z-1566-2026 | blocked |

They are **in** the atlas, searchable, role-listed, and carry a prominent lot-specific FDA
safety notice. They are **not** described as discontinued: the same snapshot supports current
U.S. distribution, and the recall axis is separate from the distribution axis. The sibling
probe `PRD-6C2199C862` matched only at family level and is therefore
`safety_identity_review_required` with no recall number attached.

---

## 4. Owner-exclusion mechanism

`data/ip-device-intelligence/reviewed/atlas-visibility-exclusions.json` — **ships empty.**

```json
{ "product_id": "PRD-…", "reason_code": "confirmed_duplicate", "internal_note": "…" }
```

Reason codes: `confirmed_duplicate`, `wrong_source_product_match`,
`malformed_canonical_identity`, `owner_excluded`. **None of them is a market-status, recall, or
availability reason** — that is the point.

Validation, all at module load or store construction:

- unknown/malformed product ids **reject** (a malformed id would be an unreviewable no-op that
  silently claims to exclude something);
- duplicate entries **reject**;
- unexpected fields **reject** (so a "market_status" column cannot be smuggled in);
- an id absent from the catalog **rejects** at atlas-store construction, where the catalog is
  already loaded;
- `internal_note` is read for validation and **never** exported or rendered.

An exclusion overrides `verified_source`. Reversing one means deleting a line.

---

## 5. What did NOT change

Confirmed by test and by `git diff`:

- `data/ip-preference-cards/generated/catalog-products.json` — untouched. `visibility_state`,
  `verification_grade`, and `live_dropdown_status` are exactly as merged.
- `slot-product-options.json` — untouched. `selectable`, `visible_by_default`,
  `product_visibility`, and `eligibility_status` are exactly as merged.
- Catalog-addition seeds, the verification backlog, GUDID confirmations, hospital formulary
  staging, published releases, release pointers and ledgers — untouched.
- PR #105 research evidence — read-only input; untouched.
- D2A institutional contracts, Literature, Supabase, migrations, authentication — untouched.
- Navigation, sitemap, and general site-search indexing — unchanged; no route was added.
- `NEXT_PUBLIC_ENABLE_DEVICE_INTELLIGENCE` — **unchanged and off/unset by default.** Feature-off
  still 404s every Device Intelligence route; feature-on still serves them `noindex, nofollow,
noarchive` as public-unlisted, with the three-exemplar procedure limit intact.

**D2B changes the Device Intelligence cohort policy, not the governed preference-card dropdown
policy.** The preserved preference-card and admin catalog surfaces continue to read the full
store through `getCatalogStore()` and behave exactly as before.

### Compatibility and identity leakage

Broadening the cohort makes some compatibility text displayable that D1 withheld. The committed
instance: four Olympus GuideSheath kits whose note reads "…not compatible with BF-MP190F."
`PRD-CB1622624D` (the BF-MP190F scope) is verified-source, so it is now an atlas product with
its own page — and the statement is displayable precisely because the referenced product is
legitimately inside the cohort. The test asserts that permission rather than assuming it.

The C-02/C-03 walls are **unchanged and still armed**. Text that exactly names a candidate-grade,
unknown-grade, or owner-excluded product is still withheld, still fails closed on ambiguity, and
still returns a provenance-only shape carrying no participant text. Measured fact worth
recording: with the D2B cohort, _no_ compatibility row or product note in the committed catalog
names a non-cohort product by exact identifier, so the wall currently withholds nothing. Its
armed-ness is proven by direct assertions on `textReferencesNonCohortIdentity` using a
candidate-grade identifier (`MED-194-NET`), not by a data coincidence.

The launch verifier's identity-leak corpus moved with the cohort: 662 screened tokens covering
only candidate/unknown-grade identities, and 8 manufacturer-qualified short-identifier
composites (down from 17, because 9 of them belong to products D2B now serves deliberately).
The exact-identifier leakage checks were **not** weakened — where a pinned data coincidence
disappeared into the cohort, the assertion moved onto the predicate that owns the rule.

---

## 6. Surfaces

**Index / discovery (compact by design).** One market-status badge per row, plus a safety badge
only when a safety action was actually matched (active, historical, or identity-ambiguous).
`safety_status_unverified` and `no_exact_action_found_as_of_snapshot` are _not_ badged across the
atlas — they would be noise on every row, and neither may read as a clean bill of health. No card
or row carries a warning block, and uncertainty never outweighs the device's name, manufacturer,
kind, or catalog number. The same treatment appears on clinical-role product lists, outside the
link so a link's accessible name stays the product identity.

**Product detail.** A clearly separated "Market and safety status" panel: controlled market
label, research confidence where it means something (confirmed/likely only), the research
snapshot date or an explicit "not covered by the snapshot" statement, the safety statement with
recall numbers and scope where they exist, the recommendation gate with its meaning, and the two
required statements on every product —

> Market status describes distribution evidence recorded at the research snapshot. It does not
> establish present orderability, local availability, formulary status, procurement, or clinical
> suitability.

> Safety notices may be lot-specific: a notice shown here does not necessarily apply to every
> unit or lot of this product.

An active safety action gets a prominent but non-alarmist treatment: its own bordered notice
card with an icon and a heading, above the panel — not a page-wide banner, not an interstitial,
and never at the cost of the product's own description.

**Procedure workspaces.** Hidden verified-source authored options are now identifiable;
candidate/unknown options stay withheld with reconciling counts. Options carry a compact safety
badge when an action matched. Market status is deliberately **not** badged on the dense
requirement cards — availability uncertainty must never read as incompatibility or
ineligibility — and lives on the device page one click away. Canonical `selectable`,
`eligibility_status`, release-pinned compositions, coverage-ladder definitions, and readiness
calculations are unchanged.

**Localization.** All new copy uses controlled `deviceIntelligence.status.*` message keys with
full key and ICU-argument parity across `en`, `es`, and `zh-CN`. Consistent with the rest of the
`deviceIntelligence` namespace — which shipped as English placeholder copy in D1 for this
unlisted preview (302 of 303 keys are identical across the three bundles) — the new keys carry
the same English text in all three locales rather than partially translating one page.

---

## 7. Regenerating

```bash
npm run ip-intel:status-overlay          # write the compact runtime overlay
npm run ip-intel:status-overlay -- --check
npm run ip-intel:d2b-review              # write the review CSV + summary
npm run ip-intel:d2b-review -- --check
```

Both are deterministic and validate before writing.

---

## 8. Future correction

Two levers, in this order:

1. **A wrong admission** → add one row to
   `data/ip-device-intelligence/reviewed/atlas-visibility-exclusions.json` with a controlled
   reason code. Reversing it means deleting the row.
2. **Stale or improved market/safety knowledge** → run a fresh U.S.-status research pass and
   regenerate the overlay. The artifact pins its source SHA-256 and research date, so which
   snapshot produced any given label is always answerable.

Neither lever reintroduces a visibility gate on current availability. If a future change makes
the expanded cohort a build or route-generation problem, the fix is architectural — not a
restoration of the `prototype_visible` conjunct.
