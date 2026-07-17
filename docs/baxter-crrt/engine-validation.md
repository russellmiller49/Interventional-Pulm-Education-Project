# Baxter CRRT pilot, Phase 7, and Prismaflex reviewer-foundation validation record

Status: `engineering verification complete for the protected pilot and isolated Phase 7/Prismaflex reviewer candidates; independent validation pending`

Validation scope: deterministic shared engine, PrisMax `CRRT-04`, `CRRT-10`, and `CRRT-13`
Learn/Practice workflows; seven reviewer-only case fixtures; five bounded reviewer tools plus one
non-actionable protocol-blocked dashboard scaffold; five
non-actionable drill previews; a Mastery composition planner; a non-runnable Prismaflex profile,
adapter, and softkey console; and fail-closed catalog, analytics, progress,
publication-composition, protocol, Mastery, and cross-device contracts

Clinical/device/accessibility/publication approval: not granted

## 1. Purpose and claim boundary

This record assembles test and inspection evidence for the authenticated, unlisted three-case draft
and its Phase 7 protected foundation. It shows that the implemented TypeScript behaves according to
its current specifications and synthetic fixtures. It does not establish clinical validity, device
fidelity for a locally installed PrisMax or Prismaflex, patient outcome validity, independent operator
competency, formal Phase 7 activation, or release readiness.

The engine is an educational causal model, not a validated digital twin, clinical calculator,
clinical device, or source of patient-specific treatment recommendations. Passing tests prove
agreement with the implemented contract; they do not prove that an unreviewed contract is clinically
or device-correct.

## 2. Version identity

| Artifact                | Current draft identity                           | Interpretation                                                                      |
| ----------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Shared engine           | `0.4.0-phase7-review`                            | Protected pilot engine plus reviewer-only audience boundary and locked Mastery gate |
| Authored/runtime schema | `1.1.0-phase7-draft`                             | Strict runtime boundary plus stable full-catalog/pathway identifiers                |
| Pilot content/progress  | `0.5.0-pilot-draft.1`                            | Protected identity for the only three learner-runtime cases and progress context    |
| Phase 7 manifests       | `0.7.0-phase7-draft.2`                           | Review-gated catalog, candidate cases/tools, drills, evidence, and Mastery manifest |
| PrisMax profile         | `prismax-aw8035-rb-2xx-draft.2`                  | Source-mapped draft; local configuration unknown                                    |
| Prismaflex profile      | `prismaflex-g5036003-r05-6xx-review-candidate.1` | Reviewer-only, non-runnable Phase 8 core boundary                                   |
| Local protocol profile  | `null`                                           | `CRRT-09`, `CRRT-17`, and actionable anticoagulation/citrate remain protocol-gated  |
| Progress DTO/key        | v2 / `baxter-crrt-progress-v2`                   | Browser-local allowlist with Practice/Mastery isolation; v1 is not migrated         |

The Phase 6 version audit found that the earlier neutral-state/progress constant still used the
Phase 2 “no cases” content identity while pilot cases carried `0.5.0-pilot-draft.1`. This was
corrected by one canonical `content/versions.ts` export wired into the engine, progress, and pilot
registry. Focused version/progress/case tests and TypeScript passed after the correction. Any future
consequential case, scoring, or debrief change must update that canonical version so stale local
results fail closed.

The later `0.7.0-phase7-draft.2` manifest identity is intentionally separate. Adding a catalog or
blocked drill record cannot silently revise protected pilot content, expand the learner runtime, or
promote a pilot result. Progress v2 reads only `baxter-crrt-progress-v2`; an absent, malformed,
stale, or version-1 value fails to a clean v2 default rather than being transformed into Practice or
Mastery credit.

## 3. Source and implementation boundary

### 3.1 Device source verification performed in Phase 6

The supplied PrisMax AW8035 source was visually rechecked at these exact locations:

| Local PDF page / printed page | Source context inspected                              |
| ----------------------------- | ----------------------------------------------------- |
| PDF p12 / manual p11          | Operations-screen regions and device vocabulary       |
| PDF p40 / manual p39          | Setup chapter/workflow map                            |
| PDF p94 / manual p93          | Alarm priority and system-reaction boundary           |
| PDF p218 / manual p217        | Effluent-pump target and TMP calculation context      |
| PDF p242 / manual p241        | Pressure operating-point and fluid-management context |

`pdfinfo` confirmed a 353-page AW8035 artifact with matching document metadata and no embedded
JavaScript. This is source-verification evidence only. It does not establish the release market,
locally installed software/configuration, enabled sets/accessories/solutions, or independent device
approval.

### 3.2 Implemented source-mapped device math

| Record            | Implemented behavior                                                     | Boundary                                                         |
| ----------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `MATH-PM-001`     | `Qeff = Qpfr + Qpbp + Qrep + Qdial + Qsyr + Qmakeup`                     | PrisMax effluent-pump target only; no clinical target            |
| `DOSE-PM-001`     | Effluent rate divided by simulated body weight                           | Prescribed display concept; delivered dose integrated separately |
| `FLUID-PM-002`    | `Vpfr = Veff - Vpbp - Vdial - Vrep - Vsyr`                               | Machine patient-fluid removal only                               |
| `MATH-PM-002`     | `TMP = ((Pfil + Pret) / 2) - Peff - 18`                                  | PrisMax raw-sensor display calculation only                      |
| `DEV-PM-010`      | Raw filter drop `Pfil - Pret`; PrisMax displayed value subtracts 25 mmHg | Raw and displayed values kept separate                           |
| `MATH-PM-003/005` | Plasma flow, predilution, and filtration-fraction display functions      | Explicit units/inputs; no clinical default or target             |

