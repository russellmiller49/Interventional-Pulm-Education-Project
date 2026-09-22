# PI-FELLOW — decisions held for the source owner

Prepared September 21, 2026 with PI-FELLOW-03. Each packet gives the exact current wording, the
exact proposed wording, the evidence, and the decision needed from Russell. These decisions remain open. Technical tests are not source approval. The independent review
made the pulse-ownership and CBCT accounts visibly provisional, removed an unsupported categorical
prior-CT exclusion, and corrected the handoff accounting. Merge readiness concerns safe presentation
of these holds, not approval of their clinical content. Decisions taken here should be applied by editing the
named file and re-running `jest src/features/peripheral-imaging`.

## 1.3 / 3.10 — what a concentric radial EBUS view establishes

**Finding (PDF p.11, p.32).** Section 1 and Section 15 seemed to the reader to say different things
about rEBUS evidence; the Section 9 explanation of atelectasis mimicking a lesion came too late.

**Every sentence the module currently makes about the concentric view** (unchanged by this batch
except the Section 1 forward-copy, marked ✚):

| Where                                                                      | Current wording                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data/lessons.ts` Section 9, "Radial EBUS is a different kind of evidence" | "A concentric or eccentric view helps localize the lesion relative to the airway, but atelectatic lung can also look lesion-like. The radial EBUS probe is not the biopsy tool: after the probe is withdrawn and another device inserted, the sheath can move, the catheter can deform and the tool can exit in a different direction." (sources mobile, ilocate, frontier) |
| ✚ `data/lessons.ts` Section 1, "Match the modality to the question"        | "…a concentric or eccentric view helps localize the lesion relative to the airway, but atelectatic lung can also look lesion-like, and the probe is not the biopsy tool." (sources + ilocate, mobile)                                                                                                                                                                       |
| `content/imagingChain.ts` rEBUS stop                                       | "A 360-degree image around the probe: a concentric view, with lesion surrounding the probe; an eccentric view, with lesion to one side; or no lesional pattern. None of them establishes where a later biopsy tool will go."                                                                                                                                                |
| `data/resources.ts` glossary                                               | "Radial EBUS patterns in which the lesion surrounds the probe (concentric) or lies predominantly to one side of it (eccentric)."                                                                                                                                                                                                                                            |
| `data/questions.ts` choose-transfer-1 (Section 1's closing question)       | Stem: "The radial EBUS view is concentric, and the catheter icon sits on the virtual target. What does this confirm?" Rationale: "A concentric view is a local ultrasound finding. Lesion identity and specimen adequacy are separate endpoints this view does not establish." Takeaway: "A concentric rEBUS view localizes the probe, not the biopsy tool."                |
| `data/lessons.ts` Section 15 recall prompt                                 | "Why does a concentric radial EBUS view not prove where a subsequent needle will sample?"                                                                                                                                                                                                                                                                                   |

**Evidence.** The ledger's `ilocate` record (Chest 2020; dependent atelectasis during bronchoscopy
and radial ultrasound interpretation) supports "atelectatic lung can also look lesion-like". The
sentences above are consistent with each other: a concentric view localizes the probe relative to
the lesion-like tissue, does not establish lesion identity, and does not establish where the
exchanged tool will sample. What the reader experienced as inconsistency was the Section 9
qualification arriving after Section 1's unqualified sentence; that is now fixed by the forward-copy.

**Proposed wording (optional).** If you want Section 1 to say more than Section 9 already says, one
candidate, not applied: "…a concentric view means lesion-like tissue surrounds the probe and an
eccentric view means it lies to one side; either localizes the probe, not the lesion's identity or
the biopsy tool, and atelectatic lung can also look lesion-like." This adds "not the lesion's
identity", which the closing question already teaches but no lesson block states.

**Decision needed.** (a) Keep Section 1 as forward-copied from Section 9 (default, applied); or
(b) adopt the candidate sentence; or (c) supply your own. If (b) or (c), also say whether the
`imagingChain.ts` stop should match.

## 2.6 / 3.2 — LAO/RAO and cranial/caudal labels for the model's signed angles

**Finding (PDF p.18, p.28).** The C-arm angle was called "obliquity" on the slider, "Orbit" on the
monitor and "orbit and tilt" in the caption; a fellow would expect LAO/RAO and cranial/caudal, and
the sign convention was not stated.

**Applied (safe part).** One name everywhere: "C-arm obliquity" and "beam tilt". The model's sign
convention is stated in patient terms and pinned by a test on `suiteFrame`:

- patient axes in the model: x = patient left, y = anterior, z = superior;
- **positive obliquity moves the detector toward the patient's right** (and the tube toward the
  patient's left);
- **positive tilt moves the detector toward the head**.

Current caption: "C-arm obliquity and beam tilt are the model's signed angles: positive obliquity
swings the detector toward the patient's right, and positive tilt swings it toward the head. They
are not a console's LAO/RAO or cranial/caudal labels, whose conventions vary by system."

**Not applied.** Any mapping from sign to LAO/RAO or cranial/caudal. On most consoles LAO/RAO name
the side of the patient the **image intensifier/detector** is on, and cranial/caudal name the
direction the detector is angled toward — which would make the model's positive obliquity "RAO"
and positive tilt "cranial". But conventions differ between vendors and between supine and other
positions, the module cites no source that fixes one, and the task forbids inferring a clinical
label from the sign alone.

**Proposed wording if you adopt the common convention.** Append to the caption: "On a console that
names the detector's side, positive obliquity here corresponds to RAO and negative to LAO, and
positive tilt to cranial angulation; check your own system's convention." Also add the same
sentence to the glossary entry `obliquity-and-tilt` in `content/glossary.ts`.

**Decision needed.** (a) Keep the model's own terms with no clinical mapping (default, applied);
(b) adopt the sentence above; or (c) supply the convention you teach. A geometry test already
pins the sign, so any sentence adopted will be held to it.

## 2.7 — who owns pulse rate and pulse width

**Finding (PDF p.19).** The tube card said pulse rate was "nothing you adjust directly"; the
detector card said pulse rate was the learner's control.

**Ownership map, as the module now says it** (applied; drawn from the control-families lesson,
which already states pulse width is system-dependent):

| Quantity               | Who sets it in the module's account                                                          | Where the learner meets it              |
| ---------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------- |
| kV, mA, pulse duration | automatic exposure regulation, for the selected mode                                         | tube stop; "monitoring" control family  |
| pulse rate             | selected at the console, produced by the generator; one frame recorded per pulse             | detector stop; "time" control family    |
| pulse width            | system-selected or mode-dependent; whether it is separately selectable depends on the system | control-families lesson; tube-load note |

Current tube-card sentence: "nothing directly — automatic exposure regulation sets kV, mA and pulse
duration for the selected mode. The generator produces the pulses at the pulse rate you select;
whether pulse width is separately selectable depends on the system. Both return as the pulse rate
control family at the detector component". Current detector-card sentence: "pulse rate, selected at
the console and produced by the generator; the detector records one frame per pulse".

**Decision needed.** Confirm the map, or name a device family for which pulse width is a direct
operator control so the sentence can say so with a source. The sources currently cited at these
stops (`setser`, `wabip`, `tg272`) describe pulse rate and pulse width as exposure parameters
without fixing which is operator-selectable on which system.

## 5.4 — the CBCT provenance wording on Sections 13 and 14

**Finding (PDF p.40).** The mobile CBCT section showed the DTS provenance flow, including "Current
limited-angle projections contribute measured attenuation information."

**Applied.** The flow takes its modality from the section. On Sections 13 and 14 it now reads:
"The projections from the CBCT spin contribute measured attenuation from every direction inside the
reconstruction volume." / "Reconstructed volume", with the truncation limit; the wording is Section
12's account (`content/reconstruction.ts`, cone-beam `measured`/`provenance`).

**Decision needed.** Confirm that the CBCT sentence is the one you want on the mobile-CBCT section,
or supply variant-specific copy (e.g. distinguishing the mobile cart's arc or protocol) with a
source. No global replacement of "limited-angle" was made; the DTS sections still say it.

## 6.5 — the VESPA clause

**Finding (PDF p.41).** VESPA was named without saying what it was.

**Source read.** PMID 35803302, Salahuddin M et al., "Ventilatory Strategy to Prevent Atelectasis
During Bronchoscopy Under General Anesthesia: A Multicenter Randomized Controlled Trial (VESPA
Trial)", Chest 2022;162(6):1393–1401 (abstract in Local-Data). Standard arm: laryngeal mask, FiO₂
1.0, zero PEEP. VESPA arm: endotracheal tube, recruitment maneuver after intubation, FiO₂ titrated
below 1.0, PEEP 8–10 cm H₂O. Primary outcome: any atelectasis on chest CT at 20–30 minutes after
airway placement — 84.2 % standard vs 28.9 % VESPA; no difference in complications.

**Applied wording** (`data/lessons.ts` Section 16): "…including VESPA, a multicenter randomized
trial of bronchoscopy under general anesthesia in which a bundle — an endotracheal tube, a
recruitment maneuver after intubation, PEEP of 8 to 10 cm H₂O and an inspired oxygen fraction
below 1.0 — reduced atelectasis on chest CT compared with conventional settings. It does not
justify one pressure, PEEP, oxygen concentration or apnea duration for all patients."

**Decision needed.** (a) Keep as applied; (b) add the effect size ("from 84 % to 29 % of patients
with any atelectasis at 20 to 30 minutes"); or (c) name the comparator explicitly ("a laryngeal
mask, 100 % oxygen and no PEEP") in the lesson as the glossary already does.

## Drafted definitions

Two glossary entries have no verbatim local source and are marked `status: 'drafted'` in
`content/glossary.ts`; a test holds the drafted set to exactly these two.

| Term           | Proposed definition                                                                                                                                                                                                                                                                             | Basis                                                                                   | Decision                        |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------- |
| Binning        | "Combining adjacent detector pixels into one larger pixel at readout. It is a detector setting that changes sampling and noise, not a display operation; whether a magnification mode bins, crops or both depends on the system."                                                               | course glossary "acquisition magnification"; AAPM TG 272 (`tg272`) on detector sampling | confirm, edit, or mark existing |
| Stored contour | "The target contour captured at one acquisition and drawn over later images: the model's stand-in for an augmented-fluoroscopy overlay. It shows where the target was when it was captured, not where the lesion is now, and turning it off removes the annotation, not the anatomical change." | course glossary "augmented fluoroscopy" (`pritchett`, `setser`); Section 4 examples     | confirm, edit, or mark existing |

## Noted, not a source decision

- **3.6 default camera.** The walkthrough found the target-ray workbench's default view unhelpful.
  The presets and their default are PI-FELLOW-02's design (each preset states what it shows) and
  are out of this batch's scope; the meaning half of 3.6 is applied. If you want a different
  default for Section 6, name the preset.

## Independent-review clarification (September 22)

- **1.3 / 3.10:** the forwarded Section 9 limitation remains; the optional new interpretation is not applied.
- **2.6 / 3.2:** model signs remain descriptive; the proposed RAO/LAO mapping is not applied.
- **2.7:** both source and detector control accounts now begin “Draft control-ownership account —
  awaiting source-owner review.” Confirm the map before removing that visible status. The original
  packet's wording is the candidate account, not a resolved clinical assertion.
- **5.4:** the entire CBCT flow is now labelled “Draft CBCT provenance account — awaiting
  source-owner review for the platform and protocol described.” The added sentence “The planning CT
  is not part of a CBCT reconstruction; it enters only through registration for navigation or an
  overlay…” was not documented in the original packet and is removed. It is replaced with Section 14's
  existing caution against assuming that viewing/exporting a volume updates navigation or supplies
  an overlay. No universal prior-CT exclusion is approved. Confirm the “every direction” and
  truncation wording for the intended platform/protocol; this review does not decide it.
- **6.5:** local PMID 35803302 independently supports the bundle, comparator, outcome timing and
  complication statement. Effect-size additions remain unapplied; choosing whether to add the
  comparator/effect size is still the owner's editorial decision.
- **CW3:** both glossary entries already displayed their draft status. Section 7's additional,
  unqualified inline binning definition is now a reference to that visibly provisional entry.

The new CBCT analogy's “nothing ... has to be inferred” and iterative-reconstruction gloss's “until
they agree” were stronger than their cited existing passages; the reviewer removed those additions
and retained the source-preserving account. This makes no new reconstruction claim. The original
“exactly two drafted definitions” contract still holds; neither definition is silently approved.
