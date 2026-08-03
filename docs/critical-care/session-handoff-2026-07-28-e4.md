# Critical Care — session handoff for E4

**Date:** 2026-07-28
**Branch:** `critical-care/module-rebuild` (pushed; `61a7d171` is one commit ahead of origin at time of writing)
**Preceding branch:** `codex/ip-openfda-enrichment-v0-1` — still active, owned by a _different_ agent session

Read §1 and §2 before touching anything. §6 is the work package.

---

## 1. The checkout is shared. This is the first thing to know.

Another agent session (Codex) works in **this same working directory** on preference-cards, literature, and openFDA enrichment. Git has one checked-out branch per directory, so **whoever commits, commits onto whatever branch is currently checked out — including the other session's files if you stage broadly.**

This has already gone wrong once: commit `075bc07c "updates"` swept an in-progress snapshot of critical-care engine work into an openFDA commit. The tree survived; the history did not.

The full protocol is in [`docs/shared-checkout-protocol.md`](../shared-checkout-protocol.md). The short version:

- **Never** `git add -A`, `git add .`, `git add -u`, `git commit -a`/`-am`.
- Before every commit: `git branch --show-current`, `git checkout critical-care/module-rebuild` if needed, stage explicit paths, then **`git diff --cached --name-only`** and read it.
- You own `src/features/{critical-care,cardiohelp-ecmo,mechanical-circulatory-support,icu-hemodynamics,mechanical-ventilation,baxter-crrt}`, `scripts/critical-care`, `docs/critical-care`.
- Codex owns `src/features/{preference-cards,literature}`, `scripts/ip-preference-cards`, `scripts/literature`, `data/ip-preference-cards`, `docs/ip-preference-cards`, `config/literature`, `supabase/migrations`, `messages/*.json`.
- `package.json`, `jest.config.cjs`, `.gitignore`, `.env.example` are shared — add only your own lines.

`npm test` and `npm run type-check` cover the whole repo, so you **will** see Codex's in-flight breakage. Do not fix failures outside your paths. Check whether they reproduce with your work stashed (`git stash push -u -- <your paths>`, run the suite, `git stash pop`) and report them as pre-existing.

---

## 2. What has landed

Three packages, three commits, all verified green.

### `40cc867c` — ECMO signal semantics

The module's spine claim (circuit flow vs _effective_ flow) existed only as discarded local variables. Fixed, along with several related defects:

- **Per-channel readouts.** `CircuitState.readouts` holds `EcmoChannelReadout { status, raw, displayed, reason }` for `pVen`/`pInt`/`pArt`/`deltaP`/`venousLineSaturation`. `status` is `valid` | `device-unavailable` | `simulation-unmodeled` — three different provenance claims that must not collapse into one boolean.
- **Raw pressures are no longer clamped** to the console display range. An out-of-range channel renders unavailable rather than resting on a fabricated boundary value.
- **Pump-stopped pressures are `simulation-unmodeled`**, not a claim about the device. The IFU's dash conditions are sensor-not-connected, unsupported parameter, and out-of-range — it says nothing about a stopped pump.
- Pressure alarms consume only `valid` channels; bubble, power, gas, and patient alarms are untouched.
- **Pressure model corrected.** ΔP is now `flow × 7.8` with no constant term (it was `50 + 2.5 × flow`, which survived a stopped pump and put the reference circuit at ~60 mmHg). `pArt` moved to `146 + 16 × flow`.
- **Reference profiles** `vv-reference` / `va-reference` in `content/referenceProfiles.ts` — content, not scenarios. No faults, no objectives, no scoring, pump running from frame one. **Only inputs are authored**; flow and pressures are engine-derived and bound-checked by the dump harness.

### `25a35a05` — shared evidence and interpretation layer

