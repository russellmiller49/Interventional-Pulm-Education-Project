# BBT-PRE-REVIEW-04 — teaching before the try, and a coherent optional route flow

**Scope:** Bronchial Branch Tracing only — `src/features/bronchial-branch-tracing/**`, the module's
own `e2e/branch-tracing.spec.ts`, and this document set. No other module, no auth or access
policy, no shared header/footer/global CSS, no shared lesson-stage component, and no source volume,
mesh, graph, manifest, response plane, camera mapping, nomenclature, packet or review-status file
was changed.

**No clinical approval, faculty review, release, deployment or merge is claimed or performed.**
OD-01 remains **OPEN**; OD-03 and OD-05 remain **held**; the historical BBT-02 five-junction packet
remains **NOT REVIEWED**. Every `exercise.review.status` stays `provisional`. Clearer teaching prose
here is not an anatomy decision.

The module stays self-paced teaching. Nothing in this batch adds a forced first attempt, a
correctness gate, a score, a pass/fail state, first-try or assistance tracking, a fabricated mark,
an inferred competence claim or a new performance store. Viewing a worked example, a reference or
the course reference records nothing.

## Repository reconciliation

| Field                    | Recorded value                                                                                                                                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Implementation base SHA  | `a306d8250ec10207c750f46407f151c06d487707` — `origin/main` fetched on 2026-09-23. It is the main reported in the prompt (no further advance); the approved Prompt 03 head `b14c2c9d` is an ancestor through merge `4bd1368d`, and the three commits after `5b710f7a` are PI draft documents only.       |
| Implementation commit    | `276710b552ab01aa3bb2711ad5528e0d51a61994` (runtime, tests)                                                                                                                                                                                                                                             |
| Test-only follow-up      | `4b26a3206ef539af3ff5e0f94fec532122411aed` — the e2e viewport helper; no runtime file                                                                                                                                                                                                                   |
| Final head               | The documents commit on top of `4b26a320`; the PR page and the final report give its SHA (a file cannot contain the SHA of the commit that adds it)                                                                                                                                                     |
| Branch                   | `claude/bbt-04`, fast-forwarded from `5b710f7a` to `origin/main` `a306d825` before any edit; no other commits                                                                                                                                                                                           |
| Worktree                 | `/Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/claude-bbt-04` — the clean checkout created for this session. `git worktree list` was inspected; no other checkout was reset, reused or modified                                                                                 |
| Open PRs overlapping BBT | None: #271 (MV), #266 (HD), #264 (MCS), #134 (critical care), #114 and #98 (literature) change no `bronchial-branch-tracing` or `branch-tracing` path (`gh pr diff --name-only` checked)                                                                                                                |
| Dev server (baseline)    | This worktree's `next dev --port 3121` (`claude-b-dev` launch entry), cwd verified with `lsof`; stopped by this session before the build                                                                                                                                                                |
| Production server        | `.next/standalone/server.js`, pid 86090, cwd `…/claude-bbt-04/.next/standalone`, `next-server (v16.2.2)`, `http://127.0.0.1:3001`, build ID `IH5OxvSXqGFtsMupcx28t` (present in the served HTML). Public `.env.example` placeholders passed as process environment only; no `.env` file created or read |
| Browser profiles         | Fresh Playwright Chromium contexts for every journey and capture, plus the built-in preview pane on this session's own dev server. The owner's profile and `claude-review-backup::branch-tracing::2026-09-19` were never opened, restored or read                                                       |

The production build ran once for the batch, after the final runtime edit. A modification-time
check shows no `src/` or `e2e/` file changed between the start of the build and commit
`276710b5`; the only later change is the test-only e2e helper in `4b26a320`, which the full
Playwright run already used.

## Assigned findings — dispositions

"Reproduced" means seen on the base (baseline captures in `baseline/`, or the base code path where
named). Full wording before and after, with sources, is in
[`BBT-PRE-REVIEW-04-copy-source-comparison.md`](BBT-PRE-REVIEW-04-copy-source-comparison.md).

