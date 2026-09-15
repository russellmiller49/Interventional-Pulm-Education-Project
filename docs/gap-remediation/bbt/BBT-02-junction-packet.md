# BBT-02 — Five-junction annotation and feedback packet (for faculty review)

**Status: NOT REVIEWED.** Prepared September 14, 2026 on branch `claude/bbt-02` from `034648ad` (BBT-01 merged). Every image statement below is an authoring-session reading of the shipped native-v1 axial PNGs (window −1000 to 400 HU) and is pending faculty review. Nothing here is a clinical annotation, an answer key or an approval. A reviewer who approves one junction approves that junction only.

## What this packet is for

BBT-02 adds junction-level feedback to the local CT lessons of Bronchial Branch Tracing (`/learn/anatomy/branch-tracing`). After a learner checks their daughter marks, the comparison now reports where each mark sits against the model locators on that slice, in millimetres, and, for five pilot junctions, where the two paths diverge, which wall or lumen decides identity, which adjacent slices to revisit, what to look for after an unresolved response, and the daughters' names with a short demonstration and, where the name follows lobar or segmental anatomy, an optional try. The five junctions and their text live in `src/features/bronchial-branch-tracing/content/junction-feedback.ts`; the position comparison is `engine/junction-feedback.ts`; the renderer is `components/JunctionFeedback.tsx`.

Faculty are asked to review, per junction: (1) the continuity and wall statements against the actual slices, (2) whether each model locator lies inside the intended lumen on its answer slice, (3) each explanation as shipped, (4) the revisit intervals, and (5) the naming demonstration and try. Decisions belong in the table at the end.

## How to open the slices

Run the site (`npm run dev:claude`, port 3120), open `http://localhost:3120/en/learn/anatomy/branch-tracing/learn?lesson=<lesson>` and use the CT slice slider, or open `public/branch-tracing/native-v1/axial/<slice>.png` directly. Lessons: junction-1 and junction-6 in `continuity`; junction-10 in `horizontal-horizontal`; junction-14 in `vertical`; junction-20 in `horizontal-vertical`. The authoring contact sheets (crops at 4× to 11× with model locators drawn) are outside Git under Local-Data (see the BBT-02 handoff, evidence location).

## Selection

| Junction    | Lesson (example)          | Level                   | Why it is in the pilot                                                             |
| ----------- | ------------------------- | ----------------------- | ---------------------------------------------------------------------------------- |
| junction-1  | continuity (1)            | Trachea → RMSB / LMSB   | Easy central division; first bifurcation a learner meets                           |
| junction-6  | continuity (2)            | LLL → LB6 / basal trunk | Daughters leave in opposite slice directions; LB6 answer slice lies above the node |
| junction-10 | horizontal-horizontal (1) | RML → RB4 / RB5         | Whole division in one axial plane; in-plane fork decides                           |
| junction-14 | vertical (1)              | RB1 → RB1b / RB1a       | Difficult subsegmental choice; 5–6 mm apart front-to-back, both cranial            |
| junction-20 | horizontal-vertical (1)   | RB5 → RB5a / RB5b       | Two divisions within 1 mm; partial-volume source samples; explicit uncertainty     |

Not included, and therefore still showing only the position comparison and the general explanation: junction-9, -11, -16, -19, -23, -25 and -52 (the other local-lesson divisions) and every full-route junction in Practice and More routes.

## What the feedback does and does not claim

- A distance is a geometric fact on the slice between the learner's mark and a model centreline sample. "Nearer LMSB than RMSB" is reported as such; the text says it is a reason to re-trace, not a verdict, and that it cannot show that a vessel or another structure was taken for the airway.
- Marks are never moved, snapped or replaced. Gold rings are labelled model locators; the learner's marks keep their own label.
- An unresolved response is described as valid; it starts the "Uncertain? Start here" guidance and is neither counted as a failure nor as an identification.
- Naming is shown directly. A try exists for junction-1, -6 and -10 only; choosing any option shows an explanation and records nothing.
- Nothing about the comparison, the navigation or the naming try is stored beyond the learner's existing draft marks.

## Per-junction geometry, readings, shipped text and review questions

### junction-1 — Trachea → RMSB / LMSB

