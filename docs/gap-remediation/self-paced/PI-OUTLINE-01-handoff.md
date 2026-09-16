# PI-OUTLINE-01 — Peripheral Imaging: Course outline opened outside the viewport

Repair: September 16, 2026. Prepared by Claude (AI implementation).

**Result: G02-PI-02 is repaired. The outline now stays inside the usable viewport in all eight
conditions measured, at desktop width and normal text it is unchanged, and PI-FOCUS-01's sticky /
unpinned chrome behaviour is preserved. The change is presentation-layer only and PI-local. No
clinical, question, source, progress or storage behaviour was touched.**

## Scope

Single-defect repair of [G02-PI-02](#1-g02-reproduction), the defect that stopped the second G02
Peripheral Imaging validation. PI-03 was not begun, G02 was not rerun, Device Intelligence was not
touched, and no Peripheral Imaging redesign was performed.

- Branch `claude/pi-outline-01`, created from merged `origin/main` at
  `695ede0a7c3469f4374414f2136d84e16c31e972` — the PR #234 merge, which already contains
  PI-FOCUS-01 ([PR #233](https://github.com/russellmiller49/Interventional-Pulm-Education-Project/pull/233))
  at `a3609638`. `git fetch origin && git rev-parse HEAD origin/main` returned the same commit for
  both, and the tree was clean before any edit. The branch was rebased onto `99b43dee` (the PR #235
  merge, an ECMO documentation addendum) after the work was finished; nothing it touches overlaps.
- **Checkout note.** The request asked for a fresh worktree; this session's harness pins its working
  directory to `Interventional-Pulm-Education-Worktrees/claude-pi-focus-01` and forbids working
  elsewhere, so the branch was cut in that checkout instead. The substantive condition is met: the
  checkout was clean and level with merged `origin/main`, with none of PI-FOCUS-01's branch state
  left over (its work is in `origin/main`, not in the working tree).
- The G02 Peripheral Imaging rerun report is untracked, in its own worktree at
  `Interventional-Pulm-Education-Worktrees/codex-pi-g02-2/docs/gap-remediation/self-paced/G02-PI-final-technical-report.md`.
  It was read in place and is not copied here. Read alongside it: [PI-FOCUS-01](PI-FOCUS-01-handoff.md),
  [PI-01](PI-01-handoff.md) and [PI-02](PI-02-handoff.md).

## 1. G02 reproduction

G02 reproduced the defect twice, in separate anonymous contexts, on unchanged merged source, and
stopped without modifying the application:

> Open `/en/peripheral-imaging/learn?section=projection` at 900 × 1000, enlarge root text from
> 16 px to 32 px, and click **Course outline** on the first activity. The outline opens mostly
> beyond the viewport's inline-start edge; section headings and link labels are cut off and the
> first link's centre lies outside the viewport.

| Measurement                | G02: normal 1440 desktop | G02: 900 px / 200% text |
| -------------------------- | ------------------------ | ----------------------- |
| Outline trigger left–right | 880.4 – 1019.0           | 32.0 – 307.1            |
| Outline panel left–right   | 539.0 – 1019.0           | **−412.9 – 307.1**      |
| First link left–right      | 560.0 – 998.0            | **−371.9 – 266.1**      |
| First link centre hit test | the link                 | outside the viewport    |
| Document scroll width      | 1440                     | 900                     |

That reproduction was reproduced here before any edit and matches to the pixel: the panel opened at
`−412.89 – 307.11`. G02 also noted correctly that checking document horizontal overflow alone misses
this — content at negative x does not increase `scrollWidth`, and `scrollWidth` stayed 900.

### What the reproduction here added

Probing the full required matrix on unmodified `695ede0a` found the defect is **wider than G02
reported**: it is not only an inline-axis failure at one width, and it is not only at 200% text.
Seven of the eight conditions failed, and the only condition that passed is desktop width at normal
text.

| Condition           | Trigger, css px                      | Outline panel, css px                     | Usable band     | Overflow T / R / B / L          | Inside viewport | Nothing over it | First link | Last link after panel scroll | Focused links visible |
| ------------------- | ------------------------------------ | ----------------------------------------- | --------------- | ------------------------------- | --------------- | --------------- | ---------- | ---------------------------- | --------------------- |
| 1440 × 1000, 100%   | [880.41, 1018.97] × [107.84, 151.84] | [538.97, 1018.97] × [151.84, 801.84]      | [179.7, 927.81] | 27.86 / 0 / 0 / 0               | yes             | yes             | yes        | yes                          | 19/19                 |
| 1440 × 1000, 200%   | [60, 335.11] × [580.42, 659.22]      | **[−624.89, 335.11] × [659.22, 1309.22]** | [297, 1000]     | 0 / 0 / **309.22** / **624.89** | **no**          | **no**          | **no**     | **no**                       | **0/19**              |
| 1440 × 1000, zoom 2 | [32, 303.52] × [581.42, 669.42]      | **[−656.48, 303.52] × [669.42, 1969.42]** | [298, 1000]     | 0 / 0 / **969.42** / **656.48** | **no**          | **no**          | **no**     | **no**                       | **0/19**              |
| 900 × 1000, 200%    | [32, 307.11] × [444.42, 523.22]      | **[−412.89, 307.11] × [523.22, 1173.22]** | [161, 1000]     | 0 / 0 / **173.22** / **412.89** | **no**          | **no**          | **no**     | **no**                       | **0/19**              |
| 390 × 844, 100%     | [16, 154.56] × [257.88, 301.88]      | [16, 374] × [301.88, **850.47**]          | [73, 844]       | 0 / 0 / **6.47** / 0            | **no**          | **no**          | yes        | yes                          | 19/19                 |
| 390 × 844, 200%     | [32, 307.11] × [835.98, 914.78]      | [32, 358] × [914.78, **1463.38**]         | [145, 844]      | 0 / 0 / **619.38** / 0          | **no**          | **no**          | **no**     | **no**                       | **15/19**             |
| 320 × 740, 100%     | [16, 154.56] × [280.73, 324.73]      | [16, 304] × [324.73, **805.73**]          | [73, 740]       | 0 / 0 / **65.73** / 0           | **no**          | **no**          | yes        | **no**                       | 19/19                 |
| 320 × 740, 200%     | [32, 288] × [1014.48, 1138.08]       | [32, 288] × [1138.08, **1619.08**]        | [145, 740]      | 0 / 0 / **879.08** / 0          | **no**          | **no**          | **no**     | **no**                       | **15/19**             |

Rectangles are `getBoundingClientRect` in each condition's own coordinate space, `[left, right] ×
[top, bottom]`. The **usable band** is the viewport minus whatever chrome is actually pinned over it
— the same accounting PI-FOCUS-01 uses. **Nothing over it** is a five-point hit test on the panel
(four inset corners and the centre). The desktop row's 27.86 px "top overflow" is the panel
overlapping the lower part of the pinned course header it belongs to, which it paints above; the hit
test confirms it is not obscured, so that row is a pass.

Computed styles in every failing condition: `position: absolute`, `overflow-y: auto`,
`max-height: 65dvh` (650 / 650 / 650 / 548.6 / 481 px), width `min(80vw, 30rem)` resolving to 960,
960, 720, 358, 326, 288 and 256 px.

Also recorded on unmodified source, and preserved by the repair:

- **Opening causes no page jump** in any condition — `scrollY` delta 0. An earlier probe read 79 px
  and 634 px here; that was Playwright's own `scrollIntoViewIfNeeded` reaching a trigger that is
  legitimately off-screen, not the app. Measured by clicking the trigger from inside the page, the
  delta is 0 before and after.
- **Escape does not close the outline, and neither does a click outside it.** A plain `<details>`
  offers neither. Clicking the trigger closes it and leaves focus on the trigger.
- Every section link is in the tab order in every condition (19/19); before the repair, at the three
  worst conditions, none of the 19 was visible while focused.
- No horizontal document overflow in any condition except the pre-existing shared-footer 1449 px at
  CSS zoom 2, which G02 already recorded as unrelated shared-site debt and which is unchanged.

## 2. Root cause

`src/features/peripheral-imaging/components/stage/imaging-flow.module.css:96–111` (pre-repair):

```css
.outline {
  position: relative;
}
.outline nav {
  position: absolute;
  top: 100%;
  right: 0;
  width: min(80vw, 30rem);
  max-height: 65dvh;
}
```

Two independent geometry faults, one per axis.

**Inline axis.** The panel is right-anchored to its trigger and grows towards the inline start. That
is correct only while the trigger sits at the inline end of a roomy header row. `.header` is a
wrapping flex row; when text is enlarged the header tools wrap onto their own line at the inline
start, so the trigger's inline-end edge moves from 1018.97 px to 307.11 px while the panel's width
stays `min(80vw, 30rem)` = 720 px. The panel therefore starts at 307.11 − 720 = **−412.89**.
**Capping the width cannot repair this**: a right-anchored box only gets narrower, it never comes
back on screen. The `@media (max-width: 560px)` rule at `:307` does pin both inline edges, which is
why 390 px and 320 px do not fail on this axis — but 900 px and 1440 px are above that breakpoint.

**Block axis.** `top: 100%` opens the panel at the trigger's bottom edge and `max-height: 65dvh`
caps it against the viewport, with no term for how far down the viewport the trigger already is. At
320 × 740 with normal text the trigger's bottom is at 324.73 and the panel is 481 px tall, so it
ends 65.73 px past the bottom of the viewport; scrolling inside the panel then brings the last
section to the panel's own bottom edge, which is off-screen, so the last section is unreachable. At
200% text the trigger is pushed below the viewport entirely (bottom edge 914.78 on a 844 px
viewport, 1138.08 on a 740 px one) and the whole panel opens off-screen. This axis also has nothing
to keep the panel clear of the pinned Activity-navigation footer.

**Why a media query cannot express the repair.** Whether the anchored panel fits depends on where
the header tools have wrapped the trigger to, which depends on `html { font-size }`. Media-query
`em` resolves against the browser's default font size, not `html { font-size }`, so a breakpoint
cannot see the enlargement that causes this — the same finding PI-FOCUS-01 recorded.

**PI-local.** Nothing outside `src/features/peripheral-imaging/` contributes. The site header's
declared `--site-header-height` still understates its real height at enlarged text (PI-FOCUS-01's
open note); the repair measures whatever chrome is actually pinned, so it is correct regardless, and
that shared inaccuracy was not changed here either.

## 3. The repair

Two presentations, chosen by a measurement. Desktop width at normal text keeps the anchored
dropdown, byte-for-byte. Where the anchored panel would leave the usable viewport, the panel is laid
out against that viewport instead.

### Declarative, in `components/stage/imaging-flow.module.css`

The anchored panel gains a block-axis cap against the **end of the usable band**, not the viewport:

```css
.outline nav {
  /* unchanged: position absolute, top 100%, right 0, width min(80vw, 30rem) */
  max-block-size: min(65dvh, var(--imaging-outline-anchored-max-block, 65dvh));
  overflow-y: auto;
  overscroll-behavior: contain;
}
```

and the contained presentation is added:

```css
.course[data-outline-contained='true'] .outline nav {
  position: fixed;
  z-index: 60;
  inset-block: var(--imaging-outline-block-start, 0px) auto;
  inset-inline: 1rem;
  inline-size: auto;
  max-inline-size: 30rem;
  margin-inline-start: auto;
  max-block-size: var(--imaging-outline-max-block, 65dvh);
}
```

`inset-inline: 1rem` with `inline-size: auto` bounds the panel to the viewport on both inline edges;
`max-inline-size: 30rem` keeps it from becoming an over-wide line length on a large screen, and
`margin-inline-start: auto` then pushes it to the inline end, so it still reads as a right-aligned
menu. `inset-block-start` places it, `max-block-size` stops it at the end of the usable band, and
`overflow-y: auto` makes it scroll its own contents rather than the page. None of this needs the
trigger's position in the stylesheet.

### Measurement, in the new `components/stage/useImagingOutlinePlacement.ts`

A `ResizeObserver` on the header, the footer and the body — plus the trigger's own activation and
the disclosure's `toggle`, because opening a disclosure whose panel is out of flow resizes nothing
the observer watches — publishes three lengths on the shell and sets `data-outline-contained`:

| Published                              | What it is                                                   |
| -------------------------------------- | ------------------------------------------------------------ |
| `--imaging-outline-block-start`        | where the contained panel opens, down the viewport           |
| `--imaging-outline-max-block`          | from there to the end of the usable band                     |
| `--imaging-outline-anchored-max-block` | from the trigger's bottom edge to the end of the usable band |
| `data-outline-contained`               | whether the anchored panel would leave the usable viewport   |

The predicate is the two failures stated directly:

```
contained = (trigger.right − min(80vw, 30rem) < 1rem)   // would start off the inline edge
         or (usableBottom − trigger.bottom < 8rem)      // no room below worth opening into
```

and the contained panel opens **below the trigger** whenever there is room —
`max(usableTop, trigger.bottom)` — so it never covers the control that closes it. Only when the
trigger has itself been pushed out of the usable band (a phone at 200% text) does the panel take the
whole band.

`min(80vw, 30rem)` is mirrored in the hook, which is the one duplication the design needs; the two
are held together by a test that flips the predicate at exactly that width (section 5) and by a test
that the stylesheet still declares that formula. Verified against the browser in all four conditions
where it matters: predicted 480 / 960 / 960 / 720 px against measured panel widths 480 / 960 / 960 /
720 px.

### Closing behaviour

At 390 × 844 and 320 × 740 with 200% text the outline needs the whole usable band, so the open panel
covers where the trigger would scroll to. Three ways out were added, all in the same hook:

- **Escape** closes it and returns focus to the trigger.
- **A pointer press outside it** closes it, the way a menu does.
- **Focus leaving the panel closes it — including Shift+Tab back to the trigger.** Without this last
  one, Shift+Tab out of the first section would focus a trigger sitting behind the panel, which is
  exactly the class of defect PI-FOCUS-01 repaired. Focus moving between the outline's own section
  links does not close it, and focus leaving the document (the tab strip, the address bar) does not
  either.

This is additive: clicking the trigger still closes the outline and still leaves focus on it, the
outline lists the same sections in the same order, and it still leads to the same places.

### Shared measurement

`topClearance`, `bottomClearance`, `pinnedRect` and `zoomFactor` moved from
`useImagingFocusClearance.ts` into a new `components/stage/pinnedChrome.ts`, unchanged, and both
hooks import them. The two repairs now share one definition of the usable band rather than two that
can drift. `useImagingFocusClearance`'s behaviour is unchanged and its existing suite passes
untouched.

### Files

| File                                             | Change                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| `components/stage/pinnedChrome.ts`               | new — the usable-band measurement, moved out, unchanged                 |
| `components/stage/useImagingOutlinePlacement.ts` | new — the outline measurement and closing behaviour                     |
| `components/stage/imaging-flow.module.css`       | anchored block cap; the contained presentation                          |
| `components/stage/ImagingActivityShell.tsx`      | two refs and one hook call; `<details>`/`<summary>` unchanged otherwise |
| `components/stage/useImagingFocusClearance.ts`   | imports the moved helpers; no behaviour change                          |
| `__tests__/outline-placement.test.tsx`           | new — 18 tests                                                          |
| `e2e/peripheral-imaging.spec.ts`                 | two new browser tests                                                   |

## 4. Before and after

Same probe, same machine, same dev server; only the source differs.

| Condition           | Outline panel, before                 | Outline panel, after         | Presentation, after  |
| ------------------- | ------------------------------------- | ---------------------------- | -------------------- |
| 1440 × 1000, 100%   | [538.97, 1018.97] × [151.84, 801.84]  | **identical**                | anchored, `absolute` |
| 1440 × 1000, 200%   | [−624.89, 335.11] × [659.22, 1309.22] | [448, 1408] × [659.22, 1000] | contained, `fixed`   |
| 1440 × 1000, zoom 2 | [−656.48, 303.52] × [669.42, 1969.42] | [448, 1408] × [669.42, 1000] | contained, `fixed`   |
| 900 × 1000, 200%    | [−412.89, 307.11] × [523.22, 1173.22] | [32, 868] × [523.22, 1000]   | contained, `fixed`   |
| 390 × 844, 100%     | [16, 374] × [301.88, 850.47]          | [16, 374] × [301.88, 844]    | contained, `fixed`   |
| 390 × 844, 200%     | [32, 358] × [914.78, 1463.38]         | [32, 358] × [145, 844]       | contained, `fixed`   |
| 320 × 740, 100%     | [16, 304] × [324.73, 805.73]          | [16, 304] × [324.73, 740]    | contained, `fixed`   |
| 320 × 740, 200%     | [32, 288] × [1138.08, 1619.08]        | [32, 288] × [145, 740]       | contained, `fixed`   |

Overflow on all four sides is **0 in every condition after the repair** (the desktop row's 27.86 px
overlap of its own course header is unchanged and still passes the hit test). The panel's rendered
width is unchanged at 390 px and 320 px (358 / 326 / 288 / 256 px before and after): the contained
rule reproduces the existing narrow presentation on the inline axis and only fixes the block axis
there.

Screenshots at 900 × 1000 / 200% text: before, only trailing fragments of the section names are
visible at the viewport's left edge ("…thin the lesion", "…y and CBCT dose"); after, the panel sits
at 32 – 868 below its trigger with every section name fully readable.

## 5. Interaction with PI-FOCUS-01

PI-FOCUS-01 deliberately drops `position: sticky` from the course header and the Activity-navigation
footer once they would hold more than 40% of the viewport. **That is preserved, and this repair
depends on it**: `data-chrome-pinned` is `true` at 1440 × 1000 / 100% and `false` in all seven other
conditions, exactly as before, and the usable band this repair lays the outline out against is
computed from whatever is _actually_ pinned at that moment.

The repair therefore works in both states without special-casing either:

| Chrome state                     | Usable band, measured                 | Outline                                                    |
| -------------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| pinned (1440 × 1000, 100%)       | [179.7, 927.81] — header + footer     | anchored dropdown, capped against 927.81 rather than 1000  |
| unpinned (every other condition) | [site header bottom, viewport bottom] | contained panel, opened below the trigger inside that band |

Nothing in PI-FOCUS-01 was undone: `scroll-padding` on the page, the `:global(html):has(.course)`
scoping, the `data-chrome-pinned` unpin rule, the measurement constants and the hook's behaviour are
all unchanged; its helpers only moved file. Its Jest suite passes untouched, and a new browser test
holds the mechanism (section 6).

## 6. Verification

Dev server: `next dev --webpack --hostname 127.0.0.1 --port 3145`, Supabase env set to the
preview-invalid placeholders, anonymous Chromium contexts, `**/api/**` stubbed 401, reduced motion.
Port 3145 was used so other worktrees' servers were undisturbed.

### Required browser matrix

Every condition: open the outline; assert the panel is inside the viewport; five-point hit test that
nothing is painted over it; first link reachable at open; last link reachable by scrolling the panel
(and the page does not scroll); Tab through all 19 links with each focused link visible and
unobstructed; Shift+Tab back to a visible trigger; Escape; click outside; click the trigger; reopen;
select a section and confirm it navigates; no horizontal page overflow; `scrollY` unchanged on open.

| Check                                        | 1440/100% | 1440/200% | 1440/zoom2 | 900/200% | 390/100% | 390/200% | 320/100% | 320/200% |
| -------------------------------------------- | --------- | --------- | ---------- | -------- | -------- | -------- | -------- | -------- |
| Panel inside the viewport                    | PASS      | PASS      | PASS       | PASS     | PASS     | PASS     | PASS     | PASS     |
| Nothing painted over the panel (5 points)    | PASS      | PASS      | PASS       | PASS     | PASS     | PASS     | PASS     | PASS     |
| First section reachable at open              | PASS      | PASS      | PASS       | PASS     | PASS     | PASS     | PASS     | PASS     |
| Panel scrolls its own contents               | PASS      | PASS      | PASS       | PASS     | PASS     | PASS     | PASS     | PASS     |
| Last section reachable by that scrolling     | PASS      | PASS      | PASS       | PASS     | PASS     | PASS     | PASS     | PASS     |
| Tab reaches all 19 links                     | 19/19     | 19/19     | 19/19      | 19/19    | 19/19    | 19/19    | 19/19    | 19/19    |
| Every focused link visible and unobstructed  | 19/19     | 19/19     | 19/19      | 19/19    | 19/19    | 19/19    | 19/19    | 19/19    |
| Shift+Tab returns to a visible trigger       | PASS      | PASS      | PASS       | PASS     | PASS     | PASS     | PASS     | PASS     |
| Escape closes it                             | PASS      | PASS      | PASS       | PASS     | PASS     | PASS     | PASS     | PASS     |
| A click outside closes it                    | PASS      | PASS      | PASS       | PASS     | PASS     | PASS     | PASS     | PASS     |
| Clicking the trigger opens and closes it     | PASS      | PASS      | PASS       | PASS     | PASS     | PASS     | PASS     | PASS     |
| Selecting a section navigates                | PASS      | PASS      | PASS       | PASS     | PASS     | PASS     | PASS     | PASS     |
| Opening causes no page jump                  | 0 px      | 0 px      | 0 px       | 0 px     | 0 px     | 0 px     | 0 px     | 0 px     |
| The outline adds no horizontal page overflow | PASS      | PASS      | PASS       | PASS     | PASS     | PASS     | PASS     | PASS     |

The horizontal-overflow row is what it says: the page's own `scrollWidth` is unchanged by opening
the outline. At 320 × 740 with 200% text the page **already** overflows by 3 px (323 px against a
320 px viewport) with the outline shut — the course title block and the stage's own copy, measured
here as `[data-imaging-flow]` descendants ending at x = 322.61. That is the untriaged observation
G02 recorded, it is not the outline, and this repair neither causes nor fixes it. The assertion was
written against the outline's own contribution for that reason.

Before the repair the same probe passed only the 1440/100% column; the other seven columns failed
the first two rows, and 1440/200%, 1440/zoom 2 and 900/200% scored 0/19 on focused-link visibility.

**One consequence, stated plainly.** At 390 × 844 and 320 × 740 with 200% text the panel takes the
whole usable band, so while it is open the trigger is behind it and cannot be clicked again to
close. That is why Escape, click-outside and focus-out were added, and all three are verified above.
At the other six conditions the trigger stays clear of the open panel (measured).

Help, Save for review, Restart section and the Activity-navigation footer were checked in the same
runs: present, in the same DOM and tab order, and operable. The PI-FOCUS-01 slider regression is
covered by its own browser test below and by its unchanged Jest suite.

### Automated regression

New Jest suite `src/features/peripheral-imaging/__tests__/outline-placement.test.tsx`, 18 tests,
driving the hook against the geometry each condition actually measured:

- the anchored dropdown is left alone at desktop width and normal text;
- the anchored panel is capped at the end of the usable band (775.97 px), not at the viewport;
- 900 / 200% is contained, opening at 523.22 px with 476.78 px of room;
- the contained panel opens below the trigger, never over it;
- a trigger pushed out of the band gives the panel the whole band (145 px, 699 px);
- CSS zoom is divided back out (669.42 → 334.71 px, 330.58 → 165.29 px);
- **the predicate turns over at exactly `min(80vw, 30rem)` + `1rem`, not at a breakpoint** — a
  trigger ending at 496 px stays anchored and one at 495 px is contained;
- an anchored panel with less than 8rem below it is contained;
- the activity is left as found on unmount;
- Escape, click-outside and focus-out close it; Tab between its own links and focus leaving the
  document do not;
- and four assertions on the stylesheet's declarations, as support rather than as the whole test.

New browser tests in `e2e/peripheral-imaging.spec.ts`:

- `the Course outline opens inside the viewport at every width and text size` — the matrix above at
  1440 × 1000 / 100%, 1440 × 1000 / 200%, 900 × 1000 / 200%, 390 × 844 / 200% and 320 × 740 / 200%,
  including the anchored-presentation assertion that at desktop the panel's inline-end edge equals
  the trigger's.
- `the activity still reserves its pinned chrome for keyboard focus` — PI-FOCUS-01's mechanism:
  `data-chrome-pinned` and the header's and footer's computed `position` at both widths, and that
  the page's `scroll-padding-top` equals the measured clearance and covers the pinned header.

**Both were run against pre-repair `origin/main`** — the three stage files restored with
`git checkout origin/main -- src/features/peripheral-imaging/components/stage/`, dev server
unchanged:

| Suite                                           | Against pre-repair main                                                                                                                                                                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `outline-placement.test.tsx`                    | 3 of 18 fail — the stylesheet assertions. The hook's own tests cannot fail there: the file does not exist on main, so its arithmetic has nothing to run against.                                                                                                         |
| `the Course outline opens inside the viewport`  | **fails.** It stops first on the presentation attribute; with that assertion removed it stops on `Escape left it open`; with the conditions reordered so a failing one runs first, it stops on **`900x1000, 200% text: outline left the viewport`** — the defect itself. |
| `the activity still reserves its pinned chrome` | passes, as it must: it holds PI-FOCUS-01, which is already merged.                                                                                                                                                                                                       |

The three runs above are the discriminating evidence that the browser test is a regression guard and
not an attribute-presence check. The stage files were restored with `git checkout HEAD -- …` and
everything re-run afterwards.

Executed probes, logs, measurements and screenshots are preserved outside Git:

`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/pi-outline-01-2026-09-16/`

### Commands

```sh
git fetch origin && git rev-parse HEAD origin/main   # both 695ede0a

node node_modules/jest/bin/jest.js src/features/peripheral-imaging src/features/learning-module 'src/app/\[locale\]/peripheral-imaging' --runInBand
# 49 suites, 409 tests, all passing (48 suites / 391 tests on main, plus this task's 18)

PERIPHERAL_IMAGING_BASE_URL=http://127.0.0.1:3145 node node_modules/@playwright/test/cli.js test -c playwright.peripheral-imaging.config.ts --reporter=list
# 22 passed (3.2m), including the two new tests; 20 on main plus this task's 2

NODE_OPTIONS=--max-old-space-size=8192 npm run type-check        # clean
node node_modules/eslint/bin/eslint.js <changed files> --max-warnings=0   # clean
npx prettier --check <changed files>                             # clean
git diff --check                                                 # clean
```

## 7. Preserved

Verified unchanged: question ids, answers, rationales, clinical / image / device teaching, pathway
ordering, section ids, simulator and image behaviour, lab goals, capture validity, progress and
storage, legacy record semantics, integrated cases, and source / review status. The outline lists
the same 19 sections in the same order and leads to the same targets — the browser test asserts the
link count against `peripheralImagingSectionIds` and follows one through to its stage.

The whole change is `position`, `inset`, `max-block-size`, two refs, one hook and its listeners. No
content, engine, registry, route, progress or storage module is touched; Device Intelligence is
untouched; shared module chrome and the site header are untouched.

## 8. Checks not run

- **Native browser zoom, Safari, Firefox, physical touch and a screen reader.** Root-font
  enlargement and injected CSS `zoom` are not substitutes for any of them.
- **The rest of the G02 contract.** G02 was not rerun in this branch, as instructed. The items G02
  listed as NOT RUN — the full route and locale matrix, the no-answer traversals, the adversarial
  skip paths, the storage end-to-end, the missing-image fallback — remain not run.
- **The pre-existing shared-footer overflow at CSS zoom 2** (document 1449 px against a 1440 px
  viewport) and the **320 px / 200% page measuring 323 px wide**. Both are G02's recorded debt. The
  320 px one was measured far enough to establish that it is the course title block and stage copy
  with the outline shut, not the outline, and that opening the outline adds nothing to it; neither
  was repaired, and no user-impact classification is asserted for either.
- **`--site-header-height` understating the real site header at enlarged text.** PI-FOCUS-01's open
  note; shared infrastructure, not repaired here.
- **PI-02's learner sessions and every human review hold** (faculty, technologist, clinical-language,
  source/media, translation and release). Unchanged and still outstanding.
- **A production build and the full repository test suite.** Only the PI and shared learning-module
  suites, the PI route tests and the PI Playwright suite were run.
