# Dependency closure

Every source-controlled input that can change what a saved preference card resolves to, and
which of four categories it belongs in.

The question each row answers is narrow and mechanical:

> Can a source-controlled edit to this change what an **already-saved** card re-resolves to,
> while its stored `recipeVersionId` and `selectedModuleVersionIds` stay byte-identical?

If yes, the card was not exactly version pinned, whatever the pin was called.

## Categories

| #   | Category                             | Rule                                                                                        |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| 1   | **Immutable release content**        | Authored clinical content. Must be versioned, hashed, and pinned by a release bundle.       |
| 2   | **Independently versioned external** | Catalog and resolver. Identified by a stable release id; movement is reported, not blocked. |
| 3   | **Hospital-local current**           | Intentionally _not_ pinned. A card must reconstruct against the room as it is today.        |
| 4   | **Presentational**                   | Cannot reach `resolveCard`. Pinning it would force republication for a dashboard label.     |

## Category 1 — pinned by `PreferenceCardReleaseBundle`

| Dependency                     | Where                                                                                              | Pin                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------- |
| Procedure composition          | `generated/procedure-compositions.json` ← `seed/procedure-compositions.json`                       | `recipeDefinitionHash`        |
| `requirementSequences`         | same, derived from `procedure-slots.json` `display_order`                                          | `recipeDefinitionHash`        |
| Composition actions            | same                                                                                               | `recipeDefinitionHash`        |
| Recipe identity                | `recipeName`, `recipeVersion`, `sourceTemplateVersion`, `governanceState`, `clinicalOwner`         | `recipeDefinitionHash`        |
| Recipe module versions         | `generated/recipe-modules.json` ← `seed/recipe-module-map.json`, `section-zone-phase-map.json`     | `modulePins[].definitionHash` |
| Modifier definitions + actions | `seed/operational.ts` `operationalModifiers` **merged over** `generated/modifier-definitions.json` | `modifierSetPin`              |
| Rescue modules                 | `seed/operational.ts` `rescueModules`                                                              | `rescueModuleSetPin`          |
| Typed compatibility rules      | `seed/operational.ts` `typedCompatibilityRules`                                                    | `compatibilityRuleSetPin`     |
| Role aliases and categories    | `domain/role-taxonomy.ts`                                                                          | `roleTaxonomyPin`             |

Four of these — modifiers, rescue modules, compatibility rules, and the role table — reached
`resolveCard` from **module-level TypeScript constants with no version of any kind**. Editing a
compatibility rule's `severity` changed the readiness state of every saved card in the system,
with every recipe and module pin untouched. That is the gap this phase closes.

`recipeName` is in the list because it is generated from `scenarios.json`, lands in the
resolved card, and is inside the snapshot hash — so a scenario retitle really did move a saved
card's identity. It is now frozen into the composition at build time rather than reassembled
at read time.

**Verified, not assumed.** The audit behind this table executed the failure: with
`recipeVersionId` and `selectedModuleVersionIds` held byte-identical, flipping
`FLEX_BRONCH_SUCTION_SETUP` from `required` to `optional` inside `module-flex-bronch-core-v1-0`
changed the EBUS-TBNA card's `effectiveRequiredness` and its snapshot hash
(`e7a086475ee5583b` → `9072da8f607572aa`), and did the same to therapeutic bronchoscopy.
Deleting the slot removed a printed line silently.

## Category 2 — independently versioned, identified not pinned

| Dependency        | Identified by                           | On mismatch                                    |
| ----------------- | --------------------------------------- | ---------------------------------------------- |
| Catalog release   | `catalogImportId` on the bundle         | `release_catalog_import_advanced` (warning)    |
| Resolver contract | `resolverContractVersion` on the bundle | `release_resolver_contract_advanced` (warning) |

Both sit **outside** `definitionHash`. The reasoning is recorded in code, in
`RELEASE_BUNDLE_HASH_EXCLUSIONS`, so it is reviewable rather than folklore.

**The catalog id used to name the wrong object.** It was `import-report.json`'s
`workbook_sha256` — the digest of the source _workbook_. But `apply-catalog-additions`,
`apply-product-overrides`, `apply-role-taxonomy`, and the external-review remediation overlay
all rewrite product identity, role mappings, and slotting governance downstream of the import.
Each can change whether a saved card's pick still resolves; none of them moves the workbook
digest. `catalogImportId` is now a content digest over `catalog-products.json`,
`product-roles.json`, and `roles.json` (see `scripts/ip-preference-cards/catalog-release-id.ts`).
`RecipeVersion.catalogImportId` still carries the workbook digest — that one is provenance,
printed on the card, and answers a different question.