- `critical-care/content/derivedValueGuides.ts` — `CriticalCareDerivedValueGuide` with reference _kinds_ (`patient-baseline`, `device-specification`, `cohort-observation`, `guideline-recommendation`, `source-reported-range`, `local-protocol`, `educational-model-boundary`, `formula-definition`) and live-value _types_ (`measured`, `device-displayed`, `estimated`, `derived`, `configured`). `normalRange`/`actionableThresholds` are gone from the shared model.
- `critical-care/content/measurementClarifications.ts` — numbers that differ because they measure different things, distinct from genuine conflicts.
- `critical-care/components/teaching/EvidenceRenderers.tsx` — `DerivedValueReadout`, `MeasurementClarification`, `HeldDisagreement`.
- `critical-care/test-support/teachingPanelContract.tsx` — the panel contract. **Not** in `__tests__/`, because Jest would auto-discover it as an empty suite.
- MCS migrated; **hemodynamics deliberately not** — its 13 guides sit behind a documented adapter and an exact-path audit allowlist. Do not broaden that allowlist.

### `61a7d171` — E3, the four shared foundation lessons

`EcmoFoundationLessonActivity.tsx` — one reducer feeding three panes over `ResizableTeachingWorkspace`. Four panels, one file each, typed registry with import-time validation. Prediction/transfer items as `ClinicalLearningItem`. Full source prose preserved in a "Lesson narrative" section.

---

## 3. Field names that must not be reinterpreted

| Field                                         | Meaning                                                                                                                 |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `patient.systemicVenousSaturationEstimate`    | Latent oxygen-balance estimate. **No sensor reads it**; the console never displays it. Never clamped to a device range. |
| `circuit.preOxygenatorSaturation`             | Drainage/venous-line value. **This is what the CARDIOHELP SvO₂ tile and the 3D drainage limb read.**                    |
| `circuit.postOxygenatorSaturation`            | Post-membrane circuit value.                                                                                            |
| `circuit.recirculationFraction`               | Physical circuit property; the scenario sets it, and the observable derives from it.                                    |
| `circuit.recirculationAdjustedCircuitFlowLpm` | `bloodFlow × (1 − recirculationFraction)`. **Not** total systemic flow — in VA the term is zero.                        |
| `modelInputs.oxygenConsumptionMlMin`          | Bounded educational-model input, default 150. Not a measurement.                                                        |

The old ambiguous `svo2` and `effectiveFlow` fields are gone. Do not restore them.

**The IFU basis for the SvO₂ mapping** (Rev 2.3, US): p39 the venous probe measures blood in the disposable's measuring cell; p46 the parameter is "oxygen saturation in the measuring cell", with arterial temperature defined as "temperature at blood outlet" for contrast; p104 the measuring cell is integrated in the oxygenator pump unit. Display ranges: pressures −500…+900 mmHg, SvO₂ 40.0–99.9% (§14.8 p201). Dashes convention: §3 p47.

---

## 4. Current reference values

**VV reference:** flow 4.05 · adjusted flow 3.73 · Rf 0.080 · pVen −35 · pArt 211 · pInt 242 · ΔP 31 · systemic estimate 72.5 · venous-line SvO₂ 74.6 · VO₂ 150

**VA reference:** flow 4.05 · adjusted flow 4.05 · Rf 0.000 · pVen −35 · pArt 211 · pInt 242 · ΔP 31 · systemic estimate 81.5 · venous-line SvO₂ 81.5 · VO₂ 150

**`vv-recirculation` settled:** flow 4.81 · adjusted 2.50 · Rf 0.480 · systemic estimate 67.6 · venous-line SvO₂ 82.7 · post-ox ~99

That last divergence — the console reading 82.7 while the patient's systemic venous saturation is 67.6 — is the central recirculation clue and the reason the two quantities were separated.

---

## 5. Orientation

**Key files**

