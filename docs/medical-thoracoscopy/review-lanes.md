# Medical Thoracoscopy — review lanes

Three reviews, kept separate. A decision in one lane says nothing about the others.

| Lane                   | Decides                                                                               | Does not decide                                                       | Reviewer     |
| ---------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------ |
| Clinical and editorial | Evidence selection, clinical teaching, scenario consequences, what the model may show | Device facts, rights                                                  | Not assigned |
| Manufacturer           | Device facts, part numbers, market availability, trademark use                        | Clinical teaching, source selection, comparative claims, learner data | Not assigned |
| Rights                 | Permission to distribute a named asset or derivative                                  | Whether the asset is accurate                                         | Not assigned |

The owner assigns reviewers. Until then every record reads NOT REVIEWED, with no reviewer, role,
date or reviewed revision. An empty decision is not approval.

An independent sanity review and a fellow pilot are separate again. They are evidence for the
owner, not approvals.

## What a decision records

| Field             | Rule                                    |
| ----------------- | --------------------------------------- |
| Item              | The claim or asset ID and its revision  |
| Decision          | One of the values the register defines  |
| Reviewer          | A named person. Never an AI system      |
| Role              | Their role in this review               |
| Date              | The day they decided                    |
| Reviewed revision | The commit or asset hash they looked at |
| Limits            | What the decision does not cover        |

## When a decision lapses

Approval belongs to the revision that was reviewed. A material change to wording, model
behaviour, optics, device configuration or an asset reopens every claim and experience that
depends on it. Approval is never inherited by a later revision.

## Sponsor independence

Richard Wolf sponsors the module. The owner keeps editorial control.

- The manufacturer's review covers device facts, market availability and trademarks.
- Sponsor feedback does not approve comparative clinical claims and does not select evidence.
- No sponsor tracking is added. Any report to the sponsor uses a data source that already exists
  and is already authorised.
- Preparing or sending the request packet implies no permission and no approval.

## Five separate states

Implementation complete, independently reviewed, merged by the owner, deployed, and published.
None implies the next. Publication is the owner's own pull request.