| ID      | Result                                       | What changed                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BBTF-02 | Reproduced · repaired within policy          | Nothing is withheld. The three modes are named apart on every local example: kicker "Worked example / Try tracing / Compare with reference", a worked-example note ("the model reference is shown … Nothing is recorded"), and a try note that calls marking a just-watched example guided practice, "not an independent test". Show reference, skip and unresolved are unchanged.                                         |
| BBTF-07 | Reproduced · repaired                        | A "Before you mark" primer in the worked example (open) and the try (one click): the division's source levels relative to the model node, a change-of-direction note with the Lesson 8 primer where a daughter turns back, and the BBT-02 packet's own "Where the paths diverge" / "Which wall or lumen decides it" text. Lesson 4 now shows the bright-ring / dark-lumen cue before marking. No lesson reordered.         |
| BBTF-08 | Reproduced · repaired                        | Lesson 9 step 1 is the worked RS8 route by name: "Next worked junction (RS8 route)" steps through it, "Start your own trace: LS9" / "Skip to your own trace: LS9" open the learner's target, a "Routes in this lesson" list names all three targets, the context strip names the role, and the map during the worked route is a separate "Worked route map … model reference, not your route". Nothing is seeded (tested). |
| BBTF-09 | Reproduced · repaired                        | The Explain step is "Optional reflection: relate the two views": nothing is recorded or checked, no text box or token choice, a "Compare with the reference" block (source levels and target placement), and "Continue to another trace: LS5".                                                                                                                                                                             |
| BBTF-15 | Reproduced · repaired; one term held         | Action-oriented objectives using the UI's own terms; a local course reference defines parent airway view, parent viewpoint, camera roll, display convention, model reference, response slice, the three modes and the two bookmarks. "Spur angle" is **held** (no source definition in the module).                                                                                                                        |
| BBTF-16 | Reproduced · repaired                        | B/S key on the overview beside the RS5 target, in Lesson 1 and in the course reference; target segment (RS5) distinguished from its bronchus (RB5) and the route's last airway (RB5b, marked provisional). No code or id renamed.                                                                                                                                                                                          |
| BBTF-18 | Reproduced · repaired                        | One "How the course is organised" map of Learn, Practice and More routes, with counts and overlaps computed from the registries and "about 60 minutes by the authors' estimate: a planning aid, not a measured learner time". Routes and `/assess` unchanged.                                                                                                                                                              |
| BBTF-19 | Reproduced · reference added; figure held    | A reusable four-pattern reference whose definitions are sentences from Lessons 4–7 (a test fails if they drift) and whose lesson mapping is proved by each lesson's own text, not its URL. Names from the repository's clinical-review record. A figure and book-verified definitions are **held for Prompt 05**: the book is not available in Local-Data in this session.                                                 |
| BBTF-27 | Reproduced · repaired                        | Lesson 1 states this CT's numbering from its manifest (index rises toward the head) and points to the slider's Caudal/Cranial labels; no PACS-wide claim.                                                                                                                                                                                                                                                                  |
| BBTF-30 | Reproduced · reframed; replacement held      | Lesson 2 says plainly it is the Lesson 1 tracheal interval in a different display, with the parent airway view beside it, and offers an unrecorded reflection plus a way back to the Changed/Unchanged list. A new asymmetric example stays an owner proposal (Prompt 03 candidates junction-10/3/6).                                                                                                                      |
| BBTF-31 | Reproduced (hidden disclosures) · repaired   | "Reset to standard" → "Return to standard axial" in the Lesson 2 worked text and the route display-convention panel, matching the button.                                                                                                                                                                                                                                                                                  |
| BBTF-33 | Reproduced · repaired                        | Later examples say they open without a demonstration and offer "Watch a worked walkthrough" and "Start from the parent · slice N" (both record nothing); the branch buttons are described as jumps to the response slice. Go to response slice unchanged.                                                                                                                                                                  |
| BBTF-41 | Reproduced (code path) · repaired            | The repeated RB5 division is labelled "Optional revisit" with the reason and the skip; the horizontal–vertical relationship is defined in the pattern reference.                                                                                                                                                                                                                                                           |
| BBTF-43 | Reproduced · repaired                        | "Which branch would you follow toward LLL?" → "Which daughter would you follow toward the simulated nodule in LS6 (left lower lobe superior segment)?", read from the target registry, with the source's approach branch and neutral daughter identities.                                                                                                                                                                  |
| BBTF-45 | Reproduced · relocated; wider placement held | The left-upper-division sentences leave Lesson 8's main teaching and sit, verbatim, in its optional reference under a heading that says they are not this LB6 route, with a link to Lesson 7. Adding the "left superior segment" note to Lesson 7 is **held** for source review.                                                                                                                                           |
| BBTF-48 | Reproduced · repaired                        | Lesson 9 ends with "Continue to Practice" (primary) and "Return to overview"; the course outline and the overview name Practice and More routes as optional next steps. Nothing is locked.                                                                                                                                                                                                                                 |
| BBTF-49 | Reproduced · explained; redesign held        | Nav, overview and landing call More routes an optional revisit set in the same CT, list each route and where else it appears, and say the address once held an assessment and now assesses nothing. Merging or re-scoping the set is OD-07.                                                                                                                                                                                |
| BBTF-50 | Reproduced · repaired                        | Plain learner wording under the CT and in the Lesson 9 footer; the Slicer version and "clinical review pending" move into a "Source details" disclosure; Lesson 1's pointer reads "exact page not yet confirmed". Review status and unreviewed-model warnings stay visible.                                                                                                                                                |
| BBTF-51 | Reproduced · repaired                        | "Save for later" (bookmark) versus "Mark reviewed" (your note that you reached the end), explained on the overview and in the outline. Same stored fields.                                                                                                                                                                                                                                                                 |
| BBTF-52 | Reproduced · repaired                        | Singular/plural by count; display-only sentence case for seven title-case exported names and the doubled "daughters daughter" label. Stored names and labels unchanged (tested).                                                                                                                                                                                                                                           |
| BBTF-53 | Reproduced · repaired                        | Estimates stay visible after "Reviewed"; the overview says when a Practice or More routes draft is saved on this device (key presence only; nothing parsed, counted or written).                                                                                                                                                                                                                                           |
| BBTF-54 | Reproduced · repaired                        | "Optional: full-route Practice and source limits" with "Open full-route Practice (optional)" and the suggested next lesson named. Still open from Lesson 1.                                                                                                                                                                                                                                                                |

## Route and state changes

- **Lesson 9 step 1 (worked example).** New actions only: `Next worked junction` dispatches the
  existing `active` action on the example trace (allowed in step 1 before this batch); `Start your
own trace` / `Skip to your own trace` dispatch the existing `advance`, which already reset marks,
  branches and orientation for the learner's trace. No reducer, schema or draft field changed.
- **Worked route map.** `CtProgressiveMap` gained a `worked` flag. During step 1 it shows the worked
  divisions reached so far, headed "model reference, not your route". Before this batch the map
  showed the LS9 trace's empty record against the RS8 route ("Your route map · 0 of 9 stops
  recorded · Partial").
