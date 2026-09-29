# Handoff — MT-03e gate evidence

| Field               | Value                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Slice               | 14 of the first build round, the last; work package MT-03                                                                    |
| Branch              | `claude/mt-03e-gate-evidence`                                                                                                |
| Base                | `origin/main` `4f9329f3ed8fe985283ab1cf81d59040f13e995e` (main has not moved since slice 9)                                  |
| Prerequisite slices | `claude/mt-03d-contact-spike` at `e537ac0d` (which carries slices A, B and 1 to 13), merged as the first commit (`e74c8067`) |
| Final head          | The commit that adds this file: `git log -1 --format=%H -- docs/medical-thoracoscopy/handoffs/mt-03e-gate-evidence.md`       |
| Owner decision      | OD-08; the approved first-round plan, sections 5 (row 14) and 7                                                              |
| Date                | 2026-09-28                                                                                                                   |

## Why

The first round ends at the week-four gate. This slice gathers its evidence: the checks the plan asks
of a real browser, the full fuzz on the real proxies, the first measurements, blank forms for what
only people and devices can settle, a revised forecast, the gate packet, and the full gates.

## What changed

| Path                                                                                                                                     | Change                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `playwright.medical-thoracoscopy.config.ts`, `e2e/medical-thoracoscopy.spec.ts`                                                          | New. Twenty checks in a real browser, against a local server only, and the first measurements                                                                    |
| `scripts/medical-thoracoscopy/fuzz-real-proxies.ts`                                                                                      | New. The gate's fuzz on the real proxies, 10,000 seeded sequences by default                                                                                     |
| `docs/medical-thoracoscopy/gate/prototype-gate-packet.md`, `forecast.md`, `forms/*.md`                                                   | New. The gate packet; the revised forecast; blank forms for the device measurements, the fellows' pilot, the owner's judgment of the Scope view, a screen reader |
| `docs/medical-thoracoscopy/registers/performance-table.json`                                                                             | This machine's measurements, OM-1 and OM-2, apart from every target's result, which stays NOT TESTED                                                             |
| `docs/medical-thoracoscopy/registers/traceability.json`                                                                                  | The browser checks listed for the three sections and the spike                                                                                                   |
| `src/features/medical-thoracoscopy/components/lesson/{lesson.module.css,LessonActivities.tsx}`, `components/space/space-pane.module.css` | The repair the checks called for: no grid widens the page, and the survey's note scrolls sideways in its own box                                                 |
| `src/features/medical-thoracoscopy/__tests__/registers.test.ts`                                                                          | Measurements on other machines are kept apart from the targets' results                                                                                          |
| `docs/medical-thoracoscopy/README.md`                                                                                                    | The gate documents, and how to run the browser checks and the fuzz                                                                                               |

## The gate, in short

The packet has it criterion by criterion. What a machine can show is shown: no penetration across
the full fuzz, fallback parity and axe, one complete survey lesson on the real anatomy with the
keyboard and the cut, the contact spike, independent fixtures, stale-result tests, real rendering,
and the first measurements on this machine. What needs people or devices is prepared and left NOT
TESTED or NOT RUN: the frame rates on an M1 or Iris Xe laptop and an A14 iPad, the interactive
times on the target networks, the owner's judgment of the Scope view, the fellows' pilot, and a
screen-reader pass.

## Checks run

