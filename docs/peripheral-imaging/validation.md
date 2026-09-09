# Peripheral imaging course — review and validation

Review date: 2026-09-08. Review scope: the redesigned learner experience at
`/en/fluoroview`, its 17 units, nine labs, 24 distinct questions, 15 published
references, and four original model downloads. The implementation preserves the
existing route and site authentication. It introduces no dependencies or analytics.

## Evidence and content review

The supplied knowledge document informed the curriculum. Published articles and
professional reports were checked through accessible primary full text, abstracts,
and publisher/author publication records. The bibliography records what each source
supports and its limitations. Video citations and transcripts are excluded from the
learner content and references. Exact device yield rankings and universal exposure,
ventilation, or scan-count prescriptions are not used.

The medical-education-modules review rubric was applied as a separate pass after
authoring, alongside browser inspection. Objectives, prerequisites, estimated time,
unit order, recall, worked examples, independent decisions, and named next steps
derive from the curriculum registry. The alignment and model contracts are in
`module-plan.md`.

| Review area        | Verification and result                                                                                                                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orientation        | Overview plus one unit from each stage inspected; one Start/Continue entry, visible location, current task, phase and next unit.                                                                                |
| Answer boundary    | Pending questions have no teaching blocks, worked result, takeaway, or explanatory lab readout. Answers and option rationales appear after commitment.                                                          |
| Retrieval          | Later retrieval has a lesson-specific attempt key; an earlier correct response cannot silently complete it. Eight independent cases use different situations.                                                   |
| Scoring            | First attempts are immutable. Completion requires all decisions and a reviewed debrief. Passing cases requires at least 7/8 and all four critical decisions correct. No mastery or procedural-competence label. |
| Causal consistency | Projection normal matches the C-arm rotation. Tube-load arithmetic is distinct from dose. MPR, 3D and sampling feedback share finite cylinder dimensions. Centering requires both scout dimensions.             |
| State validity     | Equipment/position changes clear acquisition readiness and captured status. Anatomical change makes an old contour historical; refreshing a contour does not improve physiology.                                |
| Dose boundaries    | Physical collimation and display crop differ. KAP conversion is dimensioned. No shield attenuation, safe distance, effective dose, or individual skin dose is inferred.                                         |
| Access and resume  | Labeled controls, keyboard camera buttons, focus indicators, reduced motion, WebGL fallback, local progress, pending feedback and lab-control resume. Storage failure is disclosed.                             |
| Media provenance   | All meshes are original procedural assets. No clinical image appearance is claimed. Four GLBs embed their resources and apply a millimeter-to-meter export scale.                                               |

Findings corrected during review:

- **Causal consistency:** the sampling-window feedback initially used its centerline.
  It now includes the cylinder radius; thin slices project the same finite geometry
  within the stated 1.5 mm section thickness. Boundary cases are tested.
- **State validity:** both centering dimensions now gate acquisition; moving a checked
  setup invalidates the readiness acknowledgments and capture.
- **Resume:** a committed response awaiting debrief now restores that feedback after
  reload, rather than advancing past it.
- **Accessibility:** separated slider values from their labels, corrected heading order
  and nested landmarks, and enabled phase/resource navigation to wrap.
- **Assessment cueing:** removed key-only stem-word repetition. The strict cueing script
  passes: A/B/C each 8 of 24, first-option strategy 33%, longest-option strategy 33%,
  mean key/distractor length ratio 0.97. Six remaining P3 grammatical flags were inspected:
  each flagged item actually uses three verb-led action choices (the script's verb list
  does not recognize every verb, including “assess,” “reposition,” and “reconfigure”).

Copy-density script findings were reviewed as advisory. Additional physics is in
optional disclosures; the MPR controls are divided into moving the tool and inspecting
the volume. The 98-minute estimate includes exploration and questions and has not been
validated with learners.

## Automated and browser validation

- Focused Jest: **29 checks passed in four suites**, covering geometry, unit arithmetic,
  curriculum closure, provenance, binary model packaging, progress integrity, UI commit
  boundaries, accessibility, and critical-error scoring.
- Focused ESLint: no errors or warnings. Repository lint: no errors; 15 existing warnings
  in unrelated files.
- TypeScript: `npm run type-check` passed.
- Production: `npm run build` passed, including repository content and asset checks.
- Playwright: **three browser scenarios passed**, covering the desktop path, every lab,
  saved feedback, case scoring, acquisition invalidation, mobile layout, lab resume,
  glossary lookup and enlarged text. Screenshots inspected at 1440 px and 390 px widths.
- Repository regression run: **744 suites / 11,437 tests passed**; one unrelated test
  expected empty stderr from `tsx` and failed on Node 26.5.0's `DEP0205` deprecation
  warning. Both scanner files match `origin/main`. The failing suite passes when only
  that warning is suppressed. No unrelated scanner code was changed. Four new model
  packaging tests and the final geometry refinements were subsequently covered by the
  focused 29-check run.

Reproduce focused checks from the repository root:

```sh
npm test -- --runInBand src/features/peripheral-imaging
npm run type-check
npx eslint src/features/peripheral-imaging scripts/peripheral-imaging e2e/peripheral-imaging.spec.ts playwright.peripheral-imaging.config.ts
npx tsx scripts/peripheral-imaging/export-models.ts
```

For browser checks, use the normal local development environment and a running local
server, then set `PERIPHERAL_IMAGING_BASE_URL` to its localhost URL and run:

```sh
npx playwright test --config=playwright.peripheral-imaging.config.ts
```

The browser suite requires `LOCAL_DEV_AUTH_TOKEN` in the environment and keeps it out
of source, traces and screenshots. It refuses a non-localhost target. The dedicated
config does not start or disturb another worktree's server.

## Practical limits

This verifies the software and authored teaching model, not clinical performance or
hands-on competence. No patient study, learner pilot, real-scanner collision test,
room radiation survey, or independent specialist sign-off has occurred. The proposed
learner/technologist pilot and retention review are documented in the module plan.
The content uses the repository's existing localization handoff; a specialist language
review of the complete clinical course has not been performed. The change is prepared
for pull-request review and has not been deployed.