`CONFLICT-001` / `MATH-PM-004` and `CONFLICT-002` / `MATH-PM-006` remain
explicit disabled gates. The engine neither repairs nor executes the disputed printed expressions.

### 3.3 Synthetic clinical calibration

Pressure resistance, filter progression, hemodynamic tolerance, solute production/distribution,
permeability, exact patient values, action thresholds, success bands, scores, unsafe actions, and
critical-error candidates are synthetic and `pending`. Protected-pilot values map to
`SYNTH-CRRT-04`, `SYNTH-CRRT-10`, or `SYNTH-CRRT-13`; authored reviewer fixtures map to
`SYNTH-CRRT-01`, `-02`, `-05`, `-06`, `-07`, `-11`, or `-15`; exact tool inputs/proxies map to the
five matching `SYNTH-LAB-*` records; and the five drill previews map to separate
`SYNTH-DRILL-*` records. The other six nonpilot/nonprotocol case IDs have reserved manifest records
but no fixture or exact values. None is a patient target, universal normal, device limit, or clinical
recommendation.

The clinical literature records provide contextual teaching support only. They do not validate the
exact synthetic values or responses. The required clinical reviewers must independently adjudicate
the mechanisms, accepted alternatives, critical errors, debriefs, and model calibration.

## 4. Engine architecture under validation

- Strict serializable patient, access, circuit, prescription, device, delivered-therapy, scenario,
  alarm, intervention, trend, and version state.
- Strict Zod authored/runtime case boundaries and fail-closed fixture normalization.
- One deterministic clinical seed derived from case/fixture identity, pathway/attempt context as
  specified, with no direct `Math.random()` in clinical logic.
- Pure reducer transitions with a canonical 60-second integration substep, deterministic event/trend
  boundaries, bounded trend/event history, and clean reset.
- Immediate device/circuit/pressure/alarm effects separated from delayed solute, balance,
  hemodynamic, filter, and delivered-dose effects.
- One coupled feasible delivery fraction across active source bags and effluent capacity.
- Separate prescribed/delivered dose, machine PFR/whole-patient balance, fault/acknowledgement, and
  shared-engine/device-adapter domains.
- One atomic learning session for engine, PrisMax interface, prediction, actions, hints,
  reassessment, scoring, critical errors, timeline, and debrief.
- An explicit learner/reviewer audience boundary: learner sessions accept only the protected pilot,
  while pending review fixtures are excluded from learner creation and progress persistence.
- Separate activation, catalog, evidence, drill, and Mastery manifests that require explicit
  learner-active state, complete exact-version reviews, no blocking input, an exact candidate and
  manifest digest, and the matching separate Phase 7 or Phase 8 authorization before activation.
- A Mastery engine boundary that rejects session creation, scoring, and persistence while the
  immutable approved runtime/capstone registry is empty; a future record must bind the exact
  capstone, runtime case, content version, and at least two problem domains.
- Strict non-PHI progress and analytics allowlists at both client and server boundaries.

## 5. Requirement-to-evidence matrix

### 5.1 Unit, calculation, and conservation tests

| Requirement                                                                      | Primary automated evidence                                            | Draft result |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------ |
| Unit conversion and invalid-number rejection                                     | `engine/__tests__/clinicalMath.test.ts`                               | Passed       |
| Effluent target and prescribed dose                                              | `clinicalMath.test.ts`, `deviceCalculations.test.ts`                  | Passed       |
| Plasma flow, predilution, and filtration fraction                                | `clinicalMath.test.ts`                                                | Passed       |
| Disabled disputed expressions                                                    | `clinicalMath.test.ts`, content/provenance tests                      | Passed       |
| Fluid conservation and bag physical bounds                                       | `fluidModel.test.ts`, `safetyInvariants.test.ts`                      | Passed       |
| Machine PFR versus whole-patient balance                                         | `fluidModel.test.ts`, `pilotCases.test.ts`, `timeEquivalence.test.ts` | Passed       |
| Solute mass conservation and delivered-clearance response                        | `soluteModel.test.ts`                                                 | Passed       |
| Pressure direction, TMP, and filter pressure drop                                | `pressureModel.test.ts`, `deviceCalculations.test.ts`                 | Passed       |
| Filter burden monotonicity/bounds                                                | `filterModel.test.ts`                                                 | Passed       |
| Downtime and delivered-dose integration                                          | `timeEquivalence.test.ts`, case tests                                 | Passed       |
| Alarm generation, acknowledgement, correction                                    | `alarms.test.ts`, `safetyInvariants.test.ts`                          | Passed       |
| Progress v2 serialization, bounds, version reset, and Practice/Mastery isolation | `progress.test.ts`                                                    | Passed       |

