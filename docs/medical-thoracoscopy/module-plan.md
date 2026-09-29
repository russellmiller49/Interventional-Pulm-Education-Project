# Medical Thoracoscopy — module plan

The plan a section author works from. Inventory items are imported in the
[implementation manifest](implementation-manifest.json); this document arranges them into a course.

Concept statements below are **authoring intent**. Each becomes a claim in the claim register,
with a source and a review decision, before it is taught. Nothing here has been clinically
reviewed.

## Learner

|                                   |                                                                                         |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| Primary                           | IP and pulmonary fellows and attendings starting thoracoscopy                           |
| Secondary                         | Nurses and techs, for the room section                                                  |
| Assumed, linked and not re-taught | Pleural ultrasound, thoracentesis and drains, fluid analysis, malignant effusion basics |
| Target                            | "Knows how". Not procedural competence                                                  |

## Spine

The procedure timeline is the outline and the learner's "you are here":

**Decide → Set up → Enter → Make room → Survey → Sample → Treat → Finish**

Every term, signal and control is introduced at its place on this line. In 3D sections one Chest
view shows where the learner is.

## The control panel

> You change four things: where the port goes; where the scope points (pivot, depth, roll); which
> tool is in the channel; what is in the space (fluid out, air in).

Everything else is watched or managed by the team: the lung, the heart, the diaphragm, breathing
and sedation. The four are controls **of the model**, and are labelled that way. Whether to
proceed, sample, treat, stop or escalate is a separate procedural decision guide.

The second item is reworded for the learner as "where the scope looks (pivot, depth, roll)";
see [owner decisions](owner-decisions.md), T8.

## The one diagnostic table

**Reading the pleura**: what you see → where → consider → next move. An authored construct, with
every row sourced before it is taught.

| Row                                         |
| ------------------------------------------- |
| Discrete nodules or masses                  |
| Diffuse thickening                          |
| Innumerable small nodules with inflammation |
| Pearly plaques                              |
| Fibrin and septations                       |
| A visceral peel with a non-expanding lung   |
| Inflamed but no focal lesion                |

The table is built once, in section 12. Later sections point at a row. None restates it.
Appearances support a differential. They do not establish histology.

A second reusable table serves procedural complications: **step → hazard → early sign → first
response**. It is built in section 18 and its responses are clinically reviewed before any of
them becomes an interactive consequence.

## The ladder

One new concept per section. "Rests on" names the earlier sections that teach what this one
needs. No section rests on a later one.

|   # | Section                 | Chapter                  | Stage       | The one new concept                                                      | Rests on           | Used again by     |
| --: | ----------------------- | ------------------------ | ----------- | ------------------------------------------------------------------------ | ------------------ | ----------------- |
|   1 | `why-thoracoscopy`      | Decide                   | Orientation | The clinical questions that looking inside answers                       | Assumed background | 2, 12, C1–C4      |
|   2 | `patient-selection`     | Decide                   | Foundation  | What makes someone a candidate, and what rules them out                  | 1                  | 8, 9, P1, C1–C4   |
|   3 | `the-instrument`        | Equipment and anatomy    | Foundation  | One telescope carries the optic and the working channel through one port | 1                  | 4, 7, 13, 14      |
|   4 | `room-and-tower`        | Equipment and anatomy    | Foundation  | Each connection has one destination, and the sight line sets the room    | 3                  | 14                |
|   5 | `the-chest-wall`        | Equipment and anatomy    | Foundation  | The layers crossed, and where the intercostal bundle runs                | Assumed background | 8, 9, 13          |
|   6 | `normal-pleural-space`  | Equipment and anatomy    | Foundation  | The named regions of a normal hemithorax and their landmarks             | 3, 5               | 7, 11, 12         |
|   7 | `four-controls`         | Access and orientation   | Mechanism   | The port is a pivot: the hand and the tip move opposite ways             | 3, 6               | 8, 10, 11, 13     |
|   8 | `choosing-the-port`     | Access and orientation   | Mechanism   | The port decides what can be reached                                     | 5, 7               | 9, P1             |
|   9 | `entry`                 | Access and orientation   | Mechanism   | Crossing the wall into a space confirmed beforehand                      | 5, 8               | 10, 18            |
|  10 | `making-room`           | Access and orientation   | Mechanism   | Working space comes from fluid leaving and air entering                  | 7, 9               | 11, 15, 17, P2    |
|  11 | `systematic-survey`     | Survey and intervention  | Application | A survey is an order, recorded region by region                          | 6, 7, 10           | 12, 13, P3        |
|  12 | `reading-the-pleura`    | Survey and intervention  | Application | What is seen, and where, narrows what to consider                        | 6, 11              | 13, 16, P3, C1–C4 |
|  13 | `taking-biopsies`       | Survey and intervention  | Application | Where and how a parietal sample is taken                                 | 5, 7, 12           | 14, P4            |
|  14 | `energy-and-bleeding`   | Survey and intervention  | Application | What the electrodes do, and the first response to bleeding               | 3, 4, 13           | 18, P6            |
|  15 | `adhesions`             | Survey and intervention  | Application | Kinds of band, and what a lung that will not fall away limits            | 10, 11             | 16, P2            |
|  16 | `talc-poudrage`         | Survey and intervention  | Application | Poudrage depends on the surfaces meeting                                 | 12, 15             | 17, P5, C2, C4    |
|  17 | `finishing`             | Finish and complications | Application | The drain, and what re-expansion depends on                              | 10, 16             | 18, P7            |
|  18 | `complications`         | Finish and complications | Integration | Step, hazard, early sign, first response                                 | 9–17               | P6, P7            |
|  19 | `what-completion-means` | Finish and complications | Integration | What the course shows and what supervised training adds                  | All                | —                 |

