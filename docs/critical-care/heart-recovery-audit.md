# Heart recovery audit

## Recovery baseline

- Recovery source: `heart-branch-clinical-visual-recovery-plan.md`
- Working branch: `codex/heart-recovery`
- Architectural prototype preserved at: `heart` / `origin/heart`
- Main comparison point: `origin/main` (`2bc9841`)
- Baseline validation on 2026-07-22:
  - `npm run type-check`: passed
  - focused critical-care Jest run: 105 suites, 984 tests passed
- Existing work preserved before recovery edits:
  - 14 modified hemodynamics/catalog files
  - 10 new hemodynamics teaching, waveform, and troubleshooting files
  - 416 MB local `critical_care_references/` library

The recovery branch begins at the current `heart` head instead of switching the
dirty worktree back to `main`. This is intentional: the supplied hemodynamics
recovery work is uncommitted and depends on files introduced on `heart`.
`origin/main` remains the visual and native-workbench comparison baseline. No
learner progress key will be renamed or migrated in place.

## Reference inventory

The local reference library is not a publishable application asset. It is used
as a source workspace and remains outside the learner bundle.

- Hemodynamics: PAC reviews, waveform chapters, equations, and four authored
  knowledge/technical documents.
- Mechanical ventilation: an authored simulator casebook, dyssynchrony review,
  Tobin chapters, and PB980, Evita, and AVEA source manuals.
- Mechanical circulatory support: an authored bedside reference plus shock,
  perioperative, and ICU MCS reviews.
- ECMO: an authored case document, a simulation book, troubleshooting figure,
  an ECMO overview, and physiology/management chapters.
- CRRT: CRRT/dialysis chapters, a principles review, and competency guidance.

Clinical facts, device workflows, and modeled behavior remain separate review
categories. Supplied sources may inform reviewed copy and scenarios, but they
do not silently change engine calculations, score weights, thresholds, critical
errors, or device ranges.

## Root-cause confirmation

The current `ActivityShell` mandates a three-column patient/viewport/task grid.
`McsWorkbench`, `CardiohelpWorkbench`, `CrrtActivityWorkspace`,
`MechanicalVentilationCaseActivityV2`, and the integrated ICU simulator place
already complete native workbenches inside that center viewport. The existing
`criticalCareShellConvergence` test also enforces fixed-height nested geometry.
This is the primary visual regression to reverse.

The current ventilation Learn implementation confirms the content regression:
all eight lessons award the same five competencies, render
`BreathSequenceVisual`, expose software implementation language, and complete
transfer through generic choice/click behavior. MCS and CRRT still expose
manual “Mark lesson complete” controls. Hemodynamics assessment always starts
HD-07 while copy claims seeded masking.

Recovery note: PRs 1–7 now remove those learner-facing truthfulness and
completion regressions. This paragraph records the confirmed starting state;
the workstream table below is the current implementation status.

## Keep / change / delete matrices

### Shared critical-care platform

| Keep                                                                                                              | Change                                                                                                                                 | Delete or demote                                                                       |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Dashboard, catalog, pathways, local-first progress, reference/evidence drawers, launch gates, stable activity IDs | Add content versions, evidence-authority rules, truthful resume capability, typed clinical context, adaptive frames, and feature flags | Mandatory three-column geometry and tests that require nested fixed-height workbenches |

### ICU Hemodynamics

| Keep                                                                                                                                                                             | Change                                                                                                                                                                                                                           | Delete or demote                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `BedsideMonitor`, `PhysiologyPanel`, `HemodynamicHeart3D`, `PacActionDock`, `PacSkillsLab`, `FormulaDrawer`, `PressureSystemTeachingVisual`, waveform and thermodilution engines | Restore the native multi-surface case workspace; make HD-08 presentation persistent; require separate level, zero, fast-flush, position, thermodilution, reassessment, and transfer evidence; make assessment selection truthful | Generic bundled action buttons, self-attested transfer, fixed HD-07 “seeded” claim |

### Mechanical ventilation

