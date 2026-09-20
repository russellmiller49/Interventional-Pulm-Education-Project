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
