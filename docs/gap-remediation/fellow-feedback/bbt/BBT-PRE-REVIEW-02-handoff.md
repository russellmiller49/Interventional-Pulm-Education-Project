# BBT-PRE-REVIEW-02 — a stable and readable CT workspace

**Scope:** Bronchial Branch Tracing only — `src/features/bronchial-branch-tracing/**`, the module's
own `e2e/branch-tracing.spec.ts`, and this document set. No other module, no auth or access policy,
no shared header/footer/global CSS, no shared lesson-stage component, and no source volume, mesh,
graph or nomenclature file was changed.

**No clinical approval, faculty review, release, deployment or merge is claimed or performed.**

## OD-01 is still open, and nothing here touches it

The first-junction teaching mismatch remains an owner/anatomy decision. This batch changed how the
CT is displayed and controlled; it did not change what the CT shows or where a response belongs.
Specifically:

- No response-slice coordinate, graph coordinate, branch identity or nomenclature was changed —
  every file that holds them is byte-identical to `origin/main` (hash table below).
- The `entryLimitation` disclosure that task 01 added still appears before the task, unchanged.
- No display change moved a response plane, and no proximity is presented as an anatomical verdict.
- `exercise.review.status` stays `provisional`; the BBT-02 five-junction packet stays NOT REVIEWED.

One piece of technical evidence relevant to the later OD-01 packet came out of this work and is
recorded rather than acted on: at the authored crop for `junction-1`, the two model locators project
about 4.5 user units apart in a 100-unit viewport, which at the baseline 720 px image is roughly
32 px — smaller than the 27 px-tall label each of them carried. That is why the two labels printed
over each other ("A · RMSBB · LMSB" in the report). It is a measurement about label size against
locator separation, not about anatomy, and it does not bear on which plane should be taught.

## Repository reconciliation

