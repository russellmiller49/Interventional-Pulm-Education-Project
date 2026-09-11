# Optional pointer for repository instructions

Claude Code finds this skill through its description, so no pointer is needed for it. Codex and
other assistants read `AGENTS.md`. If the owner wants them to use the skill, merge the block below
into the existing file — never replace or duplicate existing guidance.

---

## Physician-facing educational language

For learner-facing copy in the interventional pulmonology and critical-care modules, read and apply
`.claude/skills/clinical-language-refactor/SKILL.md` and the files it routes to.

Clinical term first, precise explanation second, analogy only as an aid. Preserve clinical meaning,
numbers and units, equations, model behavior, stable IDs, translation keys, scoring and
answer-reveal order. Use the domain profiles, not a word blacklist. Transcripts guide language, not
treatment. Uncertain clinical changes go to a review queue, never into a copy-only diff. This
repository is public: no transcript text, credentials or case details in tracked files. A passing
test does not certify clinical correctness.