- `cardiohelp-ecmo/components/EcmoFoundationLessonActivity.tsx` — the activity. One `useReducer`; three panes.
- `cardiohelp-ecmo/components/teaching/` — `shared.tsx` primitives, one file per panel, `EcmoFoundationTeachingPanel.tsx` registry with a throwing validator.
- `cardiohelp-ecmo/content/{foundationLessonRuntime,foundationLearningItems,ecmoValueGuides,referenceProfiles}.ts`
- `cardiohelp-ecmo/engine/simulation.ts` — `deriveSimulation`, `createReferenceSimulationState`, `pressuresAreModeled`, `channelReadout`, `deriveSystemicVenousSaturationEstimate`, `deriveDrainageSaturation`, `deriveRecirculationAdjustedCircuitFlow`.
- `src/app/[locale]/cardiohelp-ecmo/learn/page.tsx` — branches `isEcmoSharedFoundationSectionId` **before** `isEcmoFoundationSectionId`.

**Commands**

```bash
npm run render:ecmo-teaching        # panels → public/ecmo-teaching-preview/panels.html
npm run dump:ecmo-signals           # engine numbers as a table; must stay at 0 flags
npm run audit:critical-care-guides  # provenance audit; 0 failures + hemodynamics legacy note
npm run type-check && npm run lint && npm test && npm run test:a11y
npm run validate:critical-care-assets
```

Serve harness output through the `trainer-prod-static` launch config on :8099.

**Traps that cost time**

1. **Learner-copy lint** bans 39 words in `ClinicalLearningItem` text, word-boundary matched: `%`, `percent`, `correct`, `points`, `wrong`, `test`, `engine`, `route`, `query`, `score`, `pass`, `fail`, `competency`… Write saturations as "a saturation of 88". `failing` and `testing` are fine; bare `fail`/`test` are not.
2. **`contextRequirement: 'technical'`** requires a `clinicalContextId` or `visualAssetIds`. Use `context-independent` unless you have one.
3. **Do not put test helpers in `__tests__/`** — Jest auto-discovers them and fails on "no tests". Use `test-support/`.
4. **Naive negative assertions bite.** Two E3 tests failed because they searched for a phrase that appears inside a _disclaimer_ ("not to a normal range for ECMO", "Do not call the VA value effective systemic flow"). Assert on the specific claim, not the whole `textContent`.
5. **Auth-gated routes cannot be curled.** Use the harnesses.
6. **Barrel imports** — content modules import `learning-module/{curriculum,activity}/types` directly, never the barrels.

**Verification at last run:** type-check clean · lint 0 errors (4 pre-existing warnings in `CardiohelpHub`/`CardiohelpWorkbench`/`PracticeCasePlayer`) · **370 suites / 2974 tests** · a11y 4/4 · assets 19/19 · audit 0 failures · dump 0 flags · harness 4 panels × 2 profiles × 3 states.

---

## 6. Work package: E4

Verbatim from the owner.

### Scope

**E4 — harden the ECMO foundation activity, then convert and author the three VV foundation lessons.**

In-scope section IDs: `vv-series-physiology`, `vv-normal-state`, `vv-integration-capstone`.

Plus two narrowly scoped hardening items:

- **A.** Replace the `pendingAction`/`useEffect` restore-then-act sequence with one deterministic activity-session reducer action.
- **B.** Add a regression test proving `DerivedValueReadout` always renders guide references even when a guide has no interpretation rules or no rule matches.

**Do not begin:** `va-parallel-physiology`, `va-normal-state`, `va-integration-capstone`, the LearnLessonPlayer split (E6), the 20 drill panels (E7), the console-fidelity pass (E8), CRRT, MCS panel/device work, hemodynamics guide migration, Practice/Assess feedback changes, publication promotion.

At the end of E4, **only the three VA sections remain on the prose-only route.**

### Architectural decisions

1. Extend `EcmoFoundationLessonActivity` rather than creating a second VV player.
2. Keep one reducer/session feeding all three panes.
3. Keep reference profiles distinct from scenarios.
4. Existing scenario definitions may be used as **non-scored teaching previews** when they are the best available engine-backed state.
5. A teaching preview must not write scenario scores, record mastery, call `recordScenarioResult`, alter Practice progress, or pretend the foundation activity is the scenario activity.
6. Do not invent new ECMO physiology to make a panel more dramatic.
7. Where the engine cannot isolate a desired patient-side mechanism, **state that limitation explicitly** rather than creating an unsupported response curve.
8. For VV-only sections the support mode is fixed to VV. A `track=va` query must never load a VA reference circuit behind VV teaching content.

