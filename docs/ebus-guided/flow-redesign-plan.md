# Guided EBUS activity flow

September 13, 2026. Implementation branch: `codex/ebus-guided-flow`, from
`2b10cb6a` on `origin/main`. EBUS feature content is unchanged from the brief's
`c2371c01` baseline. The worktree was clean before branching.

The learner is an early pulmonary fellow with basic flexible-bronchoscopy and
chest-CT knowledge. The course connects the clinical question, transducer position,
usable image, anatomical interpretation, examination plan, specimen evidence and
report. It assesses knowledge, reasoning and specified model actions, not hands-on
procedural competence.

## Implementation decisions

- Replace the seven positional stages with explicitly authored, stable activities.
  Briefings, demonstrations, acquisition, retained-image review, cases and records
  use different compositions. Questions can share a coherent case activity;
  explanations appear beside the committed response. No uniform screen count.
- Keep all 26 lesson IDs, historical item IDs, sources, technical checks and safety
  boundaries. Seven chapter definitions own order; measurement phantoms precede
  capture. Internal topic IDs remain compatible.
- Use a feature-owned task surface and existing buttons, question feedback and
  modal primitives. The brief explicitly supersedes the old shared three-pane
  layout audit. Shared stage defaults and other modules remain unchanged.
- Keep the learner iframe/session through acquisition, held interpretation and
  feedback. A demonstration and each changed-position exercise get distinct
  sessions. Review pauses current work without replaying an action. Recorded media
  receive explicit frame/source identity and a stable comparison image.
- Add a versioned local educational examination artifact, separate from course
  completion. Keep model observations separate from narrated specimen/report cases.
  Distinct cases, stations, nodes, specimens and results retain provenance.
- Incomplete lesson activities restart on reload; completed lessons and first
  responses retain their existing meanings. Compatible examination drafts resume
  as records, never as live image guidance. New record tasks are versioned evidence,
  not inferred from historic completion.

## Delivery and verification

First migrate clinical purpose, orientation, contact and station 7; verify real
actions and retained images. Expand to recorded imaging and all companion models,
then regional anatomy, planning, sampling and reporting. Finish with every lesson
route and representative cases using actual browser controls.

Run root/embedded TypeScript, focused Jest/Vitest and lint, embedded/root builds,
model/acoustic/knobology regressions and browser journeys. Check 1440×900,
1280×720, 1024×768, 900, 768, 390×844 and 320 CSS-pixel layouts, keyboard/focus,
reduced motion, text enlargement and failed media. Record exact results and limits.

Development verification used the existing server in this worktree on port 3136.
A separate production preview runs on 127.0.0.1:3157. An attempted 3156 launcher
correctly refused to start a second development server for the same worktree. No authentication, Supabase, upload,
geometry, release or deployment changes are part of this task. Repository AGENTS.md
already authorizes the normal branch/PR workflow; merge remains out of scope.

Faculty review, new clinical annotations, pathology-linked media, new station
contrasts, additional anatomies and device-specific mechanics remain separate
review dependencies. This refactor does not claim those are delivered.
