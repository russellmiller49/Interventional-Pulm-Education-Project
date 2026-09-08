# R5 — the 2026-09-06 learner review round

The first walk of the rebuilt Learn pathway by someone who had not built it. Kayleigh A.
Berthiaume Fox, MS, an MD/PhD candidate at U of A COM-T, worked from the start of the pathway to
the end of `pump-and-pressure-zones` — a little over an hour — and sent twelve numbered points.

Her summary is the finding the other twelve are instances of:

> the order of the panels can be readjusted for ease of read and the middle p[anel can] be a bit
> confusing at times, because you're not always prompted to read the details in that panel.

What follows is what each point became. Everything here shipped on `claude/ecmo-learner-feedback`.

## The one that reframes the rest: the panes had no names

At desktop width nothing on screen called any pane anything. "Simulator", "Teaching" and "Steps"
existed as `aria-label`s on the three regions and inside a tab row that only renders below the
compact threshold. That is why every one of her reports is phrased as "far left", "middle panel",
"right hand panel" — and it is why four separate steps were unanswerable as written, because not
one of the sixty foundation `requiredAction` strings named the pane it was talking about either.

Both halves are fixed together. Each pane prints its own name and what it is for; each phase
authors a `lookIn` naming the pane its work is done in and the landmark inside it; the Now card and
the help dialog print it; and `validateEcmoFoundationRuntimes` refuses at import to author a phase
without one, or to use a pane's own name as a landmark inside that pane.

## Point by point

| #   | Reported                                                                                                                                                                                          | What shipped                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | "Could the prompts/directions with the guided questions show up on the left side of the screen instead of the right for a more natural read?"                                                     | Steps, Teaching, Simulator, left to right. See R5-OD-1 below — it amends R4-OD-10.                                                                                                                                                                   |
| 2   | "This answer is a bit confusing"                                                                                                                                                                  | Three things, treated separately below.                                                                                                                                                                                                              |
| 3   | "There weren't prompts for me to adjust or interact with the Cardiohelp-i simulation… none of the buttons actually work at this phase… I was confused on whether I should be interacting with it" | The console says whether it can be operated, driven by the prop that decides it. It never can in a foundation section, and nothing had ever said so.                                                                                                 |
| 4   | "I'm being asked to read the live values… at [this] point I haven't been prompted to read anything in the middle panel"                                                                           | The step names both places it means: the console, and the channel set in the teaching pane.                                                                                                                                                          |
| 5   | "it tells me to read the lesson narrative… it's not labeled 'lesson narrative' it's labeled 'circuit walk'"                                                                                       | The narrative is rendered first at the one step whose instruction asks for it by name; before, it was about the tenth block down a pane that scrolls on its own and is never scrolled for the learner. The step also names the pane and the heading. |
| 6   | "maybe it can be a bulleted list labeled 'what to check for at this position'"                                                                                                                    | A bulleted list with an authored per-stop label. One label does not fit six stops — see below.                                                                                                                                                       |
| 7   | "I was never prompted to continue scrolling down this panel to read 'The paths this circuit runs…'"                                                                                               | The Observe step points at it by name. Nothing moved: the section self-gates internally and moving it above the walk would have inverted the pre-commitment disclosure, hiding the walk on the two steps whose instruction is to step through it.    |
| 8   | "I now see the middle panel going to stop 5 of the circuit walk. seems like this might be out of order"                                                                                           | The walk's positional sentence faces both ways now. The ordinals do not move; see below.                                                                                                                                                             |
| 9   | "step 3 of 6 tells me to increase the flow but i don't see a button for me to do that"                                                                                                            | The actions are the Now card's interaction body on the Act step, not a separate block below it.                                                                                                                                                      |
| 10  | "I'm guessing I should read the middle panel, but not sure"                                                                                                                                       | `lookIn`.                                                                                                                                                                                                                                            |
| 11  | "the panel on the left is not interactive at all. Eventually I figured out that you have to click on the 'actions you can take' buttons below. They don't highlight or appear interactive."       | They were byte-for-byte identical to the radio rows a few lines above them. They now carry the module's own secondary-button weight, a leading chevron and all three interaction states.                                                             |
| 12  | "I'm not sure I can make any changes and observe patient values"                                                                                                                                  | `lookIn`, plus the action list stays open on Observe — four sections tell the learner there to compare a value "after each action" while the buttons those sentences mean were folded shut.                                                          |