### 5.2 Invariant and state-machine tests

| Requirement                                                               | Primary automated evidence                                               | Draft result |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------ |
| More access resistance/BFR makes access pressure more negative            | `pressureModel.test.ts`                                                  | Passed       |
| Return and filter obstruction have distinct directional patterns          | `pressureModel.test.ts`                                                  | Passed       |
| Alarm acknowledgement does not remove the fault                           | `alarms.test.ts`, `safetyInvariants.test.ts`                             | Passed       |
| Correcting the cause recomputes pressure/alarm state                      | `safetyInvariants.test.ts`, `pilotCases.test.ts`                         | Passed       |
| Direct/scheduled starts use the same fail-closed readiness gate           | `reducer.test.ts`, `safetyInvariants.test.ts`                            | Passed       |
| Setup/prime/review/connect/start order and clean reload                   | `prismaxAdapter.test.ts`, `learningSession.test.ts`, `scaffold.test.tsx` | Passed       |
| Prediction locks interventions, device actions, and time advancement      | `learningSession.test.ts`, `learningWorkflow.ui.test.tsx`                | Passed       |
| Reassessment precedes debrief                                             | `learningSession.test.ts`, UI tests                                      | Passed       |
| Learn help/state never leaks into Practice or another case/role           | `learningSession.test.ts`, `learningWorkflow.ui.test.tsx`                | Passed       |
| Practice state/hints never leak into a newly loaded Mastery attempt       | `learningSession.test.ts`, `learningWorkflow.ui.test.tsx`                | Passed       |
| Practice progress cannot complete Mastery                                 | `progress.test.ts`                                                       | Passed       |
| Missing reviewers/blockers prevent catalog, drill, and Mastery activation | `phase7Registry.test.ts`                                                 | Passed       |
| Citrate and Prismaflex runtime fail closed                                | readiness, reducer, schema, and adapter tests                            | Passed       |

The instructions also require directionality for dialysate flow and post-filter ultrafiltration
within the full prescription/transport curriculum. The Transport Mechanism Lab, Prescription
Workbench, and qualitative pre/post-dilution experiment now exist only as isolated reviewer
candidates with visible synthetic/source boundaries. They are not learner-active, scored, saved,
or claimed as clinically validated. Remaining modalities/cases still require independent review.

### 5.3 Determinism and time equivalence

The engine decomposes requested time advances into the same canonical 60-second substeps and splits
at deterministic event/trend boundaries.

Declared comparison tolerances:

- Integrated volume: `0.000001 mL`.
- Other continuous model values/fractions: `0.000000001` in the documented unit.

`timeEquivalence.test.ts` compares sixty one-minute advances, four 15-minute advances, and one
one-hour advance across patient state, delivery, fluid balance, filter burden, pressures, alarms,
events, and trends. `seededRandom.test.ts`, reducer tests, and case-path tests cover repeatability,
bounded jitter, stable ordering, and clean replay.

### 5.4 Pilot case paths and outcomes

| Requirement                                                                                        | Primary automated evidence                                                   | Draft result                                                                 |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Exactly ordered `CRRT-04`, `CRRT-10`, `CRRT-13`                                                    | `__tests__/pilotCases.test.ts`                                               | Passed                                                                       |
| Every pilot item/source remains pending and synthetic                                              | content, provenance, schema, and pilot-case tests                            | Passed                                                                       |
| Safe path plus two explicit accepted alternatives                                                  | `pilotCases.test.ts`, `outcomes.test.ts`                                     | Passed                                                                       |
| Unsafe/critical trigger behavior                                                                   | `pilotUnsafeCriticalPaths.test.ts`, `pilotCases.test.ts`, `outcomes.test.ts` | Every declared pilot unsafe/critical path passed; human adjudication pending |
| Required reassessment and deterministic debrief                                                    | learning-session, outcome, pilot-case, and UI tests                          | Passed                                                                       |
| Fixed 15/20/20/20/15/10 rubric and bounded hints                                                   | `outcomes.test.ts`                                                           | Passed                                                                       |
| Learn unscored; Practice scored; Mastery engine semantics present but pathway/capstone unavailable | outcome, content, registry, scaffold, and UI tests                           | Passed                                                                       |
| CRRT-13 pressure/alarm arises from engine state                                                    | `pilotCases.test.ts`                                                         | Passed                                                                       |
| CRRT-10 PFR/balance remain distinct                                                                | `pilotCases.test.ts`, `fluidModel.test.ts`                                   | Passed                                                                       |

Automated path success does not approve the path. The clinical and device review intakes remain
unchecked and must independently decide whether each accepted/unsafe/critical path is appropriate.

### 5.5 UI, privacy, access, and accessibility evidence

