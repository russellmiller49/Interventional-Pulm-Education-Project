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

Honest scope. Each was identified by the audit, is outside this phase, and is written down so
it is not mistaken for something already handled.

1. **Version-2 cards are not release-pinned, and are not converted.** A card written before
   release bundles pins its recipe version and module versions exactly, and resolves the four
   whole-set dependencies from whatever is current. Backfilling a `releaseBundleId` would
   assert those cards were resolved against content nobody verified at save time, so they are
   re-saved as version 2 and the limitation is stated instead. See
   `BUILDER_INPUTS_SCHEMA_VERSION`.
2. **`availableModifierCodes` is authored governance the server never enforces.**
   `rebuildBuilderContext` rejects a module the composition does not offer but accepts any
   modifier code. Symmetry would move it into category 1.
3. **The hospital-local layer holds implicit authority.** A requirement with no explicit
   selection takes `options[0]`, so the resolved item depends on preference-rank ordering that
   the card never recorded.
4. **`familyKey` is a computed identifier that saved cards store verbatim**, so a change to
   its derivation orphans a stored family pick.
5. **The snapshot hash is broad and format-unversioned.** It covers `ruleTrace` prose and the
   site/location display names, so hash churn is routine and therefore uninformative.
6. **Nothing compares a re-resolution against the stored snapshot.** Save overwrites
   `card_snapshot` and `snapshot_hash` without reporting that the content moved.
7. **A superseded _module_ version cannot yet be retained in production.** Bumping a seed
   module's version mints a new id, but the build then fails the module with "declared but
   referenced by no composition". Retaining a superseded recipe version works today; retaining
   a superseded module version needs that coverage rule relaxed to the pointed-to composition.
