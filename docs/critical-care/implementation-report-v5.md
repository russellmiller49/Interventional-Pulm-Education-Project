# Critical-care curriculum v5 implementation report

**Reviewed:** July 25, 2026  
**Implementation source:** `Critical_Care_Reference/critical-care-curriculum-plan-v5-IMPLEMENTATION.md`

## Scope and implementation decision

The repository-wide structural changes are implemented across all six critical-care module
families. The clinically intensive authoring work follows the plan review's minimum-releasable-slice
recommendation: hemodynamics is the complete five-part feedback/content–engine pilot, and MCS owns
the shared PAPi/CPO interpretation used by hemodynamics.

The implementation does not manufacture generic expert traces or clinical thresholds to make a
checklist appear complete. Remaining scenario-by-scenario clinical authoring is called out below
because it requires source review and SME judgment.

## Work-package audit

| Work package                     | Implemented                                                                                                                                                                                                                                        | Deliberately remaining                                                                                                                                                                                              |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WP0 · Repository hygiene         | Private authoring roots ignored; implementation plan and review retained; staged-PDF guard; source notice; metadata manifest; annual review list                                                                                                   | The 132 already-tracked PDFs require an owner-approved history rewrite. No history rewrite was performed.                                                                                                           |
| WP1 · Open navigation            | Direct activity queries, difficulty ordering/filtering, operable phase stepper, advisory prerequisites, no correctness-gated phase changes, concept-aware search                                                                                   | Browser coverage is representative rather than one Playwright journey per activity.                                                                                                                                 |
| WP2 · Challenge framing          | Fourteen stable internal assessment records render as Challenges; masking removed; no learner score/pass/fail/mastery copy; routine challenge feedback deferred with opt-in; hard safety feedback remains immediate                                | Stable internal schema names and storage values remain for compatibility, as required.                                                                                                                              |
| WP3 · Concept layer              | 42-concept registry, relationship/cycle validation, concept index/detail routes, cross-module appearances, inline assumed-concept strip and side panel, longitudinal threads                                                                       | Clinical review status remains visible in metadata; publication still requires SME release decisions.                                                                                                               |
| WP4 · Feedback                   | Shared five-part feedback, plausibility framing, hard-interrupt card, frame capture, decision trace, expert contrast, divergence reflection, concept/evidence links; full hemodynamics case pilot; challenge timing applied across module families | The remaining legacy scenarios retain their authored causal debriefs. Converting each common error path and writing a case-specific expert trace is clinical authoring work and must not be generated mechanically. |
| WP5 · Content–engine consistency | Hemodynamics thresholds, physical constants, artifact coverage, promised-finding tests, answer-key checks, derived-value guide registry; shared MAP/SpO₂ boundaries; MCS-owned PAPi/CPO guides reused by hemodynamics                              | The same exhaustive authoring audit remains for every derived value and promised finding in CRRT, ECMO, ventilation, and the integrated ICU scenarios.                                                              |
| WP6 · Citations                  | Unified resolver over authoritative module registries; unresolved IDs fail catalog validation; citations render on concept and feedback surfaces; three documented source conflicts render without averaging                                       | Normalize the private synthesis anchor schemes and finish one-row-per-document manifest review after the private corpus is reconciled.                                                                              |
| WP7 · Personal history           | Local-first continue/revisit/concept views; export/delete retained; numeric grades, progress bars, percentages, and aggregate completion tallies removed from learner history                                                                      | Internal score and legacy completion fields remain solely for compatibility, feedback selection, analytics, and revisit ranking.                                                                                    |
| WP9 · Accessibility/tooling      | Global focus-visible treatment, redundant text/pattern state cues, reduced-motion coverage, `jest-axe`, Playwright journeys, keyboard-operable steppers and circuit navigation                                                                     | Manual 200% zoom, 320 px reflow, screen-reader, and color-vision simulation review remains part of release QA.                                                                                                      |

## Stable compatibility boundaries preserved

- Activity IDs, routes, query keys, storage keys, and progress envelopes remain stable.
- Internal assessment/mastery/score fields remain available to existing adapters and tests but are
  not rendered as learner judgments.
- Existing simulation physics were changed only where a tested content–engine defect required it.
- Manufacturer/device workflow claims remain revision-specific and visibly bounded.

## Verification completed

- `npm run type-check`
- `npm run lint` (zero errors; repository advisory warnings remain)
- `npm test -- --runInBand` — 309 suites, 2,269 tests
- `npm run test:a11y` — 4 accessibility surfaces
- `npm run validate:critical-care-assets`
- `npm run validate:cardiac-assets`
- `npm run build` — production build and 624-page generation
- `npm run test:e2e` — 3 Chromium journeys
- `git diff --check`

## Owner/SME decisions still required

1. Approve and schedule a `git filter-repo` history rewrite for previously committed source PDFs.
2. Confirm the ventilation reconciliation rule before source contradictions remove live content.
3. Complete source and SME review before changing any module from draft/SME-review to released.
4. Reconcile and normalize the private synthesis corpus before treating its anchors as authoritative.
5. Author the remaining scenario-specific expert traces and five-part common-error feedback during
   each module's clinical content pass.