| Requirement                                   | Evidence                                                                                                        | Current conclusion                                          |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Responsive five-surface mobile workspace      | UI tests, prior 390 × 844 walkthrough, and [provisional browser-QA record](./browser-qa-evidence-2026-07-17.md) | Passed reflow smoke; 200% and full manual traversal pending |
| Keyboard tabs and focus-managed stop modal    | Phase 6 accessibility tests for Arrow/Home/End, dialog trap/Escape/return, and reload focus                     | Passed automated tests                                      |
| Circuit/pressure and trend text summaries     | Accessibility and circuit component tests                                                                       | Passed automated semantics; manual AT review pending        |
| Non-color/global generic alarm boundary       | Accessibility tests and persistent mobile text/icon summary                                                     | Passed automated semantics; device priority mapping pending |
| Reduced-motion rules                          | Circuit/accessibility component tests                                                                           | Passed static tests; OS-level manual review pending         |
| No PHI/free text in local progress            | `progress.test.ts`                                                                                              | Passed                                                      |
| No free text/trends/actions in CRRT analytics | feature analytics tests plus API route boundary tests                                                           | Passed                                                      |
| Draft/unlisted/noindex/search/sitemap policy  | localized route, layout, draft-module, search, sitemap, and access tests                                        | Passed                                                      |
| Calibration panel absent outside development  | `learningWorkflow.ui.test.tsx`                                                                                  | Passed                                                      |
| Learner/reviewer page containment             | Live `clientWidth === scrollWidth` checks on both routes at 320 × 800 and 768 × 1024                            | Passed on the current working build                         |
| Reviewer disclosure containment               | Open case, tools, Mastery, Prismaflex, and transfer disclosures inspected live                                  | Passed after the rapid-drill grid fix                       |
| Rapid-drill narrow-grid regression            | `accessibility.test.tsx` plus live child-overflow recheck                                                       | Passed; zero child overflow after the CSS fix               |
| Source-matrix implementation paths            | `sourceMatrixIntegrity.test.ts`                                                                                 | Passed; recorded candidate-scoped paths resolve             |
| Full keyboard/AT/200%/contrast/motion matrix  | [accessibility-release-checklist.md](./accessibility-release-checklist.md)                                      | Pending                                                     |

### 5.6 Phase 7 protected-foundation evidence

| Requirement                                                       | Primary implementation/evidence                                                               | Draft result                                                                                                                       |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Canonical `CRRT-01` through `CRRT-18` catalog                     | `content/curriculum.ts`, `phase7Registry.test.ts`                                             | Passed; three learner runtime plus seven reviewer-only candidates                                                                  |
| Reviewer/learner session and progress separation                  | `engine/learningSession.ts`, `engine/progress.ts`, focused tests                              | Passed; review fixtures cannot enter learner creation or Practice persistence                                                      |
| Exact protected learner-definition identity                       | `content/learnerRegistry.ts`, learning-session tests                                          | Passed; cloned or rebranded definitions are rejected even when they reuse a pilot ID                                               |
| Seven deterministic reviewer-only case fixtures                   | `content/phase7ReviewCases.ts`, isolated case runner and path tests                           | Passed as pending synthetic fixtures; no learner analytics, progress, or competency                                                |
| Six instructional-tool identities and activation boundaries       | `content/instructionalTools.ts`, component/model tests                                        | Passed; six reviewer surfaces, citrate non-actionable/protocol-blocked, every learner/scoring/progress flag false                  |
| Five bounded models plus disabled citrate dashboard               | transport, fluid, pressure, prescription, and citrate scaffold component/model tests          | Passed; invalid input suspends output, disconnection mappings fail closed, and citrate exposes no parameters or actions            |
| Reviewer route and learner bundle separation                      | guarded `/baxter-crrt/review` route and release-composition tests                             | Passed; reviewer code is absent from the published learner component graph                                                         |
| CRRT analytics/progress server boundary                           | feature analytics, site tracker, API route, and progress tests                                | Passed; reviewer IDs/lifecycle/progress fields rejected; no generic CRRT progress mutation                                         |
| Fail-closed publication resolver                                  | `content/deviceProfiles.ts`, `content/authorization.ts`, publication/layout/composition tests | Passed; exact candidate/manifest, configuration, reviews, deployable artifact, and separate publication authorization are required |
| Schema-v2 candidate-manifest contract                             | `scripts/baxter-crrt/`, manifest tests, freeze procedure                                      | Passed; Git tree/blob identity and source hashes are bound; dirty-tree manifests remain un-signable                                |
| Guarded reviewer build-identity banner                            | `reviewBuildIdentity.ts`, reviewer page and tests                                             | Passed; absent/malformed declarations warn, and a declared candidate never grants eligibility                                      |
| Canonical review and authorization contract                       | `docs/baxter-crrt/review-packet/`, `content/authorization.ts`, activation/publication tests   | Typed ingestion and pending templates implemented; no real identity, disposition, receipt, or authorization is populated           |
| `CRRT-09` and `CRRT-17` remain protocol-blocked                   | `content/curriculum.ts`, `phase7Registry.test.ts`                                             | Passed; no actionable content                                                                                                      |
| Seven rapid-drill IDs remain non-runnable                         | `content/rapidDrills.ts`, `content/rapidDrillReview.ts`, focused tests                        | Passed; five reviewer previews, two policy-blocked, no score/progress/competency                                                   |
| All catalog/drill/Mastery source IDs resolve                      | `content/provenance.ts`, `content/phase7Evidence.ts`, `phase7Registry.test.ts`                | Passed; records remain pending                                                                                                     |
| Mastery manifest has no runtime case and cannot activate          | `content/mastery.ts`, `phase7Registry.test.ts`                                                | Passed                                                                                                                             |
| Mastery composition planner cannot create a result                | `content/masteryReviewPlanner.ts`, focused content/UI tests                                   | Passed; ephemeral reviewer theme planning only                                                                                     |
| Locked Mastery rejects session creation/load/reset                | `engine/learningSession.ts`, `learningSession.test.ts`                                        | Passed; activation registry empty                                                                                                  |
| Forged Mastery state cannot receive a score or completion         | `engine/outcomes.ts`, `outcomes.test.ts`                                                      | Passed                                                                                                                             |
| Locked/generic Mastery results cannot persist                     | `engine/progress.ts`, `progress.test.ts`                                                      | Passed                                                                                                                             |
| Unsafe scores never enter the best-safe score aggregate           | `engine/progress.ts`, `progress.test.ts`                                                      | Passed                                                                                                                             |
| Full composed Mastery view masks case/source/calibration identity | `learningWorkflow.ui.test.tsx`                                                                | Passed; pathway still locked                                                                                                       |

