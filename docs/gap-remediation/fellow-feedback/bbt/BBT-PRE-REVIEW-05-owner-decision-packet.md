# BBT-PRE-REVIEW-05 — anatomy and source decisions for the owner

**For:** Russell Miller · **Prepared:** 2026-10-04 · **Module:** Bronchial Branch Tracing

**Status: every decision below is NOT REVIEWED.** Nothing here is implemented, approved or
decided. This packet changes no code, test, image, anatomy or source file.

It asks you for five decisions about the teaching CT and gives short proposals on two more.

**Start here.** Open the local review page. It is evidence on this machine and is not in Git:

`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/bbt-pre-review-05-2026-10-04/review-surface.html`

It steps through the native CT planes with a toggle for the existing model points, shows the full
field of each plane, and shows the module's parent view for two forks. Then record your decisions
in the table at the end.

Each statement below is labelled. **Data** can be checked mechanically from the CT, the airway
graph, the camera definitions or the textbook's text. **AI reading** is what an image or passage
looks like to this session, unreviewed. **Reviewed** would be an attributable human review; none
exists for this CT. **Yours** needs your anatomical or teaching judgement.

The full record for each decision, every image path and every hash are in the
[evidence index](BBT-PRE-REVIEW-05-evidence-index.md) and the
[source index](BBT-PRE-REVIEW-05-source-index.json).

## OD-01 — The first bifurcation (decide first)

**Question. What should the first visible bifurcation teaching example actually show, and which
native planes and points should be used for parent and daughters?**

Lesson 3's first example asks the learner to follow the trachea and mark the right and left main
bronchi on slice 387. Prompt 01 showed that 387 is not a wiring or indexing error, and added a note
that tells the learner, before the task, that the two bronchi share one air column there. That
contained the problem. It did not settle what the example should teach.

**Six things that are easy to run together** (Data).

| Thing                         | What it is                                                                                                                                                                                                 | Where                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Graph node 1                  | Where the airway model's centrelines branch. The graph's own field calls it `carinaNodeId`. It is a centreline point, not a wall.                                                                          | slice index 392.16    |
| Parent point                  | On the tracheal centreline, placed by rule 8.0 mm above the node.                                                                                                                                          | slice 408             |
| Daughter response points A, B | On each main-bronchus centreline, placed by rule 5.0 mm below the node. 8.6 mm apart.                                                                                                                      | slice 387             |
| Response plane                | Where the learner's two marks are compared with those points. Browsable range 384–411.                                                                                                                     | slice 387             |
| Visible split                 | Where the image shows two lumens and a wall. **Not annotated by anyone.** By threshold arithmetic both centrelines lie in one connected air region from 392 to 376, and in separate regions from 375 down. | first separate at 375 |
| Learner's task                | “Mark each daughter on its answer slice, or record uncertainty.”                                                                                                                                           | slice 387             |

Slice 387 comes from the export's general rule: 5 mm along each daughter, or 0.55 × its length if
that is shorter. The rule runs on every junction and knows nothing about where a wall appears. Of
the export's 115 daughter points, 110 sit exactly at it.

| Slice | Distance between the two centrelines | Highest HU between them | One air region? | Note                                                |
| ----- | ------------------------------------ | ----------------------- | --------------- | --------------------------------------------------- |
| 387   | 8.6 mm                               | −940                    | yes             | response plane                                      |
| 384   | 13.6 mm                              | −885                    | yes             | end of the browsable range                          |
| 376   | 25.1 mm                              | −552                    | yes             | last plane with one region                          |
| 375   | 26.3 mm                              | −218                    | no              | first plane with two; 6 mm below the response plane |
| 374   | 27.6 mm                              | +81                     | no              |                                                     |
| 372   | 30.5 mm                              | +115                    | no              | the walkthrough's proposed limit                    |

Air is about −1000 HU and soft tissue about 0. The result is the same at −950, −900 and −850 HU.

- **AI reading.** One elongated column on 387–376, a waist at 375, a thin partition on 374–372,
  two ovals by 371–366. The shipped note says the lumens separate “at about slice 378 to 375”; the
  arithmetic supports 375, not 378.
- **Reviewed.** None.
- **Who uses this junction** (Data). It opens all 17 routes: Lesson 3 example 1 (the two-daughter
  task), Lesson 9, Practice and More routes. Lessons 1 and 2 use only the tracheal lumen above it.

**Options.** None is applied and none is recommended.

