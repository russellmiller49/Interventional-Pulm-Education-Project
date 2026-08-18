# R0 — outcome of the attempted B5 human think-aloud sessions

**This record reports a study outcome, not study findings.** The B5 novice think-aloud sessions
were attempted and did not produce codable per-task observations. What is written below is
limited to what the owner reported. No participant identity, quotation, timing, task score,
completion count, or severity rating appears here, because none was recorded in a form this
repository can cite.

This document exists for one purpose: to be the honest evidentiary basis for
[`r0-redesign-baseline-decision.md`](./r0-redesign-baseline-decision.md), which retires the B5
freeze over learner-facing flow. A decision to change frozen content needs a stated reason; this
is the stated reason, with its limits attached.

- Build under test: the frozen production SHA `2f26cb7632fe4e8f6835a8528458b672e8f360c2`.
- Verified 2026-08-15: every one of the twenty-eight files pinned by the B5/B6 frozen-baseline
  table is still byte-identical on `origin/main` at `14df243f`. The six pilot teaching panels,
  all Learn and Practice content files, both engine files, the progress contract, and the four
  route pages hash exactly as recorded. The only `src/features/cardiohelp-ecmo/` changes merged
  since the freeze are the B7 3D-asset commits (`EcmoCircuit3D.tsx` and `ecmo-circuit/*`).
  The learner-facing build that the sessions met is therefore the build on `main` today.
- Session dates, facilitator identity, participant count, and recruitment source: **not recorded
  in this repository.** They are deliberately left blank rather than reconstructed.

---

## 1. Directly observed

Reported by the owner as first-hand observation of the attempted sessions. Each line is the
whole of what is claimed; nothing is extrapolated from it.

| #   | Observation                                                                                                                                                                   | Source class      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| O-1 | Human think-aloud sessions were attempted against the frozen build.                                                                                                           | Owner observation |
| O-2 | Confusion about module flow and navigation prevented learners from completing the intended task sequence in a meaningful way.                                                 | Owner observation |
| O-3 | Facilitator intervention became excessive — the facilitator had to intervene often enough that the sessions stopped being think-aloud observation of independent use.         | Owner observation |
| O-4 | The intended downstream clinical evaluations were therefore never validly tested. Learners did not reach them under conditions that would make their responses interpretable. | Owner observation |

O-2 and O-3 together are why the outcome is described as **task-blocking**: the instrument
measured navigation, not the clinical reasoning it was built to measure.

## 2. Owner interpretation

Marked as interpretation. It is a reading of the observations above, not an additional
observation, and it is not human evidence for any specific defect.

- **I-1.** The leading structural explanation is the entry and ordering conflict already
  recorded from source inspection as B6-011: the module hub's primary call to action sends a
  new learner to `startup-sensor-orientation`, which is position seven of a seventeen-section
  pathway, while both track pathways open at `why-extracorporeal-support` and the Learn landing
  page tells the learner to start with the physiology. A learner routed past the first six
  sections meets the console drill without the vocabulary those sections carry.
- **I-2.** Because the sessions did not produce per-task records, I-1 is not confirmed by human
  evidence. It is the hypothesis the redesign acts on, chosen because it is independently
  verifiable in source and because acting on it is low-risk and reversible.
- **I-3.** Content quality was not evaluated. Nothing in this outcome supports or refutes any
  claim about the teaching quality of any section, panel, prediction item, or case.

## 3. Information not captured

The B5 instruments in [`../validation/`](../validation/) define the fields a completed session
record would contain. For these attempted sessions, the following are **unavailable**, not
merely unreported:

- Per-participant records of any kind: identity, role, training stage, prior ECMO exposure.
- Participant count, and how many sessions reached which task.
- Verbatim or paraphrased participant speech. No quotation exists to cite.
- Per-task outcome codes and the failure classifications defined in
  [`b5-novice-scoring-rubric.md`](../validation/b5-novice-scoring-rubric.md).
- Timing data, task durations, and abandonment points.
- The specific screens, controls, or copy each learner was looking at when confusion occurred.
- Which cues, labels, or navigation elements were named by learners as the source of confusion.
- Severity ratings, and any prevalence statement whatsoever.
- Accessibility or assistive-technology observations.

[`b5-novice-findings-template.md`](../validation/b5-novice-findings-template.md) **stays empty.**
It is the record of completed novice validation, and no novice validation completed. Nothing in
this document may be copied into it.

## 4. Tasks not tested

Every task in [`b5-novice-participant-tasks.md`](../validation/b5-novice-participant-tasks.md)
is recorded as **not validly tested**. The six pilot scenarios
(`startup-sensor-orientation`, `preload-drainage-collapse`, `vv-recirculation`,
`gas-source-interruption`, `arterial-bubble-stop`, `va-differential-hypoxemia`) and every
clinical discrimination they were written to probe remain without human evidence.

## 5. Consequence for the B6 synthetic register

The B6 package (draft [PR #94](https://github.com/russellmiller49/Interventional-Pulm-Education-Project/pull/94),
head `3860181e`) generated twenty backlog items, twenty-three owner decisions, and a set of
synthetic learner hypotheses, all explicitly awaiting human reconciliation. Its reconciliation
workflow requires mapping each synthetic item to a human finding.

**That workflow cannot be executed against these sessions.** There are no codable human findings
to map. Accordingly:

- Every B6 synthetic hypothesis retains the disposition **not tested**. None is supported, and
  none is refuted, by this outcome.
- Every B6 backlog item keeps the priority it was admitted with. This outcome re-ranks nothing.
- Absence of a human comment is not evidence about any item. Silence here is the absence of a
  measurement, not a negative result.
- The reconciliation template is ported forward with an explicit outcome path for exactly this
  situation; see [`r0-pr94-migration-matrix.md`](./r0-pr94-migration-matrix.md).

## 6. What a future human round requires

Recorded so the next attempt is not a repeat:

1. A newly declared baseline commit, stamped the way the B6 record stamped `2f26cb76`. The
   redesign baseline decision names when that happens.
2. A navigation-competence check before the clinical tasks begin: whether a learner can find the
   intended starting point and move between sections unaided. If that check fails, the clinical
   tasks are not interpretable and the session should stop there — which is the outcome these
   sessions reached implicitly.
3. A facilitator-intervention log, so "excessive intervention" becomes a recorded quantity
   rather than an impression.
4. Session records complete enough that per-task dispositions can be written without
   reconstruction.

---

_No synthetic-agent behaviour is reported anywhere in this document. No human observation beyond
the four lines in section 1 is claimed._
