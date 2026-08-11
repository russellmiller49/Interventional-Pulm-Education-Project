# F-33 — THERAPEUTIC_BRONCH procedure/scenario naming reconciliation

**Status: OWNER NAMING DECISION REQUIRED — no governed name was changed in this pass.**

Two names currently describe the same D1 workspace, and they are not synonyms:

- `procedures.json` names the **procedure**: `Therapeutic flexible bronchoscopy`.
- The scenario, recipe, and composition name the **clinical scenario**:
  `Central airway obstruction / tumor debulking`.

## Every naming surface, verbatim

| Surface                             | File / mechanism                                                                                                                                                 | Current value                                                                              | Depends on text or stable id?                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Procedure code                      | `generated/procedures.json`                                                                                                                                      | `THERAPEUTIC_BRONCH`                                                                       | stable id                                                                                                           |
| Procedure name                      | `generated/procedures.json` `procedure_name`                                                                                                                     | `Therapeutic flexible bronchoscopy`                                                        | text (workbook-imported)                                                                                            |
| Scenario id                         | `generated/scenarios.json` `id`                                                                                                                                  | `central-airway-obstruction`                                                               | stable id (from `seed/scenario-overrides.json` override)                                                            |
| Scenario title                      | `seed/scenario-overrides.json` → `generated/scenarios.json` `title`                                                                                              | `Central airway obstruction / tumor debulking`                                             | text                                                                                                                |
| Recipe name                         | `seed/scenario-overrides.json` `recipeName` → `generated/scenarios.json` → frozen into `generated/procedure-compositions.json` `recipeName` at composition build | `Central airway obstruction / tumor debulking`                                             | text, **frozen into `recipeDefinitionHash`** — changing it requires a new recipe version + release                  |
| Composition identity                | `generated/procedure-compositions.json` (`recipe-therapeutic-bronch-v0-2`)                                                                                       | `recipeName: Central airway obstruction / tumor debulking`                                 | pinned by release `release-therapeutic-bronch-v1-1`                                                                 |
| Module names                        | `seed/recipe-module-map.json`                                                                                                                                    | `Therapeutic flexible bronchoscopy specific requirements`, `Therapeutic Bronchoscopy Core` | text, inside module definition hashes                                                                               |
| D0 audit name                       | `docs/ip-device-intelligence/data-readiness-audit.json` `name`                                                                                                   | `Therapeutic flexible bronchoscopy` (from `procedures.json`)                               | regenerated                                                                                                         |
| Builder name                        | Preference-card builder scenario picker                                                                                                                          | scenario `title` (`Central airway obstruction / tumor debulking`)                          | text                                                                                                                |
| D1 workspace H1                     | `/en/procedures/THERAPEUTIC_BRONCH` (`procedures.server.ts` `procedureName`)                                                                                     | `Therapeutic flexible bronchoscopy`                                                        | from `procedures.json`                                                                                              |
| D1 scenario row                     | same page, overview list                                                                                                                                         | `Central airway obstruction / tumor debulking`                                             | from scenario                                                                                                       |
| Analytics identity                  | D1 pages emit procedure/scenario ids, not names                                                                                                                  | `THERAPEUTIC_BRONCH` / `central-airway-obstruction`                                        | stable ids — unaffected by any rename                                                                               |
| Saved-card / historical identifiers | `recipeName` lands in the resolved card and inside `snapshotHash` / `resolvedContentHash`; release bundles pin it via `recipeDefinitionHash`                     | `Central airway obstruction / tumor debulking`                                             | **text-bearing** — any rename requires a forward recipe version + release; published v1-0/v1-1 content is immutable |

## Bounded owner choices

**A (recommended — lowest information-architecture risk).** Keep the procedure umbrella
`Therapeutic flexible bronchoscopy` and render `Central airway obstruction / tumor debulking`
explicitly as the scenario subtitle under the H1 ("Scenario: …"). No governed rename; the fix
is presentational labeling that names the relationship instead of leaving two unexplained
titles. Historical identifiers untouched; the audit, procedures.json, and every release stay
as they are.

**B.** Narrow the procedure name to the scenario concept (rename `procedure_name` to
`Central airway obstruction / tumor debulking`). Cost: the procedure umbrella is genuinely
broader than one scenario (the template also carries dilation, stent, retrieval, cryo
pathways); the workbook-imported `procedure_name` would need a governed correction mechanism
(none exists today for `Procedures` rows — the same gap `procedure-template-corrections`
closed for slot rows); the audit and every name-bearing surface would move.

**C.** Keep both names but retitle the scenario/recipe to subordinate wording built only from
existing authored concepts, e.g. scenario title `Therapeutic flexible bronchoscopy — central
airway obstruction / tumor debulking`. Cost: a recipe retitle is a content change under
`recipeDefinitionHash`, so it requires recipe v0-3 + release v1-2 for THERAPEUTIC_BRONCH; the
title also gets long in the builder picker.

**Recommendation:** Option A, because it is the only choice that resolves the reader-facing
ambiguity without renaming governed identity that published releases pin. Marked
**OWNER DECISION REQUIRED** — no change was applied in this pass.
