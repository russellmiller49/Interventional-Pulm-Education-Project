No human observation is being reported.

# B6 frozen human-test baseline

This record separates the six-panel build reserved for formal human think-aloud sessions from the synthetic preflight and draft authoring on this branch. Synthetic review can generate hypotheses, reproduce technical behavior, and author draft panels; it does not validate usability, competency, readiness, or the prevalence of any human response.

## Baseline gate

| Gate                    | Verified result                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Primary prerequisite    | PR [#76](https://github.com/russellmiller49/Interventional-Pulm-Education-Project/pull/76) was merged on 2026-08-06 before B6 began. |
| Worktree                | `/Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/codex-ecmo-b6`                                                |
| Branch                  | `codex/ecmo-b6-synthetic-curriculum-studio-2026-08-10`                                                                               |
| Frozen production SHA   | `2f26cb7632fe4e8f6835a8528458b672e8f360c2`                                                                                           |
| `HEAD` at start         | `2f26cb7632fe4e8f6835a8528458b672e8f360c2`                                                                                           |
| `origin/main` at start  | `2f26cb7632fe4e8f6835a8528458b672e8f360c2`                                                                                           |
| Ahead / behind at start | `0 / 0`                                                                                                                              |
| Worktree at start       | Clean                                                                                                                                |

The branch must remain unmerged and undeployed until the B5 human findings have been reconciled. The fourteen panels authored in B6 remain draft and non-credit-eligible. Publication status, Practice behavior, Assess behavior, persistent IDs, progress, storage, and scoring are outside the permitted change surface.

## Six learner-copy pilot panels

The SHA-256 values below were captured before B6 edits. A B6 automated contract repeats these checks from the repository root, so a copy change is a test failure rather than an assertion in prose.

| Pilot scenario               | Frozen file                                                    | SHA-256                                                            |
| ---------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| `startup-sensor-orientation` | `components/teaching/drills/StartupSensorOrientationPanel.tsx` | `dc65b3c5c85c4f2b55653e1cfd73b756b7528d18891a976eff7a96b439873278` |
| `preload-drainage-collapse`  | `components/teaching/drills/PreloadDrainageCollapsePanel.tsx`  | `fdac41e48bd5d47588d401f119d5ec6a95f745ce142cde64b9493aa79f4ba21a` |
| `vv-recirculation`           | `components/teaching/drills/VvRecirculationPanel.tsx`          | `c70f0a47dc4dd82607ecc9b5a988675498ed44deef410116a106a53829cea5a8` |
| `gas-source-interruption`    | `components/teaching/drills/GasSourceInterruptionPanel.tsx`    | `efdbeea5a644768df3d14a75354864cfa397d40186cd5d60e2313032d1ff0757` |
| `arterial-bubble-stop`       | `components/teaching/drills/ArterialBubbleStopPanel.tsx`       | `c1ddbd29e484ba9c6f12e9ae9271e95bd89d5f40285dfa5c2e91d1e34528ee01` |
| `va-differential-hypoxemia`  | `components/teaching/drills/VaDifferentialHypoxemiaPanel.tsx`  | `67bc66cf40e404fc3983f41e63bd0da7b45691f46b3f13c5688190ff21b3ef14` |

All file paths in this table are relative to `src/features/cardiohelp-ecmo/`.

## Protected learner and persistence surfaces

| Surface                                      | Frozen file                                      | SHA-256                                                            |
| -------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| Guided lesson copy and transfer definitions  | `content/learnLessons.ts`                        | `8b3890748c94399788c8c3ee3a4f86f2b77f9a8183c1c516870b82c79ccacfbd` |
| Twenty prediction items and verdict copy     | `content/learnPredictionItems.ts`                | `f094fce4bbec9267e1429c1288e32100ba5e277b136104b08b83bc551886490b` |
| Practice case definitions and scoring inputs | `content/clinicalCases.ts`                       | `85571569edc8ecae1c54d350ae6ac820b725d00491e2b4c5abdaa1228e55683d` |
| Practice support                             | `components/PracticeCasePlayer.tsx`              | `558a4c85661a62b846513891d93208dc08668cb90b41ff3cb842e2627aa978ed` |
| Practice route                               | `app/[locale]/cardiohelp-ecmo/practice/page.tsx` | `e9940ac427b39deaa86710fa411d8f0b4172a283f40d7095b06cf65cf313dbf0` |
| Assess route                                 | `app/[locale]/cardiohelp-ecmo/assess/page.tsx`   | `c1aaae509869b131be78d7ad57602cacb7457137f172a8ecd0cb700550d7589c` |
| Progress/storage contract                    | `engine/progress.ts`                             | `c436121aad538b6a33e6396b194e4a4505e6acbc47ea68fe2a92e44654cadb3f` |
| Engine reducer and scoring transitions       | `engine/reducer.ts`                              | `f5cb36fc25d3fa373ee1ef2b8d304effa19e85f86bdfc54989fde1730bedd153` |
| Engine response curves                       | `engine/simulation.ts`                           | `f9237f2d6648da696bcca614868daae0c76cec24fe7e91134c0caff7a819c79e` |
| Scenario IDs, actions, and debriefs          | `content/scenarios.ts`                           | `5361145ee1d0a41e6e67f30f68b28596c93b25354a8710663afa38325452c20b` |
| Reference profiles                           | `content/referenceProfiles.ts`                   | `b044c7707447da07f821e06c52a22c1e4c21c1b850cf33d22036fcfd46a5c703` |
| Shared module navigation                     | `components/CardiohelpModuleNav.tsx`             | `354b0a8f2c3f18df50d6aa3bedfbaf5ad9608260b683a40f258c661dc7f071c5` |
| Curriculum IDs and Learn–Practice pairing    | `content/curriculum.ts`                          | `f60c416c610d29fe653e4cd33bd862c369394ebc58aab024c224443de50c1142` |
| Module overview route                        | `app/[locale]/cardiohelp-ecmo/page.tsx`          | `ba7a757d51ebb9da6af5ea0e595e2e0749b8e16e24e11255f84899c9f644e8c2` |
| Learn route                                  | `app/[locale]/cardiohelp-ecmo/learn/page.tsx`    | `bc1073c07b1f684f6c493fc7639d72100adaa0b2c88729dee56a25b6b5bea251` |
| Module registration                          | `critical-care/content/modules.ts`               | `412b0582f3d584fd7c900a1b683c090d711bd75eed5a1478e71d120243559554` |
| Activity IDs                                 | `critical-care/content/activities.ts`            | `51acfb70880e415122df5924f1d7e4f2dd21c9d04bf382509d441c418996f083` |
| Public-visibility rules                      | `critical-care/content/publicVisibility.ts`      | `03055ed541237d1e550d5259a2cf20d5b0ad10236e72e14c3c989a2633bf7607` |
| Device profile and publication status        | `content/deviceProfile.ts`                       | `66ae1de4572318d4b22105ff1bbfb9105a2fd2bf0b94879b6ad8f5703d72a8a3` |
| Persistent engine types and IDs              | `engine/types.ts`                                | `c7ab36e3490bb51eaa40f6e443ccb700bf1c1120722728d8bfa727541be1d91e` |
| Module routes                                | `learning-module/moduleRoutes.ts`                | `c2c82828c5a0a094232b3b33877be02b2cb3cefd0913eb6ed9753028c7207d68` |
| Shared workbench                             | `components/CardiohelpWorkbench.tsx`             | `37dc2293cc32ffb52d5a3e7f51cbd7a0f802def843265b04ae3764f98ae14f3e` |

Paths beginning with `app/`, `critical-care/`, or `learning-module/` are relative to `src/`; the others are relative to `src/features/cardiohelp-ecmo/`. The frozen device profile reports publication status `draft`.

## Start-state verification

Before authoring, the complete CARDIOHELP feature suite passed: 35 suites and 1,038 tests. `npm run dump:ecmo-signals` also completed with zero flags. These results establish the state that B6 inherited; they are not the final verification for the branch.

## Separation rule

The B5 human instruments and their findings template remain unchanged. B6 synthetic artifacts live only under `docs/cardiohelp-ecmo/synthetic-review/`; they must not be copied into a human observation field. Reconciliation occurs after the human sessions by mapping each synthetic item to one of the explicit outcomes in `b6-human-findings-reconciliation-template.md`.