| Item                | Source value                                                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model node          | node 1, LPS z -172.42 mm → slice 392.16                                                                                                            |
| Parent              | Trachea (Trachea), edge 0, reference slice 408, pixel (247.4, 317.4), HU -1024, edge spans slices 392.2–626.6                                      |
| Daughter A          | RMSB (Right main bronchus), edge 1, answer slice 387, pixel (240.6, 315.7), HU -1009, source direction "More right", edge spans slices 365.5–392.2 |
| Daughter B          | LMSB (Left main bronchus), edge 2, answer slice 387, pixel (253.0, 316.7), HU -1014, source direction "More left", edge spans slices 339.2–392.2   |
| Daughter separation | 8.6 mm in-plane on shared slice 387                                                                                                                |
| Crop                | centre (246.8, 316.6), size 90 px                                                                                                                  |

**Why this junction.** The easy central division: large lumens, a familiar landmark, and the first bifurcation of the continuity lesson.

**Authoring image reading (slices 408 → 372, crop 120 px at 4× and 80 px at 6×).** The trachea is a single oval lumen from 408 to about 395, then broadens transversely. From 392 (the model node) down to 381 the two main bronchi appear as one transversely elongated air column with no wall between them; the two model locators sit on opposite sides of its midline. A shallow indentation of the posterior wall appears at about 378, and by 375 to 372 the two lumens are separate ovals with soft tissue (the carina) between them. The answer slice 387 therefore shows one confluent column, and the local interval offered to the learner (384 to 411) never reaches the separation.

**Consequence for the feedback.** Identity on 387 is taught as the side of the midline, with the confirming separation explicitly placed below the interval (full-route practice). An unresolved response is described as reasonable until that view has been seen.

**Review questions for faculty.**

- [ ] Is "one confluent column on 392 to 381; separation at about 378 to 375" an acceptable description of this scan at the −1000/400 window?
- [ ] Is the side-of-midline rule acceptable teaching for a learner marking on 387, and is the revisit range 392 → 384 the right interval to point at?
- [ ] Do the two model locators sit inside the intended halves on 387 (RMSB pixel (240.6, 315.7); LMSB (253.0, 316.7))?
- [ ] Naming try "Which daughter lies on the patient's right?" and both explanations.

**Shipped feedback text (verbatim from `content/junction-feedback.ts`):**

- Where the paths diverge: "The model node for this division sits at about slice 392, 2.5 mm above the answer slice 387. On slices 392 to 381 the two main bronchi still share one transversely elongated air column; on this scan that lucency does not split into two separate lumens until about slice 378 to 375 (authoring reading, pending faculty review). That separation lies below this local interval, which ends at slice 384; the full-route practice shows it."
- Which wall or lumen decides it: "What decides identity on slice 387 is which half of the shared air column the mark sits in. The right main bronchus is on the patient's right, which is screen-left in standard axial display; the left main bronchus is on the patient's left. No wall between them exists yet on slice 387: the carinal ridge becomes a visible soft-tissue partition only on the more caudal slices."
- Revisit 392 → 387: "the single tracheal lumen widening into the shared column, with each model locator staying on its own side of the midline"
- Revisit 387 → 384: "the column staying single and transversely elongated: within this interval the two lumens never separate, so identity here rests on the side of the midline"
- When the RMSB mark sits nearer another locator: "Your RMSB mark sits nearer the LMSB model locator. The two paths separate at the carina, not on this slice: step from 392 down to 384 and watch each model locator keep to its own side; the right half becomes its own lumen on the patient's right (screen-left in standard axial) below this interval. If your mark was placed on the patient's left, it lies in the left-main-bronchus part of the same shared column. The geometry alone cannot say whether that came from the display side or from a deliberate choice."
- When the LMSB mark sits nearer another locator: "Your LMSB mark sits nearer the RMSB model locator. The two paths separate at the carina, not on this slice: step from 392 down to 384 and watch each model locator keep to its own side; the left half becomes its own lumen on the patient's left (screen-right in standard axial) below this interval. If your mark was placed on the patient's right, it lies in the right-main-bronchus part of the same shared column. The geometry alone cannot say whether that came from the display side or from a deliberate choice."
- Uncertain? Start here: "Within this interval the evidence is the side of the midline: check the R and L markers on the display, then step from 392 to 384 and confirm that your candidate stays on one side of the shared column. The confirming view, two separate ovals with the carina between them at about slice 375, lies below this interval; the full-route practice reaches it. Until you have seen it, an unresolved response here is a reasonable record."
- Known (source model): "Source model: the trachea (edge 0) ends at node 1 near slice 392, where the right main bronchus (edge 1) continues more right and the left main bronchus (edge 2) more left."
- Known (source model): "On slice 387 the two model locators are 8.6 mm apart in the axial plane."
- Pending faculty review: "The slice at which the carina first separates the two lumens (about 378 to 375) is an authoring-session image reading, not a reviewed annotation."
- Pending faculty review: "Model locators are centreline samples, not wall contours; a mark anywhere inside the intended half of the column is a valid mark."
- Naming demonstration: "The names follow the side of the patient: RMSB, the right main bronchus, enters the right lung; LMSB, the left main bronchus, enters the left lung."
- Naming demonstration: "In standard axial display the patient's right is on screen-left, so RMSB is the screen-left daughter here. The R and L markers on the CT show the sides for whichever display you use."
- Naming try: "Which daughter lies on the patient's right?" → describes RMSB
  - RMSB: "RMSB lies on the patient's right, screen-left in standard axial display. In the source model it is the daughter that continues more right from the node."
  - LMSB: "LMSB is the daughter on the patient's left, screen-right in standard axial display. The daughter on the patient's right is RMSB. Check the R marker on the CT display before deciding a side."

