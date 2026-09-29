# Medical Thoracoscopy — owner decisions

The owner is Russell Miller. Only the owner's own decisions are recorded as decisions. A default
the build is working to is not a decision, and is listed separately below.

## Decided

| ID    | Date       | Decision                                                                                                                                                     | Where it was made             |
| ----- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| OD-01 | 2026-09-23 | Full module in about 3–4 months, targeting mid-January 2027.                                                                                                 | Original plan, line 18        |
| OD-02 | 2026-09-23 | 3D coverage: the Mini-Thoracoscopy Set, the ENDOCAM Logic 4K tower and a generic electrosurgical generator.                                                  | Original plan, line 19        |
| OD-03 | 2026-09-23 | Wolf has not yet been asked for CAD, a brand kit or video.                                                                                                   | Original plan, line 20        |
| OD-04 | 2026-09-23 | Wolf is the sponsor, and the owner keeps editorial control. This is the site's first sponsored module.                                                       | Original plan, line 21        |
| OD-05 | 2026-09-23 | It is a new top-level module at `/[locale]/medical-thoracoscopy`.                                                                                            | Original plan, line 22        |
| OD-06 | 2026-09-23 | The old module is retired, with permanent redirects.                                                                                                         | Original plan, line 23        |
| OD-07 | 2026-09-27 | The revised plan (v2) governs wherever it differs from the original plan. The original still supplies the inventory, the module tree and the asset pipeline. | Answer to a planning question |
| OD-08 | 2026-09-27 | The first build round runs straight through the week-4 working prototype, slice after slice, without a pause between slices.                                 | Answer to a planning question |
| OD-09 | 2026-09-27 | One `claude/mt-NN-*` branch per slice, committed locally with explicit paths. Pushing and pull requests happen only when the owner asks.                     | Answer to a planning question |
| OD-10 | 2026-09-27 | Remove the legacy pleuroscopy re-expansion scenario and its quiz item now, in a small separate change.                                                       | Answer to a planning question |

OD-06 is qualified by the revised plan, which OD-07 makes governing: the misleading legacy
teaching is removed now (OD-10, done in slice A), and redirects wait until a reviewed destination
exists.

The build plan for the first round was approved on 2026-09-28. Approval authorised building to
the defaults below. It did not decide them.

## Open, with the default being built

Each default sits behind one declared field, so changing it is a data change. Tell the agent which
row to change and what to change it to.

### Teaching and behaviour

| #   | Item                                                          | Default being built                                                                                                                                                                                                                 | Status          |
| --- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| T1  | Which sections belong to which chapter                        | Decide 1–2; Equipment and anatomy 3–6; Access and orientation 7–10; Survey and intervention 11–16; Finish and complications 17–19                                                                                                   | Proposed change |
| T2  | How the lung falling away appears before its rule is reviewed | The learner's own "let air in" action drives it. The pane labels it an authored relationship awaiting clinical review. A test blocks publication while any such label remains. Alternative: shown only as a loaded teaching example | Proposed change |
| T3  | Consequences of unsafe actions                                | "Not modeled", with an immediate explanation of the risk. None is animated until its claim is reviewed                                                                                                                              | Proposed change |
| T4  | What the image does when the scope rolls                      | The camera is fixed to the eyepiece: the view rolls and the tool keeps its clock position. Alternative: the horizon is held                                                                                                         | Proposed change |
| T5  | Steering                                                      | Hand-referenced: the handle moves and the tip goes the other way. A labelled tip-referenced assist is offered                                                                                                                       | Proposed change |
| T6  | Port for the prototype                                        | Right 7th intercostal space, mid-axillary line: the highest space on this scan where skin, chest wall and rib gap are all measured. Alternative: the 5th space, with wall thickness and yielding of the ribs authored and labelled  | Proposed change |
| T7  | Where the chest view is seen from                             | The patient's front, head to the right of the screen                                                                                                                                                                                | Proposed change |
| T8  | Wording of the second control                                 | "Where the scope looks (pivot, depth, roll)". The original wording trips the learner-copy check on the word "points"                                                                                                                | Proposed change |
| T9  | Finishing a section                                           | Marks it reviewed, with undo. A second action leaves without marking                                                                                                                                                                | Proposed change |
| T10 | Title of section 18 (`complications`)                         | "When a complication happens". The imported title, "When something goes wrong", trips the learner-copy check on "wrong"; it stays in the manifest unchanged                                                                         | Proposed change |
| T11 | Clinical statements in a written section before review        | Shown in the unlisted preview under a notice on the section that it has not been clinically reviewed, never as settled fact. Publication stays blocked until each claim is accepted. Alternative: not shown until accepted          | Proposed change |
| T12 | What counts as a region seen in the survey                    | Every sample point of the region at some moment within the field of view, within range, facing the telescope and unobstructed. No hold time; the lesson says the model cannot tell a glimpse from a careful look                    | Proposed change |
| T13 | Breathing and heartbeat motion                                | Not modeled, and said so. The diaphragm is taught by its place toward the feet, with its movement named as the cue in a patient                                                                                                     | Proposed change |

