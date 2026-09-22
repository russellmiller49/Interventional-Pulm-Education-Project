# PI-FELLOW-DRAFTS — media and reference briefs

> **AI-authored draft — not clinically reviewed.** Prepared 2026-09-22 by Claude (Opus 5.5) for
> owner review. These are **specifications and draft layouts**, not finished media. No image was
> generated, copied or committed. Nothing here is an institutional, anesthesia, credentialing or
> radiation-protection protocol.
> **Owner decisions OD4-03, 06, 08, 09, 10 and 12 were recorded on 2026-09-22**; each brief states
> its decision ([owner-decisions.md](owner-decisions.md#recorded-owner-decisions-2026-09-22)).

Base `origin/main` **`745146f6`** · feedback items **3.1, 5.2, 5.5, 3.5, 6.6, PR5**. Evidence tags
(**S M I T U O**) are defined in the [README](README.md#evidence-tags).

**Rules every brief follows**

1. A teaching-model image is labelled as one and never presented as a patient finding [S: pack
   `04`; PI-01 invariant].
2. No fluoroscopy, CT, CBCT, DTS, ultrasound or bronchoscopy image is generated to look acquired.
   Model output is labelled model output. A simulated effect is labelled simulated.
3. Media tiers (**OD4-03, decided 2026-09-22**): **Tier 1**, clearly labelled model imagery, now.
   **Tier 2**, phantom acquisitions for noise and scatter, permitted as a future route. **Tier 3**,
   patient-derived media, **held** until provenance, de-identification and rights are explicitly
   documented. Any image later cleared stays **outside Git** until then, and ships with a provenance
   manifest like `public/peripheral-imaging/manifest.json` [I]. The existing teaching CT's rights
   basis (O-CT) must be resolved before release.
4. Prompt 03 terms stand: the model's **signed** C-arm obliquity and beam tilt with no LAO/RAO
   mapping, "modeled lesion", "stored contour" [S: P03 handoff and owner packet].

| Brief                                                                        | Need                                    | Honest source today                             | Owner decision (2026-09-22)                                               |
| ---------------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------- |
| [A](#a--ct-planning-to-two-axis-projection-worked-example-31)                | CT → two-axis projection worked example | existing CT slices, DRR and target-ray readouts | OD4-08: option A approved; LAO/RAO mapping deferred (P03-ANGLE)           |
| [B](#b--fixed-and-mobile-cbct-workflow-comparison-52)                        | Fixed / mobile workflow comparison      | module text; four abstracts                     | OD4-09: approved; illustrative field sizes equalised                      |
| [C](#c--team-readiness-reference-55)                                         | Team-readiness reference                | module text                                     | OD4-10: approved without the two suggestion rows                          |
| [D](#d--noise-contrast-superimposition-and-motion-truncation-examples-35-66) | Artifact and conspicuity examples       | model for 3 of 7; authentic for the rest        | OD4-06: simulated CT-derived now; authentic deferred (OD4-03 Tier 3 held) |
| [E](#e--floor-plan-for-the-lateral-projection-case-pr5)                      | Floor plan for practice case 15         | new schematic                                   | OD4-12: approved; position 2 confirmed                                    |

---

## A · CT planning to two-axis projection worked example (3.1)

**Owner decision (OD4-08, 2026-09-22): option A approved.** Build now with the model's signed
obliquity and tilt language. LAO/RAO and cranial/caudal sign mapping is deferred until the
P03-ANGLE hold is resolved. The teaching nodule is described as "posterior left lung" with no lobe
(OD4-11). The verification items below still apply before building.

**Feedback.** "This is the most practical teaching in the module … It is one 100-word paragraph with
no figure. I wanted a worked example: an axial CT slice with the chosen beam direction drawn on it,
the angle it gives, and the resulting projection before and after" [S: PDF p.28].

**Educational objective** [M: Section 9 "A two-axis fluoroscopy technique"]. Use the axial and
sagittal planning CT to choose a projection that clears overlying structures _for this lesion_.
Then recentre, collimate around the lesion and the anticipated tool excursion, and choose a second
projection with the tool in profile. "The individual lesion position, not a memorized lobe rule,
decides the angle" [M].

**Sequence** (static figure; six panels, readable at phone width by stacking) [T]

| Panel | Shows                                                                                                                                                                | Source                                                                                                   |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1     | Axial CT through the nodule centre. Modeled lesion marked. Heart, spine and ribs labelled where the slice shows them. The frontal (0°) beam line through the nodule. | existing CT slice view (`ct-atlas.png`) [I]                                                              |
| 2     | The same slice with two candidate beam lines at model obliquity −35° and +35°                                                                                        | model geometry `suiteFrame` [I]                                                                          |
| 3     | The target-ray strip for 0°, −35° and +35°: millimetres of air-like, aerated-lung-like, soft-tissue-like and bone-like CT along each ray                             | existing Section 6 readouts [I; M: Prompt 03 3.6 sentence "the model names density classes, not organs"] |
| 4     | Sagittal CT through the nodule, with candidate beam-tilt lines **only if** the diaphragm, a rib edge or the clavicle overlies it                                     | existing CT [I]; overlap to be verified [U]                                                              |
| 5     | Model projection (DRR) before (0°) and after the chosen obliquity/tilt, recentred and collimated                                                                     | existing DRR renderer [I]                                                                                |
| 6     | Alignment view versus advancement view: a near-axial projection that foreshortens the tool, and a side-on one with the tool in profile                               | Section 5 "Alignment view versus advancement view" [M]; existing geometry model [I]                      |

**What CT information is shown.** Two planes through the modeled lesion's centre, and the
structures along each candidate ray. The CT anatomy is real teaching data. The nodule is authored:
an 18-mm part-solid sphere at x = +85 mm (patient left), y = −20, z = −30 in the model's frame [I:
`anatomy/manifest.json`]. The CT is 192³ resampled and 8-bit quantized, which Prompt 03 already
labels "low-resolution context" [S: P03 6.3].

**How the two projections relate.** Each beam line in panels 1, 2 and 4 is the model's central ray
through the nodule at that obliquity or tilt. Panel 3 integrates CT density along exactly that ray.
Panel 5 is the projection taken along it. All three come from one geometry (`lib/physics.ts`,
`suiteFrame`) [I], so the figure cannot disagree with the lab.

**Model geometry vs clinical convention**

| Model geometry (can be shown) [S: P03 owner packet; I]           | Clinical convention (not shown; P03-ANGLE open)                                               |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Axes: x = patient left, y = anterior, z = superior               | LAO/RAO names the side the detector is on, on many consoles; conventions vary [S: P03 packet] |
| Positive obliquity moves the detector toward the patient's right | Whether that is "RAO" on a given console: **not asserted**                                    |
| Positive tilt moves the detector toward the head                 | Whether that is "cranial": **not asserted**                                                   |

Every angle in the figure reads "model obliquity +35° (detector toward the patient's right)". No
panel prints LAO, RAO, cranial or caudal as a label for a signed value. Section 9 uses the words
"cranial or caudal angulation" generically, and that stays [M].

**Annotation plan.** Beam lines, colour-blind-safe and labelled with the signed value and patient-terms
direction. Modeled lesion outline labelled "modeled lesion (authored)". Structure labels only where
a reviewer has confirmed the structure on that slice. Patient-orientation markers (L/R, A/P) on
every CT panel. The target-ray strip uses its existing density-class names.

**Source requirements.** Section 9's paragraph cites `setser`, `tg272`, `wabip` [M]. Only the
`setser` and `wabip` abstracts were read [S]. **Neither abstract states the two-axis technique**, so
its wording rests on the module text and the owner's own practice [U → O].

**Outstanding verification before building** [U]

1. Display orientation of the course's axial view (radiological or anatomical). Beam lines drawn on
   the wrong convention would teach the wrong direction.
2. Which signed obliquity actually clears the cardiac density for this nodule, read from panel 3.
   The draft does not assume −35° (Connected case 1 D1).
3. Whether the sagittal slice shows an overlap that tilt would address. If not, panel 4 says "no
   tilt needed for this lesion", or is dropped.
4. The advancement-view angle for a tool in profile at this lesion.
5. P03-ANGLE, if the owner later wants clinical labels beside the signed values.

**Placement.** Section 9's first reading step (`two-dimensional:case`) and Connected case 1 D1. A
static composite from existing renderers adds no new data dependency [T].

---

## B · Fixed and mobile CBCT workflow comparison (5.2)

**Feedback.** "Fixed and mobile workflows looked the same to me on screen … A side-by-side table of
what differs between a fixed and a mobile room (table, clearance, shielding, integration with
navigation) would make Sections 13 and 14 earn their place" [S: PDF p.39].

**Scope.** Only distinctions the module's own text or an abstract read here supports. No device
names, no ranking, no numbers.

**Draft table** (for Sections 13 and 14; the same component in both) [T layout; content as tagged]

|                            | Fixed installation                                                                                                                                                                                                                                                                                                       | Mobile scanner in an existing room                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Same in both**           | "Portability changes logistics, not the physics" [M: S14 takeaway]. Shared acquisition requirements (centring in three dimensions, full-spin clearance, breath hold, protection) come from Section 12 [M].                                                                                                               | same                                                                                                                                                                                                                                                                                                                                                                                           |
| **Workflow**               | "Plan bronchoscope and robot docking around the actual CBCT spin path." Room access, motion limits, detector clearance and navigation integration "are installation-specific" [M: S13].                                                                                                                                  | "Check table radiolucency, pedestal and base interference, power and parking, patient and robot clearance, image export and room shielding with the responsible team. Floor space for a C-arm is not a verified rotational clearance." Roles stay clear "during scanner entry, positioning, acquisition, review and the return to sampling" [M: S14].                                          |
| **Physical configuration** | "May be floor-, ceiling- or robot-mounted, often with an integrated imaging table and dedicated shielding" [M: S13]                                                                                                                                                                                                      | A cart brought into a procedure room, working with that room's table and shielding, which is why "Commission the room, table and scanner together" [M: S14]                                                                                                                                                                                                                                    |
| **Imaging capability**     | "Field of view, angular range, scan time, exposure modes, reconstructed image quality and workflow differ among models and software versions. A mobile label does not imply universally lower dose or poorer images, and a fixed label does not establish every navigation or overlay capability" [M: S14].              | same sentence; it applies to both columns                                                                                                                                                                                                                                                                                                                                                      |
| **Integration**            | "Supported table and C-arm position tracking can keep an overlay aligned through recognized equipment movement." Lung-volume change and deformation are separate problems [M: S13]. Fixed CBCT with augmented fluoroscopy is described in two primary studies [S: `pritchett` PMID 30179922; `verhoeven` PMID 34162799]. | "DICOM export alone does not show that two systems share a coordinate frame." Verify orientation, volume identity and supported coordinate transfer [M: S14]. Integrated combinations exist: robotic bronchoscopy integrated with mobile CBCT [S: `confirm` PMID 41698810]. Mobile CBCT with a thin scope and radial probe is described in a retrospective series [S: `mobile` PMID 36899971]. |

**Kept apart: what the course's model changes between the two** [I:
`components/suite/suiteModel.ts`]. `GANTRY_VARIANTS` gives the fixed variant the default detector
field and a "fixed" mount, and the mobile variant a 300-mm panel and a "cart" mount. The mobile
field-of-view cylinder is therefore drawn smaller. The code calls these "Authored gantry
illustrations, not manufacturer dimensions or supported trajectories" [I]. The scout legend prints
"Mobile cart" or "Fixed support" [I]. **The comparison must not present the smaller mobile cylinder
as a fixed-versus-mobile fact.** **Owner decision (OD4-09, 2026-09-22):** the table is approved,
and any purely illustrative field-size difference is **equalised** unless a sourced reason exists to
teach it. The authored panel/FOV difference is too easy to over-read as a device fact.

**Do not imply:** vendor equivalence or superiority; that fixed rooms always have overlays or mobile
scanners never do; lower dose or poorer images for either label; any field-of-view or arc number. No
abstract read compares fixed with mobile CBCT directly [U].

**Placement.** Opening reading steps `fixed-suite:room` and `mobile-suite:commission`, which the
evidence map rates **C** because their scenes are nearly identical. The table gives the sections a
visible difference without inventing one in the 3D scene.

---

## C · Team-readiness reference (5.5)

**Feedback.** "The role list (bronchoscopist, technologist, anesthesia, team) is exactly the kind of
thing I would want as a printable one-page checklist" [S: PDF p.40].

**Status line printed on the aid** [T]: _"Teaching aid from the Peripheral Bronchoscopy Imaging
course. Not an institutional protocol, an anesthesia protocol, a credentialing standard or a universal
pre-procedure checklist. Your institution's policy governs."_

**Draft layout.** One page, four role rows, with a copy button like Section 18's note template [I:
`DOSE_NOTE_TEMPLATE_LINES` pattern].

| Role           | Before a CBCT spin, confirm…                                                                         | Basis                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Bronchoscopist | The question the spin must answer (localization, or tool-in-lesion)                                  | [M: Section 1 "State the question before acquiring"]       |
|                | "The lesion and the actual biopsy tool configuration"                                                | [M: S12 "Make readiness a team check"]                     |
| Technologist   | "Protocol, coverage and clearance for the full spin"                                                 | [M: S12]                                                   |
|                | The lesion is centred on both scouts                                                                 | [M: S12 "Center the lesion in three dimensions"; lab goal] |
|                | A non-irradiating trial rotation, "when supported"                                                   | [M: S12]                                                   |
| Anesthesia     | "A stable breath hold or ventilation pause, monitoring and stopping criteria"                        | [M: S12]                                                   |
|                | The intended state, and who announces readiness for acquisition                                      | [M: S16 "Plan the breath hold with anesthesia"]            |
|                | That normal oxygen saturation is not proof of adequate CO₂ elimination                               | [M: S16]                                                   |
| Whole team     | "Effective shielding and maintained patient access"                                                  | [M: S12]                                                   |
|                | Staff not needed at the bedside are behind an effective barrier while monitoring and access continue | [M: S17]                                                   |
|                | Arms, table, robot, bronchoscope, lines and anesthesia equipment are clear of the spin               | [M: S12 "Account for…"]                                    |

**Owner decision (OD4-10, 2026-09-22):** approved **without** the two organizational-suggestion
rows that were drafted here (a read-aloud call-and-answer, and a post-spin note of why a repeat was
needed). The reference stays limited to source-backed teaching. Local workflow suggestions may be
added later only if specifically wanted, labelled as local practice.

**Deliberately absent:** breath-hold durations, PEEP or oxygen settings, and stopping thresholds
(P03-VESPA; local anesthesia practice) [U]. Also absent: collision-check procedures for any named
system (device-specific) [U]. The course's lab calls its own readiness checks "learner-declared";
there is "no collision detection" [M: `teachingExamples.ts`].

**Sources.** Module citations on these blocks: `setser`, `mobile`, `wabip`, `vespa`, `icrp` [M].
Abstracts read: `setser` (covers room set-up and acquisition practice), `wabip` (practical measures)
[S]. The role split itself is module content, not a sourced consensus [U → O].

---

## D · Noise, contrast, superimposition and motion, truncation examples (3.5, 6.6)

**Feedback.** 3.5: the noise cartoon "is drawn as scattered square blocks, which looks like a
compression glitch and not like the fine mottle I have seen on a real low-dose image … A real or
realistic example of each, even a small one, would stick better" [S: p.30]. 6.6: Section 16 reuses
Section 4's contour-shift model; "a figure showing duplicated edges from motion next to a truncated
lesion next to a new dependent opacity would match the section's actual question" [S: p.42].

**Current state** [I]. Section 6's `SignalImage` draws noise as 360 small rectangles and contrast
loss as reduced opacity, over schematic ellipses. Its caption: "These drawings do not calculate
photon statistics, scatter, dose response or patient anatomy." Section 16's figure is the rigid-shift
registration model, whose example already says it "models neither atelectasis nor recruitment" [M].

**Proposed structure.** Section 6 gets a three-column set (noise | scatter | superimposition), each a
pair against a shared reference. Section 16's "Match the artifact to its cause" step gets a
three-panel strip (motion | truncation | new dependent opacity). Section 16's stored-contour lab stays
as the hands-on part, since its lesson is the stored contour, and its caption already bounds it [T].

| #   | Phenomenon                          | Objective [M]                                                          | Modality · acquisition context                                             | Comparison                                           | What a model can honestly show                                                                                                                                                                                   | What needs authentic media                                                                                                                  | Annotation                                                                             | Provenance / rights                                                              |
| --- | ----------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| D1  | Quantum noise: fine mottle          | "Quantum noise is random variation from too few detected photons" (S6) | Fluoroscopy, last-image-hold frame; same projection at a lower-output mode | reference vs noisy, same geometry                    | **Simulated** noise on the course's CT-derived projection, scaled by the module's own SNR ∝ √N idea (S6 detail) and labelled "simulated noise, not a dose level" [T]. It would replace the square-block cartoon. | A phantom pair at two exposure modes is honest and needs no patient rights [T]. A patient pair needs rights.                                | none on the noise; caption "fine mottle"                                               | model: repository · phantom: owner-acquired · patient: outside Git until cleared |
| D2  | Scatter: smooth veil, sharp edges   | "Scatter adds unwanted signal that reduces contrast" (S6)              | Fluoroscopy; wide field vs collimated field                                | wide vs collimated, same projection                  | The course has **no scatter model** ("photon statistics and scatter are not calculated" [M: S6 example]). Any simulated veil is a drawing-level effect and must say so [T].                                      | A phantom pair (open vs tight collimation) is the honest version [T].                                                                       | collimator edges in the tight frame                                                    | as D1                                                                            |
| D3  | Superimposition                     | "Anatomical superimposition is real overlying structure" (S6)          | CT-derived projection at two obliquities                                   | baseline vs changed view                             | **Already honest and existing**: DRR plus target-ray strip (S6 `signal:superimposition`) [I]                                                                                                                     | not needed                                                                                                                                  | silhouette over the modeled lesion; which sign clears it read from the model (brief A) | repository (O-CT)                                                                |
| D4  | Motion: duplicated edges            | "Duplicated edges suggest motion" (S16)                                | CBCT spin with breathing during acquisition                                | motion-degraded vs breath-hold volume, matched plane | Not in the course. A toy shift-and-add with the object moved mid-sweep could show doubling in **DTS** planes as a labelled model [T]. It would not be a CBCT image.                                              | a de-identified CBCT pair: **absent**                                                                                                       | doubled catheter and lesion edges                                                      | outside Git until cleared                                                        |
| D5  | Truncation                          | "A truncated lesion suggests a coverage or centering problem" (S16)    | CBCT, off-centre acquisition                                               | centred vs off-centre                                | Masking CT slices outside the modeled field-of-view cylinder at an authored offset. Honest for **coverage**, not for how a real volume edge looks [T; U]                                                         | optional                                                                                                                                    | volume boundary; "outside the reconstructed volume"                                    | repository (O-CT)                                                                |
| D6  | New dependent opacity               | "A new dependent opacity may be real atelectasis" (S16)                | CBCT or CT; early vs later under anesthesia                                | first vs later volume                                | **Cannot** (rigid translation only [I])                                                                                                                                                                          | a de-identified pair: **absent**. Context only: I-LOCATE and VESPA abstracts describe CT-detected atelectasis [S], but no images were read. | new region; stored contour on the old border                                           | outside Git until cleared                                                        |
| D7  | Hardware banding (practice case 12) | "Metal-adjacent streaks need artifact-aware review" (S16)              | Mobile CBCT; rail and bracket in the lateral projections                   | with vs without hardware                             | none, except a **geometry-only** schematic of where the rail lies in the spin [T]                                                                                                                                | an authentic banding image: **absent**                                                                                                      | bands; broken margin                                                                   | outside Git until cleared                                                        |

**What a simulator or model may demonstrate** (D1–D3, D5): a mechanism, with a "teaching model" or
"simulated" label. **What requires authentic media** (D4, D6, D7, and D1–D2 if real appearance is
wanted): how the finding actually looks.

**Owner decision (OD4-06 with OD4-03, 2026-09-22).** Build **simulated CT-derived examples now**,
clearly labelled:

- Section 6: D1 and D2 as labelled simulations on the CT-derived projection (option b), with D3
  from the existing DRR. Phantom pairs (Tier 2) are a permitted later upgrade.
- Section 16: the D5 truncation model now, with motion and new dependent opacity as text
  placeholders (option b).

**Deferred:** authentic motion (D4), new-opacity (D6) and banding (D7) examples, until media rights
exist; patient-derived media stay held (Tier 3). **Not addressed:** the D4 toy DTS simulation and
the D7 geometry-only schematic remain unselected options.

---

## E · Floor plan for the lateral-projection case (PR5)

**Owner decision (OD4-12, 2026-09-22): schematic approved,** with the position-2 reading below
confirmed.

**Feedback.** "A simple floor plan with the three standing positions would make it faster to read"
[S: PDF p.46, practice case 15 `staff-protection-practice-1`].

**The case's own geometry** [I: `content/microCases.ts`; `data/questions.ts`]

- A steep lateral projection. "The X-ray tube is on the near side of the table and the flat-panel
  detector on the far side."
- The fellow stands "beside the tube housing in an apron and thyroid shield, hands well outside the
  irradiated field".
- Three positions: "beside the tube housing, farther back on the same side, and across on the
  detector side".
- Choice a reads "Step farther back **along the table** on the tube side", and rationale c says
  "Distance from the table is similar for all three positions". So position 2 lies further along the
  table's long axis, at about the same distance from its edge. The diagram must draw it that way.
  **Confirmed by the owner (OD4-12, 2026-09-22):** position 2 is farther along the table on the tube
  side, at about the same distance from the table.

**Three different things, kept separate**

|                      | 1 · Geometric teaching diagram (proposed)                                                                                                                                                                                                                                   | 2 · Modeled inverse-square concept (exists, Section 17)                                                                                                                                  | 3 · Real room scatter or dose data                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| What it is           | Top-down plan: table, supine patient, C-arm in lateral with tube near and detector far, a primary-beam arrow across the patient, P1 beside the tube housing, P2 along the table on the tube side, P3 across on the detector side, equal-distance guides from the table edge | Floor rings at 1, 1.5, 2 and 3 m with relative value 1/d², distorted by an **authored** tube-side weighting `1 + 0.5·max(0, …)` [I: `staffModel.ts`, "explicitly authored angular bias"] | A medical physicist's room survey, manufacturer scatter plots for a named system and projection, or staff dosimetry |
| What it supports     | Which side of the patient each position is on: the case's decision                                                                                                                                                                                                          | Distance falls off, and tube side differs from detector side, as a concept [M: "idealized point-source distance relationship, not calibrated staff dose or a safe-distance boundary"]    | Measured exposure at a position                                                                                     |
| Status in the course | not built                                                                                                                                                                                                                                                                   | existing, labelled idealised                                                                                                                                                             | **none**; not to be implied [U]                                                                                     |

**Design rules for the diagram** [T]. No numbers. No colour scale. No contour lines, so it cannot be
mistaken for an isodose map. The only exposure statement is the module's qualitative sentence, as
text: "In lateral projections, positions on the detector side often receive less than the
beam-entrance (tube) side" [M: S17 "Geometry shapes occupational exposure"]. Label the patient "the
principal source of scatter" [M: S17]. Caption: "Schematic of the case's positions. Not a scatter
measurement; the room survey and the radiation safety officer set verified positions" [M: case
takeaway].

**Sources.** `wabip`, `icrp` (module citations) [M]; `wabip` abstract [S]; `icrp`: registry only.

**Placement.** Under the situation text in practice case 15. Optionally, Connected case 2 D4 could
use the same diagram style, relabelled for a CBCT spin [T].

## Sources read for this file

Walkthrough PDF text pp.28, 30, 39–40, 42, 46; ledger rows 3.1, 3.5, 5.2, 5.5, 6.6, PR5; PI-FELLOW-03
handoff (3.6, 6.3, 7.3) and owner packet (angles, CBCT, VESPA); `data/lessons.ts` (Sections 5, 6, 9,
12, 13, 14, 16, 17); `content/teachingExamples.ts`; `content/microCases.ts`; `data/questions.ts`;
`content/doseQuantities.ts`; `components/stage/TeachingPanels.tsx`; `components/suite/suiteModel.ts`;
`components/suite/staffModel.ts`; `components/suite/views/ConeBeamView.tsx`;
`public/peripheral-imaging/README.md` and `anatomy/manifest.json`; local abstracts for `setser`,
`wabip`, `mobile`, `confirm`, `pritchett`, `verhoeven`, `ilocate`, `vespa`.