## R5-OD-1 — the steps lead, and the simulator keeps the width

**This amends R4-OD-10.** That decision was headed "**Left panel, highlighted**", and the owner's
question it answered was explicitly positional: "I'm not sure if moving to center panel or making
the module highlight it in the left panel is better." So the pane moved, and this records it rather
than reading the earlier decision as though it had only ever been about pane identity.

What R4-OD-10 was protecting is intact and is why the fractions are what they are. Its reasoning was
that the map "was drawn for a thousand pixels of width and the teaching pane has four hundred" and
that there should be "one circuit drawing, in the widest pane, driven by the step". The map is still
in the simulator pane, still opened and marked by the step, and the simulator is still the widest of
the three at every validated width. What changed is which end of the row that pane sits at.

The shared `ResizableTeachingWorkspace` takes the opening fractions and the drag floors as options,
defaulted to the values MV, MCS and hemodynamics already had, because its slots are positional and
its content is not: a module that leads with its instruction column still needs its device pane
widest.

### P-8 re-validated

`r0-protected-main-inventory.md` P-8 pins four width modes. Measured on the running dev server at
`circuit-flow-path`, after the change:

| Viewport | Steps | Teaching | Simulator | Elements overflowing their pane | Document horizontal scroll |
| -------- | ----- | -------- | --------- | ------------------------------- | -------------------------- |
| 1600     | 399   | 445      | 691       | 0                               | 0                          |
| 1440     | 358   | 399      | 619       | 0                               | 0                          |
| 1280     | 316   | 353      | 547       | 0                               | 0                          |
| 1024     | 250   | 278      | 432       | 0                               | 0                          |

Three panes at all four; the compact threshold is unmoved; the pressure-zone map tab is selected on
this section, as `circuit-map-emphasis.test.tsx` requires.

### The compact width, which the swap would otherwise have broken

Below the compact threshold one pane is on screen and the shared workspace opened on the first one.
Before the swap that was the simulator, which hid the Now card; after it, it would have been the
steps, which hides the pins on the circuit map that three items are answered by clicking, and makes
a drill's "Show me where" focus a control inside a `hidden` pane. The workspace now takes a
_followed_ compact-pane preference — not `activePane`, which would take the pane switcher away from
the learner — and both hosts derive it: the foundation host from the step's authored location,
overridden to the simulator on the three map-answered steps; the drill host from whether the step
aims at a device surface or the learner has asked where a control is.

## R5-OD-2 — the short list is labelled, and the label is authored per stop

Kayleigh asked for "a bulleted list labeled 'what to check for at this position'". That label is
right for the two limb stops and wrong for the other four: stop two's list is four facts about the
pump, and telling a learner to go and check that "The speed is chosen" would be nonsense. So the
label is authored beside the list it heads, and it joins every guard the rest of the stop copy
already passes.

The accessible text equivalent — which is visible on the same card, not screen-reader-only —
hardcoded "What to check here:" for all six and was therefore already wrong for four of them. It
reads the authored label now, so the two surfaces cannot disagree.

## R5-OD-3 — the walk's numbering stays, and the card says it carries on

> **Reversed 2026-09-07 by R6-OD-3.** The sentence was not enough: the same learner read the
> unreachable denominator as missing stops on the very next walk. The card counts this section's
> stops now. See [`r6-learner-review-record.md`](./r6-learner-review-record.md).

