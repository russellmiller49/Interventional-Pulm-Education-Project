# PI-FELLOW-DRAFTS — question revision samples

> **AI-authored draft — not clinically reviewed.** Prepared 2026-09-22 by Claude (Opus 5.5) for
> owner review. Documentation only. No live item, stem, choice, key, id or review status changes
> until a separate implementation lane applies an approved sample.

**Owner decision (OD4-05 with OD4-02, 2026-09-22).** The versioning rule is approved, and the
samples are approved **as drafts**, which is not clinical review. Changed semantics get new ids, and
old integrated-case addresses redirect if a slot is replaced. **QS-2 is held** as a later
enhancement: the existing optional review is already honest, and QS-2 would change the
validator/design contract for one question. Per OD4-02, QS-3 uses its text variant, QS-4 keeps its
text form, and QS-8 becomes image-based. The per-sample status is in the table
([owner-decisions.md](owner-decisions.md#recorded-owner-decisions-2026-09-22)).

Base `origin/main` **`745146f6`** · feedback items **1.5, 3.7, IC2, IC3, PR1** (primary) with
**CW1** coordinated here in documentation only. Evidence tags (**S M I T U O**) are defined in the
[README](README.md#evidence-tags).

## How these were chosen

**Eight samples, the maximum.** Each covers one of the problems the walkthrough raised. Together
they show what a revision of that kind looks like. They are not a bank rewrite. Most of the bank,
and every praised practice case, is left alone.

| #    | Problem it samples                                                                  | Feedback    | Item                                       | Semantics change?        | Proposed identity                         | Owner status (2026-09-22)                |
| ---- | ----------------------------------------------------------------------------------- | ----------- | ------------------------------------------ | ------------------------ | ----------------------------------------- | ---------------------------------------- |
| QS-1 | "Changed example" repeats the worked example; key is the only hedged option         | 1.5         | Section 1 check `choose-1`                 | yes                      | new `imaging-questions-interpretation-v2` | approved as draft                        |
| QS-2 | Closing step reviews another section; no transfer of this section's idea            | CW1         | Section 5 closing step                     | yes (new item)           | new `projection-transfer-v1`              | **held** (later enhancement)             |
| QS-3 | Distractors pair a cause with an impossible fix                                     | 3.7         | Section 6 check `signal-interpretation-v2` | yes                      | `signal-interpretation-v3`                | approved as draft; text variant          |
| QS-4 | Item hands over the cause the section teaches learners to find (over-cued)          | 6.6, cueing | Section 16 check `change-1`                | yes                      | new `changing-anatomy-interpretation-v2`  | approved as draft; text form             |
| QS-5 | Image-reading case with no image; key stated more strongly than a learner can check | PR1, IC3    | Practice 9 `dts-interpretation-practice-1` | no (evidence route only) | keep id (recommended) or `-v2`            | approved as draft; keeps its id          |
| QS-6 | Integrated-case distractor is reckless, not plausible                               | IC2         | Integrated 4 `case-4`                      | yes                      | `case-4-v2`                               | approved as draft; old address redirects |
| QS-7 | Integrated-case distractor is arithmetic nonsense                                   | IC2         | Integrated 8 `case-8`                      | yes                      | `case-8-v2`                               | approved as draft; old address redirects |
| QS-8 | Integrated case narrates what its objective says to read from images                | IC3         | Integrated 5 `case-5`                      | yes                      | `case-5-v2`                               | approved as draft; image-based           |

**Common rules for all eight** [T, following the self-paced contract in the pack and PI-01]:

- The explanation is available before answering. Retry is allowed. Skip and leave stay available.
  Nothing is scored, recorded or weighted. No sample adds a mandatory question.
- **Versioning rule (approved, OD4-05, 2026-09-22).** Any change to a stem's evidence, a choice or a key's
  wording gets a new question id. The old id stays in the bank, so legacy first-decision records
  keep meaning what they meant. The only exception proposed is QS-5, where the decision, choices and
  key are unchanged and only the evidence moves from words to a figure.
- **Copy gate.** Proposed learner-facing wording avoids the shared gate's refused vocabulary
  (grading terms such as "score" or "pass", the correctness words, and software terms such as
  "route") [I: `clinicalLearningItem.ts` `learnerCopyReviewTerms`]. It also uses Prompt 03's terms:
  "modeled lesion", "stored contour", model-signed C-arm obliquity with no LAO/RAO.
- **Plausibility tags.** Each sample says which `plausibility` the stage should give each
  distractor (`unsafe`, `reasonable-but-incomplete`, `incorrect-mechanism`) [I:
  `stageItems.ts` `PLAUSIBILITY_OVERRIDES`], because the verdict card uses that tag.

---

## QS-1 · Section 1 check: change one feature of the worked example

| Field                 | Content                                                                                                                                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Feedback / source  | **1.5** (PDF p.12): "The scenario is word for word the worked example from Activity 2 … The two wrong options both claim certainty … and the right one is the only hedged option" [S]. Related **CW1** (p.6): the same question also closes Sections 2 and 4 [S].          |
| 2. Existing identity  | Question `choose-1`. Stage items `imaging-questions:choose-1` (Section 1 check), `chain-walk:choose-1` and `current-anatomy:choose-1` (optional review in Sections 2 and 4) [I].                                                                                           |
| 5. Teaching objective | `choose`: "Distinguish navigation, lesion localization, tool-in-lesion confirmation and diagnostic tissue" [M: `OBJECTIVES`]. Takeaway: "Navigation target reached, lesion localized, tool-in-lesion confirmed and diagnostic tissue obtained are distinct endpoints." [M] |

**3. Current wording** [I: `data/questions.ts`]

> Navigation places the catheter at the virtual target. The needle is visible on fluoroscopy, but the
> lesion is not. What does this evidence confirm?

Section 1's worked example, which appears before it [M: `data/lessons.ts`]: "Navigation places the
catheter at the virtual target. Fluoroscopy shows a needle but no convincing nodule."

**4. Current choices and key**

- a. "The needle is within the lesion, since the catheter reached the navigation target and the needle is seen."
- **b (key).** "The catheter reached the navigation target; the lesion and needle–lesion relationship are unconfirmed."
- c. "The biopsy will be diagnostic, since the catheter reached the navigation target and the needle is in view."

**6. What is weak.** The learner can answer from memory of the worked example two screens earlier.
The key is the only option that hedges, so a test-wise reader can pick it knowing nothing about
imaging [S: p.12]. The item never makes the learner say _which_ uncertainty remains.

**7. Proposed scenario** [T]. One feature changes: a faint opacity is now visible, and it overlaps
the needle on one projection.

> Navigation places the catheter at the virtual target. On the frontal fluoroscopic projection, a
> faint rounded opacity now overlaps the needle tip. No other projection has been taken. What does
> this evidence establish?

**8. Proposed choices**

- a. "The needle is in the lesion: the catheter reached the target and the needle overlaps the opacity."
- **b.** "The catheter reached the navigation target; the opacity may be the lesion, and the needle's depth relative to it is unconfirmed."
- c. "The lesion is localized by the opacity; only the needle's depth relative to it remains to be checked."

**9. Key:** b.

**10. Worked explanation** (available before answering: **yes**, item 11)

Navigation shows the catheter relative to a target drawn on the planning CT; it does not show what lies there today [M: Section 1 block]. A single fluoroscopic projection collapses depth, so a needle can overlap an opacity while lying in front of it or behind it [M: Section 5 "Superimposition and parallax"]. A faint opacity on one view is a candidate for the lesion, not proof of what it is or where it lies in depth. A separated second projection, DTS or CBCT can show where the lesion is now and how the needle relates to it [M: Section 1 "Match the modality to the question"; Section 9 "Change modality…"].

**12. Why each distractor is plausible, and why it fails**

| Choice | Why a fellow might pick it                                            | Why it does not fit                                                                                                                                                  | Plausibility tag            |
| ------ | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| a      | Navigation arrival plus visible overlap feels like two confirmations. | Overlap on one projection is superimposition until shown otherwise [M: Section 5 takeaway].                                                                          | `incorrect-mechanism`       |
| c      | It is hedged and sounds careful, and it is half right.                | It treats one faint opacity on one view as a localized lesion. Structures at other depths can overlap it, and its identity is not established [M: Sections 1 and 5]. | `reasonable-but-incomplete` |

| Field                        | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13. Sources                  | Module citations only: `setser`, `confirm` (Section 1 blocks); `setser`, `tg272` (Section 5) [M]. `confirm` abstract read: it separates tool-in-lesion from diagnostic yield as endpoints [S: PMID 41698810].                                                                                                                                                                                                                                                              |
| 14. Image / evidence need    | None. The decision is endpoint reasoning, a text scenario (**B**).                                                                                                                                                                                                                                                                                                                                                                                                         |
| 15. Essential or optional    | Optional. Section 5's parallax model could be linked after the answer.                                                                                                                                                                                                                                                                                                                                                                                                     |
| 16. Semantics changed?       | **Yes**: new evidence (an opacity is now visible), new choices. Same objective and key logic.                                                                                                                                                                                                                                                                                                                                                                              |
| 17. Proposed identity        | New question `imaging-questions-interpretation-v2` in `INTERPRETATION_CHECKS`, following the existing `*-interpretation-v2` convention [I]. Stage item `imaging-questions:imaging-questions-interpretation-v2`. `choose-1` stays unchanged: it remains the worked example's twin and the optional review in Sections 2 and 4. Implementation note: `validateImagingStageItems` counts `lesson.checkIds[0]` (`choose-1`) as predicted, so those reviews still validate [I]. |
| 18. Why it improves learning | The learner reasons from changed evidence instead of recall. Two hedged options force a choice between _which_ uncertainty remains: lesion identity and depth, or depth only. It also connects Section 1 to the parallax idea in Section 5.                                                                                                                                                                                                                                |

---

## QS-2 · Section 5 closing step: a new transfer question (optional)

**Status: held (OD4-05, 2026-09-22).** Kept as a later enhancement. No validator or design change is
made for it now. Section 5's existing optional review stays as is.

| Field                 | Content                                                                                                                                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Feedback / source  | **CW1** (p.6): "add a separate question that transfers the current section's idea to a new situation" [S]. The pack keeps this bounded: "draft genuinely new transfer cases separately; do not add a question quota" [S: ledger]. Related 2.8. |
| 2. Existing identity  | Section 5 closing step: stage item `projection:anatomy-1`, titled "Optional review · CT-to-body divergence", reusing Section 4's check [I; S: P03 handoff §B].                                                                                 |
| 5. Teaching objective | Section 5 outcome: "Distinguish projected overlap from a resolved three-dimensional tool–lesion relationship" [M].                                                                                                                             |

**3. Current wording** (the reused Section 4 item) [I]

> During bronchoscopy, central airway landmarks remain aligned with the planning CT, but a new
> dependent opacity now obscures a previously distinct peripheral lesion. What is the best next step?

**4. Current choices and key**

- a. "Recalibrate navigation and continue sampling at the same virtual target."
- b. "Navigate more precisely to the virtual target and sample at that location."
- **c (key).** "Assess for atelectasis and re-localize the lesion on current imaging."

**6. What is weak.** Prompt 03 labelled this step honestly as review of Section 4 [S]. Section 5
still has no question that carries its _own_ idea (what two projections do and do not establish)
into a new situation. Section 5's check is also the one Sections 6, 10 and 15 reuse [S: P03 handoff §B
`transferOrigins` table].

**7. Proposed scenario** [T]

> Forceps are advanced toward an irregular nodule. They overlap the nodule on the frontal
> projection, and they still overlap after the C-arm is rotated to a well-separated oblique. What do
> the two views establish?

**8. Proposed choices**

- a. "The forceps are in the nodule: overlap on two separated projections settles depth."
- **b.** "The forceps may be at the nodule; whether the jaws will sample it is still unconfirmed."
- c. "Nothing more than one view: a second projection adds no depth information."

**9. Key:** b.

**10. Worked explanation** (available before answering: **yes**)

A separated second projection can reveal that a tool and a lesion are apart; that is parallax [M: Section 5 "Superimposition and parallax"]. When overlap persists, the possibilities narrow, but overlap on two projections does not prove that the sampling part of a tool lies within an irregular three-dimensional lesion. Blur, tool blooming, motion, lesion shape and residual depth uncertainty matter [M: Section 5 "Two projections still have limits"]. If that remaining uncertainty would change safe sampling, DTS or CBCT answers what projections cannot [M: same block].

**12. Distractors**

| Choice | Why a fellow might pick it                                                          | Why it does not fit                                                                                                   | Plausibility tag            |
| ------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| a      | "Two views" is the routine many learners are taught as confirmation.                | Two overlapping projections do not prove the jaws are inside an irregular lesion [M].                                 | `reasonable-but-incomplete` |
| c      | A learner who has just learned that one projection collapses depth may overcorrect. | A separated second view does add depth information. Here it failed to show a separation, and that is information [M]. | `incorrect-mechanism`       |

| Field                        | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13. Sources                  | `setser`, `pritchett` (module citations on the Section 5 blocks) [M]. `pritchett` abstract read (CBCT with augmented fluoroscopy; not about two-view limits) [S: PMID 30179922]. The two-view limit is module content, not verified against full text here [U for full-text support].                                                                                                                                                                                                                                                                                  |
| 14. Image / evidence need    | None required (**B**). An optional model image is possible: the Section 5 geometry model at depth 0 overlaps at any obliquity [I: `independentValues` round 1]. The model shows a needle and a sphere, not forceps and an irregular lesion, so an image would need a "modeled tool" label and would not show the irregularity the question turns on. Text is the more honest carrier.                                                                                                                                                                                  |
| 15. Essential or optional    | Optional                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 16. Semantics changed?       | **Yes**: a new item                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 17. Proposed identity        | New question `projection-transfer-v1`. Placement is an owner choice (OD4-05): **(a)** a second, optional closing step in Section 5 beside the existing review, or **(b)** replacing the review there with a new transfer variant id. **Implementation note:** `validateImagingStageItems` currently rejects a closing (transfer) item that no earlier section predicted [I: "carries a transfer … that no earlier section predicted"]. A genuinely new transfer question needs that rule revisited in a runtime lane. That is a design decision, not a Prompt 04 edit. |
| 18. Why it improves learning | It transfers Section 5's own idea to a new instrument and a new failure mode (overlap that persists). It answers CW1's request without a quota: one section, one question, optional.                                                                                                                                                                                                                                                                                                                                                                                   |

---

## QS-3 · Section 6 check: pair each cause with its real fix

| Field                 | Content                                                                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Feedback / source  | **3.7** (PDF p.31): "Wrong options often pair a cause with an impossible fix … I could rule them out without looking at image A or B. The practice cases have much better wrong answers" [S]. Related 3.5 (the panels are cartoons). |
| 2. Existing identity  | Question `signal-interpretation-v2`, stage item `signal:signal-interpretation-v2` [I]. Source comment: "Authored 2026-09-13; faculty review pending" [I].                                                                            |
| 5. Teaching objective | Section 6 outcome: "Distinguish quantum noise from scatter and from anatomical superimposition" [M].                                                                                                                                 |

**3. Current wording** [I: `interpretationChecks.ts`]

> Image B was made at the same projection as A. In the wide-field example, the diaphragm, vessels and
> target are nearly the same gray, with a smooth background and sharp tool edge. Which limitation and
> response best fit these contextual clues?

**4. Current choices and key**

- a. "Quantum noise; use display zoom to restore missing photons."
- b. "Superimposition; raising pulse rate separates overlapping anatomy."
- **c (key).** "Scatter-related contrast loss; review field size and beam path."

**6. What is weak.** Each distractor's _response_ is impossible: zoom cannot add photons, and pulse
rate does not separate anatomy. The learner rejects them on the fix alone and never has to decide
the cause, which is the section's objective [S: p.31].

**7. Proposed scenario** [T]. Two variants. **The text variant is selected (OD4-02, 2026-09-22).**
The image variant waits until honest media exist.

- **Text variant (recommended now).** "Image B was made at the same projection as Image A, with the
  collimator open to the edges of the detector. In Image B the diaphragm, vessels and target are
  nearly the same gray; the background is smooth and the tool edge is sharp. Which limitation, and
  which response, fit Image B?"
- **Image variant (only if the owner makes visual discrimination an objective and approves the
  brief D media).** Drop the second sentence, so the appearance must be read from Image B. The
  panel's text alternative must still describe it for screen-reader users (the current SVG's
  `aria-label` already does [I]).

**8. Proposed choices.** Every option is a real cause paired with that cause's real response.

- a. "Quantum noise from too few detected photons; raise output or select a higher-dose preset."
- b. "Anatomical superimposition; change the C-arm projection, planned from the CT."
- **c.** "Scatter-related contrast loss; collimate to the task while keeping the required anatomy."

**9. Key:** c.

**10. Worked explanation** (available before answering: **yes**)

Name the limiting factor before changing anything [M: Section 6 takeaway]. Quantum noise is random variation from too few detected photons; it looks like mottle. Scatter adds unwanted signal that lowers contrast. Superimposition is real overlying structure [M: Section 6 "Identify what is limiting conspicuity"]. Here the loss of contrast is even across dense and soft structures, the background is smooth and the tool edge sharp, and the field is wide: that points to scatter. Collimation reduces the irradiated volume that produces it. More output would raise scatter along with the primary beam, and a new projection keeps the same wide field [M: `signal-practice-1` rationales]. The panels are drawings: appearance alone does not settle the cause, so use the context as well [M: current rationale c; `SignalComparison` caption].

**12. Distractors**

| Choice | Why a fellow might pick it                                                                                     | Why it does not fit                                                                                                                                     | Plausibility tag      |
| ------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| a      | "Image looks poor, turn up the dose" is the common reflex, and it is the right response to noise.              | The background is smooth, not mottled. More output in the same wide field raises scatter along with the primary beam [M].                               | `incorrect-mechanism` |
| b      | Low contrast over the heart or diaphragm is often superimposition, and a new projection is its right response. | Superimposition lowers contrast where structures overlap and spares the rest. Here contrast is reduced everywhere [M: `signal-practice-1` rationale c]. | `incorrect-mechanism` |

| Field                        | Content                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13. Sources                  | `tg125`, `tg272`, `wabip` (module citations) [M]. `wabip` abstract read (radiation principles and practical measures) [S: PMID 39033746]. `tg125` and `tg272`: registry metadata only.                                                                                                                                                                                           |
| 14. Image / evidence need    | Text variant: the existing cartoon panels, **optional** companions (**B**). Image variant: the panels become **essential** (**A**) and should be the realistic set in brief D §D1–D2, not the current cartoon.                                                                                                                                                                   |
| 15. Essential or optional    | Depends on OD4-02                                                                                                                                                                                                                                                                                                                                                                |
| 16. Semantics changed?       | **Yes**: choices and stem change. The key's meaning (scatter) is unchanged.                                                                                                                                                                                                                                                                                                      |
| 17. Proposed identity        | `signal-interpretation-v3`. Keep `-v2` in the bank.                                                                                                                                                                                                                                                                                                                              |
| 18. Why it improves learning | The learner must identify the cause, because every response is right for _some_ cause. This is the practice-case standard the walkthrough asked for. **Overlap note:** `signal-practice-1` uses the same three causes in a bedside story [I]. The check reads the image panels and the practice case reads the room, so the two use different evidence for the same distinction. |

---

## QS-4 · Section 16 check: ask for the cause, not only the response

**Status: approved as a draft in its text form (OD4-02, OD4-05, 2026-09-22).** The image variant
waits for authentic motion media, which are deferred (OD4-06).

| Field                 | Content                                                                                                                                                                                                                                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Feedback / source  | **6.6** (PDF p.42): Section 16's new teaching is "match the artifact to its cause … in the paragraphs, not the figure" [S]. **Cueing:** the check names the cause it should ask about. This is also the "asking more of the image than it shows" boundary PI-01 resolved by relabelling [S: handoff; I: `ILLUSTRATIVE_ONLY_EXAMPLES`]. |
| 2. Existing identity  | Question `change-1`, stage item `changing-anatomy:change-1`. Its fixed example `changing-anatomy:example:0` is declared `illustrative-model` [I].                                                                                                                                                                                      |
| 5. Teaching objective | `verify`. Section 16 outcome: "Distinguish a correctable acquisition artifact from an anatomical or physiological change that requires repeat localization." First block: "Match the artifact to its cause" [M].                                                                                                                       |

**3. Current wording** [I]

> A CBCT reconstruction shows duplicated tool and lesion edges from motion during the spin. What most
> directly addresses the cause before repeating it?

**4. Current choices and key**

- a. "Increase exposure and repeat the same acquisition."
- **b (key).** "Re-establish a stable, tolerable breath hold with anesthesia."
- c. "Use a thicker display slab and accept the duplicated edges as they are."

**6. What is weak.** The stem supplies both the appearance and its cause ("from motion"). The
section's first job, matching an artifact to its cause, is never asked. The image beside the item is
the rigid-shift registration model, which shows no artifact, so the learner cannot practise
recognising it there either [I].

**7. Proposed scenario** [T]

> The first CBCT spin of the case is on the review monitor. The catheter and the nodule margin each
> appear twice, a few millimetres apart, on several planes. The table, the C-arm and the tool did not
> move between the start and the end of the spin. What should change before a second spin?

**8. Proposed choices.** The two distractors are the other artifact families the section's own
block teaches.

- a. "Select a higher-dose protocol so the edges come out better defined."
- **b.** "Agree a stable, tolerable breath hold or ventilation pause with anesthesia, including who announces readiness and when to stop."
- c. "Turn on metal-artifact reduction for the catheter."

**9. Key:** b.

**10. Worked explanation** (available before answering: **yes**)

Match the artifact to its cause before repeating the same acquisition. Duplicated edges suggest motion [M: "Match the artifact to its cause"]. With the table, C-arm and tool still, the likely source is breathing or other patient motion during the spin. Plan the breath hold with anesthesia: agree the intended state, who announces readiness, and the stopping criteria before it begins [M: "Plan the breath hold with anesthesia"]. Anesthesia safety governs the breath hold [M: takeaway]. More photons do not undo motion between projections [M: current rationale a]. Metal-artifact reduction is meant for streaks from metal that cannot be removed, and duplicated edges are a different pattern [M: block; `mobile-suite-practice-1` rationale b].

**12. Distractors**

| Choice | Why a fellow might pick it                                             | Why it does not fit                                                                                             | Plausibility tag      |
| ------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------- |
| a      | A degraded image invites "more dose".                                  | Noise degrades the whole image, and more photons do not correct inconsistency between projections [M].          | `incorrect-mechanism` |
| c      | There is metal in the field, so a metal-specific tool sounds targeted. | Metal produces streaks near the metal. Doubled edges on the lesion as well as the catheter point to motion [M]. | `incorrect-mechanism` |

| Field                        | Content                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13. Sources                  | `setser`, `tg272`, `ilocate` (block "Match the artifact to its cause"); `setser`, `vespa` (breath-hold block) [M]. `setser` abstract read (covers image quality and acquisition best practice at abstract level) [S: PMID 33447430]. Breath-hold parameters are **not** stated. P03-VESPA stays open, and no pressure, PEEP, oxygen or apnea value appears [S: owner packet].                                                       |
| 14. Image / evidence need    | As drafted, **B**: the appearance is described in words. An image variant (**A**) needs an authentic de-identified CBCT with motion duplication (brief D §D4), which is **absent**. The model cannot show it [I].                                                                                                                                                                                                                   |
| 15. Essential or optional    | Optional now; essential in the image variant                                                                                                                                                                                                                                                                                                                                                                                        |
| 16. Semantics changed?       | **Yes**: the stem now asks cause-then-response from an appearance; choices change.                                                                                                                                                                                                                                                                                                                                                  |
| 17. Proposed identity        | New question `changing-anatomy-interpretation-v2` in `INTERPRETATION_CHECKS`. Keep `change-1` in the bank; it is also Section 16's `checkIds[0]`, which the validator counts [I]. **PI-01 invariant:** the fixed-example evidence declaration `changing-anatomy:example:0` stays `illustrative-model` for the text form. If an authentic image is later placed on the check, that declaration must be revisited in the same change. |
| 18. Why it improves learning | It exercises the section's first skill, and the distractors are the section's own artifact families, not strawmen. The safety content (anesthesia governs the breath hold) is kept.                                                                                                                                                                                                                                                 |

---

## QS-5 · Practice case 9: show the planes instead of describing them

| Field                 | Content                                                                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Feedback / source  | **PR1** (PDF p.45): "a catheter missing from DTS planes (Case 9) … In an imaging course I want to see … then decide" [S]. Related IC3, 1.2.                                |
| 2. Existing identity  | Practice case `dts-interpretation-practice-1`, item `practice:dts-interpretation-practice-1`, paired Section 11 [I].                                                       |
| 5. Teaching objective | `dts`. Takeaway: "A catheter present throughout a DTS acquisition cannot be absent from planes built from that acquisition. Its absence marks prior-derived content…" [M]. |

**3. Current wording** [I: `microCases.ts`, `questions.ts`]

> _Situation:_ A robotic catheter was parked in a subsegmental airway of the right lower lobe before
> the DTS acquisition and has not moved since; live fluoroscopy shows its distal end clearly. The
> second monitor shows a reconstructed view of that region, where the lesion has fine lobulated
> margins much as on the planning CT open on the adjacent display. Scrolling the reconstructed planes
> through the airway and the lesion, the catheter appears on none of them. The C-arm and the table
> have not moved since the acquisition.
>
> _Stem:_ Which interpretation of the reconstructed view is best supported?

**4. Current choices and key**

- **a (key).** "The lesion margin on these planes comes from another acquisition, since the catheter is absent from them." Rationale: "Each DTS plane is built from X-ray paths that crossed whatever lay in the field during the acquisition, and a catheter that live fluoroscopy shows this clearly could not be missed. Its absence means these pixels were not acquired while the catheter was there: the margin was supplied by another acquisition, such as the planning CT, and describes the lesion as it was then."
- b. "The catheter is too thin to appear on these planes, so the lesion margin comes from this DTS acquisition."
- c. "Registration has drifted, so the catheter lies on other planes and the margin comes from this DTS."

**6. What is weak.** It is an image-reading case with no image. The learner is _told_ the catheter
is absent rather than finding it absent [S: p.45]. Without the planes, the key's rationale is also
more categorical than the learner can check ("could not be missed"). With the planes in front of
them, they can check it.

**7. Proposed scenario** [T]. Keep the case and its decision. Add a three-panel figure from
**existing model layers**, and trim the situation to what the figure cannot show.

> _Situation:_ A robotic catheter was parked in a subsegmental airway before the DTS acquisition and
> has not moved since. The C-arm and the table have not moved either. The figure shows, left to
> right, the last live fluoroscopic frame, three reconstructed planes through the airway and the
> lesion, and the planning CT at the same level.
>
> _Stem:_ Which interpretation of the reconstructed planes is best supported?

_Figure_ (teaching model, labelled as such). Panel 1: the model's projection with the catheter
visible. Panel 2: three planes rendered from the DTS view's **prior** layer, which omits the modeled
tool [I: `TomosynthesisView.tsx`], shown in **neutral grey**, because the model's teal prior colouring
would give the answer away [I]. Panel 3: the CT slice. Caption: "Teaching model: CT-derived images
with an authored nodule and tool. Not a patient acquisition."

Two wording changes follow from the model, not from preference. "Right lower lobe" is dropped,
because the model's authored nodule lies in the patient's **left** lung (centre x = +85 mm in the
model's LAS frame, x = patient left [I: `public/peripheral-imaging/README.md`,
`anatomy/manifest.json`]), and its exact lobe has not been confirmed (OD4-11). "Fine lobulated
margins" is dropped, because the model nodule is a smooth part-solid sphere [I: same manifest].