### junction-6 — LLL → LB6 / L basal

| Item                | Source value                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model node          | node 6, LPS z -207.95 mm → slice 321.09                                                                                                                           |
| Parent              | LLL (Left lower lobe bronchus), edge 5, reference slice 332, pixel (315.3, 311.7), HU -987, edge spans slices 321.1–339.2                                         |
| Daughter A          | LB6 (Left superior segmental bronchus), edge 10, answer slice 326, pixel (321.0, 323.9), HU -1024, source direction "More cranial", edge spans slices 321.1–328.0 |
| Daughter B          | L basal (Left basal bronchus), edge 11, answer slice 313, pixel (324.0, 314.9), HU -1023, source direction "More caudal", edge spans slices 284.5–321.1           |
| Daughter separation | answer slices differ (326 vs 313); in-plane separation of the two answer pixels 6.6 mm                                                                            |
| Crop                | centre (319.6, 317.8), size 90 px                                                                                                                                 |

**Why this junction.** A lobar-level division where the two daughters leave in opposite slice directions, and the second bifurcation of the continuity lesson. The LB6 answer slice (326) lies _above_ the model node (321), which learners tracing caudally do not expect.

**Authoring image reading (slices 332 → 311 at 4×; 329 → 321 at 10×).** The lower-lobe bronchus is a single lumen at 332 to 329. From 328 down to 322 the lucency elongates posteriorly; the LB6 model locator lies in that posterior part and the LLL locator in the anterior part, and no wall between them is resolved on these axial planes at this window (a shallow waist at most). At 321 a single lumen remains (the basal-trunk locator), and from 319 to 311 the basal trunk continues as one round lumen beside its artery.

**Consequence for the feedback.** The packet says plainly that no wall separates the LB6 origin from the parent on 322 to 328, and that the distinction is anterior (descending parent/basal trunk) versus posterior (LB6 heading posteriorly and cranially). The parent edge still crosses slice 326, so a learner who marks the anterior part is told their mark sits nearer the LLL locator, without a claim about why.

**Review questions for faculty.**

- [ ] Is "posterior extension of the same lucency, no resolved wall on 322 to 328" acceptable, or is a wall visible that the authoring session missed?
- [ ] Is it acceptable to tell learners that an unresolved LB6 response is reasonable on these planes?
- [ ] Are the three revisit intervals (332 → 321, 328 → 322, 321 → 313) the right ones?
- [ ] Naming try "Which daughter arises from the posterior wall and runs cranially?" and both explanations; the basal trunk is described as unnamed.

**Shipped feedback text (verbatim from `content/junction-feedback.ts`):**

