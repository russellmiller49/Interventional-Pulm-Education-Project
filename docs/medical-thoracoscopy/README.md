# Medical Thoracoscopy — module documents

A new top-level course at `/medical-thoracoscopy`: nineteen Learn sections in five chapters, seven
practice scenarios, four integrated cases and full-3D experiences, taught on the Richard Wolf
Mini-Thoracoscopy Set. Richard Wolf sponsors the module. The owner keeps editorial control.

The module is in development. Nothing here is published, clinically reviewed, fact-checked by the
manufacturer or cleared for rights unless a record in this folder says so, names who decided, and
gives the date.

## Read in this order

| Document                                                | What it settles                                                                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [Owner decisions](owner-decisions.md)                   | What the owner has decided, and what is still open with the default being built                                                             |
| [Implementation manifest](implementation-manifest.json) | The imported inventory: sections, scenarios, cases, controls, spine, budgets, gate criteria. Each item names the plan and line it came from |
| [Plan reconciliation](plan-reconciliation.md)           | The three planning layers, where they differ, and which one governs                                                                         |
| [Learning contract](learning-contract.md)               | How the course treats the learner: self-paced, explanation first, nothing graded                                                            |
| [Fidelity contract](fidelity-contract.md)               | What each 3D experience does and does not represent                                                                                         |
| [Module plan](module-plan.md)                           | Learner, spine, controls, the one diagnostic table, and the order concepts are taught in                                                    |
| [Section authoring guide](section-authoring-guide.md)   | How to write one section                                                                                                                    |
| [Review lanes](review-lanes.md)                         | Who reviews what, kept separate: clinical, manufacturer, rights                                                                             |
| [Device register](registers/device-register.md)         | Every device fact, where it was read, and what is still not known. Printed from the device definitions                                      |
| [Claim review queue](registers/claim-review-queue.md)   | Every claim awaiting a reviewer. Printed from the claim register                                                                            |
| [Source register](registers/source-register.md)         | The literature and the anatomy dataset, with how much of each was read                                                                      |
| [Rights register](registers/rights-register.json)       | What the module may do with each thing it uses, and what may not be uploaded                                                                |
| [Asset ledger](registers/asset-ledger.json)             | Every file the module serves, against its budget                                                                                            |
| [Performance table](registers/performance-table.json)   | The targets, and what has been measured against them                                                                                        |
| [Traceability](registers/traceability.json)             | For each experience: outcome, content, claims, assets, tests, decisions, evidence                                                           |
| [Attribution](ATTRIBUTION.md)                           | Credit and licence for the anatomy, and how the instruments are labelled                                                                    |
| [Sponsorship policy](../sponsorship/POLICY.md)          | Draft. Who decides what when a module is sponsored                                                                                          |
| [Repository baseline](repository-baseline.md)           | Where the build started: commit, packages, policies, file boundaries                                                                        |
| [Handoffs](handoffs/)                                   | One per slice: what changed, what was checked, what was not                                                                                 |

## Device kit

The instrument models are built from the device definitions by
`scripts/medical-thoracoscopy/build_device_kit.py` and served from
`public/models/medical-thoracoscopy/v1/devices/`, listed in its `manifest.json`. Values the
manufacturer has not published were measured from its product-animation stills: the record is
`src/features/medical-thoracoscopy/content/data/reference-measurements.json`, written by
`measure_reference_frames.py`, and every value there is a derived measurement with a tolerance.
The order the scripts run in, and what each checks, is in the
[device-kit handoff](handoffs/mt-02a-device-kit.md).

## Written sections

A section is data: one file in `src/features/medical-thoracoscopy/content/sections/`, in the shape
`content/types.ts` gives, checked by `content/sectionValidation.ts` as the section index loads. The
regions a survey visits are one list, `content/data/pleural-zones.json`, which the lessons and the
anatomy asset both read. A section can be written before the lesson that shows it exists; a learner
can open it only once the curriculum marks it available. Sections 6, 7 and 11 are written; see the
[survey-specs handoff](handoffs/mt-03a-survey-specs.md).

## Status words

Every open item in these documents carries one of five statuses, taken from the revised plan:

| Status                              | Meaning                                                      |
| ----------------------------------- | ------------------------------------------------------------ |
| Retained decision                   | Decided in an earlier plan and kept                          |
| Proposed change                     | Put forward for the owner; not decided                       |
| Unresolved input                    | A fact or file the build needs and does not have             |
| Review pending                      | Written, waiting for a named reviewer                        |
| Accepted with attributable approval | A named person decided, on a date, against a stated revision |

Claim and asset records use **NOT REVIEWED** until a reviewer records a decision. An empty
decision is not approval. Measurements that were not taken are **NOT TESTED**; checks that were not
run are **NOT RUN**.

## Rules that hold across every slice

- The planning documents, the CT, the segmentation, manufacturer documents and the Wolf reference
  images stay outside the repository. They are read in place.
- The repository is public. Sponsor correspondence, contract terms, contact names and the list of
  discrepancies between manufacturer documents stay in the owner's local data.
- Manufacturer images are reference only. They are never committed, never uploaded, and no model
  carries a manufacturer mark.
- The shared lesson stage is used, not edited.
- No new dependencies.
- A green test run is not clinical approval.
