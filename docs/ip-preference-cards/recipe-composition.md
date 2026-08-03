# Composable recipe modules

A procedure is not a recipe any more. It is a **manifest** naming the exact module versions
it is assembled from.

```text
EBUS-TBNA
  = Flexible Bronchoscopy Core v1.0        (required)
  + EBUS-TBNA specific requirements v1.0   (required)
  + Procedural Fluoroscopy v1.0            (default-on, removable)
```

## Why composition and not inheritance

Inheritance would have been less code. It was rejected for three reasons, each of which has
bitten this module before in a different guise:

- **A parent you cannot pin.** Inheritance resolves upward at read time, so "EBUS-TBNA
  inherits from flexible bronchoscopy" means _whatever flexible bronchoscopy is now_.
  Editing the parent would silently change every child and, worse, would change what a
  saved card re-resolves to. A composition names `module-flex-bronch-core-v1-0`, and that
  string is stored in the builder input and hashed into the snapshot.
- **Override channels you cannot audit.** In an inheritance model a child overrides a parent
  member by redeclaring it, and the diff between what the parent said and what the child
  meant lives nowhere. Here a procedure changes an inherited requirement only through a
  `ProcedureCompositionAction` carrying a reason, and the build script fails if an action
  matches nothing.
- **Single inheritance, multiple realities.** Therapeutic flexible bronchoscopy is
  _simultaneously_ a flexible bronchoscopy and a therapeutic airway intervention. It
  references both cores. Endobronchial valve placement references the therapeutic core and
  not the flexible one, because its suction row is structurally different — a fact a class
  hierarchy would have had to lie about.

## Terminology

| Term                          | Meaning                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------- |
| **Recipe module**             | A reusable collection of setup requirements, versioned and governed on its own. |
| **Core module**               | A module shared across more than one procedure.                                 |
| **Procedure-specific module** | The requirements unique to one procedure.                                       |
| **Optional module**           | A selectable module — fluoroscopy, a local workflow.                            |
| **Procedure composition**     | The versioned manifest of which module versions make up a procedure.            |
| **Resolved card**             | The immutable, fully expanded output generated for a user.                      |

A reusable module is never called a "saved card". A saved card is the immutable thing a
user generated and stored; a module is authored input.

## Requirement keys

Every slot carries a `requirementKey`: the stable semantic identity of the requirement it
expresses.

```text
FLEX_BRONCH_VIDEO_PROCESSOR
FLEX_BRONCH_SUCTION_SETUP
THERAPEUTIC_BRONCHOSCOPE_PLATFORM
AIRWAY_RETRIEVAL_FORCEPS
PLEURAL_ULTRASOUND_MACHINE
PROCEDURAL_FLUOROSCOPY_C_ARM
PROCEDURAL_RADIATION_PROTECTION
```

Two rules hold this together:

1. **Keys come from a reviewed file, never from matching.** Membership is authored in
   `data/ip-preference-cards/seed/recipe-module-map.json`. Nothing infers that two slots are
   the same requirement from a shared role code, a similar label, or clinical resemblance.
   Role-code equality is explicitly _not_ evidence — the same role legitimately appears more
   than once on a card, and `GENERIC_SUCTION` means something different on a thoracentesis
   card than on an EBUS card.
2. **A slot nobody curated keys on its own imported id.** A requirement in a wholesale
   procedure-specific module gets `requirementKey = <its slot id>`, which is unique by
   construction, so it can never accidentally merge with anything.

When a requirement moves into a shared module, the imported slot ids it absorbs become
`sourceSlotAliases`. Modifier targeting matches the expanded slot id, the original
`sourceSlotId`, **and** any alias, so a modifier authored before composition keeps landing
without being rewritten. A modifier may also target `targetRequirementKey` directly.

## Version pinning

- A module version is immutable once a composition or a saved card references it.
- A composition references `moduleVersionId` — the exact `module-<code>-v<version>` string.
  Nothing resolves a module by code to "latest" at card-generation time.
- Updating Flexible Bronchoscopy Core means: (1) author `FLEX_BRONCH_CORE` v1.1 in the
  module map, (2) point a new or updated procedure composition version at it, (3) leave
  every other composition and every saved snapshot exactly where it is.

The builder stores `selectedModuleVersionIds` verbatim in `builder_inputs`. It does not
store "the defaults" and recompute them later, so changing which modules are default-on
cannot reach back into a card someone already saved.

A saved card is reopened through its **release bundle**, which pins the exact recipe version,
the exact module versions, and — the part a module version id could never cover — the modifier
set, rescue modules, typed compatibility rules, and role alias table it also resolves through,
each by content hash. A pin that no longer resolves, or whose definitions have been edited
since publication, leaves the card view-only; no other version is substituted for it. See
[`release-bundles.md`](./release-bundles.md) and
[`saved-card-editing.md`](./saved-card-editing.md).