- Where the paths diverge: "The model node sits at about slice 321. The two daughters leave it in opposite slice directions: LB6 runs posteriorly and cranially, so its answer slice, 326, lies above the node, while the basal trunk continues caudally to its answer slice, 313."
- Which wall or lumen decides it: "On slices 328 to 322 the LB6 origin appears as a posterior extension of the same lucency as the descending lower-lobe bronchus, without a resolved wall between them on these axial planes (authoring reading). What separates the two is position and course: the anterior part of the lucency is the lower-lobe bronchus continuing caudally into the basal trunk; the posterior part is LB6 heading posteriorly and upward. Below slice 321 only one round lumen remains, the basal trunk, lying beside its artery."
- Revisit 332 → 321: "the lower-lobe lumen elongating posteriorly as the LB6 origin joins it, then returning to a single lumen at the node"
- Revisit 328 → 322: "the posterior part of the lucency (LB6) against the anterior part (the descending lower-lobe bronchus)"
- Revisit 321 → 313: "the single basal trunk continuing caudally beside its artery"
- When the LB6 mark sits nearer another locator: "Your LB6 mark sits nearer the lower-lobe bronchus model locator than the LB6 locator. On this scan both lie in one lucency with no wall between them on slice 326, so the distinction is anterior against posterior: LB6 is the posterior part that heads posteriorly and cranially over slices 322 to 328, and a mark in the anterior part is in the parent lumen descending toward the basal trunk. The geometry cannot say whether you chose that part deliberately."
- When the L basal mark sits nearer another locator: "Your basal-trunk mark sits nearer another model locator on slice 313. Below the node at 321 the model has a single lower-lobe lumen here; re-trace from 321 down to 313 and confirm that the lumen you marked is the one continuous with the lower-lobe bronchus rather than a neighbouring lucency."
- Uncertain? Start here: "Step from 328 to 321 one slice at a time and watch whether the posterior part of the lucency shrinks toward the node while the anterior part continues; then go below 321 and confirm that a single lumen remains. If the posterior extension cannot be separated from the parent on these planes, keeping the LB6 response unresolved is reasonable: the origin is oblique and partly in-plane here."
- Known (source model): "Source model: the lower-lobe bronchus (edge 5) ends at node 6 near slice 321; LB6 (edge 10) continues more cranial to slice 328 and the basal trunk (edge 11) more caudal to slice 285."
- Known (source model): "LB6 is the left superior segmental bronchus. 'L basal' is the unnamed basal trunk before its own divisions, not a segment name."
- Pending faculty review: "No wall between the LB6 origin and the lower-lobe bronchus is resolved on slices 322 to 328 in this window: an authoring-session reading pending faculty review."
- Pending faculty review: "Distal LB6 subsegments are not named in this module (no B6a, b or c assignment)."
- Naming demonstration: "LB6 is the superior segmental bronchus of the left lower lobe. It is the first branch of the lower-lobe bronchus and arises from its posterior wall, heading posteriorly and slightly upward."
- Naming demonstration: "The basal trunk is what remains of the lower-lobe bronchus after LB6 leaves; it continues caudally to the basal segments and has no segment name of its own."
- Naming try: "Which daughter arises from the posterior wall and runs cranially?" → describes LB6
  - LB6: "LB6, the superior segmental bronchus, is the posterior, cranially directed daughter. In the source model it continues more cranial from the node."
  - L basal: "The basal trunk is the caudal continuation of the lower-lobe bronchus. The posterior daughter that runs cranially is LB6, the superior segmental bronchus."

### junction-10 — RML → RB4 / RB5

| Item                | Source value                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model node          | node 10, LPS z -215.07 mm → slice 306.86                                                                                                                            |
| Parent              | RML (Right middle lobe bronchus), edge 9, reference slice 307, pixel (192.2, 291.5), HU -1024, edge spans slices 306.8–315.2                                        |
| Daughter A          | RB4 (Right lateral segmental bronchus), edge 18, answer slice 307, pixel (177.0, 285.2), HU -1017, source direction "More posterior", edge spans slices 305.7–307.1 |
| Daughter B          | RB5 (Right medial segmental bronchus), edge 19, answer slice 307, pixel (184.5, 276.3), HU -1010, source direction "More anterior", edge spans slices 306.0–306.9   |
| Daughter separation | 8.0 mm in-plane on shared slice 307                                                                                                                                 |
| Crop                | centre (184.6, 283.9), size 90 px                                                                                                                                   |

**Why this junction.** The in-plane (horizontal–horizontal) division: parent, node and both daughters all lie on slice 307, so slice-stepping alone cannot separate the daughters and the learner must read the in-plane fork.

**Authoring image reading (slices 311 → 301 at 4×; 309 → 304 at 9×).** The middle-lobe bronchus runs as an elongated oblique channel from the hilum forward and laterally over 311 to 307. On 307 the channel widens at a fork: one channel continues laterally (RB4 locator), and a thinner channel turns anteriorly and medially toward the RB5 answer pixel; a soft-tissue wedge sits between them. On 306 to 304 the channels are thinner and partly replaced by adjacent vessels; each daughter is only about a millimetre thick in the slice direction.

