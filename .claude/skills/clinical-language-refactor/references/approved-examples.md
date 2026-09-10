# Approved examples — the voice target

These pairs are real. They come from the peripheral-imaging pass,
[PR #169](https://github.com/russellmiller49/Interventional-Pulm-Education-Project/pull/169), merged
on 2026-09-10, which the owner accepted as the model for later passes. What was accepted is the
**voice and the method**: the rewritten items there are still `reviewStatus: 'draft'`, awaiting
physician subject-matter review, so their clinical content is the module's and not verified
teaching. Owner rulings from later passes go at the end — that is how the next pass learns.

## Terminology the imaging pass settled

These replacements are for imaging and navigation copy. Several do not transfer: ECMO keeps
**sweep**, for example.

| Before — analogy or software voice                    | After — clinical term first                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| where the beam is aimed; the aim; one ray             | C-arm projection; obliquity; cranial or caudal angulation; "a single projection collapses depth"                               |
| how wide it is; close the field                       | collimation (physical collimation, not electronic cropping)                                                                    |
| how time is sampled; three clocks                     | pulse rate and pulse width; image lag; temporal resolution                                                                     |
| display enlargement; held image                       | display zoom (versus acquisition magnification); last-image hold                                                               |
| the map; anatomy has a timestamp; the target vanished | planning CT; CT-to-body divergence; navigation target; loss of lesion visualization; repeat localization                       |
| sweep; orbit; provenance                              | DTS acquisition and limited-angle reconstruction; CBCT spin and rotational acquisition; what the reconstruction was built from |
| the sampler; sampling component; hardware             | biopsy tool, needle tip, side-cutting window, forceps jaws, cryoprobe active segment; tool-in-lesion                           |
| tissue all round; tissue on one side; nothing         | concentric, eccentric, or no lesional radial EBUS view                                                                         |
| "Five things you can change"                          | Fluoroscopy controls — with exposure factors named as monitoring                                                               |
| "The one table": what you see → where in the chain    | Troubleshooting table: what you see → likely cause → what to consider                                                          |

## Sentence pairs

Each keeps the proposition and adds nothing the module had not already established.

1. **A control named the way the console names it.**
   - Before: "where the beam is aimed" — changes "Which ray crosses the target, and therefore what
     overlaps it on the image"; does not change "Where the tool is. A view change alters the
     evidence, not the needle."
   - After: "C-arm projection" — changes "which anatomy is superimposed on the lesion. Obliquity
     rotates the C-arm around the patient; cranial or caudal angulation tilts it along the body
     axis"; does not change "where the tool is. Changing the projection changes what the image
     shows, not the position of the needle."
   - The geometry the analogy only hinted at is now stated, and the limit survives intact.
2. **Collimation, with its limit.**
   - Before: "Which structures lie on a given ray. A narrow field cannot remove a rib from the ray
     it shares with the target."
   - After: "what is superimposed on the lesion. Tighter collimation cannot remove a rib that
     shares the lesion's projection."
3. **A finding described the way a clinician describes it.**
   - Before: "The target is hidden by a rib, the heart or the diaphragm while the tool is crisp."
     Likely cause: "the patient — superimposition on one ray".
   - After: "The lesion is obscured by a rib, the cardiac silhouette or the diaphragm while the tool
     is sharp." Likely cause: "anatomical superimposition in this projection".
4. **The planning CT versus the lung today.**
   - Before: "The map was drawn at one moment; the lung has a timestamp of its own, and tracking can
     be exact while the map is stale."
   - After: "The planning CT records one moment; the intraprocedural lung can differ from it even
     while navigation tracking is accurate."
5. **An objective that names what is being distinguished.**
   - Before: "Distinguish a planning-map mismatch from loss of tracking or inadequate target
     coverage."
   - After: "Distinguish CT-to-body divergence from navigation registration error and from
     inadequate imaging coverage."
6. **The mechanism in one clinical sentence.**
   - Before: "Each pixel is one ray, so a single image cannot say how far apart two things on that
     ray are."
   - After: "A single projection collapses depth, so it cannot show how far apart two superimposed
     structures are."
7. **Three causes named instead of counted.**
   - Before: "A target can be hard to see for three different reasons, and only one of them is fixed
     by more photons."
   - After: "Lesion conspicuity can be limited by quantum noise, scatter or superimposition, and
     only one of them improves with more photons."
8. **A limit kept as a limit.**
   - Before: "map-relative hardware location"
   - After: "The catheter reached the navigation target; the lesion and needle–lesion relationship
     are unconfirmed." Navigation success is not upgraded to lesion confirmation.
9. **Specific where the section already establishes it.**
   - Before: "No control on the C-arm moves a lung back. A new measurement of the current anatomy
     does."
   - After: "No C-arm control restores an atelectatic segment. Intraprocedural imaging of the
     current anatomy does." The section is about atelectasis, so naming it adds no new finding.

## A title held back

The owner's title table proposed "Projection, superimposition, and parallax". The section shipped
as "Projection, superimposition, and depth", because parallax is its keyed answer and titles are
pre-commit surfaces. A brief decides terminology; it does not override the answer-leak rule.

## What the imaging pass learned

- Ids, keys, choice order, sources, critical flags and prerequisites stayed unchanged, so saved
  progress, answer-position tests and plausibility tables held.
- The clinical phases (Plan · Localize and optimize · Confirm · Sample and reconfirm · Radiation
  safety · Integrated cases) regroup an unchanged order; `IMAGING_PHASES` checks at import that they
  tile it exactly once.
- The analogy-named spine became a secondary physics layer, "How the image is formed": the precise
  statement renders first and the analogy follows as a one-line aid. Only one surface — the
  image-formation caption — numbers the components.
- Clinical rewording made the key the longest option in 29 of 38 item uses; the pass rebalanced
  that to none before running the tests.
- A component checklist shown before the tomosynthesis prediction leaked "angular coverage"; the
  import-time validator caught it.
- In the `imaging-questions` section, the deny patterns `/map-relative/i` and `/hardware location/i`
  gave way to one matching the new keyed phrasing ("the needle–lesion relationship is
  unconfirmed").
- A source grep missed a template-literal "stop 2 of 6"; the rendered-text scan of the hub and all
  19 sections found it.
- A claim with no source — a radial EBUS depth of "a few millimetres" — was dropped rather than
  restated, and listed for the owner.
- Files owned by Codex took string-literal changes only, each named in the PR.

## Owner rulings from later passes

Record each ruling as: module · location · before · after · accepted or rejected · reason · PR.
Keep the rejected pairs too; they stop the next pass from proposing them again.

_None yet._