### Task 0 — harden restore-then-act sequencing

Remove the `pendingAction`/effect pattern **before** extending the activity. Create an atomic action in the _foundation activity/session_ reducer, not the core ECMO engine reducer:

```ts
type EcmoFoundationSessionAction =
  | ...
  | {
      readonly type: 'RESTORE_SOURCE_AND_APPLY'
      readonly source: EcmoLearnStateSource
      readonly actions: readonly SimulationAction[]
    }
```

Reducer behaviour: create a clean state from the requested reference profile or teaching-preview source; apply the supplied existing ECMO simulation actions synchronously and in order through `ecmoSimulationReducer`; return one final session state; clear or replace temporary interaction evidence in the same transition.

No `pendingAction` state. No effect whose purpose is to dispatch after restore. No exhaustive-deps suppression for this sequence. Support zero, one, or several actions so a deterministic preview can load and advance time in one transition. No intermediate restored frame may briefly render. Add focused tests proving deterministic action order.

Must support: restore `vv-reference` + `SET_RPM`; restore `vv-reference` + `SET_SWEEP`; load `gas-source-interruption` and advance past its timed fault; load `vv-recirculation` and advance to a settled preview.

### Task 1 — rule-free guide renderer regression test

Pin the corrected behaviour with three cases:

1. **Guide with references, no rules** → live value, live-value type, all references, reference-kind badges, `appliesWhen`, caveat and `doNotInfer` all render; no invented interpretation appears.
2. **Guide with rules, value matches none, no fallback** → live value renders, references still render, no interpretation text is fabricated.
3. **Guide with a matching rule** → the applicable interpretation renders and references continue to render.

Do not weaken the teaching-panel contract.

### Task 2 — generalize the interactive foundation set

Introduce `EcmoInteractiveFoundationSectionId` (or `EcmoWorkspaceFoundationSectionId`) containing exactly seven IDs: the four shared plus the three VV.

Keep public section IDs unchanged. Do not redefine the six source-authored foundation sections separately from `foundationLessons.ts` — keep one authoritative record. Route all seven to `EcmoFoundationLessonActivity`; keep the three VA IDs on `EcmoFoundationSectionView`; keep drill IDs on `CardiohelpWorkbench`/`LearnLessonPlayer`; keep the no-lesson landing unchanged. Update route comments so they no longer describe all six track-specific lessons as prose.

> **Superseded (A3, 2026-08-03).** The three VA IDs moved to `EcmoFoundationLessonActivity` in commit `c66c8288`, which left `EcmoFoundationSectionView` with no reachable caller. All ten foundation sections are now interactive; the component and its routing branch were deleted, and `routes.test.tsx` pins the id-set identity that keeps the second path from reappearing. Read the sentence above as history, not as an instruction.

Add import-time registry validation proving all seven have panels, no VA-only section is registered, no drill/scenario ID is registered, and nothing is registered twice.

### Task 3 — canonicalize VV-only routing

For the three VV IDs the runtime support mode is always VV.

`?track=va` on a VV-only ID **must not** load `va-reference`; canonicalize to VV via a server redirect to the same lesson with `track=vv`, or a tested URL replacement if a server redirect is inappropriate here. Avoid redirect loops. Preserve the lesson ID. Do not create a duplicate activity.

Hide the VV/VA toggle for VV-only sections or replace it with a fixed "VV pathway" indicator; shared sections keep the working toggle. `PathwayNav` for a VV-only section uses the VV pathway. Resume pointers restore VV regardless of a stale or malformed track value. Add route and activity tests for mismatched track queries.

### Task 4 — extend foundation runtime state sources

Let a lesson phase or variant select a typed state source, using the existing `EcmoLearnStateSource` where possible. Categories: reference profile (`vv-reference`, `va-reference`), and an existing scenario used as a non-scored teaching preview (scenario ID plus optional deterministic setup actions or run duration).

