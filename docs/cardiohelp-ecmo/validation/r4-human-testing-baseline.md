# R4 — human-testing baseline (D-5)

Declared under decision D-5 of `../redesign/r0-redesign-baseline-decision.md`: the next human round
tests this state, not `2f26cb76`, and records its start state here the way the B6 register stamped
its own.

| Field                   | Value                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Code baseline           | `1d33e675` on branch `claude/ecmo-9-3` (base `origin/main` at `42dcea42`)                                                                                                                                                                                                                                                                                                                                                                  |
| Worktree                | `/Users/russellmiller/Projects/Interventional-Pulm-Education-Worktrees/claude-ecmo-9-3`                                                                                                                                                                                                                                                                                                                                                    |
| Dev server for sessions | `npm run dev:claude` on port 3120, routes public-unlisted, `noindex`                                                                                                                                                                                                                                                                                                                                                                       |
| Start-state test result | Protected scope 100 suites / 2348 tests green at `1d33e675` with the R4 records applied (`npx jest src/features/cardiohelp-ecmo src/features/critical-care src/features/learning-module 'src/app/\[locale\]/cardiohelp-ecmo' --runInBand`); `npx tsc --noEmit` exit 0. `npm run type-check`, `npm run lint` (0 errors, 15 pre-existing warnings), `npm run test:a11y` (16/16), `npm run render:ecmo-teaching` (16 panels, 83 states) pass. |
| Publication status      | `draft`; nothing credit-eligible; every reworded item `reviewStatus: 'draft'` pending subject-matter review                                                                                                                                                                                                                                                                                                                                |
| Records                 | `../redesign/r4-owner-decisions.md`, `../redesign/r4-implementation-record.md`, `../redesign/r4-scoring-honesty-record.md`                                                                                                                                                                                                                                                                                                                 |

## What this baseline changes for a session

- **The navigation-competence precondition is on the task sheet.** `b5-novice-participant-tasks.md`
  opens with a "Before the tasks" check: from the module's front page the participant must reach the intended starting point
  unaided and say what the screen asks now, where they are in the sequence, and how they would get
  to the next part. If they cannot, the clinical tasks are set aside for that session and the
  conversation is about what got in the way — the R0 §6 rule, applied before any clinical task.
- **Every surface has one progression and one Now card.** Facilitators should not read a lesson
  title aloud (they are presentation-named now, and the facilitator guide's table follows them) and
  should note whether the participant finds the Now card, the Sections disclosure, "What do I do
  now?", and the surface disclosures without prompting.
- **Practice and Challenge are in scope for the first time.** Cases open on a Brief stage named by
  presentation; the diagnosis appears only in the debrief. The observation form's masking questions
  ("did the participant name the diagnosis before committing, and from what?") apply to Practice
  as well as Learn.
- **The engine behaves differently in ways the participant can see** (R4 I6): the membrane's outlet
  saturation falls during a sweep-off trial; "review the upper body" on VA does not raise the right
  arm; a clamp changes the patient a second later, not at once; a wrong plan followed by the right
  moves earns a debrief that says so. Observers should record what cause the participant assigns to
  each of these, since B6 asked exactly those human-testing questions.

## Environment notes

The dev worktree has no Supabase environment: `/api/analytics` posts return 500 and the first
request through the auth proxy can redirect to the site root. Neither affects the module's behaviour
for a participant; the facilitator loads the task URL once more if the root appears. Sessions run in
a real browser at 1440×900 or larger; the embedded preview pane used for the DOM probe does not
represent a participant's screen.

## What the probe measured at this baseline (1440×900, first step / Brief)

| Surface                                  | Visible controls            | Visible words | Words under 13 px | Headings |
| ---------------------------------------- | --------------------------- | ------------- | ----------------- | -------- |
| Drill `preload-drainage-collapse`        | 49 (29 outside the console) | 529           | 148               | 7        |
| Foundation `circuit-flow-path`           | 51 (31)                     | 452           | 134               | 5        |
| Practice `clinical-vv-occult-hemorrhage` | 47 (27)                     | 373           | 107               | 4        |

The R0 baseline for the same three pages was 91 / 1075 / 777, 93 / 2595 / 536 and 75 / 1140 / 800.