- **Worked junction panel.** `CtBranchDecision` gained a `worked` flag that hides the (disabled)
  daughter question on worked junctions; the reveal is unchanged.
- **Lesson 9 end.** Primary link to `/practice`, secondary to the overview.
- **Local lessons.** New buttons reuse existing transient state: "Replay / Watch a worked
  walkthrough" sets the same per-step reference flag as Show reference and moves to frame 0; "Start
  from the parent" is a slice request. "Compare the regional display convention" is now also offered
  in Lesson 2 (the existing `explain-orientation` action, which keeps marks).
- **Overview.** Reads draft **keys** under `branch-tracing.draft.practice.` / `.assess.` to say a
  draft is saved. Writes nothing.
- **Unchanged:** `/learn`, `/learn?lesson=…` for all nine lessons, `/practice`, `/assess`, the
  un-prefixed and `es`/`zh-CN` addresses; Prompt 01 partial/final record behaviour; restart
  confirmation; draft parsing; every draft signature.

## Source basis for substantive copy

Every learner-facing factual sentence is either reused from current module text, generated from
unchanged source data, or held. The copy/source comparison lists each row with its pointer. In
short:

- **Pattern definitions** — verbatim from Lessons 4–7 `concept`/`teaching`; mapping proved by the
  lesson's own text (`teaching-route-flow.test.tsx`); names from
  `docs/bronchial-branch-tracing/clinical-review.md`; page pointers are the lessons' existing
  `sourcePages`, labelled pending faculty review. No page was cited that the module did not already
  cite.
- **Naming** — `CtAirwayGuide` sentence and `docs/bronchial-branch-tracing/nomenclature-review.md`;
  codes from the target manifest; provisional qualifier from `sourceNamingNote`.
- **Levels primer** — `decision.parent.slice`, `option.slice` and `decision.junctionLps` through the
  exporter's own slice rule; the direction sentence is Lesson 8's teaching, verbatim; packet text is
  quoted unchanged with its NOT REVIEWED observation line.
- **Slice direction** — native-v1 `ijkToLps` / `NATIVE_CT` (+z superior).
- **Route overlaps and counts** — `content/practice.ts` and `content/lessons.ts`.

## Before/after learner wording (selection)

| Where                  | Before                                                                                                                       | After                                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Lesson 9 step 1 action | Trace this airway                                                                                                            | Next worked junction (RS8 route) · Skip to your own trace: LS9 · Start your own trace: LS9                           |
| Lesson 9 map in step 1 | Your route map · 0 of 9 stops recorded · Partial                                                                             | Worked route map · 1 of 9 stops shown · model reference, not your route                                              |
| Lesson 9 step 5        | Relate the two views · Explain how … · [Trace another airway]                                                                | Optional reflection: relate the two views · Nothing here is recorded or checked … · [Continue to another trace: LS5] |
| Lesson 9 end           | Return to overview                                                                                                           | Continue to Practice · Return to overview                                                                            |
| Lesson 8 question      | Which branch would you follow toward LLL?                                                                                    | Which daughter would you follow toward the simulated nodule in LS6 (left lower lobe superior segment)?               |
| Local example kicker   | Example 1 of 2 · RB1                                                                                                         | Worked example · Example 1 of 2 · RB1 → Try tracing · Example 1 of 2 · RB1                                           |
| Lesson 6 example 2     | Example 2 of 2 · RB5                                                                                                         | Try tracing · Optional revisit · Example 2 of 2 · RB5                                                                |
| Bookmark               | Save for review / Saved for review                                                                                           | Save for later / Saved for later                                                                                     |
| Under the CT           | Model reference — not yet faculty reviewed. No reviewed wall contours or distractor verdicts are supplied for this interval. | Gold crosshairs are model reference points, not yet faculty reviewed; this interval has no reviewed wall outlines.   |
| Nav · More routes      | Four further CT routes                                                                                                       | Optional: 4 revisit routes, same CT                                                                                  |

## Files changed

New: `content/course-guide.ts`, `components/CourseReference.tsx`, `components/DivisionPrimer.tsx`,
`engine/display-text.ts`, `engine/route-drafts.ts`, `__tests__/teaching-route-flow.test.tsx`,
`__tests__/fixtures/draft-signatures-baseline.json`, and this document set.

Changed: `components/BranchTracingLesson.tsx`, `components/BranchTracingOverview.tsx`,
`components/BranchTracingPractice.tsx`, `components/CourseOutline.tsx`, `components/CtBranchMap.tsx`
(`worked` flag), `components/CtOrientationTeaching.tsx` (one label), `components/CtRouteAttemptHistory.tsx`
(display case), `components/CtTraceControls.tsx` (display case, plural, `worked` flag),
`components/LocalCtLesson.tsx`, `components/ModuleFrame.tsx` (nav description),
`components/NativeCtViewer.tsx` (display case of the station name only),
`components/branch-tracing.module.css` (appended classes), `content/lessons.ts` (three strings in
local lessons: Lesson 2 `worked`, Lesson 8 `teaching[1]`, Lesson 1 `sourcePages`),
`engine/model-reference.ts` (new `divisionCourse` function; nothing existing changed),
`__tests__/lesson.test.tsx`, `__tests__/local-lesson.test.tsx`, `__tests__/self-paced.test.tsx`,
`e2e/branch-tracing.spec.ts`.

## Tests

**Added (unique):**