| Command or check                                                                                                                                    | Result                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `MT_BASE_URL=http://localhost:3134 npx playwright test -c playwright.medical-thoracoscopy.config.ts`                                                | 20 of 20 pass (2.7 minutes), after three runs: the first two failed on the spec's own selectors, and on the two real faults under "Real browser observations"                                                                                                      |
| `npx tsx scripts/medical-thoracoscopy/fuzz-real-proxies.ts`                                                                                         | 10,000 seeded sequences on the real proxies, 30,000 moves judged, 7,775 stopped by something: nothing found (19 s)                                                                                                                                                 |
| The measurement check, on Metal, against the development server and against this branch's production build (`next start`, port 3136, since removed) | OM-1 and OM-3 in the performance table; OM-2 from the software renderer                                                                                                                                                                                            |
| `npx jest src/features/medical-thoracoscopy "src/app/[locale]/medical-thoracoscopy"`                                                                | 27 suites, 397 tests, all passing (one new, in the registers)                                                                                                                                                                                                      |
| `npm test -- --runInBand` (1,374 s)                                                                                                                 | 1,012 suites and 15,212 tests pass; 2 suites and 4 tests skipped; 1 todo. 9 suites and 8 tests fail, **the same 9 and 8 that fail on an untouched checkout of `origin/main` `4f9329f3`**, run in a second checkout sharing this worktree's packages, since removed |
| `npm run storybook:build`                                                                                                                           | **Fails**, as on the untouched checkout of `origin/main`: Rollup cannot resolve `@/components/ui/button` from a story                                                                                                                                              |
| `NODE_OPTIONS=--max-old-space-size=4096 npm run build`                                                                                              | Passes (compiled in 73 s, with the site's usual warnings); both prototype routes built. The dev server was stopped for it and started again after                                                                                                                  |
| `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p .`; `npx eslint … --max-warnings 0`; `npx prettier --check`; `git diff --check`         | Clean                                                                                                                                                                                                                                                              |

## Real browser observations

All twenty checks passed on the final run. On the way they found two things:

- **The lesson widened the page on a phone**, 466 px wide at 390 px: every grid sized its one column
  to its widest content, and the survey's note cannot be narrower than its choices. Repaired here.
- **The site blanks every page when a browser refuses storage**: the site's theme provider, outside
  this module, reads storage without a guard. Raised as its own task; the module's record handles
  refusal, checked with its own key refused.

Two things about measuring were learned the hard way, and are written into the spec: headless
Chromium draws with SwiftShader, on the processor, unless asked for Metal; and routing any request
turns Playwright's HTTP cache off, so a "warm" reload is cold.

## Checks not run

- The frame rates and interactive times on the named devices and networks; the fellows' pilot; the
  owner's judgment of the Scope view; a screen-reader pass. Each has a form in `gate/forms/`.
- The browser checks in Safari and Firefox: Chromium only.

## Unresolved decisions

- Everything open after slice 13, the lung's collapse (MT-C-0002) first among them.
- Whether the nine suites and the Storybook build that fail on `origin/main` are repaired, and by
  whom; and the site's theme provider.

## What must not happen next

- Do not read the packet as the gate passed: it is the owner's to call.
- Do not record a measurement from this machine, or from emulation, as a target's result.
- Do not fill a form in the repository with a fellow's details: the filled forms stay in the
  owner's local data.

## Repair after the independent review (2026-09-29)

The independent review (stack at `ba6f870d`, tree `26d911e1`) corrected this slice's evidence and
asked for repairs R0 to R8; R9 is the owner's (OD-14) and was **not performed**. The repairs were made
in the pull requests the defects belong to and merged down the stack (no rebase, no force-push); a
separate site pull request carries R6. What changed in this slice:

| Path                                                                                                                                                                                         | Change                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `gate/prototype-gate-packet.md`                                                                                                                                                              | Rewritten with the corrected states beside the state after the repair; the repairs; the public exposure as it stands; R9 not performed                                                                             |
| `gate/forecast.md`                                                                                                                                                                           | Collapse no longer framed as the only lever (the review's measurements of the port, the along-rib limit and "seen whole" repeated); production has neither the 3D views nor the cut until the upload; R6 and OD-15 |
| `README.md`, `repository-baseline.md`                                                                                                                                                        | The cut needs the proxies; how to run the admin-gated browser checks                                                                                                                                               |
| `scripts/medical-thoracoscopy/landmark_table.py`, `test-support/landmark-table.json`, `__tests__/landmarkProjection.test.ts`, `components/space/scene/scopeCamera.ts`, `SpaceSceneViews.tsx` | R3: the independent landmark table; the scene aims its camera through `aimScopeCamera`, which the check also uses; development-only markers for the pixel check                                                    |
| `e2e/medical-thoracoscopy.spec.ts`                                                                                                                                                           | Signs in with the local-development cookie (OD-15); checks the module refuses an anonymous visitor; storage refused altogether (needs R6); the landmark table in real pixels; the authored lung change's new name  |
| `scripts/medical-thoracoscopy/fuzz-real-proxies.ts`                                                                                                                                          | R2: path-judged journeys and the forceps; failing seeds preserved in `test-support/fuzz-seeds.json`                                                                                                                |

### Checks run for the repair

| Command or check                                                                                                            | Result                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npx tsx scripts/medical-thoracoscopy/fuzz-real-proxies.ts`                                                                 | 10,000 journeys (70,000 moves; 218,727 poses judged along paths; 280,060 inside or outside checks; 4,244 lung moves, 3,733 held) in 312 s, and 2,000 forceps sequences (84,415 moves; 783,240 path poses; 82,139 inside checks; jaws opened 23 times) in 206 s: nothing found, no seed preserved |
| `MT_BASE_URL=… MT_LOCAL_DEV_AUTH_TOKEN=… npx playwright test -c playwright.medical-thoracoscopy.config.ts`                  | 23 of 23 pass (3.4 min) on a local branch that also carries R6 (never pushed); anonymous requests to the module are redirected to sign in (HTTP 307) and the local-development session gets 200                                                                                                  |
| Focused Jest (the module, its routes, sponsorship, site access, the admin index, the shared frame's consumers, pleuroscopy) | 47 suites, 612 tests, all passing                                                                                                                                                                                                                                                                |
| `landmarkProjection.test.ts` with the along-ribs hand flipped in the engine                                                 | 4 of 12 fail, as they should; restored                                                                                                                                                                                                                                                           |

### The full gates

Run on 2026-09-29 on the repaired head of this branch, and on an untouched throwaway checkout of
`origin/main` `501f383c` sharing its packages (removed afterwards), with Node 20.20.2 and npm 10.8.2:

| Gate                                                   | This branch                                                                                                                                                                                                                                                                      | Untouched `main`                                                                                 |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `npx jest --ci --maxWorkers=4`                         | 1,028 suites, 15,287 tests: 15,275 pass, 4 skipped, 1 todo; **8 suites and 7 tests fail**                                                                                                                                                                                        | 995 suites, 14,810 tests: 14,798 pass, 4 skipped, 1 todo; **the same 8 suites and 7 tests fail** |
| The failing suites, on both                            | critical-care accessibility, learner copy and curriculum sequencing; the literature foundation manifest; the preference-cards research safety boundary; the branch-tracing contracts; board-review HTML; `scripts/training-apps.test.mjs` (no test in it). None is this module's |                                                                                                  |
| `npm run storybook:build`                              | **Fails**: Rollup cannot resolve `@/components/ui/button` from a story                                                                                                                                                                                                           | **Fails the same way**                                                                           |
| `NODE_OPTIONS=--max-old-space-size=4096 npm run build` | Passes (117 s, the site's usual warnings); every module route and both prototypes built                                                                                                                                                                                          | Not re-run                                                                                       |
| `npx tsc --noEmit`                                     | No errors                                                                                                                                                                                                                                                                        |                                                                                                  |

So the full gates are **partial**, for reasons already on `main` and outside this module. Neither
Jest nor Storybook is green.

### What must not happen next

- Do not perform R9 without the owner's decision packet; do not move the nodule or the anatomy to
  make criterion 10 pass (OD-12).
- Do not approve rights or upload anything; the exposure recorded is not an approval (OD-13).
- Do not open the module to anonymous visitors, or weaken authentication for testing (OD-15).
- Merge R6 before relying on the course's check of storage refused altogether.

This does not change publication status or constitute clinical approval.