**8. Proposed choices:** unchanged (a, b, c as above).

**9. Key:** a (unchanged). **Optional rationale softening [O]:** replace "could not be missed" with
"would be expected on the planes near its depth, at least blurred". That is the module's own
statement in rationale b ("a dense catheter within the imaged volume brightens more planes, not
none") [M].

**10. Worked explanation:** the existing takeaway, unchanged [M]. Available before answering: **yes**.

**12. Distractors:** unchanged. b is `unsafe` in the current overrides and c `incorrect-mechanism`
[I]. Their existing rationales still apply.

| Field                        | Content                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13. Sources                  | `saad`, `pritchett` (module citations) [M]. `saad` abstract read: prior CT registered to an intermediate DTS reconstruction and used as the first estimate for re-reconstruction [S: PMID 39625122]. It supports "a reconstruction can carry prior-CT content" in principle; it does not describe any particular platform's display [U for platform specifics]. |
| 14. Image / evidence need    | **Essential (A).** Existing model output, eligible as a model.                                                                                                                                                                                                                                                                                                  |
| 15. Essential or optional    | Essential                                                                                                                                                                                                                                                                                                                                                       |
| 16. Semantics changed?       | **No** for decision, choices and key. The evidence moves from narration to a figure, and two descriptive phrases change to match the model.                                                                                                                                                                                                                     |
| 17. Proposed identity        | Keep `dts-interpretation-practice-1` (recommended). Practice stores no answer [I], and the decision is unchanged. Record the revision in the item's history. If the owner prefers strict versioning, use `dts-interpretation-practice-1-v2`.                                                                                                                    |
| 18. Why it improves learning | The learner finds the absence and the resemblance and draws the inference, which is the skill. The figure is honest: it is the course's model, labelled, and the text no longer claims a margin the model does not have.                                                                                                                                        |

---

## QS-6 · Integrated case 4: plausible alternatives at the docking check

| Field                 | Content                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Feedback / source  | **IC2** (PDF p.48): "Several wrong options are clearly unsafe or absurd ('Start the spin, relying on the frontal clearance' …). I answered them without thinking about imaging" [S]. |
| 2. Existing identity  | Case `case-4`, item `capstone:case-4`, safety tag, paired Section 12. Override: choice a `unsafe` [I].                                                                               |
| 5. Teaching objective | `cbct`. Takeaway: "The collision check must match the setup that will actually be scanned." [M]                                                                                      |

**3. Current wording** [I]

> A mobile C-arm clears the patient in the frontal position. After robot docking, the full CBCT spin
> path has not been checked and ventilator tubing crosses the expected path. What is the best next
> action?

**4. Current choices and key**

- a. "Start the spin, relying on the frontal clearance already observed."
- b. "Use a lower-dose protocol and keep the current setup."
- **c (key).** "Reposition the tubing and perform a supported collision check."

**6. What is weak.** Choice a is reckless and b does not address a collision at all. The key is
found by elimination, without weighing how and when to check. The real teaching point is the order
of operations: remove a known obstruction, then verify the path for the docked configuration.

**7. Proposed scenario** [T]

> A mobile C-arm cleared the patient in the frontal position during setup. The robot has since
> docked, the full CBCT spin path has not been checked, and ventilator tubing now crosses where the
> C-arm will travel. The system supports a non-irradiating trial rotation. What is the best next
> action?

**8. Proposed choices**

- a. "Run the trial rotation now, and move the tubing only if the C-arm touches it."
- b. "Shorten the rotation so the C-arm stops before the tubing, then acquire."
- **c.** "Move the tubing with anesthesia, then check clearance for the docked setup, including the trial rotation."

**9. Key:** c.

**10. Worked explanation** (available before answering: **yes**)

Readiness is a team check: confirm clearance through the complete spin, perform a non-irradiating trial rotation when supported, and account for the lines and the anesthesia equipment [M: Section 12 "Make readiness a team check"]. A known obstruction is removed first. The trial rotation then confirms a setup that is meant to be ready [T]. A shorter rotation is a different acquisition with fewer projection directions; it is used only as a supported protocol, and it still leaves the docked path unverified [M: Section 12 recall on angular coverage; "respect the supported … table configurations"]. The check covers the table, robot, tube, detector, patient and anesthesia access [M: current rationale c].

**12. Distractors**

| Choice | Why a fellow might pick it                                                 | Why it does not fit                                                                                                                                                               | Plausibility tag            |
| ------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| a      | It uses the right tool, the supported trial rotation, and feels efficient. | It sends the C-arm toward a known obstruction in the anesthesia circuit. The check exists to prevent that contact [T; M: "account for … the lines and the anesthesia equipment"]. | `unsafe`                    |
| b      | It avoids the collision without disturbing the circuit.                    | It changes the acquisition (less angular information) and still leaves the docked path unchecked [M].                                                                             | `reasonable-but-incomplete` |

| Field                        | Content                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 13. Sources                  | `setser`, `mobile` (module citations) [M]. `setser` abstract read: covers "procedure room set-up, and best practices for CBCT image acquisition" at abstract level [S: PMID 33447430]. Whether a shortened rotation is available on a given mobile system is **device-specific and unresolved** [U]. The option is framed as "only as a supported protocol". |
| 14. Image / evidence need    | None (**B**). A model image is not advised: the suite's swept shell "is not a collision or clearance check" [I: `ConeBeamView.tsx`].                                                                                                                                                                                                                         |
| 15. Essential or optional    | n/a                                                                                                                                                                                                                                                                                                                                                          |
| 16. Semantics changed?       | **Yes**: the stem gains the trial-rotation premise, and two choices change. The key's meaning is the same. The safety tag is kept.                                                                                                                                                                                                                           |
| 17. Proposed identity        | Question `case-4-v2`. `cases.ts` keys a case by its question id and holds exactly eight cases [I], so the owner decides whether `case-4-v2` takes the fourth slot and whether the old case address redirects (OD4-05).                                                                                                                                       |
| 18. Why it improves learning | Both distractors are things a careful person might do. Rejecting them needs the actual principles: a known obstruction goes first, the check matches the docked setup, and a shortened arc is a different acquisition.                                                                                                                                       |

---

## QS-7 · Integrated case 8: record the right quantity, not the right sum

| Field                 | Content                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Feedback / source  | **IC2** (PDF p.48), naming "24 Gy·cm², adding the total and both components" [S].                                                                                  |
| 2. Existing identity  | Case `case-8`, item `capstone:case-8`, paired Section 18 [I].                                                                                                      |
| 5. Teaching objective | `protect`: "…interpret the patient dose metrics in the procedure record" [M: `OBJECTIVES`]. Takeaway: "Count every acquisition mode once and state the units." [M] |

**3. Current wording** [I]

> An authored dose report lists a total KAP of 12 Gy·cm², comprising 8 Gy·cm² from fluoroscopy and 4
> Gy·cm² from CBCT spins. What should the whole-procedure entry say?

**4. Current choices and key**

- a. "24 Gy·cm², adding the total and both components."
- b. "4 Gy·cm², recording the CBCT subtotal."
- **c (key).** "12 Gy·cm² total, with both component values identified."

**6. What is weak.** The item becomes an addition check. Section 18's real lesson is different:
name the quantity before the number, and do not relabel KAP as skin dose or effective dose. That
lesson is not exercised [S: p.48; P03 7.1–7.2 moved this section rule-first].

**7. Proposed scenario** [T]. Keep the authored values; add the second index without inventing its
value.

> An authored dose summary for one procedure lists a total kerma–area product (KAP) of 12 Gy·cm²,
> made up of 8 Gy·cm² from fluoroscopy and 4 Gy·cm² from CBCT spins, and a cumulative reference air
> kerma in mGy. What should the whole-procedure dose entry say?

**8. Proposed choices**

- **a.** "Total KAP 12 Gy·cm² with its fluoroscopy and CBCT parts, plus the cumulative reference air kerma in mGy."
- b. "Total KAP 12 Gy·cm², entered as the patient's peak skin dose."
- c. "An effective dose in mSv calculated from the 12 Gy·cm² total, recorded instead of the indices."

**9. Key:** a.

**10. Worked explanation** (available before answering: **yes**)

Name the quantity before the number [M: `dose-1` takeaway]. The total KAP already includes both parts, so record it once, with the parts identified, and record the cumulative reference air kerma separately with its unit [M: Section 18 note template lines; `case-8` rationale]. Neither index is peak skin dose, which depends on geometry, field overlap and tissue corrections [M: `dose-1` rationale c]. Effective dose is an estimate with disclosed assumptions, not a measured index; it does not replace the indices [M: `capstone-transfer-1` rationale c].

**12. Distractors**

| Choice | Why a fellow might pick it                                           | Why it does not fit                                                                                       | Plausibility tag            |
| ------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------- |
| b      | Dose reports and skin-injury follow-up are often discussed together. | KAP is air kerma integrated over the beam area, not the highest dose to any area of skin [M].             | `incorrect-mechanism`       |
| c      | An mSv value feels more meaningful and comparable with CT.           | It is a modelled estimate that needs its method stated, and it does not replace the recorded indices [M]. | `reasonable-but-incomplete` |

| Field                        | Content                                                                                                                                                                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13. Sources                  | `wabip`, `aapm12`, `skin` (module citations) [M]. `wabip` abstract read: "a consensus on standards for reporting radiation exposure in interventional pulmonology procedures" [S: PMID 39033746]. `aapm12` and `skin`: registry metadata only. |
| 14. Image / evidence need    | None (**B**). A record table in the existing `DoseRecord` style is an optional presentation, not an image [I].                                                                                                                                 |
| 15. Essential or optional    | n/a                                                                                                                                                                                                                                            |
| 16. Semantics changed?       | **Yes**: new premise (a second index) and new choices; the key's intent is the same.                                                                                                                                                           |
| 17. Proposed identity        | Question `case-8-v2`; slot and address handling as QS-6 (OD4-05).                                                                                                                                                                              |
| 18. Why it improves learning | The distractors are the confusions Section 18 exists to prevent: quantity relabelling and substituting an estimate for an index. The arithmetic stays trivial on purpose.                                                                      |

---

## QS-8 · Integrated case 5: read the sampling window from the planes

**Status: approved as a draft; integrated case 5 becomes image-based (OD4-02, OD4-04, OD4-05,
2026-09-22).** When `case-5-v2` replaces the `case-5` slot, the old address redirects.

| Field                 | Content                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Feedback / source  | **IC3** (PDF p.48): "None of the eight has an image" [S]. Evidence map: the only integrated case whose registered objective names image reading ([INT-5](evidence-needs.md#int-5--case-5)). |
| 2. Existing identity  | Case `case-5`, item `capstone:case-5`, paired Section 15 [I].                                                                                                                               |
| 5. Teaching objective | `verify`: "Confirm tool-in-lesion on multiplanar imaging…" [M]. Takeaway: "Document which part of the biopsy tool is in the lesion, and in which acquisition." [M]                          |

**3. Current wording** [I]

> In the course's fictional needle design, the tip lies beyond a spherical lesion, and thin reformats
> place part of the side-cutting window inside it. Which documentation is most accurate?

**4. Current choices and key**

- **a (key).** "The side-cutting window partly intersects the lesion in this acquisition."
- b. "The needle tip is in the lesion because the window intersects it."
- c. "Diagnostic sampling is assured because metal crosses the lesion."

**6. What is weak.** The stem gives away the geometry it asks the learner to document, so the case
tests wording, not reading. Choice c is a strawman. "Fictional" also predates Prompt 03's "modeled"
wording [S: P03 handoff §C].

**7. Proposed scenario** [T]

> Linked thin axial, coronal and sagittal planes from a CBCT spin show the modeled lesion, the
> needle tip and the needle's side-cutting window. Nothing has moved since the acquisition. Which
> documentation is most accurate?

_Figure_ (teaching model, labelled). The Section 15 multiplanar view at a **new authored
geometry** in which the tip lies beyond the modeled lesion and part of the side window lies inside
it. The geometry must be authored and checked against the model's own readouts ("Side-cutting window
intersects the lesion: yes", "Needle tip inside the lesion: no", as quoted in the walkthrough p.41;
Prompt 03 has since renamed the lesion in these labels "modeled lesion" [S: P03 handoff 6.3; I:
`windowRelationship`]). **Those readouts are hidden while the question is
open**, since they state the answer, and shown with the explanation [T]. The existing "Tip and window
differ" example has the opposite geometry (window behind) [M], so it cannot be reused as is.

**8. Proposed choices**

- **a.** "The side-cutting window partly intersects the modeled lesion in this acquisition; the tip lies beyond it."
- b. "The needle tip is in the lesion, since part of the needle crosses it."
- c. "The needle is in the lesion in this acquisition; whether the sample is adequate is a separate question."

**9. Key:** a.

**10. Worked explanation** (available before answering: **yes**)

Follow the tool, not the streak. The part that acquires tissue is the side-cutting window, not the tip [M: Section 15 "Lesion → tool → relationship → acquisition"; Section 1 definition forwarded in P03]. Here the linked thin planes show the window partly inside the modeled lesion and the tip beyond it. Document that, in that acquisition [M: takeaway]. Tool-in-lesion confirmation does not guarantee diagnostic tissue [M: Section 1 point], and a model intersection is not a clinical safety decision [M: `sampling-interpretation-v2` takeaway].

**12. Distractors**

| Choice | Why a fellow might pick it                                         | Why it does not fit                                                                                                            | Plausibility tag            |
| ------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| b      | Overlap of any part of the needle is easy to read as "in".         | The planes show the tip beyond the lesion. Tip and window are different parts [M].                                             | `incorrect-mechanism`       |
| c      | It is hedged about adequacy and sounds like careful documentation. | "The needle is in the lesion" loses what the images show: which part, and how much. That is what the note needs [M: takeaway]. | `reasonable-but-incomplete` |

| Field                        | Content                                                                                                                                                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13. Sources                  | `setser`, `confirm` (module citations) [M]. `confirm` abstract read: tool-in-lesion and diagnostic yield reported as separate endpoints [S: PMID 41698810].                                                                |
| 14. Image / evidence need    | **Essential (A)**, from the existing multiplanar model (`sampling-window.glb` and linked planes), eligible as a model [I].                                                                                                 |
| 15. Essential or optional    | Essential                                                                                                                                                                                                                  |
| 16. Semantics changed?       | **Yes**: the evidence route moves from narration to image, and choice c changes. The key's meaning is the same.                                                                                                            |
| 17. Proposed identity        | Question `case-5-v2`; slot and address handling as QS-6 (OD4-05). A new fixed-example identity for the case figure must be declared `depicts-the-question`, following the PI-01 rule [I: `fixedExampleEvidence`].          |
| 18. Why it improves learning | The integrated case now asks for the section's actual skill: read which part of the tool is where, then document it. The image is the course's own model, honestly labelled, so nothing is presented as a patient finding. |

## Not drafted (cap of eight), for the owner's awareness

- **IC2 on cases 1, 6 and 7.** The walkthrough names case 6's "continue the hold while oxygen
  saturation remains acceptable" and case 7's "because the scanner is mobile" [S: p.48]. The QS-6 and
  QS-7 treatment applies directly. Whether to extend it (OD4-05 item 4) was not addressed by the
  2026-09-22 decisions and is still open.
- **3.7 "and similar quiz items".** The walkthrough also points at Section 7's check [S: p.31]. Read
  against the current v2 item, its distractors (retain the smaller field because its area is smaller;
  zoom to recover an excluded landmark) are real misconceptions, not impossible pairs [I], so no
  revision is proposed.
- **Praised practice cases** (all 16; especially case 6, eccentric radial EBUS, and case 15, where
  to stand) are **not** revised. QS-5 changes only case 9's evidence route and two phrases the model
  cannot support.

## Sources read for this file

Walkthrough PDF text pp.6, 12, 31, 42, 45–48; ledger rows for 1.5, 3.7, CW1, IC2, IC3, PR1; PI-FELLOW-03
handoff §B–§D and owner packet (VESPA, rEBUS, angles); `data/questions.ts`,
`content/interpretationChecks.ts`, `content/stageItems.ts`, `content/microCases.ts`, `content/cases.ts`,
`content/teachingExamples.ts`, `data/lessons.ts` (Sections 1, 5, 6, 12, 16),
`components/suite/views/TomosynthesisView.tsx`, `components/suite/views/ConeBeamView.tsx`,
`public/peripheral-imaging/anatomy/manifest.json`,
`src/features/learning-module/activity/clinicalLearningItem.ts`; local abstracts for `setser`,
`wabip`, `saad`, `pritchett`, `confirm`.