**Consequence for the feedback.** The wall that matters is the in-plane wedge at the fork; the packet warns that a channel vanishing on the next slice is not evidence against continuity here.

**Review questions for faculty.**

- [ ] Is the fork position acceptable (RB4 (177.0, 285.2), RB5 (184.5, 276.3) on 307, 8.0 mm apart)?
- [ ] Is the description of RB4 as the lateral, slightly posterior channel and RB5 as the anterior-medial channel acceptable on this scan?
- [ ] Are 311 → 307 and 308 → 305 the right revisit intervals?
- [ ] Naming try "Which daughter is the lateral segmental bronchus?" and both explanations.

**Shipped feedback text (verbatim from `content/junction-feedback.ts`):**

- Where the paths diverge: "The model node sits at about slice 307, and both daughter answer slices are 307 as well: this division lies almost entirely within one axial plane. The parent middle-lobe bronchus runs forward and laterally as an elongated channel over slices 311 to 307, then splits in-plane."
- Which wall or lumen decides it: "Because the course is in-plane, the lumens appear as dark channels rather than round rings. What decides identity is the in-plane fork: the lateral channel (RB4) continues laterally and slightly posteriorly, while the medial channel (RB5) turns anteriorly and medially. The soft-tissue wedge between the two channels at the fork is the wall that matters. Stepping one slice up or down changes the picture more than usual, because each channel is only about a millimetre thick in the slice direction."
- Revisit 311 → 307: "the middle-lobe bronchus as a single oblique channel running forward and laterally toward the fork"
- Revisit 308 → 305: "the fork itself: the lateral channel (RB4) and the anterior-medial channel (RB5) leaving the same parent within about two slices"
- When the RB4 mark sits nearer another locator: "Your RB4 mark sits nearer the RB5 model locator. Both daughters lie on slice 307 only 8 mm apart, so the fork decides: RB4 is the channel that continues laterally (screen-left in standard axial, toward the patient's right chest wall) and slightly posteriorly; RB5 is the channel that turns anteriorly and medially. Re-read the wedge of soft tissue between them on slices 308 to 306."
- When the RB5 mark sits nearer another locator: "Your RB5 mark sits nearer the RB4 model locator. Both daughters lie on slice 307 only 8 mm apart, so the fork decides: RB5 is the channel that turns anteriorly and medially (toward the top of a standard axial display and toward the heart); RB4 is the channel that continues laterally toward the patient's right chest wall. Re-read the wedge of soft tissue between them on slices 308 to 306."
- Uncertain? Start here: "Follow the parent channel from 311 to 307 and note where it widens at the fork. Then, without changing slice, follow each channel away from the fork: one heads laterally (RB4), one anteriorly and medially (RB5). Comparing slices 308 and 306 shows how quickly each channel leaves the plane; a channel that vanishes on the next slice is not evidence against continuity here."
- Known (source model): "Source model: the middle-lobe bronchus (edge 9) ends at node 10 near slice 307; RB4 (edge 18) continues more posterior and lateral, RB5 (edge 19) more anterior and medial, both within about one slice of the node."
- Known (source model): "On slice 307 the two model locators are 8.0 mm apart in the axial plane."
- Pending faculty review: "The in-plane wedge between the two channels is read from the image by the authoring session, not a reviewed contour."
- Pending faculty review: "RB4 and RB5 are named from the source labels and the textbook; the fork position is a centreline sample and may sit a pixel or two from the visible spur."
- Naming demonstration: "The middle lobe has two segments: RB4, the lateral segmental bronchus, and RB5, the medial segmental bronchus. The names describe where each goes: lateral toward the chest wall, medial toward the heart."
- Naming demonstration: "In this source model RB4 continues more toward the patient's right (lateral) and posterior, and RB5 more anterior and medial."
- Naming try: "Which daughter is the lateral segmental bronchus?" → describes RB4
  - RB4: "RB4 is the lateral segmental bronchus. In the source model it is the daughter that continues more laterally and posteriorly."
  - RB5: "RB5 is the medial segmental bronchus, the daughter that turns anteriorly and medially. The lateral segmental bronchus is RB4."

### junction-14 — RB1 → RB1b / RB1a