|               | A · Keep 387 and add reviewed split teaching                                                                                                                                    | B · Choose reviewed new planes                                                                                                                                                     | C · Introduce bifurcations with another fork                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Means         | 387 stays the response plane, described as a point just below the model's branch point. A short reviewed demonstration of the split, on planes you pick from 376–370, is added. | You pick the demonstration planes and the response plane or planes for this junction. That is an exception to the 5 mm rule, or a new rule.                                        | Lesson 3 example 1 becomes another existing fork. The tracheal junction stays as it is on the routes.                           |
| Evidence      | The split is on planes 375–370. Every route can already browse there.                                                                                                           | The same planes. Two separate lumens exist there to mark.                                                                                                                          | Existing forks: junction-10 (RML → RB4 / RB5), junction-3 (LMSB → LLL / LUL), junction-6 (LLL → LB6 / basal). None is reviewed. |
| For           | No saved draft is lost. Routes unchanged. Smallest change.                                                                                                                      | The example shows what its title says. One first junction, the same everywhere.                                                                                                    | Only one lesson changes.                                                                                                        |
| Against       | The learner still marks inside a shared column.                                                                                                                                 | Widest reach. Needs a new source version. The rule stops being uniform.                                                                                                            | Avoids the carina question rather than answering it. Routes still open on 387. The new fork needs its own review.               |
| Touches       | Lesson 3 example 1.                                                                                                                                                             | Lesson 3, Lesson 9, Practice, More routes.                                                                                                                                         | Lesson 3.                                                                                                                       |
| Saved drafts  | None invalidated, if it is added outside the signed exercise data.                                                                                                              | 14 of 21 draft signatures change; 16 if the export regenerates this junction's crop. Those drafts are kept for recovery, not resumed. Old marks must not be re-read on new planes. | 1 of 21.                                                                                                                        |
| Your question | Is 387 acceptable as a proximal reference, and which planes show the split?                                                                                                     | Which planes for the demonstration and for each response? In Lesson 3 only, or on the routes too?                                                                                  | Which fork, and is it sound enough to carry the introduction?                                                                   |

Under any option: should the note's “about 378 to 375” be corrected?

## OD-02 — The lucency beside the left main bronchus (slices 352–348)

**Question. What is the neighbouring/merging lucency, and what is the accurate explanatory
caption?**

Lesson 1's second interval follows the left main bronchus from 352 to 348 with generic captions.
The lesson's rule says a nearby lucency that is not continuous with the airway is a different
airway.

- **Data.** On 360–351 a separate air region lies to the patient's left and anterior of the left
  main bronchus; the two centrelines are about 34 mm apart at 352. The airway graph places
  **edge 21** in it. That edge's raw source label is “LUL” and its authored name is “LUL division ·
  Left upper division bronchus”. The two regions become one at slice 350 (at −900 HU) or 349
  (at −950 HU). The lesson's five planes are therefore exactly the planes on which they join. The
  interval was placed by rule, not by inspection.
- **AI reading.** A small round lucency beside an elongated lumen on 360–353, a tail at 352, a neck
  on 351–350, one lumen on 349–345.
- **Reviewed.** None. The lucency is deliberately not named here: the graph label is a model label.
- **Yours.** What the structure is, and the caption. You could caption the interval as it is, move
  it above the join (cranial of 353), or keep it and teach the join. A caption invalidates no draft;
  moving the interval changes Lesson 1's signature (1 of 21).

## OD-03 — Names that repeat, and provisional a/b letters

**Question. Which duplicate/source labels may remain as source labels, and which require reviewed
nomenclature or revised a/b assignment?**

Node and edge numbers are the stable technical identity. Parent, Daughter A and Daughter B are the
neutral display identity; A and B are the source's option order, not a screen position. Only the
anatomical name (the raw source label or the authored name) is in question.

| Example | Node · parent edge       | Daughter A          | Daughter B           | Raw source label      | Name the module shows         | Where learners meet it         |
| ------- | ------------------------ | ------------------- | -------------------- | --------------------- | ----------------------------- | ------------------------------ |
| RB1 a/b | 14 · e13                 | e28 · more anterior | e29 · more posterior | RB1 on all three      | A = RB1b, B = RB1a (authored) | Lesson 4 ex. 1; RS1 routes     |
| RB5 a/b | 20 · e19                 | e40 · more cranial  | e41 · more caudal    | none on the daughters | A = RB5a, B = RB5b (authored) | Lesson 6; RS5 routes           |
| RB3a    | 16 · e15                 | e32 · more cranial  | e33 · more caudal    | RB3 on all three      | RB3a for all three            | Lesson 7 ex. 1; RS3 routes     |
| RB4     | 19 · e18                 | e38 · more anterior | e39 · more posterior | RB4 on all three      | A = RB4 (unnamed), B = RB4a   | Lesson 5 ex. 2; RS4 route      |
| LB6     | 11, 25, 52 · e10, 23, 50 | e22, e49, e101      | e23, e50, e102       | LB6 on all            | LB6 for all                   | Lesson 8 (three); LS6 routes   |
| LB9     | 53 · e51                 | e103 · more cranial | e104 · more caudal   | LB9 on all            | LB9 for all                   | LS9 route (Lesson 9, Practice) |

