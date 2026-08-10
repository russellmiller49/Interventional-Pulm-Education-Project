# D1.1 — governed-data corrections from the physician-owner review (2026-08-09)

This pass applies the deterministic governed-data corrections from
[owner-review-findings.md](../d1-review/owner-review-findings.md) — the items
[owner-review-dispositions.md](../d1-review/owner-review-dispositions.md) §3 deferred to the
owner data pass — as forward-versioned releases, and packages the remaining authoring
decisions for the physician owner. Nothing published was mutated; every v1-0 release is
retained and still reconstructs its original semantics.

## Status table

| Finding                             | Status                                                                                                               | Source-of-truth change                                                                                                                                                                                 | Generated effect                                                                                                                          | Release effect                                                                                                         | Owner action                               |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| F-04 sampling instruments           | **APPLIED**                                                                                                          | Per-slot `set_setup_zone` / `set_procedural_phase` composition actions in `seed/procedure-compositions.json` (EBUS_TBNA ×4 slots, THERAPEUTIC_BRONCH ×2)                                               | New recipe versions expand the six instruments at back_table / diagnostic; every projection (workspace, room, nursing, training) inherits | `release-ebus-tbna-v1-1`, `release-therapeutic-bronch-v1-1`                                                            | none                                       |
| F-05 drainage phase                 | **APPLIED**                                                                                                          | `seed/section-zone-phase-map.json` `Drainage` → `pre_induction_or_sedation`                                                                                                                            | 10 slots across 4 procedures re-phase; dressing/securement stays post-procedure                                                           | `release-chest-tube-v1-1`, `release-thoracentesis-v1-1`, `release-ipc-placement-v1-1`, `release-med-thoracoscopy-v1-1` | none                                       |
| F-06 IPC template move              | **APPLIED** (owner option (a))                                                                                       | New governed removal overlay `reviewed/procedure-template-corrections.json` removes the four CHEST_TUBE IPC rows; IPC_PLACEMENT already carried each role exactly once with byte-identical option sets | CHEST_TUBE 13 → 9 slots; divergent-pathway presentation deactivates by its own data gate                                                  | `release-chest-tube-v1-1`                                                                                              | none                                       |
| F-09 APC rigid applicator           | **BLOCKED — see [f09-blocker.md](./f09-blocker.md)**                                                                 | none (deliberately)                                                                                                                                                                                    | none                                                                                                                                      | none                                                                                                                   | decide on the retention mechanism proposal |
| F-10 flex-core bite block / adapter | **APPLIED**                                                                                                          | 3 reviewed template rows (`reviewed/procedure-additions.json`, copied verbatim from governed precedent rows); `FLEX_BRONCH_CORE` v1.1 in `seed/recipe-module-map.json`                                 | EBUS 15 → 17 and THERAPEUTIC_BRONCH 29 → 30 slots; both consumers expand exactly one bite block + one adapter, dependency rules intact    | `release-ebus-tbna-v1-1`, `release-therapeutic-bronch-v1-1`                                                            | none                                       |
| F-21 field split                    | **OWNER AUTHORING DECISION** — [f21-selection-guidance-review-packet.md](./f21-selection-guidance-review-packet.md)  | none                                                                                                                                                                                                   | none                                                                                                                                      | none                                                                                                                   | disposition 135 rows                       |
| F-30 responsibleRole                | **OWNER AUTHORING DECISION** — [f30-responsible-role-authoring-queue.md](./f30-responsible-role-authoring-queue.md)  | none                                                                                                                                                                                                   | none                                                                                                                                      | none                                                                                                                   | fix the vocabulary, then author 234 rows   |
| F-33 naming                         | **OWNER NAMING DECISION** — [f33-therapeutic-bronch-naming-decision.md](./f33-therapeutic-bronch-naming-decision.md) | none                                                                                                                                                                                                   | none                                                                                                                                      | none                                                                                                                   | choose option A/B/C                        |

Related documents: [before-after.md](./before-after.md) (baseline and result evidence),
[audit-diff.md](./audit-diff.md) (semantic classification of every D0-audit change),
[release-impact.md](./release-impact.md) (requirement-level release ledger and the one known
reporting gap), [f09-blocker.md](./f09-blocker.md) (the exact F-09 versioning blocker and the
smallest forward-compatible mechanism).

## New retention mechanism: the composition ledger

The corrections could not be expressed under the previous machinery: superseding a recipe
version removes its composition from the seed, the seed cannot retain the old entry (it would
be validated against the _current_ template and module map, both of which the new version
exists to change), and `build-release-bundles` refuses to run when a published release's
recipe no longer resolves. This is the exact gap `module-ledger.json` closed for module
versions, one level up.

`generated/composition-ledger.json` closes it the same way: every recipe version a published
release pins is copied in once, verbatim (as the `RecipeVersion` the release hashed into its
`recipePin`), append-only, validated on every release build (`validateCompositionLedger`:
entry-hash integrity, live-divergence, pinned-version-present), and consulted by
`recipeForRecipeVersionId` only after live data misses. The custom module composition — whose
recipe is derived from the current module set and therefore moves whenever a module
republishes — versions forward through the same ledger (`recipe-custom-composition-v1-0`
retained, `-v1-1` current).

## AABIP unlisted-beta launch gate

- F-04 corrected: **yes for the D1 exemplar releases** — the six owner-named sampling
  instruments resolve to back_table / diagnostic in the current EBUS and therapeutic
  releases; specimen handling stays at the bench. Named residual: the custom module
  composition has no action channel, so the custom-card builder pathway retains the
  pre-correction zones (see the owner follow-ups in
  [release-impact.md](./release-impact.md)). No D1 route is affected.
- F-05 corrected: **yes** — the Drainage section is phased pre-induction in every affected
  procedure; dressing remains post-procedure. Named ripple for owner confirmation: two
  MED_THORACOSCOPY insertable-device rows sit in section Drainage and moved with it (see
  the owner follow-ups in [release-impact.md](./release-impact.md)).
- F-09: **safely blocked** — no history was mutated; the exact blocker and the smallest
  forward-compatible mechanism are documented for the owner.
- F-10 corrected: **yes** — every flexible-core consumer inherits the bite block and airway
  adapter with the existing governed dependency rules.
- CHEST_TUBE IPC contamination corrected: **yes** — the template is 9 requirements of acute
  chest-tube insertion; IPC equipment lives only on IPC_PLACEMENT.
- F-21 / F-30 / F-33: **presentation/authoring follow-ups with owner packets** — none is a
  hidden runtime workaround; the interim presentations remain the honest ones shipped in D1.
- Production flag: **`NEXT_PUBLIC_ENABLE_DEVICE_INTELLIGENCE` remains unset.** Nothing in
  this pass touches navigation, sitemap, indexing, or exposure.

**Verdict: READY FOR OWNER LAUNCH DECISION** — with F-09 carried as a known,
safely-blocked data defect (the rigid APC applicator still reads `required` under the APC
modifier; the readiness projection masks it only in the demo scenario because RIGID_AIRWAY is
co-selected). If the owner considers F-09 launch-critical for the unlisted beta, the decision
packet in [f09-blocker.md](./f09-blocker.md) is the gating item.