| Item                | Source value                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Model node          | node 14, LPS z -160.63 mm → slice 415.75                                                                                                                                       |
| Parent              | RB1 (Right apical segmental bronchus), edge 13, reference slice 401, pixel (194.4, 309.5), HU -1004, edge spans slices 393.2–415.7                                             |
| Daughter A          | RB1b (Right apical bronchus, anterior subsegment), edge 28, answer slice 422, pixel (188.9, 303.6), HU -1021, source direction "More anterior", edge spans slices 415.7–431.6  |
| Daughter B          | RB1a (Right apical bronchus, posterior subsegment), edge 29, answer slice 424, pixel (189.0, 311.7), HU -984, source direction "More posterior", edge spans slices 415.7–438.3 |
| Daughter separation | answer slices differ (422 vs 424); in-plane separation of the two answer pixels 5.6 mm                                                                                         |
| Crop                | centre (191.6, 307.7), size 90 px                                                                                                                                              |

**Why this junction.** The difficult local daughter choice at subsegmental level: both daughters continue cranially, are only 5 to 6 mm apart front-to-back, and are 2 to 3 mm lumens beside bright vessels.

**Authoring image reading (slices 401 → 426 at 4×; 415 → 424 at 11×).** RB1 is a single round ring with a visible bright wall from 401 to 415, staying in almost the same place. At 416 the ring elongates front-to-back; from 417 to 420 it develops a waist; at 421 to 422 a thin wall separates an anterior lumen (RB1b locator) from a posterior lumen (RB1a locator); at 424 there are two separate rings. The accompanying pulmonary vessels are bright and lie lateral and medial to the airway.

**Consequence for the feedback.** The division is taught as a ring → figure-of-eight → two rings sequence; the feedback tells a learner whose RB1b mark sits nearer the RB1a locator that the separation is anteroposterior. The a/b labels are shown with an explicit note that the assignment is a source topology decision pending review; no naming try. The RB1a source air sample (−984 HU) is flagged as less air-dense.

**Review questions for faculty.**

- [ ] Is "ring at 415, waist 417 to 420, wall at 421 to 422, two rings at 424" acceptable?
- [ ] Do the RB1b (anterior) and RB1a (posterior) locators sit inside the visible lumens on 422 and 424?
- [ ] Is the anterior/posterior a/b assignment acceptable for teaching, or should it be shown as "anterior subsegment / posterior subsegment" only?
- [ ] Are 401 → 415 and 416 → 424 the right revisit intervals?

**Shipped feedback text (verbatim from `content/junction-feedback.ts`):**

- Where the paths diverge: "The model node sits at about slice 416. Both daughters keep running cranially: RB1b is marked on slice 422 and RB1a on slice 424, and on those slices they sit only about 5 to 6 mm apart, one in front of the other."
- Which wall or lumen decides it: "This is a vertical division seen end-on. The single RB1 ring on slice 415 elongates front-to-back over slices 416 to 420, develops a waist, and by slices 421 to 422 a thin wall separates an anterior lumen from a posterior one; on 424 there are two separate rings (authoring reading). The anterior lumen is RB1b and the posterior lumen RB1a in the source labelling. The bright structures beside them are pulmonary vessels: an airway here is a dark lumen with a thin bright ring, not a bright dot."
- Revisit 401 → 415: "the single RB1 ring staying in almost the same place from slice to slice"
- Revisit 416 → 424: "the ring elongating, forming a waist, then splitting into an anterior and a posterior lumen"
- When the RB1b mark sits nearer another locator: "Your RB1b mark sits nearer the RB1a model locator. The two lumens are separated front-to-back, not side-to-side: RB1b is the anterior lumen (toward the top of a standard axial display) and RB1a the posterior one. Step from 416 to 424 and watch which lumen your candidate becomes as the waist closes into a wall."
- When the RB1a mark sits nearer another locator: "Your RB1a mark sits nearer the RB1b model locator. The two lumens are separated front-to-back, not side-to-side: RB1a is the posterior lumen (toward the bottom of a standard axial display) and RB1b the anterior one. Step from 416 to 424 and watch which lumen your candidate becomes as the waist closes into a wall."
- Uncertain? Start here: "Go back to slice 415, where there is one ring, then step up one slice at a time. The first slice on which you can see a complete wall between an anterior and a posterior lumen is where the two identities become separable; before that slice an unresolved response is reasonable. At 2 to 3 mm these lumens are only a few pixels wide, so use the airway-detail zoom."
- Known (source model): "Source model: RB1 (edge 13) ends at node 14 near slice 416; RB1b (edge 28) continues more anterior and RB1a (edge 29) more posterior, both toward more cranial slices."
- Known (source model): "The RB1a/RB1b assignment follows the source labels: posterior and anterior daughters of the labelled right apical bronchus (nomenclature review)."
- Pending faculty review: "The slice at which the wall first separates the two lumens (about 421 to 422) is an authoring-session image reading pending faculty review."
- Pending faculty review: "The source air sample for RB1a (−984 HU) is less air-dense than for RB1b (−1021 HU), which suggests partial-volume sampling of the smaller posterior lumen; the model locator may not sit in the centre of the visible lumen."
- Pending faculty review: "Subsegmental naming (a/b) is a source topology assignment awaiting faculty review; it is shown, not asked."
- Naming demonstration: "RB1 is the apical segmental bronchus of the right upper lobe. Its two subsegments are named a and b: in this module's source labelling RB1a is the posterior daughter and RB1b the anterior daughter."
- Naming demonstration: "These labels are shown directly. Subsegmental letters vary between references and this assignment is pending faculty review, so no naming try is offered here."
- Naming uncertainty: "Subsegmental a/b assignment pending faculty review."

