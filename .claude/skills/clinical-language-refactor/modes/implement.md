# Mode: implement — one bounded module

A complete language pass on the named module, route or file set: not a report, and not a heading
rename. The workflow is in `SKILL.md`; this is its checklist.

Before editing

- [ ] Own worktree and branch; the baseline commit, `git status` and a baseline run of the
      module's tests recorded.
- [ ] Render path traced; canonical copy sources, the messages namespace, copy gates, leak checks,
      balance tests and exact-string tests listed.
- [ ] Any existing audit re-checked against the current code.
- [ ] Profile, approved examples and brief read; a local terminology sheet drafted.

Editing

- [ ] E0 and E1 edits across every in-scope surface, in the canonical sources, a whole sentence at
      a time.
- [ ] Gate collisions resolved by the repository-map rules; no gate touched.
- [ ] Every reworded keyed answer has its section's deny patterns rewritten to match.
- [ ] Key-length balance measured, and rebalanced without changing ids, keys or order.
- [ ] Official console labels kept and explained; transcripts used for voice only.
- [ ] E2 items logged, not applied, with unrelated safe edits continuing.
- [ ] No reworded item left `approved`; every reworded item listed.

Verifying

- [ ] Every E1 pair checked for numbers, units, negation, causality, set versus measured versus
      estimated, time, endpoints and exceptions.
- [ ] Items: the same construct, plausible and balanced distractors, no pre-commit leak.
- [ ] Module jest, type-check, lint, and the harness or e2e where available; baseline versus new
      failures.
- [ ] Rendered-text scan for obsolete terms; long labels, mobile width, links, glossary and the
      pre- and post-answer states inspected wherever the route renders.
- [ ] In a localized module, keys intact and the es and zh-CN follow-up recorded.

Finish with the working change, `docs/clinical-language/<module>.md`, representative real
before/after pairs, the E2 queue, the validation results and the remaining work. Commit on the
branch; push and open the PR when the user wants it shipped.