Cards written before release bundles (`builder_inputs.schemaVersion` 2) still reopen through
`buildPinnedContext(scenarioId, recipeVersionId)`, which resolves the recipe by version id
against every composition the generated data retains and returns `recipe_version_unavailable`
when the pin is gone. That path is exact about the recipe and the modules and unpinned below
them, which is everything those cards ever recorded.

Compositions are keyed by `recipeVersionId`, not by procedure code. A map keyed by procedure
was the structural reason a superseded composition could not be kept at all: one procedure, one
entry, and republishing overwrote the definition a saved card was pinned to.

## Resolution order

`resolveCard` runs, in this order:

1. Expand the selected recipe modules.
2. Add direct procedure-specific slots.
3. Apply explicit procedure composition actions.
4. Apply site and location defaults.
5. Apply user-selected modifier actions.
6. Detect modifier conflicts.
7. Append rescue modules.
8. Apply user preference overlays.
9. Resolve hospital-local items.
10. Suppress kit/BOM duplicates.
11. Evaluate quantities.
12. Check room capabilities.
13. Evaluate compatibility rules.
14. Determine resolution states and readiness.
15. Produce the trace.
16. Hash and persist the immutable snapshot.

Steps 1–3 are `domain/expand-recipe-composition.ts`, a pure function. Everything from step 4
down sees one flat effective recipe and does not know composition exists. No LLM, fuzzy
match, or automatic clinical inference participates at any step.

### Setup order

**The procedure owns the setup order, not the modules.** Each generated composition carries
`requirementSequences`, a map from `requirementKey` to the position that procedure's reviewed
template gave the line — generated from `procedure-slots.json`'s own `display_order`, so it is
the sequence a clinician signed off on rather than anything the composition invented.
`effectiveSetupSequence` uses that number verbatim.

A module can only author the order of its requirements _within itself_, which is the one
order it cannot generalize: the flexible core has no idea whether a therapeutic
bronchoscopy wants suction before or after a cryoprobe it has never heard of. The procedure
does. This is why `FLEX_BRONCH_SUCTION_SETUP` — one requirement, defined once — is eleventh
on an EBUS card and third on a therapeutic bronchoscopy card.

Only a requirement the procedure never placed falls back to the module band:

```
UNPLACED_REQUIREMENT_SEQUENCE_BASE (10 000) + moduleOrdinal × 1 000 + slot.setupSequence
```

That is an optional module offered on a procedure whose template never listed it — nobody
authored where it goes, so it lands after everything that was authored, grouped by module and
keeping that module's internal order. The custom module composition, which has no procedure
template at all, takes this path for every line.

`moduleOrdinal` is the module's **position among the included modules**, not its authored
reference sequence. Reference sequences only have to be distinct and ascending, and the custom
composition spaces nineteen of them out to 190 — banding on the raw value would push a late
module's lines past 200 000. Modifier- and rescue-added lines start at
`OPERATIONAL_SLOT_SEQUENCE_BASE` (100 000), so that would have sorted a contingency line into
the middle of the card. An ordinal is bounded by the module count and gives the same relative
order.

**Why this is written down.** The first composition pass sorted primarily by the contributing
module, and the result was clinically wrong in a way nothing caught: an EBUS card opened with
the video processor and the linear EBUS bronchoscope — first on the reviewed template — sat
third; the EBV card promoted the retrieval forceps, a contingency line, to second. The golden
fixtures pinned counts, readiness, and a content hash, so the whole reordering arrived as four
new hashes and no failing test. `goldenScenarioItemOrder` in
`__fixtures__/golden-scenario-expectations.ts` now pins the intended item order for EBUS-TBNA,
therapeutic flexible bronchoscopy, and EBV as an explicit list, and `resolve-card.test.ts`
asserts it. A hash proves a card did not change; it cannot say the card is right.

## Explicit conflict behaviour

When two selected modules produce the same `requirementKey`:

- **Identical clinical definitions** → one effective requirement, carrying provenance from
  both. The merged slot unions `sourceSlotAliases` and `sourceModuleVersionIds`, takes the
  earlier `setupSequence`, and reads
  `Included by Flexible Bronchoscopy Core v1.0 and <the other module>`.
- **Any difference** → a blocking `recipe_composition_conflict` naming both modules and the
  fields that differ. The earlier module's definition stands and the card is blocked; the
  later module never silently wins.

"Clinical definition" is `roleCode`, `label`, `genericRequirement`, `requiredness`,
`dependencyRule`, `quantityExpression`, `selectionMode`, `setupZone`, `proceduralPhase`,
`openHoldStatus`, `responsibleRole`, `sterileStatus`, `allowCustom`, and `notes`. Identity
and provenance fields are excluded, as is `setupSequence` — where a line sits is
presentation, and a merge takes the earlier of the two.

Other blocking composition messages: `recipe_composition_invalid` (a module referenced
twice), `recipe_composition_module_missing`, `recipe_composition_unknown_module` (a
selection the composition does not offer), and `retired_module_selected`. An action that
matches nothing raises the warning `recipe_composition_action_unmatched`.

## Composition actions