### junction-20 — RB5 → RB5a / RB5b

| Item                | Source value                                                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model node          | node 20, LPS z -215.48 mm → slice 306.05                                                                                                                             |
| Parent              | RB5 (Right medial segmental bronchus), edge 19, reference slice 307, pixel (184.4, 276.0), HU -989, edge spans slices 306.0–306.9                                    |
| Daughter A          | RB5a (Right medial bronchus, subsegment a), edge 40, answer slice 309, pixel (181.7, 262.1), HU -896, source direction "More cranial", edge spans slices 306.0–309.9 |
| Daughter B          | RB5b (Right medial bronchus, subsegment b), edge 41, answer slice 301, pixel (177.5, 262.9), HU -954, source direction "More caudal", edge spans slices 299.2–306.0  |
| Daughter separation | answer slices differ (309 vs 301); in-plane separation of the two answer pixels 3.0 mm                                                                               |
| Crop                | centre (180.9, 269.1), size 90 px                                                                                                                                    |

**Why this junction.** The second difficult choice: two divisions within about 1 mm (RML → RB4/RB5 at about 307, then RB5 → a/b at about 306), daughters leaving in opposite slice directions, and the least air-dense source samples of the five (−896 and −954 HU). This is the junction where explicit uncertainty matters most.

**Authoring image reading (slices 310 → 299 at 4×; 309 → 301 at 11×).** On 309 to 308 the RB5a locator sits on a thin dark channel rising anteriorly next to a bright vessel. On 307 the RB5 parent pixel lies in the anterior-medial channel leaving the middle-lobe bronchus. On 306 to 305 the RB5b locator sits on a small dark spot at the edge of bright vessels; from 304 to 301 it follows a thin dark channel descending posteromedially beside a vessel band. Neither daughter is a clean ring at this resolution; each is separable from its vessel only on some slices.

**Consequence for the feedback.** The packet tells the learner that an unresolved response is the honest record if a lumen cannot be separated from its vessel, cites the export review's partial-volume flag for middle-lobe intervals, and shows the a/b names with their uncertainty; no naming try.

**Review questions for faculty.**

- [ ] Are the RB5a (309, (181.7, 262.1)) and RB5b (301, (177.5, 262.9)) locators inside visible lumens, or should either be excluded from teaching until re-sampled?
- [ ] Is "RB5a rises for a few slices then runs near-horizontally; RB5b descends" acceptable for this scan?
- [ ] Should this junction remain in the pilot at all, or be replaced by a division with cleaner lumens (for example junction-9, RLL → basal trunk / RB6)?
- [ ] Are 309 → 305 and 306 → 301 the right revisit intervals?

**Shipped feedback text (verbatim from `content/junction-feedback.ts`):**