```ts
interface EcmoFoundationStateVariant {
  readonly id: string
  readonly source: EcmoLearnStateSource
  readonly setupActions?: readonly SimulationAction[]
  readonly label: string
  readonly modelBoundary?: string
}
```

A preview uses the existing engine and scenario definition. Do not copy scenario initial-state numbers into foundation content. Do not create a parallel scenario registry. Do not record scenario completion or score. Foundation progress stays tied to `ecmo:learn:<foundation-section-id>`; scenario objectives, success predicates, penalties and mastery do not become the foundation lesson's completion rule. Timed faults are advanced deterministically by authored setup actions. A preview reset reloads its source cleanly. Switching source clears temporary interaction evidence. The E3 shared lessons keep their existing reference sources.

### Task 5 — three VV panel files

One file per panel over the existing shared primitives: `VvSeriesPhysiologyPanel.tsx`, `VvNormalStatePanel.tsx`, `VvIntegrationCapstonePanel.tsx`. Update the registry, validation, render harness and panel tests. Do not put all three into one large switch component.

### Task 6 — VV series physiology (`vv-series-physiology`)

_"VV series physiology, effective flow, and recirculation."_

Teach that VV returns blood to the venous circulation; the native heart remains responsible for systemic flow; circuit flow and recirculation-adjusted circuit flow are not the same; venous-line SvO₂ can rise because oxygenated return blood is being drained again; and a reassuring or rising circuit-flow display can coexist with inadequate effective VV support.

Primary state `vv-reference`; comparison/transfer uses the existing `vv-recirculation` as a non-scored preview. Do not create a duplicate recirculation scenario.

Accessible series-circulation schematic distinguishing systemic venous return → drainage → oxygenator return to the venous system → right heart → native pulmonary circulation → left heart and systemic circulation. Show live and separately: displayed circuit flow, recirculation fraction, recirculation-adjusted circuit flow, `systemicVenousSaturationEstimate`, `preOxygenatorSaturation`/device-displayed venous-line SvO₂, `postOxygenatorSaturation`, patient SpO₂, native cardiac output.

The panel must state explicitly that native cardiac output is the systemic pump in VV; that the recirculation-adjusted quantity is not a second systemic cardiac output; that pre-oxygenator SvO₂ is the device's venous-line measurement; and that `systemicVenousSaturationEstimate` is a latent educational-model estimate.

The mixture relationship may be shown — `pre = systemic + Rf × (post − systemic)` — labelled as **the simulation's** mixture relationship, with a `ModelBoundary` or educational-model reference. Do not imply the latent estimate is measured by CARDIOHELP, and do not present the derived fraction as a universally validated bedside formula. Raw values drive the displayed arithmetic; the displayed fraction agrees with engine state within rounding tolerance.

**Do not teach that increasing RPM changes the modeled recirculation fraction.** The engine uses an authored scenario fraction; if it does not vary with RPM, state that limitation explicitly.

Flow: recognize (trace the series circuit; identify which flow the pump displays and which is reduced by recirculation) → predict (higher displayed flow, worsening systemic oxygenation, rising venous-line SvO₂ — best answer recirculation) → act (load the preview atomically; no scoring action; allow Restore VV reference) → observe (reference vs preview comparison across displayed flow, adjusted flow, venous-line SvO₂, systemic estimate, patient SpO₂) → explain (all source prose and bullets) → transfer (a materially different cannula-position or return/drainage vignette requiring the learner to distinguish true increase in useful support, increased recirculation, membrane dysfunction, or insufficient information). No treatment or cannula-positioning prescription beyond the supplied sources.

Guides only for recirculation fraction, recirculation-adjusted VV flow, and venous-line SvO₂ versus systemic estimate. Kinds: `educational-model-boundary` where simulator-specific, `device-specification` for the measurement location, source-reported/guideline only where genuinely supported. Do not create a "normal recirculation range" unless explicitly sourced and contextualized.

### Task 7 — VV normal state (`vv-normal-state`)

_"The normal VV patient–circuit state."_

