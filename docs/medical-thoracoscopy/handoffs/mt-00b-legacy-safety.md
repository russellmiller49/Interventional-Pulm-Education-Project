# Handoff — MT-00b legacy safety correction

| Field               | Value                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Slice               | A of the first build round                                                                                             |
| Branch              | `claude/mt-00b-legacy-safety`                                                                                          |
| Base                | `origin/main` `519415e8bb60baabe16c979a976d7e054458e3d2`                                                               |
| Prerequisite slices | None                                                                                                                   |
| Final head          | The commit that adds this file: `git log -1 --format=%H -- docs/medical-thoracoscopy/handoffs/mt-00b-legacy-safety.md` |
| Owner decision      | OD-10, 2026-09-27: remove the legacy re-expansion scenario and its quiz item now                                       |
| Date                | 2026-09-28                                                                                                             |

## Why

The legacy Pleuroscopy module (`/pleural-procedures/pleuroscopy`) carried a Practice scenario,
"Re-expansion pulmonary oedema during drainage", and a matching Assessment item. Both taught
drainage-volume limits from thoracentesis as if they applied to open-port thoracoscopy. The
revised build plan (v2 §4.5) asks for confirmed misleading legacy teaching to be removed as soon
as the finding is accepted, without waiting for the replacement module.

## What changed

| Path                                                           | Change                                                                                                                                                     |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/pleuroscopy/content/scenarios.ts`                | Scenario `re-expansion-oedema` removed (98 lines). Header comment records the removal and why                                                              |
| `src/features/pleuroscopy/content/quizItems.ts`                | The drainage-volume item removed (14 lines). Nine items remain                                                                                             |
| `messages/en.json`, `messages/es.json`, `messages/zh-CN.json`  | `pleuroscopy.overview.steps.assessment.description` and `pleuroscopy.assessment.headerDescription` no longer promise "ten questions"; they state no number |
| `src/features/pleuroscopy/__tests__/scenarioIntegrity.test.ts` | Pins: the scenario is absent, the three remaining ids are unchanged, no scenario text teaches a drainage-volume limit                                      |
| `src/features/pleuroscopy/__tests__/quizIntegrity.test.ts`     | Pin: no item asks about re-expansion or volume-limited drainage                                                                                            |
| `src/features/pleuroscopy/__tests__/assessmentCopy.test.ts`    | New. The Assessment copy states no question count in any of the three locales                                                                              |

Nothing else in the legacy module changed. Routes, progress storage
(`ip-pleural-module-progress-v1`), navigation and access are untouched. The removed scenario
text had no translation entries, so no message keys were orphaned.

## Claims and assets touched

- Claims removed from learner-facing content: the drainage-volume limit and its "stop at
  symptoms" sequence as applied to thoracoscopy. No claim was added or reworded.
- Assets: none.

## Checks run

| Command                                                                                                          | Result                                                           |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `npx jest src/features/pleuroscopy src/i18n/translations.test.ts src/lib/non-public-modules.test.ts --runInBand` | 5 suites, 33 tests, all passing                                  |
| `npm run type-check`                                                                                             | Clean                                                            |
| `npm run lint`                                                                                                   | 0 errors, 15 warnings. None is in a file this slice changed      |
| `npx prettier --check` on the changed files                                                                      | Clean                                                            |
| `git diff --check`                                                                                               | Clean                                                            |
| New pins checked against the old content                                                                         | Each pin fails on `origin/main` content and holds on this branch |

## Checks not run

- **Real browser.** The legacy route sits behind sign-in, so it cannot be opened in this
  worktree's preview without a session. The Practice and Assessment pages render straight from
  the two content arrays, which the tests above read directly.
- **Full test suite, Storybook build, production build.** These run at the round's integration
  points, the first of which follows slice B.
- **Clinical review.** Not run. Removing content is the owner's decision OD-10; nothing here has
  been clinically reviewed.

## Left in place, for your review

These lines mention re-expansion pulmonary oedema without stating a volume limit. They were not
part of OD-10 and are unchanged:

| Path                                               | Text                                                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/pleuroscopy/content/lessons.ts`      | "Anticipate re-expansion oedema and air leak in post-procedure management."                                                           |
| `src/features/pleuroscopy/content/learnContent.ts` | "…post-procedure drainage — anticipating re-expansion oedema and air leak."                                                           |
| `src/features/pleuroscopy/content/learnContent.ts` | "Place a chest drain under vision and manage controlled drainage, watching for re-expansion pulmonary oedema and prolonged air leak." |
| `src/features/pleuroscopy/content/sequences.ts`    | "Controlled drainage supports apposition while watching for re-expansion pulmonary oedema and air leak."                              |

Also known and unchanged: seven of the nine remaining Assessment items are keyed to the second
option. That is an answer-position cue, not a safety defect. The legacy module is due to be
retired once all nineteen new sections exist.

## Unresolved decisions

- Whether the four lines above should be reworded or removed before the legacy module retires.

## What must not happen next

- Do not restore the scenario or the item, or add drainage-volume teaching to the legacy module,
  without clinical review.
- Do not add redirects from the legacy routes yet. Redirects wait for a reviewed destination.
- Do not change `ip-pleural-module-progress-v1`.

This does not change publication status or constitute clinical approval.
