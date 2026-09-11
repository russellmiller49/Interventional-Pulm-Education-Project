# Repository map — where the copy lives and what guards it

Checked against `main` at `9a23facf` on 2026-09-10. Paths and tests move: confirm with `git grep`
before relying on a line here, and correct this file when you find drift.

## Worktrees, ownership and shared files

- Task worktrees are cut from `origin/main`. `…/Worktrees/Worktree prompts/New_Claude_Worktree.command`
  makes `…/Worktrees/claude-<slug>` on `claude/<slug>` and runs `npm ci`. This skill exists in
  every worktree whose branch contains it; an older branch gets it by merging `main`.
- The pre-commit hook blocks commits on `main`, checks staged PDFs and runs lint-staged (ESLint on
  `ts`, `tsx`, `js` and `jsx`; Prettier on those plus `json`, `md` and `css`). It refuses to run without
  `node_modules`.
- If `npm run type-check` reports contentlayer errors in a fresh worktree, run
  `npm run build:content` (or copy `.contentlayer` from a checkout at the same commit).
- **One module per worktree**, so parallel module passes never edit the same files.
- **Hands-off unless the task selects them** — note what they need for the owner instead:
  - `src/features/learning-module/**` — the shared lesson stage, the clinical-item schema and the
    shared copy gate. Their strings render in every stage module.
  - `src/features/critical-care/content/**` — the shared catalog. Take only the additions the
    module's own pathway needs.
  - Files another agent owns inside a module, such as Codex's
    `peripheral-imaging/components/suite/**` and `scripts/peripheral-imaging/**`. PR #169 changed
    string literals only there and named them in the PR description; do the same, or leave them.
- `messages/{en,es,zh-CN}.json` are shared files: edit only the module's namespace, and keep the
  keys identical across the three (`src/i18n/translations.test.ts`).

## Modules

