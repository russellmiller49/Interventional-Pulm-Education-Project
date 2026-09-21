# EBUS-PRE-REVIEW-02 — readable images and usable controls: handoff

**Batch scope:** ledger lane 02 of the EBUS fellow-walkthrough package — how much of a recording a
learner can actually see, whether the controls beside it work, and whether what the workbench says
about a frame is true. **No clinical approval, no media replacement, no anatomy calibration, no
real learner validation, no release, no deployment and no merge is claimed or performed.** Lane 03
(anatomy and sweep usability), 04 (teaching clarity) and 05 (clinical and media drafts) are
untouched, and lane 01's repairs were re-checked rather than revisited.

The walkthrough this batch repairs is Claude in a first-year-fellow persona, not a fellow and not a
faculty reviewer. Nothing here is evidence that the module teaches what it intends to.

## Repository reconciliation

| Field             | Recorded value                                                                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Checkout          | `/Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/claude-ecmo-2-9-19`                                                                                                                                           |
| Branch            | `claude/ebus-pre-review-02`, created from `origin/main`                                                                                                                                                                              |
| Base SHA          | `c717c9ffae09cb67e19b06a56d37c75487a5605a` — current `main`, i.e. after EBUS-PRE-REVIEW-01 (#249) merged. The planning package inspected `77a141cc`; every assigned row was re-reproduced on this base before anything was changed.  |
| Starting status   | clean                                                                                                                                                                                                                                |
| Instructions read | root `AGENTS.md` and `CLAUDE.md`; the package in place under `Interventional-Pulm-Local-Data/module_update_9_19/EBUS_Claude_Implementation_Pack` (`00_START_HERE.md`, `02_…`, `PI_EBUS_COORDINATION.md`, `FEEDBACK_LEDGER.md/.json`) |
| Prior context     | `EBUS-PRE-REVIEW-01-handoff.md`, including its four open items and the L5-1 residual it left for this lane                                                                                                                           |
| Commits           | seven, each independently revertible                                                                                                                                                                                                 |
| Pull request      | opened from this branch; not merged                                                                                                                                                                                                  |

## Shared-file scope

`PI_EBUS_COORDINATION.md` assigns `EBUS-course/apps/web/src/guided/**` and "narrowly necessary EBUS
guided adapters" to this lane. What was touched outside `src/features/ebus-guided` and
`EBUS-course/apps/web/src/guided`:

| File                                                                   | Why it was necessary                                                                                                                                 | Legacy protection                                                                                                                                   |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/ebus-recorded-contract.ts`                                    | EBUS-only. Carries the recorded example a frame came from (L7-1).                                                                                    | The new field is optional and validated; a frame without it still passes. `settings` is byte-identical, because `labGoalMet` is checked against it. |
| `src/lib/ebus-guided-bridge.ts`                                        | EBUS-only. Carries the held contact condition (L5-1 carry-forward).                                                                                  | Optional, and only accepted on the `contact` package.                                                                                               |
| `src/lib/ebus-model-contract.ts`                                       | EBUS-only. `CONTACT_MODES`/`CONTACT_MODE_LABELS`, and the phantom plane reference derived from existing geometry.                                    | Additions only. `modelFrameId`, `modelReducer`, `measurePhantom`, `modelComplete` and `MODEL_STEPS` are unchanged.                                  |
| `EBUS-course/apps/web/src/features/simulator/ContinuousSectorView.tsx` | Shared legacy renderer. One guarded line: a guided lab that was not given the `freeze` control no longer renders a permanently disabled one (L14-4). | `!guided` is unchanged, so the standalone simulator still always shows and allows Freeze — re-checked in the browser on the built app.              |
| `EBUS-course/apps/web/src/features/simulator/SimulatorPage.tsx`        | Shared legacy renderer, but the edit is entirely inside the `if (guided)` branch: the image and its controls are wrapped in two columns.             | Nothing outside that branch was touched.                                                                                                            |
| `EBUS-course/apps/web/src/features/knobology/videoSegments.ts`         | Shared with the legacy knobology panel. Three added constants (frame size and the measured image region); no existing export changed.                | The legacy panel does not read them.                                                                                                                |
| `src/features/ebus-guided/content/optimize.ts`                         | Two authored strings that name the control scale, so the vocabulary is coherent (L7-1). See "Content strings touched" below.                         | No key, stem, choice, rationale, explanation or clinical claim changed.                                                                             |
| `.claude/launch.json`                                                  | Two dev/preview entries for this worktree's ports.                                                                                                   | —                                                                                                                                                   |

`src/features/learning-module/components/AnswerVerdict.tsx` — lane 01's authorised shared edit —
was **not** touched. No global site CSS and no PI workbench was touched.

## What each assigned row came to

"Reproduced/fixed" means the defect was observed in the running application on this branch's base
before the change and observed gone after it. Geometry is in css px at the report's 1246×1021
unless stated, measured in Chromium in the desktop app's browser pane.

### A. Image detail and controls together

| ID        | Status                               | Detail                                                                                                                                                                                                                                                                                                                                                                     |
| --------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L6-1**  | Reproduced / fixed                   | Measured before: media box 204.7 × 204.7, the 1920 × 1080 recording letterboxed to 204.7 × 115.1 inside it, and the sector-and-scale region 136.9 × 91.3. After: 493.1 × 329.1, all of it image. See the table below.                                                                                                                                                      |
| **L7-5**  | Reproduced / addressed for the image | Same geometry. The nodal border is now rendered at 3.6× the linear size. **Held:** the border itself is still not outlined — no verified annotation exists and inferring one is barred. → 05.                                                                                                                                                                              |
| **L3-1**  | Reproduced / fixed for co-visibility | Lesson 3 and lesson 14 are the same guided simulator surface. The image and the controls that drive it were stacked; they now share a row above 56em. Measured on lesson 14: 707 px tall with a 497 × 497 sector beside a 271 px control column.                                                                                                                           |
| **L5-5**  | Reproduced / fixed                   | The contact model's controls were below the schematic and the 3D view. Views and controls now share a row.                                                                                                                                                                                                                                                                 |
| **L9-1**  | Reproduced / partly fixed            | Measured before: the phantom workbench document was 1761 px tall (the report said 1765) with the controls starting at y = 918, below the image. After: 1304 px, views 491 wide at y = 73 beside controls 276 wide at y = 73. **Not done, deliberately:** the 4 × 13 sweep predicate is unchanged; a recommended starting comparison is offered, not enforced. See C below. |
| **L14-2** | Partly implemented, partly declined  | The co-visibility half is done, so the labs no longer differ on the thing that mattered. **Declined, as the task directs:** lesson 14's tab set was not copied to every lab — in the recorded labs it would hide a comparison the learner needs to see at the same time.                                                                                                   |
| **L21-2** | Reproduced / partly fixed            | The assembly was framed by a fixed camera position that ignored both the model and the panel. See the framing table below. **Held:** labelling the handle parts in view is lane 03/05.                                                                                                                                                                                     |

**Recorded workbench geometry, lesson 7 (the same surface serves lessons 6, 8 and 10).** Both
columns measured on the same build, at the same viewport, on the same task.

| Viewport  | Media box before | Image area before | Media box after | Image area after | Controls after             |
| --------- | ---------------- | ----------------- | --------------- | ---------------- | -------------------------- |
| 1246×1021 | 204.7 × 204.7    | 136.9 × 91.3      | 493.1 × 329.1   | 493.1 × 329.1    | 286 wide, beside, same row |
| 1024×768  | 261.3 × 261.3    | 174.7 × 116.6     | 555 × 370       | 555 × 370        | 310 wide, beside, same row |
| 1440×900  | not measured     | not measured      | 586 × 391       | 586 × 391        | 320 wide, beside, same row |
| 390×844   | not measured     | not measured      | 316 × 211       | 316 × 211        | below, stacked             |
| 320×740   | not measured     | not measured      | 246 × 164       | 246 × 164        | below, stacked             |

"Image area" is the part of the frame a reader can use: the sector plus the depth scale and its
ticks. Before, the recording was letterboxed into a square box and that region was a fraction of
it; after, the box has the region's aspect ratio, so the two are the same rectangle. No horizontal
overflow from this module at any of the five viewports, inside the iframe or outside it.

**Where the region comes from.** `scripts/ebus-guided/measure-recorded-sector.mjs` samples every
authored segment window of all six depth files and takes the union bounding box of the lit pixels:
**x 480…1763, y 76…932 (1284 × 857) of 1920 × 1080**. It is recorded in
`KNOBOLOGY_VIDEO_IMAGE_REGION` with the script named beside it. It is a display window only:

- no file is cropped, re-encoded or replaced;
- the held frame is still captured from the whole frame, banner and all;
- **"Whole recorded frame" is always one control away**, in the workbench and in the enlarged view,
  because a minority of frames carry the device banner — patient header, date, depth setting, frame
  rate — outside the region. The script reports those frames by name (one of the 90 sampled).

**Enlarge.** A dialog shows the current or held frame at up to the recording's own resolution,
aspect preserved, with the same region toggle and the same caption. It asks for full screen (the
host iframe already carries `allow="fullscreen"`); where the browser refuses, the caption says so
rather than implying the view is larger than it is. Nothing is upscaled past the recorded pixels.
Enlargement is a display change and is not called validation of anything.

**Needle framing (L21-2).** Model bounds, measured from the loaded glTF: 122.0 × 45.5 × 24.0 mm.

|                           | Before                     | After                                                                        |
| ------------------------- | -------------------------- | ---------------------------------------------------------------------------- |
| Panel                     | 594 × 240 (controls below) | 454 × 341 (controls beside)                                                  |
| Camera distance           | fixed 178 mm, 38°          | derived: max(45.5/2/tan 19°, 122/2/tan 19° ÷ 1.331) × 1.12 + 12 = **161 mm** |
| Assembly across the panel | ≈ 39% of the width         | ≈ 83% of the width                                                           |

The view direction is unchanged, only the distance, and it is derived so it survives a re-export at
another scale. Camera framing is excluded from `modelFrameId`, so no acquisition identity moved.
Part of the distal geometry is still deliberately concealed during the task; that is untouched.

### B. Stable actions and truthful playback

| ID        | Status                               | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L6-6**  | Reproduced / fixed                   | Measured before, x of each control: not ready → Back 50, "Hold this acquisition" 1000 (disabled), "Continue without an image" 50 on a **second row**; ready → Hold 748, skip **951**. The skip jumped onto the first row into the place the disabled Hold had occupied. Cause: the disabled-reason `<p>` has `flex-basis: 100%` and was inserted only while disabled, and `.skip` was ordered after `.advance` while sitting before it in the DOM. After: Back 50, skip 125, Hold 1000/988→identical, note below, unchanged by readiness.                                              |
| **L7-1**  | Reproduced / fixed                   | Before: the slider read "Gain level 8" while the caption beside it read "Gain 100 · Contrast 43". Two scales, neither a device unit, and the contrast figure described a clip that does not vary contrast. After: every surface names the recorded example, and the frame carries `example` — control, step, segment, file and window, e.g. `Depth 4 cm · gain example 4 of 8 · clip Depth4_Gain_4, 6.0–8.0 s of Depth4.mp4`. A line under the controls says each recording varies one control and holds the rest as recorded.                                                         |
| **L7-3**  | Reproduced / explained, not bypassed | Reproduced: readiness dropped the moment contrast was moved and returned only when gain was moved again, with no statement of why. Investigated: the requirement is real, not stale state — the lookup holds one clip per step of one control, so the clip on screen is a gain example only while gain is the control last moved, and the goal is to hold a gain example. It is now named, from the same conditions the gate applies (`labGoalRequirements`), with a test that holds the two to the same answer for every lab in the course. **The criterion itself is unchanged.**    |
| **L7-4**  | Reproduced / fixed                   | Reproduced and traced: changing a control cleared the ready key, which disabled the whole fieldset for ~20 ms (sampled at 8 ms: enabled → disabled at 51 ms → enabled at 73 ms), and a disabled control loses focus. Focus went to `BODY` on the first change and every later arrow press went nowhere — "registered only once". After: selection controls always apply the latest intent, the fieldset is not disabled while a clip decodes (it is `aria-busy` with a visible line), and focus stays. Verified: four rapid steps, focus on "Image gain" throughout, all four applied. |
| **L14-4** | Reproduced / fixed                   | Traced: `allowed('freeze')` requires `freeze` in `config.controls`, and no guided simulator lab has it, so it rendered permanently disabled in all of them. It is now absent in a guided lab that was not given it. It was **not** enabled: nothing bypasses the bridge and no stale pixels are labelled current.                                                                                                                                                                                                                                                                      |

**Late and out-of-order responses.** Readiness is keyed to the resolved segment's name, and while a
newer selection is decoding the observation reports **no** `recorded` provenance rather than the
previous frame's — so a stale frame can neither be reported ready nor be committed under the new
settings. Driven in the browser: `gain 7 → contrast 1 → gain 5` dispatched in one tick settles on
`Depth4_Gain_6`, window 10.0–12.0 s, `readyState` 4, `currentTime` 10.03 — the last selection, not
an earlier one.

**One defect this batch introduced and fixed inside it.** With input no longer dropped while a clip
loads, a fast run of selections could leave a seek that completed before its data decoded; the
element then fires nothing further and the workbench stayed busy with no way out (observed:
`readyState` 1, `currentTime` 10.03, busy indefinitely). Readiness is now re-asked on `canplay`,
`timeupdate` and each rendering frame. It still never claims an unloaded image is ready.

**Not added, as the task directs:** no Doppler PRF, scale or wall-filter control; no clip
fabricated between settings; nothing synthetic presented as patient evidence.

### C. Measurement practice

| ID                     | Status                        | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L9-3**               | Reproduced / fixed            | The section had no scale and the position fields no units or origin. The section's `viewBox` **is** the phantom coordinate system (x −30…30, y 0…46 in authored mm), so a 10 mm bar, decade depth ticks and a midline mark are exact rather than measured off the picture. The fields now read "Horizontal position · phantom mm, 0 at the midline" and "Vertical position · phantom mm from the top of the field".                                        |
| **L9-2**               | Reproduced / addressed        | `phantomPlaneReference` derives the section, its axes, their lengths and where the requested axis lies **from the exact current plane**, never from an assumed full-object diameter: at the elongated phantom's central plane, short 16.0 / long 32.0 mm; at offset 6 the short axis is 16·√(1−0.36) = 12.8 mm. It can be opened at any time, including before an attempt. It shows a difference, with **no score, no threshold and no competence claim**. |
| **L10-1**              | Partly addressed, partly held | The workbench now says in as many words that two separated points are control practice and not evidence that either sits on a border, and reports the separation in recorded-frame pixels. **Held:** no expert overlay on the recorded ultrasound. There is no sourced one, and inventing it is barred. → 05.                                                                                                                                              |
| **L10-2**              | Reproduced / fixed            | Calipers moved only with four buttons on a 240 px image, with no connecting line and no readout. Pointer and touch placement now work on the image in either view, a dashed line joins the two, and the separation is reported honestly. Keyboard/button placement is unchanged and both go through the same reducer action, so both are clamped identically.                                                                                              |
| **L9-1** (second half) | Declined as written           | Shortening the 4 × 13 exploration would delete an accepted-work predicate. `MODEL_STEPS.measurement` is unchanged and asserted unchanged by test. A "Go to the recommended comparison" control offers the plane the recorded task actually asks for; deeper exploration stays available. Any change to the requirement belongs in 04/05.                                                                                                                   |

**The pointer transform.** The displayed box always has the aspect ratio of the region it shows, so
the mapping is that region's own offset and scale — no letterbox to subtract. Verified analytically
and in the browser: a click at 45% / 30% across the image view resolved to frame pixel
(1057.8, 333.1), which is 480 + 0.45 × 1284 and 76 + 0.30 × 857 exactly. Ten Vitest cases hold the
corners of both views, scale invariance, agreement between the two views on the same point, and
that the separation readout is in recorded-frame pixels.

**No pixel-to-clinical-millimetre conversion was added.** The recorded clips have no verified
calibration in this repository, so the readout says "N px of 1920 × 1080" and says what that is
not. Phantom millimetres stay inside the analytic phantom and are labelled as such on every surface
that prints them.

**Provenance preserved:** freeze, save and hold are unchanged; the saved image is still drawn from
the whole frame; marker coordinates are frame-normalised so they survive resize, the region toggle
and the enlarged view; the empty states are unchanged.

### Carry-forward from 01 — L5-1

**Resolved as far as the evidence allows; the wording decision stays with the later lane.**

The contact model's condition genuinely exists at acquisition time — it is `ContactState.mode`, one
of five, and it already feeds `modelFrameId`. It simply was not carried across the bridge, so the
host could label a frame "your held acquisition" without being able to say which of the five it
was, while an authored check named a state. `EbusObservation.model.contactMode` now carries it,
read from the live model state at the moment of the observation, and the evidence pane names it:
"Your held acquisition, from this session in this workbench. **Contact condition held: air gap.**"
Driven end to end in the browser with a real acquisition.

What was deliberately not done: no state is inferred from the image, none is reconstructed after
the fact, no held acquisition is relabelled to match the question, no supplied example is
substituted for a learner acquisition, and **no question wording, answer key, clinical claim or
review status changed**. The distinctions lane 01 established — live, held, held-missing, supplied,
demonstration — are intact, and the new line only appears on a real `held` acquisition of the
contact package.

**What remains for the teaching/content lane.** Lesson 5 check 2 still names the reflector state
while a learner may legitimately be holding another one. The learner can now see that, which is
better than not seeing it, but whether the item should be re-worded, or the task should ask for a
specific state, is a content decision. → 04/05.

## Content strings touched

Two, both naming the control scale, both in `src/features/ebus-guided/content/optimize.ts`:

1. the lesson 7 lab instruction — "from level 8 … stop at level 4 or 5" → "from example 8 … stop at
   example 4 or 5", plus one sentence saying the clip on screen is a gain example only while gain is
   the control last moved;
2. the Optimize boundary line — "Levels are specific to this teaching library" → "Example numbers
   are specific to this teaching library".

They exist because L7-1 asks for one coherent vocabulary and the workbench now says "example". No
question, choice, rationale, explanation, answer key, source or clinical claim was edited; the
diff contains no other content file.

## Verification

| Check                                                                                        | Command                                                                        | Result                                                                                                                                                             |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| This batch's host regressions                                                                | `npx jest src/features/ebus-guided/__tests__/pre-review-02.test.tsx`           | 31 passed                                                                                                                                                          |
| The same file against unmodified `origin/main` sources (checked out in place, then restored) | same                                                                           | **19 of the 27 that can run fail**; the other 4 do not exist on the baseline because `CONTACT_MODES` does not. The 8 that pass are the controls.                   |
| EBUS host, routes, bridge, evidence, state                                                   | `npx jest src/features/ebus-guided`                                            | 12 suites, 155 tests passed                                                                                                                                        |
| Shared verdict and its consumers                                                             | `npx jest src/features/ebus-guided src/features/learning-module`               | 27 suites, 293 tests passed                                                                                                                                        |
| Embedded app (Vitest), including the new transform tests                                     | `npm --prefix EBUS-course/apps/web test`                                       | 36 files, 264 tests passed                                                                                                                                         |
| Embedded types                                                                               | `npm run type-check:training-apps`                                             | clean                                                                                                                                                              |
| Root types                                                                                   | `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit`                      | exit 0. The default heap OOMs on this repository, unrelated.                                                                                                       |
| Whole host suite                                                                             | `npx jest`                                                                     | 900 of 909 suites pass. **Nine failures, all pre-existing** and identical to the list in the 01 handoff; none touches EBUS or anything in this diff. Listed below. |
| Training-app checks under their own runner                                                   | `npm run test:training-apps`, `node --test scripts/training-apps.test.mjs`     | 264 passed; 4 passed. (Jest reports this file as failing only because it is a `node:test` file.)                                                                   |
| Lint                                                                                         | `npx eslint src/features/ebus-guided src/lib/ebus-*.ts scripts/ebus-guided`    | clean                                                                                                                                                              |
| Formatting                                                                                   | `npx prettier --check` on the changed paths, and `lint-staged` on every commit | clean                                                                                                                                                              |
| Production build                                                                             | `npm run build`                                                                | exit 0. The built embedded bundle contains this batch's code (`recorded-frame-media` in `guided-HPicLmx7.css`, "Whole recorded frame" in `guided-CTL8_Nah.js`).    |
| The built site, served standalone                                                            | `PORT=3130 node .next/standalone/server.js`                                    | the changed workbench is served and behaves as measured; see the playback evidence below.                                                                          |

**Pre-existing failures, unchanged by this batch:**
`scripts/ip-preference-cards/check-brochure-intake-static-exposure.test.ts`,
`scripts/ip-preference-cards/us-status/__tests__/safety-boundaries.test.ts`,
`scripts/training-apps.test.mjs` (runner artefact; passes under `node --test`),
`src/features/bronchial-branch-tracing/__tests__/contracts.test.ts`,
`src/features/critical-care/__tests__/accessibility.test.tsx`,
`src/features/critical-care/__tests__/curriculum-sequencing.test.tsx`,
`src/features/critical-care/__tests__/learner-copy.test.ts`,
`src/features/literature/dedicated-supabase/foundation-manifest.test.ts`,
`src/lib/board-review-html.test.ts`.

### Playback evidence

From the **production standalone build**, not the dev server, in Chromium in the desktop app's
browser pane with H.264 available. No WebM substitution was needed or used.

| Field                  | Recorded value                                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Source file            | `/socal-ebus-course/app/media/knobology/Depth_segments/Depth4.mp4`, H.264                                                               |
| Decoded dimensions     | 1920 × 1080, `readyState` 4                                                                                                             |
| Segment and window     | `Depth4_Gain_8`, 14.0–16.0 s; `currentTime` 14.025                                                                                      |
| Paused source          | frame decoded and drawn while paused; playback never starts on its own                                                                  |
| Playing source         | Play → `currentTime` 10.03 → 10.53 s, status follows the element                                                                        |
| Out-of-order selection | three selections in one tick settle on `Depth4_Gain_6`, 10.0–12.0 s                                                                     |
| Load failure           | "This teaching clip could not load. Reload the activity to retry."; busy cleared; the host's Hold stays disabled                        |
| Comparison identity    | after "Keep this image for comparison", the previous image's pixels and caption stay byte-identical while the current recording changes |

Autoplay behaviour was not changed anywhere, no browser safeguard was weakened, no origin or
session check was touched, and not one clip was re-encoded. Performance derivatives, if they are
wanted, belong to 05.

### Bounded viewport matrix

1246×1021 (the report's), 1440×900, 1024×768, 390×844, 320×740, and a 200% root-text condition at
1440×900. No horizontal overflow from this module at any of them, inside the iframe or outside it.
At 390×844 all focusables inside the workbench are reachable and in view when focused. Both site
theme classes were exercised; this route renders the same palette under each, which is how it was
before this batch — the embedded workbench has always had its own fixed palette, and changing that
would be the visual redesign this task rules out.

**One environment artefact, not a product defect.** While the desktop app's browser pane is hidden,
the whole tab's `requestAnimationFrame` is suspended, so the guided document's height message never
fires and the iframe holds its initial 800 px while its content is 1285 — which looks exactly like a
fixed-height overflow trap. Taking a screenshot forces a paint and the height corrects to 1289 px
immediately. `document.hidden` was `true` throughout; the parent window's `requestAnimationFrame`
was suspended too. Recorded rather than "fixed".

## Regression checks

- **Lane 01, re-driven on this branch:** the comparison heading after a wrong answer is still "How
  the other answers compare" with the keyed row marked; the case reference CT is still present;
  "Leave this case" still closes the case; the explanation still opens without an answer; skipping
  an acquisition still holds nothing.
- **Self-paced contract:** no score, no mastery, no first-response persistence, no forced attempt,
  no new gate. The one new list (what an acquisition is still waiting for) reports the conditions
  that already existed.
- **Storage:** nothing added, removed or re-keyed. No schema migration, no telemetry, no auth
  change.
- **Real-image prerequisites:** `labGoalMet`, `retainedImageAvailable`, the hold handshake and the
  workbench origin/session checks are untouched. `labGoalRequirements` reports; it never decides,
  and a test holds the two to the same answer across every lab in the course.
- **Freeze / capture / reset:** unchanged, except that freeze, measure and save now also require a
  decoded frame, which they always needed in fact.
- **Legacy EBUS entry points:** the standalone SoCal EBUS course loads from the built site and its
  simulator still shows an enabled Freeze; the legacy knobology panel's module is unchanged.
- **Source and review status:** unchanged. Nothing in this diff touches a source list, a citation
  or a review claim.

## Observations recorded, not acted on

1. **`"This is your last unannotated ultrasound frame"`** — the string lane 01 could not find in
   the repository is in `SimulatorPage.tsx`, shown on a locked linked acquisition. It is a copy
   claim rather than a playback or geometry defect, in a shared legacy renderer. → 04.
2. **`POST /api/analytics` returns 500** on this checkout because no Supabase URL/key is configured
   in this worktree. Local environment, not an application regression, and no change to
   authentication or tracking is authorised. Identical to 01's note.
3. **A global site-header link overflows the viewport by 2 px at 200% root text.** Outside the
   lesson flow; global chrome belongs to the PI platform task, as 01 also recorded.
4. **The embedded workbench does not follow the site's light/dark theme.** Pre-existing: it is a
   separate document with its own palette. Changing it is a visual redesign.
5. **Root-text enlargement in the host does not scale the embedded workbench**, for the same
   reason. Its own controls are already ≥ 40 px tall and its text is 12–15 px.

## Not run

- Any human usability session, clinical review, source review or media-rights review.
- Any beta-wrapped route: this session found no EBUS route behind the beta wrapper, and that
  surface belongs to PI platform 05. All browser evidence is from the direct `/en/ebus-guided/**`
  routes and is labelled as such.
- Playwright (`npm run test:e2e`): not part of this batch's evidence and not run.
- Any measurement of the guided simulator's _baseline_ height at 1246×1021 — the "~1300 px" for
  lesson 14 is the source report's figure, not one of ours. The after figure, 707 px, is measured.
- Safari, Firefox and any real mobile device. All browser evidence is one Chromium build.

## What a reviewer should look at first

1. **The vocabulary.** "Gain example 4 of 8" replaces "Gain level 8 / Gain 100" everywhere,
   including in two authored strings. It is more truthful about what the library is; it is also a
   change of voice, and the clinical-language lane may want a different word than "example".
2. **The region toggle's default.** It opens on the measured image area, with the whole recorded
   frame one click away. The alternative default — always the whole frame — is more conservative
   and gives a smaller sector.
3. **The outstanding-conditions list on an acquisition**, particularly the sentence explaining why
   the gain control has to be the one moved last. That criterion is unchanged; whether saying it
   out loud is the right teaching is a judgement.
4. **The model reference being openable before an attempt.** Section C of the task allows it
   explicitly; it is still a change in how much the learner is handed.
5. **The held contact condition on the evidence pane**, and whether lesson 5's check 2 should now
   be re-worded in 04/05.

## Boundaries

This batch is not a clinical review, a source review, a media-rights review or a usability session.
"Reviewed" in this course still means a place in a browser, not competence. Nothing here is
authorised to merge, deploy, publish or start lane 03.

## Independent pre-merge sanity review — 2026-09-21

One bounded review of PR #251, starting at the requested head
`cb85f63ed955698d09bfed0d5347812eb4ba8114`. Current main and the PR base were both
`c717c9ffae09cb67e19b06a56d37c75487a5605a`; GitHub reported `MERGEABLE / CLEAN`.
The 25-file starting inventory is recorded in `sanityReview.changedFilesAtStart` in the status
JSON. Of the other open PRs, only #254 overlaps, in `.claude/launch.json`; none overlaps this PR's
runtime changes. The explicit review request authorizes the correction in the existing PR.

Read the Prompt 02 instructions and PI/EBUS coordination rules from the local implementation pack,
the 01 and 02 handoffs, 02 status, active self-paced contract, actual diff, lookup and bridge.
The earlier fellow walkthrough remains AI-assisted engineering evidence, not learner validation
or clinical review. No G02 audit, lane 03, redesign, clinical/media resolution, merge or deployment.

### Reproduced finding and narrow correction

**P2 — terminal media failures still claimed active loading.** On the original production build,
abort either `Depth4.mp4` or `knobology_lookup.json`, open lesson 7 and continue to acquisition.
The error alert appears, but the new status still says “Loading the selected recording” and both
new `aria-busy` attributes stay `true`. Lookup failure also leaves the image loading line present.
The original Playback evidence row's claim that busy cleared was incorrect.

`GuidedKnobology` now distinguishes a failed recording from one still loading. Both busy attributes
clear on failure, the status says “Recording unavailable”, and the loading line disappears.
`frameReady`, selection controls, decoding, snapshot identity and all acquisition predicates are
unchanged. Failure does not enable Hold.

The two tests in `e2e/ebus-recording-status.spec.ts` both failed on the original built head at the
`aria-busy` assertion before correction. They drive the real host and embedded app with isolated
browser contexts and failed network requests, rather than mocking the workbench. The added EOF
blank line in `RecordedFrameView.tsx` was also removed because `git diff --check origin/main`
reported it. No speculative cleanup was made.

### Playback and acquisition evidence

Headed Chromium, clean contexts, production standalone host on `127.0.0.1:3137`. `ffprobe` and
browser decoding both confirm original H.264 at 1920 × 1080. No replacement media or owner progress.

| Challenge                              | Independent result                                                                                                                                                                           |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Four rapid arrows                      | Gain 8 → 4; `Depth4_Gain_4`, 6.025 s, readyState 4. Focus stays on Image gain.                                                                                                               |
| Rapidly alternating controls           | Ends on `Depth4_Contrast_4`, 22.025 s; Hold correctly unavailable.                                                                                                                           |
| Away from and back to required control | Return to gain 4 produces `Depth4_Gain_4`, 6.025 s; Hold becomes available.                                                                                                                  |
| Earlier slow media, newer fast media   | Hold the Depth3 request pending, choose Depth4, then release Depth3. Depth4 remains displayed at 4.025 s with source `Depth4_Gain_3`; the old request cannot replace it.                     |
| Input while busy                       | Depth remains focused and accepts the newer selection while the earlier request is pending. Busy observation has frameReady=false and no recorded source; successful newer load clears busy. |
| Paused and playing                     | Initial decode occurs paused. Play advances currentTime from 6.025 to 6.533 s without autoplay.                                                                                              |
| Hold and region toggle                 | Whole 1920 × 1080 held image; data URL unchanged after toggling to whole frame. Enlarged held view keeps the source caption.                                                                 |
| Error                                  | Missing clip and missing lookup cannot create a held acquisition; terminal loading claim corrected as above.                                                                                 |

The lookup independently supports the last-control rule. Gain segments occupy 0–16 seconds,
contrast segments 16–32 seconds and flow segments 32–38 seconds of each depth file. A selected gain
value does not alter a contrast recording. The gain lab requires a middle gain, contrast explored,
and gain last; its explanation, selected segment and gate agree. The depth lab selects a recording
at the requested depth (including preferred `Depth4_Gain_3`), rather than synthesizing a distinct
depth-control segment. The Doppler lab requests its flow segment. Existing tests compare
`labGoalRequirements` with `labGoalMet` across all labs. No criterion was removed.

**Pre-existing limitation, outside the correction:** pausing the video element outside the UI can
leave “Recording playing” displayed. Reproduced with `video.pause()`. Main already derives the
label from `playbackPaused` and lacks a native pause subscription; this PR's added mount-only
subscription runs before async lookup creates the video, so it does not repair that existing
behavior. Normal UI play/pause works. This is recorded separately from the PR-caused loading defect.

### Region, vocabulary and contact carry-forward

Fresh measurement of 90 sampled frames reproduces **x 480…1763, y 76…932**, 1284 × 857. The script
samples 15 times per file; this is not an assertion about every possible frame. The default Python
lacked numpy, so the existing extracted PNGs were analyzed with the bundled Python runtime.
Independently inspected the original Depth3 frame at 11 s, Depth4 gain image and Depth8 flow image.
The Depth3 sample has its header and device information outside the region, visible in the original
frame. The sector and depth scale are inside the region. Display transforms do not modify files,
held pixels or frame identity, and the whole-frame control remains one action away. No border was
inferred or drawn. Tested enlargement remained below original resolution; fullscreen was denied in
this iframe and the UI disclosed its workbench-sized fallback.

Every new learner-facing “example” use was checked: current/previous/enlarged segment captions,
gain/contrast outputs, the workbench boundary paragraph, the two Optimize strings, and the gain/depth
outstanding conditions. They describe the authored recording library; no device units, patient
settings, recommendation or learner-owned acquisition are implied. Editorial preference remains
lane 04, not a merge blocker.

**L5-1 DATA CONTRACT RESOLVED; QUESTION/EVIDENCE ALIGNMENT REMAINS CONTENT HOLD FOR LANE 04/05.**

Drove the actual contact controls through the model steps, then held **air gap** and, in a separate
fresh journey, **direct contact**. The model observation, validated same-session bridge and retained
pane preserve the selected mode. Frame IDs were `additional-models-v1:contact:8bc777e7` and
`additional-models-v1:contact:24cb3b20`. On check 2 the pane truthfully names the held condition while
the authored question still names reflector. Nothing is relabelled or substituted. Reload restarts
the unfinished lesson at briefing and clears held evidence, as the existing storage contract
requires. Existing tests cover missing optional modes, invalid modes and non-contact packages.
No condition is reconstructed from a later question or guessed from pixels.

### Visual and legacy checks

Recorded, phantom and needle workbenches were measured at 1440×900, 1246×1021, 1024×768 and 390×844.
No positive horizontal overflow was found in host or iframe. Normally painted iframe heights match
their documents; no background-tab throttling workaround was introduced.

| Viewport  | Recorded image region | Control width / placement                |
| --------- | --------------------- | ---------------------------------------- |
| 1440×900  | 605.6 × 404.2         | 326.9, beside image at the same top edge |
| 1246×1021 | 501.4 × 334.6         | 292.1, beside image at the same top edge |
| 1024×768  | 566.3 × 377.9         | 313.8, beside image at the same top edge |
| 390×844   | 301.0 × 200.9         | 301, stacked and reachable               |

Model workbenches retain their existing desktop/tablet requirement at phone width and preserve
paused state without claiming a current frame. The phantom's recommended plane/reference and the
needle's sheath, lock and advance controls respond. Standalone simulator Freeze → Resume → Freeze
works, `.guided-scan-workspace` is absent there, and standalone knobology loads. Shared renderer
edits remain guarded by guided configuration; selection logic and standalone geometry are unchanged.

Prompt 01 protection comes from the focused host/shared regressions plus these real acquisition,
reload and navigation journeys: truthful verdicts, case exit, evidence identity, matching/ordering,
record semantics and lesson/focus clearance remain intact. This was not another full walkthrough.
For the structured-module review contract within this scope: H1/H4–H12 PASS; H2/H3 NOT APPLICABLE
(no curriculum redesign or stage migration; active self-paced policy governs layout). These are
bounded engineering checks, not a full-module teaching or clinical certification.

### Final validation

Raw logs, measured JSON and screenshots from this review are local in `/tmp/ebus251-sanity`;
no raw media or screenshots were added to Git.

| Check on the corrected tree                                                  | Result                                                                                                                                                                             |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx jest src/features/ebus-guided src/features/learning-module --runInBand` | 27 suites, 293 tests pass; includes Prompt 01 and 02 regressions.                                                                                                                  |
| `npm --prefix EBUS-course/apps/web test`                                     | 36 files, 264 tests pass.                                                                                                                                                          |
| `npm --prefix EBUS-course/apps/web run typecheck`                            | Exit 0.                                                                                                                                                                            |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check`                  | Exit 0.                                                                                                                                                                            |
| Scoped ESLint, including new browser tests                                   | Exit 0 under repository config. The imported EBUS tree remains excluded by that config.                                                                                            |
| Prettier on changed nonignored paths                                         | Pass under repository policy; imported EBUS formatting preserved.                                                                                                                  |
| `git diff --check origin/main`                                               | Exit 0 after removing the reported EOF blank line.                                                                                                                                 |
| `npm run build`                                                              | Exit 0, fresh embedded bundle and standalone output. Review production server stopped before rebuilding; no task dev server/watchers running.                                      |
| New browser regressions against rebuilt production                           | 2 pass, following 2 failures on the original build.                                                                                                                                |
| Healthy-media check after correction                                         | Repeated selections while earlier decode-readiness is withheld, late seeked/canplay events, normal UI Play/Pause, gain criterion, Hold and unchanged whole-frame capture all pass. |

For the deterministic decode-readiness check, test instrumentation temporarily exposed readyState=1
for the earlier gain-7 window; three more arrows selected gain 4. After releasing that gate and
delivering late media events, `Depth4_Gain_4` stayed current and focused. This complements the real
pending-network test; it is not presented as a naturally occurring slow decode.

The new regression command was `npx playwright test --config /tmp/ebus251-sanity/playwright.config.cjs`.
That local configuration selects only `ebus-recording-status.spec.ts`, one worker, no retries,
headed Chromium at 1440×900, and baseURL `http://127.0.0.1:3137`, with no dev webServer. The host was
started with `PORT=3137 HOSTNAME=127.0.0.1 node .next/standalone/server.js` after `npm run build`.

The full suite was not rerun: the correction only changes GuidedKnobology's loading presentation;
no shared legacy runtime was edited during this review, and the two failures isolate that state.
Main and remote PR head were re-fetched immediately before delivery and remained unchanged.

**SANITY REVIEW: READY TO MERGE**, with the terminal-loading correction in this commit. The
pre-existing external-pause label limitation and content/media holds above are not claimed resolved.
No merge, deployment or next lane was performed.
