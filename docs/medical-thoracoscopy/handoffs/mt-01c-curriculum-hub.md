# Handoff — MT-01c curriculum and hub

| Field               | Value                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Slice               | 5 of the first build round; work package MT-01                                                                          |
| Branch              | `claude/mt-01c-curriculum-hub`                                                                                          |
| Base                | `origin/main` `756c9aee7d7119f3817b5d85aaf73f9efa573418`                                                                |
| Prerequisite slices | `claude/mt-01b-scaffold` at `745ef959` (which carries slices A, B and 1 to 3), merged as the first commit (`b2c56853`)  |
| Final head          | The commit that adds this file: `git log -1 --format=%H -- docs/medical-thoracoscopy/handoffs/mt-01c-curriculum-hub.md` |
| Owner decision      | OD-08; the approved first-round plan, sections 4.1 and 4.2                                                              |
| Date                | 2026-09-28                                                                                                              |

## Why

The course needs one order before any section is written: which sections exist, in which
chapters, which one comes next, and what a learner's browser remembers. This slice builds that
order, the record of progress, and the pages that read them. No section is written yet, so every
page says so and links to nothing that does not exist.

## What changed

Two commits: `60bad1be` (the slice) and the commit that adds this file (a correction to the
progress record, below).

| Path                                                                                                     | Change                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/medical-thoracoscopy/content/{sectionIds,spine,curriculum}.ts`                             | New. The one ordering authority: 19 section ids, 5 chapters, P1–P7, C1–C4, the eight-phase spine and the model boundaries, each value pinned by test to the implementation manifest. Chapters tile the canonical order exactly once |
| `src/features/medical-thoracoscopy/content/pathwayResolver.ts`                                           | New. `nextStep`: nothing open, a section (resumed or fresh), or everything reviewed. Only an available section is a link, can be resumed or is counted                                                                              |
| `src/features/medical-thoracoscopy/content/learnerCopy.ts`                                               | New. The course's copy gate: the shared examination and correctness vocabulary, the sponsorship policy's praise words, and digits where refused. Every registry runs it as it loads                                                 |
| `src/features/medical-thoracoscopy/engine/selfPacedProgress.ts`                                          | New. One record under `ip-medical-thoracoscopy-self-paced-v1`, one writer. A value it cannot read is left untouched; `ip-pleural-module-progress-v1` is never read, written or removed                                              |
| `src/features/medical-thoracoscopy/components/useThoracoscopyProgress.ts`                                | New. The pages read the record through `useSyncExternalStore`                                                                                                                                                                       |
| `src/features/medical-thoracoscopy/components/hub/*`                                                     | New. Hub, outline, Continue, Learn, Practice and Cases landings, and a note when this browser is not saving                                                                                                                         |
| `src/app/[locale]/medical-thoracoscopy/{page,learn,practice,assess}/page.tsx`                            | The pages now show the hub and landings. Learn reads `?section=`; asked for a section in preparation, it says so, offers no mark and records nothing                                                                                |
| `src/features/medical-thoracoscopy/__tests__/*`, `src/app/[locale]/medical-thoracoscopy/routes.test.tsx` | Registry, resolver, progress, hub and route tests                                                                                                                                                                                   |
| `docs/medical-thoracoscopy/owner-decisions.md`                                                           | Open item T10: section 18's imported title trips the copy gate on "wrong"; it is shown as "When a complication happens", and the manifest keeps the imported title                                                                  |

### The correction to the progress record

The slice first stored three things the learning contract does not allow: sections saved to
review later, and lists of practice scenarios and cases opened. The contract's words are "where
the learner is, which sections they have visited, which sections they have chosen to mark
reviewed. Nothing else." The second commit removes them: the fields, `withReviewLater`,
`setSectionReviewLater`, `reviewLaterSections`, the hub's "Saved for review" list and the
outline's "saved for review" tag. Being in a practice scenario or case now moves the place and
adds nothing else. A test holds the record to exactly its five keys and refuses a stored value
that carries any other. Nothing had been released, so the record's version stays 1; a value in
the old shape reads as unreadable and is left as it is.

Not changed: the shared lesson stage, the shared frame, `moduleRoutes.ts`, navigation, the
sitemap and the earlier module at `/pleural-procedures/pleuroscopy`.

## Claims and assets touched

None.

## Checks run

Full gates ran on `60bad1be`, with the worktree clean before and after. The correction that
followed had the targeted checks below them.

| Command                                                                                                                | Result                                                                                                                                                                                          |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check`                                                            | Clean                                                                                                                                                                                           |
| `npm run lint`                                                                                                         | 0 errors, 15 warnings: the same 15 as at the base, none in this module                                                                                                                          |
| `npm test -- --runInBand` (1,479 s)                                                                                    | 995 suites and 14,975 tests pass; 2 suites and 4 tests skipped; 1 todo. **9 suites and 8 tests fail, exactly the 9 and 8 that fail on untouched `origin/main`** (listed in the slice B handoff) |
| `npm run storybook:build`                                                                                              | **Fails**, as on untouched `origin/main`: Rollup cannot resolve `@/components/ui/button` from `stories/ui/button.stories.tsx`                                                                   |
| `NODE_OPTIONS=--max-old-space-size=4096 npm run build`                                                                 | Passes (145 s)                                                                                                                                                                                  |
| After the correction: `npx jest src/features/medical-thoracoscopy "src/app/[locale]/medical-thoracoscopy" --runInBand` | 11 suites, 163 tests, all passing                                                                                                                                                               |
| After the correction: type-check; `npx eslint` on the module and its pages; `git diff --check`                         | Clean                                                                                                                                                                                           |

## Real browser observations

Opened in the Browser pane on this worktree's dev server (`claude-thoracoscopy`, port 3134), with
no `.env.local` and not signed in, after the correction:

- `/en/medical-thoracoscopy`: status "No section is open yet. Sections open here as they are
  written."; the outline lists all 19 sections, each "In preparation", none a link; only the
  first chapter is open; no "Saved for review" anywhere; robots `noindex, nofollow, noarchive`;
  the course's `<main>` is `lang="en"`.
- A stored value that is not JSON: the note "A saved place on this device could not be read…"
  appears, and the value is still there afterwards, unchanged.
- Storage refused (the page's `getItem` made to throw): the note "This browser is not saving your
  place…" appears, and goes when storage works again.
- `/en/medical-thoracoscopy/learn?section=four-controls`: "This section is being written. It is
  not open yet, and nothing is recorded for it."
- At 375 × 812 the hub reflows with no horizontal scroll.
- Console: the only errors were `POST /api/analytics` returning 500 (no Supabase keys in this
  worktree, site-wide) and the reconnect attempts of a tab left open while the server was
  stopped.

## Checks not run

- **The full suite, Storybook and the production build after the correction.** Its changes are
  confined to the module; the next full run is at slice 14.
- **A screen reader**, and theme switching: the module frame is dark only.
- **Signed-out access in production.** Pinned by the access tests, not observed on the live
  proxy.

## Unresolved decisions

- T1: the chapter assignment the outline follows.
- T9: finishing a section marks it reviewed, with undo. Nothing can be finished yet; the lesson
  host builds the action.
- T10: the learner title of section 18.

## What must not happen next

- Do not add anything to the progress record beyond place, sections visited and sections marked
  reviewed, and do not read or write `ip-pleural-module-progress-v1`.
- Do not make a section a link, or record it, before its state is `available`.
- Do not change a section id.

This does not change publication status or constitute clinical approval.