Teach that a stable VV run is a reproducible relationship among signals, a patient- and circuit-specific baseline, stability over time, and appropriate gas exchange and bedside context — **not one universal set of numbers.**

Primary state `vv-reference`. Do **not** use `startup-sensor-orientation`, a fault scenario, or a hidden universal range.

Live baseline-and-trend panel showing circuit flow, RPM, pVen, pInt, pArt, ΔP, sweep, patient SpO₂, PaCO₂, pH, venous-line SvO₂, native cardiac output, recirculation-adjusted flow — organised into drainage/load, membrane/return, gas side, patient. Use existing trend samples where appropriate. Compare current value, the profile's authored baseline, and direction of change over the observed window.

Wording: "this modeled circuit's reference", "unchanged from this circuit's starting state", "drift from this patient–circuit baseline". **Never** "normal range", green/yellow/red clinical bands, universal pVen/ΔP/flow targets, or "safe because inside range".

Any "stable" designation is explicitly scoped to the educational reference state — either show raw change without classifying it, or use an educational-model tolerance authored in a guide, labelled as a simulator display aid with model-boundary metadata and tested inclusivity. Do not create a clinical alarm threshold.

Flow: recognize (which signals belong in a baseline review) → predict (whether a single unfamiliar absolute value is necessarily abnormal when the rest of the relationship is stable; best response emphasises trend, configuration, patient context, measurement validity) → act (Capture reference snapshot / Run 20 modeled seconds / Compare with snapshot / Restore VV reference — may be session evidence, need not dispatch a device action) → observe (before/after trend) → explain (complete narrative and bullets, explicitly including that native lungs still contribute, native cardiac output remains essential, ventilator/sedation/temperature/hemoglobin/volume state affect interpretation, and trends beat an isolated display) → transfer (a different vignette where absolute values differ but remain stable; "which feature most strongly supports that this is a stable baseline rather than an acute circuit problem?"). Avoid specific numbers unless necessary and sourced. **Do not attach the anti-Xa conflict.**

### Task 8 — VV integration capstone (`vv-integration-capstone`)

_"VV integration: displayed flow unchanged, patient deteriorating."_

Given a deteriorating VV patient with a reassuring or unchanged circuit-flow display, distinguish recirculation, membrane dysfunction, sweep-gas interruption, and patient-side change.

Primary preview: `gas-source-interruption`, using the existing timed fault, loaded atomically and advanced beyond the authored fault time via `RESTORE_SOURCE_AND_APPLY`. The learner sees the stable state, commits a prediction, then runs the change or inspects the evolved state. Transfer preview: `vv-recirculation`.

The explain phase may allow inspection of engine-backed previews for `vv-recirculation`, `afterload-oxygenator-resistance`, `gas-source-interruption` — labelled as mechanism previews, no scenario score recorded, restored cleanly between previews, never compared compounded. **Do not claim the oxygenator-resistance preview has unchanged flow if its engine state does not.**

**Patient-side change:** first inspect whether the engine contains a state that isolates patient deterioration while leaving the circuit unchanged. Do not repurpose a scenario whose main mechanism also changes circuit flow; do not claim tension pneumothorax is a clean patient-only unchanged-flow example if the engine produces drainage limitation; do not create a new oxygenation equation; do not fabricate an isolated ARDS-progression response. If no valid isolated preview exists: render the patient-side explanation as a source-backed hypothesis card, state that the engine lacks a clean isolated preset, include expected bedside/ventilator findings as authored prose, log it as an E4 model limitation, and **do not block completion**.

Hypothesis matrix — rows: displayed circuit flow, pVen, pInt/pArt, ΔP trend, venous-line SvO₂, systemic estimate, post-oxygenator saturation, PaCO₂/pH, patient SpO₂, gas-source status, bedside/ventilator findings. Columns: recirculation, membrane dysfunction, gas-side interruption, patient-side change. Directional relationships preferred over universal numbers; each cell states expected direction, useful discriminating finding, and limitation where applicable. Live selected-case findings sit beside the matrix. Do not label a hypothesis "excluded" solely because one modeled value is absent. Device-unavailable and simulation-unmodeled readouts keep their reason-specific text. The matrix stays readable in compact mode and has a complete text equivalent.

