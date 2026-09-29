# Handoff — MT-01a sponsorship slot on the shared frame

| Field               | Value                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Slice               | B of the first build round                                                                                              |
| Branch              | `claude/mt-01a-sponsor-notice`                                                                                          |
| Base                | `origin/main` `519415e8bb60baabe16c979a976d7e054458e3d2`                                                                |
| Prerequisite slices | None                                                                                                                    |
| Final head          | The commit that adds this file: `git log -1 --format=%H -- docs/medical-thoracoscopy/handoffs/mt-01a-sponsor-notice.md` |
| Owner decision      | The first-round build plan, approved 2026-09-28, names this change and this file                                        |
| Date                | 2026-09-28                                                                                                              |

## Why

Medical Thoracoscopy is the site's first sponsored module and needs a place to disclose that.
The shared module frame had none: `headerExtra` replaces the release badge, and the safety notice
is a different statement. This slice adds one optional slot and changes nothing for the nine
modules that already use the frame.

## What changed

| Path                                                                                     | Change                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/learning-module/components/__tests__/ModuleFrameV2.consumers.test.tsx`     | New, and committed first on the untouched frame. Pins what the frame puts directly inside its root for eight module frames, in English, on another locale and in a lesson. The ninth consumer, Therapeutic Bronchoscopy, mounts a simulator around the frame and is pinned through its source. A tenth consumer fails the test until it is listed |
| `src/features/learning-module/components/ModuleFrameV2.tsx`                              | Optional `sponsorNotice` prop. When given, it renders `<aside role="note" aria-label="Sponsorship disclosure">` after the safety notice. It renders nothing when the prop is left out, `null`, `false` or an empty string, and nothing in a lesson                                                                                                |
| `src/features/learning-module/components/learning-module-v2.module.css`                  | `.sponsorNotice` styles. The rule that hides the frame's chrome in a lesson is unchanged                                                                                                                                                                                                                                                          |
| `src/features/learning-module/components/__tests__/ModuleFrameV2.sponsorNotice.test.tsx` | New. The slot's behaviour, its accessible name, its place in the order, and an automated accessibility check inside a page                                                                                                                                                                                                                        |

No module passes the new prop. No module stylesheet, route, nav or release badge changed. The
shared lesson stage (`src/features/learning-module/stage/`) is untouched.

### Two choices worth knowing

- **An `aside`, never a `div`.** Six module stylesheets reach the lesson body as
  `[data-activity-frame] > div:last-child`, and Mechanical Ventilation as
  `[data-activity-frame='true'] > div`. A `div` would have been styled as a lesson body.
- **`role="note"`, not a landmark.** Every module wraps the frame in `main`. A plain `aside`
  inside `main` is a nested complementary landmark, which accessibility checkers flag.
- **Absent in a lesson, not hidden.** In a lesson the frame hides its header, navigation and
  safety notice with a stylesheet rule. The disclosure is left out of the page instead, so a test
  that finds it in the page is finding something the learner can see. A lesson prints its own.

## Claims and assets touched

None.

## Checks run

| Command                                                  | Result                                                                                                    |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Characterisation test on the untouched frame             | 36 tests passing, before any change to the frame                                                          |
| `npx jest src/features/learning-module --runInBand`      | 17 suites, 184 tests, all passing                                                                         |
| Tests of the nine consumer modules and the shared module | 397 suites; 7,252 passing, 1 todo                                                                         |
| `npm run type-check`                                     | Clean                                                                                                     |
| `npm run lint`                                           | 0 errors, 15 warnings. None is in a file this slice changed                                               |
| `npm test -- --runInBand`                                | 992 suites: 981 passing, 9 failing, 2 skipped. 14,789 tests: 14,776 passing, 8 failing, 4 skipped, 1 todo |
| The 9 failing suites, run on untouched `origin/main`     | The same 9 fail, with the same 8 failing tests                                                            |
| `npm run storybook:build`                                | **Fails**, on this branch and on untouched `origin/main`, in the same way                                 |
| `npm run build`, with a 4,096 MiB heap limit             | Passes. 782 static pages generated                                                                        |
| `git diff --check`                                       | Clean                                                                                                     |

### Failures already present at the base

None of these is in a file this slice touches. They are recorded so that a later failure can be
told apart from one this work introduces. This machine runs Node 26.5.0, and one of the failing
tests names Node 20, so some of these may depend on the machine.

| Suite                                                                       | Failing test                                                                                |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `scripts/ip-preference-cards/check-brochure-intake-static-exposure.test.ts` | runs through the tsx CLI entry point on Node 20                                             |
| `scripts/ip-preference-cards/us-status/__tests__/safety-boundaries.test.ts` | keeps research code and openFDA endpoints out of application and production entrypoints     |
| `scripts/training-apps.test.mjs`                                            | The suite fails to run                                                                      |
| `src/features/bronchial-branch-tracing/__tests__/contracts.test.ts`         | the new pages are anonymous and unlisted without exposing the existing admin anatomy routes |
| `src/features/critical-care/__tests__/accessibility.test.tsx`               | keeps color-coded circuit, pressure, alarm, and trend states readable without color         |
| `src/features/critical-care/__tests__/curriculum-sequencing.test.tsx`       | renders CRRT cases in authored station order, not alphabetically by title                   |
| `src/features/critical-care/__tests__/learner-copy.test.ts`                 | keeps static component copy free of grading and software-internal labels                    |
| `src/features/literature/dedicated-supabase/foundation-manifest.test.ts`    | records 33 total, 10 Literature-related, 9 deferred, 23 unrelated                           |
| `src/lib/board-review-html.test.ts`                                         | falls back to the English chapter for unsupported locales                                   |

**Storybook.** The build stops at `Rollup failed to resolve import "@/components/ui/…"` from a
file under `stories/`. The build reports `Using tsconfig file: tsconfig.build.json`, whose file
list does not include `stories/`, so the `@/` alias is not applied there. The same failure occurs
on untouched `origin/main`.

Both are raised with the owner as a separate task. Neither is repaired here.

## Real browser observations

Not opened. No route renders the slot yet: no module passes the prop. The first page that does
arrives with the module scaffold, and is opened in a browser there.

## Checks not run

- **Rendered appearance of the slot**, in light and dark themes, at narrow widths and at enlarged
  text. It waits for the first page that uses it.
- **A screen reader.** The accessible name and role are checked by test, not by ear.
- **The baseline comparison used a second checkout** of `origin/main` that shares this
  worktree's installed packages.

## Unresolved decisions

- The wording of the disclosure. Nothing renders until the owner approves it.
- Whether the nine failing suites and the Storybook build are repaired before this round's later
  integration points. Until they are, those gates are reported as partial.

## What must not happen next

- Do not pass `sponsorNotice` from any module but Medical Thoracoscopy.
- Do not add the slot to the rule that hides chrome in a lesson. It is not rendered there.
- Do not edit the shared lesson stage.

This does not change publication status or constitute clinical approval.
