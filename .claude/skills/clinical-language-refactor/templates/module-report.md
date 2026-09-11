# <Module> — clinical language pass

Status: not_started | inventoried | edited | validated | needs_review | complete_with_documented_limits

This file is public. Quote the module's own copy and give source locators; never paste transcript
text.

## Scope

- Module, route and canonical copy files:
- Mode, brief and authorized batch:
- Branch, worktree, baseline commit and pre-existing changes:
- Audience and locales (localized? es and zh-CN follow-up needed?):
- Profiles used; style baseline consulted:
- Sources actually reviewed (locators only):
- Missing sources and their effect:

## Coverage

| Surface                                            | Located | Reviewed | Changed | Retained | E2 hold | Unreviewed |
| -------------------------------------------------- | ------: | -------: | ------: | -------: | ------: | ---------: |
| Navigation and headings                            |         |          |         |          |         |            |
| Lessons and explanations                           |         |          |         |          |         |            |
| Controls, readouts and tooltips                    |         |          |         |          |         |            |
| Figures, captions and accessible names             |         |          |         |          |         |            |
| Items: stems, options, hints, rationales, debriefs |         |          |         |          |         |            |
| Glossary, resources and exports                    |         |          |         |          |         |            |

Counts are items, not percentages. Mark a surface n/a rather than counting it as reviewed.

## Changes

| File and key or line | Before | After | Class | Why the meaning is preserved | Source locator |
| -------------------- | ------ | ----- | ----- | ---------------------------- | -------------- |

List every meaning-sensitive change and representative mechanical ones; the full record can live in
`<module>.ledger.csv`.

## Terminology decisions

| Context | Preferred term | Accepted aliases | Rejected replacement | Basis | Draft or owner-approved |
| ------- | -------------- | ---------------- | -------------------- | ----- | ----------------------- |

## Gate collisions and overrides

| Location | Clinical term | Gate | Resolution: rephrased, documented override, or raised with the owner |
| -------- | ------------- | ---- | -------------------------------------------------------------------- |

## Clinical-review queue (E2)

| Ticket | Existing text and location | Concern | Evidence available | What needs review | Action taken |
| ------ | -------------------------- | ------- | ------------------ | ----------------- | ------------ |

Include suspected pre-existing problems rather than hiding them in a copy-only diff. An AI review is
not physician approval.

## Protected contracts

State how each was checked, and any authorized exception: numbers and units; equations and
thresholds; negation and qualifiers; laterality, age and sex; procedure order; citations and
endpoints; model bindings; ids and keys; routes; progress and analytics; translation keys; choice
order and keys; scoring and branching; reveal stage; deny patterns updated; key-length balance
measured; `reviewStatus` of reworded items.

## Validation

| Command or check | Baseline | After | Evidence | Owner and next step |
| ---------------- | -------- | ----- | -------- | ------------------- |

Use `not_run` when a check could not run. Name the rendered states you inspected, with viewport and
locale; reading source is not render verification.

## Handoff

- Changed files and why:
- Intentionally unchanged:
- Reworded items awaiting review:
- Open E2 tickets:
- Remaining surfaces or modules:
- Next bounded task:
- PR, or "not opened":

## For the PR description

Scope · representative before/after pairs · integrity checks · validation · **Needs physician
subject-matter review**: the E2 tickets, reworded items still awaiting review, and any claim dropped
rather than restated without a source.
