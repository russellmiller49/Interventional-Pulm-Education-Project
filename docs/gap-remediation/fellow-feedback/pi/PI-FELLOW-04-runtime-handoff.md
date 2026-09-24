# PI-FELLOW-04 — Peripheral Imaging: approved Prompt 04 runtime work

Implementation: September 23, 2026. Prepared by Claude (AI implementation).

This batch implements the **approved, non-deferred** runtime work recorded in
[drafts/owner-decisions.md](drafts/owner-decisions.md#recorded-owner-decisions-2026-09-22)
("Recorded owner decisions, 2026-09-22", the authoritative section). It resolves no owner hold, adds
no patient-derived media, changes no rights status and implements no connected case. Every new or
revised question is an AI-drafted sample the owner approved **as a draft**; every figure is the
course's own teaching model or a schematic, labelled as such. **Nothing here is clinical, source,
media or device approval.**

## Scope and baseline

- Governing documents read before implementing: [drafts/README.md](drafts/README.md),
  [owner-decisions.md](drafts/owner-decisions.md), [evidence-needs.md](drafts/evidence-needs.md),
  [question-revision-samples.md](drafts/question-revision-samples.md),
  [media-and-reference-briefs.md](drafts/media-and-reference-briefs.md),
  [connected-cases.md](drafts/connected-cases.md), [PI-FELLOW-03-handoff.md](PI-FELLOW-03-handoff.md),
  [PI-FELLOW-owner-decisions.md](PI-FELLOW-owner-decisions.md),
  [PI-FELLOW-03-sanity-review.md](PI-FELLOW-03-sanity-review.md), `AGENTS.md`, `CLAUDE.md`, and the
  pack at `Interventional-Pulm-Local-Data/module_update_9_19/PI_Claude_Implementation_Pack` (read in
  place, nothing copied).
- Starting SHA **`85acc113be11f9acbd395f49e00fee4b69ceff71`** (`origin/main`, the expected
  baseline). `origin/main` was fetched again before pushing and had not moved, so there was no
  overlap to reconcile.
- Branch `claude/pi-prompt04-approved-runtime`, in a new worktree
  `Interventional-Pulm-Education-Worktrees/claude-pi-prompt04-approved-runtime` created from
  `origin/main` for this task (no occupied worktree was reused).
- Dev server: port **3174**, started from this worktree (`next dev --port 3174 --webpack`); the
  listening process's working directory was checked before each browser run. Playwright ran with
  its own ephemeral browser contexts. The dev server was stopped before the production build, and
  the production smoke test used port 3175 (this worktree's standalone build, stopped afterwards).
  No other server was touched.
- This worktree has no `.env.local` (a read-only mount that is not copied), so `/api/analytics`
  answers 500 on this server. That is the environment, not PI.
- Evidence (logs, screenshots, probe output) is in the session scratchpad, not in Git.

## Implemented

### OD4-01 · Overview audience line

The Overview's audience entry keeps its broad audience sentence and adds the approved text verbatim:
"For physician learners, basic chest CT anatomy and bronchoscopy/navigation experience are helpful.
No prior training in fluoroscopy physics, tomosynthesis, or cone-beam CT is assumed." It replaces
the old line "Chest CT anatomy and bronchoscopy experience are assumed." Nothing gates on it: no
check, enforcement or mastery was added (`components/PeripheralImagingHub.tsx`, `data-hub-prerequisites`).

### OD4-02 and OD4-05 · Question samples and the versioning rule

Seven samples implemented (QS-1, QS-3, QS-4, QS-5, QS-6, QS-7, QS-8). **QS-2 is not implemented**
and the validator is unchanged. Every approved stem, choice and key is verbatim, with typographic
apostrophes; this was checked mechanically against `question-revision-samples.md`. The only
exceptions are the practice 9 situation sentences listed under
[Deviations](#deviations-from-approved-text). The samples give per-choice rationale in two places
(a worked explanation and a distractor table), so each choice's rationale is assembled from those.

| Sample | Where                           | Old identity (kept in the bank, unchanged) | New identity                                                | Key | Old address                        |
| ------ | ------------------------------- | ------------------------------------------ | ----------------------------------------------------------- | --- | ---------------------------------- |
| QS-1   | Section 1 check                 | `choose-1` (still Sections 2 and 4 review) | `imaging-questions-interpretation-v2`                       | b   | —                                  |
| QS-3   | Section 6 check (text variant)  | `signal-interpretation-v2`                 | `signal-interpretation-v3`                                  | c   | —                                  |
| QS-4   | Section 16 check (text form)    | `change-1`                                 | `changing-anatomy-interpretation-v2`                        | b   | —                                  |
| QS-5   | Practice case 9                 | —                                          | **kept** `dts-interpretation-practice-1` (OD4-05 exception) | a   | unchanged                          |
| QS-6   | Integrated case 4               | `case-4`                                   | `case-4-v2` (critical, as before)                           | c   | `assess?case=case-4` → `case-4-v2` |
| QS-8   | Integrated case 5 (image-based) | `case-5`                                   | `case-5-v2`                                                 | a   | `assess?case=case-5` → `case-5-v2` |
| QS-7   | Integrated case 8               | `case-8`                                   | `case-8-v2`                                                 | a   | `assess?case=case-8` → `case-8-v2` |

Versioning and storage:

- A changed stem, choice or key gets a new id; the old item stays in `QUESTION_BY_ID` exactly as it
  was. `signal-interpretation-v2` stopped rendering, so it is kept verbatim as
  `RETIRED_INTERPRETATION_CHECKS` in `content/interpretationChecks.ts`. The legacy record parser
  recomputes a stored choice against the item it names and drops one whose item is gone, so
  removing it would have changed what old records mean.
- `content/cases.ts` still holds exactly eight integrated-case slots. `case-4-v2`, `case-5-v2` and
  `case-8-v2` replace slots 4, 5 and 8. `LEGACY_INTEGRATED_CASE_ADDRESSES` maps each old address to
  its replacement, and the Assess route redirects through next-intl, keeping the locale. The
  validator requires that each legacy address is not a current slot, that its target is one, and
  that the legacy item is still in the bank. Stored progress is not reinterpreted: an opened
  `capstone:case-4` stays under its own id and does not count as opening `capstone:case-4-v2`
  (tested). No storage key, parser or version changed.
- Plausibility tags: `imaging-questions-interpretation-v2` c `reasonable-but-incomplete`;
  `case-4-v2` a `unsafe`, b `reasonable-but-incomplete`; `case-5-v2` c `reasonable-but-incomplete`;
  `case-8-v2` c `reasonable-but-incomplete`. These are the samples' tags; untagged options keep the
  default. `case-4-v2` and `changing-anatomy-interpretation-v2` are management decisions.
- The integrated-case links at the ends of Sections 12, 15 and 18 (`sectionSpecs.ts`) point to the
  new case ids.
- Self-paced contract: every step is still `gate: 'open'`, the explanation is still available before
  an answer, and retry, skip and leave are still there. No score, mastery, attempt count or mandatory
  answer was added.

### OD4-04 · Practice case 9 as a model-evidence case (QS-5)

**Result: implemented truthfully, with one more wording change than the sample (below).** The case
shows a five-panel figure: a projection with the catheter in place, three reconstructed planes (at
the catheter's depth, 18 mm from the lesion centre along the beam; halfway; and through the lesion
centre), and the planning CT through the lesion. The five safeguards:

1. **Labelled.** The first line of the figure says "Teaching model: CT-derived images with an
   authored nodule and a modeled catheter. Not a patient acquisition."
2. **Declared, not defaulted.** Identity `practice:dts-interpretation-practice-1:figure` is declared
   `depicts-the-question` in `content/caseFigures.ts`. A case with no declaration renders no
   figure, so there is no implicit fallback.
3. **Text matches the model.** The model's nodule is in the posterior **left** lung and is a smooth
   sphere, and its catheter runs through lung-density CT with no airway lumen (model-truth test).
   So the situation names no lobe, no lobulated margin and no airway, and the title no longer
   narrates the absence. Choice c's rationale said "the airway around it"; it now says "the
   anatomy around it" (see Deviations).
4. **Neutral rendering.** The planes are drawn from the DTS prior layer in neutral grey. The teal
   used for the prior layer in Section 11 would give the answer away. `dtsModel.ts` gained
   `priorPlanePoint` and `priorPlaneGray`, which the Section 11 view now shares; its teal tint is
   unchanged.
5. **Answer readouts wait.** Where the planes come from ("drawn from the planning CT, which was
   acquired before the catheter was placed …") and what the acquisition contains appear only once
   the learner opens the explanation or checks an answer. The figure's panels show nothing that
   states the answer.

The projection panel is the DTS generator's own acquisition model: its catheter (radius 1.8 mm,
density 8, 18 mm from the lesion plane, from 60 mm short of the lesion centre up to it) summed along
the beam at the CT's spacing. It is not a stored DTS projection. The stored projections pass a
horizontal high-pass teaching filter (`anatomy/dts.json`) that removes most of a horizontal
catheter from any single projection, so none of them can show "a projection with the catheter in
place". Measured on the real atlas, the catheter's centre line is brighter than the rows 8 px above
and below it by 9–28 grey levels at seven points along its length. The reconstructed planes carry no
catheter: the plane through the lesion is byte-identical to the planning-CT panel.

### OD4-04 · Integrated case 5, image-based (QS-8)

`case-5-v2` shows linked thin axial, coronal and sagittal planes of the sampling model (the Section 15
multiplanar view's geometry) at a **new authored geometry**, identity `capstone:case-5-v2:figure`,
declared `depicts-the-question`, labelled "Teaching model: CT context with an authored nodule and a
modeled needle. Not a patient acquisition; the needle's dimensions do not describe a real device."

Verified geometry (lesion-centred model frame, mm; lesion radius 9): tip at **[19, 2, −1]**, needle
along +x, side-cutting window from tip − 14 to tip − 6 along x. Planes: axial z = −1 and coronal
y = 2 (both through the tip), sagittal x = 7 (inside the window and inside the lesion). The model's
own `windowRelationship` readout gives "Sampling window partly intersects the modeled lesion";
the tip is not inside, and lies **10.1 mm beyond the lesion surface**, beyond it along the needle's
own direction. The readouts (window relationship, tip position, and "What this does not establish")
are hidden while the question is open and shown once an answer is checked or the explanation is
opened (rendered, Jest and Playwright tests). The earlier "Tip and window differ" example (window
behind the lesion) was not reused.

### OD4-06 · Section 6 conspicuity set and Section 16 artifact strip

**Section 6** reading steps show a 2 × 2 set on the teaching CT, replacing the cartoon comparison
there. Each panel is computed in the browser with FluoroView's own mapping (HU to attenuation at
80 kVp, line-integral scale 7.5, display smoothstep 0.035–0.92) on the suite's projection geometry.

- **Reference**: frontal, collimated to 200 mm. Model output.
- **Quantum noise · simulated**: the same frame re-read from far fewer photons, using a seeded
  Gaussian approximation of Poisson counts (700 photons per pixel, seed 6), so it draws the same
  way every time. Labelled as illustrating the square-root relation, "not a dose level or a setting".
- **Scatter-related contrast loss · drawn veil**: collimator open to 340 mm plus a uniform veil,
  shifted back to the reference's mean brightness. The shift is a level change only, so the veil's
  contrast loss stays. The caption says "The course does not calculate scatter: this is a drawing of
  its look."
- **Superimposition · another projection**: only the C-arm obliquity changes, to −20°. The printed
  readout gives the soft-tissue-like CT on the target ray: 137 mm frontal and 91 mm at −20°.

The **Section 6 check keeps its fixed Images A and B** (the cartoon pair), since QS-3 is the text
variant and the image variant waits for honest media. The dose-note copy button now uses the shared
PI `CopyTextButton` (same text, same `data-copy-dose-note`).

**Section 16** gets a three-panel strip after "Match the artifact to its cause":
motion (text placeholder: "No image here: the course has no motion model, and no cleared authentic
example is available yet …"), **truncation** (model output), and new dependent opacity (text
placeholder: "No image here: the course's registration model moves anatomy rigidly …"). The
truncation panel masks an axial CT plane outside the CBCT model's own field-of-view cylinder (radius
192 mm), placed off-centre so its edge runs through the lesion centre. It covers **49%** of the
lesion, and its caption says it shows coverage, not how a real volume edge looks. No motion, opacity
or banding image was made. D4's toy DTS motion model and D7's geometry-only banding schematic were
not selected by the owner and were not built. The Section 16 check still shows the registration
model, declared illustrative (`changing-anatomy:example:0`, unchanged identity).

### OD4-08 · Two-axis worked example (option A)

Section 9's step after "A two-axis fluoroscopy technique" shows the CT → two-axis example, all on the
teaching CT with the model's signed angles only. The example was chosen by reading the model; the
model was not changed to fit an example:

| Along the target ray (soft-tissue-like CT) | Tube side            | Detector side | Whole ray |
| ------------------------------------------ | -------------------- | ------------- | --------- |
| Frontal (0°)                               | 35 mm (+5 mm bone)   | **102 mm**    | 137 mm    |
| **−20°** (detector toward patient's left)  | 56 mm (+14 mm bone)  | **35 mm**     | **91 mm** |
| −35°                                       | 102 mm (+16 mm bone) | 34 mm         | 136 mm    |
| +20° (detector toward patient's right)     | 46 mm                | 145 mm        | 191 mm    |

- The frontal view's detector-side path crosses 102 mm of soft-tissue-like density anterior to the
  lesion. −20° clears most of it and gives the shortest whole-ray path of the candidates. Going to
  −35° lengthens the tube-side path instead, and +20° runs the detector side through more of it. The
  figure prints these numbers from the same computation it draws. Brief A proposed candidate lines
  at ±35° and left open which sign clears the density ("The draft does not assume −35°"); read from
  the model, the axial CT draws 0°, −20° and +20°, and the strip compares 0°, −20°, −35° and +20°.
- Beam tilt at −20°: detector side 31 / 35 / 35 / 38 mm at −10°, 0°, +10° and +20°. The range is
  7 mm, within the 10 mm tolerance, so the figure says this lesion needs no tilt in this model. That
  text is conditional on the computed range.
- Tool views: the modeled tool is foreshortened near its axis at −80° (profile fraction 0.14) and in
  profile at −20° (0.91).
- **Sign safeguards.** Every value is written as C-arm obliquity or beam tilt, with the model's
  direction in patient terms ("detector toward the patient's left"). No signed value is given a
  LAO/RAO or cranial/caudal name. Those words appear only in the closing angle note, which quotes
  the course glossary's existing obliquity-and-tilt definition (itself saying the model's values
  are not a console's LAO/RAO or cranial/caudal labels) and adds "Naming these signed angles with a
  console's labels is held for owner review." A test rejects `\b(LAO|RAO|cranial|caudal)\b`
  everywhere else in the figure, and any signed value next to such a word. The axial CT is shown
  radiologically (patient left on image right, anterior up), and each beam line's arrowhead marks
  the detector end. A test checks that every line passes through the lesion, points anterior, and
  swings to the side its sign says. P03-ANGLE stays open.
- The nodule is "in the posterior left lung"; no lobe or segment is named (OD4-11).

### OD4-09 · Fixed and mobile comparison; field sizes equalised

The approved table appears in Sections 13 and 14 (`@fixed-mobile-comparison`). It has five rows
(shared, workflow, configuration, capability, integration), each tied to a block of the module that
already teaches it and to registered sources, with no numbers in any cell. A validator enforces all
three. Under it, a model note says the scenes draw the same detector field and field of view for
both and differ only in mounting, followed by the limit and short citations.

**Field size.** The mobile gantry's 300 mm panel drew a 90 mm-radius field of view against 192 mm for
the fixed gantry. The only origin found is the Codex 3D brief (`docs/peripheral-imaging/codex-3d-brief.md`),
with no source, so no sourced reason exists to teach the difference. `GANTRY_VARIANTS.mobile.panelMm`
is now the model's detector field, the same as fixed and generic. The field-of-view cylinder and
swept envelope are identical for both, and the variants differ only in `mount` (cart vs fixed). No
learner-facing text had described the mobile field as smaller (searched).

### OD4-10 · Team-readiness aid

Section 12's scout step shows the aid (`@team-readiness`). Its first line says what it is not:
"Teaching aid from the Peripheral Bronchoscopy Imaging course. Not an institutional protocol, an
anesthesia protocol, a credentialing standard or a universal pre-procedure checklist. Your
institution's policy governs." Eleven rows under four roles (Bronchoscopist 2, Technologist 3,
Anesthesia 3, Whole team 3). Each row cites the Section 12, 16, 1 or 17 block or takeaway that
already teaches it, and a validator checks the citation exists. **The two organizational-suggestion
rows are not restored**, and a pattern test rejects them. A copy button reuses the Section 18
dose-note pattern (`CopyTextButton`), copying the same lines with the status line first.

### OD4-12 · Practice case 15 floor plan

A schematic above the case (`practice:staff-protection-practice-1:figure`, `depicts-the-question`,
medium `schematic`, labelled "Schematic of this case's room, drawn from its text. Not a scatter
measurement or a dose map."). It shows the table, the tube and the detector, with numbered positions:
1 beside the tube housing, 2 farther along the table on the tube side at the same distance from
the table, 3 across on the detector side. It has no numbers, colour scale, contours or dose words
(tested). The side rule appears only after the explanation opens. The case text is unchanged.

### OD4-03 and OD4-11

Tier 1 only: every image is clearly labelled model output or a schematic, and no Tier 2 or Tier 3
media was added. "Posterior left lung" is used throughout, with no lobe or segment.

## Evidence identities

| Identity                                        | Where                   | Evidence               | Medium                                                      |
| ----------------------------------------------- | ----------------------- | ---------------------- | ----------------------------------------------------------- |
| `practice:dts-interpretation-practice-1:figure` | Practice case 9         | `depicts-the-question` | teaching model                                              |
| `capstone:case-5-v2:figure`                     | Integrated case 5       | `depicts-the-question` | teaching model                                              |
| `practice:staff-protection-practice-1:figure`   | Practice case 15        | `depicts-the-question` | schematic                                                   |
| `signal:conspicuity-set`                        | Section 6 reading steps | reading-step figure    | 2 model output, 2 simulated on the model                    |
| `changing-anatomy:artifact-strip`               | Section 16 reading step | reading-step figure    | 1 model output, 2 text placeholders                         |
| `two-dimensional:two-axis-example`              | Section 9 reading step  | reading-step figure    | model output (axial CT, ray strip, tilt, projections, tool) |

Case figures are declared in `content/caseFigures.ts`. The registry is explicit and validated at
import; an undeclared case renders nothing. Reading-step figures sit on reading steps, not beside a
question, so they declare what they are made of in `content/teachingFigures.ts` instead of a
relation to a question. Their validator requires every simulated panel to say "simulated" or
"drawn", every placeholder to begin "No image here", no console angle names, and learner-copy-gate
compliance. The existing illustrative-only identities (`current-anatomy:example:0`,
`changing-anatomy:example:0`, `staff-protection:example:0`) are unchanged. Authored, learner,
acquired and display state stay separate: no figure reads a learner control or a stored frame.

## Model and asset provenance

No binary asset was added or changed. The figures load the CT through the course's existing, cached
`loadAnatomyVolume` (the loader the suite and CT views already use), so asset delivery in production
is unchanged. Every figure is computed in the browser from the existing
teaching CT (`public/peripheral-imaging/anatomy/ct-atlas.png`, with its baked authored nodule), the
authored sampling and DTS geometry, and the suite's projection geometry (`suiteFrame`,
`projectToDetector`). `lib/ctProjection.ts` is a CPU twin of the suite's DRR. Its allocation-free
trilinear sampler matches `sampleAnatomy`, including −1000 HU outside the volume (tested), and its
projection places a dense sphere where the suite's geometry projects it (tested). `lib/teachingSignal.ts`
holds the two labelled simulations (noise and veil).

**The teaching CT's rights basis (O-CT) is unchanged and unresolved; the release hold stands.** No
text claims it was cleared. Labels say "CT-derived", as the module already does elsewhere.

## Deviations from approved text

Each change was forced either by the module's learner-copy gate or by OD4-04 rule 3 (case text
matches the model):

1. **QS-3 key rationale**: "…and the field is wide: that points to scatter." became "…: the pattern
   fits scatter." The learner-copy gate rejects "points" as grading language.
2. **QS-4 rationale a**: "more photons do not correct inconsistency between projections" became "more
   photons do not undo an inconsistency between projections". The gate rejects "correct"; "undo"
   is the sample's own word in its worked explanation.
3. **QS-5 situation** (id kept): "parked in a subsegmental airway" became "parked near the lesion";
   "the last live fluoroscopic frame, three reconstructed planes through the airway and the lesion,
   and the planning CT at the same level" became "a projection with the catheter in place, three
   reconstructed planes from the catheter's depth to the lesion, and the planning CT through the
   lesion". The model has no airway along the catheter, and its projection panel is a model
   projection rather than a fluoroscopic frame. The title "Catheter absent from the DTS planes"
   became "A parked catheter and the DTS planes", because it narrated what the learner is meant to
   find. The label reads "…an authored nodule and a modeled catheter" instead of "…and tool".
4. **QS-5 rationale c**: "moves the catheter and the airway around it together … The planes that
   show that airway would show the catheter" became "…the anatomy around it … that anatomy …" for
   the same reason. The argument is unchanged, and no stem, choice or key changed.

The optional QS-5 softening ([O], "could not be missed" → "would be expected on the planes near its
depth, at least blurred") was **not** applied to the key's rationale, because the owner did not
select it. The softer statement appears only in the figure's revealed readout, as the model's own
description.

## Deferred by owner (preserved)

1. Tier 3 patient-derived media: none added.
2. Teaching-CT rights basis (O-CT): unchanged, no clearance claimed, release hold preserved.
3. QS-2: not implemented; validator unchanged.
4. Authentic motion, new-dependent-opacity and banding examples: text placeholders only; nothing
   realistic manufactured.
5. Image variants of the Section 6 and 16 checks and of practice 14: checks stay text-answerable,
   and practice 14 is unchanged text.
6. LAO/RAO and cranial/caudal labels: not mapped; model signed values only.
7. Fixed/mobile field-size difference: none taught; field equalised.
8. Local workflow suggestions in the readiness aid: the two rows stay removed.
9. Lobe or segment for the teaching nodule: none named.

## Still open, intentionally untouched

- Practice cases 1–3 keep the shared contrast cartoon exactly as it was (OD4-02 iii); tested.
- The IC2 distractor treatment is not extended to integrated cases 1, 6 and 7 (OD4-05 item 4).
- Connected cases (OD4-07): **not implemented**. There is no connected-case code, route, namespace,
  hidden component or dead production path.

The P03 owner packets in [PI-FELLOW-owner-decisions.md](PI-FELLOW-owner-decisions.md) (rEBUS
wording, P03-ANGLE, pulse ownership, CBCT provenance, VESPA clause, drafted definitions) are all
still open, and none was resolved or worked around.

## Tests and validation

Failures and reruns are listed as they happened.

**Jest, PI + PI routes** (`--runInBand`, the PI-FELLOW-03 pattern):

| Run                                | Result                                                                                      | Note                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| baseline, before any edit          | 45 suites / 410 tests pass                                                                  | `evidence/before/jest-baseline.log`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| during implementation              | import-time validation failures, then fixed                                                 | (a) The learner-copy gate rejected the approved QS-3 ("points") and QS-4 ("correct") wording in separate runs, as a ZodError from the shared item schema when the items were first built; wording changed as listed under Deviations. Later, the figure validator threw at import on my own Section 9 caption ("the arrow points …"), which failed 10 of 45 suites in one run; the caption became "with its arrowhead at the detector end". (b) `routes.test.tsx` could not parse next-intl's ESM once the Assess page imported `redirect`; the test now mocks `@/i18n/navigation` as the module's other route tests do. |
| expected pinned-value failures     | 4 tests updated, each with a comment                                                        | `integrated-cases.test.tsx` (case ids), `suiteModel.test.ts` (mobile field of view 90 → equal to fixed), `teaching-clarity.test.ts` (Section 1's transfer-origin row, since `choose-1` is no longer Section 1's check), `example-evidence-framing.rendered.test.tsx` (Section 16 stem fragment). Each asserted a value this batch intentionally changes.                                                                                                                                                                                                                                                                 |
| new suites, first runs             | 4 failures, each investigated                                                               | `model-truth`: catheter contrast measured against one side only was 9 < 10 at one column, because the anatomy's background slopes across the line. The measure now takes both sides at seven columns (each side ≥ 6, their mean ≥ 10; measured 9–28). `case-figures`: a regex meant to catch "derived from …" matched the mandated label "CT-derived"; narrowed to "derived from". `teaching-signal`: two test inputs were wrong (0 HU sits inside the attenuation ramp, so the check now uses 80 HU; −1000 HU quantizes to −997.6, so the check now uses −1100 HU).                                                     |
| after implementation               | **65 suites / 608 tests pass** (PI + routes + learning-module)                              | `jest-pi.log`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| final, after the last source edits | **PI + PI routes: 50 suites / 470 tests pass**; learning-module: 15 suites / 139 tests pass | Baseline 45 / 410 plus the five new suites. The +1 test over the previous run is the new check that practice 9 claims no airway in any text the learner reads (`jest-final-pi-routes.log`, `jest-final-lm.log`).                                                                                                                                                                                                                                                                                                                                                                                                         |

New Jest suites: `model-truth.test.ts` (decodes the real atlas and holds every model claim above to it),
`prompt04-questions.test.tsx`, `case-figures.rendered.test.tsx`, `teaching-figures.rendered.test.tsx`
and `teaching-signal.test.ts`.

**Full repository Jest** (`npx jest`): 963 suites passed; **9 failed**, none of them PI. Eight
failing tests and one collection error: `scripts/ip-preference-cards/check-brochure-intake-static-exposure`,
`scripts/ip-preference-cards/us-status/…/safety-boundaries`, `scripts/training-apps.test.mjs` (a
`node --test` file that Jest collects and finds no test in), `bronchial-branch-tracing/contracts`,
`critical-care/accessibility`, `critical-care/curriculum-sequencing`, `critical-care/learner-copy`,
`literature/dedicated-supabase/foundation-manifest` and `src/lib/board-review-html`. **The same nine
suites fail with the same test names on an untouched export of `85acc113`**, so they predate this
batch. The export had one extra failure, a missing `public/fluoroview` GLB that I left out of the
export. The full run came before the last three PI-only edits (practice 9 rationale c, the Section 9
label, the figure CSS); the PI and learning-module suites were rerun after them (table above).

**Type-check** `tsc --noEmit` (8 GB heap): exit 0, run again after the last TypeScript edit. **ESLint** on every changed
`.ts/.tsx`, `--max-warnings=0`: clean. **Prettier**: 16 files reformatted after the browser pass, and
`--check` is clean. **`git diff --check`** and a trailing-whitespace/CRLF scan of new files: clean.

**Playwright, Prompt 04 tests** (`playwright.peripheral-imaging.config.ts`, base URL
`http://localhost:3174`, 10 tests: practice 9, redirects plus case 5 reveal, the three changed
checks, and a surfaces test at seven conditions):

| Run | Result                           | What failed, and what was done                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 8 passed, 2 failed               | (a) The practice-9 "no lobe" assertion read `body.textContent`, which includes the RSC payload carrying practice 1's own "right lower lobe". It now reads the case's rendered text (`[data-practice-case]` innerText). (b) 320 × 740 at 200% text: the Overview's audience list overflowed. The cause was a pre-existing word ("bronchoscopists,") at min-content; the list now wraps anywhere (`[overflow-wrap:anywhere]`).                                                                     |
| 2   | 1 failed (320 × 740 @ 200%)      | A `<wbr>` alone had not fixed (b); the wrap rule above did.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 3   | 1 failed (320 × 740 @ 200%)      | The phone canvas-size criterion (≥ 200 px) failed at 194.6 px. The criterion is now a fraction of the figure's content width (≥ 0.85) on phones, still with a real image signal.                                                                                                                                                                                                                                                                                                                 |
| 4–5 | 1 failed each (320 × 740 @ 200%) | A case figure measured wider than the viewport. Measured on practice cases 1 and 8, which have **no figure**, the case-decision block itself is 325–327 px wide against a 256 px article at this condition. The shared answer buttons' min-content sets that width. The figure now wraps text anywhere, and at enlarged text the test holds every figure **inside its case decision** and every descendant inside the figure. Strict viewport-fit checks remain at 100% text on every condition. |
| 6   | **10 passed**                    | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

**Playwright, full PI suite** (all 73 tests, including the 63 existing):

| Run    | Result                              | Note                                                                                                                                                                      |
| ------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| full 1 | **73 passed**, 0 failed, 9.2 min    | The Section 9 label edit below reached the dev server by hot reload while tests 10–11 ran; the Prompt 04 tests ran after it. Rerun on unchanged code for a clean record.  |
| full 2 | stopped by me after 12 of 12 passed | Stopped to make the readability fix below, which the screenshot review found. Not a failure.                                                                              |
| full 3 | **73 passed**, 0 failed, 9.1 min    | Final code; nothing was edited during the run. The code was then committed unchanged as `62fe2778`: lint-staged made no edits. This is the result the PR is submitted on. |

**Screenshot review** of every capture (all seven conditions, page and figure-element shots) found
three things, all fixed before full run 3:

1. The Learn-page captures were taken after a later check had scrolled back to the top, so some
   showed the simulator instead of the figure. The spec now scrolls the figure back into view before
   capturing and also saves an element screenshot of every figure. Two captures caught an existing
   simulator mid-load (Section 9 at 390 × 844, and the dock's image notice on Section 12's scout step
   at 1024 × 768). A probe found the Section 9 scene ready about 2.7 s after load, at both 390 and
   1024 px wide. Section 12's scout-step scene was not timed. Neither scene is changed here, and the
   new figures do not depend on either.
2. At 320 × 740 with 200% root text, the Section 16 strip's placeholders left about 77 px for their
   captions (the figure's 1rem padding plus the placeholder's 0.7rem padding, doubled by the
   enlarged rem), so words broke every four or five letters. The figure's inline padding is now
   `min(1rem, 4vw)`, and nested boxes give up their inline padding when the figure is narrower than
   24rem. Measured after: 162 px of text, about 11 characters a line, and the figure's height at
   that condition fell from 9,965 px to 5,692 px. At 1440 × 900 nothing changed (placeholder padding
   0.7rem, figure padding 16 px).
3. The Section 9 figure's label said "the CT anatomy is real teaching data". The module says
   "CT-derived" everywhere else, and "real teaching data" could be read as a claim about the CT's
   unresolved rights, so it now reads "Teaching model: CT-derived anatomy with an authored nodule
   in the posterior left lung; no lobe is named. …".

Browser conditions checked for every new surface: 1440 × 900, 1280 × 900, 1024 × 768, 390 × 844,
320 × 740, 1280 × 900 at 200% root text, and 320 × 740 at 200% root text. Each is checked for the
Overview audience line; the three case figures (ready, labelled, answer readouts hidden, contained,
canvases drawn with image signal, the answer control reachable and uncovered); the Section 6, 9, 12,
13, 14 and 16 figures and aids (visible, labelled, tables inside their figure, the stage inside the
viewport); and Help on Section 9 (no clipped or unreachable text). Screenshots of each view and of
each figure element are in the scratchpad evidence.

**Production build**: `npm run build` on commit `62fe2778`, after the dev server was stopped: **exit
0**. It ran the training-app builds, contentlayer (24 documents), the critical-care and cardiac
asset validators, `next build --webpack` (compiled in 85 s, TypeScript passed, 776 of 776 static
pages) and `prepare:standalone`. The build's only warnings are pre-existing and outside PI: a
`mermaid`/`langium` dynamic `require` reached through board-review, `@contentlayer2` webpack-cache
notices, and site-wide `metadataBase` notices (this worktree has no site-URL environment). All
build outputs are gitignored.

**Production smoke test** (the standalone server on port 3175, started from this worktree's
`.next/standalone`):

- The Overview returns 200 with the new audience sentence, and the old line is gone.
- `assess?case=case-4`, `case-5` and `case-8` return **307** to their `-v2` addresses, and
  `/es/…?case=case-5` keeps `es`. `case-5-v2`, practice 9, Section 9 and an unchanged case
  (`case-2`, no redirect) return 200 with their new text.
- The teaching CT is served (200, 4.2 MB).
- In a browser against the production bundle, every new figure reached `ready` with real image
  content, and no page error occurred. Practice 9 drew 5 of 5 canvases; case 5 drew 3 of 3 planes,
  with its readouts absent before reveal; Section 6 drew 4 of 4; Section 9 drew 3 of 3; practice
  15's plan rendered as SVG.

## Limitations and owner notes

- **Baseline, not changed (shared styles):** at 320 × 740 with 200% root text, every practice and
  integrated case's decision block is about 70 px wider than the article, figure or not. The answer
  buttons use the shared `learning-module` lesson-shell styles. Fixing it means either a PI-local
  override or a shared-style change; the shared stage is out of scope here, so it is reported
  rather than changed.
- **Section 6 worked demonstration at −35°** (existing, unchanged): in this model −35° moves the
  soft tissue on the target ray from the detector side to the tube side (137 → 136 mm total) rather
  than reducing it. The new figure uses −20° (137 → 91 mm). The demonstration's text makes no claim
  of improvement, so it is honest, but the section now shows two different "changed views". Whether
  to align them is an owner choice.
- The model nodule is faint on every projection, so the two-axis projections mark where it
  projects and make no claim that it becomes conspicuous.
- Seen while building practice 9's figure: the Section 10 DTS projection thumbnails come from the
  filtered atlas, so they show almost none of the horizontal tool (the filter noted above). This is
  not changed here.
- QS-4's key is about 1.7× the longest distractor, and QS-6's about 1.3×. The approved text is kept;
  noted for the owner's review of length cues.
- The owner packet's §4 verification tasks are not part of this batch and were not done, with one
  incidental exception. The two-axis example's reading of the target-ray strip also answers task 2
  (which signed obliquity clears the density anterior to the lesion: −20° in this model, not −35°).
  It is recorded here for the connected-case lane and not implemented. Task 1 (CHK-S10, whether the
  Section 10 check's DTS image shows depth elongation) is still unverified.
- New owner decisions arising: whether to align the Section 6 demonstration's −35° with the
  figure's −20°; whether to adopt the QS-5 [O] softening in the key's rationale; and whether to
  address the 200%-text case-decision width (shared styles).

## Files

New (under `src/features/peripheral-imaging/`): `lib/ctProjection.ts`, `lib/teachingSignal.ts`,
`content/caseFigures.ts`, `content/teachingFigures.ts`, `content/cbctReferences.ts`,
`components/figures/{ArtifactCauseStrip,CaseFigure,CbctReferenceAids,ConspicuityComparison,CopyTextButton,DtsAbsenceFigure,FigureCanvas,SamplingWindowCaseFigure,StandingPositionsPlan,TwoAxisWorkedExample}.tsx`,
`components/figures/{teachingFigureModel,useFigureComputation,useTeachingData}.ts`,
`components/figures/figures.module.css`,
`__tests__/{model-truth,teaching-signal}.test.ts`,
`__tests__/{prompt04-questions,case-figures.rendered,teaching-figures.rendered}.test.tsx`; this handoff.

Edited: `src/app/[locale]/peripheral-imaging/assess/page.tsx`,
`src/app/[locale]/peripheral-imaging/routes.test.tsx`, `e2e/peripheral-imaging.spec.ts`, and under
`src/features/peripheral-imaging/`: `data/questions.ts`,
`content/{interpretationChecks,cases,stageItems,sectionSpecs,microCases,learningActivities,teachingExamples,warningInventory}.ts`,
`components/{PeripheralImagingHub,ImagingCaseDecision,ImagingCaseActivity,ImagingIntegratedCaseActivity}.tsx`,
`components/stage/{ImagingTeachingColumn,TeachingPanels}.tsx`,
`components/suite/{suiteModel,dtsModel}.ts`, `components/suite/views/TomosynthesisView.tsx`,
`__tests__/{suiteModel,teaching-clarity}.test.ts`,
`__tests__/{integrated-cases,example-evidence-framing.rendered}.test.tsx`.

Nothing outside PI was touched: no EBUS, BBT, CRRT, MCS, hemodynamics or MV file; no global auth,
header or footer; no shared learning-module or stage file; no Prompt 05 storage; no deployment
configuration. No release flag, access tier or storage key changed.