| Domain | Feature (`src/features/…` unless noted)                                                                                                                                                                                     | Route (`/[locale]/…`)                                 | Access                                                     | Profile                |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------- | ---------------------- |
| IP     | `peripheral-imaging` — the style baseline (PR #169); don't redo it unless selected                                                                                                                                          | `/peripheral-imaging`                                 | public-unlisted                                            | IP                     |
| IP     | `intro-bronchoscopy`                                                                                                                                                                                                        | `/intro-bronchoscopy`                                 | session                                                    | IP                     |
| IP     | `rigid-bronchoscopy`, `rigid-bronchoscopy-techniques` (drills from `skill-lab`)                                                                                                                                             | `/rigid-bronchoscopy`                                 | session                                                    | IP — rigid             |
| IP     | `pleuroscopy` (drills from `skill-lab`)                                                                                                                                                                                     | `/pleural-procedures/pleuroscopy`                     | session                                                    | IP — pleural           |
| IP     | Pleural family: `thoracentesis-planner`, `pleural-fluid-analysis`, `pleural-infection`, `pneumothorax-pathway`, `malignant-effusion`, `pleural-ultrasound`, `chest-drainage`, `intro-pleural-course`, `pleural-dataset-lab` | `/pleural-procedures/*`                               | session (the ultrasound simulator page is public-unlisted) | IP — pleural           |
| IP     | `airway-stent-mechanics`, `tracheostomy`, `rapid-onsite-cytology`                                                                                                                                                           | same names                                            | session                                                    | IP, then coverage gaps |
| IP     | EBUS course — `EBUS-course/` at the repository root, built into `public/socal-ebus-course/app`                                                                                                                              | `/socal-ebus-course`                                  | session and entitlement                                    | IP — EBUS              |
| IP     | Navigation trainer — `navigation_module/`, built into `public/bronch-navigation-trainer/app`                                                                                                                                | `/bronch-navigation-trainer`                          | see `access.ts`                                            | IP                     |
| IP     | Single-file pages `public/thermal-ablation/`, `public/peripheral-ablation/`                                                                                                                                                 | same names                                            | see `access.ts`                                            | coverage gaps          |
| CC     | `icu-hemodynamics` (with `hemodynamics-core`)                                                                                                                                                                               | `/icu-hemodynamics`                                   | public-unlisted                                            | hemodynamics           |
| CC     | `mechanical-ventilation`                                                                                                                                                                                                    | `/mechanical-ventilation`, `/hamilton-c6-ventilation` | public-unlisted                                            | ventilation            |
| CC     | `cardiohelp-ecmo`                                                                                                                                                                                                           | `/cardiohelp-ecmo`                                    | public-unlisted                                            | ECMO                   |
| CC     | `mechanical-circulatory-support`                                                                                                                                                                                            | `/mechanical-circulatory-support`                     | public-unlisted                                            | coverage gaps — MCS    |
| CC     | `baxter-crrt`                                                                                                                                                                                                               | `/baxter-crrt`                                        | public-unlisted                                            | coverage gaps — CRRT   |
| CC     | `critical-care` (hub and shared catalog), `icu-simulation`                                                                                                                                                                  | `/critical-care`, `/icu-simulation`                   | public-unlisted; session                                   | by topic               |

Access comes from `src/lib/site-auth/access.ts`: paths in `PUBLIC_UNLISTED_EXACT_PATHS` and
`PUBLIC_UNLISTED_PATH_PREFIXES` render without a session; everything else needs one, and some paths
also need an entitlement or site admin. Other clinical modules (`pccm-intro-course`,
`cardiac-anatomy`, board review) use the coverage-gap workflow.

## Where learner-facing copy lives

- **Stage modules** (peripheral-imaging, icu-hemodynamics, mechanical-ventilation,
  mechanical-circulatory-support, cardiohelp-ecmo): `content/*.ts` registries — typically
  `sectionSpecs.ts`, `stageLessons.ts`, `stageItems.ts`, `controlPanel.ts`, the troubleshooting or
  grammar table (`grammar.ts`, `signalGrammar.ts`, `breathGrammar.ts`), spine or chain files,
  `storyProblems.ts`, `microCases.ts`, sorts; ECMO adds `drillSpecs.ts` and
  `learnPredictionItems.ts` — plus `data/*.ts` where present (`lessons.ts`, `questions.ts`,
  `resources.ts`). Most validate at import, so a refused word throws before any test runs.
- **Components**: JSX text; `aria-label`, `alt`, `title` and `placeholder`; template literals in
  captions and context strips.
- **Engine files** sometimes carry readout or goal text (PR #169 edited
  `peripheral-imaging/engine/labMetrics.ts`). Change the display strings only, never the logic.
- **UI chrome**: the module's namespace in `messages/{en,es,zh-CN}.json`.
- **Localized structured content**: `content/*.ts` with `…Es` and `…ZhCn` variants behind a locale
  selector. `docs/i18n-localization.md` lists which modules are localized.
- **Built apps**: edit the `EBUS-course/` or `navigation_module/` source and rebuild
  (`npm run build:training-apps`); never edit `public/*/app`. Both source trees are
  Prettier-ignored, so keep their own formatting.
- **Registries can outlive their renderer.** Modules have carried authored blocks that nothing
  rendered. Trace from the route to the rendered string, edit what renders, and flag dead copy
  rather than leaving two versions to drift.

## Copy gates — what they refuse, and how to live with them

1. **Shared item gate** — `flaggedLearnerCopyTerms` in
   `src/features/learning-module/activity/clinicalLearningItem.ts`, whole-word and
   case-insensitive:
   - software: reducer, engine, route, query, seed, localstorage, state reuse, hot-swap,
     deterministic attempt, checkpoint payload, simulator behavior
   - examination: score, scored, points, grade, graded, percent, `%`, pass, passed, fail, failed,
     mastery, mastered, exam, test, quiz, assessment, "attempt N of", "X out of Y", certification,
     certified, competent, competency
   - correctness: correct, incorrect, wrong — allowed only in the post-commit verdict cards

   A clinical learning item may carry a `learnerCopyOverrideReason`.

2. **Module gates** built on it. `imagingLearnerCopyErrors` allows digits except where a caller
   refuses them (step titles). `hemodynamicsLearnerCopyErrors` and `mcsLearnerCopyErrors` refuse
   digits in learner copy and universal-target phrasing ("keep … above 65"), and their override
   must name every term it excuses; hemodynamics also rejects an override that excuses nothing.
   The MV and ECMO registries run their own checks. Read the module's gate before writing.
3. **Critical-care component test** — `src/features/critical-care/__tests__/learner-copy.test.ts`
   scans the static copy of every `.tsx` under the components of critical-care, icu-hemodynamics,
   mechanical-ventilation, mechanical-circulatory-support, cardiohelp-ecmo, baxter-crrt and
   icu-simulation for 17 terms (engine, reducer, seed, localstorage, score, scored, grade, graded,
   mastery, mastered, exam, quiz, assessment, competency, competent, certification, certified), with
   **no override**. It also refuses "lessons / cases / steps complete" tallies.
4. **Pre-commit leak checks** — per-section `precommitDenyPatterns` (peripheral-imaging,
   icu-hemodynamics, mechanical-ventilation, mechanical-circulatory-support, and ECMO's drill
   specs) with `*precommit-leak*` tests, some of which render the stage. When a keyed answer is
   reworded, rewrite that section's deny patterns to the new phrasing, or the check goes blind.
5. **Option balance** — the key may be the longest option in under 70% of items
   (`stage-lessons.test.ts` in peripheral-imaging and icu-hemodynamics); imaging's
   `curriculum.test.ts` also caps how many items key any one position and requires every rationale
   to exceed 40 characters. Clinical rewording lengthens keys: PR #169 found the key longest in
   29 of 38 item uses and rebalanced to none by adjusting option lengths, without touching ids,
   keys or order. Measure with a script before running the tests.

### Gate collisions with clinical words

The gates match whole words, so "passes", "tests", "scores", "failure" and "examination" go
through while "pass", "test", "score", "failed" and "exam" are refused.

| Clinical use                                    | Refused word | What has worked                                                                            |
| ----------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------ |
| A catheter's or scope's path to a target        | route        | "airway path" (imaging), "catheter map" (hemodynamics); code may keep `route…` identifiers |
| Physical exam; a diagnostic test                | exam, test   | "physical examination"; name the study ("pleural fluid analysis", "the blood gas")         |
| LENT or RAPID score; Myer-Cotton or tumor grade | score, grade | Keep the named clinical scale, with an override that names the term                        |
| A single EBUS-TBNA needle pass                  | pass         | "needle passes" where the sentence is naturally plural; otherwise an override              |
| SpO2, FiO2 or diagnostic yield as a percentage  | %, percent   | In digit-free modules, add no number; elsewhere follow the module's unit style or override |
| Failed extubation                               | failed       | "extubation failure", an established term that passes                                      |

1. Prefer an equally precise, established clinical phrase.
2. Otherwise, where the registry accepts one, write an override that names the term and its
   clinical sense (for example, "clinical term: LENT score, a prognostic score for malignant
   pleural effusion").
3. Critical-care component literals have no override: rephrase, or ask the owner.
4. Never edit a gate list, loosen a pattern, or move a string somewhere unscanned to get it
   through.

## Verifying here

- **Tests**: `npx jest src/features/<module> --runInBand`; add `src/features/critical-care` for any
  critical-care module (the component copy test lives there) and `src/features/learning-module`
  when items changed; `npm run type-check`; `npm run lint`; `npm run test:a11y` for critical-care
  accessibility; `npm run test:e2e` where a spec exists and a server runs; for the built apps,
  `npm run test:training-apps` and `npm run type-check:training-apps`.
- **Offline render harnesses**, no sign-in needed: `npm run render:mv-teaching`,
  `npm run render:mv-console`, `npm run render:ecmo-teaching`.
- **Browser**: public-unlisted routes render without a session. Run one `next dev` per directory
  on a free port (`node scripts/dev-with-training-apps.mjs --port <port>`; `dev:claude` uses 3120).
  Never pass a local sign-in token through a tool call or a printed URL; verify signed-in modules
  with jest/RTL and the harnesses instead.
- **Rendered-text scan**: collect the text of every section and state as rendered (a jest render
  or `document.body.innerText`) and search it for the obsolete terms. PR #169's scan found a
  template-literal "stop 2 of 6" that a source grep had missed.
- **Locales**: jest mocks next-intl to English only. To prove es and zh-CN keys resolve, use
  `use-intl`'s `createTranslator` in a short script (`docs/i18n-localization.md`). An English edit
  in a localized module leaves its es and zh-CN text stale: record the follow-up, and never
  machine-translate clinical text as a side effect.
- **Hydration**: if you touch a diagram, round computed SVG coordinates. Unrounded trigonometry
  caused the hub hydration mismatch fixed in PR #169.

## Reports and state

- One report per module: `docs/clinical-language/<module>.md` from `templates/module-report.md`,
  with a `Status:` line under the title, and optionally `<module>.ledger.csv` from
  `templates/change-ledger.csv`. There is deliberately no shared worklist file, because parallel
  worktrees would conflict on it. List the states with
  `grep -H '^Status:' docs/clinical-language/*.md`.
- Reports are public. Quote the module's own copy, which is already public, and source locators —
  never transcript text.
- The PR description carries the scope, representative before/after pairs, integrity and
  validation results, and a **Needs physician subject-matter review** section: E2 tickets, reworded
  items awaiting review, and any claim dropped rather than restated without a source.
