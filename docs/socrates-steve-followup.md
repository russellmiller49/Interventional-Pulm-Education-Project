# SOCRATES authoring and curriculum follow-up

Scope: SOCRATES only, following merged PR #270. Base:
`4bd1368d13cb297b7076f4d7655de849f444e0ff`. Fresh branch:
`codex/socrates-steve-followup-20260923`. No overlapping SOCRATES open PR
was found at preflight. Existing worktrees and drafts were preserved.

## Design and preservation

The learner is reviewing histology images with authored interpretations. This
change repairs author preview and curriculum navigation, without changing clinical
statements, scoring, study design or competence claims. The existing SOCRATES
viewer and reveal flow remain the reference; a critical-care stage migration is
outside this task.

- Training and draft preview share `TrainingLesson` and `StudyViewer`. The draft
  controller uses allowlisted projections and local reveal state only. It does not
  mount the participant controller or call progress, enrollment or save APIs.
- A verbatim learner narrative is an optional v2 extension. It is canonical when
  present: classification fields are derived from explicit source labels; independent
  structured teaching fields cannot silently contradict it. Source provenance and
  original cell values stay in protected author metadata. Neither reaches initial
  learner/testing projections.
- Modules have stable identities, authored purposes, display order, recommended-start
  metadata and planned counts. Membership references existing case UUIDs with a
  separate position and source order. Release approval is separate from source
  membership. Case documents, diagnosis categories and study revisions are not
  duplicated or reordered.
- The bounded operator workflow inspects the original workbook, reconciles both
  sheets, maps case number plus series and actual image identity, then produces a
  private plan. Explicit apply uses optimistic revisions and one database transaction.
  This task applies only synthetic fixtures to a disposable database.

## Baseline and reproduction

Baseline: 21 SOCRATES suites / 135 tests passed. Two new synthetic tests failed at
the missing unsaved vignette in both browser and protected draft previews before
the repair. The repaired preview tests pass, including zero participant API/save
calls, no regions, reveal boundaries and return to editing.

The workbook SHA-256 was independently rechecked:
`f4a06fb8ccb06f7993fcfca156c4138df0bc4368e100a0444366c68e7ff2f279`.
The workbook's Case 041 / Series 4 provides a private local reproduction; it is
source position 6. It is **not** evidence of the saved live draft. Actual saved
Case 41, production deployment SHA and remote migration state remain NOT VERIFIED.

## Source decisions remain open

The source contains 59 case-series entries and 55 case numbers, rather than the
email's approximate 50. The six planned module counts are 20/5/8/14/6/6.
All source case-series to database UUID/image matches require owner reconciliation.
The core/advanced conflict and two possible exclusions remain held in private
plans. The actual provider annotation key also needs review. Planned counts do
not establish release approval or availability.

See [the author guide](socrates-author-guide.md). Final validation and the precise
review disposition will be appended after implementation.
