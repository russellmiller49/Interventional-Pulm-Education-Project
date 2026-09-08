# R6 — the 2026-09-07 learner review round

Kayleigh A. Berthiaume Fox came back the day after
[R5](./r5-learner-review-record.md) and sent two emails: one from section 7 onward and into Practice,
and one from the start of the pathway on the build R5 produced. She opened the second with the thing
worth recording first:

> The section layout is so much easier to navigate with the text and prompts on the left and the
> interactive piece on the right!

That is R5-OD-1 confirmed by the person whose report produced it. What follows is what the rest
became.

## Point by point

| Reported                                                                                                            | What shipped                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| "the left-most 'steps panel' doesn't re-scroll back to the top, so you're left wondering what to do next"           | Both hosts scroll the pane back to the Now card on a step change. See R6-OD-1.                                       |
| "there is a lot of repeated information … a lot of references to the 'model boundary' … can this be … a button?"    | The walk's read-as-text paragraph and every model boundary in the module are disclosures. See R6-OD-2.               |
| "once I went to stop 4 of 6, there were no stops 5 or 6 in the circuit walk"                                        | The walk counts this section's stops. **This reverses R5-OD-3.** See R6-OD-3.                                        |
| "I can't advance to the next case"                                                                                  | The next case loads in place instead of navigating to the route it is already on. See R6-OD-4.                       |
| "the text is narrow and there's just blocks of it"                                                                  | Seven of the debrief's twelve classes had no CSS rule at all. See R6-OD-5.                                           |
| "Can this right side text be amended to 'Which part of the circuit does the pattern indicate an issue'?"            | The stem asks what the pattern points to as the problem.                                                             |
| "it says 'four candidates are pinned on the drawing and named under it' but the labels are on top"                  | "Four places are numbered on the drawing, and the same numbers label the choices."                                   |
| "Step 6 … I wonder if all drop downs should just be closed at this step"                                            | The first block no longer opens at Transfer — which also closes a leak an earlier pass had flagged in the same list. |
| "Can this part be hidden under a button or a drop-down since it's not necessary for answering the questions?"       | The live readings fold while the map is the answer surface, and open on every other step.                            |
| "sometimes the grammar is a bit awkward … 'The circuit is open beside it so you can see where this patient sits'"   | That sentence and four instances of "settled before the lesson opens on it" reworded.                                |
| "in previous sections, I did not see this header: 'ECMO Management…'"                                               | **No change — nothing is wrong.** See below.                                                                         |
| "can there just be a phase where the participant is just reading and answering questions … then the model shows up" | **Owner decision, not taken here.** See below.                                                                       |

## R6-OD-1 — the pane returns to the instruction

Both hosts moved focus to the Now card on a step change and passed `preventScroll: true`, which
stops the document jumping and does nothing about the pane the card lives in. That pane is its own
scroll container, so a learner who had scrolled down to reach the step list, the actions or the story
problems stayed exactly there when the step advanced.

Deliberately not `scrollIntoView`, which scrolls every scrollable ancestor including the document —
the jump `preventScroll` was there to avoid. `scrollTaskPaneToTop` walks up to the one element that
is actually scrolling and resets it.

## R6-OD-2 — the boundary is a button now

> There is a lot of repeated information, and I notice there's a lot of references throughout the
> module to the "model boundary". I'm not exactly sure what that adds to the module for the learner,
> so can this be removed or made into a button that is accessible but not visible without someone
> clicking on it?

Made into the button, not removed. What a simulation does not represent is a claim this module owes
the learner, and `content/derivedValueGuides.ts` requires one on every guide — but a claim the
learner may open is still made, and one they must read past on the way to the teaching is paid for in
attention on every card. The text is unchanged and stays in the DOM open or shut, so the rendered
leak scans still see it.

The walk card's "read this as text" paragraph went the same way, for a sharper reason: it restated,
in order, every line already visible above it. It was the equivalent of a small map this card no
longer draws — R4-OD-10 retired the minimap and moved the marking onto the real map — so it had been
duplicating the card since that change. Kept rather than deleted, because it is still the one place
the whole stop reads as continuous prose, which is what someone on a pane too narrow to show the map
actually wants.

## R6-OD-3 — the walk counts this section (reversing R5-OD-3)

R5-OD-3 kept the six stops numbered continuously across two sections and added a sentence saying the
walk carries on, on the reasoning — recorded in `circuitWalk.ts` and `useEcmoCircuitWalk.ts` — that
"stop five of six" would tell a learner arriving at the second section that they were near the end.

The only learner to walk the pathway read it the other way twice, a day apart. First as sections out
of order; then, on the build carrying the sentence, as two stops that were not there: "once I went to
stop 4 of 6, there were no stops 5 or 6 in the circuit walk."

A denominator you cannot reach is a broken promise however it is captioned. The card counts what this
section holds. The authored ordinals still run 1..6 in declaration order, the import-time contiguity
check is untouched, and the sentence by the buttons still says the walk is longer than the section —
so the "near the end" signal survives in words rather than in a number the learner cannot act on.

## R6-OD-4 — the next case loads, it does not navigate

The next-case target is the practice route with a different `case` query, and the session hydrates
from `window.location.search` in an effect keyed on `section` — read once, on mount. A client-side
push to the same route moved the address bar and left the case where it was.

A same-route target now carries an `onSelect` that goes through the session's own loader, which swaps
the scenario, records progress and syncs the URL. A lesson or the capstone is a different route and
still navigates. The href stays on the control either way, so it is still a real link.

## R6-OD-5 — the debrief had no layout

Seven of the twelve classes the debrief's markup asks for — `planComparison`, `domainComparison`,
`debriefTimeline`, `consequenceList`, `conceptList`, `debriefBlock`, `debriefActions` — had no rule
anywhere in the stylesheet. `styles.x` resolved to `undefined`, the class attribute came out empty,
and the interior rendered as browser-default markup in a narrow pane.

It also ran two sentences together — "…acute hypercapnic acidemia**Expected in this case:**" —
because the committed value and the expected one are adjacent inline spans and nothing was making
them stack. Nothing here is new design; it is the panel's own idiom applied to markup already written
for it.

## Reported, and correct as it stands

**"In previous sections, I did not see this header: 'ECMO Management…'"** Both stage hosts render an
identical header — breadcrumb, track, `Section N of 17`, minutes, title — and her own screenshots
from sections 1, 2 and 3 show it. There is no inconsistency to fix. It is a quiet strip, which may be
the real report; that is a design question rather than a defect.

## Left for an owner decision

> Can there just be a phase where the participant is just reading and answering questions to build a
> knowledge base, and then the model shows up with interactive questions/prompts? I think having the
> heavy text panel in the middle can be so distracting when I'm trying to move my eyes from the left
> to read the instructions to the right to follow them and use the simulator.

This is a curriculum-shape question, not a defect, and it is the largest thing in either email. It
asks for a reading phase before the simulator appears at all — which would change the stage ladder,
the six-phase contract every critical-care activity shares, and the premise that a foundation section
teaches _from_ a live circuit. R5 already reduced the middle pane's load (per-step blocks, the
narrative first at Explain) and R6 reduces it further (boundaries and the read-as-text paragraph
folded), so part of what prompted it is addressed. Whether to go further is yours.

## Not fixed, and still on the list

Everything in R5's own "left for a next round" is still open. Added here: nothing in the module
scrolls the _teaching_ pane on a step change, so the same class of defect R6-OD-1 fixes for the steps
pane may exist there — it was not reported and has not been checked.
