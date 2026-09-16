# PI-FOCUS-01 — Peripheral Imaging: keyboard focus hidden behind pinned chrome

Repair: September 16, 2026. Prepared by Claude (AI implementation).

**Result: G02-PI-01 is repaired and the original G02 reproduction now passes unchanged. The repair
is presentation-layer only and PI-local. No clinical, question, source, progress or storage
behavior was touched.**

## Scope

Single-defect repair of [G02-PI-01](#1-original-reproduction), the defect that stopped the G02
Peripheral Imaging technical validation. PI-03 was not begun, no Peripheral Imaging redesign was
performed, and no clinical, image or device teaching was changed. Device Intelligence was not
touched.

- Checkout: `Interventional-Pulm-Education-Worktrees/claude-pi-focus-01`, branch
  `claude/pi-focus-01`, created from merged `origin/main` at `112a20c9` — the PR #232 merge, which
  is the G02-ECMO merge named in the request. `git fetch origin` showed HEAD level with
  `origin/main`, zero commits behind.
- The G02 Peripheral Imaging report is untracked in its own worktree at
  `Interventional-Pulm-Education-Worktrees/codex-g02-peripheral-imaging/docs/gap-remediation/self-paced/G02-peripheral-imaging-report.md`.
  It was never committed, so it is not at the path named in the request on any branch. It was read
  in place and is not copied here. Read alongside it: [PI-01](PI-01-handoff.md),
  [PI-02](PI-02-handoff.md) and the G02 protocol summarized in that report.

## 1. Original reproduction

Reproduced on unmodified `112a20c9` before any edit, using G02's own probe script
(`/tmp/g02-pi/focus-probe.cjs`) with **only the dev-server port changed** (3141 → 3142). The probe
was not weakened at any point; the same script is re-run in section 5.

Route `/en/peripheral-imaging/learn?section=projection`, anonymous Chromium, `**/api/**` stubbed
401, reduced motion, Continue through both reading activities to `projection:guided`, then Tab from
the task heading the stage focuses on entry, 350 ms after every Tab.

| Condition                        | Focused `#peripheral-imaging-control-orbit` | Center hit test            | Before      |
| -------------------------------- | ------------------------------------------- | -------------------------- | ----------- |
| 1440×1000, 100% text, no zoom    | 559.2 – 575.2                               | the input itself           | uncovered   |
| 1440×1000, `html { zoom: 2 }` r1 | 534.0 – 566.0                               | PI course header           | **covered** |
| 1440×1000, `html { zoom: 2 }` r2 | 562.0 – 594.0                               | the input itself           | uncovered   |
| 900×1000, 200% root text         | 496.6 – 512.6                               | PI header "Course outline" | **covered** |

The slider moved 0 → 1 on ArrowRight in every row, covered or not: the control is focusable and
operable while invisible. Run 2 at zoom 2 happened to land clear on this machine where it was
covered in G02's own evidence; the underlying defect is the same and the stronger probe below
removes that run-to-run luck.

A stronger probe was added that hit-tests **five points** on the focused control (both ends, centre,
just inside top and bottom) instead of the centre alone, and adds the two narrow widths the request
requires. It reproduces the defect deterministically:

| Condition             | Before — focused slider is          |
| --------------------- | ----------------------------------- |
| 1440×1000, 100% text  | uncovered (baseline)                |
| 1440×1000, CSS zoom 2 | **covered by the PI course header** |
| 900×1000, 200% text   | **covered by the PI course header** |
| 390×844, 200% text    | **covered by the sticky footer**    |
| 320×740, 200% text    | **covered by the sticky footer**    |

The 390 px and 320 px failures are the same defect against the other piece of pinned chrome. They
were found by this task, not asserted by G02, and they are inside the request's required test
matrix.

## 2. Root cause

Measured geometry on unmodified source, at the moment the lab controls are live:

| Condition             | Site header | PI course header | Activity footer | Covered top | Covered bottom | Clear strip |
| --------------------- | ----------- | ---------------- | --------------- | ----------- | -------------- | ----------- |
| 1440×1000, 100% text  | 0 – 81      | 81 – 179.7       | 927.8 – 1000    | 179.7       | 72.2           | **748.1**   |
| 1440×1000, CSS zoom 2 | 0 – 298     | 162 – 556.2      | 750 – 1000      | 556.2       | 250            | **193.8**   |
| 900×1000, 200% text   | 0 – 161     | 161 – 639.8      | 685.8 – 1000    | 639.8       | 314.2          | **46.0**    |
| 390×844, 200% text    | 0 – 145     | not pinned       | 416.3 – 844     | 145         | 427.7          | **271.3**   |
| 320×740, 200% text    | 0 – 145     | not pinned       | 189.1 – 740     | 145         | 550.9          | **44.1**    |

All values are CSS pixels from `getBoundingClientRect` in each condition's own coordinate space.
At CSS zoom 2 the course header measured 394.2 px tall in one run and 530.2 px in another, because
its nav and tool rows re-wrap; that variation is what made G02's single-point probe intermittent.

Two distinct causes, both in `src/features/peripheral-imaging/components/stage/`:

1. **Nothing reserved the pinned chrome for focus scrolling.** The page is the scroll container for
   the activity. `imaging-flow.module.css:406–429` pins `.header` at
   `top: var(--site-header-height)` above 700 px and pins `.actions` at `bottom: 0`, and
   `:411–412` gives a scroll margin to the **task heading only**. When the browser moves focus with
   Tab it scrolls the control into the scrollport, which it measures with no knowledge of what is
   painted over it, so a control inside the scrollport but behind the chrome is left where it is.
   The lab inputs `components/suite/LabDock.tsx` renders carry `scroll-margin-top:
var(--suite-sticky-offset)` for the suite's _own_ pinned displays
   (`suite-scene.module.css:73–74`) and nothing for the page-level chrome.

2. **The pinned chrome outgrows the viewport.** Header plus footer take about 17% of the viewport at
   desktop width and normal text, but 54% to 79% once text is enlarged, leaving a clear strip of
   44 to 58 px. Reserving that strip is not a repair on its own: a control scrolled into a 44 px
   strip is technically uncovered with nothing around it. At 320 px / 200% text the course header is
   1344 px tall, which is why the existing `max-width: 700px` rule already unpins it there — the
   footer had no equivalent protection.

**PI-local, not shared.** The site header (`src/components/layout/Layout.tsx:13`,
`sticky top-0 z-40`) contributes to the covered band, and `--site-header-height` in
`src/styles/globals.css:516–521` understates its real height at enlarged text (129 px declared
against 145 px measured at 320 px / 200%; 81 px declared against 298 px measured at CSS zoom 2).
That understatement is a genuine shared-infrastructure inaccuracy, **but it is not what causes this
defect and it was not changed.** The repair measures whatever chrome is actually pinned, so it is
correct regardless of that variable, and it needs no edit outside `src/features/peripheral-imaging/`.

## 3. The repair

Three files under `src/features/peripheral-imaging/`, plus one new test.

**Declarative, in `components/stage/imaging-flow.module.css`:**

```css
:global(html):has(.course) {
  scroll-padding-top: var(--imaging-focus-clear-top, calc(var(--site-header-height, 4rem) + 7rem));
  scroll-padding-bottom: var(--imaging-focus-clear-bottom, 0px);
}
.course[data-chrome-pinned='false'] .header,
.course[data-chrome-pinned='false'] .actions {
  position: static;
}
```

`scroll-padding` on the scroll container is the standard declarative answer to a scrollport with
chrome painted over it: it tells the browser's own focus scrolling which part of the scrollport is
actually viewable. The browser still performs the scroll. `:has(.course)` keeps both rules to pages
that render this activity — `.course` is a CSS-module class, so no other module can match. The
`:global(html):has(...)` form follows the existing precedent in
`src/features/bronchoscopy-foundations/components/stage/course-flow.module.css:3–7`.

**Measurement, in the new `components/stage/useImagingFocusClearance.ts`** (~120 lines with
comments): a `ResizeObserver` on the header, the footer and the body publishes the measured
clearances as `--imaging-focus-clear-top` / `--imaging-focus-clear-bottom`, and sets
`data-chrome-pinned` on the shell. It removes both properties and the attribute on unmount.

**Why any script at all.** The request asks for a declarative fix and warns against imperative
focus/scroll JavaScript. This adds **no** focus or scroll JavaScript: nothing calls `focus()`,
`scrollIntoView()` or `scrollTo()`, and no focus, keydown or scroll handler is registered. The
browser does all the scrolling from the stylesheet. A script is nonetheless unavoidable for the
_values_, because CSS cannot compare an element's rendered height to the viewport and the chrome is
content-sized:

- A fixed length cannot work. The covered band runs 179.7 → 639.8 px, which is 11.2 → 35.0 root-rem
  — it varies in `rem` terms too, because enlarged text both scales the chrome _and_ re-wraps it, so
  no `rem`, `em`, `dvh` or `calc()` of `--site-header-height` tracks it.
- A worst-case fixed length is worse than the defect. Reserving 640 px at desktop width would push
  every tabbed-to control two-thirds of the way down a viewport that was never obstructed, which is
  exactly the "unwanted scroll jump" the request rules out.
- A `@media`/`@container` threshold was considered and rejected: media-query `em` resolves against
  the browser's default font size, not `html { font-size }`, so it does not see the enlargement G02
  reproduces at all.

Measurement was also confirmed to be _necessary but not sufficient_ before the unpin rule was added:
with `scroll-padding` alone, 900×1000 / 200% still failed (the control landed 1.8 px inside the
header) and 320×740 / 200% still failed against the footer. That run is recorded in section 5.

**Consequence, stated plainly:** at enlarged text and CSS zoom the course header and the Activity
navigation footer now scroll with the page instead of following the learner. That is deliberate —
it is what returns the viewport to the task — and it matches what the header already did below
700 px. Continue, Back, Skip, Help, the outline and Save for review all remain present, in the same
DOM order, in the same tab order, and reachable by scrolling. At desktop width and normal text
nothing moves: the chrome stays pinned exactly as before (measured share 0.17, `position: sticky`).

## 4. Preserved

Verified unchanged: question ids, answers, rationales, clinical/image/device teaching,
simulator/image behavior, lab goals, capture validity, projection comparison semantics, self-paced
progress, legacy record behavior, former Assess/integrated-case behavior, and source/review status.
The whole change is `position`, `scroll-padding`, three refs and one hook call. The complete tracked
diff is 32 added lines across two files; no content, engine, registry, route, progress or storage
module is touched, and Device Intelligence is untouched.

Storage was checked at runtime rather than only by reading the diff: across all five conditions the
only key written stays `ip-peripheral-imaging-self-paced-v1`, with no new key introduced.

## 5. Evidence

Dev server: `next dev --webpack --hostname 127.0.0.1 --port 3142`, Supabase env set to the
preview-invalid placeholders. Port 3142 was used so the repair could be exercised without disturbing
other worktrees' servers.

### G02's own probe, unmodified except for the port

| Condition                        | Before      | After     |
| -------------------------------- | ----------- | --------- |
| 1440×1000, 100% text, no zoom    | uncovered   | uncovered |
| 1440×1000, `html { zoom: 2 }` r1 | **covered** | uncovered |
| 1440×1000, `html { zoom: 2 }` r2 | uncovered   | uncovered |
| 900×1000, 200% root text         | **covered** | uncovered |

All four rows still move the slider 0 → 1, so nothing was fixed by disabling the control.

### Required verification matrix

100 of 100 checks pass, three Tab repeats per condition. Each condition tabs from the task heading
to the C-arm obliquity slider exactly as G02 did.

| Check                                              | desktop 1440 | zoom 2  | 900 / 200% | 390 / 200% | 320 / 200% |
| -------------------------------------------------- | ------------ | ------- | ---------- | ---------- | ---------- |
| Tab reaches the slider                             | PASS ×3      | PASS ×3 | PASS ×3    | PASS ×3    | PASS ×3    |
| Focused control fully uncovered (5-point hit test) | PASS ×3      | PASS ×3 | PASS ×3    | PASS ×3    | PASS ×3    |
| Focused control inside the viewport                | PASS ×3      | PASS ×3 | PASS ×3    | PASS ×3    | PASS ×3    |
| Room for the focus ring (6 px beyond the box)      | PASS ×3      | PASS ×3 | PASS ×3    | PASS ×3    | PASS ×3    |
| Visible focus indication (`outline 3px solid`)     | PASS         | PASS    | PASS       | PASS       | PASS       |
| Slider still responds to ArrowRight/ArrowLeft      | PASS         | PASS    | PASS       | PASS       | PASS       |
| Slider still responds to Home                      | PASS         | PASS    | PASS       | PASS       | PASS       |
| Mouse click on the slider does not scroll the page | PASS         | PASS    | PASS       | PASS       | PASS       |
| Activating Help does not scroll the page           | PASS         | PASS    | PASS       | PASS       | PASS       |
| Continue advances the activity                     | PASS         | PASS    | PASS       | PASS       | PASS       |
| Back returns to the previous step                  | PASS         | PASS    | PASS       | PASS       | PASS       |
| No new storage key                                 | PASS         | PASS    | PASS       | PASS       | PASS       |

Recorded chrome state, which shows the repair is inert where it should be:

| Condition    | `data-chrome-pinned` | header   | footer   | share | scroll-padding     |
| ------------ | -------------------- | -------- | -------- | ----- | ------------------ |
| desktop 1440 | `true`               | `sticky` | `sticky` | 0.17  | 187.7 px / 80.2 px |
| CSS zoom 2   | `false`              | `static` | `static` | 0.54  | 153 px / 4 px      |
| 900 / 200%   | `false`              | `static` | `static` | 0.79  | 169 px / 8 px      |
| 390 / 200%   | `false`              | `static` | `static` | 1.76  | 153 px / 8 px      |
| 320 / 200%   | `false`              | `static` | `static` | 2.54  | 153 px / 8 px      |

Screenshots, before and after, at 900×1000 / 200% text: before, the course header fills 161–640 px
and the footer 686–1000 px with the focused slider invisible behind the header; after, the slider
sits at 583–605 px with its label, its value and an amber focus ring fully visible.

### Intermediate result worth keeping

With `scroll-padding` alone (no unpin rule), the matrix was: desktop PASS, CSS zoom 2 PASS,
900 / 200% **FAIL** (control landed 1.8 px inside the header), 390 / 200% PASS, 320 / 200% **FAIL**
(footer). This is the evidence that the second half of the repair is required rather than
opportunistic.

### One earlier apparent failure, resolved

An initial harness check reported "mouse click on Help jumps the page" at the enlarged conditions.
Activating the same button inside the page, with no driver-side scrolling, gives `scrollY 1955 →
1955`, delta 0. The scroll was Playwright's own `scrollIntoViewIfNeeded` reaching a Help button that
is legitimately off-screen once the header is unpinned. The check was corrected to measure the app,
and the underlying consequence is stated in section 3.

### Commands

```sh
git fetch origin && git rev-parse HEAD origin/main

node node_modules/jest/bin/jest.js src/features/peripheral-imaging src/features/learning-module 'src/app/\[locale\]/peripheral-imaging' --runInBand
# 48 suites, 391 tests, all passing (includes the 9 new focus-clearance tests)

PERIPHERAL_IMAGING_BASE_URL=http://127.0.0.1:3142 node node_modules/@playwright/test/cli.js test -c playwright.peripheral-imaging.config.ts --reporter=list
# 20 passed, including "laptop, tablet, small phone, keyboard and text zoom keep a single task flow"

NODE_OPTIONS=--max-old-space-size=8192 npm run type-check        # clean
node node_modules/eslint/bin/eslint.js <changed files> --max-warnings=0   # clean
npx prettier --check <changed files>                             # clean
git diff --check                                                 # clean
```

New Jest suite `src/features/peripheral-imaging/__tests__/focus-clearance.test.tsx` (9 tests) holds
the stylesheet declarations, the fallback, the `:has` scoping, the measurement arithmetic including
the focus-ring gap, the pinned/unpinned threshold, that unpinned chrome reserves nothing, and that
unmount leaves the page as it found it. jsdom performs no layout, so the geometry itself is held by
the browser matrix above, not by Jest.

The hook tolerates a missing `ResizeObserver` (it measures once instead of re-measuring), which is
what jsdom provides; that guard is in the hook rather than in per-test stubs so the 44 existing
suites that render the shell needed no edit.

## 6. Not run / limits

- **Native browser zoom, Safari, Firefox, physical touch devices, real screen readers, and
  exhaustive contrast/accessibility testing.** The root-font-size and CSS-zoom probes do not stand
  in for these. This carries G02's limit forward unchanged.
- Full-repository `npm test` and a production build were not run; Jest was scoped to Peripheral
  Imaging, `learning-module` and the PI route, and Playwright to the PI config.
- No deployment or signed-in behavior was checked; the local environment has no Supabase settings,
  and `**/api/**` was stubbed 401 throughout, as in G02.
- The `--site-header-height` understatement described in section 2 is **reported, not repaired**. It
  is shared infrastructure, it does not cause this defect, and the request forbids widening scope
  into shared code without evidence.
- `MAX_PINNED_SHARE = 0.4` is an empirical threshold. Measured separation is wide (0.17 pinned
  against 0.54 and above unpinned), but it is a judgement, not a derived constant.
- Beyond the projection lab's sliders, the repair applies to every focusable control on the activity
  because `scroll-padding` is a property of the scroll container. Only the projection lab was
  exercised at every condition.
- The remaining reflow density at 320 px / 200% text — a course header 1344 px tall — is unchanged
  and out of scope. It no longer hides focus, because it no longer pins, but it is still a long
  scroll. Flagged for the owner, not repaired.
- No human review of anything clinical was performed or implied. PI-02's outstanding usability
  session and PI-01's question ledger are untouched; the question-value observations PI-02 lists as
  not yet done remain not done.

## 7. Next

- **PI-03** remains not started, as instructed, and still depends on PI-02's real sessions.
- The G02 Peripheral Imaging validation still has to be finished by its own task; only its stopping
  defect is cleared here. G02's human review holds and its unrelated debt are untouched.
- Optional follow-ups, owner's call: correcting `--site-header-height` to the header's real enlarged
  height, and the 320 px reflow density above.
