# Bronchoscopy Foundations: core build and preservation plan

This takeover completes the core module described in the handoff: 23 Learn sections across 18 core modules, 22 paired Practice cases, and an eight-case capstone. The user authorized continued implementation, improvements, reuse of repository assets, and new Blender/Slicer assets. The handoff and prior plan supplied context; their former Claude/Codex ownership split is superseded by the takeover.

The implementation remains public by direct link, unlisted and noindex at `/en/bronchoscopy-foundations`. Faculty approval, public promotion and the `/intro-bronchoscopy` cutover are separate release decisions. Optional E01–E04, additional anatomy profiles and gamepad input remain outside this core round and are not represented as completed.

## Starting point and reference

The inherited work was the clean `claude/intro-to-bronch-9-10` handoff at `5c69b94f`. An independent `codex/bronchoscopy-foundations-build` checkout preserved that work and incorporated `origin/main` at `8ebcf9ed`. No active Claude checkout was changed.

The reference is the existing shared learning stage and `ImagingStageHost`, with `Steps → Teaching → Simulator`, fractions 0.26/0.29/remainder and minimum widths 300/280/340 px. The existing `BronchStageHost` already used this contract. The scope renderer replaces the placeholder within that host. The shared stage and admin airway primitives are reused without edits.

## Learning and progress contract

The audience is clinicians beginning supervised flexible bronchoscopy. Teaching supports recognition, explanation, decisions and simulated navigation. Physical handling and supervised clinical performance require faculty observation; no app completion state establishes independent competence.

Each section uses its authored Recognize → Predict → Act → optional Observe → Explain → Transfer sequence. The first prediction locks controls; actions and observed events, rather than elapsed time or a Continue click, satisfy the activity. Completion, first decisions and input/assist provenance remain distinct. First decisions are immutable and correctness is recomputed from the item bank. Reload restarts an incomplete section at its first step while retaining earlier first decisions; it does not restore an unsaved camera position.

Learn and paired single-case Practice expose rationales after submission. The multi-case capstone withholds rationales and paired-lesson links until all eight decisions, except immediate safety feedback for an unsafe choice. Its standard remains at least seven held decisions, every critical decision held and no unsafe choice. Optional extensions never contribute to that standard.

## Canonical sequence

The following table is derived from `bronchStageLessons()`. Its 181 minutes are authored estimates, not required exposure time.

| Order | Stable section            | Title                                                 | Main activity | Minutes |
| ----: | ------------------------- | ----------------------------------------------------- | ------------- | ------: |
|     1 | `shared-airway`           | The airway you share                                  | sort          |       5 |
|     2 | `clinical-question`       | The request and the plan                              | sort          |       6 |
|     3 | `pre-use-check`           | The bronchoscope before use                           | identify      |       7 |
|     4 | `sedation-and-monitoring` | Topical anesthesia, sedation and monitoring           | ledger        |       7 |
|     5 | `five-controls`           | The five controls at the scope                        | scope-lab     |       8 |
|     6 | `branch-entry`            | Entering a branch and coming back                     | scope-lab     |       9 |
|     7 | `reference-frames`        | Three frames of reference                             | identify      |       8 |
|     8 | `view-loss`               | Losing the view                                       | scope-lab     |       9 |
|     9 | `larynx-and-entry`        | The larynx and entry to the trachea                   | scope-lab     |       7 |
|    10 | `right-side`              | The right bronchial tree                              | scope-lab     |      10 |
|    11 | `left-side`               | The left airways                                      | scope-lab     |      10 |
|    12 | `systematic-survey`       | A systematic survey and its record                    | scope-lab     |      10 |
|    13 | `describe-findings`       | Findings in the airway                                | report        |       8 |
|    14 | `washing-and-lavage`      | Washing, lavage and aspiration                        | sequence      |       8 |
|    15 | `poor-return`             | When the lavage does not come back                    | scenario      |       8 |
|    16 | `protected-accessories`   | Accessories in the working channel                    | scope-lab     |       8 |
|    17 | `specimen-pathway`        | The specimen, from question to laboratory             | sort          |       7 |
|    18 | `deterioration`           | When the patient’s state changes during an inspection | scenario      |       8 |
|    19 | `bleeding-priorities`     | Bleeding during bronchoscopy                          | scenario      |       8 |
|    20 | `scope-in-a-tube`         | The scope inside an artificial airway                 | scope-lab     |       7 |
|    21 | `icu-physiology`          | Ventilator breaths and procedures beyond inspection   | sort          |       8 |
|    22 | `honest-report`           | The report and the handoff                            | report        |       9 |
|    23 | `what-completion-means`   | What a training file shows                            | sort          |       6 |

## Preservation map

| Existing capability                                             | Final implementation                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Source locations, review register, coverage, local-policy nulls | Preserved; limited display wording changed, raw imported sources retained                         |
| LPS anatomy graph, labels, transport frames, collision geometry | Preserved; display and collision share the cached lumen geometry                                  |
| Scope reducer, guards, events, inspection semantics             | Preserved; real authored bench/larynx poses added for rendering                                   |
| Scope command/DOM contract                                      | All seven modes implemented; locks, readouts, tree answers, goals and declarations retained       |
| Teaching images and CT correlation                              | Existing media reused; 94-file review inventory added; all clearance statuses remain pending      |
| Draft route, progress key, first attempts and capstone standard | Preserved; premature capstone rationales fixed                                                    |
| Admin airway module and shared workbench                        | Imported primitives retained; no stage or rendering primitive fork                                |
| Reversible WebGL-free operation                                 | Explicit schematic alternative after renderer failure; missing collision geometry requires reload |

## Added assets and release limits

Blender generated an asymmetric bench target, a movable scope handle, a distal scope tip and generic practice geometry. The larynx and six accessory states are reused. Devices and prop dimensions are authored teaching values. They are not manufacturer specifications, clinical findings or reconstructed lecture visuals.

The existing larynx exit still has a 2.4168 mm maximum gap to the unchanged capped source inlet. Rendering hands off to the tracheal model at the authored boundary; it does not establish a continuous lumen. Resolving that conflict requires a documented inlet/deviation decision and fresh geometry review. Clinical and rights approval are not inferred from technical checks.

See [validation](validation.md), [scope implementation](scope-pane.md), [asset provenance](scope-assets.md), [acceptance report](implementation-report.md) and the [faculty review packet](faculty-review-packet.md).