- `__tests__/teaching-route-flow.test.tsx` (18): pattern definitions verbatim from their lessons and
  named in the lesson's own text; four patterns on Lessons 4–7 of nine; terms present with no
  universal claims; course-map counts and overlaps from the registries, overview links, estimates
  after review, bookmark field unchanged and no new storage key, axe; outline offers Practice and
  More routes and separates the bookmark; Lesson 9 worked route steps through every junction with
  no mark, record or history, then opens LS9 with an empty trace (axe); the reflection has no input,
  shows the reference, changes no state, opens LS5 by name and ends with Continue to Practice; Lesson
  1 slice direction, naming key and optional Practice link; Lesson 4 bright-ring cue before marking
  and mode labels; Lesson 3 LB6 change-of-direction primer and the optional replay/start-from-parent
  recording nothing; Lesson 6 revisit label; Lesson 8 registry target, neutral options and the
  upper-division note only in the optional reference; Lesson 2 framing and unrecorded reflection;
  "Return to standard axial"; display-case and plural helpers with stored names unchanged; More
  routes explanation and list; **all 21 draft signatures equal the base fixture**; stored answer
  labels untouched.
- `e2e/branch-tracing.spec.ts` (12): all nine lesson entries by direct link plus `/practice` and
  `/assess`; overview map, estimates after review, links and back navigation; Lesson 9 worked / own
  / transfer identities, map ownership, reflection, Continue to Practice and back navigation to the
  finished lesson; later-example replay and start-from-parent with no mark; Lesson 8 target and
  hidden regional note; keyboard reach and visible focus on the try controls; the viewport matrix at
  1427×1226, 1440×900, 1024×768, 390×844 and 320×740; a 200 % root-text probe.

**Updated because the learner contract changed** (behavioural checks kept): Lesson 9 action names
(six uses in `lesson.test.tsx`, two in the e2e), "Save for later" (`local-lesson.test.tsx`), the
"Saved for later" heading (`self-paced.test.tsx`).

## Browser matrix (production build `IH5OxvSXqGFtsMupcx28t`, fresh Chromium contexts)

| Check                                                                                     | 1427×1226 | 1440×900 | 1024×768 | 390×844 | 320×740 | 200 % root text (CSS probe, 1280×720)                            |
| ----------------------------------------------------------------------------------------- | --------- | -------- | -------- | ------- | ------- | ---------------------------------------------------------------- |
| Overview course map reachable; no horizontal overflow                                     | pass      | pass     | pass     | pass    | pass    | pass for the module (shared site header overflows; see findings) |
| Lesson 4 try note and optional controls reachable, not clipped, no overflow               | pass      | pass     | pass     | pass    | pass    | pass                                                             |
| Lesson 9 worked-route actions reachable with full labels, no overflow                     | pass      | pass     | pass     | pass    | pass    | —                                                                |
| Lesson 9 worked → own → reflection → transfer → Practice; back navigation                 | pass      | —        | —        | —       | —       | —                                                                |
| Later-example replay / start-from-parent record nothing                                   | pass      | —        | —        | —       | —       | —                                                                |
| Lesson 8 registry target; regional note hidden until opened                               | pass      | —        | —        | —       | —       | —                                                                |
| Keyboard: Tab reaches "Replay the worked walkthrough" with visible focus; Enter activates | pass      | —        | —        | —       | —       | —                                                                |
| Prompt 02 compact Check stability (existing)                                              | pass      | —        | pass     | pass    | —       | —                                                                |
| Prompt 02 decoded-caption atomicity (existing)                                            | pass      | —        | pass     | pass    | —       | —                                                                |
| Prompt 03 repeated-plane identity (existing)                                              | pass      | —        | —        | —       | —       | —                                                                |
| Prompt 03 occlusion explanation readable (existing)                                       | pass      | —        | —        | pass    | pass    | —                                                                |

Screenshots: `after/e2e/bbt04-*.png`. The in-app preview pane was also used on the dev server at
1427×1226 to read the Lesson 9 and Lesson 4 layouts.

## Validation (after the final code and test edit; unique runs)

