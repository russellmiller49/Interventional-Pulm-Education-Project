# HD Batch03: atlas prose contrast

This local slice repairs the abnormal waveform atlas's unreadable summary and recognition cues
inside the dark lesson shell. It implements the light-card contrast portion of sections C–D in
`HD_Claude_Implementation_Pack/03_HD_WAVEFORMS_AND_VISUAL_WORKBENCH.md`, not the whole batch.

## Baseline and ownership

- Branch: `codex/hd03-atlas-readability-20260930`.
- Base: `11d7c6fb760622df1034950d7fec57bc55528801`, including the reviewed plot-clipping repair.
  That commit is preserved; its figure code and tests are unchanged.
- Refreshed remote main: `46c5bb94f779a1464da6198bba4bcf8550379419`.
- The live inventory at **2026-09-30 18:58:57 UTC** examined all 22 open PRs' descriptions,
  branches, heads, bases and changed paths. No PR intersects the inspected HD surfaces or this
  slice's runtime CSS. No open HD PR was found. The existing HD implementation and reviewed
  clipping worktrees were clean. This branch is the coordinated HD-only writer.
- Shared stage and theme paths belonging to #134/#308 are untouched. Device Intelligence,
  Literature, medical thoracoscopy, CRRT, ECMO and other worktrees are untouched.

## Reproduction and repair

Open `/en/icu-hemodynamics/learn?activity=waveform-components` and use native Continue until the
abnormal atlas appears. No prediction or clinical action is required under the current self-paced
contract in `docs/gap-remediation/self-paced/README.md`.

On the baseline at 1204×987 in dark mode, the atlas has background `rgb(244, 249, 247)` but its
summary and recognition cues inherit `rgb(234, 244, 244)` from the lesson shell: **1.053:1** contrast.
The new browser regression fails on that actual rendered text before the repair.

The runtime diff adds `.atlasPanel` to the existing light-card ink token rule already used by
`.atlasFigure` and `.recognitionDrill`. Summary and cue contrast becomes **12.742:1**. The atlas's
boundary note also changes from `#5a7a74` (**4.415:1**) to `#54726c` (**4.934:1**). No layout,
sample generation, ECG timing, clinical wording, physiology, grading, acquisition or catheter
safety behavior changes.

## Verification

| Check                                                       | Outcome                                                                            |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Baseline browser contrast regression                        | Expected failure at 1.053:1; screenshot retained                                   |
| Focused existing Jest suites                                | **152 tests passed in 8 suites**                                                   |
| New atlas browser regression                                | **6 journeys passed**                                                              |
| Reviewed clipping compatibility assertions                  | **4 journeys passed** using the temporary theme setup described below              |
| Atlas horizontal overflow                                   | **0 px** in all six conditions                                                     |
| Whole-page reflow at 200% root text                         | **Fails on the unchanged baseline and repaired tree**, outside this contrast slice |
| Full repository compile/build or broad module suites        | Unperformed; unnecessary for the CSS-only runtime diff                             |
| Production assets, screen reader and physical device checks | Unperformed; sparse local preview is not release acceptance                        |

The eight Jest suites cover waveform morphology, display range, the canonical reference/PAC safety,
catheter safety, thermodilution series identity, pressure provenance, stage host and source behavior:

```sh
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath \
  src/features/icu-hemodynamics/__tests__/waveform-morphology.test.ts \
  src/features/icu-hemodynamics/__tests__/waveform-display-range.test.tsx \
  src/features/icu-hemodynamics/__tests__/h2-h3-reference-and-pac-safety.test.tsx \
  src/features/icu-hemodynamics/__tests__/hd-pre-review-01-catheter-safety.test.tsx \
  src/features/icu-hemodynamics/__tests__/hd-pre-review-02-series-identity.test.tsx \
  src/features/icu-hemodynamics/__tests__/hd-pre-review-02-pressure-provenance.test.tsx \
  src/features/icu-hemodynamics/__tests__/stage-host.test.tsx \
  src/features/icu-hemodynamics/__tests__/stage-sources.test.tsx
```

Browser conditions: 1204×987 dark; 1440×900 light; 1024×768 dark with 200% root text;
390×844 light; 390×844 dark with 200% root text; 320×740 light with 200% root text.
Every abnormal reference is opened by keyboard without answering. Tested prose and tab buttons
meet 4.5:1 contrast. Enter/Space selection and sequential Tab focus work. Help and Sources open by
keyboard, close with Escape and restore trigger focus; the stage ID, selected reference, summary
and plotted path data are identical before and after both returns.

The first combined browser run had five failures: two whole-page reflow assertions; the new
mobile journey's unavailable desktop theme toggle; and two old clipping journeys' theme setup
(hydration race and unavailable mobile toggle). The committed new test now chooses the theme
after hydration at desktop width, then resizes. It asserts atlas reflow and records whole-page
overflow separately. The reviewed clipping spec is unchanged: a retained temporary copy changes
only theme readiness/setup, and all four original geometry assertions pass. No failed result is
being counted as a pass from the original unmodified combined run.

At 200% root text, whole-page overflow is **125 px at 1024**, **192 px at 390**, and **262 px at 320**.
A separate probe temporarily restored this worktree's CSS to the exact unchanged `11d7c6fb`
baseline, confirmed those same values, then restored the repair. The atlas itself has zero overflow
before and after. Broader page reflow and remaining Batch03 label/control work need separate scope
and ownership checks; this slice does not claim to resolve them.

## Evidence and review checkpoint

Evidence outside Git:
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/hd03-atlas-readability-20260930/`

Includes the current PR inventory, measured before/after colors, matching atlas screenshots,
expected baseline regression failure, initial combined failures, final six-journey results,
four-journey compatibility results and the baseline reflow diagnosis. Local preview credentials
are ephemeral and excluded from the handoff. Dependency links and the preview are removed/stopped
at handoff; no lockfiles or configuration are changed.

Independent review should inspect the three-line runtime diff, run the six-journey regression and
confirm the preserved clipping baseline. Clinical morphology/ECG timing/reference decisions remain
owner decisions. This is a local review checkpoint, not Batch03 completion or permission to release.
