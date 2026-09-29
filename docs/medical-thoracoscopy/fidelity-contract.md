# Medical Thoracoscopy — fidelity contract

"Full 3D" means the planned spatial interactions and teaching experiences are kept. It does not
mean validated tissue mechanics, patient-specific physiology, quantitative injury prediction or a
clinical digital twin (v2 §1.1). Every subsystem says which of its relationships are measured,
which are reviewed approximations and which are illustrative.

## Four kinds of claim

Every dimension, rule and statement in the module belongs to exactly one category, and the
category travels with it into the registers, the asset manifest and, where the learner needs it,
the screen.

| Category                       | Meaning                                                              | Example                                       |
| ------------------------------ | -------------------------------------------------------------------- | --------------------------------------------- |
| Clinical evidence              | Drawn from a guideline, statement, trial or textbook, with a locator | Who is a candidate for the procedure          |
| Device fact                    | Published by the manufacturer, with document and revision            | Shaft length of the telescope                 |
| Derived measurement            | Measured by this project from a source it names                      | Rib gap at the port, measured on the CT       |
| Authored simulation assumption | Chosen by the author so the model can run                            | How far the collapsed lung sits from the port |

A derived measurement is not a device fact, even when it agrees with one. An authored assumption
is never presented as evidence.

## What the learner is told

| Label                                           | Used for                                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Derived from CT segmentation                    | Surfaces built from the scan: the pleural space, ribs, diaphragm, heart                  |
| Authored construct                              | Things the author drew or defined: survey zones, the intercostal bundle, the port choice |
| Authored, illustrative                          | Behaviour that is plausible and not measured: lung states, fluid level, pathology        |
| Educational rendering from published dimensions | Device models, until manufacturer CAD replaces them                                      |
| Awaiting clinical review                        | A relationship the lesson depends on whose claim has no recorded decision                |
| Not modeled                                     | A consequence the simulation does not represent                                          |

## Each experience

| Experience                                  | What it does                                            | What it does not claim                                                                        |
| ------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Device assembly and tower                   | Sourced dimensions and documented connections           | That illustrative geometry is exact, or that an unconfirmed combination is compatible         |
| Chest wall, port and scope navigation       | Spatial relationships checked against stated tolerances | That any modelled corridor is universally safe                                                |
| Ultrasound planning                         | The pre-entry planning state, with its source named     | That the original ultrasound is a live view of a model that has since been drained or morphed |
| Lung transition, fluid and re-expansion     | Reviewed authored relationships and their exceptions    | Pressure, physiology or a guaranteed clinical response inferred from mesh shape               |
| Biopsy, adhesions, energy and talc          | Tool contact and reviewed teaching events               | Validated tissue cutting, thermal spread, aerosol deposition or dosing                        |
| Visual interpretation and the survey ledger | Differential reasoning and model-estimated visibility   | Histology, diagnostic certainty or an adequate examination                                    |

## Device fit

Fit between two parts is recorded as one of three values, for the exact combination and market:

- **Documented compatible**: a manufacturer document says so.
- **Documented incompatible**: a manufacturer document says so.
- **Not established**: everything else.

A tool that is narrower than a channel is a dimensional comparison. It cannot move a combination
to "documented compatible".

## Geometry

- Physical dimensions are in millimetres. One declared transform presents the anatomy on screen.
  The anatomy's own frame never changes.
- After export, and again after any CAD replacement, these are checked: known lengths, asymmetric
  landmarks, shaft axis, optical axis, image orientation, channel exit and port pivot.
- The handle and the side eyepiece have their own anchors. The 215 mm shaft is not the whole
  instrument.
- Optics the manufacturer has not confirmed are authored visualisation parameters. Visibility or
  reach derived from them is not manufacturer-validated performance.
- Collision geometry is a simplified proxy. Its distance from the drawn surface is measured and
  recorded at every lung state.
- Shared coordinate labels do not establish registration between the CT and the ultrasound.
- Source identifiers inside distributed assets do not identify a person.

## Contact

Contact is defined by instrument part × anatomical region × action × scenario state.

| Class                                          | Behaviour                                                                                                                                 |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Free-space motion                              | The shaft and tool inside the chest stay within the modelled space and outside excluded structures                                        |
| Port traversal and pivot                       | Only through the modelled corridor. The part of the instrument outside the chest need not be inside the pleural space                     |
| Intended intervention contact                  | The working element, not the shaft, may touch an authorised teaching target under reviewed rules                                          |
| Unintended contact or an unsupported manoeuvre | Refused, with the limiting part named, or answered with reviewed feedback. The instrument is never quietly moved into a successful action |

These are engineering permissions. They are not statements about clinical safety. A hard stop is
a limit of the model and is described that way.

## Tolerances

Numerical tolerances are modelling tolerances. They are documented where they are used and are
never presented as clinical margins.

| Tolerance      |    Value | Used for                                                           |
| -------------- | -------: | ------------------------------------------------------------------ |
| Clearance skin |  0.25 mm | Distance kept between an instrument capsule and a surface          |
| Touch          |   0.3 mm | Distance at which a working element counts as touching its target  |
| Numeric        | 0.001 mm | Rounding. A clearance below −0.001 mm is recorded as a penetration |

## Snapshot identity

Every collision, contact and visibility result names the snapshot it was computed for: anatomy,
device, optics, port, scenario, lung and fluid configuration, geometry generation, and the engine's
own authored rules (step sizes, skins, the port's excluded patch, the lung's room, the view's
occlusion tolerance). The port is named by its record and by its frame as the engine uses it, so
new rib points make earlier results stale. An offline record also names the grid it was computed on.
A result for another snapshot changes nothing. Ephemeral renderer state is not part of it. While geometry is being computed, the affected interaction
pauses and says why. Reading and navigation stay available.

## What a passing test does not show

Clinical review, the manufacturer's fact-check, rights permissions, performance on a physical
device, the fellow pilot and the owner's publication decision are each recorded separately. None is
inferred from an automated result.
