# Mode: audit — inventory and proposals, no edits

The scope is the module or modules named. "All IP and critical-care modules" has to be said
explicitly.

1. Read the actual learner-facing copy and what renders it — not filenames, old reports or earlier
   examples. Record the baseline commit and any pre-existing changes.
2. Load only the relevant profiles and source passages. Imaging is a voice baseline, not a
   workflow or a word list.
3. Audit every surface listed in `SKILL.md` (workflow step 3), separating live copy from dead copy
   and from internal identifiers.
4. For each proposal, give the exact current string with its file and key or line, the proposed
   replacement, its class (E0, E1 or E2), the rationale, and a source locator wherever the meaning
   depends on a source. Keep patient facts, uncertainty, numbers, units, endpoints, urgency and
   conditions fixed; never invent a more specific referent.
5. Also look for gate collisions (repository map), answer-leaking titles and pre-commit surfaces,
   deny patterns that a rewording would leave stale, key-length imbalance, acronyms that mean
   different things in different domains, ambiguous set-versus-measured readouts, and words that
   are right in one specialty but awkward in this one.

Deliver `docs/clinical-language/<module>.md` with `Status: inventoried`: safe implementation
candidates, wording deliberately kept, E2 holds, unreviewed surfaces, and a ranked batch plan
(source coverage, learner-visible benefit, shared-component risk, size). Change no application
copy, model or test, and don't describe the module as refactored.