- Where the paths diverge: "The model node sits at about slice 306, less than one millimetre after RB5 itself leaves the middle-lobe bronchus at about slice 307. RB5a is marked on slice 309, above the node, and RB5b on slice 301, below it: the two daughters leave in opposite slice directions."
- Which wall or lumen decides it: "Two divisions happen within about 1 mm here: the middle-lobe bronchus into RB4 and RB5, then RB5 into a and b. What decides identity is the direction each small lumen takes from the anterior-medial channel: RB5a rises for a few slices (a short cranial excursion, then near-horizontal), RB5b descends caudally alongside a vessel. Both lumens are 2 to 3 mm and lie against bright vessels, so the wall of each is only a pixel or two wide."
- Revisit 309 → 305: "the RB5 channel and the small anterior lumen (RB5a) that rises from it over slices 306 to 309"
- Revisit 306 → 301: "the RB5b lumen descending as a thin channel beside its vessel"
- When the RB5a mark sits nearer another locator: "Your RB5a mark sits nearer another model locator on slice 309. RB5a is the small lumen that rises above the node; on 309 it is a thin dark channel next to a bright vessel, and other lucencies nearby belong to neighbouring airways or to lung between vessels. Step from 306 up to 309 and check that your candidate stays continuous with the RB5 channel."
- When the RB5b mark sits nearer another locator: "Your RB5b mark sits nearer another model locator on slice 301. RB5b is the lumen that descends from the node beside its vessel; on 301 other dark channels nearby belong to neighbouring middle-lobe airways. Step from 306 down to 301 keeping the same thin channel in view."
- Uncertain? Start here: "Return to slice 307, find the anterior-medial channel (RB5) leaving the middle-lobe bronchus, then step one slice at a time in each direction. A rising lumen that stays continuous with that channel up to 309 is the RB5a candidate; a descending one down to 301 is the RB5b candidate. If either lumen cannot be separated from the adjacent vessel at this resolution, an unresolved response is the honest record: the export review flags these middle-lobe intervals for partial-volume sampling."
- Known (source model): "Source model: RB5 (edge 19) is only about 0.5 mm long, from node 10 near slice 307 to node 20 near slice 306; RB5a (edge 40) continues more cranial to slice 310 and RB5b (edge 41) more caudal to slice 299."
- Known (source model): "Answer slices: RB5a on 309 (above the node), RB5b on 301 (below it)."
- Pending faculty review: "The source air samples for RB5a (−896 HU) and RB5b (−954 HU) are the least air-dense of the five packet junctions, consistent with partial-volume sampling; the export review already flags middle-lobe intervals for inspection before adopting source points as reference annotations."
- Pending faculty review: "RB5a/RB5b naming is assigned from topology, patient-space course and textbook figures (nomenclature review) and is pending faculty review; it is shown, not asked."
- Pending faculty review: "Whether each lumen is separable from its accompanying vessel on slices 301 to 309 in this window is an authoring-session reading."
- Naming demonstration: "RB5 is the medial segmental bronchus of the middle lobe. In this module's source labelling its subsegments are RB5a, the daughter that first rises and then runs near-horizontally, and RB5b, the daughter that descends."
- Naming demonstration: "Shown directly: the a/b assignment is a source topology decision pending faculty review, so no naming try is offered here."
- Naming uncertainty: "Subsegmental a/b assignment pending faculty review."

## Reviewer decisions

| Junction    | Continuity/wall statements | Locators inside lumen | Explanations | Revisit intervals | Naming       | Decision (approve / amend / exclude) | Reviewer, date |
| ----------- | -------------------------- | --------------------- | ------------ | ----------------- | ------------ | ------------------------------------ | -------------- |
| junction-1  | NOT REVIEWED               | NOT REVIEWED          | NOT REVIEWED | NOT REVIEWED      | NOT REVIEWED | —                                    | —              |
| junction-6  | NOT REVIEWED               | NOT REVIEWED          | NOT REVIEWED | NOT REVIEWED      | NOT REVIEWED | —                                    | —              |
| junction-10 | NOT REVIEWED               | NOT REVIEWED          | NOT REVIEWED | NOT REVIEWED      | NOT REVIEWED | —                                    | —              |
| junction-14 | NOT REVIEWED               | NOT REVIEWED          | NOT REVIEWED | NOT REVIEWED      | NOT REVIEWED | —                                    | —              |
| junction-20 | NOT REVIEWED               | NOT REVIEWED          | NOT REVIEWED | NOT REVIEWED      | NOT REVIEWED | —                                    | —              |

A decision to amend text is applied by editing `content/junction-feedback.ts`; the jest contract `__tests__/junction-feedback.test.ts` re-checks that the edited text still cites the right edges and slices, stays within the browsable interval and introduces no grade or verdict wording. A decision to exclude a junction removes its packet entry; the lesson then shows the position comparison and the general explanation only.

## Expansion after the pilot

Adding a junction means: read its actual slices, write the same seven fields, keep every revisit slice inside the exercise's browsable range, cite the parent and daughter edges, state what is uncertain, decide whether a naming try is anatomically justified, and add it to this packet for review. A good result on these five does not approve any other junction.
