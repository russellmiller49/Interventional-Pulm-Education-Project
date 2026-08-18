# R2 — persistent circuit map and shared localization grammar

What shipped, what it is allowed to say, and which decisions it took. The approved plan is the
package's scope statement; this records the parts that changed on contact with the code, so a
reviewer reading the diff does not have to reconstruct why.

Base: `origin/main` at `4f232450` (R0 = PR #108, R1 = PR #109, both ancestors).

---

## 1. What R2 adds

Four content modules and two teaching components, plus the integration of a deliberately small
slice of lessons.

| File                                           | What it is                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `content/circuitSegments.ts`                   | The canonical circuit: nine segments, seven sensor sites, three pressure-comparison zones |
| `content/localizationCards.ts`                 | The four recurring patterns, authored once, with their sources and boundaries             |
| `content/circuitPresentation.ts`               | What the map is showing, and the engine-gated derivation of it                            |
| `content/circuitSceneAnchors.ts`               | Segment → bedside-scene label ids, as strings only (the R3 seam)                          |
| `components/teaching/EcmoCircuitMinimap.tsx`   | The schematic                                                                             |
| `components/teaching/EcmoLocalizationCard.tsx` | The grammar at two depths, plus the drill gate                                            |

Integrated into two foundation sections (`circuit-flow-path`, `pump-and-pressure-zones`) and three
pilot drills (`startup-sensor-orientation`, `preload-drainage-collapse`, `gas-source-interruption`).

Untouched: the engine, every scenario and prediction item, Practice, Assess, progress, routes, the
entry surfaces R1 built, the shared drill primitives, the bedside 3D scene, the large pressure-zone
schematic, and the three pilot drills the plan excluded.

## 2. Owner decisions, as taken

The plan listed eight. Their disposition in the shipped code:

- **R2-OD-1 (claim wording)** — taken as drafted. Every row cites sources whose registered
  `supports` cover the claim made, and the claim text is narrower than the record in each case.
  One claim was reworded during implementation: "independent patient assessment belongs beside the
  circuit data" became "what you find at the patient belongs beside what the circuit is reporting",
  because `assessment` is on the static-copy ban list and the scan caught it.
- **R2-OD-2 (membrane wording)** — taken. The row names progressive clot or fibrin burden as the
  leading clinical cause of a genuinely widening gradient and requires the look-alikes (higher
  flow, changed viscosity or temperature) to be excluded first. It states no threshold and no
  exchange decision, and its boundary says clot burden is not modelled.
- **R2-OD-3 (D-3 coverage of the pilots)** — taken. Each of the three pilot files gains one figure
  and, where a row applies, one line inside the existing `AfterCommitment`. No identifier,
  prediction, choice, scoring rule, engine call or existing block changed in any of them.
- **R2-OD-4 (ELSO P1/P2/P3)** — excluded, as planned. The naming appears nowhere in the module, and
  the registered ELSO circuits record has not been verified to authorise it. Plain name first,
  manufacturer label second, which is what the circuit-walk panel already did.
- **R2-OD-5 (slice)** — taken as planned. `vv-recirculation`, `arterial-bubble-stop` and
  `va-differential-hypoxemia` carry neither component; see §4.
- **R2-OD-6 (drainage shortlist)** — shipped panel-aligned: cannula position, a kinked or
  compressed limb, coughing/straining/pressure around the vessel, volume state. "Clot" remains
  available to add later with its own claim.
- **R2-OD-7 (act-phase copy)** — taken. The instruction that told a learner to "select pVen, pInt,
  pArt, or ΔP to highlight its measurement zone" described an interaction that existed nowhere; it
  now describes the map that is on the screen.
- **R2-OD-8 (four rows in the scaffold)** — taken. All four, at pattern-and-location depth.

## 3. Decisions taken during implementation

Recorded because they are not in the plan and a reviewer will see them in the diff.

**The segment record does not own its sensor list.** A site names its segment; the segment derives
its sites. One relation, one place. The visible consequence is that the circuit-walk stop list now
names the flow and bubble sensor on the return-limb location, which it had always omitted — an odd
gap in a lesson whose stated subject is every console signal placed where it physically sits.

**The gas path is two segments, not four.** The four stations the gas drill inspects — source,
blender, line, membrane gas side — are the teaching, and they live in the row's cause list where a
learner reads them. Drawing four nodes would not survive the narrowest teaching pane. The id union
is additive, so a later package can subdivide `gas-supply` without renaming anything.

**A zone is where a pattern shows; a row says where the problem lives.** These are not the same
place, and the return row is why: the pressures move downstream of the pump and the obstruction
sits beyond the membrane. Keeping them as separate fields is what lets the map mark
`post-membrane` and `return` while the card names the downstream zone as where to read.

**Scaffolds annotate; only an implicated state marks.** Nothing in a scaffold sets
`data-circuit-implicated`, which keeps the two vocabularies disjoint and lets the leak test assert
an absent attribute rather than weigh degrees of emphasis.

**`ecmo-book-ch16` was dropped from the segment sources.** The circuit-walk section cites it, but
that record supports naming a patient-centred endpoint before changing support — a management
claim, not an anatomical one. `ecmo-book-ch9` and `elso-circuit-2022` cover every claim a segment
record makes.

## 4. Why three pilots and not six

- `vv-recirculation` — the mechanism is patient-and-cannula geometry while every circuit segment
  is working. Marking a segment would teach the wrong localization.
- `arterial-bubble-stop` — the teaching is the safety chain, an event and response sequence. The
  card's action classes do not apply to it, and the registry deliberately does not model clamps.
- `va-differential-hypoxemia` — the mechanism is the patient-side mixing watershed, which this
  circuit map cannot draw and which the drill's own boundary says is not modelled as movable.

The two rows without a pilot consumer are authored, validated, and visible in the foundation
scaffold. Each row carries the drill family that owns it, so a later package adapting the held
panels selects a row rather than renaming anything.

## 5. What the tests pin

New: `circuit-segment-model.test.ts`, `localization-cards.test.ts`, `circuit-minimap.test.tsx`,
`localization-card.test.tsx`. Extended: `foundation-lesson.test.tsx`,
`drill-teaching-panels.test.tsx`, `resumption-copy-contract.test.ts`, and the critical-care
accessibility suite.

The checks worth knowing about:

- **The order pin is unchanged and still passes.** `foundation-lesson.test.tsx` asserts the six
  stop ids against a literal array the registry does not get a vote on. That is the evidence the
  promotion changed nothing a learner sees.
- **The copy scan the move would otherwise have escaped.** These sentences used to live under a
  `components/` root that the critical-care AST scan walks. `localization-cards.test.ts` applies
  the same term list to the registry, reading it out of that test's own source so the two cannot
  drift apart.
- **The precommit scan runs over the serialised DOM**, because an answer hidden in an `aria-label`
  or an SVG `<title>` is still an answer. It scans for the row as composed rather than for single
  cause items: those are two-word clinical nouns, and the recirculation panel has always listed
  several in its own model boundary as things the simulation does _not_ represent.
- **Foundation panels now have axe coverage**, which they did not before. An `<svg role="img">`
  without an accessible name is a violation, and the map's name is a generated id.

## 6. Verified

- `npx jest src/features/cardiohelp-ecmo src/features/critical-care src/features/learning-module 'src/app/\[locale\]/cardiohelp-ecmo' --runInBand` — green.
- `npm run type-check`, `npm run lint`, `npm run test:a11y` — green.
- `npm run render:ecmo-teaching` — the drainage drill renders neutral with no row before a
  commitment, and marked on `drainage` with the row inside the gate after it. The map was reviewed
  in a browser at both pane widths and in every state.

Two defects were found by rendering rather than by unit tests, and both are fixed: React joins an
array of `<title>` children into a warning, and the implicated "texture" was a thin dashed stroke
laid over a thicker stroke of the same colour, which is invisible by construction.

## 8. The compact circuit map (owner-requested correction)

R2 was approved with one correction: the map's own labels were not legible at the teaching pane's
supported floor. This section records what was measured, what changed, and what is still true.

### 8.1 What was wrong, measured

Screen-space measurements taken in a browser against the real stylesheet — effective label size is
the declared SVG `font-size` multiplied by the element's screen CTM scale, not the declared size,
because a viewBox scales type along with everything else.

| Panel container | Drawing        | Scale | Smallest label | Largest | Overlaps | Out of bounds |
| --------------- | -------------- | ----- | -------------- | ------- | -------- | ------------- |
| 280px           | 242px          | 0.756 | **5.67px**     | 6.43px  | 0        | 0             |
| 320px           | 282px          | 0.881 | **6.61px**     | 7.49px  | 0        | 0             |
| 360px           | 322px          | 1.006 | **7.55px**     | 8.55px  | 0        | 0             |
| 480px           | 442px          | 1.381 | **10.36px**    | 11.74px | 0        | 0             |
| 700px           | 480px (capped) | 1.5   | 11.25px        | 12.75px | 0        | 0             |
| 944px           | 480px (capped) | 1.5   | 11.25px        | 12.75px | 0        | 0             |

Nothing overlapped, nothing clipped, nothing scrolled — the defect was purely that the type was too
small to read. The caption and the text equivalent were carrying the lesson, which is not what a
persistent spatial grammar is for.

Worth stating plainly: at every _default_ viewport the teaching pane is 450–670px wide, so this bit
a learner only after dragging the separator toward the 280px floor the workspace explicitly
supports. That is still a supported width, and it is the width at which the map is most needed.

### 8.2 What changed

A second **geometry**, not a second drawing, and not a scale factor. A viewBox scales type with
everything else, so no font size rescues a landscape drawing in a narrow column.

- **Regular (landscape)** — `viewBox 0 0 320 140`, capped at 30rem. The racetrack: patient at the
  left, blood path across the top, return along the bottom.
- **Compact (portrait)** — `viewBox 0 0 168 220`, capped at 18rem. The same loop folded onto a
  vertical spine with every name beside it, the return running back up the left margin, and the
  sweep-gas blender placed against the membrane rather than above it. Roughly twice the type for
  the same pixels.

Both read the same segment registry, the same sensor sites, the same presentation state, the same
implicated/neutral semantics and the same text-equivalent builder. Only the coordinates differ.

### 8.3 Breakpoint

`ECMO_MINIMAP_COMPACT_BELOW_PX = 436`, compared against the **drawing's** width — the panel's
content box, measured with a `ResizeObserver` plus the settle passes the console's fit surface
already uses, because the workspace sizes its panes on a deferred pass.

436 is derived, not chosen: the landscape viewBox is 320 units wide and its smallest label is 8.8
units, so it clears 12 CSS pixels only once the drawing is about 436px across.

Two measurement mistakes are recorded here because only a browser could have caught them. The first
threshold was compared against `clientWidth`, which includes the panel's 32px of padding, so a
400px drawing chose the landscape geometry and rendered 10.89px labels. The second candidate —
observing the `<svg>` itself — is worse than it looks: the chosen layout caps the svg's width, so
the measurement depends on the layout it is deciding, and the result becomes history-dependent.

Server rendering and jsdom both measure nothing and fall back to the landscape geometry. The
component also accepts an explicit `layout` prop, which is how the offline harness and the tests
name the geometry they are looking at.

### 8.4 What it measures now

Same method, after the change:

| Panel container | Layout  | Drawing | Smallest label | Largest | Overlaps | Out of bounds | Card height | H-scroll |
| --------------- | ------- | ------- | -------------- | ------- | -------- | ------------- | ----------- | -------- |
| 280px           | compact | 242×317 | **12.24px**    | 12.96px | 0        | 0             | 958px       | no       |
| 320px           | compact | 282×369 | 14.27px        | 15.11px | 0        | 0             | 951px       | no       |
| 360px           | compact | 288×377 | 14.57px        | 15.43px | 0        | 0             | 899px       | no       |
| 480px           | regular | 442×193 | 12.16px        | 13.12px | 0        | 0             | 586px       | no       |
| 700px           | regular | 480×210 | 13.20px        | 14.25px | 0        | 0             | 515px       | no       |
| 944px           | regular | 480×210 | 13.20px        | 14.25px | 0        | 0             | 475px       | no       |

Measured across all eight presentation states at each width — neutral, three scaffolds, and all four
implicated rows, VV and VA.

Live selection, with the component measuring its own container in a browser rather than being told:

| Drawing width                | Layout chosen | Smallest label |
| ---------------------------- | ------------- | -------------- |
| 242px (the 280px pane floor) | compact       | 12.24px        |
| 276px                        | compact       | 13.96px        |
| 316 / 356 / 396 / 431px      | compact       | 14.57px        |
| 446px                        | regular       | 12.27px        |
| 476px                        | regular       | 13.09px        |
| 593 / 670 / 996px            | regular       | 13.20px        |

Worst case anywhere between a 246px and a 1000px drawing: **12.24px**. The compact map is taller
than the landscape one — 317px against 193px at the narrow end — which the teaching pane absorbs by
scrolling as it always has. No new scroller, no keyboard stop, no animation, nothing outside the
viewBox, and the implicated ticks, diamond and words all still read without colour.

### 8.5 Limitations still true

- Below about a 240px drawing — narrower than the workspace's own 280px pane floor — compact type
  would fall under 12px again. Nothing in the app produces that.
- The in-application pass at 1600×900, 1440×900, 1280×720 and 1024×768 was **not** completed. The
  Learn routes sit behind login, and the repository's local development bypass takes its token as a
  URL query parameter; putting a credential in a URL is not something to do on the owner's behalf.
  What was verified instead: the component's own measurement path exercised in a real browser at
  the drawing widths those four viewports produce (446–996px, all landscape) and at the drag floor
  (242px, compact). The pane widths themselves are pinned by `learn-workspace.test.tsx`.
- The compact geometry is reached by dragging the separator narrow. At every default viewport the
  landscape geometry is the one a learner sees.

## 7. Still open

- The fourteen held drill panels on PR #94 remain held. Nothing here was cherry-picked from that
  branch; its shared primitives were read as a design reference and the parts already on `main`
  were reused from `main`.
- The capstone hypothesis matrices still paraphrase the grammar in their own per-signal cells.
  They are a different granularity and rewriting them was outside this slice.
- The flow and bubble sensor's addition to the circuit-walk stop list is owner-approved, and the
  same term — "flow and bubble sensor", from the one sensor-site record — is what the stop list, the
  map's own label, the text equivalent and the scene-anchor adapter all resolve to.
- `pre-membrane` and `post-membrane` have no distinct bedside-scene anchors, because the scene
  builds none: the pump, both pressure locations and the membrane's gas side all resolve to
  `hls-module`, which is one integrated disposable on this device. R3 may add anchors under the
  scene's own separation contract.
