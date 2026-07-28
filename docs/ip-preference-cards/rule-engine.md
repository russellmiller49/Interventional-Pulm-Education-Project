# IP preference-card deterministic rule engine

The resolver is implemented as pure TypeScript under `src/features/preference-cards/domain/`. React components display its output but do not contain the clinical equipment-selection logic.

## Resolution order

1. Clone the selected base recipe.
2. Apply site and location defaults.
3. Apply active modifier actions by explicit sequence.
4. Detect mutually exclusive modifiers and replacement collisions.
5. Append reusable rescue modules.
6. Apply targeted user overlays.
7. Resolve each role to a ranked hospital-local option.
8. Suppress true kit/BOM duplicates.
9. evaluate literal quantity expressions;
10. check room capabilities;
11. evaluate manually curated typed compatibility rules;
12. assign item resolution states;
13. calculate card readiness;
14. produce a human-readable trace;
15. hash and, when authorized, persist the immutable snapshot.

No `eval`, LLM, fuzzy product matching, or automatic substitution participates in resolution.

## Safety semantics

- A required unresolved role is blocking.
- A conditional source slot remains visible with its source condition text. `undecided` and `exclude` do not block; `include` promotes it to required.
- Unknown dimensional compatibility produces a warning naming the missing field. Unknown never silently passes.
- Conflicting technique modifiers or conflicting role replacements block readiness.
- A typed compatibility failure has its configured severity.
- Prototype-visible and demo-only mappings always warn and preserve the prototype watermark.
- A draft recipe never yields a production-approved output.

## Golden fixtures

- EBUS-TBNA with `ROSE` and `SPEC_MOLECULAR`.
- Central airway obstruction/tumor debulking with rigid airway, APC, dilation, stent, jet ventilation, fluoroscopy, and high-bleeding-risk equipment readiness.
- Chest tube insertion with mutually exclusive small-/large-bore technique branches and optional digital drainage.

The central-airway fixture deliberately pairs incompatible APC platform/probe families and blocks. Its dimensional balloon/scope rule exercises three-valued comparison. The high-bleeding-risk modifier appends `MAJOR_AIRWAY_BLEEDING`, whose lines are `hold_unopened` or `emergency_pull`. The small-bore chest-tube kit proves component duplicate suppression.

Snapshot hashes cover stable domain output rather than page markup. Given identical inputs and source versions, the resolver produces identical output and hash.
