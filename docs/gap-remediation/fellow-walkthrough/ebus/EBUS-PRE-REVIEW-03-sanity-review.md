# EBUS-PRE-REVIEW-03 independent sanity review

2026-09-22 · PR #261 · **SANITY REPAIR: READY FOR OWNER MERGE**

Review and bounded repairs only. No merge, deployment, Prompt 04/05 work, or clinical adjudication.

## Provenance

- Original reviewed head: `8354a11d1339ec47fe51c465d592ff34bea8d671` (`claude/ebus-anatomy-sweep-9-21`).
- Freshly fetched `origin/main`, implementation baseline, and merge-base: `2124cd0f3483db6534ab65bf6dd3730b59fee463`. Main had not advanced; GitHub reported the PR mergeable.
- Smoke SHA: `f01e43e2410e96f8f77a0db6814a4853749add24`. Exactly four subsequent baseline commits are EBUS-free. The handoff's attribution to ECMO/CRRT/MCS is inaccurate: these four are the MCS implementation, repair, documentation, and PR #256 merge (`caa7cee4`, `4b079428`, `6663f030`, `2124cd0f`).
- Independent checkout: `/Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/codex-ebus-261-sanity`; repair branch `codex/ebus-261-sanity-repair`. Baseline comparison checkout: `/tmp/ebus-261-baseline`. Browser contexts and production builds were created for this review; no owner browser/session/server evidence was reused.
- Product repair commit: `98a67907b164d8aaafb145338e79b925e28dfd96`. The commit containing this report adds documentation only. Integrate by ordinary fast-forward push to the existing PR branch, preserving the original commits.
- Independently verified `4fdf76ee..8354a11d`: one e2e TypeScript annotation plus handoff/status documentation, with no runtime source changes. Nevertheless, fresh full builds were run at baseline, original head, and repair commit.
- Final runtime build: `npm run build` at `98a67907`, including both embedded apps, content, asset checks, Next production build, and standalone preparation. Build ID `UEUO0ktt79WqGChQdRqgc`; final standalone server port 3145, launched from this checkout's `.next/standalone`. The report commit is not described as a separately rebuilt runtime.

## Four reproduced P2 defects, repaired

Paths below are relative to the repository; line numbers refer to `98a67907`.

