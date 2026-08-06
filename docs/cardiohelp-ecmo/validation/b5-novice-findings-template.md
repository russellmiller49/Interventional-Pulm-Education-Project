# B5 novice think-aloud — findings

> **No human findings have been entered yet.** No think-aloud session has been run against the B5
> vertical slice. Every table below is an empty template. Until rows appear here that come from
> observed human sessions, the ECMO Learn slice has **not** been validated with learners, and no
> document, commit message, or pull request should say otherwise.

This file is the only place in the repository where a human observation becomes part of the record.
Automated checks, expert review, and browser preflight are recorded separately in
[`b5-vertical-slice-validation-summary.md`](./b5-vertical-slice-validation-summary.md) and are not
findings in this sense.

---

## Session log

Add one row per completed session. Participant code only.

| Participant  | Date | Exposure category (A/B/C/D) | Viewport(s) | Tasks completed | Facilitator | Observation form filed |
| ------------ | ---- | --------------------------- | ----------- | --------------- | ----------- | ---------------------- |
| _(none yet)_ |      |                             |             |                 |             |                        |

**Sessions run: 0. Participants: 0.**

---

## Findings

One row per distinct finding, consolidated across participants. A finding seen in more than one
session names every participant who showed it.

| #            | Observation | Evidence | Scenario | Viewport | Participants | Severity (S1–S4) | Outcome codes | Failure class (F1–F6) | Likely root cause | Recommended change | Change type | Owner decision required? | Status |
| ------------ | ----------- | -------- | -------- | -------- | ------------ | ---------------- | ------------- | --------------------- | ----------------- | ------------------ | ----------- | ------------------------ | ------ |
| _(none yet)_ |             |          |          |          |              |                  |               |                       |                   |                    |             |                          |        |

### Column definitions

- **Observation** — what the participant did or said, not your interpretation of it.
- **Evidence** — a direct quote, a timestamp, or a screenshot reference. A finding with no evidence
  is a hypothesis; put it in _Open questions_ instead.
- **Scenario** — one of the six pilot scenario ids, or `cross-cutting`.
- **Viewport** — where it was observed. A finding seen at only one viewport says so.
- **Severity** — from [`b5-novice-scoring-rubric.md`](./b5-novice-scoring-rubric.md) §3.
- **Failure class** — rubric §2. `F5` (learner knowledge gap) means no change is owed; say so.
- **Likely root cause** — a hypothesis, and labelled as one until a change is shown to fix it.
- **Change type** — `content` · `UI` · `engine` · `test` · `docs`. An **engine** change needs a
  reproducing failing test first and is the only type that may touch simulation behaviour.
- **Owner decision required?** — `yes` for anything that would alter a landed contract, a persistent
  identifier, the scope of the six-scenario slice, Practice/Assess behaviour, or a clinical claim not
  already supported by authored evidence. Those stop and go to the module owner.
- **Status** — `open` · `accepted` · `in progress` · `fixed` · `wont-fix (reason)` · `needs owner`.

---

## Safety-critical misunderstandings

Any **O6**. Every row here must record that it was corrected with the participant at debrief.

| #            | What the participant believed | Verbatim | Scenario | Corrected at debrief? | Change made | Status |
| ------------ | ----------------------------- | -------- | -------- | --------------------- | ----------- | ------ |
| _(none yet)_ |                               |          |          |                       |             |        |

---

## Model-boundary misreads

**F6** specifically — the learner read "this simulation does not model X" as "X does not matter".
Tracked apart because this module teaches with explicitly bounded abstractions (pump-off pressures,
the VA mixing point, the bubble-resumption sequence) and this is its most exposed failure mode.

| #            | Boundary | What the learner took it to mean | Scenario | Participants | Recommended rewording | Status |
| ------------ | -------- | -------------------------------- | -------- | ------------ | --------------------- | ------ |
| _(none yet)_ |          |                                  |          |              |                       |        |

---

## What did not come up

Record what you expected to see and did not. Absence is evidence too, and it stops the next reader
assuming a risk was tested when it was not.

| Expected observation | Sessions it did not appear in | Reading |
| -------------------- | ----------------------------- | ------- |
| _(none yet)_         |                               |         |

---

## Open questions

Things a session raised that the packet cannot answer — including any content question a participant
asked that the module does not address.

| #            | Question | Raised by | Who can answer | Status |
| ------------ | -------- | --------- | -------------- | ------ |
| _(none yet)_ |          |           |                |        |

---

## Sign-off

Complete only when sessions have actually been run.

- Sessions run: `0`
- Participants: `0` (target 4–6, at least two from category A or B)
- Findings raised: `0` · S1: `0` · S2: `0`
- All S1 findings resolved or accepted by the owner: **n/a — no sessions run**
- Human novice validation status: **not started**

**Anyone reading this file should take the line above as the current, complete answer to "has this
been validated with learners?"**
