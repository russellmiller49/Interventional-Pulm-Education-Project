# Current U.S. status evidence methodology

This dated research package is proposal-only. It changes no canonical product, visibility, verification, selectability, role, compatibility, formulary, release, or feature-flag data.

## Cohort

The package evaluates 50 products selected from the deterministic hidden-product manifest. Hidden verified-source products are current-U.S.-status pending; hidden candidate and unknown products remain identity/specification pending.

## Two independent axes

Market/distribution status and FDA safety-action status are separate axes and are never substituted for one another.

- A safety action (recall) is **not** discontinuation evidence. It never moves a product to `not_currently_distributed_supported` and never changes `current_us_distribution_supported`. This is enforced by the `recall_excluded_from_distribution` invariant, and the distribution invariant audit is deliberately blind to safety evidence.
- A safety action **can** hold ordinary prototype-visibility review. A product under an active exact FDA safety action keeps its distribution state and receives `keep_hidden_pending_active_safety_action_review` instead of `review_for_prototype_visibility`.
- A lot-limited action is recorded as `lot_specific`. That does not mean every unit of the product is recalled, that the product is unsafe product-wide, or that it left the market.

## Evidence hierarchy

Exact identity is required before a current-status conclusion. UDI/GUDID distribution, registration/listing, marketing authorization or exemption, official manufacturer U.S. evidence, and FDA safety actions remain separate layers. A registration/listing is not approval, historical authorization is not current distribution, and a recall is not discontinuation evidence. Website absence is never a negative finding.

## Current-distribution evidence policy

A current exact manufacturer webpage or document is **not** mandatory for `current_us_distribution_supported`. The state is anchored on the FDA's own current commercial-distribution record for the exact device. A product may receive it when product identity is exact; a current exact GUDID configuration reports in commercial distribution; the GUDID snapshot is current; all relevant exact configurations were retrieved; there is no mixed or ended configuration conflict; and there is no affirmative discontinuation or other material distribution conflict. The independent invariant audit must also pass.

Confidence is a separate question from the state:

- **high** — a second exact current source corroborates the GUDID evidence: an exact current FDA registration/listing, or an exact current official manufacturer U.S. source.
- **moderate** — current exact GUDID distribution evidence and reliable exact identity, with no second exact current source.

There is no low-confidence variant of the supported state. A product whose evidence does not reach moderate stays in an unresolved research state instead.

A manufacturer document may establish exact identity and configuration without establishing current distribution; that is recorded as `exact_identity_only_not_current` and is never admitted as current-distribution evidence. Current distribution is also not present orderability: no proposal claims that a product can be ordered today, and every positive carries an explicit open question about it.

Potential negatives require affirmative exact evidence, completed manufacturer research, no current conflict, and the same independent audit.

An invariant failure that reports missing evidence rather than contradictory evidence returns the product to an unresolved state; only a genuine source conflict is reported as `current_status_conflicted`.

## Mandatory safety gate

Neither `review_for_prototype_visibility` nor `review_as_not_currently_distributed` may be proposed until the FDA safety-action search has completed for the exact identity and has left no exact active action outstanding. The safety search reads two official FDA systems, `device/enforcement` and `device/recall`; a disagreement between them about whether the same action is still open resolves to `unknown` and holds review rather than picking a side.

A safety action is tied to a product only through an exact governed identifier (catalog/REF number, or a DI of the exact device including its package configuration). Evidence linked only by shared clearance or family name is recorded as `family_or_ambiguous_action` and never presented as an exact-product action. A completed search that finds nothing exact is `no_exact_action_found`; a search that did not run or failed stays `not_searched`/`query_error` and can never be reported as an absence.

A historical (terminated) exact action is retained as safety context and does not by itself block ordinary review.

## Results

- current U.S. distribution supported: 0
- not currently distributed supported: 0
- historically authorized, current status unresolved: 0
- current status conflicted: 3
- identity unresolved: 24
- insufficient evidence: 22
- not applicable noncommercial/local: 1
- products with query errors: 6

### Safety-action search

- searched: 42
- not searched: 8
- query error: 0

### Safety-action state

- active exact product action: 7
- historical exact product action: 0
- family or ambiguous action: 1
- no exact action found: 34
- unknown: 8
- products with an exact-product safety record: 7

### Visibility-review eligibility

- eligible for owner review: 0
- hold, active safety action: 0
- hold, safety search incomplete: 0
- hold, safety identity ambiguous: 0
- not applicable: 50

### Proposed human-review dispositions

- review for prototype visibility: 0
- review as not currently distributed: 0
- keep hidden pending active safety-action review: 0
- keep hidden pending safety review: 0
- keep hidden conflicting: 3
- keep hidden identity unresolved: 24
- keep hidden insufficient evidence: 22
- review as noncommercial/local: 1

Every output row has `canonical_change_applied: false`. The clinician-review CSV contains blank reviewer and second-review fields and has no applying importer or endpoint.
