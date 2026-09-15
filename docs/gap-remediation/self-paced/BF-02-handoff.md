# BF-02 — Larynx-to-trachea view continuity

## Scope and implementation brief

Starting checkout: `codex/bf-02`, clean, HEAD
`3cacff099967a7f3bb5cfa8b818460f1c939bdc9`. BF-01 is merged (PR #213).
The optical renderer, insertion engine and larynx path are unchanged from historical
baseline `9ef04539118b889a344992c63ba35808ee477f0e`.

This is a module-local repair to the existing larynx lesson, not a curriculum migration.
The v2 learning-design brief governs: questions remain optional, teaching and navigation
remain open, and no graded records are written. Older shared-stage requirements for
mandatory predictions, fixed panes and correctness-gated progression are superseded for
this work. No shared stage, catalog, progress, route, Device Intelligence or other module
changes are planned.

### Reproduction before edits

- Route: `/en/bronchoscopy-foundations/learn?section=larynx-and-entry`, then two Continue
  clicks to Part 3, “Now observe opening and enter” (`phase=act`). No question answered.
- Model: `adult-teaching-combined-left-basal-v1`, the existing larynx GLB and path.
- Camera: existing optical camera, 0° rotation/deflection, near 0.05 mm, far 1400 mm;
  unchanged 88° FOV (`OPTICAL_FOV_DEG`, converted for the viewport aspect).
- Reproducible timing: reduced motion, Reset the scope, Step one second three times
  (scripted inspiration), then 14 Advance clicks at the existing 3 mm step.
- At 42 mm the subglottic optical view is entirely dark. The next Advance reaches
  the 45 mm handoff and the trachea abruptly appears. Withdraw returns to 42 mm and
  the view goes dark again. The observer remains visible throughout.
- An earlier exploratory crossing during expiration was correctly refused. This
  protective behavior is separate from the visible discontinuity.

### Diagnosis and bounded repair

`ScopeOpticalView` excludes `AirwaySurface` while `state.place === 'larynx'` even though
the renderer already has the tracheal asset. That removes all downstream anatomy before
crossing and again on return. Repair that visibility condition first and recheck the same
path. No mesh edit, rescaling, camera change or control change is justified by this blackout.

The separate asset TODO remains an anatomical/content hold: the authored exit ring is
up to 2.4167953883 mm from the unchanged capped source inlet. Path endpoint agreement
is not a continuous physical opening. Preserve the original test TODO, review data,
asset hashes and pending-review status. Faculty must distinguish the rendered transition
from the unresolved source-inlet geometry; software QA is not anatomical approval.

## Executed evidence

Local server: `npx --no-install next dev --webpack --hostname 127.0.0.1 --port 3112`.
The real learner route was exercised unauthenticated in the Codex in-app browser;
no auth or media-access controls changed. The isolated server had no Supabase environment:
its unrelated analytics endpoint returned 500. The existing Playwright setup stubs analytics
locally; no remote data, services, migrations or uploads were used.

All browser commands below used `BRONCH_FOUNDATIONS_BASE_URL=http://127.0.0.1:3112`.

| Command                                                                                                                                                                                                                                        | Actual result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx --no-install jest src/features/bronchoscopy-foundations --runInBand --json --outputFile=/tmp/bf-02-baseline-jest.json`                                                                                                                    | Before edits: **24 suites passed; 324 passed, 1 existing TODO**; 24.057 s.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `npx --no-install playwright test -c playwright.bronchoscopy-foundations.config.ts -g 'larynx transition.*1440' --reporter=list,json`                                                                                                          | New regression on original renderer: **1 failed**, 18.5 s. At 42 mm the central optical image had **0** tissue-pixel fraction despite reporting ready/clear. Failure log retained.                                                                                                                                                                                                                                                                                                                                                                                                       |
| `npx --no-install jest src/features/bronchoscopy-foundations/__tests__/scenePins.test.ts --runInBand`                                                                                                                                          | First draft of new handoff assertion: **6 passed, 1 failed**. An assumed <0.001-radian match was too strict for the existing authored frame. Inspection found an unchanged 2.6613° roll difference at neutral controls, with forward-axis difference 0.000284°. No engine/axis changes made. The final assertion bounds the existing offset at 3° and separately requires round-trip restoration. This is a software regression bound, not an anatomical tolerance.                                                                                                                      |
| `npx --no-install playwright test -c playwright.bronchoscopy-foundations.config.ts -g 'larynx transition' --reporter=list,json`                                                                                                                | After repair: **3 passed**, 2.7 min, at **1440×900, 900×800 and 390×844**. Each checks actual pixels at approach 42 mm, crossing 45 mm, trachea 48 mm, return 42 mm, rotation 30°/deflection 10° on return, and reset/repeat. Controls available without an answer; Continue without completing works; no legacy record or reviewed-section claim; no horizontal overflow.                                                                                                                                                                                                               |
| `npx --no-install jest src/features/bronchoscopy-foundations src/lib/airway-anatomy --runInBand --json --outputFile=/tmp/bf-02-final-jest.json`                                                                                                | **33 suites passed; 397 passed, 1 existing TODO**; 23.516 s. Includes decoded assets/hash/provenance, real graph/control/safety, collision-review invariants, projection, new 12-combination handoff round trips, and module self-paced regressions.                                                                                                                                                                                                                                                                                                                                     |
| `npx --no-install playwright test -c playwright.bronchoscopy-foundations.config.ts -g 'one entry, explanation\|retains working controls\|survey distinguishes entering\|Practice explains before\|integrated cases open' --reporter=list,json` | **5 passed**, 23.5 s. Actual route checks cover explanation before answering, wrong answer/retry, Back/reload, usable WebGL fallback, entered-versus-inspected survey records, Practice and legacy integrated-case access without grades.                                                                                                                                                                                                                                                                                                                                                |
| `npx --no-install tsc --noEmit --pretty false`                                                                                                                                                                                                 | **Passed**, exit 0, no diagnostics.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `npx --no-install eslint src/features/bronchoscopy-foundations/components/scope/ScopeOpticalView.tsx src/features/bronchoscopy-foundations/__tests__/scenePins.test.ts e2e/bronchoscopy-foundations.spec.ts`                                   | **Passed**, exit 0, no diagnostics.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `node scripts/bronchoscopy-foundations/review-scope-pane.mjs`                                                                                                                                                                                  | **Failed**, exit 1: timed out at line 281 waiting for ready after deliberately aborting and then retrying `devices/bench.glb` in `controls-isolated` mode. Earlier sequential assertions ran through all seven rendered modes, loaded-lumen survey, red-out recovery, tube annular geometry, controls, laryngeal entry, accessory changes, WebGL context replacement, phone map, automatic/offscreen-paused breathing and touch input. This is partial evidence, not a green harness. Its retry branch is outside the changed larynx visibility condition; it was not repaired in BF-02. |

No existing test was removed, disabled or weakened. The failed first draft was a new
camera assertion corrected against the unchanged pre-existing engine; its failure is recorded
above. The historical surface-junction TODO and pending-review assertions remain intact.

Not run: full-site lint/Jest/Playwright, production build and embedded training-app builds,
new mesh generation or source-deviation review, native screen-reader testing, faculty review.
The targeted suite is not a claim of full-site or clinical approval.

## Behavior and contract changes

| Old behavior / evidence                                                                                       | New behavior / evidence                                                                                                                                                                       | Preserved invariant                                                                                           |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| The downstream airway mounts only after `place` becomes `airway`; a ready/clear subglottic view can be black. | Mount it throughout the non-bench view. Pixel regression fails before and passes after on the same real route.                                                                                | Same mesh, path, material, camera, FOV, depth steps and event semantics.                                      |
| No transition-specific round-trip frame check.                                                                | Twelve combinations of rotation and deflection check 0.25 mm approach/crossing/return, the actual TR edge, bounded existing roll change, restored position/frame, and unchanged input values. | No coordinate re-registration or control reinterpretation.                                                    |
| BF-01 open navigation and optional explanations.                                                              | Unchanged; model reached after two teaching steps without a question, and left with Continue without completing.                                                                              | No invented response, declaration, capture, successful run, grade, reviewed section or legacy progress write. |

### Question ledger for the affected lesson

No question or explanation was edited. Adjacent questions remain optional reinforcement;
the rendering repair does not introduce a question before the model.

| Item                         | Decision                          | Teaching purpose / disposition                                                                                                                                     |
| ---------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `N04`                        | **Keep as reinforcement**         | Compare alignment with the visible opening during entry. Existing explanation, unsafe-choice feedback, retry and unanswered continuation remain available.         |
| `Q17`                        | **Keep as reinforcement**         | Contrast what withdrawal through an existing tube permits the record to claim. Source uncertainty remains in **BF-01-C02 / R08**; this repair does not resolve it. |
| `N03` (five-controls lesson) | **Unchanged, outside this batch** | BF-01 already made it optional. It is not a prerequisite for the larynx route or its controls.                                                                     |

For this batch: **keep 2; rewrite/replace/combine/remove 0**. This is not a new clinical
review of those questions; retain the BF-01 claim-review queue and question ledger.

### Progress and safety

No persistence file or API changed. `ip-bronchoscopy-foundations-v1` remains legacy,
read-only data. The existing self-paced record keeps location/visited/review-later state;
scope position and answers still restart on reload. Reset resets the actual model;
viewing it does not declare the trachea inspected. The authored closed-fold and alignment
refusals, accessory guards, collision engine and authentic survey requirement remain.

The live larynx has no separate Pause/Replay buttons. Its existing reduced-motion mode
holds scripted time and exposes **Step one second**; **Reset the scope** permits a repeat.
Those controls were used for the fixed comparisons. Automatic breathing and pausing when
offscreen were also exercised by the loaded-asset harness before its later retry failure.
No demonstration is described as observed physical handling performance.

## Faculty evidence and remaining hold

Actual screenshots and complete logs are in Local-Data at
`renders/output/BF-02/`; open `index.html` for the portable local review packet. This folder
contains generated QA evidence only, not copied authoring inputs. No screenshots or private
source material are uploaded with the PR.

- **Before/after real learner views:** `before-1440-approach-42.png`,
  `before-1440-crossing-45.png`, `before-1440-return-42.png`, and matching `after-1440-*`.
- **Browser regression images:** `optical-{1440,900,390}-*.png`, six actual optical
  states per viewport. Desktop approach, compact crossing and phone rotated return
  were opened and inspected, as were the actual full learner screens at desktop and phone.
- **Additional UI review:** `after-390-return-42.png`, `after-900-paused-approach-42.png`.
- **Logs:** baseline/final Jest JSON, baseline/after browser logs and parsed transition
  report, consumer browser log, type-check/lint logs, and the failing scope harness log.

### Asset identity (unchanged)

All paths below are under `public/bronchoscopy-foundations/anatomy/`.

| Asset                                              |  Bytes | SHA-256                                                            |
| -------------------------------------------------- | -----: | ------------------------------------------------------------------ |
| `larynx/larynx-lumen.glb`                          | 221064 | `fc707d8f8fe17c7e4050cfce361dca20f432c5ad87a36ea322d61b5e017a5afb` |
| `larynx/larynx.json`                               |  14386 | `ca82ec35dd6266a85bad961f34160faeac2f96de0b245eb08360aa2233ff269a` |
| `adult-teaching-combined-left-basal-v1/lumen.glb`  | 489888 | `7fb74ea16ef63a7fa42e97164e15f677b3cc0120bf04a8567e885ba827110d39` |
| `adult-teaching-combined-left-basal-v1/graph.json` |  71449 | `68085358711a1c00e1e22e63fbdf04a90166a6e598f0a1955f33901af4006055` |

**Technical outcome:** the reproduced disappearance/pop-in is repaired. There is no newly
observed clipping, camera flip or control regression in the tested paths. The repair retains
the source's proximal shape; rendering visible tissue is not proof of a physically continuous
full-size inlet. The existing roughly 2.6613° neutral roll offset remains unchanged.

**Human boundary still open:** faculty must inspect the appearance, landmarks and approach/
crossing/return views. The 2.4168 mm surface mismatch and closed source inlet remain
`pending-source-inlet-decision`, `continuousOpeningVerified: false`. Rights, de-identification,
source attribution, clinical review and publication statuses are unchanged. No review signature
or approval is supplied by this PR.

## Scoped acceptance review

This checks the repair, not full-module compliance. The current v2 self-paced direction takes
precedence over examination-oriented skill defaults.

| Contract                 | Status / evidence                                                                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| H1 — Entry/navigation    | **PASS in scope:** direct larynx route, two Continue steps, real controls without a question; open navigation regressions pass.                                                                                                            |
| H2 — Teach before use    | **PASS in scope:** two existing visible teaching steps precede the unchanged model. No new clinical copy.                                                                                                                                  |
| H3 — Shared stage/layout | **NOT APPLICABLE:** no migration; v2 does not require fixed panes; shared stage untouched.                                                                                                                                                 |
| H4 — Current task        | **PASS in scope:** existing active instruction and genuine controls retained at desktop/compact/phone widths.                                                                                                                              |
| H5 — Rendered teaching   | **PASS in scope:** repaired downstream anatomy actually paints in the learner view.                                                                                                                                                        |
| H6 — Real activities     | **PASS in scope:** actual Advance/Withdraw; Skip invents no declaration or completed goals.                                                                                                                                                |
| H7 — Questions/feedback  | **PASS under v2:** explanations and unanswered continuation remain available; existing unsafe feedback passes.                                                                                                                             |
| H8 — Fidelity            | **PASS for preservation; BLOCKED for anatomical approval:** exact asset hashes/engine retained; decoded-geometry and handoff checks pass; source-inlet hold remains.                                                                       |
| H9 — Progress            | **PASS in scope:** no store changes or graded writes; browser checks retain honest record boundaries.                                                                                                                                      |
| H10 — Language           | **NOT APPLICABLE to new copy:** no learner-facing language change. Existing source holds retained.                                                                                                                                         |
| H11 — Scope/release      | **PASS:** four module-specific code/test/doc paths only; no shared infrastructure, other modules, Device Intelligence, release or data changes.                                                                                            |
| H12 — UX evidence        | **PASS for reproduced transition and targeted consumers; FAIL for complete legacy harness:** eight targeted browser tests pass and captures inspected; missing bench-asset retry timed out as reported above. Faculty review remains open. |

## Changed files and next slice

- `src/features/bronchoscopy-foundations/components/scope/ScopeOpticalView.tsx`
- `src/features/bronchoscopy-foundations/__tests__/scenePins.test.ts`
- `e2e/bronchoscopy-foundations.spec.ts`
- `docs/gap-remediation/self-paced/BF-02-handoff.md`

**No shared integration is required for this repair.** After faculty reviews the packet,
any physical-inlet work needs a separately stated asset decision: whether the source cap may
change, the scope of the source-deviation exception, the consumer/geometry checks and anatomical
acceptance evidence. Preserve the existing TODO until that is actually resolved. Independently,
reproduce the existing bench missing-asset retry failure in a bounded BF follow-up. BF-03 source/
teaching work and all BF-01 clinical holds remain separate.