### Sponsorship and rights

| #   | Item                                                              | Default being built                                                                                                                                                                                                                                                    | Status                                         |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| S1  | Sponsorship disclosure before its wording is approved             | The slot and registry are built. Nothing renders until the owner approves wording                                                                                                                                                                                      | Unresolved input                               |
| S2  | Sponsor legal entity; clinical, manufacturer and rights reviewers | Recorded as "not assigned"                                                                                                                                                                                                                                             | Unresolved input                               |
| S3  | Identity of the anatomy source                                    | Recorded as "asserted AeroPath case 19, CC BY 4.0, not hash-verified". Attribution and a modification notice ship with every derived asset                                                                                                                             | Unresolved input                               |
| S4  | Who made the segmentation, and with what                          | The file's tags name TotalSegmentator and MONAI Auto3DSeg. Which models, and whether their terms allow a sponsored course to publish what they produced, is not established. This does not stop the local build. It does stop any upload or publication of the anatomy | Unresolved input                               |
| S5  | Where discrepancies between manufacturer documents are listed     | In the owner's local data, in a packet for the owner to send. The repository records the value modelled, its source and "unresolved input"                                                                                                                             | Proposed change                                |
| S6  | Keeping copies of the four manufacturer documents                 | Not copied. The register cites address, retrieval date and file hash                                                                                                                                                                                                   | Unresolved input: needs the owner's permission |
| S7  | Uploading assets after a merge                                    | The exact command is in each handoff. Production shows the fallback until the owner runs it                                                                                                                                                                            | Retained decision                              |

### Inputs the build needs

| #   | Item                                                                                                                       | Until it arrives                                                                                            | Status           |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------- |
| I1  | Field of view; fibre or rod-lens optics; optic and channel positions on the tip; grip and eyepiece anchors                 | Authored visualisation parameters, labelled as such                                                         | Unresolved input |
| I2  | Dimensions on which manufacturer documents disagree; sleeve outer diameter                                                 | One sourced value is modelled and marked unresolved                                                         | Unresolved input |
| I3  | CAD, instructions for use, brand kit, tower references, talc delivery                                                      | A request packet is drafted for the owner to send                                                           | Unresolved input |
| I4  | Clinical sources                                                                                                           | Written from open guidelines, statements and trials with exact locators. Every claim is queued NOT REVIEWED | Unresolved input |
| I5  | How far the collapsed lung sits from the port                                                                              | Authored, labelled, queued for clinical review                                                              | Review pending   |
| I6  | Browser, viewport, network and cache for each performance target                                                           | UNRESOLVED in the performance table                                                                         | Unresolved input |
| I7  | Measurements on M1, Iris Xe and A14 hardware; fellow orientation pilot; screen-reader pass; plausibility of the scope view | Prepared with blank forms. NOT TESTED or NOT RUN until done on the device or with the people                | Unresolved input |

## How a decision is recorded

Add a row to **Decided** with the next ID, the date, the decision in the owner's words, and where
it was made. Remove the matching row from **Open**. Do not edit an earlier decision: supersede it
with a new one that names it.