The chapter column follows the proposed assignment (owner decision T1, open).

### Order rules the ladder keeps

- **Normal before abnormal.** Section 6 shows a normal space before section 12 shows disease.
- **Controls before troubleshooting.** Section 7 sets out the four controls before any section
  asks what to do when something resists.
- **Complexity in counted steps.** Each section states how many ideas are new. Section 13 is
  "the survey, plus one tool". Section 16 is "the survey, plus one agent".
- **Retrieval straight away, cases later.** A section ends with one or two short applications.
  P1–P7 and C1–C4 are separate, and are paired to sections by mechanism.

## The first round: sections 6, 7 and 11

Section 11 rests on section 10, which is not written in this round. Two things keep 11 honest
until 10 exists:

- Section 7 introduces the fourth control, "what is in the space", so section 11 may use it.
- Section 11 opens from a loaded teaching example, labelled as one: the port is in and the fluid
  is out. It says that how working space is made is taught in section 10, which is in preparation.

Section 11 surveys a **normal** space. Disease appears first in section 12. The tool-contact
prototype uses one illustrative nodule and is not part of the curriculum.

## Practice and cases

| ID  | Title                              | Paired with |
| --- | ---------------------------------- | ----------- |
| P1  | High hemidiaphragm                 | 8           |
| P2  | Lung won't fall away               | 10, 15      |
| P3  | Scattered parietal nodules         | 11, 12      |
| P4  | Over the rib vs in the groove      | 13          |
| P5  | Non-expandable lung at the end     | 16          |
| P6  | Bleeding after a biopsy            | 14          |
| P7  | Air leak or subcutaneous emphysema | 17, 18      |

| ID  | Title                                                |
| --- | ---------------------------------------------------- |
| C1  | Undiagnosed lymphocytic exudate                      |
| C2  | Recurrent malignant effusion with an expandable lung |
| C3  | Asbestos exposure with plaques and nodularity        |
| C4  | Malignant effusion with a non-expandable lung        |

Only titles and pairings exist. Stems, choices and explanations are authoring work for a later
milestone.

## What the model leaves out

Stated to the learner where each applies.

- No haptics, tissue forces or bleeding physiology.
- Pressure is shown as qualitative authored states.
- Pathology and the talc spray are illustrative.
- Anatomy the scan doesn't contain (pleura, intercostal muscles, NV bundles) is authored teaching
  geometry.
- Sedation, energy settings and reprocessing follow the IFU and local protocol.
- Completing the module is not competence.

Added by the scan this module uses: it was taken supine with the arms down, so the chest wall is
shown as scanned and not as positioned for the procedure; and the ribs are rigid in the model,
with no yielding of the chest wall.

## Sources available

| Class                     | Sources                                                                                                                                                                                                                      | Note                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Guidelines and statements | BTS pleural guideline and pleural procedures statement, _Thorax_ 2023;78 Suppl 3, with its online appendix on medical thoracoscopy; WABIP/AABIP statement, _Eur Respir Rev_ 2026;35:250327; ERS/EACTS 2018; ATS/STS/STR 2018 | The WABIP/AABIP document concerns benign pleural disease and is a consensus statement, not a guideline |
| Trials                    | TAPPS, _JAMA_ 2020;323:60; TACTIC, _Lancet Respir Med_ 2026;14:341–349; Wang et al., _Chest_ 2026;169:269–279                                                                                                                | Each is taught with its population, endpoint and limits                                                |
| Textbooks                 | Named in the original plan                                                                                                                                                                                                   | Not available to the build. Not cited until they are                                                   |
| Manufacturer              | Sell sheet, catalogue, brochures, device database entries, instructions for use                                                                                                                                              | Device facts only. Instructions for use have not been supplied                                         |
| Authored construct        | Survey zones, the diagnostic table, lung states, the port choice                                                                                                                                                             | Labelled as authored wherever shown                                                                    |

Citations are checked against PubMed or the publisher in the source register before a section
uses them. Every claim is NOT REVIEWED until a named reviewer records a decision.