| Keep                                                                                                                                                               | Change                                                                                                                                                                                                | Delete or demote                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BedsidePanel`, `MechanicalVentilatorConsole`, `WaveformStrip`, case physics/reducer, device profiles, `CaseWorkflow`, semantic replay, existing cases and scoring | Build engine-backed lesson presets with actual waveforms/console/patient context; assign lesson-specific competencies; use a scored transfer variant; frame Practice/Assess as native case workspaces | `BreathSequenceVisual` as the primary visual, “Apply the bounded teaching action,” software-behavior questions, broad five-competency Learn awards, self-attested transfer |

### Mechanical circulatory support

| Keep                                                                                                                              | Change                                                                                                                                                                          | Delete or demote                                                              |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `McsAnatomy3D`, `McsMonitor`, `McsControls`, `McsCaseWorkflow`, mechanism studio, cases, scoring, critical errors, capstone gates | Use native-workbench chrome; track the active authored lesson step; require step interactions; expose complete shock/device context; add an authored loading-condition transfer | Nested shell, stale `steps[0]` guidance, manual lesson completion as evidence |

### CARDIOHELP ECMO

| Keep                                                                                                                    | Change                                                                                                                                                                             | Delete or demote                                        |
| ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| VV/VA tracks, `CardiohelpConsole`, `CircuitAndMonitors`, lesson/case players, cases, alarms, scores, evidence, debriefs | Use native-workbench chrome; propagate active lesson/case stage; expose mode/configuration/flow/pressure/sweep/patient context; require authored interaction and transfer evidence | Nested shell and outer guidance fixed to the first step |

### Baxter CRRT

| Keep                                                                                                                   | Change                                                                                                                                                           | Delete or demote                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Curriculum, circuit, PrisMax surface, prescription workbench, pressure lab, cases, drills, capstone, evidence registry | Restore document-flow Learn and full case workspace Practice/Assess; add clinical anchors; map raw device IDs; consume validated embedded-lab/retrieval evidence | Nested curriculum rail, learner-facing raw IDs, learner “Mark lesson complete” as a completion predicate |

### Integrated ICU simulator

| Keep                                                                                                                                | Change                                                                                                                                                | Delete or demote                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| One patient/clock/replay/worker, monitor, bedside scene, clinical/device panels, timeline/course guide, assessment masking, scoring | Use thin activity chrome with a compact live patient strip; preserve all four native surfaces; report validated outcomes to dashboard and remediation | Outer universal shell and duplicated case/progress/task/context surfaces |

## PR workstream status

| Workstream                                     | Status   | Release evidence                                                                                                                                                                                                                                           |
| ---------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR 0 — baseline and feature flags              | Complete | This audit, feature-flag tests, unchanged progress keys                                                                                                                                                                                                    |
| PR 1 — progress and labeling truthfulness      | Complete | Content-integrity and normalized-progress tests                                                                                                                                                                                                            |
| PR 2 — adaptive shared chrome                  | Complete | Layout stories/tests and visual-area comparison                                                                                                                                                                                                            |
| PR 3 — hemodynamics restoration                | Complete | Interaction tests and required visual states                                                                                                                                                                                                               |
| PR 4/5 — ventilation Learn and Practice/Assess | Complete | Eight engine-backed lessons, sixteen reviewed items, fifteen scored case transfers, masked-workspace and resume tests                                                                                                                                      |
| PR 6 — CRRT recovery                           | Complete | Single-column didactic Learn, seven patient application items, explicit prescription/pressure-lab evidence, full-first case workspace, live case context/task tests, 35 suites and 275 CRRT tests                                                          |
| PR 7 — ECMO and MCS recovery                   | Complete | Full-width native workbenches, live lesson/case task callbacks, expanded observable context, eight MCS loading transfers, twenty ECMO scenario transfers, and 178 focused MCS/ECMO tests                                                                   |
| PR 8 — ICU/dashboard convergence               | Complete | Thin native ICU frame, four preserved simulator surfaces, approved-only Assess gates with explicit Preview access, authoritative dashboard recommendations, privacy-safe aggregate ICU outcomes, direct full-lab routes, and 22 suites / 181 focused tests |
| PR 9 — release gate                            | Complete | Engineering matrix passed; item, route, privacy, accessibility-contract, and release-stage audits recorded below. Publication remains HOLD pending clinical/device/model and manual visual/accessibility sign-off                                          |

## PR 9 engineering and publication gate

### Full item inventory

The recovered catalog contains 133 stable activities across all six modules:

| Module                         | Activities |
| ------------------------------ | ---------: |
| ICU Hemodynamics               |         16 |
| Mechanical Ventilation         |         24 |
| Mechanical Circulatory Support |         20 |
| CARDIOHELP ECMO                |         36 |
| Baxter CRRT                    |         25 |
| Integrated ICU Simulator       |         12 |

Release authority remains deliberately fail-closed:

- 77 activities are `sme-review`; 56 are `draft`; none are `released`.
- 49 activities are non-credit and have no completion authority.
- 28 activities are completion-only.
- 56 activities are competency-eligible, but only their declared,
  authoritative evidence can be recorded.
- Draft ICU outcomes are normalized to completion-only with no competency
  evidence. They cannot appear as mastered.
- An ICU Assess hard gate can use only a `released`, competency-eligible
  preparation activity. With the current catalog, preparation remains advisory
  and Assess is explicitly labeled Preview.

Recovery-authored clinical items and transfers are separately inventoried:

| Recovery content                          | Count | Automated contract                                                                                           |
| ----------------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------ |
| Hemodynamics prediction/transfer items    |    12 | Distinct context, three rationale-complete choices, registered evidence, SME-review status                   |
| Ventilator prediction/transfer items      |    16 | Distinct engine-backed primary/transfer patients, registered evidence, no software-internal learner copy     |
| Ventilator scored case transfers          |    15 | One contrasting case per source case; masked Assess transfer; completion after scored transfer only          |
| MCS loading-condition transfers           |     8 | One per lesson; distinct variant; simulator setup plus required observed action                              |
| ECMO guided lessons and transfer variants | 20/20 | One same-mode authored transfer scenario per lesson; no self-attestation action                              |
| CRRT patient application items            |     7 | One per lesson; four or more context facts, rationale-complete choices, registered evidence                  |
| Integrated longitudinal ICU scenarios     |     6 | Pending review, private-development, validated outcome adapter, strict public count/timestamp aggregate only |

The 416 MB `critical_care_references/` directory remains a source workspace. No
absolute path, source document, or copied reference image is imported by the
application, included in the public client graph, or registered as a shipping
asset.

### Clinical-content diff and review disposition

| Module         | Clinical facts                                                                                        | Device workflow                                                                           | Modeled behavior                                                                                         | Publication disposition                     |
| -------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Hemodynamics   | Adds sourced PAC validation, waveform morphology, wedge-validity, troubleshooting, and transfer items | Separates level, zero, fast flush, position, thermodilution, and reassessment actions     | Adds explicit artifact/morphology states and persistent HD-08 recovery checkpoints; regression-tested    | Unlisted preview; SME review still required |
| Ventilation    | Replaces generic questions with eight source-bound lesson pairs and fifteen contrasting transfers     | Preserves four device consoles and confirmation semantics                                 | Uses existing case physics/reducer for Learn and scored transfer; lesson completion remains non-credit   | Tester preview; checklist sign-off pending  |
| MCS            | Adds eight loading-condition transfer cases and fuller shock/device context                           | Preserves IABP, Impella, and durable-LVAD native controls                                 | Preserves scoring, critical errors, and support model; external directionality verification still open   | Unlisted preview; release gates remain open |
| ECMO           | Adds twenty authored, same-mode transfer variants                                                     | Preserves VV/VA console, circuit, alarms, clamps, sweep, RPM, flow, and pressure surfaces | Preserves reducer, cases, capstones, score, and critical-error behavior                                  | Draft; multidisciplinary review required    |
| CRRT           | Adds seven patient applications and reviewed source anchors                                           | Preserves PrisMax, prescription, circuit-pressure, retrieval, and alarm workflows         | Preserves current engine, cases, capstone, dose/delivery, pressure, and fluid models                     | Unlisted preview; review remains pending    |
| Integrated ICU | Does not change scenario facts in PR 8                                                                | Preserves monitor, bedside, diagnostics/care, device, and course/timeline surfaces        | Preserves shared clock, worker, replay, masking, and scoring; validates outcomes before coarse reporting | Private development; Preview only           |

Passing software tests does not convert these rows into clinical, device, or
modeled-behavior approval. The source-owned release stages and review
checklists remain authoritative.

### Visual and accessibility evidence

| Required surface | Automated evidence                                                                                                                   | Human gate |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Shared frames    | Storybook builds guided, native-workbench, case-workspace, didactic, challenge, dark, masked, tablet, mobile-gate, and resume states | Open       |
| Hemodynamics     | Monitor, pressure-system, PAC advancement, wedge, thermodilution, waveform, case/transfer, and debrief component tests               | Open       |
| Ventilation      | Engine-backed waveform/console lessons, dyssynchrony/alarm cases, masked assessment, transfer, and exact/safe resume tests           | Open       |
| MCS              | IABP, Impella, LVAD, native workbench, active workflow, transfer, debrief, keyboard, and text-equivalent tests                       | Open       |
| ECMO             | VV/VA lessons, console/circuit, alarm/capstone, transfer, keyboard/pan, reduced-motion, and text-alternative tests                   | Open       |
| CRRT             | Didactic Learn, prescription, pressure localization, full case workspace, capstone, keyboard, reflow, and reduced-motion tests       | Open       |
| ICU Simulator    | Four native surfaces, compact live context, mobile launch gate, masking, replay, course boundary, outcome, and debrief tests         | Open       |

Automated coverage includes keyboard operation, non-color status, text
alternatives, 44-pixel targets, reduced-motion CSS, a 390 × 844 launch gate,
and desktop activity tests at 1440 pixels. It does not constitute manual
verification at 1440 × 900, 1280 × 800, 1024 × 768, tablet portrait, phone,
200% zoom, or representative assistive technology.

Live localhost browsing and screenshot capture were denied by the browser
tool's local-page security policy in this session. No baseline screenshot or
golden-image comparison is therefore claimed. Module-specific golden
Screenshot/Storybook states and human viewport comparison remain an explicit
publication gate rather than being silently waived.

### Privacy and outcome authority

- Public route source and client dependency graphs exclude the private ICU and
  ECMO catalogs, restricted adapters, and simulator runtimes.
- Public progress strips restricted activity IDs and resume pointers.
- The restricted ICU outcome adapter validates the activity against the full
  private catalog, applies completion/competency authority, then writes a
  separate strict aggregate containing only version, unique completed-course
  count, and latest completion time.
- The public reader never infers outcomes from an arbitrary `icu:*` normalized
  record and rejects aggregate records containing any additional identity
  field.
- Analytics schemas reject free text, PHI-like fields, physiology, waveform
  arrays, settings, command histories, and replay payloads.
- Detailed patient state and semantic replay remain local to the simulator.

### Human gates and release decision

The engineering recovery does not authorize publication. These gates remain
open:

1. Module-specific clinical-fact review.
2. Device-trained workflow review for each represented platform.
3. Modeled directionality, bounds, scoring, critical-error, and acceptable-path
   review.
4. Manual baseline comparison at every required viewport.
5. Keyboard-only, 200% zoom, 320-pixel reflow, supported-browser, and
   representative assistive-technology review.
6. Evidence/publication-owner approval and the source-owned module checklists.

Therefore:

- No activity or clinical item is promoted to `released` or `approved`.
- No module release stage is promoted.
- No transitional feature flag is removed.
- Public pathways and under-review activities remain visibly labeled Preview.
- The publication decision is **HOLD** until the human gates above are signed.

### Verification record

Final engineering checks on 2026-07-22:

| Gate                                    | Result                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| `npm run type-check -- --pretty false`  | Passed                                                                          |
| `npm run lint`                          | Passed with zero errors and the same 14 unrelated warnings recorded at baseline |
| Recovery-scope `prettier --check`       | Passed                                                                          |
| `git diff --check`                      | Passed                                                                          |
| PR 8 ICU/dashboard regression set       | 22 suites, 181 tests passed                                                     |
| Final `npm test -- --runInBand`         | 300 suites, 2,191 tests passed                                                  |
| `npm run storybook:build`               | Passed; static Storybook produced                                               |
| `npm run validate:critical-care-assets` | 19 assets validated, including lightweight alternatives for all 5 heavy assets  |
| `npm run validate:cardiac-assets`       | 7 cardiac-device assets, CT heart, and 9 provenance-tagged routes validated     |
| `npm run build`                         | Passed; optimized Next build and standalone output produced                     |

The build retains the repository's existing Mermaid dynamic-require and
`metadataBase` warnings; neither is introduced by the recovery. Storybook
retains its existing large-chunk advisory. Jest emits the environment's
existing `--localstorage-file` warning but completes with no failed test.

The automated recovery gate is complete. The absence of module-specific golden
screenshots and signed human review is intentionally represented by the
publication HOLD, not by a false automated failure or an unsupported release
promotion.
