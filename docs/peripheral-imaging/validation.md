# Peripheral imaging course — review and validation

Review date: 2026-09-08. Review scope: the redesigned learner experience at
`/en/peripheral-imaging`, its 17 units, nine labs, 24 distinct questions, 15 published
references, CT-derived images, a layered Slicer anatomy model, the original FluoroView
C-arm animation, and two model downloads. The implementation preserves the
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

| Review area        | Verification and result                                                                                                                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orientation        | Overview plus one unit from each stage inspected; one Start/Continue entry, visible location, current task, phase and next unit.                                                                                                                                                                  |
| Answer boundary    | Pending questions have no teaching blocks, worked result, takeaway, or explanatory lab readout. Answers and option rationales appear after commitment.                                                                                                                                            |
| Retrieval          | Later retrieval has a lesson-specific attempt key; an earlier correct response cannot silently complete it. Eight independent cases use different situations.                                                                                                                                     |
| Scoring            | First attempts are immutable. Completion requires all decisions and a reviewed debrief. Passing cases requires at least 7/8 and all four critical decisions correct. No mastery or procedural-competence label.                                                                                   |
| Causal consistency | CT projection and target/tool overlays share the original FluoroView cone frame; the gantry is labeled as a separate single-axis reference. Tube-load arithmetic is distinct from dose. MPR, 3D and sampling feedback share finite cylinder dimensions. Centering requires both scout dimensions. |
| State validity     | Equipment/position changes clear acquisition readiness and captured status. Anatomical change makes an old contour historical; refreshing a contour does not improve physiology.                                                                                                                  |
| Dose boundaries    | Physical collimation and display crop differ. KAP conversion is dimensioned. No shield attenuation, safe distance, effective dose, or individual skin dose is inferred.                                                                                                                           |
| Access and resume  | Labeled controls, keyboard camera buttons, focus indicators, reduced motion, WebGL fallback, local progress, pending feedback and lab-control resume. Storage failure is disclosed.                                                                                                               |
| Media provenance   | CT-derived assets and original FluoroView gantry are distinguished from authored targets, instruments and cases. Raw clinical headers are excluded; provenance and coordinate contracts are in slicer-assets.md.                                                                                  |

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

- Focused Jest: **41 checks passed in seven suites**, covering cone geometry, CT scalar range, atlas packaging, DTS refocusing, unit arithmetic,
  curriculum closure, provenance, binary model packaging, progress integrity, UI commit
  boundaries, accessibility, and critical-error scoring.
- Focused ESLint: no errors or warnings. Repository lint: no errors; 15 existing warnings
  in unrelated files.
- TypeScript: `npm run type-check` passed.
- Production: `npm run build` passed, including repository content and asset checks.
- Playwright: **three browser scenarios passed**, covering the desktop path, every lab,
  saved feedback, case scoring, acquisition invalidation, mobile layout, lab resume,
  glossary lookup and enlarged text. Canvas pixel checks catch blank renderers; gantry and DTS controls must change the rendered image. Screenshots inspected at 1440 px and 390 px widths.
- Repository regression run: **744 suites / 11,437 tests passed**; one unrelated test
  expected empty stderr from `tsx` and failed on Node 26.5.0's `DEP0205` deprecation
  warning. Both scanner files match `origin/main`. The failing suite passes when only
  that warning is suppressed. No unrelated scanner code was changed. The CT asset revision was subsequently covered by the focused regression suite,
  original FluoroView geometry/renderer tests, and browser checks.

Reproduce focused checks from the repository root:

```sh
npm test -- --runInBand src/features/peripheral-imaging fluoro-viewer/src/geometry.test.ts fluoro-viewer/src/volume-drr.test.ts
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

This verifies the software, CT asset pipeline and authored teaching geometry, not clinical performance or
hands-on competence. No patient study, learner pilot, real-scanner collision test,
room radiation survey, or independent specialist sign-off has occurred. The proposed
learner/technologist pilot and retention review are documented in the module plan.
The content uses the repository's existing localization handoff; a specialist language
review of the complete clinical course has not been performed. The change is prepared
for pull-request review and has not been deployed.

## Stage rebuild — round 1 (2026-09-08)

Scope: the course re-hosted on the shared lesson stage (see
[stage-rebuild-plan.md](stage-rebuild-plan.md)); nineteen sections, the hub, Learn / Practice /
Assess routes, the module-local record and its migration, the capstone. The imaging suite's 3D
views are Codex's track and are not covered here; every section runs on the fallback pane (the
draft's lab body under the chain caption) until a view lands.

| Check                         | Result                                                                                                                                                                                                                                                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registries validate at import | Pathway, chain, control panel, grammar, section specs, lab goals, sorts, chain-answer targets, items, stage lessons, cases: every validator throws on an authoring error; the test suite loads them all.                                                                                                                           |
| Answer boundary, authored     | The authored leak scan runs over every pre-commit surface (titles, objective, increment, why, recall prompt, pre-commit blocks and their points, stop cards, step titles/instructions/actions/look-ins, the stem) against each section's deny patterns.                                                                            |
| Answer boundary, rendered     | The composed document is scanned on the first step and at the prediction step reached as a learner reaches it, hidden nodes and attributes included; the two answer fieldsets are the one excused surface. Two block details that named the answer inside a collapsed disclosure were found and are now withheld until commitment. |
| Controls                      | Locked on the read before the prediction, while any prediction is open, and while looking back; the pane and the context strip say why.                                                                                                                                                                                            |
| Goals                         | Every Act/Observe goal is evaluated by the engine from the same readout arithmetic the pane prints; a goal pre-met on entry (the projection Observe event) was replaced by a state goal.                                                                                                                                           |
| Record                        | First decisions written once at commit and never rewritten; correctness recomputed from the item bank at parse; sections complete once at finish; nothing persisted mid-section; legacy v1 record migrated once.                                                                                                                   |
| Capstone                      | Gated on every section; decided once per case; verdicts open together after the last decision; standard ≥ 7 of 8 and every safety-critical decision.                                                                                                                                                                               |
| Accessibility                 | Hub and Learn landing pass jest-axe; the stage's own audits are shared with the four adopters.                                                                                                                                                                                                                                     |

Automated: the **full repository run passes — 760 suites, 11,572 tests, no failures** (Node 26.5.0;
the scanner suite that used to fail on a deprecation warning now passes). ESLint and `tsc --noEmit`
are clean. One configuration fix was needed: Jest was collecting the imaging suite's Playwright
scene spec and failing on Playwright's `test` export, which broke the whole-repository run.

Browser (dev server, 1440×900 and 1024×700, signed in through the local-dev-auth route): the hub
renders one door ("Start — What does this image establish? · Section 1 of 19 · 4 min") and the
composition line counted at render; the first section walks Recognize → Predict (controls locked,
verdict stated, sources released) → the four-questions sort (graded row by row) → Explain →
Transfer → "Finish the section", the completion card links the next section, and the v2 record
holds `completedSectionIds: ['imaging-questions']` with two first attempts; the projection section
runs on the fallback lab with the contract's control ids — obliquity 60 flips the separation goal
(0.0 → 37.0 mm) and the card reads Done, Observe flips back at 0.0 mm, Explain shows the recap,
the three-column what-changed table and the control strip, and Transfer locks the controls again.
No document horizontal overflow at either width, and none at 375×812 either; console clean apart
from the site's `/api/analytics` 401 under local-dev auth. The Browser pane was hidden for part of
the walk, so the later checks are DOM reads rather than screenshots, and the workspace's compact
pane switcher — which follows a ResizeObserver the hidden pane does not fire — is covered by the
Playwright spec rather than this walk.

Playwright (`e2e/peripheral-imaging.spec.ts`, rewritten for the stage): **four scenarios pass**
against a local development server — the one door into the first section and a sorted section run
to its record; a lab section's controls locked until the commitment, a goal flipping on the suite,
and a reload restarting the section while the record keeps the first attempt; the capstone gated,
decided once, and failing the standard on one wrong safety-critical decision; and the compact
layout at 390 x 844 following the step from pane to pane. The suite no longer signs in: the module
is reachable by direct link, so arriving on the hub with no account is itself the first assertion.

Running that suite for the first time found three defects, since fixed:

- **Layout.** The shared frame renders its release badge `white-space: nowrap`. A 76-character
  label was 465 px wide at a 390 px viewport and widened the document to 497 px on its own,
  taking every section with it. The badge is now four words.
- **Layout.** The hub and the three landings laid their sections out in a single-column grid,
  whose track sizes to the widest item's min-content — so the decision guide's table widened every
  sibling section. The track is now `minmax(0, 1fr)`; the table scrolls inside its own container,
  and all four pages match the viewport exactly at 390 px.
- **Naming.** `data-stage` meant two different things on one page: the curriculum stage on the
  hub's pathway groups and the current step on the lesson stage. The accordion's attribute is now
  `data-pathway-stage`.

Access, checked against a running server with no account and no cookie: `/en/peripheral-imaging`
and `/en/peripheral-imaging/learn` return 200; `/en/fluoroview` still redirects to the login page
and renders the original simulator; the un-localized `/peripheral-imaging/learn` redirects to the
localized route while `/peripheral-imaging/anatomy/manifest.json` is served as an asset. The
in-development boundary is also asserted in Jest (`__tests__/release-boundary.test.ts`): public by
direct link, unlisted, absent from navigation, site search and the sitemap, one analytics id for
the route family, and FluoroView left alone.

FluoroView's full CT volume returns 404 in local development. That is pre-existing and expected:
`ct_volume_uint8.raw` is gitignored, is not tracked in the repository, and is served in production
from the module-asset origin.

## Practice — the micro-cases (2026-09-09)

Sixteen short cases, one decision each, paired to a section by the mechanism it teaches: one for
every mechanism and application section, and a second for the three that fill two rows of the
diagnostic table. Static signals, one decision, a two-sentence debrief. A case may be answered as
often as the learner likes; only the first decision is recorded, under `practice:<id>`, and it is
never rewritten.

Authored against each section's own teaching and the module's fifteen reviewed sources, then put
through three rounds of independent adversarial review — 215 reviewer passes across four lenses,
each instructed to reject rather than approve, and to default to rejection when unsure:

| Lens                   | What it tried to reject                                                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vocabulary and leakage | Any banned word in any field; a title or stem that names the mechanism or the decision; a rationale that reveals the key; an invented threshold                                                      |
| Evidence               | A key that is not the best move, a claim stronger than the cited source supports, reversed physics, an implied prediction of dose, yield or safe placement                                           |
| Cueing                 | Whether the key is reachable from form alone: option class, length, hedging, absolutes, noun overlap with the stem, the drastic/dismissive/measured triad, a situation that pre-refutes a distractor |
| Fit                    | Wrong section, duplicate of an existing item or the paired capstone case, a repeat of the section's lab exercise                                                                                     |

Blocking defects fell 16 → 11 → 4 → 2 across the rounds. Nearly all were cueing: the key as the
only unhedged option, the only one written at whole-image scope, the only one that withheld an
action, the only one repeating a noun from the stem. One review finding was a defect in the page
rather than the item — the case page printed the section's title above the choices, and a section
title names the mechanism — so the pairing now appears only after the decision, with a test to
keep it there.

Two notes survive all three rounds and are recorded rather than resolved, since every item is a
draft awaiting subject-matter review:

- `dts-interpretation-practice-1`: the two distractors share a bottom line the key does not, which
  is partly intrinsic to a three-choice item whose distractors represent one error class.
- `dose-reporting-practice-1`: the topic word "dose" appears in the key and not in the other two.

Registry checks, enforced at import so a violation fails the build: the copy gate on every title
and situation; at least one cited source per case; no stem repeated from any of the module's other
items; three choices with exactly one keyed; every distractor carrying its own reasoning; and the
keyed choice no more than a quarter longer than the longest distractor. Adding sixteen questions
took the bank from 29 to 45; the keyed position was rebalanced to 15 / 15 / 15, inside the
curriculum check's cap of sixteen per position.

Automated: the full repository run passes — **767 suites, 11,626 tests**. Browser: **seven
scenarios**, including one that walks a case, answers it twice and confirms the first decision was
kept as made. ESLint and `tsc --noEmit` clean.

## The suite, end to end (2026-09-09)

With phase 2 merged, every section was opened in the running application and driven to the step
where its lab is live, to check the thing no unit test covers: that the scene the section declares
actually comes up in the real page, rather than in Codex's standalone harness.

| Check                             | Result                                 |
| --------------------------------- | -------------------------------------- |
| Sections reaching a live scene    | 19 of 19, `data-suite-state=ready`     |
| Sections still on the 2D fallback | none                                   |
| Scenes reporting a failure        | none                                   |
| Page errors during the sweep      | none                                   |
| WebGL contexts per page           | at most two, the budget the brief sets |

The context count is worth recording, because a raw canvas count looks alarming and is not: the
tomosynthesis sections open fifteen canvases, of which **one** is WebGL and fourteen are 2D
thumbnails of the projection atlas. Cone-beam holds two WebGL contexts, the scene and the detector
image, and nothing exceeded that.

Two sections, `chain-walk` and `suite-cases`, could not be driven by the sweep script, which stalls
on their step sequences. Both were checked directly instead and reach a ready scene with two WebGL
contexts, so the failure was in the probe rather than the product.

Automated at the same commit: the full repository run passes — **773 suites, 11,647 tests** — with
`tsc --noEmit` and ESLint clean, and the seven application scenarios pass against a local server.

Not covered in this round: the `radial-ebus` section, the Practice micro-cases, the suite's 3D
views, localisation, learner piloting.