| Field                    | Recorded value                                                                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worktree                 | `/Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/claude-bb-2-9-19`                                                                                                            |
| Branch                   | `claude/bb-2-9-19`, at freshly fetched `origin/main`                                                                                                                                                |
| Base SHA                 | `c717c9ffae09cb67e19b06a56d37c75487a5605a` (fetched 2026-09-20; task 01 merged as PR #250). The package's planning SHA `77a141cc` is historical context only.                                       |
| Open PRs overlapping BBT | None. Open at the time of work: #134 (critical care), #114 and #98 (literature). No shared file contention.                                                                                         |
| Dev server               | `next dev --port 3121`, this worktree only. Port 3001 was deliberately avoided so no run could reuse another checkout's server.                                                                     |
| Browser profile          | Fresh Playwright/Chromium profiles and the built-in preview pane. The owner's Chrome profile and the `claude-review-backup::branch-tracing::2026-09-19` backup were never opened, restored or read. |
| Test data                | Synthetic drafts created in each run's own `localStorage`. No fixture is presented as performed learner work.                                                                                       |
| Environment              | `.env.local` was neither read nor written. The production build used `.env.example` placeholder values passed as process environment only.                                                          |

## Assigned findings — what happened

Per-ID detail with the raw numbers is in `BBT-PRE-REVIEW-02-status.json`.

### A. Control positions must not change with response readiness

**BBTF-03 · reproduced exactly · repaired.**

Appendix A reproduced on the unmodified base at 1427 × 1226 with real mouse input: stepping
Trachea 416 → 413 → 412, the minus button moved from x 483 to x 827 and from y 1042 to y 990, and
the slider shrank from 802 px to 458 px, because the guidance text collapsed from its own wrapped
row into the same flex line as the slice controls. A genuine click at the previous minus centre
(499, 1064) then landed on **Full CT field** and toggled the zoom — the report's exact outcome.

The controls now live in a small grid directly under the image: the slice row first, the display
tools next, the guidance and its two actions last, with two lines of space reserved for the
guidance text. Both response actions ("Go to response slice", "Lumen unresolved here") are always
present and change only their enabled state, so no control is created or destroyed as the response
slice is reached. After the change the minus button, slider, plus button and image rectangles are
identical across 413 → 412, the old click point still belongs to "More caudal CT slice", a repeated
click steps on to 411, and keyboard focus stays on the minus button throughout. The same holds at
1024 × 768. No coordinate ever marks an unavailable or wrong native plane: marking still requires
the requested plane to be the one on screen.

### B. Keeping the inspection view stable on Check

**BBTF-12 · reproduced · repaired.**

Figure 5 reproduced on the base: with the image workspace scrolled by 47 px, "Check my tracing"
moved the learner's mark 47 px down the screen while the stored native pixel was unchanged. Two
separate causes, both display-side:

1. `resetPaneScroll(imageWorkspaceRef)` ran on every phase change, so entering feedback returned the
   CT pane to its top. It now runs only when the exercise, the orientation introduction or a restart
   genuinely opens a new workspace. The instructions pane still returns to its own top, because that
   pane holds the new task.
2. Content below the image shrank on Check — the guidance row and "Reset attempt" were removed — so
   the browser clamped the pane's scroll position and the image slid down. Both now hold their place
   (the guidance carries a review message; "Reset attempt" stays in the layout with `visibility`
   hidden outside the marking step), so the pane's scroll height is unchanged across the transition.

In the viewer, `resetPaneScroll` no longer fires on `referenceThrough`, so revealing a model
reference cannot recentre the image either; it still fires when a different junction or level is
opened, which is a real navigation. A slice request for the plane already on screen now keeps the
learner's crop instead of clearing the focus state.

After the change the mark's screen position, the SVG crop transform and the pane's scroll position
are all identical across Check (0 px shift, scrollTop 50 → 50), and the stored mark is unchanged.
No "Fit comparison" action was added, because nothing now moves that would need one.

### C. Annotation readability and useful image size

**BBTF-11 · reproduced · repaired.** At the first division, with both daughters marked and checked,
the base drew three labels of which two overlapped ("A · RMSB" at x 820–928 over "B · LMSB" at
x 920–1025), one generic "Your mark" for two marks, four rings that told learner and model apart by
colour only, and no way to clear them. Labels are now laid out by a collision pass with leader
lines back to their anchors: the same state produces four labels, zero overlaps, "Your mark A" and
"Your mark B" as distinct identities, four leader lines, and two rings. The anchors themselves are
untouched — `placeOverlayLabels` moves only screen text, which a unit test asserts against every
authored checkpoint in all eight displays.

Model locators and references are now drawn as a **gapped crosshair** with a clear centre instead of
a ring, so learner marks (a ring) and model locations (a crosshair) differ by shape as well as
colour, and the few pixels of lumen under a locator are no longer covered. No lumen contour was
invented, no reference point was moved, and the reviewed-contour path is unchanged. A "Hide
overlays" button beside the image clears every ring, crosshair and label and restores them
immediately; it records nothing. Label text was reduced from 4.3 to 3.4 user units and no maximum
pixel size was imposed.

**BBTF-40 · repaired.** The magnification control was buried in the "Image details" disclosure. It
is now a labelled slider beside the image with a numeric readout, and its range was raised from
2.5× to 4× for the two-to-three-pixel RB5 lumens. The copy states plainly that it enlarges the
native pixels and creates no extra resolution and no validation. Pointer and keyboard marking round
trips were tested before and after magnification: the stored native pixel is unchanged by
magnifying, and a mark placed while magnified still resolves to a native coordinate inside the
volume. The full-field view remains one button away.

**BBTF-35 · reproduced · repaired by renaming and making it do something.** "Highlight the region"
outlined the entire 720 × 720 image, which is what the report said. It is now **"Focus CT view"**,
and it restores the crop this division was authored with (clearing full-field and any start/target
focus) — an existing, evidenced region, not an invented one. The frame around the viewport remains
as visible confirmation and is documented in the stylesheet as framing the displayed crop, not an
anatomical region of interest. No contour is drawn and no mark is placed.

### D. Demonstration loading and adjacency

**BBTF-21 · reproduced · repaired.** On the base the demonstration transport sat 784 px down the
instructions pane, in a different column from the CT — the report's "about 850 px of text". The
transport (Play/Pause, Previous, Next, Replay from parent), the current caption and a
"Demonstration slice N · i of n" readout now sit directly under the CT in the image column, inside
the viewport without scrolling (Play at y 964 at 1427 × 1226). The full caption transcript and the
lesson teaching stay in the instructions pane. Nothing autoplays, and playback is never required.

**BBTF-25 · reproduced with decoded pixels once the network was slowed · repaired.** The base
rendered the CT with `key={url}`, so changing slice unmounted the decoded image and left the black
backing rectangle plus a full-cover "Loading CT slice…" panel until the new plane arrived — the
reported black frame, deterministic rather than a race. On an unthrottled local server a 100 ms
sampler never caught it, so it was measured again with a 450 ms delay injected on every native
plane and the CT frame decoded from a screenshot:

| Sample after clicking − | Baseline `data-slice` / mean luminance | After `data-slice` / mean luminance |
| ----------------------- | -------------------------------------- | ----------------------------------- |
| before the click        | 416 / 142.6                            | 416 / 135.7                         |
| +60 ms                  | **415 / 13.2**                         | 416 / 131.0                         |
| +160 ms                 | **415 / 13.2**                         | 416 / 131.0                         |
| +260 ms                 | 415 / 142.7                            | 415 / 136.2                         |
| settled                 | 415 / 142.7                            | 415 / 136.2                         |

The baseline frame goes black (mean 13.2 of 255) _while already labelled slice 415_ — a new slice
number with no pixels. After the change the anatomy never leaves the screen and the label stays on
the plane that is actually shown, with a small chip reading "Loading slice 415… showing slice 416"
until the swap.

The viewer now keeps the decoded plane on screen until every image the requested plane needs has
loaded, then swaps in one step, during render rather than in an effect so no intermediate state is
painted. In the same slowed condition, twelve DOM samples across a slice change show zero frames
with no image element, zero full-cover panels and zero samples where the slice number, caption or
overlays disagreed with the pixels on screen. Overlays stay withheld until the requested plane is
the one displayed, so no overlay is ever drawn on the wrong plane. Preloading is bounded to ±2
planes around the browsed slice; the stack is never fetched eagerly. Failure still says so and still
offers Retry; a not-ready plane still pauses the demonstration and leaves retry and skip available.

**BBTF-36 · investigated · the authored sequence is not coarse.** Every authored demonstration
sequence in every local exercise steps by 0 or 1 slice — checked programmatically across all
sixteen exercises. The reported 401 → 404 → 408 → 413 → 418 is consistent with sampling a 900 ms
per-frame playback of the 68-frame Lesson 4 interval, not with a skipping player or a coarse
authored list. The repair is therefore visibility, not new frames: the transport now carries a
slice readout and its position in the sequence, sits with the image, and steps one adjacent native
plane at a time, and the caption block states that no image is interpolated between planes. No
intermediate image evidence was fabricated and no new landmark was annotated; model-reference marker
evidence stays with tasks 03 and 05.

### E. Input semantics, fullscreen and rotated fit

**BBTF-28 · the reported direction did not reproduce; the opposite defect did · repaired.** On the
base, a wheel gesture over the CT did **not** scroll the pane — it always changed the slice and
always called `preventDefault()`, so ordinary page scrolling was trapped over the image and a plain
scroll could silently carry the learner off the response plane. Wheel-to-slice is now off by
default: the wheel scrolls the workspace as usual. An explicit "Wheel steps slices: off/on" button
beside the slider turns it on, the same button or Escape turns it off, the listener is local to the
image surface, and a ctrl/cmd zoom gesture is never intercepted. Page Up/Page Down and the slider's
own keyboard controls are unchanged. The "Image details" copy was rewritten to describe what the
inputs actually do.

**BBTF-32 · not a product failure; a fallback was added anyway.** With a direct trusted click,
`Expand CT views` enters fullscreen on both the base and this branch (`document.fullscreenEnabled`
true, `document.fullscreenElement` set, a working close control). The report's message came from the
automation session, exactly as it warned. No security policy was loosened. The viewer now
feature-detects fullscreen and, if it is unsupported or the request is refused, falls back to an
in-page enlargement instead of an error message; it closes on Escape or the same button and returns
focus to the button that opened it. That path is covered by a browser test that makes
`requestFullscreen` reject.

**BBTF-47 · reproduced · repaired.** On the base at 1024 × 768, the rotated route viewer was
1121 px tall inside a 525 px pane and the slice slider sat at y 1146, below the window. The plane is
now sized from the pane it actually has (a size container query) rather than from the window, the
slice row sits immediately under the image, and the aspect ratio and coordinate transforms are
unchanged. At 1427 × 1226 the rotated plane is 620 × 620 with the image fully in view and the slider
at y 1006. At 1024 × 768 it is 311 × 311: with the evidence pane at its top the image occupies
y 337–648 and the slider ends at y 766, so the plane and its controls are co-visible inside a
768 px window, and the pane remains a real scroll owner for the chrome below them. All four patient
direction labels stay attached to the image in both cases, and no horizontal document overflow
appears at any tested width.

The same sizing applies to the local lesson, which previously opened with a 720 px image in a
1015 px pane whose content was 1114 px tall — the "must scroll before the CT is usable" item logged
by task 01. It is now 620 px with the image, slider, view tools and response actions co-visible.
The trade-off is honest: the plane is smaller than before at 1024 × 768 (316 px against 403 px for
the local lesson, 311 px against 440 px for the rotated route), which is why the magnifier was
promoted and its range raised. Nothing was shrunk to a thumbnail, and patient orientation was not
removed.

**BBTF-20 · partly reproduced · improved locally, the rest is a platform item.** The seven header
actions the report counted are still seven, and they belong to the shared `SectionHeader`, which the
coordination file reserves for the platform owner. What is local was improved: the step's own action
is the only filled control in the workspace and measures 17 565 px² against 5 452 px² for the
largest header action, and the workspace's previously loose buttons are now two labelled groups —
"CT view tools" beside the image and "Exercise tools" below it — so they no longer read as candidate
next steps. Help, the course outline, skip and every header control remain reachable by keyboard
with visible focus. The header's action count is logged in the backlog for the platform owner.

## Before and after geometry

Matched conditions: Chromium, viewport as stated, this worktree's dev server, a fresh profile and an
empty `localStorage` for each case. "Baseline" is `origin/main` at `c717c9ff`; the crowded-label row
was measured on the same base by temporarily restoring the component files.

| Measurement (1427 × 1226 unless stated)               | Baseline `c717c9ff`        | After                        |
| ----------------------------------------------------- | -------------------------- | ---------------------------- |
| Minus button x, slice 413 → 412                       | 483 → 827                  | 444 → 444                    |
| Minus button y, slice 413 → 412                       | 1042 → 990                 | 896 → 896                    |
| Slider width, slice 413 → 412                         | 802 → 458 px               | 880 → 880 px                 |
| Control at the previous minus centre after 412        | Full CT field              | More caudal CT slice         |
| Slice after a repeated click at that point            | 412 (zoom toggled instead) | 411                          |
| Mark's screen shift on Check                          | 0, +47 px                  | 0, 0 px                      |
| Image-workspace scrollTop across Check                | 47 → 0                     | 50 → 50                      |
| Stored native pixel across Check                      | unchanged                  | unchanged                    |
| Wheel over the CT: slice                              | 416 → 415                  | 416 (unchanged)              |
| Wheel over the CT: pane scrollTop                     | 0 (trapped)                | 50 (scrolls)                 |
| Overlapping label pairs, first division               | 1 (`A · RMSB`/`B · LMSB`)  | 0                            |
| Learner-mark labels, first division                   | 1 generic "Your mark"      | "Your mark A", "Your mark B" |
| Leader lines / rings, first division                  | 0 / 4                      | 4 / 2                        |
| Hide-overlays control                                 | absent                     | present                      |
| Rotated route plane, 1024 × 768                       | 440 px, slider off-screen  | 311 px, slider in view       |
| Rotated route viewer height, 1024 × 768               | 1121 px in a 525 px pane   | 1006 px in a 525 px pane     |
| Rotated route plane, 1427 × 1226                      | not captured (see below)   | 620 px, slider at y 1006     |
| CT frame mean luminance mid-transition (450 ms delay) | 13.2 of 255, labelled 415  | 131.0, labelled 416          |
| Demonstration Play button, y                          | 1135 (instructions column) | 964 (image column)           |
| Demonstration Play offset below the teaching prose    | 784 px                     | not in that pane any more    |
| Local plane width — 1427×1226 / 1440×900 / 1024×768   | 720 / 535 / 403 px         | 620 / 475 / 316 px           |
| Local plane width — 390×844 / 320×740                 | 364 / 294 px               | 364 / 294 px                 |
| Horizontal document overflow, all five widths         | none                       | none                         |

The baseline rotated measurement at 1427 × 1226 failed to capture: the first navigation to `/assess`
aborted while the dev server compiled that route. It is recorded as not captured rather than
inferred from the 1024 × 768 baseline.

## Decoded-image checks

Every check below reads the live DOM and the actual `<image>` elements; none of it is a synthetic
event or an injected pixel.

- **Slice change under a 450 ms delay on every native plane**, decoded from screenshots of the CT
  frame: the baseline drops to mean luminance 13.2 while labelled slice 415; this branch stays at
  131–136 and stays labelled slice 416 until the swap (table above).
- **The same transition read from the DOM** (12 samples at 80 ms, plus a settled sample): 0 frames
  without an image element, 0 full-cover loading panels, 0 samples where the displayed `href`, the
  `data-slice` attribute and the caption disagreed. Before the swap the samples read
  `slice=416 req=415 ready=false imgs=[416.png]`; after it, `slice=415 req=415 ready=true
imgs=[415.png]`.
- **Playback on an unthrottled local server**: 70 samples at 100 ms over the Lesson 1 interval;
  planes 416, 415, 414, 413, 412 in order, matching the authored caption slices exactly; 0 samples
  pairing a slice number with another plane's pixels.
- **Failure and retry**: routing the native PNGs to 404 keeps `data-ct-ready="false"`, shows
  "This CT slice could not load." with a Retry control, and leaves Check disabled. Retry restores a
  ready plane. The nodule-patch failure path behaves the same and names the patch, not the slice.
- **Overlay geometry**: label bounding boxes read from the rendered SVG, listed above.

## Transform invariants

- `orientedPixel`/`nativePixel` round trips are unchanged; the existing all-eight-displays test and
  the pointer round-trip browser test both still pass, including under magnification and expansion.
- Magnifying from 1.0× to 2.5× multiplies the SVG group's scale by exactly 2.5 and leaves the stored
  native pixel byte-identical; a mark placed while magnified resolves inside 0–511.
- Overlay label placement never moves an anchor: `placeOverlayLabels` returns each input point
  unchanged, and a test asserts this for every authored checkpoint in all eight displays, with the
  text kept inside the image frame.
- Rotating the display rotates the projected anchors and nothing else (asserted in the same test).

## Source files unchanged

SHA-256 prefixes at this branch, each verified byte-identical to `origin/main`:

| File                                            | SHA-256 (first 16) |
| ----------------------------------------------- | ------------------ |
| `geometry/branch-decisions.json`                | `1a78138c5e4e991a` |
| `geometry/paired-routes.json`                   | `ddd2a61893a0da64` |
| `geometry/native-ct.ts`                         | `b4120aa97585e084` |
| `geometry/orientation.ts`                       | `ea7da120887afc7f` |
| `geometry/coordinates.ts`                       | `8637d6795aae4353` |
| `content/local-exercises.ts`                    | `f99b8319e570db9e` |
| `content/junction-feedback.ts`                  | `4329d6fde60bb986` |
| `content/practice.ts`                           | `5e9dcd4df831ca2a` |
| `content/lessons.ts`                            | `deb4a2c08c1f4740` |
| `public/branch-tracing/native-v1/manifest.json` | `3cd614847f371541` |

Nothing under `engine/`, `content/` or `geometry/` changed at all: the diff against `origin/main`
touches only `components/**`, the module's `__tests__/**` and `e2e/branch-tracing.spec.ts`.

## Controls and scroll ownership

- The module keeps its internal workspace scrolling, as the coordination file requires. The
  `bbt: native workspace scroll ownership` stabilisation test still passes at 1600, 1440 and 1024.
- Scroll owners after this change: the instructions pane owns the task text and is reset when the
  step changes; the image workspace (local) and the route evidence pane own the CT and are reset
  only when a new exercise, the orientation introduction or a restart opens them; the route map pane
  is untouched. Ordinary controls, Check and revealing a reference reset nothing.
- At desktop sizes both CT panes are size containers, so the plane is measured against the pane. In
  the stacked layouts and at 200 % root text that containment is switched off and the plane is
  width-driven, because those layouts scroll the document instead.
- Every added control is a real button or input with a 36–44 px target, keyboard reachable, with the
  focus ring the module already uses. The reserved "Lumen unresolved here" and "Reset attempt"
  placeholders are `aria-hidden`, removed from the tab order and disabled while they do not apply.

## Not run

- **Native screen readers**: not tested. The automated `jest-axe` pass on the local lesson is green
  (the annotation groups gained `role="img"` so their names are not dropped), but that is not a
  screen-reader session.
- **Real mobile devices and touch**: not tested. The 390 × 844 and 320 × 740 results are emulated
  viewports in desktop Chromium.
- **Native browser zoom**: not tested. The 200 % condition is a CSS root-font probe, labelled as
  such, at 1427 × 1226.
- **Safari and Firefox**: not tested. Container size queries, `visibility` on SVG images and the
  fullscreen fallback were exercised in Chromium only.
- **Real slow networks**: not tested. The loading evidence uses an injected 450 ms delay per plane.
- The demonstration's black frames did not reproduce on an unthrottled local server; they were
  reproduced and measured with an injected 450 ms per-plane delay, which is a simulation of a slow
  network, not one.

## Verification

| Check                                            | Result                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                               | Clean (needs `NODE_OPTIONS=--max-old-space-size=8192` in this worktree).                                                                                                                                                                                                                                                         |
| `npx jest src/features/bronchial-branch-tracing` | 120 passed, 1 failed — the access-contract test documented by task 01. The same test fails at `origin/main` in this worktree (1 failed / 7 passed there). Access policy was not changed.                                                                                                                                         |
| `npx jest` (whole repository)                    | 13 307 passed, 8 failed across 9 suites — the same nine suites and eight tests task 01 recorded at the base SHA. The changes here are confined to BBT files, so the eight non-BBT failures cannot be affected by them.                                                                                                           |
| Playwright `branch-tracing.spec.ts`              | 32 passed, 0 failed, against this worktree's own server on port 3121.                                                                                                                                                                                                                                                            |
| Playwright `systemic-ux-stabilization -g "bbt"`  | 3 passed (1600, 1440, 1024) — workspace scroll ownership intact.                                                                                                                                                                                                                                                                 |
| Playwright `systemic-ux*` (full)                 | 90 passed, 14 failed. None is BBT: 13 are CRRT and EBUS cases owned by other lanes. The fourteenth, `all nine public entries retain navigation and reflow — 1440`, passes on its own (6/6 across widths) and failed only inside the 11-minute full run; recorded as a flake in that run, not a repair.                           |
| `npx eslint` (changed paths)                     | Clean, no warnings.                                                                                                                                                                                                                                                                                                              |
| `npx prettier --check` (changed paths)           | Clean.                                                                                                                                                                                                                                                                                                                           |
| `npm run build` (production)                     | See the build note below.                                                                                                                                                                                                                                                                                                        |
| Viewport matrix                                  | 1427 × 1226 (the reported state), 1440 × 900, 1024 × 768, 390 × 844, 320 × 740, plus 1280 × 720, 768 × 900 and 1280 × 640 from the existing reflow test.                                                                                                                                                                         |
| 200 % root text                                  | CSS root-font probe at 1427 × 1226: the plane renders at 560 px, the layout is stable across two consecutive frames, the response actions are clickable, and there is no horizontal overflow. A regression introduced mid-batch — size containment on a pane that had become `height: auto` — was found by this probe and fixed. |

### Tests added

- `__tests__/ct-workspace.test.tsx` (8 tests) — the response actions keep their DOM identity, focus
  and place across the response-slice transition and into review; the previous plane stays on screen
  with its own slice number until the requested one loads and then swaps once; a failed plane is
  reported honestly and recovers on retry without being marked ready; the wheel scrolls the page
  until slice stepping is turned on and Escape releases it; overlays hide and restore without
  touching the recorded mark; magnification scales the display only and a mark placed while
  magnified still round-trips; Focus CT view restores the authored crop and draws no contour; the
  demonstration transport sits inside the viewer, nothing autoplays, and every authored frame is an
  adjacent plane.
- `__tests__/ct-overlay-labels.test.ts` (4 tests) — the previous fixed-offset rule collides where
  the placement pass does not; placement moves only text and preserves anchors, identities and
  order; labels stay inside the image for every authored checkpoint in all eight displays; empty and
  single-label inputs behave.
- `e2e/branch-tracing.spec.ts` (9 new tests) — stable control rectangles and a real repeated click at
  1427 × 1226 and 1024 × 768; crop, scroll and mark stability across Check; wheel semantics and
  Escape; rotated route fit, direction labels and slider reachability at both sizes; the in-page
  expansion fallback with Escape and focus return; non-overlapping labels with named learner marks
  and a working hide/restore on the crowded first division; the demonstration transport's placement
  and adjacency.

Three existing assertions were updated because what they name genuinely moved or was renamed: the
live demonstration caption is now read from the transport beside the CT, the nodule-patch test waits
for the requested plane before reading the patch URL (the viewer no longer swaps pixels before they
have loaded), and "gold rings" became "gold crosshairs" in one feedback string.

## Ordinary findings logged, not fixed here

- The shared `SectionHeader` presents seven actions on this module's lesson surfaces. Local hierarchy
  was improved; reducing the count is a platform-owner decision (BBTF-20, BBTF-17 lane).
- `e2e/playwright.config.ts` runs its web server on port 3001 with `reuseExistingServer`, so a run
  started from a worktree can silently test another checkout's server. This batch worked around it
  with a local config; a repository-level fix belongs to whoever owns the e2e configuration.
- The site root returns 500 in a checkout without Supabase environment values (already logged by
  task 01); unchanged here.

## Next

One bounded PR, then stop. Tasks 03 and 04 follow after this is reviewed and merged, in the
package's order. OD-01 stays open; task 05 prepares its packet. Nothing here records a faculty or
learner review as complete.