- **Data.** The raw labels name territories. The a/b letters were authored by an AI session from
  the textbook and each daughter's patient-space direction, with a written basis per edge. No name
  was added or changed here.
- **AI reading of the textbook's text.** p. 27: B1a dorsal, B1b ventral; B3b ventral, B3a lateral.
  pp. 46–47: B5a horizontal, B5b caudal; B4 divides into B4a and B4b. These agree with the stated
  basis. They describe typical anatomy, not this patient.
- **Yours.** Whether each a/b assignment holds for this patient; whether the unnamed siblings
  (edge 14 beside RB3a, edge 38 beside RB4a) should be named; whether LB6 and LB9 descendants need
  finer names. Display-only naming invalidates nothing; changing a code in the export changes every
  signature that includes that route.

One error to know about: the shipped, NOT REVIEWED junction-20 text says RB5 “is only about 0.5 mm
long”. In the graph that edge is 13.2 mm long; 0.4 mm is its craniocaudal extent. Not changed here.

## OD-04 — The four patterns and direction reversal

**Question. How should the four patterns and direction reversal be introduced?** In four parts:
the taxonomy; whether each example fits its region; whether a reversal should be taught earlier;
whether any lesson should be reordered or replaced.

- **Data: the book is available.** Prompt 04 held this item because the textbook was not in
  Local-Data. It is on this machine, outside Local-Data, at
  `/Users/russellmiller/Projects/textbooks/Interventional Pulmonology/bronchial branch tracing.pdf`.
  Its text layer was read for locators. Its figures were not looked at.
- **Data: taxonomy.** Printed p. 7 introduces “four patterns of tracing the bronchus”: one vertical
  pattern and three for a route nearly parallel to the axial images. The module's names and order
  match.

| Pattern                                    | Book locator               | Lesson | Module examples                                |
| ------------------------------------------ | -------------------------- | ------ | ---------------------------------------------- |
| Vertical                                   | p. 7; Figs. 1.12–1.13      | 4      | RB1 → RB1b / RB1a; RLL → basal / RB6           |
| Horizontal–horizontal                      | pp. 7–10; Figs. 1.14–1.16  | 5      | RML → RB4 / RB5; RB4 → RB4 / RB4a              |
| Horizontal–vertical                        | p. 10; Fig. 1.17           | 6      | RB5 → RB5a / RB5b (twice)                      |
| Horizontal–oblique                         | pp. 11–12; Figs. 1.18–1.20 | 7      | RB3a → RB3a / RB3a; LUL division → LB3 / LB1+2 |
| Caudal, then cranial (not a fifth pattern) | pp. 15–17; Figs. 1.24–1.26 | 8      | LB6, three divisions                           |

- **Data: sequence.** Standard axial comes first throughout. A daughter first turns back against
  the direction of travel in Lesson 3 example 2 (LLL → LB6), five lessons before Lesson 8 teaches
  it. Prompt 04 added a short primer there. Lesson page pointers match the text layer except
  Lesson 7's figure range and Lesson 1's unconfirmed page.
- **AI reading.** The book's own examples differ from the module's, so whether each module example
  fits its pattern is open (RLL → basal / RB6 under “vertical” is one to look at). The book's
  caudal-then-cranial section also says the relation between the two B6a daughters is _opposite_
  between the axial branch diagram and the bronchoscopic view; Lesson 8 does not say this. The
  book's “left superior segment” is read by the module as the upper division, and “the angle of the
  spur” is used without a definition.
- **Two storyboards.** Neither is applied and neither reorders lessons. (1) At Lesson 3 example 2,
  turn the existing primer into a short captioned demonstration of that same LB6 division.
  (2) In Lesson 8, add the book's diagram-inversion point with the pp. 15–17 locator. Wording
  changes invalidate no draft; replacing an example changes that lesson's signature.

## OD-05 — CT-to-parent-view correspondence

**Question. Are the current CT-to-parent-view correspondence and opening labels anatomically
useful and appropriate for teaching?**

Three frames are kept distinct. Frame 1 is the native CT in patient space. Frame 2 is the learner's
CT display, a screen operation. Frame 3 is the modelled parent camera, which is defined in frame 1
and never follows frame 2.