The remaining eight nonpilot entries—six manifest-only and two protocol-blocked—have no runtime
fixture. Five drills have non-actionable reviewer previews, two remain policy-blocked, and Mastery
has no capstone runtime. See [phase-7-status.md](./phase-7-status.md) for the complete activation
boundary.

### 5.7 Prismaflex and cross-device reviewer-foundation evidence

| Requirement                                                       | Primary implementation/evidence                                      | Draft result                                                                                      |
| ----------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Separate immutable Prismaflex reviewer profile                    | `content/deviceProfiles.ts`, `content.test.ts`                       | Passed; exact manual identity, empty enabled configuration, learner availability deferred         |
| `DEV-PF-001` through `DEV-PF-008` materialized                    | `content/provenance.ts`, source/profile tests                        | Passed; every record remains pending and configuration-limited                                    |
| Pump-target and dose-section `Qeff` remain distinct               | `engine/deviceAdapters/prismaflexCalculations.ts`, calculation tests | Passed; `CONFLICT-010` retained and no silent reconciliation                                      |
| Prismaflex TMP and filter-drop calculations are separately owned  | calculation adapter and focused tests                                | Passed; raw and display-corrected quantities remain distinct                                      |
| Reviewer adapter cannot execute therapy                           | `engine/deviceAdapters/prismaflex.ts`, adapter tests                 | Passed; validation always retains configuration blocker and every runtime action throws           |
| Setup sequence and alarm categories remain reviewer metadata only | Prismaflex adapter and console tests                                 | Passed; no prime/connect action, alarm assignment, threshold, correction, or restart is activated |
| Softkey review console is isolated                                | `components/PrismaflexReviewerConsole.tsx`, component/model tests    | Passed; no device action, scoring, analytics, progress, persistence, or competence                |
| Cross-device transfer remains a plan                              | `content/crossDeviceTransfer.ts`, component/content tests            | Passed; runtime IDs empty, tolerance null, prerequisites false, and no equivalence claim          |
| Learner runtime still rejects Prismaflex                          | initial-state, readiness, calculation-resolver, progress, and tests  | Passed                                                                                            |

These tests establish internal separation and fail-closed behavior only. They do not validate an
installed Prismaflex configuration, the correctness of an operational workflow, device fidelity,
or cross-device outcome equivalence.

## 6. Verification logs

### 6.1 Phase 4-5 full repository baseline

The last recorded full-suite verification before Phase 6 changes was:

| Check                                              | Recorded result                                                                        |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Focused CRRT, workflow, analytics, and route tests | 24 suites / 157 tests passed                                                           |
| `npm run type-check`                               | Passed                                                                                 |
| CRRT-scoped ESLint                                 | Passed with no errors                                                                  |
| `npm run lint`                                     | Passed with 13 pre-existing non-CRRT warnings and no errors                            |
| `npm test -- --runInBand`                          | 200 suites / 1,367 tests passed                                                        |
| `npm run build`                                    | Passed; route emitted with existing Mermaid dynamic-require and metadata-base warnings |
| Scoped Prettier and `git diff --check`             | Passed                                                                                 |
| Desktop Learn/Practice browser walkthrough         | Passed recorded pilot flows with no error-level console entries                        |
| Mobile 390 × 844 browser walkthrough               | Passed five surfaces with no page-level horizontal overflow                            |

### 6.2 Phase 6 final engineering evidence

After the accessibility implementation:

| Check                                                     | Recorded result                                                             |
| --------------------------------------------------------- | --------------------------------------------------------------------------- |
| Focused accessibility tests                               | 4 suites / 21 tests passed                                                  |
| All `src/features/baxter-crrt` tests                      | 24 suites / 152 tests passed                                                |
| Focused CRRT/route/analytics/access/search test selection | 28 suites / 169 tests passed                                                |
| `npm run type-check`                                      | Passed                                                                      |
| CRRT-scoped ESLint                                        | Passed with no output                                                       |
| `npm run lint`                                            | Passed with 13 pre-existing non-CRRT warnings and no errors                 |
| `npm test -- --runInBand`                                 | 201 suites / 1,372 tests passed                                             |
| `npm run build`                                           | Passed with the existing Mermaid dynamic-require and metadata-base warnings |
| Scoped Prettier and `git diff --check`                    | Passed                                                                      |

