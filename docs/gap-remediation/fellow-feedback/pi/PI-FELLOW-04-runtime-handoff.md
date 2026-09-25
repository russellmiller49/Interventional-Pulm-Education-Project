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

## Post-sanity-review repair (September 24, 2026)

Prepared by Claude (AI implementation). The independent sanity review of head
`a18c349f5f04103cab3526b366fbe3a5057a40e4` returned **SANITY REVIEW: NOT READY TO MERGE** with five
bounded findings (F1–F5). This section records the repair of those five and two small optional
items the owner allowed. Everything above this section is the historical implementation record and
is left as written; where the repair supersedes a statement above, this section says so.

### Scope and baseline

- Pre-flight: worktree clean, branch `claude/pi-prompt04-approved-runtime`, HEAD `a18c349f`
  (unchanged since review), `origin` fetched, and no process was running from this worktree.
- Commits: the repair is `d6bcc7be` (source and tests); this section is the commit after it.
- Specification: the owner's repair brief, which summarises the reviewer's findings. The reviewer's
  full report was not in the repository or on the PR, so the brief is what was worked to.
- Dev server: port **3126** (the tracked `claude-imaging` launch entry,
  `next dev --port 3126 --webpack`), and the listening process's working directory was checked to
  be this worktree. As before, this worktree has no `.env.local`, so the site root `/en` fails in
  the Supabase proxy. The PI routes are unaffected.
- Bounded: no connected case, no Prompt 05 or 06, no media-rights or clinical-hold resolution, no
  shared CSS and no shared learning-module or stage file. Nothing outside
  `src/features/peripheral-imaging/`, `e2e/peripheral-imaging.spec.ts` and this handoff was edited.

### F1 · Section 9's beam lines are now the rays the table measures

**Problem.** The path lengths in the strip were measured along the divergent ray from the X-ray
source through the lesion to the detector (`suiteFrame` / `rayThrough`). The axial figure instead
drew the parallel beam direction translated through the lesion. Frontally the two differ by 6.9°
on the axial image.

**Repair** (`components/figures/teachingFigureModel.ts`, `TwoAxisWorkedExample.tsx`,
`content/teachingFigures.ts`):

- `targetRayGeometry(obliquity, tilt)` returns the ray's source, target (the lesion's centre) and
  detector hit from `rayThrough(suiteFrame(obliquity, tilt), LESION_CENTER)`. `targetRay` measures
  along exactly that object and now carries it as `geometry`.
- `axialRayLine(obliquity, geometry)` projects the source, the lesion and the hit onto the axial
  image (z dropped) and clips the projected segment to the image (Liang–Barsky, 3-unit margin, so
  the detector-end arrowhead stays visible).
- `twoAxisModel` builds each candidate line from **the strip row's own `geometry`**, and throws if a
  candidate has no strip row. The old `axialBeamLine` is removed. The numbers in the strip are
  unchanged: they were always measured along this ray; only the drawing was wrong.
