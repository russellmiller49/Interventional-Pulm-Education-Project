# BBT-PRE-REVIEW-01 — first-junction source reconciliation

**Finding:** BBTF-01, "First bifurcation does not demonstrate a visible split."
**Status:** reproduced · technical error ruled out · learner-facing limitation contained · **anatomical
teaching mismatch UNRESOLVED and held for the owner / anatomy reviewer (OD-01).**

Nothing in this batch changed a response plane, a branch identity, a coordinate, a model point or
any source file under `geometry/`. The containment is a statement of the existing limitation at a
better time.

---

## 1. What the first bifurcation currently is

| Item                         | Recorded value                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Exercise                     | Lesson `continuity` ("Follow the airway through a bifurcation"), example 1: `local('central-right', 'junction-1', 'bifurcation')`           |
| Source volume                | `public/branch-tracing/native-v1/manifest.json` · `sourceSha256` `572afc5bf6b2d80b28439e0397ad4e24e4eb6dfb2630780593259e081ae0a29b`         |
| Source airway graph          | `sourceGraphSha256` `68226a87928135f8be1435c78774f455dab8f792c085509100aa6c21304c18f4` (identical in `geometry/branch-decisions.json`)      |
| Volume geometry              | 512 × 512 × 636, spacing 0.689453125 / 0.689453125 / **0.5 mm**, origin LPS (−182.1552734375, −374.1552734375, −368.5), window −1000/400 HU |
| Native indexing              | `sliceZ(slice) = −368.5 + 0.5 × slice`; exported axial PNGs cover slices 240–475 (236 files)                                                |
| Model node                   | node 1, `junctionLps` z = −172.4206 → slice **392.2**                                                                                       |
| Parent response point        | Trachea, source edge 0, slice **408**, pixel (247.4439, 317.4077), sampled HU −1024                                                         |
| Daughter A response plane    | RMSB, source edge 1, slice **387**, pixel (240.6285, 315.7026), sampled HU −1009, source direction "More right"                             |
| Daughter B response plane    | LMSB, source edge 2, slice **387**, pixel (253.0077, 316.6606), sampled HU −1014, source direction "More left"                              |
| In-plane daughter separation | 8.6 mm on slice 387                                                                                                                         |
| Local browsable interval     | **384 to 411**, derived in `content/local-exercises.ts` as `[min(levels) − 3, max(levels) + 3]` clamped to the route range                  |
| Demonstration sequence       | Frames 408 → 387, captioned; the two model rings first appear together on 387                                                               |

### Consumers of this same division

- `continuity` local lesson, example 1 (the exercise above).
- `orientation` local lesson, `local('central-right', 'junction-1', 'viewpoint')` — same-lumen form,
  which asks only for the parent lumen and is not affected by the two-daughter question.
- Every full route whose first checkpoint is `junction-1`: the Practice routes, the More-routes
  (`/assess`) set and the route lessons all open on the Trachea → RMSB/LMSB division at slice 387.
- `content/junction-feedback.ts` packet `junction-1` (BBT-02 pilot, NOT REVIEWED).
- `docs/gap-remediation/bbt/BBT-02-junction-packet.md`, §"junction-1".

---

## 2. The four kinds of evidence, kept apart

1. **Native image evidence (measured in this batch).** Along the straight line between the two model
   locators, every sample stays air density from slice 395 down to 376 (peak ≤ −780 HU; no sample
   above −400 HU). A first soft-tissue rise appears at 375 (peak −435 HU) and a frank partition at
   374–372 (peak −50 to +65 HU, 48–71 of 200 samples above −400 HU). Decoded from the shipped PNGs
   with the manifest window; regression test:
   `__tests__/first-junction-source.test.ts`, "no soft tissue separates the two main-bronchus
   locators anywhere in the browsable interval".
2. **Provisional graph / reference samples.** Slice 387 is where the source exporter's own first
   post-node sample sits on edges 1 and 2. Its slice, patient-space point, native pixel and sampled
   HU are mutually consistent, and it lies within 0.5 mm of where those edges' centrelines cross the
   plane. These are centreline samples, not lumen boundaries — as `local-exercises.ts` already
   states.