| Check                                                                 | Result                                                                                                                                                     |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx jest src/features/bronchial-branch-tracing`                      | 159 passed, 1 failed across 24 suites (160 tests); the failure is the known baseline below (`logs/jest-bbt.log`)                                           |
| Playwright `e2e/branch-tracing.spec.ts` (production build, port 3001) | 65 passed, 0 failed, 0 skipped, 1.4 min (`logs/playwright-branch-tracing-production.log`); includes the Prompt 01–03 regressions listed above              |
| Playwright `systemic-ux-stabilization -g bbt`                         | 3 passed: native workspace scroll ownership at 1600, 1440, 1024 (`logs/playwright-systemic-bbt-production.log`)                                            |
| `npx tsc --noEmit` (repository)                                       | Default heap: aborted out of memory, exit 134, before any diagnostic (environment limit). `NODE_OPTIONS=--max-old-space-size=8192`: exit 0, no diagnostics |
| `npx eslint` (changed `.ts`/`.tsx` paths)                             | Clean                                                                                                                                                      |
| `npx prettier --check` (changed paths and these documents)            | Clean                                                                                                                                                      |
| `git diff --check a306d825 HEAD`                                      | Clean                                                                                                                                                      |
| `npm run build` (production)                                          | Passed, exit 0, 2 min 29 s; all four branch-tracing routes compiled; standalone prepared (`logs/production-build.log`)                                     |

The 18 new Jest tests and 12 new Playwright tests are part of the totals above; nothing was
counted twice. Before this batch the same suites stood at 141 passed + the 1 known failure (Jest,
142 tests) and 53 passed (Playwright), as recorded by Prompt 03 and the post-merge verification;
neither was re-run on the unmodified base in this session.

## Known baseline failure

`__tests__/contracts.test.ts:198` › "the new pages are anonymous and unlisted without exposing the
existing admin anatomy routes" fails at `isPublicPath('/airway-anatomy/case-001/case_manifest.json')`
(expected `false`, received `true`), materially identical to Prompts 01–03 and the post-merge
smoke. Access policy was not changed and nothing was exposed to make it pass.

## Protected-source integrity

SHA-256 before (base) and after (this head) of every protected artifact:
`evidence/protected-hashes-{before,after}.txt`. The two lists are identical except for one added
line, the new signature fixture.

- Identical: `geometry/*.json` (`paired-routes.json`, `branch-decisions.json`), every
  `geometry/*.ts` including `paired-scope.ts`, `parent-map.ts`, `reference-frames.ts`,
  `native-ct.ts`, `coordinates.ts`, `orientation.ts`, `clinical-preview.ts`; the targets-v1,
  native-v1 and preview-v1 manifests, `preview-v1/geometry.json` and `airway.glb`;
  `patient-new/metadata/airway_graph.json`; `content/junction-feedback.ts` (packet text),
  `content/local-exercises.ts`, `content/local-teaching.ts`, `content/ct-types.ts`,
  `content/practice.ts`; `__tests__/fixtures/parent-camera-baseline.json` and
  `local-draft-baseline.json`; `docs/gap-remediation/bbt/BBT-02-junction-packet.md`.
- Git tree hashes of `public/branch-tracing/{native,targets,preview}-v1`,
  `public/fluoroview/cases/patient-new` and `public/airway-anatomy` unchanged.
- **Draft signatures:** all 21 (nine lessons, the Practice mixed set, the More routes set and the
  ten single-target Practice sets) equal their base values
  (`evidence/draft-signatures-before.json`, pinned by `fixtures/draft-signatures-baseline.json`
  and a test). Lesson 9's route draft signs the whole lesson object; none of its fields changed —
  the new Lesson 9 wording lives in the component. Historical draft bytes stay readable; no alias
  was needed.
- Response planes, camera mappings, graph/source ids, nomenclature, stored answer labels, review
  status and publication flags: unchanged. The repeated-plane identity fix and the occlusion
  explanation from Prompt 03 are untouched and their tests pass.

## Holds and remaining owner decisions

| Item                   | Status                                                                                                                                                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OD-01                  | **OPEN.** The first-bifurcation containment is unchanged; the new levels primer states the model node and response levels only.                                                                                                                          |
| OD-03                  | Held. Neutral identities from Prompt 03 reused; no name invented.                                                                                                                                                                                        |
| OD-04                  | Owner. Pattern taxonomy, regional applicability and any reorder. This batch shows lesson text only (H1, H5).                                                                                                                                             |
| OD-05                  | Held. Paired-view letters untouched.                                                                                                                                                                                                                     |
| OD-07                  | Owner. More routes' role; this batch explains the current set only (H6).                                                                                                                                                                                 |
| BBT-02 packet          | **NOT REVIEWED.** Quoted, never edited.                                                                                                                                                                                                                  |
| H1–H7 (copy proposals) | Listed in the copy/source comparison: four-pattern figure and book check (Prompt 05), "left superior segment" in Lesson 7, an asymmetric Lesson 2 example, "spur angle", lesson reorder, More routes redesign, optional local note. None is implemented. |

## Ordinary findings logged, not fixed here

- At 200 % root text on the overview at 1280 px, the shared site header's "Intro to
  Bronchoscopy" link extends past the viewport (document width 1331 px). The element is in the
  shared header, which this batch does not touch; it was not measured on the base build. Platform
  item alongside BBTF-17 (the language selector still reads "Engl").
- Carried from Prompt 03: route lessons and Practice still gate the paired view on a recorded or
  revealed junction; the desktop scroll-anchoring nudge after toggling the paired view mid-lesson
  was not addressed.

## Limitations

- Emulated viewports in desktop Chromium only. No native browser zoom (the 200 % condition is a
  CSS root-font probe), no screen reader, no physical device or touch, no Safari or Firefox.
- The baseline captures came from this worktree's dev server at the base SHA; the after captures
  from the production build. Text comparisons are unaffected; timing and chunk loading differ.
  The baseline Lesson 6 example-2 state was not captured (the script's path met the display guide);
  that finding is reproduced from the base code path (`advance()` and the unchanged kicker).
- The four-pattern reference was checked against the lessons, not against the book, which is not in
  Local-Data in this session.
- No new walkthrough, G02 audit, Prompt 05 work, merge, deployment or release.

## Evidence

Outside Git at
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/bbt-pre-review-04-2026-09-23/`:

- `baseline/` — 13 of 14 states (text and screenshots) on the base, 1427×1226.
- `after/` — the same 14 states on the production build; `after/e2e/` — 21 Playwright screenshots
  across the matrix.
- `evidence/` — `protected-hashes-{before,after}.txt`, `draft-signatures-before.json`,
  `server-identity.txt`, `base-sha.txt`, the capture and measurement scripts.
- `logs/` — production build, Jest, both TypeScript runs, ESLint, Prettier, both Playwright runs,
  standalone server.

## Next

One bounded PR, then stop. Not merged, not deployed. Prompt 05 not started. OD-01 stays open.
Nothing here records a faculty or learner review as complete.

## Independent-review repair — 2026-09-23

An independent sanity review of PR [#273](https://github.com/russellmiller49/Interventional-Pulm-Education-Project/pull/273)
at head **`6004cd7f61b7802efc7328eab2b0e55a22f8e8ed`** returned **SANITY REVIEW: NOT READY TO
MERGE**. It dispositioned all 22 Prompt 04 findings and cleared everything except four blockers:
**one defect introduced by Prompt 04** (finding 1) and **three inherited route-flow defects that
Prompt 04's worked / own / transfer contract brings into scope** (findings 2–4). The sections
above are the original record and were not rewritten; this section records what was wrong and
what changed. The review's own validation of `6004cd7f` (Jest 159 + the known baseline, browser 65,
shared scroll 3, build, TypeScript, lint, formatting) is not re-counted here.

The repair is bounded to those four defects and the regressions they need. It changes no response
plane, CT or graph geometry, graph id, nomenclature, camera mapping, `paired-scope.ts`, manifest,
BBT-02 packet, review or publication state, target identity or draft signature. OD-01 stays
**OPEN**, OD-03 and OD-05 **held**, OD-04 and OD-07 **owner-held**, BBT-02 **NOT REVIEWED**, and
H1–H7 stay held. The Lesson 5 wording correction is not an anatomy approval.

### Repository

| Field                 | Value                                                                                                                                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reviewed failing head | `6004cd7f61b7802efc7328eab2b0e55a22f8e8ed` (confirmed as the PR head after `git fetch` before any edit)                                                                                                                                   |
| Repair commit         | `80d4414436dd6acbc01b7fd14fc1cff2aeeb8f3e` (runtime and tests)                                                                                                                                                                            |
| New PR head           | The documents commit on top of `80d44144`; the PR page and the final report give its SHA                                                                                                                                                  |
| Main                  | Advanced to `85acc113` (CRRT-FELLOW-04, PR #275) after the prompt was written. None of those commits touches a BBT, lesson-stage or Playwright-config path, and the PR stays MERGEABLE, so main was not merged in and nothing was rebased |
| Worktree / branch     | `…/Worktrees/claude-bbt-04`, `claude/bbt-04`, clean before the repair; no other checkout, server or branch touched                                                                                                                        |

### State model the repair makes explicit

Two state domains, kept apart:

- **The learner's persisted draft** (`branch-tracing.draft.learn.*`, `…practice.*`, `…assess.*`):
  marks, branch choices, recorded stops, route interpretations, the learner's own route cursor
  (`session.active`, `reached`), and the learner's own CT position and display choices (`views`,
  `orientation`). Unchanged schema, unchanged signatures.
- **Reference viewing** (component state, never written): the Lesson 9 worked RS8 route's junction,
  divisions viewed, CT display, viewer position and target inspection; the local worked
  walkthrough cursor; and the CT position while a walkthrough, Show reference or the comparison is
  on screen.
- **Presentation phase:** `worked = reopened || step 0` in Lesson 9, and `showingWalkthrough` in
  local lessons, decide which domain the viewer reports to.
- **Next learner action:** `reachableThrough` (shared by Lesson 9 and Practice) plus a partial-route
  end action at the last stop.

Classified as learner navigation and left persisted, as before: Lesson 9 steps 3–4 (reviewing the
learner's own recorded route beside the reference), the parent-view task, and orientation and
display preferences in local lessons.

### Finding 1 (P2, introduced) · Lesson 5 source-level wording was false

- **Reproduction.** Lesson 5 example 2 (junction-19) primer on `6004cd7f`: "Daughter A · RB4 · more
  anterior’s response slice, 307, lies on the node’s level". Raw export: node z −215.440 mm → native
  index 306.12, nearest slice **306**; parent point 307; response slices 307 and 307.
- **Root cause.** `divisionCourse` classified any response within one slice of the node as "same
  level" (a tolerance meant for trend words), and `courseSentences` turned that class into the
  sentence "lies on the node’s level". The same tolerance produced "at about slice N" and
  "is on that same native slice" elsewhere.
- **Repair.** `DivisionCourse` carries exact signed offsets (`parentOffset`, `daughters[].offset`).
  Sentences now read "The model node lies nearest native slice 306. The parent point (RB4) is on
  slice 307, 1 slice cranial of the node, … Daughter A · RB4 · more anterior’s response slice, 307,
  lies 1 slice cranial of the model node". Only the qualitative words ("almost within one axial
  plane", "turns back") keep the one-slice tolerance, and the in-plane sentence says "within one
  slice". Reviewing the same generated wording across all 13 local divisions found two related
  imprecisions, fixed in the same pass:
  - "is on that same native slice" was ambiguous after the parent's slice had been named; it now
    reads "is the native slice nearest the model node".
  - Lesson 8's example sentence ("A route can descend and then turn cranially …") was quoted where
    the parent itself runs cranially (junction-16, junction-11). There, Lesson 8's general sentence
    is quoted instead.
    All wording is in the copy/source comparison (rows 17a–d); the full after-text for every division
    is in `review-repair/generated-level-wording-after.txt`.
- **Regression.** `__tests__/division-levels.test.tsx`:
  - pins junction-19 from the raw export and the native-v1 IJK→LPS matrix (node index 306.121 →
    306; parent 307; responses 307/307), independent of the display helper;
  - renders Lesson 5 example 2 and asserts the displayed wording;
  - recomputes every parent and response offset for all 13 local divisions from the raw export and
    checks each sentence;
  - allows the descent example only where the parent is followed caudally.
    In the browser: `review finding 1 · Lesson 5 states …`.

### Finding 2 (P2, inherited, in scope) · RS8 could not be reopened over ongoing LS9 work

- **Reproduction.** Lesson 9: view RS8 → start LS9 → record junction 1 → there was no way back to
  the worked route short of Restart, which discards LS9 work. Step 0 was the only home of the worked
  route, and the reducer has no route back to it.
- **Root cause.** The worked route was not a separate view. It was step 0 of the learner session,
  so seeing it again meant changing the learner's step.
- **Repair.** "View the worked RS8 route (reference)" is offered at every later step and after
  finishing. It sets a component flag (`reopened`). The same worked presentation then renders from
  reference state: its own junction, map, CT display and viewer position, with no learner marks.
  "Return to your trace: LS9" ("another trace: LS5" at step 6, "the finished lesson" after
  finishing) clears the flag. The learner viewer remounts from the stored `views` and `session`,
  unchanged. No draft is copied or overwritten, no attempt is created, and no target identity
  changes.
- **Regression.**
  - Jest `finding 2 · …`: view RS8 → LS9 → a genuine keyboard-placed pixel mark and a daughter
    choice recorded → snapshot → reopen, next ×2, previous, flip → return → the same "Junction 1 of
    6", the mark visible, stored bytes identical → reopen/return again → remount → equal by value →
    Continue proceeds.
  - Browser `review findings 2 and 3 · …`: the same through real UI, with a reload.

### Finding 3 (P2, inherited, in scope) · reference browsing wrote the learner draft

- **Reproduction.** On `6004cd7f`, stepping the worked RS8 route wrote `session.active` (captured
  `active: 2`). Rotating its CT wrote `session.orientation`, Show target wrote
  `session.targetViewed`, and its viewer wrote `views['right-lower-basal.demo']`. In local lessons,
  the walkthrough transport, Show reference and Replay wrote the stored `frame` (captured 21 → 1)
  and the viewer slice and focus in `views[exercise]`.
- **Root cause.** The worked route and the walkthroughs were driven through the learner session's
  own cursor fields and the same view-state writer the learner's navigation uses.
- **Repair.**
  - **Lesson 9.** The worked route reads and writes only component state (`workedActive`,
    `workedFurthest`, `workedOrientation`, `workedView`), and `onTargetReady` is inert while it is
    shown. An older draft's worked view is still read as the starting view, never written.
  - **Local lessons.**
    - The demonstration cursor is component state, seeded from an older draft's stored `frame`, so
      that `frame` now changes only with lesson transitions.
    - While a reference is on screen, a viewer report keeps the stored slice and focus and saves
      only display choices (magnify, full field, paired view).
    - The overlay and caption lookup uses the viewer's live slice, so the Prompt 03 step identity is
      unaffected.
    - `onViewChange` keeps one identity (the viewer re-reports on identity change), reading the
      reference state from a ref updated at layout time.
  - No schema, draft byte format or signature change was needed.
- **Regression** (Jest `finding 3 · …` ×3 and browser ×2).
  - The Lesson 9 worked route (next ×3, previous, flip, Show target): stored bytes identical, and
    equal by value after a remount.
  - The Lesson 4 walkthrough with a partial mark present (Show reference, next, next, previous,
    close, Replay, next, close): bytes identical, equal after reload; the learner's own later slice
    step **is** saved.
  - The Lesson 4 worked example stepped in the demo phase: bytes identical.
  - A reload writes the draft back in the parser's key order whether or not anything was viewed,
    so post-reload checks compare by value. Every in-session check compares bytes.

### Finding 4 (P2, inherited, in scope) · Continue did nothing after skip → record

- **Reproduction (reducer trace, before any edit).** LS9: skip junction 1 → `active 1, reached 1`;
  record junction 2 → `recorded 0100000`; Continue → `active` stays 1, state unchanged.
  `reachableThrough` returned 1 because `lastUnlocked` stops at the first unrecorded stop (the
  skipped junction, 0) and `reached` was 1, so index 2 was rejected. Practice uses the same
  function. A second no-op sat at the last stop: with earlier stops skipped, the route is never
  "done", so the last stop kept offering "Continue to the next division" with no next stop.
- **Invariant restored.** Recording the furthest opened stop opens the one after it.
  `reachableThrough` now walks forward from `max(lastUnlocked, reached)` while that stop is recorded.
  A recorded last stop with earlier stops skipped is a partial route with nowhere further to go:
  - Lesson 9 offers "Continue with this partial route" (step 6: "Finish with this partial route"),
    the existing continue-without-recording transition to the description step, where "Show the
    comparison without recording" is the truthful next step.
  - Practice's primary action becomes "Compare all routes" / "Next route without recording", and
    the duplicate secondary is removed.
    Skipped stops stay unrecorded, with no mark, branch or history. The fix is generic: no lesson or
    stop number is special-cased.
- **Regression.**
  - Jest reducer A (skip → record → Continue), B (record → skip → record → Continue), C (two skips
    → record → Continue), D (skipped stays skipped — an invariant, passes on both heads).
  - Jest component A in Lesson 9; E (partial route's last stop → description step, records
    unchanged, no duplicate action); Practice A and E via the primary action.
  - Browser `review finding 4 · …` in Lesson 9 and Practice.

### Fail-before / pass-after evidence

| Regression                                                      | On `6004cd7f`                                                                                                                                                                                                                                                                                            | On `80d44144` |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Jest `division-levels` + `reference-and-route-state` (26 tests) | 24 failed, 2 passed. The 2 are the raw-source pin and "skipped stays skipped", invariants that hold on both heads. Run with the six repaired runtime files restored from `6004cd7f` and the final test text; tree restored clean afterwards (`review-repair/logs/jest-focused-old-head-final-tests.log`) | 26 passed     |
| Browser: the four `review finding …` tests                      | 4 failed on the reviewed build `IH5OxvSXqGFtsMupcx28t`: 1 old wording; 2+3 `active: 2` written by RS8 browsing; 3 local `frame` rewritten; 4 "Junction 2 of 6" after Continue (`review-repair/logs/playwright-review-findings-old-head-IH5Ox.log`)                                                       | 4 passed      |

### Other tests updated because the contract changed

- `teaching-route-flow.test.tsx`: the Prompt 04 worked-route test asserted that each worked
  junction advanced the stored `session.active`. That was finding 3 itself. It now asserts the
  stored draft is byte-identical and only the worked map grows.
- `teaching-route-flow.test.tsx`: the LB6 primer phrase changed from "of the node" to "of the model
  node" (finding 1 wording).

### Validation after the final source and test edit (unique runs)

| Check                                                       | Result                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BBT Jest (`src/features/bronchial-branch-tracing`)          | 185 passed, 1 failed across 26 suites (186 tests; 26 new). The failure is the known baseline below (`review-repair/logs/jest-bbt.log`)                                                                                                                                                            |
| Playwright `e2e/branch-tracing.spec.ts` (repaired build)    | 69 passed, 0 failed, 0 skipped, 1.5 min (65 existing + 4 new). Includes Prompt 01 partial routes, Prompt 02 compact Check ×3 and decoded caption ×3, Prompt 03 repeated-plane identity and occlusion ×3, and all Prompt 04 journeys (`review-repair/logs/playwright-branch-tracing-repaired.log`) |
| Playwright `systemic-ux-stabilization -g bbt`               | 3 passed (`review-repair/logs/playwright-systemic-bbt-repaired.log`)                                                                                                                                                                                                                              |
| `npx tsc --noEmit` (repository)                             | Default heap: exit 0, no diagnostics. `NODE_OPTIONS=--max-old-space-size=8192`: exit 0, no diagnostics                                                                                                                                                                                            |
| ESLint (repair `.ts`/`.tsx` paths), Prettier (repair paths) | Clean                                                                                                                                                                                                                                                                                             |
| `git diff --check 6004cd7f HEAD`                            | Clean                                                                                                                                                                                                                                                                                             |
| `npm run build` (production)                                | Passed, exit 0, 1 min 58 s; build ID `EXc_a98IwiDfLGGPxvPEK`; no runtime file changed after the build started                                                                                                                                                                                     |

**Browser and server identity (repaired run).**

- Worktree `…/Worktrees/claude-bbt-04`, branch `claude/bbt-04`, head `80d4414436dd6acbc01b7fd14fc1cff2aeeb8f3e`.
- `PORT=3001 HOSTNAME=127.0.0.1 node .next/standalone/server.js`, pid 53032, cwd
  `…/claude-bbt-04/.next/standalone`, `next-server (v16.2.2)`, build ID `EXc_a98IwiDfLGGPxvPEK`
  (also present in the served HTML), `http://127.0.0.1:3001`.
- The old-head proof server: pid 51271, same cwd, build ID `IH5OxvSXqGFtsMupcx28t`.
- Both servers were mine, confirmed free before start and stopped afterwards
  (`review-repair/server-identity-*.txt`).

**Known baseline failure.** `contracts.test.ts:198`, `isPublicPath('/airway-anatomy/case-001/case_manifest.json')`
expected `false`, received `true`: materially identical. Access policy not changed.

**Protected-source integrity.** `review-repair/protected-hashes-repair.txt` is identical to
Prompt 04's after-list (every geometry file including `paired-scope.ts`, manifests, the airway
graph, the BBT-02 packet, `junction-feedback.ts`, `local-exercises.ts`, `ct-types.ts`, the fixtures,
and the public tree hashes). All 21 draft signatures equal the base
(`review-repair/draft-signatures-repair.json`; fixture test passing). Files changed by the repair:

- `components/BranchTracingLesson.tsx`, `components/BranchTracingPractice.tsx`,
  `components/DivisionPrimer.tsx`, `components/LocalCtLesson.tsx`
- `engine/ct-session.ts`, `engine/model-reference.ts`
- `__tests__/division-levels.test.tsx` (new), `__tests__/reference-and-route-state.test.tsx` (new),
  `__tests__/teaching-route-flow.test.tsx`
- `e2e/branch-tracing.spec.ts`
- these documents.

**Logged, not fixed (outside the four blockers).** In the Lesson 9 worked route map, the two-line
heading "Worked route map · N of 9 stops shown · model reference, not your route" can partly cover
the first map row when the pane scrolls to the current division
(`review-repair/screens/L9-RS8-reopened-1427x1226.png`). The row stays reachable by scrolling. It
is cosmetic and was introduced by Prompt 04's heading length.

**Limitations.** As above: emulated viewports in desktop Chromium, a CSS root-font probe rather
than native zoom, no screen reader, device, Safari or Firefox. The repair was not re-walked end to
end beyond the listed journeys, and no G02 was run.

**Evidence.** `…/renders/output/bbt-pre-review-04-2026-09-23/review-repair/` (logs, screens, server
identities, protected hashes, signatures, generated level wording).

**Status: SANITY REPAIR: READY FOR INDEPENDENT RE-REVIEW.** Not merged, not deployed; Prompt 05 not
started.
