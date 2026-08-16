# R0 — protected current-`main` inventory

The ECMO work already landed on `main` represents a long sequence of corrections. This document
names the behaviours R1 must not regress and maps each to the suite that already proves it, so
"don't break this" is an executable statement rather than an intention.

Nothing here is new protection. It is an index of protection that exists, plus one compact
contract (`__tests__/redesign-baseline-contracts.test.ts`) covering the identity and ordering
that the retired byte-freeze had been covering incidentally.

---

## Behaviours and their guards

| #    | Protected behaviour                                                                                                                                                                                                                                             | Where it lives                                                                                  | Proven by                                                                                                                                                                    |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-1  | **Progress and persistence.** Storage key `cardiohelp-ecmo-progress-v1`, envelope `version: 2`, hand-rolled all-or-nothing parsing, silent fallback to a default envelope, v1→v2 migration preserving Practice history, VA outcomes namespaced by id.           | `engine/progress.ts`, `engine/types.ts`                                                         | `__tests__/progress.test.ts`; `critical-care/progress/__tests__/adapters.test.ts`                                                                                            |
| P-2  | **Pressure-readout truthfulness.** A stopped or unprimed circuit reports channels as unavailable rather than as zero; unmodelled values are never rendered as measurements.                                                                                     | `engine/simulation.ts`, console components                                                      | `__tests__/pressure-readout-truthfulness.test.tsx`; `__tests__/orientation-startup-state.test.tsx`                                                                           |
| P-3  | **Harmful-control causal invariants.** Effective flow never rises with pump speed from any opening speed; drainage-limited flow falls as demand rises; recirculation and RPM stay causally consistent.                                                          | `engine/simulation.ts`                                                                          | `__tests__/cross-surface-consistency.test.ts`; `__tests__/drainage-capacity-sweep.test.ts`; `__tests__/derived-values.test.ts`                                               |
| P-4  | **Authentic prediction commitment.** Mechanism, verdict, harmful-reflex, source-support, and model-boundary content is withheld until the learner commits; titles, objectives, and state labels do not leak the answer for the pilot panels.                    | `LearnLessonPlayer`, teaching panels, `content/learnPredictionItems.ts`                         | `__tests__/learn-predictions.test.ts`; `__tests__/drill-teaching-panels.test.tsx`; `__tests__/learn-walkthrough.test.tsx`                                                    |
| P-5  | **Shared verdict behaviour and Practice/Assess isolation.** Learn changes cannot alter Practice or Assess behaviour.                                                                                                                                            | `components/`, `engine/reducer.ts`                                                              | `__tests__/practice-assess-boundary.test.tsx`; `__tests__/b5-vertical-slice-validation.test.tsx`                                                                             |
| P-6  | **Bubble-event safety semantics.** Bounded atomic resumption; no invented clamp/pump/reset choreography; banned resumption phrasings.                                                                                                                           | `engine/reducer.ts`, Practice copy                                                              | `__tests__/bubble-resumption-safety.test.ts`; `__tests__/resumption-copy-contract.test.ts`                                                                                   |
| P-7  | **Accessibility of the Learn workspace.** Real tablist semantics with roving focus and arrow/Home/End keys; named regions; reveal-then-focus ordering; contrast of the dark workspace against the light shell.                                                  | `EcmoLearnWorkspace`, `ResizableTeachingWorkspace`                                              | `__tests__/learn-workspace.test.tsx`; `critical-care/__tests__/accessibility.test.tsx`; `__tests__/workspace-surface-contrast.test.ts`                                       |
| P-8  | **Responsive three-pane workspace.** Four validated width modes (1600, 1440, 1280, 1024) with the compact mode collapsing to tabs; content fits its pane without clipping.                                                                                      | `EcmoLearnWorkspace`, CSS modules                                                               | `__tests__/learn-workspace.test.tsx`; `__tests__/foundation-workspace-layout.test.tsx`                                                                                       |
| P-9  | **3D assets and controls (B7).** Rebuilt CARDIOHELP console, patient, HLS module, sweep-gas blender, cannula routing, and bedside panning.                                                                                                                      | `components/EcmoCircuit3D.tsx`, `components/ecmo-circuit/*`                                     | `__tests__/b7-asset-contracts.test.ts`; `__tests__/bedside-panning.test.ts`; `__tests__/bedside-scene-geometry.test.ts`                                                      |
| P-10 | **Deep-link access, ungated.** Every section, drill, case, and the challenge is reachable directly by URL; the pathway orders and signposts but never withholds; track-fixed sections canonicalise their URL rather than rendering the wrong reference circuit. | `app/[locale]/cardiohelp-ecmo/learn/page.tsx`, `PathwayNav`, `learningPathways.ts`              | `app/[locale]/cardiohelp-ecmo/routes.test.tsx`; `__tests__/mode-isolation.test.tsx`                                                                                          |
| P-11 | **Release posture.** Publication status `draft`; module unlisted and `noindex`; excluded from the public critical-care catalog and from shared-hub recommendations.                                                                                             | `content/deviceProfile.ts`, `critical-care/content/publicVisibility.ts`, `lib/draft-modules.ts` | `critical-care/__tests__/release-boundary.test.ts`; `critical-care/__tests__/hub-pathway-start-alignment.test.ts`                                                            |
| P-12 | **Registry integrity.** Curriculum and scenario registries validate; identifiers are unique; pathway sections agree with catalog activities on stage and duration; exactly one integration section per pathway.                                                 | `content/curriculum.ts`, `content/scenarios.ts`, `critical-care/content/*`                      | `__tests__/curriculum.test.ts`; `__tests__/scenarios.evidence.test.ts`; `critical-care/__tests__/curriculum-sequencing.test.tsx`; `critical-care/__tests__/catalogs.test.ts` |

## The compact baseline contract

`src/features/cardiohelp-ecmo/__tests__/redesign-baseline-contracts.test.ts` adds the identity
and ordering pins that the retired byte-freeze had been supplying incidentally, without
duplicating any assertion above:

1. Both tracks' complete seventeen-section id sequences, as literal arrays, in order — a loud
   failure on any rename, reorder, insertion, or removal.
2. First section of each track is `why-extracorporeal-support`.
3. The ten drill scenario ids, seven Practice case ids, and one capstone scenario id per track,
   as literal sets.
4. The ten foundation section ids, split four shared / three VV / three VA.
5. A representative deep link built through the real href construction, pinning the route path
   and the `lesson` / `track` query parameter names.
6. `cardiohelpEcmoPublicationStatus === 'draft'`.

Everything else in the table above is referenced, not re-asserted. Duplicating those assertions
would create two places to update and a false sense of coverage.

## Running the protected scope

```bash
npx jest src/features/cardiohelp-ecmo src/features/critical-care src/features/learning-module 'src/app/\[locale\]/cardiohelp-ecmo' --runInBand
```

Type and lint gates run separately with `npm run type-check` and `npm run lint`; the
accessibility subset is `npm run test:a11y`.
