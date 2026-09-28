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
| [Repository baseline](repository-baseline.md)           | Where the build started: commit, packages, policies, file boundaries                                                                        |
| [Handoffs](handoffs/)                                   | One per slice: what changed, what was checked, what was not                                                                                 |

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