Flow: recognize (circuit flow alone cannot discriminate; record whether the problem is oxygenation, ventilation, or both) → predict (primary gas-source case, diagnosis not revealed, all four hypotheses offered, verdict without advancing) → act (inspect gas-source connection; compare venous-line and post-oxygenator saturations; review pInt/pArt/ΔP; review bedside findings — foundation-activity evidence actions; correcting the fault is not required for progression) → observe (reveal the evolved state) → explain (matrix and full narrative) → transfer (load `vv-recirculation`; identify why displayed flow is misleading, venous-line SvO₂ is high, and adjusted flow is much lower — not a repeat of the prediction wording).

### Task 9 — learning items and runtime content

Extend `foundationLearningItems.ts` and `foundationLessonRuntime.ts`. Each VV lesson needs six phase definitions, prediction item, transfer item, authored required actions, evidence IDs, state source(s), and model-boundary copy where applicable.

`ClinicalLearningItem` throughout; every choice keeps id/label/plausibility/rationale; every item keeps a mechanism-level explanation; evidence IDs resolve; commitment does not auto-advance; transfer is materially different; no competency/readiness claim; no "Mark lesson complete"; no universal bedside target language; no banned learner-copy terms without an existing justified override. The four shared lessons' items stay unchanged except where the atomic-action refactor requires it.

### Task 10 — preserve complete source prose

For all three sections preserve title, summary, every paragraph, every bullet, source IDs, and the educational/device boundary, reusing the existing "Lesson narrative" pattern. No paragraph silently dropped; no bullet shortened into a different claim; nothing hover-only; visual diagrams get full text equivalents; do not duplicate the full prose across panes; do not attach anti-Xa to `vv-normal-state`; do not add a held disagreement unless a genuine authored conflict exists.

### Task 11 — progress and resume

Keep activity IDs `ecmo:learn:<section-id>`, storage key `cardiohelp-ecmo-progress-v1`, existing DTOs and adapters, and the existing foundation payload version unless the persisted pointer schema actually changes.

Resume restores section, VV track, saved phase, and a clean state source appropriate to that phase. Do not guess a prior answer, replay a prior action sequence, or store full engine state. Scenario previews do not write scenario result progress. Restore-reference does not erase completed lesson status. Pathway navigation stays fully reachable.

### Task 12 — render harness

Extend `npm run render:ecmo-teaching` / `scripts/critical-care/render-ecmo-teaching-panels.mts`, output still `public/ecmo-teaching-preview/panels.html`.

Matrix adds — `vv-series-physiology`: VV reference, settled recirculation preview, prediction or transfer state. `vv-normal-state`: initial reference snapshot, later stable trend, transfer/narrative state. `vv-integration-capstone`: pre-fault gas-source state, post-fault gas-source state, recirculation transfer, explain-phase hypothesis matrix.

No VA rendering for VV-only panels; no mislabeled track toggle; all evidence references visible; rule-free guides show provenance; compact layout reviewable; tables do not overflow unreadably; text equivalents present; no `[object Object]` readouts; no accidental universal-target copy.

### Task 13 — tests

77 numbered assertions across hardening (1–10), routing (11–19), registry (20–24), session and progress (25–32), VV series physiology (33–40), VV normal state (41–48), VV integration capstone (49–60), provenance and copy (61–70), and regression (71–77). See the owner's prompt for the full list; the load-bearing ones are:

- no `pendingAction` state, no restore-then-dispatch effect, no exhaustive-deps suppression for that sequence
- `RESTORE_SOURCE_AND_APPLY` creates a clean source state, runs setup actions in authored order, exposes no intermediate frame
- rule-free and no-match `DerivedValueReadout` render references without inventing an interpretation
- `track=va` on a VV-only ID canonicalizes to VV and never loads `va-reference`
- exactly seven interactive panels registered; no VA-only or drill ID present
- scenario previews never call `recordScenarioResult` or alter mastery
- the mixture relationship reproduces engine recirculation within tolerance and is labelled educational-model
- the panel does not claim RPM changes the modeled recirculation fraction
- `vv-normal-state` renders no clinical band and no anti-Xa
- dump harness at zero flags; guide audit at zero failures with only the existing hemodynamics legacy paths