| Component                                                                               | Independent reproduction                                                                                                                                                                                      | Bounded correction and coverage                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EBUS-course/apps/web/src/guided/observerControls.ts:108,145`                           | With canvas focused/engaged, Ctrl/Cmd zoom shortcuts and modified wheel events were canceled or drove the camera despite the caption. New regression failed on original head.                                 | Ignore modified keyboard shortcuts; intercept modified wheel propagation before OrbitControls without canceling the browser default. Correct the two-finger caption. Regression checks all ten key/wheel cases, unchanged camera projection, plain-key zoom, Escape, and Tab exit. |
| `EBUS-course/apps/web/src/guided/LinkedModelView.tsx:828` and `structureCallouts.ts:45` | Passing the new camera target to callout anchor selection moved the SVC surface attachment 6.7056 mm and aorta attachment 3.5403 mm relative to baseline on the actual unchanged GLBs.                        | Decouple callout focus from observer camera framing, restoring historical anatomy focus and scope-local focus transformed through the genuine scope basis. Two actual-GLB golden-vertex tests cover baseline anchors and scope transforms.                                         |
| `EBUS-course/apps/web/src/guided/ContactComparison.tsx:47`                              | Baseline/current close-ups placed air and tissue text together near the transducer; rendered labels overlapped. Wall text also lacked contrast when present.                                                  | Separate label rows and draw leaders to actual sampled pixels of each present region. Preserve sampled image and acquisition. Browser regression checks region presence, label containment, and pairwise non-overlap. A region with insufficient sampled pixels remains unlabeled. |
| `EBUS-course/apps/web/src/guided/LinkedModelView.tsx:373,425`                           | Leave pointer over channel outlet, focus distal-body marker, then let the queued frame run: focus remained on distal body while highlight reverted to channel outlet. New regression failed on original head. | Give a visible keyboard-focused marker precedence over stationary-pointer refresh. Regression checks focus, highlight, Enter's canonical selection/evidence, and clearing after Tab.                                                                                               |

All four were reproduced before correction. No other product changes were made by this review.

## Sweep and evidence truth

Baseline source was read directly with Git. An independent harness transpiled `sampleLinkedSweep` from baseline and original head, then compared **10,000 deterministic traces / 1,000,000 transitions**, including all state fields and whether the previous state object was returned. It covered contact boundaries around 0.45, duplicate/empty frame IDs, zero and positive/negative steps around 5/12/13 degrees, oversized jumps, reversals, and resets. No difference was found. The repair does not touch the sampler.

All seven requested UI/bridge journeys were exercised through real controls: outside→cross→exit; start inside; reversal; oversized jump; reset/change/repeat; demo→learner; and skip without acquisition. Visible target, in-plane state, waiting/reset reason and transient progress agreed with observations. RMS completed with 12 samples across 110 degrees; the LMS authored +85-degree start remained inside with zero samples until the learner moved outside and crossed. Reset cleared samples, scan/action state and changed session. Skip produced no held acquisition. Three further rapid demo→learner transitions retained zero actions, empty sweeps, and no inherited source.

The new status remains embedded presentation state; it does not enter a score, grade, mastery, first-attempt, persistence, or course-progress payload. Existing session/task/request guards and separate demonstration runtime identity remain intact. No thresholds (`0.45`, `12°`, `5`, `20°`), starts, sweep windows, geometry/assets, canonical IDs, historic mappings, locator/target coordinates, or bridge protocol changed. The review restored historical callout attachments rather than changing anatomy.

## Model presentation and interaction

Canonical marker IDs, names, selection and evidence resolve to the same structure in both directions. Column hysteresis affects projected labels only; leaders still attach to their own structures. Rotation, focus, selection and rapid-pointer checks passed after repair. Distal-tip, whole-device, regional and CT-map cameras change observer framing only. The compass labels the model frame; patient LPS→web conversion remains `[L,S,-P]`, without introducing a patient-image convention.

Lesson 19 arrows use unchanged contract locator/target endpoints and a shaft/head quaternion aligned to that vector. Rotation, zoom and resize changed projected length (approximately 65.7→66.1→87.4→98.9 px in the dedicated probe), disproving a fixed screen-space arrow. Four default approaches measured approximately 46.6–68.3 px. This verifies transform provenance, not clinical route validity.

The bronchoscopy caption uses the calibrated optical ray, channel mesh and current pose. It conditions the wall statement on the actual ray distance and calibrated clearance, not pink appearance or contact index alone. The observed 3.8 mm view with contact index 1.00 did not claim wall contact. Section colors/legend derive from existing volume label kinds. Contact schematic text remains model-state description. No ultrasound/Doppler interpretation, orientation or measurement calibration was revised.

Ordinary wheel and one-finger scrolling work while released; click/tap engages; wheel/one-finger manipulation then controls the camera. Escape, blur and outside pointer release it. Explicit orbit/zoom/reset and keyboard controls remain usable. Eight rapid cycles at the canvas edge alternated Escape and outside-pointer release without a stuck state. The tablet gesture probe scrolled 693→878 px while released, stayed released, then kept page scroll at 878 after intentional engagement and drag. Modified shortcut tests verify app non-interception; they do not certify native browser zoom UI behavior.

## 768 px sticky-chrome disposition

The interception is real, reproducible on baseline and original/repaired head, and is not dismissed as a browser flake. Fresh headed Chromium, 768×1024 with emulated touch, measured lesson chrome at approximately **153 px tall**, from y=81 to y=234, for both scope-orientation and CT-map. The reported approximately 300 px height was not reproduced under these conditions.

Taps in the chrome-covered canvas area hit the chrome DIV on both versions; repaired head stayed disengaged. Scrolling the desired target into the unobscured area made the top hit an IFRAME, tapping engaged the canvas, and orbit, zoom, reset, whole-scope (where available), names, release and marker selection were reachable. CT-map marker selection also succeeded on baseline and repaired head. Header/chrome code is unchanged. No Prompt-03 control became inaccessible, and no evidence showed worsening interception. Disposition: pre-existing EBUS lesson-chrome/site-header overlap debt, documented; no unrelated shared-layout rewrite or scope-expanding fix.

## Prompt-01/02 containment

Relevant host/embedded suites pass, including legacy payload validation. The reference CT loaded at 987×553; a wrong 4R answer retained the keyed station-7 feedback. Live, held, supplied and demonstration identities remain distinct. Rapid recording requests settled on the last requested segment (`Depth4_Gain_6`); the original H.264 source decoded at 1920×1080. A valid subsequent Hold captured that request's genuine decoded acquisition. Both terminal video and lookup failures cleared busy state and kept Hold disabled. Unfinished reload cleared held recording and model evidence.

For Lesson 5, actual model actions acquired and held `contactMode: bubble`, frame `additional-models-v1:contact:a7b3e79`. Check 1 and check 2 retained that exact frame and the identity “balloon with a bubble,” including when check 2 asked its reflector question. No replacement, relabeling, reconstruction, or evidence selection was introduced. **L5-1 remains a content hold.**

## Validation and limits

Distinct automated cases, without counting reruns as additional tests:

- Host EBUS/shared-lesson Jest selection: **28 suites, 305 tests passed** (`src/features/ebus-guided` and `src/features/learning-module`).
- Embedded app: **39 Vitest files, 278 tests passed** (`npm test -- --run`, including two new actual-GLB tests).
- Final production Playwright: **10 tests passed**, one worker, no retries: eight anatomy/sweep tests plus two terminal-media-failure tests. This includes the seven real sweep journeys, two new browser regressions and strengthened contact-label coverage.
- Root full `tsc --noEmit` (including e2e), embedded typecheck, scoped lint, formatting and `git diff --check` passed. Scoped lint retains one nonblocking existing-in-PR unused-variable warning in `browser-anatomy-matrix.ts:302`.
- Fresh production builds at baseline, original head and repair commit passed. The final repaired production server was used for the ten tests and final interaction/containment checks.
- Eleven browser conditions: 1246×1021, 1440×900, 1024×768, 768×1024 emulated touch, 390×844 and 320×740 existing phone fallback, DPR 2, host root font 200%, CSS zoom 150%, light and dark themes. No horizontal overflow, visible marker overlap or out-of-bounds markers was observed; compass stayed contained. Host font/theme probes do not imply that iframe styles inherit them.
- Own fresh Chromium contexts, software WebGL, painted active pages for layout, with headed targeted comparisons. No Safari, Firefox, physical-device or native browser zoom certification is claimed. CSS zoom is only a CSS stress condition. Phone fallback is not a tested phone simulator.

Local evidence and reproducible scratch harnesses are in `/tmp/ebus-261-sanity` (not committed authoring input): `sampler-result.json`, `compare-sampler.cjs`, `anchors.json`, original failing reproduction logs, `playwright-final.log`, `matrix-final.log`, `final-evidence/matrix/matrix.json`, `tablet.json`, `tablet-ct.json`, `deep.json`, `final-extra.json`, `races.json`, `boundary.json`, and build/type/lint/test logs. Some preliminary harnesses timed out on network-idle, used stale generated output during rebuild, or made invalid readiness/optional-field assumptions; they were corrected and rerun with actual readiness guards. Those failed/incomplete runs are not counted as passes. The full unrelated host test/browser suite was not run, and the known BBT manifest failure was not expanded into this review.

Owner holds remain: clinical sweep-window realism, orientation, 4R/4L identity, Doppler, pixel-to-mm calibration, ultrasound outlines, staging/report semantics, specimen/needle sequencing, media rights/de-identification, guideline/source claims and L5-1. No new outline was added and none of these holds was adjudicated.