The six stops run continuously across two sections. `circuitWalk.ts` and `useEcmoCircuitWalk.ts`
both record why: "stop five of six" should tell a learner arriving at the second section that they
are near the end rather than that a second counter has started. Kayleigh's report is the counter-
evidence that the numbering alone does not carry that, and her wording — "I finished all 6 steps of
the circuit walk", "after 6/6 of circuit walk" — shows she had merged the walk's counter with the
Steps pane's six rows.

The numbering does not move. What was missing was any sentence saying the walk is longer than the
section, and the card's only positional sentence looked backwards. It faces both ways now, in the
visible copy and in the live region.

Not fixed, and worth an owner decision: `Circuit walk` is also the pathway short title of
`circuit-flow-path` in the Sections drawer, so at stop 5 the learner is inside "Pump & pressures"
reading a card headed with the previous section's name. And a third counter is on the same screen —
the Sections drawer prints "3 of 17".

## R5-OD-4 — the card keeps the promise the step makes

Five sections instruct "commit a prediction, then read why the other answers do not fit". The card
the foundations render showed only the chosen option's rationale; the drill half of the same pathway
has had that disclosure all along. The foundations render their own rather than change a card four
other modules share.

This is the most likely reading of point 2. Her screenshot is of the transfer card with the keyed
answer selected — `orderChoices` rotates that three-option item by two, so the second option she
picked was the key — which means the card she called confusing is the _positive_ feedback card, and
the comparison it told her to read was not on it.

## R5-OD-5 — the first section's transfer item

Found while scoping point 2, and worth fixing regardless of what she meant.

- The consumption option asserted that ongoing bleeding "primarily increases metabolic demand" and
  that "oxygen supply is preserved" — the second contradicting the stem outright — and was graded
  `reasonable-but-incomplete`, so a learner who chose it was told a false statement about
  haemorrhage physiology was defensible. It names rising extraction now, which is what happens, and
  its rationale says why that is the consequence rather than the impaired term.
- The stem asked which "component of oxygen delivery" is impaired while offering oxygen consumption
  as an option — the category this section's own opening objective exists to separate out. It asks
  for the part of the oxygen balance, the phrase the section already uses twice elsewhere.
- The key was the uniquely longest option, the only one agreeing with the vignette, and the only one
  restating a datum from the stem. It is one clause now; its second sentence moved into its
  rationale. The flow option lost an absolute that eliminated it on sight, and a fourth option was
  added — the item had two live answers in a three-option set.
- The explanation compared against "the earlier situation", a patient four steps back and never
  named, and said a saturation "behaves identically" in two vignettes stating different numbers.

The stem and its three choices were the owner's own verbatim wording, applied as given under
R4-OD-9. **These edits change it and need the owner's eye.**

## R5-OD-6 — one verdict vocabulary in one pathway

`ChoiceReasoningFeedback`'s frames were written for items with a console pattern on screen: "The
cues support this read." ECMO asks a good many of its questions as prose vignettes with no cues in
them, and that sentence is the string in Kayleigh's screenshot. The component takes per-caller
frames now, defaulted so every other module keeps its wording; ECMO passes `AnswerVerdict`'s own
titles, which the drill half of the pathway already shows — which is what this component's doc
comment has always said it wanted, and which was true of the outcome labels and never of these.

## Left for the next round

Reported by the verification pass rather than by Kayleigh, confirmed in the code, and out of scope
here:

- Running a bounded action **resets** `interactionsSinceRestore`, so the "Looked at since this
  circuit was loaded" list shrinks when a learner clicks a second action, which reads as nothing
  having registered.
- `StageInteraction['bounded-actions'].actions` is dead data: the rendered list maps
  `runtime.guidedActions`, so every post-commitment step offers the same full set rather than the
  actions its own instruction is about.
- `.now` is `position: sticky` inside a content-sized grid item, so the Now card has never actually
  stuck.
- The "Circuit walk" name collision and the third counter, above.
- She stopped at `pump-and-pressure-zones` of seventeen sections and said she would come back. The
  drills, both capstones and the whole VA track have not been walked by anyone outside the build.