3. **Authoring-session interpretation.** The BBT-02 packet's reading, "one confluent column on
   392–381, separation at about 378 to 375", is an authoring reading recorded in
   `JUNCTION_FEEDBACK_OBSERVATION` (Claude, 2026-09-14) and in the BBT-02 packet document. My
   measurement in (1) agrees with it and narrows the partition onset, along that one line, to about
   375–374. **That is still an authoring measurement, not a reviewed annotation.**
4. **Attributable reviewed annotation.** **None exists** for this division. `exercise.review.status`
   is `provisional`; the BBT-02 packet is marked NOT REVIEWED; `OWNER_DECISIONS.md` OD-01 is open.

---

## 3. Was there a technical error to repair?

**No.** Three checks, all now covered by tests:

- **Indexing.** Across all 183 distinct source points that carry a sampled HU, the PNG value at
  `(slice, pixel)` reproduces the exporter's own sample with a mean absolute error of **0.6 HU**. A
  one-slice shift in either direction degrades that to **33 HU**, and two slices to 66 HU. The
  shipped slice indexing is exact; there is no off-by-one.
- **Source identity.** `branch-decisions.json` and the native manifest carry the same
  `sourceSha256` and `sourceGraphSha256`; the exercise's own `teaching.sourceSha256` /
  `graphSha256` come from that manifest. No second volume or graph is involved.
- **Wiring.** The response planes are not authored constants. They are read from
  `checkpoint.decision.options[i]`, whose slice/lps/pixel agree with each other and with the
  interpolated crossing of that daughter's own edge. The browsable interval 384–411 follows
  mechanically from those planes plus the ±3-slice margin.

So **387 is not a mis-wired number.** It is the source graph's first sample after the node, on a
scan where the carina has not yet divided the column at that level. Replacing it with 375, or
extending the interval toward 372, would be choosing a new anatomical response point — exactly what
this task is not authorised to do, and what OD-01 exists to decide.

---

## 4. What was changed instead (containment only)

- `content/junction-feedback.ts` gains an `entryLimitation` field. For `junction-1` it restates, in
  the packet's own already-recorded terms, that the two main bronchi share one air column throughout
  the browsable interval, that the separate lumens appear at about 378–375 below it, that this is an
  authoring reading pending faculty review, and that an unresolved response is a reasonable record.
  A second note was added for `junction-6`, whose LB6 response plane the packet likewise records as
  having no wall resolved between the two candidates.
- That note is shown **before the task**: in the local lesson during the demonstration and marking
  phases (`LocalCtLesson`), and beside the junction diagram on every route that reaches this
  division (`CtJunctionTeaching`, used by Practice, More routes and the route lessons).
- The lesson is not disabled, not replaced by disclaimer text, and the reference / unresolved /
  skip paths are unchanged: "Show reference", "Lumen unresolved here" and "Continue without marking"
  all remain available exactly as before.
- No packet prose, response plane, coordinate, branch identity or review status was edited.

**This is containment, not resolution.** The learner is no longer asked to find two lumens on a
frame that the packet itself says is shared, but the question of what the first bifurcation example
_should_ show is still open.

---

## 5. The exact decision that remains for the owner

**OD-01 (task 05 prepares the packet).** For the Trachea → RMSB/LMSB division on this scan:

1. Is slice 387 intended as a proximal model-reference location rather than a visible two-lumen
   bifurcation? If so, should the exercise keep asking for a mark there at all?
2. Which native frames best demonstrate continuity through the carinal split (the measurements above
   put the first partition between the two locator positions at about 375, established by 374), and
   what should a learner mark on them?
3. Should the local lesson change only its demonstration, also its response planes, or be replaced
   by another already-verified fork?
4. Which reused Practice / More-routes / route-lesson checkpoints should adopt the same reviewed
   change?

Any of those is an anatomical decision with draft-signature consequences: the response planes feed
`draftSignature`, so changing one invalidates existing learner drafts for the affected lessons and
routes, and old marks must not be silently reinterpreted on new anatomy.

No human approval is claimed here. The engineering statement is only that **no technical defect
explains the mismatch**, and that the learner is now told about it before being asked.
