# R4 — the owner review round, and what shipped

The R4 rebuild landed as I0–I7 on `claude/ecmo-9-3`. The owner then walked the first foundation
section, `why-extracorporeal-support`, and reported five things. This is what each one became.

Authority for all five is in [`r4-owner-decisions.md`](./r4-owner-decisions.md) as R4-OD-5 to
R4-OD-9. The module-wide vocabulary work is in [`r4-language-record.md`](./r4-language-record.md).

## 1. The verdict now names the outcome

`AnswerVerdict` and `ChoiceReasoningFeedback` open with "Correct.", "Partly correct.",
"Not correct." or "Not correct, and unsafe.", followed by the framing that teaches. Both expose
`data-verdict-outcome`, and both the attribute and the label are gated on reveal, so an unrevealed
verdict leaks nothing.

The interesting part is what did **not** change. A contract test in the mechanical-ventilation
module existed specifically to stop this, and it was not softened — the rule underneath it was
split, so examination vocabulary stays banned on every surface and correctness vocabulary stays
banned in every authored item. See R4-OD-5.

## 2. The Act step has something to do

Two new pieces, both for the same step:

- **`content/deliveryAttribution.ts`** — four changes a clinician might propose, each attributed to
  the component of oxygen delivery it acts on, answered as a set and committed once. Two of the four
  reach oxygen content by different routes (transfusing raises the carrier; raising the sweep-gas
  oxygen fraction raises how loaded it is), so a learner who has understood the section attributes
  both to content while one who has memorised "oxygen goes with saturation" splits them. The
  registry validates at import: an unknown component, a duplicate id, an offered component no
  candidate acts on, a cited source with no claim named, or a number in a candidate label all fail
  the build.
- **`components/teaching/OxygenDeliveryExplorer.tsx`** — hemoglobin, arterial saturation and cardiac
  output as controls, oxygen content and oxygen delivery computed live against the patient's own
  opening values, and three one-tap comparisons. The arithmetic is imported from the same module the
  engine's oxygen balance imports, so the surface cannot drift from the model it teaches.

## 3. Six steps no longer render one panel

`WhyExtracorporealSupportPanel` blocks declare the steps they are the focus of. Elsewhere they fold
to their heading rather than disappearing. Outside a stage the teaching scope is null and every
block renders, which is why the render harness still produces 16 panels and 83 states.

## 4. Back

Both stage hosts track the furthest step entered, separately from the furthest performed, and offer
"Back to {phase}" on the Now card. The step rows stay review-in-place. That split is deliberate and
is explained in R4-OD-8: entering a step loads the state its copy is written against, so navigating
from a row would discard an evolved case on any section whose later steps carry a variant.

## 5. The language

The owner's verbatim rewrites went in as given, including the transfer stem and its three choices.
A six-agent audit then read every learner-facing string in the feature. 182 findings, of which 167
were applied, 11 overruled by a completeness pass on claim grounds, 2 left as owner decisions, and
2 already superseded by work in flight. Ten test pins moved with the copy they pin; none was
softened. The table and the overrules are in `r4-language-record.md`.

## Physiology corrections found in the same pass

A physiology audit of the new arithmetic surfaces produced ten findings. Eight were applied:

| Finding                                                                              | What it became                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `1.34` written as a bare literal in three places                                     | One `content/oxygenDeliveryArithmetic.ts` the engine and both panels import                                                                                                                    |
| The constant printed to the learner with its own new qualifier                       | Reuses the wording the sibling hemodynamics module already registered for the identical constant                                                                                               |
| Slider ranges wider than any value the module authors                                | Hemoglobin 4–16, cardiac output 1–8, and saturation 65–100, which is exactly the engine's own clamp domain                                                                                     |
| A preset landing on a saturation of 90                                               | 90 is an educational alarm boundary elsewhere in this repo, so the button now lowers the saturation by ten from wherever the patient opened                                                    |
| Halving presets clamped, so on a low-output case "halve" would have raised the value | Presets compute their target and are offered disabled, with the reason, when it falls outside the control's range                                                                              |
| "Transfuse red cells for a hemoglobin of 4.9 g/dL" in the Act step                   | The same figure keys this section's own transfer item, so the Act step was handing over the answer. Both treatment candidates lost their numbers, which also removes two unsourced indications |
| Two cited sources that support nothing about oxygen delivery                         | Replaced by the two that do, with a claim named per id, and the same correction applied to the section's own source list                                                                       |
| The dissolved-oxygen term promised in prose and computed nowhere                     | Named as omitted in the model boundary, which is what the engine does too                                                                                                                      |

