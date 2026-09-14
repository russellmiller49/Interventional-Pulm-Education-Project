# Self-paced learning — active design contract

Owner decision: September 14, 2026. Established in the repository by **G00**.

The nine modules below are self-paced educational resources. Examination intent is settled: no passing standard, exam-security decision, or fellowship-course architecture is required. This is the active policy for their conversions. It is a policy change and an implementation plan; **G00 does not claim that the current applications already comply**.

## Scope and authority

Applies to EBUS Guided, Bronchial Branch Tracing, Peripheral Bronchoscopy Imaging, Bronchoscopy Foundations, Cardiohelp ECMO, Baxter CRRT, ICU Hemodynamics, Mechanical Ventilation, and Mechanical Circulatory Support.

`src/features/device-intelligence` is not an educational module and is excluded from the audit and conversion. No Device Intelligence files or behavior may change. Shared changes require a demonstrated consumer need, a separate serialized integration slice, and evidence that excluded consumers retain their behavior. G00 changes no shared runtime code.

The owner-authorized G00 prompt and `LEARNING_DESIGN_BRIEF.md` from the September 14 v2 action pack govern this work. Their local source directory is `/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/roadmaps/IP-Education-Self-Paced-Action-Pack-v2/`. Read these sources in place using the [local-data rules](../../local-authoring-assets.md); do not copy the pack into Git. This document records the resulting repository policy, rather than relocating that source material.

This policy supersedes examination-oriented requirements in older module plans, the [critical-care activity contract](../../critical-care/activity-contract.md), earlier review reports, and teaching skills **for these nine modules**. Retain those records as historical evidence. The [test-contract ledger](test-contracts.md) identifies specific conflicts; supersession does not invalidate their safety, source, privacy, anatomy, or physics requirements.

## Learner experience

- Provide a recommended route, a visible outline with meaningful titles, and freedom to choose, revisit, repeat, or leave topics. Use a layout suited to the teaching object. There is no compulsory three-pane layout, common phase sequence, question quota, or analogy field.
- Retain a question only for a named teaching purpose. Record **keep / rewrite / replace / combine / remove**, preserving useful teaching even when its question is removed. Worked examples and visual comparisons are valid alternatives.
- Explanations are accessible before answering. Offer appropriate help, optional prediction/reveal, retry, and Continue without correctness requirements or penalties. A local reveal can defer its case-specific comparison until requested; it cannot hide foundational teaching, meaningful chapter titles, or other lessons.
- Give specific, useful feedback and immediate explanations of potentially harmful choices. Neither a wrong answer nor use of help may block navigation, require compulsory remediation, or create a learner grade.
- Remove learner-facing scores, percentage correct, pass/fail, mastery badges, streaks, ranks, timed exams, mandatory pretests, first-attempt/independence dashboards, and correctness-based recommendations. Preserve physiological/device numbers, image measurements, simulated time, and case trends.

## Separate navigation from genuine operations

Trace each predicate and its side effects before editing it. The [conversion map](conversion-map.md) distinguishes educational gates, simulation/data preconditions, and mixed predicates.

A learner can skip a question or leave a simulation without performing it. That must not fabricate an answer, prediction, acquisition, intervention, capture, measurement, or successful outcome. Showing a supplied example must say it is an example; it is not learner-acquired evidence. A visited topic is not a completed procedure.

Preserve device interlocks, valid run/capture conditions, signal validity, coordinate identity, reviewed action constraints, authentication, authorization, privacy/consent, media access, and source/release boundaries. Protective and emergency controls must not depend on a quiz answer. Remove the educational condition from a mixed predicate without disabling its operational protections. Do not implement a global bypass.

## Progress and historical data

Reuse existing module state/adapters for current location, visited topics, optional review-later/bookmarks, and optionally learner-marked review. Do not create a cross-module progress service, grading service, backend, or future-course schema.

Legacy attempts and scores remain read-only and unchanged. Do not delete, overwrite, recompute into replacement records, or infer new review/completion/competence from them. Current self-paced sessions must not write graded attempts, help histories, or independence analytics. In-session responses can drive feedback. Dormant scoring is permissible only when it has no effect on current access, recommendations, outcomes, or learner claims. Inspect hydration and save paths as well as explicit Submit handlers.

## Clinical, source, and media boundaries

Preserve engines, module-specific flows, assets, anatomical correspondence, source/model limitations, and numerical teaching. New clinical claims, source identities, dates, media rights, or review approvals must not be invented. Clinically meaningful changes remain pending attributable faculty/source review.

The reported MV-03 causal issue remains a priority independent of navigation infrastructure. Removing a score does not resolve misleading cause-and-effect teaching. Investigate the case under **prompt MV-01** with matched controls; **prompt MV-03** is the later question/source slice. Any unresolved misleading example needs a narrow exclusion in that implementation slice, not a disclaimer alone.

## Delivery and acceptance

Convert one bounded module slice at a time, including its Learn, Practice, former Assess/Challenge/capstone URLs, result panels, hub recommendations, and storage consumers. Legacy URLs must retain a useful learning destination. A label-only change is insufficient.

Use the [developer checklist](developer-checklist.md) and preserve relevant engine, source, media, safety, and data checks. Replace obsolete exam assertions explicitly; do not silently disable them or treat zero discovered tests as verification. Separate commands actually run, browser observations, source findings, external reports, and checks not run. Technical test results are not clinical approval.

No dependency, learning platform, publication, deployment, release-state change, or remote data mutation is authorized. Repository commit/push/PR delivery follows `AGENTS.md`; merging and deployment remain outside G00.

## G00 handoff documents

- [Nine-module conversion map](conversion-map.md)
- [Representative question-purpose ledger](question-ledger.md)
- [Old-to-new test contracts](test-contracts.md)
- [Reusable technical checklist](developer-checklist.md)
- [Bounded implementation sequence](implementation-plan.md)
- [Baseline evidence, holds, and handoff](G00-handoff.md)

## Implementation handoffs

- [MV-01 — causal investigation and self-paced entry paths](MV-01-handoff.md): all MV public entry/progress paths converted; the MV-03 live case is excluded pending faculty/RT modeling review. Includes the complete question ledger, preserved legacy-data contract and executed technical evidence. This does not change publication status or constitute clinical approval.
- [PI-01 — Peripheral Imaging self-paced pilot](PI-01-handoff.md): Learn, Practice, the former capstone (now integrated cases on the same address), hub and progress storage converted; changed test contracts, evidence, holds and next slice. This does not change publication status or constitute clinical approval.
- [EBUS-01 — EBUS Guided open course with optional checks](EBUS-01-handoff.md): Learn, Practice, the former Assess (now integrated cases on the same address) and progress storage converted; acquisition, held-image and record-task validity kept; full [question ledger](EBUS-01-question-ledger.md) (108 items). This does not change publication status or constitute clinical approval.
