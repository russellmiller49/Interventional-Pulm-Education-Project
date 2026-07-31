# IP preference-card deterministic rule engine

The resolver is implemented as pure TypeScript under `src/features/preference-cards/domain/`. React components display its output but do not contain the clinical equipment-selection logic.

## Resolution order

1. Expand the selected recipe modules.
2. Add direct procedure-specific slots.
3. Apply explicit procedure composition actions.
4. Apply site and location defaults.
5. Apply active modifier actions by explicit sequence.
6. Detect mutually exclusive modifiers and replacement collisions.
7. Append reusable rescue modules.
8. Apply targeted user overlays.
9. Resolve each role to a ranked hospital-local option.
10. Suppress true kit/BOM duplicates.
11. evaluate literal quantity expressions;
12. check room capabilities;
13. evaluate manually curated typed compatibility rules;
14. assign item resolution states;
15. calculate card readiness;
16. produce a human-readable trace;
17. hash and, when authorized, persist the immutable snapshot.

Steps 1–3 are `domain/expand-recipe-composition.ts`, a pure function; everything below step
3 sees one flat effective recipe. No `eval`, LLM, fuzzy product matching, or automatic
substitution participates in resolution — and no requirement is ever deduplicated by role
code, label similarity, or clinical resemblance. Two requirements are the same requirement
only when a reviewed mapping gave them the same `requirementKey`; see
[`recipe-composition.md`](./recipe-composition.md).

The final item order is a single sort on `setupSequence`, and that number is the reviewed
template's own position for the requirement — never the module that contributed it. A card
sorted by contributing module is sorted by an assembly detail nobody authored. See
[Setup order](./recipe-composition.md#setup-order).

Engine version `ip-cards-resolver/0.2.0`. The hashable domain output gained the composition
manifest (`includedModules`) and each item's `requirementKey` and source modules, so 0.1.0
snapshots hash differently by construction.

## Safety semantics

- A required unresolved role is blocking.
- A conditional source slot remains visible with its source condition text. `undecided` and `exclude` do not block; `include` promotes it to required.
- Unknown dimensional compatibility produces a warning naming the missing field. Unknown never silently passes.
- Conflicting technique modifiers or conflicting role replacements block readiness.
- A typed compatibility failure has its configured severity.
- Prototype-visible and demo-only mappings always warn and preserve the prototype watermark.
- A draft recipe never yields a production-approved output, and neither does a draft
  _module_: the effective governance state is the weakest of the recipe and every selected
  module. A retired module blocks.
- A module the composition does not offer is rejected, at build time and again at save time.
  A required module is included whatever the submitted selection says.
- Two selected modules that author one requirement identically produce one line carrying
  both provenances; if they differ at all, the card blocks with
  `recipe_composition_conflict` rather than the later module winning.

## Golden fixtures

The three worked compositions are pinned in
`__tests__/recipe-composition-clinical.test.ts`:

```text
EBUS-TBNA          = Flexible Bronchoscopy Core + EBUS-TBNA specific + Procedural Fluoroscopy
therapeutic bronch = Flexible Bronchoscopy Core + Therapeutic Bronchoscopy Core
                     + therapeutic specific + Procedural Fluoroscopy
chest tube         = Pleural Procedure Core + chest-tube specific
```

Their item counts, suppression counts, and readiness states are unchanged from before
composition; only the hashes moved.

- EBUS-TBNA with `ROSE` and `SPEC_MOLECULAR`.
- Central airway obstruction/tumor debulking with rigid airway, APC, dilation, stent, jet ventilation, fluoroscopy, and high-bleeding-risk equipment readiness.
- Chest tube insertion with mutually exclusive small-/large-bore technique branches and optional digital drainage.

The central-airway fixture deliberately pairs incompatible APC platform/probe families and blocks. Its dimensional balloon/scope rule exercises three-valued comparison. The high-bleeding-risk modifier appends `MAJOR_AIRWAY_BLEEDING`, whose lines are `hold_unopened` or `emergency_pull`. The small-bore chest-tube kit proves component duplicate suppression.

Snapshot hashes cover stable domain output rather than page markup. Given identical inputs and source versions, the resolver produces identical output and hash.