During the original Phase 6 pass, the in-app browser URL policy rejected localhost
navigation/reload. No workaround was attempted, so the earlier 390 × 844 result remains the only
live evidence attached to that historical baseline. A later authenticated 2026-07-17 follow-up on
the expanded working build is recorded in section 6.4; it does not retroactively change the Phase 6
test totals or constitute exact-candidate accessibility approval.

### 6.3 Phase 7 protected-foundation historical baseline

| Check                                                                     | Recorded result                                                     |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `phase7Registry.test.ts`                                                  | 8 tests passed, including source-ID and exact-review-gate integrity |
| Registry, progress, learning-session, outcome, scaffold, and UI selection | 6 suites / 50 tests passed                                          |
| All CRRT feature and localized-route tests                                | 25 suites / 170 tests passed                                        |
| `npm run type-check`                                                      | Passed                                                              |
| CRRT-scoped ESLint                                                        | Passed with no output                                               |
| `npm run lint`                                                            | Passed with 13 pre-existing non-CRRT warnings and no errors         |
| `npm test -- --runInBand`                                                 | 202 suites / 1,390 tests passed                                     |
| `npm run build`                                                           | Passed with existing Mermaid dynamic-require and metadata warnings  |
| Scoped Prettier and `git diff --check`                                    | Passed                                                              |

These totals predate the reviewer case/tool expansion. The focused result proves the implementation
boundary only. It is not a clinical, device,
accessibility, pilot, competency, product, or publication approval.

Before any pilot or release disposition, repeat the automated stack if the reviewed revision
changes and complete the approved manual browser/assistive-technology matrix on the exact candidate.
The results above remain engineering evidence only.

### 6.4 Phase 7/8 pre-adversarial integrated baseline (superseded)

An earlier `0.4.0-phase7-review` / `0.7.0-phase7-draft.2` /
`0.8.0-prismaflex-review-draft.1` working-tree revision completed this run on 2026-07-17:

| Check                                               | Recorded result                                                                                      |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| All `src/features/baxter-crrt` tests                | 44 suites / 299 tests passed                                                                         |
| Candidate/activation/publication/reviewer selection | 7 suites / 52 tests passed                                                                           |
| `npm run type-check`                                | Passed                                                                                               |
| `npm run lint`                                      | Passed with 13 pre-existing non-CRRT warnings and no errors                                          |
| `npm test -- --runInBand`                           | 225 suites / 1,540 tests passed                                                                      |
| `npm run build`                                     | Passed; learner and guarded reviewer routes emitted with existing Mermaid and metadata-base warnings |
| Scoped Prettier and `git diff --check`              | Passed                                                                                               |
| Independent integrated boundary audit               | Recorded as passed at that revision; superseded by the later adversarial audit in section 6.5        |
| Authenticated learner/reviewer reflow smoke         | Passed at 320 × 800 and 768 × 1024 on both local routes; full manual accessibility matrix pending    |

The build emitted both `/[locale]/baxter-crrt` and the always-guarded
`/[locale]/baxter-crrt/review` route. A direct unauthenticated local HTTP request to the reviewer
route redirected to sign-in as intended. On 2026-07-17, an authenticated local in-app-browser smoke
reached both routes at 320 × 800 and 768 × 1024. For both routes at both viewports,
`clientWidth === scrollWidth`. At 320 pixels, module-owned controls measured at least 44 CSS pixels;
native reviewer inputs were excluded when their associated label, rather than the input itself, is
the intended target. Opened case, instructional-tool, Mastery, Prismaflex, and cross-device transfer
disclosures remained contained.

That smoke found one rapid-drill implicit-grid clipping defect. The review grid was changed to an
explicit `minmax(0, 1fr)` column with `min-width: 0`, then rechecked with zero overflowing child
elements. `src/features/baxter-crrt/__tests__/accessibility.test.tsx` now contains a static
regression assertion for that narrow-grid rule. No error-level browser logs were observed.

The smoke is retained as the structured, explicitly non-approving evidence record
[`CRRT-BROWSER-QA-PROVISIONAL-2026-07-17-01`](./browser-qa-evidence-2026-07-17.md). Because the exact
browser engine/version, screenshot artifacts, and frozen candidate binding were unavailable, the
record completes no formal browser or accessibility matrix row.

This is engineering evidence for that unfrozen working build, not a completed accessibility
review. Full tab-order traversal, 200% zoom, VoiceOver and a second assistive technology, OS-level
reduced-motion behavior, contrast, and the complete exact-candidate accessibility review remain
pending.

The earlier “no remaining P0/P1” statement is not the final audit result. Later adversarial review
found additional fail-closed gaps in canonical learning-phase transitions, review/authorization
digest binding, protected-pilot and stable-PrisMax prerequisite references, exact publication
composition, and candidate-manifest handling. Those findings were corrected and retested in the
superseding run below.

### 6.5 Final workflow, authorization, and candidate-integrity hardening

The latest unfrozen working tree completed this authoritative engineering run on 2026-07-17:

| Check                                                    | Recorded result                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| All `src/features/baxter-crrt` tests                     | 46 suites / 315 tests passed                                                         |
| Adversarial workflow/focus affected set                  | 9 suites / 81 tests passed                                                           |
| Focused activation/publication authorization gates       | 2 suites / 28 tests passed                                                           |
| Candidate-manifest integrity tooling                     | 1 suite / 10 tests passed                                                            |
| `npm run type-check`                                     | Passed                                                                               |
| `npm run lint`                                           | Passed with 13 pre-existing non-CRRT warnings and no errors                          |
| `npm test -- --runInBand`                                | 227 suites / 1,558 tests passed                                                      |
| `npm run build`                                          | Passed; 516 static pages generated and both CRRT routes emitted                      |
| Scoped Prettier, `git diff --check`, and whitespace scan | Passed; documentation-only Markdown hard breaks were the only trailing-space matches |

The canonical session reducer now refuses prediction or reassessment commits outside their exact
reasoning phases, rejects zero-time advancement, and exposes reassessment only after a positive
post-intervention advance. Backward precommit editing remains supported. Case, role, and clean-
attempt changes focus a stable labeled workflow heading; pathway tabs retain local focus; and
multiple reviewer workflows do not steal focus from one another.

Every accepted domain review must bind the exact candidate ID, candidate-manifest digest,
canonical findings-ledger digest, and the expected per-domain scope digest. Pilot acceptance,
Phase 7, Phase 8, and publication records also require exact, distinct record references and
artifact allowlists. Publication is limited to the exact current learner composition:
`CRRT-04`, `CRRT-10`, `CRRT-13`, and `prismax-aw8035-2xx`. Phase 8 still requires an independently
resolved stable PrisMax candidate and its activation/publication records.

The candidate tool now requires manifest output outside the entire repository, including symlinked
parents, and verification rejects noncanonical, internally inconsistent, provisional, dirty, or
source-unverified recorded manifests. These validators establish structure and exact binding only.
An approved external identity/attestation system must authenticate and resolve every referenced
receipt and immutable authorization record; arbitrary caller-constructed objects are not evidence.

This run is still not a frozen review candidate. Exact-candidate manual browser, 200% zoom,
assistive-technology, clinical, device, configuration, governance, product, pilot, phase, and
publication dispositions remain pending.

### 6.6 Source-independent completion-audit hardening

A later same-day unfrozen run closed additional gaps that did not require new clinical, device, or
local-configuration claims:

- Every ephemeral outcome now includes its case/attempt, deterministic seed, engine/schema,
  simulation/case content, device-profile, and protocol-profile identity. The analytics and local
  progress allowlists remain unchanged and do not transmit or persist that replay metadata.
- The workflow offers deterministic 1-, 5-, 15-, and 30-minute plus 1- and 6-hour advances. A
  separate next-event control derives its exact positive delta from the seeded engine queue and
  disappears after the final scheduled event.
- Accepted paths now declare prediction-control IDs that must resolve to visible choices. Phase 7
  reviewer cases expose a separate alternative control, and scoring no longer gives full
  prescription-domain credit when a primary plan is followed by a different alternative action.
- Debrief renders the committed plan, performed/completed/missed actions, actual reassessment,
  matched path, critical candidates, ordered timeline, and first/latest pressure, dose, fluid, and
  laboratory samples. The trend table is keyboard-focusable and horizontally scrollable.
- Trend samples now preserve prescribed/delivered dose and the existing simulated solute pools in
  addition to pressure, filter, stress, effluent, and fluid-balance values.
- Direct access- and return-disconnection lifecycle tests cover cause state, generic priority-free
  alarms, downtime, correction, and the guard against reconnecting a line when no fault was active.
- The Prismaflex profile and cross-device composition plan now pass strict module-load Zod
  boundaries that lock every learner/runtime/scoring/progress/equivalence field closed. Negative
  tests reject unknown fields, enabled therapies, runtime case IDs, non-null tolerance, satisfied
  prerequisites, and incorrect source unions.
- Canonical manifest serialization rejects non-JSON, non-finite, non-plain, and circular inputs.
  Production CRRT source no longer uses the audited unsafe object-entry or double-assertion casts.
- A code-owned future learner-registration boundary rejects duplicate/mismatched cases and any
  Phase 7 record that does not pass exact-candidate activation. The live Phase 7 registration list
  remains empty, so the learner registry is still exactly the three protected pilot cases.
- The citrate/calcium reviewer surface now materializes only linked domain and prerequisite
  placeholders. It remains protocol-blocked and exposes no parameter, target, dose, adjustment,
  alarm, escalation, or action control.
- The learner workbench now has a collapsed-by-default, read-only attempt reference drawer. It
  exposes only the current prescription, recorded history, realized events, and recent synthetic
  trends; future events remain hidden and equations fail closed as unavailable.
- Authored-case validation now rejects duplicate claim-location source mappings and unused
  source-basis records, preventing mechanically excessive provenance payloads.