|                           | Central fork · junction-1 (Lesson 3)                       | Subsegmental fork · junction-14 (Lesson 4)                     |
| ------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------- |
| Frame 1 · parent          | Trachea, edge 0, point on slice 408                        | RB1, edge 13, point on slice 401                               |
| Frame 1 · Daughter A      | edge 1 (source code RMSB, “more right”), slice 387         | edge 28 (source code RB1b, “more anterior”), slice 422         |
| Frame 1 · Daughter B      | edge 2 (LMSB, “more left”), slice 387                      | edge 29 (RB1a, “more posterior”), slice 424                    |
| Frame 2 · lesson default  | standard axial: anterior up, patient right on screen left  | the same                                                       |
| Frame 2 · regional preset | left–right reflection: anterior up, patient right on right | 90° counterclockwise: patient left up, anterior on screen left |
| Frame 3 · camera          | 8.0 mm proximal to node 1, looking caudally                | 8.0 mm proximal to node 14, looking cranially                  |
| Frame 3 · top of view     | anterior                                                   | patient left                                                   |
| Frame 3 · screen right is | patient right                                              | posterior                                                      |
| A / B project to          | screen right / screen left                                 | screen left / screen right                                     |

- **Data.** The module's own pages report these poses, and both equal the pinned fixture. Letters
  follow the source order, sit at each daughter's model response point, and are drawn only when
  that point is in line of sight. In both examples the regional preset display and the camera share
  the same on-screen patient directions; the default standard axial differs by a reflection, or by
  a quarter turn. The roll is one rule per region, not a universal anterior-up rule.
- **AI reading.** At the tracheal division the two letters sit near the mouths of two openings. At
  RB1 they sit close together near the centre of a small lumen.
- **Reviewed.** None. A letter on a modelled opening is a model annotation.
- **Yours.** Whether the letters mark the real openings; whether each region's roll is the
  convention to teach; whether to keep letters at subsegmental forks. Changing them invalidates no
  draft.

## OD-06 — Lumen comparison (proposal)

**Question. Is there sufficient reviewed anatomical evidence to support any future qualitative
lumen comparison policy?**

Today's comparison is a distance in millimetres from the learner's mark to model centreline points,
with the stated caveat that it cannot say which lumen contains a mark. The module can carry a
faculty-reviewed annotation with a contour, but no exercise has one. **On the evidence, no: there
are no reviewed contours or wall annotations.** No classifier and no threshold is proposed.

## OD-07 — More routes (proposal)

**Question. Should More routes retain a distinct revisit role, be merged into Practice, or be
re-scoped later?**

More routes is four routes on the same CT (LS5, RS3, RS8, LS3). All four are also Practice targets
and two are also in Lesson 9. It runs on the Practice host, scores and withholds nothing, and keeps
its own saved draft. Prompt 04 presents it as “Optional: 4 revisit routes, same CT”, and `/assess`
stays for old links. Merging or changing the list retires that saved draft. No change is proposed.

## Separate from this packet: a runtime defect to fix before Prompt 06

The magnifier slider reaches 4×, but the saved view allows at most 2.5×. A learner who magnifies
above 2.5× and reloads loses that lesson's local draft. It predates Prompt 04, has been reproduced
at 3×, and is unrelated to these decisions. It was not re-run or changed here: nothing about the
magnifier, the draft schema or the parser was touched.

## What is missing

- Any attributable human review: no reviewed plane, contour, landmark, opening position, caption or
  name exists for this CT.
- The textbook's figures were not inspected, and the PDF is outside Local-Data.
- Coronal and sagittal reformats were not prepared. They can be, if you want them to choose planes.
- No recorded bronchoscopy of this patient, no reviewed ostium map, and no human learner
  observation. The walkthrough that raised these items was an AI persona.

## Decision record

Leave a row blank until you decide it. A Git merge, a passing check or this packet is not a review.

| ID    | Status       | Decision | Reviewer and role | Date | Approved scope and limits |
| ----- | ------------ | -------- | ----------------- | ---- | ------------------------- |
| OD-01 | NOT REVIEWED |          |                   |      |                           |
| OD-02 | NOT REVIEWED |          |                   |      |                           |
| OD-03 | NOT REVIEWED |          |                   |      |                           |
| OD-04 | NOT REVIEWED |          |                   |      |                           |
| OD-05 | NOT REVIEWED |          |                   |      |                           |
| OD-06 | NOT REVIEWED |          |                   |      |                           |
| OD-07 | NOT REVIEWED |          |                   |      |                           |

## Baseline

Base: `origin/main` at `ca8b767ec0eaf63491bee4884763c83c0870382a`, 40 commits past the post-merge
smoke SHA `6586d5168a55e55863652dcef338135505d072d0`; none touches Branch Tracing, the teaching CT
or the airway graph. The CT, graph and label hashes match the manifest, all 236 exported planes are
pixel-identical to the native planes, and all 183 exported points agree with the CT. Those checks
tie the evidence to its sources; they are not anatomy validation. Evidence images stay in
Local-Data: none is in Git and none was uploaded.
