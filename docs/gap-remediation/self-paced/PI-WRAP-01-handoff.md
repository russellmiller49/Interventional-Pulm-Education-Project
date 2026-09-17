# PI-WRAP-01 — Peripheral Imaging: text clipped instead of wrapped at 320 px / 200% text

Repair: September 16, 2026. Prepared by Claude (AI implementation).

**Result: G02-PI-03 is repaired. At 320 × 740 with root text at 32 px the activity no longer clips
any learner-facing text, the course title no longer pushes the page past the viewport, and both
Course outline labels wrap and read in full. PI-FOCUS-01 and PI-OUTLINE-01 behaviour is unchanged,
measured side by side. The change is one inherited CSS declaration, presentation-layer only and
PI-local. No clinical, question, source, progress or storage behaviour was touched.**

## Scope

Single-defect repair of [G02-PI-03](#1-reproduction-on-unmodified-main), the defect that stopped the
third G02 Peripheral Imaging validation attempt. PI-03 was not begun, G02 was not continued, Device
Intelligence was not touched, and no Peripheral Imaging redesign was performed.

- Branch `claude/pi-wrap-01`, created from merged `origin/main` at `bc8ad8c1` (the PR #238 merge, an
  ECMO documentation closure). `bc8ad8c1` contains PI-OUTLINE-01 at `56303a2a`
  ([PR #237](https://github.com/russellmiller49/Interventional-Pulm-Education-Project/pull/237)) and
  PI-FOCUS-01 at `a3609638`
  ([PR #233](https://github.com/russellmiller49/Interventional-Pulm-Education-Project/pull/233)).
  `git fetch origin` confirmed `HEAD` and `origin/main` were the same commit, and the tree was clean
  before any edit.
- The G02 stop report is untracked, in its own worktree at
  `Interventional-Pulm-Education-Worktrees/codex-g02-peripheral-imaging/docs/gap-remediation/self-paced/G02-PI-03-stop-report.md`.
  It was read in place and is not copied here. Read alongside it:
  [PI-FOCUS-01](PI-FOCUS-01-handoff.md), [PI-OUTLINE-01](PI-OUTLINE-01-handoff.md),
  [PI-01](PI-01-handoff.md) and [PI-02](PI-02-handoff.md).
- **Local environment note.** The dev server needs Supabase variables to render the route, and this
  worktree had no `.env.local`. One holding deliberately invalid placeholders (`pi-wrap-01-invalid…`)
  was created for the verification runs and **deleted afterwards**, leaving the checkout as found. It
  is git-ignored, no real project, key or secret was used, and nothing was written to any remote.
  `.env.local` is a read-only mount under `AGENTS.md`; that rule protects an existing file, and none
  existed here, but the creation is recorded rather than left implicit.

## 1. Reproduction on unmodified `main`

Reproduced in Chromium before any edit, at 320 × 740 on
`/en/peripheral-imaging/learn?section=projection` with `html { font-size: 200% }`, matching the G02
procedure. All three symptoms G02 named were confirmed to the pixel:

| Surface                      | Measured on unmodified `bc8ad8c1`                            | G02 reported |
| ---------------------------- | ------------------------------------------------------------ | ------------ |
| Course title, outline closed | `h1` text run ends x = 322.61 in a 320 px viewport           | 322.61       |
| Document width               | `scrollWidth` 323, horizontal scroll 3 px                    | 323 / 3 px   |
| Outline label — projection   | text run ends x = 311.8, panel clips at 290 → **≈22 px cut** | ≈24 px       |
| Outline label — DTS          | text run overflows the same panel                            | ≈4 px        |
| Teaching column              | container 190 px, implicit grid track **257.5 px**           | 190 / 257.5  |

### What the reproduction here added

Walking every text node inside the activity, rather than the surfaces G02 happened to inspect, found
the defect is **wider than the stop report recorded**. With the outline open there were **29 clipped
text runs and 19 runs past the viewport**, and 27 of the 29 were in the **Sources panel**, not in the
title, the outline or the teaching column:

- `ol.lesson-shell_sourcesList` is a grid whose implicit track resolved to **271.6 px inside a
  198.4 px container**, and its scroll parent `div.lesson-shell_sourcesBody` has `overflow: auto`, so
  citation titles, author lists, journal lines and every "what this source does not establish" bullet
  were cut off.

This matters for the repair choice. The smallest candidate G02 proposed —
`.header h1, .explanation, .outline a { overflow-wrap: anywhere }` — addresses the three surfaces it
measured, but the Sources panel is inside `.references`, not `.explanation`, so that candidate would
have left 27 of the 29 clipped runs in place.

### Root cause

One mechanism explains all of it. A long clinical term is a single unbreakable word —
`superimposition,` alone measures 226 px at 32 px root text, inside a 217 px panel. With no break
opportunity that word sets the box's **min-content** width, so an `auto` grid track resolves wider
than the container it sits in, and the text is then clipped by whichever ancestor scrolls, or pushes
the document past the viewport.

## 2. The repair

One declaration, on the stage flow's root, in
`src/features/peripheral-imaging/components/stage/imaging-flow.module.css`:

```css
.course {
  overflow-wrap: anywhere;
}
```

Three things about that choice:

- **`anywhere`, not `break-word`.** Only `anywhere` lets the break opportunity count towards
  min-content. `break-word` would wrap the visible line while leaving the teaching and source tracks
  resolving wider than their containers, so the clipping would remain.
- **At the root, not per surface.** `overflow-wrap` inherits, so the single declaration reaches every
  surface the activity renders — including the shared source list and lesson-shell chrome the
  activity hosts — **without editing shared CSS**. `imaging-flow.module.css` is imported only by the
  Peripheral Imaging stage, so the shared components behave exactly as before everywhere else.
- **It follows the feature's own convention.** Peripheral Imaging's other root,
  `imaging.module.css`, already carries `overflow-wrap: anywhere` on its `.course`; the stage rebuild
  simply never carried it over. This restores consistency rather than introducing a new idea.

Nothing is hidden: no `overflow: hidden`, `text-overflow: ellipsis` or `white-space: nowrap` was
added, and a test holds that line. No shared CSS, focus algorithm, outline placement, engine, content
or storage code was changed.

## 3. Verification

Two runs of the same Chromium harness over 8 conditions × 5 routes. The only difference between the
runs is one injected declaration, `[data-imaging-flow] { overflow-wrap: normal }`, which neutralises
exactly what this repair adds — so "before" and "after" differ in nothing else. Each row walks every
text node, comparing its `Range` rectangles against the client box of its nearest clipping ancestor
and against the viewport; text inside a collapsed `<details>` is excluded, and under `html { zoom }`
the CSS-pixel side of each comparison is scaled, because `getBoundingClientRect()` is zoom-scaled
while `clientWidth` is not.

### The defect condition

`/en/peripheral-imaging/learn?section=projection`, 320 × 740, 200% text:

| Measurement                          | Before                     | After                    |
| ------------------------------------ | -------------------------- | ------------------------ |
| Clipped text runs, outline open      | 29                         | **0**                    |
| Text runs past the viewport          | 19                         | **0**                    |
| Document `scrollWidth` / h-scroll    | 323 / 3 px                 | **320 / 0 px**           |
| Teaching container vs its grid track | 190 vs 257.5               | **190 vs 190**           |
| Source list container vs its track   | 198.4 vs 271.6             | **198.4 vs 198.4**       |
| Projection label text run            | ends 311.8, clipped at 290 | ends **231**, inside 287 |

The projection label now reads in full, wrapping as `Projection, superimpo / sition, and depth`.

### The full matrix — stage routes

`learn?section=projection` and `learn?section=dts-acquisition`, before → after clipped runs
(closed / open), runs past viewport, page overflow:

| Condition            | clip closed   | clip open     | past      | page overflow |
| -------------------- | ------------- | ------------- | --------- | ------------- |
| 1440 × 1000 normal   | 0 → 0         | 0 → 0         | 0 → 0     | 0 → 0         |
| 1440 × 1000 / 200%   | 0 → 0         | 0 → 0         | 0 → 0     | 0 → 0         |
| 1440 × 1000 / zoom 2 | 2 → 2 · 4 → 4 | 2 → 2 · 4 → 4 | 0 → 0     | 9 → 9         |
| 900 × 1000 / 200%    | 0 → 0         | 0 → 0         | 0 → 0     | 0 → 0         |
| 390 × 844 normal     | 0 → 0         | 0 → 0         | 0 → 0     | 0 → 0         |
| 390 × 844 / 200%     | 0 → 0         | 0 → 0         | 0 → 0     | 0 → 0         |
| 320 × 740 normal     | 0 → 0         | 0 → 0         | 0 → 0     | 0 → 0         |
| 320 × 740 / 200%     | 0 → 0         | **2 → 0**     | **3 → 0** | **3 → 0**     |

Nothing regressed in any condition. The CSS-zoom row is unchanged and is not stage text; see
[section 4](#4-found-and-not-repaired).

### PI-FOCUS-01 and PI-OUTLINE-01 regression

- **PI-OUTLINE-01.** All 16 stage rows: panel opens with all **19** section links present, the panel
  inside the viewport's inline axis, **0** links outside it, and Escape closes it. Identical before
  and after.
- **PI-FOCUS-01.** Tab from the current task heading to the C-arm obliquity slider, then ArrowRight.
  In all 8 conditions the slider is reached in 12 stops, the value moves, the control is fully inside
  the viewport and **0 of 5** inset hit tests find anything covering it. The focused rectangles are
  identical before and after, to the pixel.

  A first pass read this as failing in the three enlarged/zoomed conditions. That was the harness, not
  the product: the site's smooth root scrolling was still in flight — the same trap the G02 report
  records. Waiting for `scrollY` to hold steady for six frames before measuring makes all eight
  conditions pass, in both the before and after runs.

- A similar settling artifact produced two spurious 3D scene-label readings at 390 × 844; with the
  scene allowed to settle, those labels sit inside their viewport in three of three runs in **both**
  modes.

### Automated checks

| Command                                                                                                                     | Result                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `npx jest src/features/peripheral-imaging src/features/learning-module 'src/app/\[locale\]/peripheral-imaging' --runInBand` | **50 suites, 412 tests passed**, exit 0 (G02's baseline was 49 / 409; this adds one suite of three)           |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check`                                                                 | exit 0                                                                                                        |
| `npm run lint`                                                                                                              | exit 0 — **0 errors, 14 warnings**, the same pre-existing warnings G02 recorded, all in shared/other features |
| `npx prettier --check` on both changed files                                                                                | clean                                                                                                         |
| `git diff --check`                                                                                                          | clean                                                                                                         |
| `npx playwright test e2e/peripheral-imaging.spec.ts`                                                                        | **did not complete — see below**; not counted as a pass                                                       |

#### The Playwright suite did not complete, and is not claimed as passing

The 22-test PI Playwright suite stalls in this environment. All 22 tests start — the `line` reporter
prints a failure the moment a test finishes failing, and none printed — but after the last test
begins the run never terminates, sitting at **0% CPU** with no browser activity, so no summary is
ever produced.

This is **not caused by the repair**. Running the same two tests in isolation
(`-g "reserves its pinned chrome|Course outline opens inside the viewport"` — the PI-OUTLINE-01 and
PI-FOCUS-01 regression tests) stalls identically, and stalls the same way on **unmodified
`bc8ad8c1`** with the branch's change absent, verified by checking that commit out detached and
confirming the declaration was gone. The machine also carries Playwright chromium processes more
than eight hours old from other sessions, which were left alone.

So there is no Playwright verdict either way. What the repair rests on instead is the two-run
Chromium matrix above, which exercises the same two behaviours directly and reports identical
geometry before and after.

`src/features/peripheral-imaging/__tests__/text-reflow.test.ts` follows the pattern PI-FOCUS-01 and
PI-OUTLINE-01 established: jsdom performs no layout, so it holds the stylesheet's declarations —
that the root wraps, that it uses `anywhere` rather than `break-word`, and that no rule conceals the
overflow by clipping or ellipsis — while the geometry itself is checked in the browser and recorded
above.

## 4. Found and not repaired

Each of these is **unchanged by this repair**, measured identically before and after, and outside a
PI-local text-reflow task. None is claimed as passing.

1. **Shared module chrome truncates description text.**
   `learning-module-v2.module.css` sets `overflow: hidden; text-overflow: ellipsis; white-space:
nowrap` on `.moduleNavCopy small` and several siblings. At 320 × 740 / 200% the Peripheral Imaging
   overview, practice and integrated-cases routes show 17 / 4 / 4 clipped runs and **162 / 96 / 149 px**
   of page overflow. These routes do not render the activity stage, so the repair does not reach them
   by design. The rules are shared by every module (Bronchoscopy Foundations uses the same copy), so
   changing them is a shared decision, not a PI-local one.
2. **3D scene annotations are clipped by the scene viewport.**
   `suite-scene.module.css` gives `.objectLabel` `white-space: nowrap` and absolute placement inside
   `.viewport { overflow: hidden }`. At narrow widths and under CSS zoom the "Authored target" and
   "Tool tip" markers run past the scene edge. These are annotations pinned to a projected 3D
   coordinate — they should not wrap; they need their position clamped. That belongs to the 3D suite.
3. **SVG diagram text does not reflow.**
   Under CSS zoom 2, four `<text>` runs in `svg.imaging-stage_reconstructionDiagram` measure outside
   the SVG's client box. SVG text is not affected by `overflow-wrap`.
4. **9 px of page overflow at CSS zoom 2**, on every route including those that never render the
   activity — shared chrome, matching the shared-footer overflow G02 classified as unrelated debt.
5. **`--site-header-height` still understates the enlarged header**, as G02 recorded. The PI hooks
   measure actual pinned chrome, so the exercised geometry is unaffected. Untouched here.

## 5. Human review holds

Technical checks do not replace PI-02 human review. Everything the G02 stop report lists as open
remains open: learner observation sessions, technologist review, faculty and clinical-language
review, and source/media review. This repair changes no wording, no clinical content and no
assessment behaviour — only whether existing text wraps or is cut off — but it is not an approval of
anything, and it does not complete the G02 browser contract, which was not resumed.