| Check                                                     | Recorded result                                                 |
| --------------------------------------------------------- | --------------------------------------------------------------- |
| CRRT feature plus candidate-manifest tests                | 48 suites / 342 tests passed                                    |
| Candidate-manifest integrity tooling                      | 1 suite / 11 tests passed                                       |
| `npm run type-check`                                      | Passed                                                          |
| `npm run lint`                                            | Passed with 13 pre-existing non-CRRT warnings and no errors     |
| `npm test -- --runInBand`                                 | 228 suites / 1,575 tests passed                                 |
| `npm run build`                                           | Passed; 516 static pages generated and both CRRT routes emitted |
| Scoped Prettier, ESLint, unsafe-cast scan, and diff check | Passed                                                          |

A fresh schema-v2 manifest verified all four supplied source files, but correctly reported
`provisional-dirty-working-tree`; verification rejected it because the repository is neither clean
nor committed. It is engineering evidence only and cannot receive a formal review signature.

## 7. Known limitations and open validation work

- Exact PrisMax release market, local software version, enabled sets/accessories, Auto Effluent,
  solutions, flow ranges/increments, and local practice are unknown.
- Exact device alarm names, priorities, thresholds, pump/clamp reactions, help/correction sequences,
  and some stop/end/bag-change behavior require independent PrisMax review.
- Every clinical mechanism, exact value, response coefficient, accepted alternative, unsafe action,
  critical-error candidate, hint, score trigger, and debrief remains pending clinical review.
- Regional citrate-calcium remains disabled without a versioned approved local protocol.
- Prismaflex has a non-runnable reviewer profile, adapter/calculation candidate, softkey console,
  and transfer plan; it remains absent from learner runtime and no cross-device equivalence claim
  or tolerance is available.
- Full tab-order traversal, 200% zoom, VoiceOver/second-AT, OS-level reduced motion, contrast,
  live-region behavior, and exact-candidate accessibility review remain unchecked. The recorded
  320 × 800 and 768 × 1024 smoke does not complete that matrix.
- Pilot entitlement, telemetry retention/access/export/deletion, study governance, reviewer identity,
  localization, and publication decisions remain unresolved.
- All 15 nonpilot cases remain learner-inactive: seven are reviewer-runnable and eight have no
  runtime fixture. Six tool surfaces are inspectable; five have bounded models, while citrate has
  only a non-actionable protocol-blocked domain scaffold and instructional pressure-lab
  disconnection mappings remain blocked pending device review. Five drills are reviewer previews
  only, two are policy-blocked, and both Mastery and cross-device transfer have composition planners
  but no runtime capstone.

## 8. Required independent review evidence

| Canonical domain ID       | Required disposition                                                                | Current state                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `nephrology`              | Named nephrologist; accepted candidate/manifest/ledger/scope-bound attestation      | Pending                                                                                           |
| `critical-care`           | Named critical-care physician; accepted candidate/manifest/ledger/scope attestation | Pending; user has offered this role, but identity, credentials, scope, and attestation are absent |
| `crrt-nurse-education`    | Named CRRT nurse educator; accepted candidate/manifest/ledger/scope attestation     | Pending                                                                                           |
| `prismax-device`          | Trained reviewer for the exact target market/software/configuration                 | Pending                                                                                           |
| `accessibility`           | Manual supported browser/AT/reflow/motion review and defect closure                 | Pending                                                                                           |
| `localization`            | Reviewed English and any released-language/fallback decision                        | Pending                                                                                           |
| `privacy-data-governance` | Telemetry, detailed progress, retention, access, deletion, and export disposition   | Pending                                                                                           |
| `entitlement-security`    | Pilot/reviewer cohort, authorization, audit, support, and withdrawal disposition    | Pending                                                                                           |
| `product-owner`           | Audience, supervision, competency, operations, support, risk, and activation scope  | Pending                                                                                           |
| `publication-approval`    | Exact-version final approval after every applicable gate                            | Pending                                                                                           |

Prismaflex device, cross-device equivalence, protocol-owner, pharmacy, and nutrition reviews are
additional conditional domains when those surfaces are in scope. For the current Phase 8 scaffold,
those prerequisites remain absent and Prismaflex stays outside the learner runtime.

The runtime domain vocabulary accepts `cross-device-equivalence`, and the Phase 8-aware activation
and publication resolvers require it together with `prismaflex-device`. A resolver pass cannot
establish that a review occurred: Phase 8 remains closed until both exact-candidate attestations and
the separate controlled Phase 8 authorization are verified.

## 9. Validation disposition

The current evidence supports only this statement:

> The three-case draft executes deterministic, tested engine and learning-workflow contracts with
> source-mapped synthetic values, strict privacy/release boundaries, and preliminary accessibility
> engineering. Phase 7 and Prismaflex reviewer artifacts fail closed without expanding that
> runtime. The module remains unvalidated for clinical/device fidelity, independent accessibility
> use, competency, expanded pilot access, or publication.

The Phase 7/8 reviewer-candidate foundation has reached its fail-closed engineering stopping
boundary, but formal activation remains closed until the required reviewers accept an exact frozen
candidate and the separate authorization records are complete. Formal Phase 8 activation cannot
begin until reviewed PrisMax v1 is stable and the separate Prismaflex and cross-device prerequisites
are satisfied; the reviewer scaffold does not meet that gate.