### Task 14 — repository safety

`git status` first. Stage only E4 paths. `git diff --cached --name-only` before committing. No prohibited barrels. Respect the public-client-boundary tests and learner-copy lint. Do not edit proprietary source documents, broaden the hemodynamics allowlist, weaken the guide audit or the teaching-panel contract, or change publication status.

### Verification

```bash
npm run render:ecmo-teaching
npm run audit:critical-care-guides
npm run dump:ecmo-signals
npm run type-check
npm run lint
npm test
npm run test:a11y
npm run validate:critical-care-assets
```

Plus focused tests for atomic session actions, rule-free `DerivedValueReadout`, VV foundation routing, track canonicalization, panel registry, VV learning items, VV panel contract, preview-state initialization, and progress/resume. If the ECMO walkthrough test times out, rerun it in isolation and report both results — do not suppress or delete it. Do not run the long production build or Playwright.

### Commit scope

Prefer independently reviewable commits, e.g. `refactor(ecmo): make foundation restore-and-act atomic`, `feat(ecmo): add VV physiology and normal-state teaching panels`, `feat(ecmo): add VV integration foundation capstone`, `test(ecmo): extend teaching preview and E4 contracts`. A different coherent split is fine. No unrelated working-tree changes.

### Stop condition

Stop after: `pendingAction`/effect sequencing removed; rule-free guide provenance regression-tested; all three VV IDs on `EcmoFoundationLessonActivity`; the three VV panels exist; VV-only routing canonical; reference and preview sources deterministic; six-phase flow working for all three; full source prose accessible; render harness includes E4; all verification passing.

Do not continue into E5 VA panels, E6, E7, E8, hemodynamics migration, CRRT, MCS, Practice-feedback redesign, or publication work.

### Final report

Report: files changed · how `pendingAction` was removed · the final atomic action and its semantics · the `DerivedValueReadout` regression tests · the final interactive-foundation ID set · VV-only route canonicalization behaviour · how reference profiles and previews are initialized · how previews avoid scoring/progress writes · registry and validation results · a concise description of each of the three panels · prediction and transfer items for each · engine-backed preview sources used · how the patient-side hypothesis was handled · any model limitation discovered · guides added or changed · how prose was preserved · harness output and coverage · focused-test results · guide-audit result and the unchanged hemodynamics warning · dump result · type-check, lint, full-test, a11y and asset-validation results · any UI, provenance, engine or accessibility issue to resolve before E5.

---

## 7. Known limitations carried into E4

- **`pendingAction` sequencing** — Task 0 exists to remove it. Restore-then-act currently threads through an effect with an `exhaustive-deps` suppression because it cannot be expressed in one dispatch against the current reducer.
- **Rule-free guide provenance** — fixed in E3 but untested; Task 1 pins it.
- **Recirculation fraction is authored, not derived from RPM.** The engine sets it from the scenario fault flag (`RECIRCULATION_FRACTION.baseline` 0.08 / `.established` 0.48). Task 6 requires stating this limitation rather than implying RPM changes it.
- **Connected-but-stopped static pressures are unmodeled.** No supplied source provides a support-mode-specific static-pressure model, so the state reports `simulation-unmodeled` rather than inventing one.
- **Hemodynamics' 13 guides** remain on the legacy shape behind an exact-path audit allowlist. Not E4 work; do not broaden the allowlist.
- **Cardiosave IABP source gap** (MCS, not E4) — only an abbreviated non-US quick reference plus the full Hybrid Operating Instructions with a 2015 copyright; which software generation to model is an open owner decision.
- **PrisMax manual is 2019** (`AW8035 Rev B`, program 2.XX). If the CRRT console fidelity pass proceeds, a current manual would be worth obtaining first.