Two were recorded rather than fixed, in R4-OD-1's physiology section: the engine performs the
native-plus-circuit flow addition its own value guides forbid, and the explorer's flow term is
therefore named and bounded rather than reconciled.

## Measured in the browser at 1440x900

Walked the whole of `why-extracorporeal-support` on the running dev server, and re-probed the drill
the R4 baseline measured. Numbers are visible controls, visible words, words under 13 px outside the
console facsimile, visible headings, and internal scrollers.

| Surface                                            | Controls | Words | Under 13 px | Headings | Scrollers                           |
| -------------------------------------------------- | -------- | ----- | ----------- | -------- | ----------------------------------- |
| Foundation `why-extracorporeal-support`, before R4 | 93       | 2595  | 536         | 18       | 2 panes holding 3705 px and 8713 px |
| Foundation `why-extracorporeal-support`, now       | 70       | 584   | 195         | 8        | 2                                   |
| Drill `preload-drainage-collapse`, before R4       | 91       | 1075  | 777         | 13       | 2 panes holding 3111 px and 1120 px |
| Drill `preload-drainage-collapse`, now             | 71       | 1512  | 334         | 14       | 3                                   |

The drill's word count rose because the teaching pane now shows the step's own material instead of
one static panel, and the reading is spread across seven steps rather than stacked on one screen.
What fell is the density of it: 22 per cent of visible words are now under 13 px, against 72 per
cent before.

Also confirmed by driving it: the verdict states the outcome and keys it to the plausibility (an
unsafe choice reads "Not correct, and unsafe."); the Act step's four rows each resolve to Correct or
Not correct against the registry, with the component definitions appearing only afterwards; the
explorer's presets do what they say (halving the hemoglobin took content from 13.3 to 6.6 mL/dL and
delivery from 597 to 298 mL/min, while taking ten off the saturation moved delivery to 535, about a
tenth); the reset returns to the patient's own values; Back appears at every step but the first and
walks the whole way home without losing a commitment; and exactly one step row is the current one at
every step of a full walk forward and a full walk back.

Two measurements worth recording that this round did not change:

- **17 px of document scroll at 1440x900.** The stage itself does not scroll — its shell is exactly
  `calc(100dvh - 4rem)` and its scroll height equals its client height — but the module header
  renders 81 px tall against the 64 px the shared rule reserves. That rule is pinned verbatim by
  `criticalCareShellConvergence.test.tsx`, so it is left alone.
- **Two `aria-current="step"` tokens on the page**, one from the step list and one from the shared
  `learning-module/curriculum/PathwayNav`, which marks the current _section_ inside the Sections
  drawer with the same token. The step list's own invariant holds and is now pinned. Changing the
  shared nav's token would reach four other labs and its stylesheet selectors, so it is recorded
  rather than changed.

## Verification

| Gate                                                                                      | Result                                                                                    |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Protected scope — `cardiohelp-ecmo`, `critical-care`, `learning-module`, the locale route | 101 suites, 2391 tests, all passing                                                       |
| `npx tsc --noEmit`                                                                        | clean                                                                                     |
| `npx eslint` over the three features                                                      | 0 errors; 2 pre-existing `set-state-in-effect` warnings in files this round did not touch |
| `npm run render:ecmo-teaching`                                                            | 16 panels, 83 rendered states, render-asserted                                            |

## Still open after this round

- The engine's VA systemic-flow addition against `ecmoValueGuides`' two instructions not to make it.
- The fourteen Practice case titles in the shared critical-care activity registry, which are
  diagnosis names.
- Subject-matter review of everything carrying `reviewStatus: 'draft'`, before the next human round.
- The micro-cases, the three unpaired VA cases, and the held PR #94 panels, all deliberately out of
  the R4 rebuild.

## 6. The circuit map, pointed at (R4-OD-10)

The owner's sixth finding, from the circuit-walk section: the animated pressure-zone map was
"basically hidden" — behind the bedside tab, below a console taller than the pane, scrolling
sideways at a poster width, with nothing marked on it — while the teaching pane drew a small map of
its own that read as hand-drawn beside it. Decision: keep the real map in the left pane and make
the module point at it; retire the small one. What shipped:

- **`components/circuit-map/`** — `circuitMapGeometry.ts` holds the drawing's path strings, which
  the drawing and the highlight now both read (a second copy of a path is a second opinion about
  where the limb is); `circuitMapEmphasis.tsx` turns the same presentation value the minimap
  consumed into halo shapes and a caption.
- **The map, on the stage.** The foundation adapter authors `circuitView: 'diagnostic'` on every
  step of a section that walks the circuit; the drill adapter authors it on the Explain step of a
  drill with a localization row; the console tour's circuit step authors it in `learnLessons.ts`,
  because the tour's subject is where the sensors sit and the map draws every one with a leader to
  its place. On entry the map scrolls its own pane — not the document, whose sticky header slid
  over the caption in the first version — after the console above it has finished scaling; on a
  stacked layout, where the document is the only scroller, it scrolls the document with a
  scroll-margin that keeps it out from under the header. On the stage the map drops its poster
  width and bleeds through the card padding, so the whole drawing fits the pane and a wider pane is
  a larger map — the resize handle is the zoom.

  **A window that followed the marking was built, reviewed, and then removed on the owner's
  verdict.** The first version panned a 4:3 window across the drawing to the marked place, to keep
  the type legible in a narrow pane. The owner's reaction, on the drainage stop: "I can't see the
  whole animation, and when I resize the panel it just makes the part I can see bigger but doesn't
  make anything else more visible, and I don't see any way to drag the view." That is the right
  call — a "you are here" belongs on the whole map, not on a crop of it — so the window, its tween
  and the authored bounds that drove it are gone, along with the unmarked-map exception they had
  forced. What stays is the fit.

- **Words with the marking.** An HTML caption above the map ("You are here: Centrifugal pump." /
  "Implicated on this map: Patient venous drainage.") and the same sentence in the SVG's
  description, plus "Ringed on the map: drainage pressure (pVen)." when and only when the flags are
  drawn. The image is now named by its title and described by its description; it used to be named
  by both, a hundred and twenty words of name.
- **Retired.** `EcmoCircuitMinimap.tsx`, its two suites, and the text-equivalent builder and
  `readingsWithheld` flag that only it read. The walk card keeps the sentence that says where the
  marking is.

### Verified adversarially before landing

Four reviewers and a completeness critic over the uncommitted change. Fixed from the reviewers'
findings:
the fitted map regaining its 1040 px width at ≤760 px (the single-class fit rule lost the cascade
to a media-query override; now compound); a pan frozen mid-crop when the target returned within
480 ms (fixed, then made moot when the window itself went); the step-entry scroll measuring the panel
before the console had scaled (deferred past the console's settle passes, and skipped for a hidden
panel); halos drawn over "MEMBRANE OXYGENATOR", the fibre sub-label and the gas labels (the
membrane ring is inset into the body, outlines get half a limb's band, the pre-membrane mark lost
a redundant disc, sensor rings are the flag plus three); the ringed readings never named in words;
a roving-tabindex tablist with no arrow keys, which the auto-selected map tab had made worse; the
poster's scroll affordances surviving into pane mode; and the offline harness rendering the map
behind its bedside gate. Confirmed by the reviewers and left as they were: every halo lies on the
drawing's own path or a flag plus a margin; the geometry refactor changed no path string; the
withheld map rings nothing; VA cannula and port variants hold; the tween and scroll never run in an
effect body.

Fixed from the critic's own findings, which none of the four had looked at: the console tour had
lost its only map with nothing opening the real one; the step-entry scroll did nothing on stacked
and short viewports, where the map is most hidden; the fitted unmarked map cropped the patient half
with no way to reach it, which on VA is where the mixing region, the right-arm monitor and the limb
check are drawn; and the offline review page rendered the map without its stylesheet, every halo a
black fill. Recorded and accepted: on a compact layout the walk card and the map are on different
tabs, so the marking's words travel with the map and the walk card's own sentence names the places
instead. Two changes reach Practice as well and are deliberate: the image is named by its title and
described by its description, and the circuit-view tablist has the arrow keys its roving tabindex
always implied.

### Measured

At 1440 × 900 on `circuit-flow-path`, step 1: the map tab selected on entry, the panel's heading,
tabs and caption at the top of the simulator pane with the document unscrolled, the drainage limb
haloed with its label at 11.5 px (it was 6 px fitted whole, and off-screen below the console before
that), one map on the page, and a Next-then-Back within a pan settling on the right window. On VA
the return halo follows the arterial cannula. Practice is untouched: poster width, no marking, no
scroll.