- Model values: frontally the source is at [0, −720, 0], the lesion at [85, −20, −30] and the hit at
  [145.7, 480, −51.4] (the suite's model frame, isocentre at the origin, mm). The ray descends 30 mm from the source to the
  lesion, so it lies in no single axial slice. On the image each line differs from its parallel beam
  by 6.92° (0°), 6.77° (−20°) and 6.20° (+20°).
- Axial caption, replacing "Each line is the central ray … the X-ray tube is at the other end":
  "Each line is the target ray whose path lengths the table gives: from the X-ray tube's focal spot,
  through the centre of the modeled lesion, to the detector, with its arrowhead at the detector
  end. It is drawn as its projection onto this axial image. The tube lies off the image beyond the
  line's other end, and the ray crosses this slice only at the lesion. The rays spread out from the
  tube and the lesion lies off the isocentre, so each line's angle on the image differs by a few
  degrees from its C-arm obliquity." The canvas's accessible label now says "the axial projection
  of the target ray from the X-ray tube through the lesion to the detector".
- Label placement: the −20° ray now leaves the image near its right edge, where its label was
  clipped (seen in the first repair screenshots). Each label now slides back along its own line
  until it fits inside the image.

### F2 · Practice case 9 (QS-5): the inference is bound to this teaching case

**Kept:** id `dts-interpretation-practice-1`, stem, all three choices, key `a`, and the decision.
Only choice a's rationale and the takeaway changed. That is within the OD4-05 exception already
recorded for this item.

**Final choice-a rationale:** "In this teaching figure, the projection stands for the current
acquisition and deliberately contains the modeled catheter, while the three planes match the
planning CT and contain no catheter. In this model, planes reconstructed from the current
acquisition would carry that catheter, at least blurred on the planes near its depth. So, in this
authored example, the planes were drawn from the planning CT, and their margin describes the lesion
as it was when that CT was acquired. The inference rests on what this figure shows: catheter
absence alone is not a universal sign of prior-derived content on every DTS, reconstruction or
display system."

**Final takeaway:** "Before reading a margin from a displayed plane, identify whether it was
reconstructed from the current acquisition or drawn from an earlier study. In this teaching case,
the current acquisition contains the catheter and the prior-derived planes match the planning CT
without it, so here the missing catheter identifies those planes. Outside this case, catheter
absence alone is not a universal sign of prior-derived content on every DTS, reconstruction or
display system. Finding the catheter elsewhere in the volume would show only that some of the
display was acquired now, because a reconstruction can carry a live catheter over a contour from
an older scan."

Removed wording: "could not be missed", "cannot be absent from planes built from that
acquisition", and "Its absence marks prior-derived content". No product is named. The learner-copy
gate refuses the word "test", so the sentence says "not a universal sign" instead of "not a
universal provenance test". This supersedes the earlier note under
[Deviations](#deviations-from-approved-text) that the [O] softening was not applied: the rationale
is now narrower than either the sample or the [O] option. The figure's revealed readouts ("Where
these planes come from, in this model") were already model-bound and are unchanged.

### F3 · CHK-S10: Section 10's check is written, with no image beside it

**Problem.** The check (`dts-1`: "…structures are elongated in the depth direction…") sat beside
one reconstructed plane with a depth slider. That plane cannot show elongation through depth, and
the check said "Inspect the image". This is the open verification task 1 noted under Limitations
above, now closed.

**Repair:**

- In `content/learningActivities.ts`, Section 10 (`dts-acquisition`) now ends with
  `...finish('record', 'case')`, the existing path the five other conceptual checks use. The
  check therefore renders no suite pane, no fixed example and no image banner, and its instruction
  is the existing scenario wording ("Read the scenario. Choose what the evidence supports and what
  remains uncertain.").
- In `content/teachingExamples.ts`, the check's authored image state (`independentValues`,
  sweep 20 / plane 10) is removed, because nothing draws it any more.
- The teaching column beside every check printed "Choose the interpretation this image and its
  acquisition context support". The browser screenshot review found it on the now-written
  Section 10 check. `components/stage/ImagingTeachingColumn.tsx`, a PI-local component, now says
  "Choose the interpretation the written scenario supports" on a check with no visual
  (`visual === 'case'`), and keeps the image wording everywhere else. This also corrects the same
  line on the five checks that were already text-only (Sections 1, 11, 13, 14 and 19) and on the
  closing rounds, none of which shows an image. Checks with an image, including the three
  illustrative identities, keep their wording.
- Not relabelled `illustrative-model`: the three Prompt 01 identities (`current-anatomy:example:0`,
  `changing-anatomy:example:0`, `staff-protection:example:0`) are exactly as before, and tested.
- Unchanged: the `dts-1` item, its id `dts-acquisition:dts-1`, stem, choices and key. The reading,
  guided and comparison steps of Section 10 keep their DTS images (tested step by step). The
  transfer round was already a text case. The explanation-before-answer, retry, skip and self-paced
  behaviour of the check is unchanged (tested).

### F4 · Section 9's tool views are drawn whole, at one scale

**Problem.** Each view was drawn at a fixed 1.1 units/mm with the tip at the frame centre. The
side-on tool (99.1 detector mm) therefore started at x = −29.0 in a 160-unit frame, so 26.6% of it
was clipped.

**Repair:** `toolViews(obliquities)` fits every compared view together: one scale (now 1.23
units/mm) and one tip position (131.8, 60) chosen from the union of all the views' extents (tool
ends and lesion circles), inside a 10-unit margin of `TOOL_VIEW_FRAME` (160 × 120). Nothing is
fitted per view, so a shorter line still means a more foreshortened tool; profile fractions (0.14
and 0.91) and the model geometry are unchanged. The side-on tool now runs from x = 10 to 131.8. The
caption adds "Both views are drawn at the same scale, with the tool's tip at the same place." The
SVG carries `data-tool-scale`, so the browser test can hold both views to one scale.

### F5 · QS-4: the key is no longer the long option

The key option (b) now reads: **"Agree a stable, tolerable breath hold or ventilation pause with
anesthesia."** That is 11 words; the distractors are 11 and 7 (before: 19, 11, 7). The readiness
and stopping detail it used to carry was already in its rationale, which is unchanged: "…Plan the
breath hold with anesthesia: agree the intended state, who announces readiness and the stopping
criteria before it begins. Anesthesia safety governs the breath hold."

Unchanged: key `b`, clinical meaning, id `changing-anatomy-interpretation-v2`, and the historical
`change-1`, which stays in the bank. The id is kept by the owner's instruction. The item has never
been released (PR #279 is unmerged), so no stored record can have been written under the old
wording. This closes the length-cue note under Limitations above for QS-4. QS-6's 1.3× length was
not in the finding and is untouched.

### Section 6 · −20° and −35° told apart (optional, added)

Under the conspicuity set's "another projection" readout, and only while the model's numbers show
the shortening, the figure now says: "This −20° comparison shortens the model's soft-tissue path on
the target ray; the later −35° example shows a different pattern, with the overlap redistributed
along the ray." The −35° is read from the section's own "CT superimposition · changed view" example
(`SIGNAL_LATER_DEMONSTRATION_OBLIQUITY`), so it cannot name a different angle. Neither angle is
recommended, and the numbers are not forced to match. `model-truth` holds the second half to the
CT: at −35° the detector-side soft-tissue path falls and the tube-side path grows, each by more than
30 mm, while the whole-ray total stays within 10 mm of frontal.

### Readiness aid at 320 px with 200 % text (optional, PI-local, changed)

The aid's words broke every few letters at this condition. The figure itself is 190 px wide there,
which is set by the shared stage and is not changed here. In `figures.module.css`, under a
`@container (max-width: 16rem)` rule scoped to the aid (`.readiness`):

- the rows drop the 1.1rem list indent;
- the status line's box keeps its amber edge with a slimmer inset (`padding-inline: 0.3rem 0`).

"Section" and its number are joined by a no-break space. Measured at 320 × 740 with 200% text: row
text 127 → 162 px wide, mid-word breaks 27 → 6, status line 31 → 25 lines, aid height 8,193 →
7,198 px, no overflow. At 1440 × 900 and at 390 × 844 with normal text nothing changes. At 320 px
with normal text the figure is 15.9rem, so the rule applies there too.

`hyphens: auto` was tried first and made the result worse (40 breaks), because this Chromium has no
hyphenation dictionary. It was not kept. No content, font size or shared component changed, and no
width is fixed. The known shared case-answer/header overflow at this condition is not touched.

### Preserved (re-verified by the suites below)

- **Question identity:** old definitions, new versioned ids, legacy redirects with locale, no
  storage or progress reinterpretation (`prompt04-questions`, the redirect Playwright test).
- **Integrated case 5:** tip [19, 2, −1], radius 9 mm, partial window intersection, tip 10.1 mm
  beyond the surface, readouts hidden until check or explanation, and hidden again on retry.
- **Section 6:** labels, seeded noise, schematic veil, model-derived alternate projection.
- **Section 16:** truncation model and the "No image here" placeholders.
- **Fixed/mobile:** equalised field; the 300 mm mobile value is not back.
- **Readiness aid:** the same 11 source-backed rows; the two organisational rows stay out.
- **Practice 15:** geometry-only floor plan, no dose-map semantics.
- **Prompt 01–03:** the contracts and holds.

### Tests added or changed

New:

- `model-truth.test.ts`:
  - "draws each beam as the axial projection of the exact ray its path lengths were measured on
    (F1)". It checks, for each line:
    - identity with the strip row's `geometry`;
    - that the geometry equals `suiteFrame`'s source and `rayThrough`'s hit;
    - re-measured tube-side and detector-side soft tissue equal the printed values;
    - the ray is not in one slice;
    - projected source, lesion and hit pixels;
    - collinearity of source, lesion, hit and both drawn ends (< 1e-6);
    - their order along the ray;
    - off-image source and hit;
    - drawn ends inside the margin;
    - a 3–10° difference from the parallel beam.

    It also checks the frontal lean equals atan(85/700).

  - "fits both tool views in their frame at one shared scale and anchor (F4)": equal scale and tip,
    every endpoint and lesion circle inside the margin, drawn-length ratio equal to the model's.
  - "the later demonstration's angle redistributes the overlap rather than shortening it".

- `teaching-figures.rendered.test.tsx`:
  - F1: the rendered SVG line coordinates equal `axialRayLine(targetRayGeometry(…))`, and the
    caption wording.
  - F4: one `data-tool-scale`, one tip, viewBox, every line end inside the margin.
  - The Section 6 note: exact text, conditional on the shortening, no recommendation words.
- `prompt04-questions.test.tsx`:
  - F2: key and choices unchanged; the rationale and takeaway carry the case-bound sentences; no
    categorical wording anywhere the learner reads.
  - F5: exact labels, key word count no more than the longest distractor, the safety detail in the
    rationale, id and `change-1` unchanged.
- `example-evidence-framing.rendered.test.tsx`, a new describe "a conceptual check carries no image
  it cannot support (CHK-S10)" with three tests:
  - no image, identity, banner or "inspect" instruction; the teaching column's prompt names the
    written scenario and no image; the `dts-1` stem and key; the three illustrative identities
    unchanged;
  - open gate, explanation before an answer, a distractor, retry, the key;
  - every Section 10 step before the check still shows its demonstration or DTS suite view.
- `fixed-example-state.test.ts`: "Section 10's check is written and has no authored image state".

The existing "the component walk still tells the learner to inspect the image it superimposes"
test now also holds the image wording of the column's prompt on a check that has an image.

Changed, each asserting a value this repair intentionally changes:

- `model-truth` "draws each candidate beam …": frontally the detector end is now to the image's
  right of the lesion (the true ray), not vertically above it.
- `truthful-surfaces` "the six text-only checks" (was five) adds `dts-acquisition`.
- `fixed-example-state` "the separately authored rounds are unchanged" drops `dts-acquisition`.

Playwright (`e2e/peripheral-imaging.spec.ts`):

- Section 10's image-task walk now asserts that the check has no DTS view, plane control or
  readout.
- "report 4.2" asserts that the check carries no DTS view, overlay or mark.
- Four new tests:
  - "PR #279 repair F1 and F4" at 1440, 390 and 320 px: the drawn lines equal the model ray,
    labels inside the image, one tool scale, each tool line inside its frame;
  - "F2", practice 9's revealed rationale;
  - "F3 and F5": Section 10's check has no image and explains first; QS-4's labels and rationale;
  - "the readiness aid" at 1440 and 390 px with normal text and 320 px with 200% text.

**Negative control.** The new and changed Jest tests were run against an untouched checkout of
`a18c349f`, a temporary detached worktree that has since been removed. All five suites failed, 8
tests in all: F1, F2, F3 (twice), F4, F5, the six-text-only list, and the Section 6 note. The CHK-S10
self-paced and earlier-steps tests pass on both heads, because they guard behaviour that must not
change. The two figure tests fail there partly because the new exports do not exist yet.

### Validation after the repair

Failures and reruns are listed as they happened. Evidence (logs, probe output, screenshots) is in
the session scratchpad, not in Git.

**Jest** (`--runInBand`):

- **Focused runs while repairing:**
  - The five touched suites passed after each fix, with one exception. The first rendered F4 run
    failed on floating-point rounding: the longest tool is fitted exactly to the margin
    (9.999999999999986 against 10). The rendered assertion now allows 1e-6, as the model assertion
    already did.
  - `model-truth` passed (21 tests; 136 s, because it decodes the real atlas).
- **PI + PI routes, final source: 50 suites / 481 tests pass**, against 470 before the repair (the
  11 new tests).
- **Learning-module: 15 suites / 139 tests pass.**
- **Full repository** (`npx jest`, final source): 963 suites passed, 2 skipped, **9 failed** (8
  failing tests and one collection error). These are exactly the nine baseline suites recorded
  above on untouched `85acc113`, none of them PI:
  - `scripts/ip-preference-cards/check-brochure-intake-static-exposure`;
  - `scripts/ip-preference-cards/us-status/…/safety-boundaries`;
  - `scripts/training-apps.test.mjs` (a `node --test` file with no Jest test);
  - `bronchial-branch-tracing/contracts`;
  - `critical-care/accessibility`, `curriculum-sequencing` and `learner-copy`;
  - `literature/dedicated-supabase/foundation-manifest`;
  - `src/lib/board-review-html`.

  The independent review counted eight, which is the same list without the collection error. They
  are baseline failures, not branch passes, and were not touched.

**Playwright, PI suite** (`playwright.peripheral-imaging.config.ts`, dev server on port 3126):

| Run                    | Result                            | Note                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| targeted 1             | 6 passed                          | The Section 10 walk, "report 4.2", and the four repair tests. Screenshot review then found the −20° label clipped at the image's right edge. The label now slides along its line, and the F1 test asserts every label lies inside the image.                                                                                                                        |
| full 1                 | 76 passed, **1 failed**, 10.2 min | "report 2.3 … at 1024×768" (the Section 2 component walk; it passed at 1280 and 1440): `seen.lit` was null, meaning the lit 3D pin was not in the measured band at that instant. Section 2 is untouched by this repair. Rerun alone three times: 3 of 3 passed.                                                                                                     |
| full 2 (first attempt) | stopped by me after a few minutes | The screenshot review had found the check column's "this image" line on Section 10's written check (see F3). The run was stopped so the fix would not reach the dev server mid-run. Not a failure.                                                                                                                                                                  |
| **full 2**             | **77 passed**, 0 failed, 10.1 min | Final source (73 earlier tests + 4 new). Nothing was edited during the run.                                                                                                                                                                                                                                                                                         |
| production smoke       | **5 passed**                      | Against this worktree's standalone build (`.next/standalone/server.js`, port 3130; the tracked `claude-ebus-02-prod` launch entry, cwd checked): the four repair tests and the integrated-case redirect test. `curl`: the hub, Section 9, Section 10 and practice 9 return 200; `assess?case=case-5` returns 307 to `case-5-v2`. The server was stopped afterwards. |

Browser conditions for the repaired surfaces:

- Section 9 (F1 and F4): 1440 × 900, 390 × 844 and 320 × 740 in the repair test, and all seven
  Prompt 04 conditions in the surfaces test, 320 × 740 at 200% text included.
- Practice 9 (F2), Section 10 (F3) and QS-4 (F5): 1440 × 1050.
- The readiness aid: 1440 × 900 and 390 × 844 at normal text, and 320 × 740 at 200% text in the
  repair test; all seven conditions in the surfaces test.

**Engineering, final source:**

- `tsc --noEmit` (8 GB heap): exit 0.
- ESLint `--max-warnings=0` on every changed `.ts/.tsx`: clean.
- Prettier `--check` on every changed file: clean. Prettier reformatted five files once while
  repairing, and added two blank lines to this handoff.
- `git diff --check`: clean.

**Production build:** `npm run build` on the final source, with the dev server stopped first:
**exit 0**. `next build --webpack` compiled in 81 s, TypeScript passed, 776 of 776 static pages
were generated, and `prepare:standalone` ran. The only warnings are the pre-existing ones listed
above: the mermaid/langium dynamic `require` through board-review, the `metadataBase` notices and
the training-app chunk-size notices.

### Remaining blockers and open items

- None of F1–F5 remains open on this branch. Merge still needs the owner's own review of this
  repair; the independent reviewer may want to re-check.
- Unchanged and still open: the teaching-CT rights basis (release hold), the nine owner deferrals,
  the P03 packets, practice cases 1–3, the IC2 extension, connected cases, and the shared
  case-decision overflow at 320 px with 200% text.
- The owner decision noted above on aligning Section 6's −35° with −20° is answered by the note
  (not aligned, told apart). The QS-5 [O] softening question is superseded by F2.

### Files changed by the repair

Under `src/features/peripheral-imaging/`:

- `components/figures/{teachingFigureModel.ts,TwoAxisWorkedExample.tsx,ConspicuityComparison.tsx,CbctReferenceAids.tsx,figures.module.css}`
- `components/stage/ImagingTeachingColumn.tsx`
- `content/{teachingFigures,learningActivities,teachingExamples,interpretationChecks}.ts`
- `data/questions.ts`
- `__tests__/{model-truth,fixed-example-state,truthful-surfaces}.test.ts`
- `__tests__/{prompt04-questions,teaching-figures.rendered,example-evidence-framing.rendered}.test.tsx`

Outside it: `e2e/peripheral-imaging.spec.ts` and this handoff.

No shared learning-module or stage file, global style, other module, storage key, access tier,
release flag or deployment configuration changed. No binary asset was added.
