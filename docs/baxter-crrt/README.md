# Baxter CRRT v1 documentation

Current release stage: `sme-review`

Canonical route: `/[locale]/baxter-crrt`
Protected final-SME preview: `/[locale]/baxter-crrt/review`

This directory describes the completed private v1 educational module. The module contains 18
learner cases, seven rapid drills, six instructional tools, one masked PrisMax Mastery capstone,
two operational device adapters, and one cross-device transfer capstone.

Review/source fields are informational provenance. They do not switch cases, tools, drills,
adapters, or Mastery on or off. One code-owned release stage controls visibility:

| Stage                 | Access and discovery                                                                  |
| --------------------- | ------------------------------------------------------------------------------------- |
| `private-development` | Admin-only, unlisted, excluded from search/sitemap, `noindex`                         |
| `sme-review`          | Admin-only, unlisted, excluded from search/sitemap, `noindex`; full protected preview |
| `published`           | Public, listed, searchable, sitemap-included, indexable                               |

The current build intentionally remains `sme-review`. Publication requires a later explicit
user-directed change after feedback has been incorporated.

## Current documents

- [Requirements](./requirements.md)
- [Curriculum](./curriculum.md)
- [Evidence and provenance](./evidence.md)
- [Engine and device adapters](./engine.md)
- [Risk register](./risk.md)
- [Validation record](./validation.md)
- [Accessibility requirements](./accessibility.md)
- [Final SME feedback checklist](./final-sme-checklist.md)

## Safety boundary

This is professional education, not a medical device, validated digital twin, certification
program, patient-specific treatment guide, or substitute for the current operator manual, local
policy, supervised training, or multidisciplinary judgment. The project is independent and is not
manufactured, sponsored, validated, or endorsed by Baxter.

Default device profiles are manual-reference educational profiles. They do not claim to represent
any institution's installed hardware, software, disposables, solutions, workflows, or policies.
The local manuals remain uncommitted source material.