The only channel by which a procedure changes an inherited requirement:

| Action                                                             | Payload                      |
| ------------------------------------------------------------------ | ---------------------------- |
| `remove_slot`                                                      | —                            |
| `set_requiredness`                                                 | `{ value, dependencyRule? }` |
| `set_quantity`                                                     | `{ expression }`             |
| `set_setup_zone` / `set_procedural_phase` / `set_open_hold_status` | `{ value }`                  |
| `append_note`                                                      | `{ note }`                   |

`set_requiredness` carries the dependency rule with it on purpose. Requiredness and the
condition text a reader needs to act on it are one clinical statement; splitting them is how
a card ends up conditional with nothing saying on what.

Each action targets `targetRequirementKey`, `targetSlotId` (expanded id, imported id, or
alias), or `targetRoleCode`, and is applied in `(sequence, id)` order. Every action carries
a `reason` in the seed file.

## Governance

The composed output never reads stronger than its weakest component:

```text
effective = min(recipe, …selected modules)   over retired < draft < in_review < approved
```

- One draft module keeps the whole card draft, whatever the recipe says.
- A retired module raises a blocking `retired_module_selected` and drags the effective state
  to `retired`.
- The `prototype` flag follows the effective state, so a card assembled from a draft module
  keeps its watermark.
- The composition manifest carries each component's own `governanceState`, and the
  administrative recipe view shows it per module.

## Migration strategy

Generated import artifacts are the source of truth and are never hand-edited.
`data/ip-preference-cards/generated/procedures.json` and `procedure-slots.json` stay exactly
as the workbook import wrote them. Composition is authored beside them:

```text
data/ip-preference-cards/seed/recipe-module-map.json        which slots belong to which module
data/ip-preference-cards/seed/procedure-compositions.json   which module versions each procedure uses
scripts/ip-preference-cards/build-recipe-compositions.ts    npm run ip-cards:compositions
data/ip-preference-cards/generated/recipe-modules.json               ← generated
data/ip-preference-cards/generated/procedure-compositions.json       ← generated
data/ip-preference-cards/generated/recipe-composition-report.json    ← generated
```

The build script is the migration's proof. Every one of these is a hard error, never a
silent skip:

- a requirement naming a slot the import does not have;
- two requirements claiming the same imported row (checked in a first pass across all
  modules, so a collision reports as itself rather than as whichever field differs);
- one requirement key defined by two modules;
- absorbing a row whose `selection_mode`, `default_qty`, `allow_custom`, or `section`
  differs from the definition — a structural difference is not a wording difference;
- a `requiredness` or `dependency_rule` difference that no `set_requiredness` action
  restores;
- a composition action matching nothing;
- a composition that drops an imported slot, or that adds a requirement its imported
  template never had;
- a procedure with no composition, or a module no composition references.

The last two coverage rules are what makes "every existing procedure remains buildable"
provable rather than hopeful: for every procedure, the set of imported rows covered by its
default module selection must equal its imported slot set exactly.

Procedures with no clinically reviewed core mapping get a wholesale procedure-specific
module holding their existing slots, so their cards are preserved byte-for-byte. Guessing
which of their requirements belong in a shared core is exactly what this file forbids.

## How to create a new reusable module

1. Add a module to `recipe-module-map.json` with `code`, `version`, `name`, `kind`,
   `description`, `governanceState`, and either `requirements` or
   `remainingSlotsFromProcedure`.
2. For each shared requirement give a `requirementKey`, the `definitionSourceSlotId` whose
   content the module carries, any `sourceSlotAliases` it absorbs, a `sequence`, and a
   `reason`.
3. Reference it from the procedures in `procedure-compositions.json` with a
   `selectionBehavior` and a `sequence`.
4. Restore every behavioural difference between the absorbed rows with a composition action
   carrying a reason.
5. Run `npm run ip-cards:compositions` and read the report. If it throws, the mapping is
   claiming something it has not earned.
6. Run the suite. `build-recipe-compositions.test.ts` re-runs the build and requires it to
   reproduce the committed generated files byte-for-byte.

## How a procedure adopts a new module version

1. Author the new module version alongside the old one — both may exist at once.
2. Author a new `recipeVersionId` for that procedure, referencing the new `moduleVersion`, and
   keep the old composition entry.
3. Publish a release bundle for the new recipe version and advance the pointer. See
   [`release-bundles.md`](./release-bundles.md).
4. Rebuild. Every other procedure still pins the old version and its card does not move.
5. Saved snapshots never move at all: they carry their own `includedModules` manifest and
   their hash addresses it.

Step 2 currently has a limitation worth knowing before you start: the build requires every
declared module version to be referenced by some composition, so a _superseded_ module version
cannot yet be retained after the last composition stops referencing it. Retaining a superseded
**recipe** version works today.

## What composition is not

This is a card-building tool. Nothing here recommends a module based on patient
characteristics, and no module is selected for the user by inference. The builder shows the
authored module description, its governance state, and its compatibility warnings, and the
user decides.
