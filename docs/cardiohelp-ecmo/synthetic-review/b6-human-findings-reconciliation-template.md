> **Ported record.** Body verbatim from draft
> [PR #94](https://github.com/russellmiller49/Interventional-Pulm-Education-Project/pull/94)
> at head `3860181e`, brought onto `main` by R0 so the reconciliation structure survives for the
> next human round. Nothing below this block was edited.
>
> **Outcome of the first attempt — read before using this template.** The B5 sessions against
> `2f26cb76` were attempted and ended in a task-blocking navigation failure: they produced no
> per-task human records, so no reconciliation record could be written for any synthetic item.
> Every B6 hypothesis therefore holds the disposition **not tested**, and that is a recorded
> absence of measurement, not a refutation. The full outcome, with its explicit
> not-captured and not-tested lists, is
> [`../redesign/r0-b5-pilot-outcome.md`](../redesign/r0-b5-pilot-outcome.md).
>
> **Using this template for the next round:** the session-and-baseline block below must be
> re-stamped with the newly declared baseline commit — `2f26cb76` is retired as a testing
> baseline — and the round should record a navigation-competence result before its clinical
> tasks, so a repeat of this failure mode is visible in the data rather than only in
> retrospect.

No human observation is being reported.

# B6 human-findings reconciliation template

Use this only after the frozen B5 think-aloud sessions have been completed and recorded in the human-study materials. Do not copy synthetic-agent wording into a human finding, and do not treat the absence of a human comment as confirmation or refutation.

## Session and baseline record

- Human-test production SHA: `2f26cb7632fe4e8f6835a8528458b672e8f360c2`
- Human-session record or finding ID:
- Session date:
- Reconciler:
- Independent reviewer:
- Evidence reviewed (observation note, recording location, task, screen state):
- Was the human session run on the frozen SHA? Yes / No / Uncertain
- If no or uncertain, describe the build difference before interpreting the finding:

## One reconciliation record per synthetic item

- Synthetic artifact:
- Synthetic item ID or heading:
- Synthetic classification before human testing:
- Lesson / panel / shared surface:
- Human task in which the hypothesis was genuinely testable:
- Human finding ID(s):
- Verbatim human-observation excerpt or precise behavior record:
- Relevant browser state, action, and visible response:
- Contrary human evidence:

### Required disposition

Select exactly one:

- [ ] supported by human finding
- [ ] refuted by human finding
- [ ] not tested
- [ ] modified after human observation

### Interpretation

- Why the selected disposition follows from the human record:
- What the human record does **not** establish:
- Does this change priority? If yes, from / to and why:
- Does this create, close, or revise an owner decision?
- Does this expose a source or model-boundary question?
- Does it concern learner copy frozen in the six-pilot build?
- Does it concern only one of the fourteen B6 draft panels?
- Could the proposed change alter Practice, Assess, scoring, IDs, progress, storage, routes, or publication? Explain:
- Proposed automated regression test:
- Proposed browser regression check:
- Proposed content change, if any:
- Files in scope:
- Files explicitly out of scope:

## Disagreement record

- Reconciler conclusion:
- Independent reviewer conclusion:
- Unresolved disagreement or minority objection:
- Owner decision required before implementation:

## Merge-hold release checklist

- [ ] Every synthetic learner hypothesis has one disposition.
- [ ] Every confirmed B6 backlog item has been checked against the human record or marked not tested.
- [ ] Human findings were recorded independently before this synthetic package was consulted.
- [ ] No synthetic item was rewritten as if a person had produced it.
- [ ] Any six-pilot copy change has clinical, instructional, and safety review.
- [ ] Confirmed corrections have focused automated tests.
- [ ] Practice and Assess isolation has been rerun.
- [ ] Persistent ID, progress, storage, route, scoring, and publication contracts pass.
- [ ] Draft status and non-credit eligibility for all fourteen B6 panels are still explicit.
- [ ] The owner-decision document records all unresolved disagreements.
- [ ] A new independent reviewer has audited the reconciled diff.
- [ ] The draft PR hold is removed only by the repository owner after this checklist is complete.