**The resolver is code and cannot be retained.** Pretending an older engine could be
reconstituted would be a lie, so it is declared instead: every bundle records the contract it
was published against, and `release-bundle-integrity.test.ts` hashes the eight resolver source
files and fails when they change without `PREFERENCE_CARD_ENGINE_VERSION` changing. The version
string was previously a hand-typed literal that nothing compared to anything.

## Category 3 — hospital-local, intentionally current

`demoHospitalItemSeeds`, `hospitalItems`, `hospitalRoleOptions`, `locationCapabilities`, the
organization/site/location names, and `preferenceOverlays`.

These are rule-bearing — `locationCapabilities` produces blocking `require_room_capability`
messages, and local verification state drives readiness — and they are deliberately **not**
pinned. Whether the room has jet ventilation is a fact about the room, not a clause in a
reviewed recipe, and a card that resolved `blocked` last year should not keep saying so after
the equipment arrived.

The boundary is enforced, not just described: `RELEASE_PINNED_CONTEXT_FIELDS` and
`HOSPITAL_LOCAL_CURRENT_CONTEXT_FIELDS` in `domain/release-bundle.ts` are exhaustive over
`BuildContext` at the type level, so adding a context field without deciding which side it
belongs on does not compile.

## Category 4 — presentational

`scenarios.json`'s `title`, `shortDescription`, `owner`, and its nine coverage/count fields;
`slot-product-options.json`, `gudid-*`, `sources.json`, `product-sources.json`,
`manufacturers.json`, `coverage-report.json`, `verification-backlog.json`; the admin views;
the golden fixtures and `PROTECTED_FILE_HASHES` (CI tripwires, not resolver inputs).

`defaultModifierCodes` is here because it applies only when there is no saved input — a
reopened card restores its own `modifierCodes`.

## Known gaps, named rather than closed

Honest scope. Each is written down so it is not mistaken for something already handled.

**Closed in Phase 4A:**

1. ~~Version-2 cards are not release-pinned~~ — they are now **view-only**. They still view,
   print, share, and duplicate; the builder is closed to them, and `saveCardRequestSchema`
   refuses to write at a superseded version. `rebuildBuilderContext` requires a release pin, so
   the weaker reconstruction path is gone rather than merely unused.
2. ~~`availableModifierCodes` is authored governance the server never enforces~~ — it is now
   `RecipeVersion.allowedModifierCodes`, inside `recipeDefinitionHash`, enforced by
   `rebuildBuilderContext` and applied by building the context from permitted modifiers only.
3. ~~The hospital-local layer holds implicit authority~~ (the `options[0]` half) — selections
   are materialized from the **resolved preview** into `selectedHospitalItemIds`, and
   `selectionsAreExplicit` turns off the fallback. A re-ranked formulary no longer changes what
   a saved card asks for.
4. ~~A superseded module version cannot be retained~~ — `module-ledger.ts` freezes every
   published module version, the composition build accepts retained-but-unreferenced versions,
   and mutating or deleting a ledger entry fails validation.
5. ~~The resolver contract is a hand-typed literal nothing compares~~ — split into a semantic
   `resolverContractVersion` (asserted behaviourally) and a provenance
   `resolverImplementationHash` (recorded, reported, never a support boundary).

**Still open:**

6. **`familyKey` is a computed identifier that saved cards store verbatim.** Replacing it with
   a stable `productFamilyId` is designed but **not implemented**, and deliberately so: today's
   derivation already over-merges. `MFR-E3F284CAE2|thoracentesis catheter|candidate` holds both
   the Safe-T-Centesis 6 Fr Tray and the Safe-T-Centesis PLUS Tray;
   `MFR-90D85DB52E|surgical chest tube|candidate` holds eight Argyle catheters spanning
   16–36 Fr. Minting permanent ids from that would freeze a **clinically wrong grouping** into
   card identity, and un-merging it later would be the migration this phase forbids. The
   grouping needs clinical review first. See the Phase 4A report.
7. **Historical catalog retention is designed but not implemented.** The identity fix landed
   (`catalogImportId` is a content digest over the artifacts the resolver reads), but there is
   no per-release frozen catalog artifact, so an old card's product identity still comes from
   the current catalog. Design: a content-addressed row store plus a thin per-release manifest
   (~531 KB once, then 2–90 KB per release), not a 3 MB copy per release.
8. **The snapshot hash is broad and format-unversioned**, and is not yet split into
   `snapshotIntegrityHash` and `resolvedContentHash`. It still covers `ruleTrace` prose and the
   site/location display names, so hash churn remains routine and therefore uninformative.
9. **Nothing compares a re-resolution against the stored snapshot.** Save overwrites
   `card_snapshot` and `snapshot_hash` without reporting that the content moved.
10. **A missing or inactive pinned local item does not yet raise a reconciliation warning.** It
    resolves to "nothing selected", which is honest and visible but not the explicit
    reconciliation state Phase 4A asks for.
