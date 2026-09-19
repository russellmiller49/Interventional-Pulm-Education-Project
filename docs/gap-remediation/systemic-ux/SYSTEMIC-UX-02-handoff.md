# SYSTEMIC-UX-02 — bounded stabilization handoff

**Phase: OWNER REVIEW. The owner remains the sole reviewer.** External learner, faculty and
technologist beta review belongs later on `development-beta`, after owner refinement. This is
engineering stabilization, not clinical/content approval or a new systemic UX audit.

Baseline: fresh `origin/main` at `99e0943c` (merged report-only PR #245), verified on 2026-09-18.
Branch: `codex/systemic-ux-02`. The SYSTEMIC-UX-01 inventory, handoff and post-merge regression
were read together with the owner's supplied independent Ultra findings. All three failures
were reproduced against an unmodified full production build before repair.

## Three repairs

### 1. Mechanism control / canonical circuit co-visibility

Route: `/en/baxter-crrt/learn?lesson=crrt-solute-transport`, task **At the membrane: solute and
water**. The filter inset used to be inside `CircuitWorkbench.controls`, between the controls
and circuit when the flex layout wrapped. The mechanism-specific composition now keeps the
existing control/circuit pair together, with the inset beside it when space permits and after
it when the available width or enlarged text requires wrapping. DOM order follows this reading
order. The other four workbench compositions remain unchanged.

The inset remains rendered and reachable; its SVG and explanatory text change with the actual
mechanism control. There is no sticky/fixed visual, disclosure gate, transport-model change,
button/handler change, deleted teaching, or changed task order.

At 1024×768 ordinary text, the site header ends at y81 and the usable band is 687px:

| State                            | Control bounds | Canonical SVG bounds | Vertical union |
| -------------------------------- | -------------- | -------------------- | -------------: |
| Merged baseline, initial         | y93.58–137.58  | y598.17–1068.17      |       974.59px |
| Merged baseline, Convection      | y93.58–137.58  | y576.48–1046.48      |       952.91px |
| Repaired, initial and Convection | y93.58–137.58  | y211.11–681.11       |       587.53px |

The full 800×470 SVG and active control now fit together. Native wheel input positions the
workbench; native Space changes the actual circuit pixels and inset SVG without changing
`scrollY`. Reload repeats the repaired geometry with fresh transient controls. The reported
pre-SYSTEMIC-UX-01 comparison (~654px) remains historical evidence from PR #245, not a new run.

Final control/canonical-circuit vertical unions in pixels (identical before/after the real
control selection in each repaired state):

| Workbench family | 1600×900 | 1440×900 | 1024×768 | 390×844 | 320×740 | 1440×900, 200% text |
| ---------------- | -------: | -------: | -------: | ------: | ------: | ------------------: |
| Modalities       |   516.34 |   516.34 |   587.53 |  587.53 |  639.53 |              695.69 |
| Blood pathway    |   516.34 |   516.34 |   587.53 |  691.53 |  743.53 |              792.27 |
| Fluid pathway    |   516.34 |   516.34 |   587.53 |  639.53 |  743.53 |              792.27 |
| Pressure sites   |   516.34 |   516.34 |   631.53 |  735.53 |  787.53 |              872.84 |
| Mechanisms       |   587.53 |   587.53 |   587.53 |  587.53 |  639.53 |              695.69 |

Compact diagrams retain their existing internal horizontal schematic scroller. Compact and
200% text checks establish reachability/reflow, not simultaneous visibility of every visual.

### 2. Instruction navigation and visible focus

Route: `/en/baxter-crrt/learn?lesson=crrt-pressure-profile-integration`.

`CrrtFoundationLesson` now owns an instruction ref below the persistent task map. After an
explicit map selection commits, it focuses that instruction's heading with `preventScroll`,
then reveals the instruction target with the local scroll clearance. The heading has a visible
outline and a programmatic-only tab stop. The map stays expanded; its current-task indication
remains correct. Selecting the already-current task also reveals it.

Continue/skip still reveal the replacement instruction using the existing task-location
boundary. CRRT foundation documents use immediate native focus scrolling: repeated production
probes showed that a pending smooth Tab scroll could otherwise override the subsequent
instruction reveal during rapid Tab/Enter navigation. Initial mounting, workbench changes,
evidence updates and retry do not create this navigation scroll. There is no global focus
listener, new completion gate or new progress store.

| Final task after expanded-map selection | Baseline heading top | Repaired heading top |
| --------------------------------------- | -------------------: | -------------------: |
| 320×740                                 |             754.33px |             121.33px |
| 1440×900, 200% root text                |            1472.73px |             369.73px |

The baseline kept focus on a map button (y657 at 320; y1287 with enlarged text). The repaired
focus is on the visible selected instruction. Mouse and native Tab/Enter tests cover first,
middle, final and current-task re-selection across all six variants; closed-map continuation
covers those positions too. A rendered Jest test checks the real handlers, scroll target,
re-selection, initial mount and ordinary mechanism selection.

### 3. Page scroll ownership boundary

The existing module roots directly beneath `#main-content` declare once:

```html
<main data-learning-scroll-owner="document">…active activity shell…</main>
<main data-learning-scroll-owner="workspace">…active activity shell…</main>
```

The element type follows each existing adapter (`main`, `section` or `div`); no universal layout
component was introduced. CRRT focused lessons, MV task flow and MCS flowing lessons declare
`document`. BBT and ECMO active workspaces declare `workspace`. Their non-activity entry pages
declare `document`.

The desktop CSS lock examines **that direct page boundary containing the active activity shell**.
Only the exact `document` value exempts its shell. Explicit `workspace`, missing declarations
and invalid values retain the previous workspace default when an activity shell exists.
Missing declarations do not silently unlock legacy adapters. A marker on a descendant, sibling
without an activity shell, or body portal cannot override the active boundary. Hidden, inert and
ARIA-hidden boundaries do not claim ownership. The outside-footer rule now targets the site's
`#main-content + footer`, preserving module footers.

The existing 1024px-width / 700px-height media boundary is retained. Existing responsive
component behavior remains authoritative outside it. HD was not modified to satisfy legacy
tests; undeclared adapters retain their prior behavior.

Production adversarial tests exercise:

- The old `data-learning-document-flow="false"` marker on an unrelated hidden body element.
- False-valued, hidden and nested unrelated declarations inside the active shell.
- A sibling declaration without a shell and an unrelated body portal.
- A missing declaration and an invalid `false` value on the actual owner (legacy lock retained).
- Exact active-boundary `document` and `workspace` values (overflow and outside-footer assertions).
- A nested workspace declaration and hidden unrelated activity shell on a document-owned page.
- Native wheel scrolling after the adversarial mutations, as well as the five real module routes.

The baseline hidden false marker changed ECMO's body/main overflow from `hidden` to `visible`
and exposed the site footer. All 15 native-wheel checks and both adversarial tests pass on the
final production build.

## Changed paths

| Area                   | Paths and purpose                                                                                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRRT composition       | `src/features/baxter-crrt/components/CrrtFoundationTools.tsx`, `crrt-foundations.module.css`: keep the mechanism's primary pair together and retain the inset.                                        |
| CRRT navigation        | `src/features/baxter-crrt/components/CrrtFoundationLesson.tsx`, same local CSS: instruction ref and explicit map-selection focus.                                                                     |
| Ownership declarations | `BaxterCrrtModuleFrame.tsx`, `MechanicalVentilationModuleFrame.tsx`, `McsModuleFrame.tsx`, `CardiohelpModuleFrame.tsx`, BBT `components/ModuleFrame.tsx`: one value on each existing module boundary. |
| Global contract        | `src/styles/globals.css`: direct-boundary, exact-value document exception and scoped site footer.                                                                                                     |
| Regression coverage    | `e2e/systemic-ux-stabilization.spec.ts`, the existing systemic test's declaration selector, `playwright.systemic-ux.config.ts`, CRRT `__tests__/foundationLessons.ui.test.tsx`.                       |
| Handoff                | This report.                                                                                                                                                                                          |

No curriculum, clinical engine, source/media/device review status, Device Intelligence, HD,
release flag, source asset, question, persistence schema or authored clinical text changed.
The current self-paced contract remains authoritative.

## Validation

Real Chromium against a full production build, served by `next start` at
`http://127.0.0.1:3170`. Six variants: 1600×900, 1440×900, 1024×768, 390×844, 320×740 and
1440×900 with 200% root text. The text variant tests reflow, not every browser zoom implementation.
Local APIs/external requests are isolated where the existing harness provides isolation.
No authenticated backend or seeded learner completion is used.

| Check                                       | Result                                                                                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full production build                       | PASS, including both training apps, content generation, asset checks, Next build and standalone preparation.                                                         |
| Root TypeScript                             | PASS with 8GB Node heap on the final TypeScript sources/tests.                                                                                                       |
| Relevant Jest                               | 232 suites / 4,689 tests pass; one known BBT access-contract failure (233 suites / 4,690 tests total). Final navigation test rerun: 7/7 pass, a subset of the above. |
| New stabilization Chromium                  | PASS, 65/65 (30 workbench, 12 navigation, 15 native ownership, 2 adversarial, 6 nine-entry matrices).                                                                |
| Existing systemic Chromium                  | PASS, 39/39, including EBUS engineering smoke and fixed anticoagulation semantics; repeated on the final build.                                                      |
| Existing CRRT Chromium                      | PASS, 16/16 foundation, operational, advanced and self-paced journeys; repeated on the final build.                                                                  |
| Targeted PI / BF / ECMO Chromium            | PASS: PI 31/31, BF 21/21 and ECMO layout/focus 30/30. No historical G02.                                                                                             |
| Rapid native keyboard regression            | PASS, three extra repetitions each at 1600 and 1024 (6/6).                                                                                                           |
| Changed-path ESLint / Prettier / diff check | PASS; no changed-path lint warnings, formatting or whitespace errors.                                                                                                |

The CRRT journeys cover explanation, wrong answer, retry, skip, actual operations, all 18 public
cases, reload and unchanged ungraded progress. The systemic file covers native document flow in
MV/MCS, real output changes, EBUS recorded comparisons/freeze/calipers/save/unavailable response,
and representative unaffected workbenches. The public-entry matrix opens all nine routes in
all six variants (54 route/viewport combinations) and follows the entry links at 1440.

Initial implementation/testing iterations are retained in evidence: the first CSS revision
used an invalid nested `:has()` and failed workspace-lock checks; the corrected selector was
rebuilt before the final production run. The new navigation test first used an ambiguous
heading selector, then attempted the intentionally disabled observation-review button during
a closed-map navigation check. It now targets the direct instruction heading and the real
self-paced continuation. The stricter closed-map keyboard check then exposed the native
smooth-focus-scroll race described above; a CRRT-local CSS rule repairs it rather than adding
test delays. Existing legacy tests were not changed to produce green results.

The 137 existing browser checks passed against production output containing the final ownership
contract. After the last CRRT-local focus-scroll correction, the full production build was
repeated (`BUILD_ID=VW-pd_Js37HbNpz65Rwm6`) and all 120 affected checks passed: 65 new, 39 systemic
and 16 CRRT. The unchanged PI/BF/ECMO suites were not repeated after that local-only correction.
Across these runs, **202 distinct browser checks pass**, with no skipped or flaky results.
Repeated passes are not counted as additional unique tests.

Visual inspection includes the final production mechanism pair at 1024 and 1440, and visible
final-task focus at 320 and 200% text. The measured heading clears the site header in every
variant. Before/after screenshots and raw per-test bounds are retained with the evidence.

### Reproduction

Start the production server separately from the same build. The preview values below are
non-secret placeholders; no local secret file is copied or printed.

```sh
NEXT_PUBLIC_SUPABASE_URL=https://preview.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=preview-only NODE_OPTIONS=--max-old-space-size=8192 npm run build
NEXT_PUBLIC_SUPABASE_URL=https://preview.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=preview-only node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3170
NODE_OPTIONS=--max-old-space-size=8192 npm run type-check
NODE_OPTIONS=--max-old-space-size=8192 npx jest --runInBand src/features/baxter-crrt src/features/learning-module src/features/mechanical-ventilation/__tests__ src/features/mechanical-circulatory-support/__tests__ src/features/cardiohelp-ecmo/__tests__ src/features/bronchial-branch-tracing/__tests__
SYSTEMIC_UX_BASE_URL=http://127.0.0.1:3170 npx playwright test --config playwright.systemic-ux.config.ts e2e/systemic-ux-stabilization.spec.ts
SYSTEMIC_UX_BASE_URL=http://127.0.0.1:3170 PERIPHERAL_IMAGING_BASE_URL=http://127.0.0.1:3170 BRONCH_FOUNDATIONS_BASE_URL=http://127.0.0.1:3170 npx playwright test --config playwright.systemic-ux.config.ts e2e/systemic-ux.spec.ts e2e/baxter-crrt-foundations.spec.ts e2e/baxter-crrt-self-paced.spec.ts e2e/baxter-crrt-operations.spec.ts e2e/baxter-crrt-advanced.spec.ts e2e/peripheral-imaging.spec.ts e2e/bronchoscopy-foundations.spec.ts e2e/ecmo-layout.spec.ts e2e/ecmo-focus.spec.ts
SYSTEMIC_UX_BASE_URL=http://127.0.0.1:3170 npx playwright test --config playwright.systemic-ux.config.ts e2e/systemic-ux-stabilization.spec.ts e2e/systemic-ux.spec.ts e2e/baxter-crrt-foundations.spec.ts e2e/baxter-crrt-self-paced.spec.ts e2e/baxter-crrt-operations.spec.ts e2e/baxter-crrt-advanced.spec.ts
SYSTEMIC_UX_BASE_URL=http://127.0.0.1:3170 npx playwright test --config playwright.systemic-ux.config.ts e2e/systemic-ux-stabilization.spec.ts --grep 'instruction navigation.*(1600|1024).*keyboard' --repeat-each=3
```

Evidence directory:
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/systemic-ux-02-20260918/`.
`SHA256SUMS.txt` inventories the archived files; `source-metadata.json` identifies the baseline,
final commit/build and source fingerprints. `measurements.json` collects baseline and final
geometry, navigation and ownership results. Screenshots, raw measurements, traces and logs
remain outside Git according to `docs/local-authoring-assets.md`.

Key evidence: `baseline.json`, `before-*.png`, `verified/` (final 120-check run),
`final-affected-results.json`, `regressions-results.json`, `navigation-repeat-results.json`,
`jest-results.json`, `production-verified-build.log`, `type-check-final.log`, and final lint /
formatting logs. Failed interim runs remain separately named for traceability.

### Structured-module contract within this repair boundary

| Contract                 | Status / evidence                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| H1 — entry/curriculum    | PASS for preservation: nine public entries; no registry/resolver edits.                                       |
| H2 — teaching sequence   | PASS for preservation: authored teaching and task order unchanged.                                            |
| H3 — shared stage        | NOT APPLICABLE to a migration; existing stage retained, no new layout framework.                              |
| H4 — current task/action | PASS: instruction target and focus, five real control/circuit families.                                       |
| H5 — rendered content    | PASS: inset, canonical circuit and supporting teaching remain rendered/reachable.                             |
| H6 — real activities     | PASS for preservation: actual output changes and existing CRRT operational journeys.                          |
| H7 — feedback modes      | PASS for preservation: explanation, wrong answer, retry and skip journeys; handlers unchanged.                |
| H8 — fidelity            | PASS for preservation: no engine, geometry, device-input or asset edits.                                      |
| H9 — honest progress     | PASS for preservation: actual self-paced/reload tests, no new store or completion rule.                       |
| H10 — clinical language  | NOT APPLICABLE: no clinical copy rewriting.                                                                   |
| H11 — scope/holds        | PASS: three requested issues; review and release states unchanged.                                            |
| H12 — browser proof      | PASS within this repair: 202 distinct production Chromium checks; known BBT unit failure reported separately. |

## Known debt and not run

- BBT `contracts.test.ts:198` still expects the public case manifest to be private. This is the
  same failure recorded by SYSTEMIC-UX-01 / PR #245; the access policy and test are unchanged.
- HD's eleven obsolete browser progression/gating journeys were not rerun or repaired. The
  nine-entry checks include HD, without changing its clinical or progression behavior.
- EBUS range `aria-valuetext` and recording provenance, PI visual/DOM order, BF duplicate header
  measurement and larynx geometry TODO remain outside this repair.
- Existing build warnings about large training bundles, Mermaid/Langium import analysis and
  tooling deprecations remain. No dependency/build-system repair was attempted.
- No full historical G02, restarted systemic discovery, EBUS consolidation, questions, media,
  sources, human-review records, or curriculum/content review.
- No live device/clinical validation, external beta review, screen-reader certification,
  non-Chromium engine matrix, every locale, authenticated cloud progress, uploads, Supabase
  mutations, deployed/CDN validation, merge or deployment.

**EBUS remains NOT clinically/content ready.** Every clinical/source/media/device and human
review hold remains unchanged. Delivery is one bounded PR into `main`; stop after opening it.
