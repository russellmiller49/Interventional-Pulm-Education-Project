# Medical Thoracoscopy — claim review queue

_Printed from the register by `scripts/medical-thoracoscopy/render-registers.ts`. Do not edit by hand._

Every statement the course teaches, and every rule the simulation follows, is a claim with an entry here. Nothing in this register is clinical approval. Every decision reads NOT REVIEWED: no reviewer, role, date or reviewed revision is recorded, and an empty decision is not approval. Device facts are held in the device definitions, with their own fact-check records.

## How to record a decision

Edit the claim in `src/features/medical-thoracoscopy/content/data/claim-register.json`. Replace NOT REVIEWED with your own decision, and give your name, your role, the date you decided and the commit you reviewed. A decision covers that claim at that revision and the surfaces listed for it. A later change to the wording or to the behaviour that depends on it reopens the claim.

## Claims (3)

### MT-C-0001, revision 1

> With the port open and the fluid drained, air enters the pleural space and the lung falls away from the chest wall.

| Field                   | Value                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Kind of claim           | authored simulation assumption                                                                                                           |
| Review lane             | clinical                                                                                                                                 |
| Context                 | An adult breathing spontaneously, lying on the side with the examined side up, with a free pleural space and no adhesions.               |
| Sources                 | No source has been read for this relationship yet. It is the one relationship the survey lesson cannot exist without.                    |
| Where it is shown       | section four-controls (planned); section systematic-survey (planned); prototype tool-contact (planned)                                   |
| Rules that depend on it | The lung state follows the learner's air-entry control.                                                                                  |
| Limitations             | The model shows a change of shape. It shows no pressure, no physiology and no rate, and it does not show a lung that fails to fall away. |
| Status                  | review pending                                                                                                                           |
| Shown before review     | Yes, labelled "Awaiting clinical review". Owner decisions, open item T2. A default, not a decision.                                      |
| Blocks publication      | Yes                                                                                                                                      |
| Decision                | NOT REVIEWED                                                                                                                             |

### MT-C-0002, revision 1

> In the collapsed state the lung surface sits at an authored distance from the port, chosen so that the survey has room to work.

| Field                   | Value                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| Kind of claim           | authored simulation assumption                                                                 |
| Review lane             | clinical                                                                                       |
| Context                 | The same patient and position as MT-C-0001.                                                    |
| Sources                 | The distance is chosen by the author. It is not measured and not taken from a source.          |
| Where it is shown       | section systematic-survey (planned); asset lung-states (planned)                               |
| Rules that depend on it | What the survey can reach and see depends on where the collapsed lung sits.                    |
| Limitations             | Illustrative. A real lung collapses by an amount that varies with the patient and the disease. |
| Status                  | review pending                                                                                 |
| Shown before review     | Yes, labelled "Authored, illustrative". Owner decisions, open item I5.                         |
| Blocks publication      | Yes                                                                                            |
| Decision                | NOT REVIEWED                                                                                   |

### MT-C-0003, revision 1

> The prototype places its one port in the right seventh intercostal space on the mid-axillary line.

| Field                   | Value                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Kind of claim           | authored simulation assumption                                                                                                           |
| Review lane             | clinical                                                                                                                                 |
| Context                 | This scan only. It is the highest space on the scan at which the skin, the chest wall and the gap between the ribs can all be measured.  |
| Sources                 | Chosen by the author from measurements of the scan. It is a teaching example and is not taken from a source.                             |
| Where it is shown       | section four-controls (planned); section systematic-survey (planned); asset port-record (planned)                                        |
| Rules that depend on it | The pivot, the corridor through the wall and the tilt limits all follow from the port.                                                   |
| Limitations             | A port site is chosen for each patient, with ultrasound. This one is never described as a safe site, a recommended site or a usual site. |
| Status                  | proposed change                                                                                                                          |
| Shown before review     | Yes, labelled "Authored construct". Owner decisions, open item T6. A default, not a decision.                                            |
| Blocks publication      | Yes                                                                                                                                      |
| Decision                | NOT REVIEWED                                                                                                                             |

This does not change publication status or constitute clinical approval.
