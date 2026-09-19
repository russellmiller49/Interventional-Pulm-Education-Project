# SYSTEMIC-UX-01 — post-merge integration regression

**Disposition: one new CRRT layout regression demonstrated; report-only delivery.**
The integrated production build preserves the exercised scroll-owner fixes and most workbench
behavior, but the solute-transport mechanism workbench introduces a new control/circuit
separation at 1024×768. The clean-pass statement is therefore not issued. No repair, redesign,
test change, review-status change, merge or deployment was performed.

Verified on 2026-09-18 from fresh `origin/main` at
`bbfb964f69339ab3bd3d1ef6f3accf55d444626a`, containing SYSTEMIC-UX-01
[PR #243](https://github.com/russellmiller49/Interventional-Pulm-Education-Project/pull/243)
(merge `8344335929ea25070836fe20a8d5ddb8148fdbc2`) and the later Device Atlas PR #244.
Implementation branch: `codex/systemic-ux-01-postmerge-regression`.
The inventory, handoff and content-review reports were read before validation.

The primary evidence is real Chromium **151.0.7922.34** against a fresh full `npm run build`,
served with `next start` at `http://127.0.0.1:3168`. Viewports: 1600×900, 1440×900,
1024×768, 390×844, 320×740, and 1440×900 with 200% root text sizing. Embedded EBUS text
was enlarged separately to approximately 200%; this is text reflow, not a claim about every
browser zoom implementation. Existing suites also exercise their authored viewport variants.
Native keyboard and mouse-wheel input, bounding boxes, focus hit tests, screenshots and real
image/model changes were used. Local APIs/external requests were isolated where the harness
provides isolation; there was no authenticated account, cloud-progress write or seeded learner
record.

Evidence, including supplemental probe scripts, raw results, screenshots, logs and a SHA-256
manifest, is retained outside Git at:

`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/renders/output/systemic-ux-01-postmerge-20260918/`

## 1. PASS

### Integrated behavior

| Area                        | Exercised result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Global scroll ownership     | At 1600, 1440 and 1024, a native 350px wheel gesture moves the CRRT/MV/MCS document from `scrollY=0` to `350`. BBT and ECMO retain `scrollY=0` while their actual internal workspace scrolls. The document-flow opt-out is present only on the three flowing adapters. BBT wheel input for this assertion targets the workspace gutter; wheel over its CT image intentionally operates CT slices.                                                                                                                                                                                                                                                                                                                                                                                    |
| PI                          | Projection comparison, the virtual C-arm and obliquity remain co-visible on desktop/laptop. Native control changes alter visible output without a subsequent scroll. Additional field/signal checks at 1024, 390 and enlarged text change the rendered projection while retaining baseline image bytes. Existing PI-FOCUS-01, PI-OUTLINE-01, PI-WRAP-01 and PI-HELP-01 coverage is in the existing PI suite, including outline, Help, compact reflow, held images, skip/explain/retry/reload and self-paced storage. A separate native-input probe passes all six matrix variants after a wheel gesture: eight rapid reverse/forward Tab cycles, then eight forward and eight reverse Tabs with focus hit tests. This is targeted regression, not a reopened G02 gate.               |
| EBUS engineering            | Depth changes visible recorded output across all six matrix variants. Supplemental decoded-video pixel hashes change after actual gain, contrast and Doppler changes. Comparison pixels stay fixed until explicit replacement. Freeze disables playback; save stays disabled until calipers have two distinct positions, then produces the saved teaching image. Skipping acquisition truthfully disables the image-dependent response with an explanation; explanation and reload remain available. A real acquisition hold preserves identical held-image bytes across resizing and explanation; reload restores no held image. Resizing the live iframe through 1024/390/320/enlarged text leaves zero vertical excess and zero horizontal overflow, retaining comparison pixels. |
| Bronchoscopy Foundations    | Guided five-control bench, actual manipulation and visual co-visibility, demonstration versus own-attempt provenance, non-bench survey/inspection, skip/retry/explanation and enlarged-text keyboard access are exercised. All three existing larynx approach/crossing/return pixel journeys pass. The existing scope geometry TODO is not resolved by those passes.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| CRRT                        | Modalities, blood path, fluid path and pressure sites pair their controls/circuit at 1440 and 1024. The mechanisms workbench pairs at 1440; its 1024 exception is detailed below. All five respond to real controls at 390 with document reflow and the intended internal schematic scroller. Task navigation reveals the replacement instruction; ordinary control changes preserve document offset. Fixed anticoagulation is natively disabled, fixed to `none`, and has its accessible explanation. Existing introductory, operational-action and all-18-case self-paced journeys preserve explanation, retry, navigation and ungraded storage.                                                                                                                                   |
| MV / MCS                    | Native document scroll passes all six matrix variants. MV rate changes alter the delivered-rate readout without a second scroll; explicit breath advance, task selection, explanation and restart work. Reload restores MV's saved reading step with a fresh baseline patient, not an answer/run. MCS task transitions, explanation, provided P6/P8 comparisons, replay/reset, placement controls, restart and reload retain their original topic/run boundaries.                                                                                                                                                                                                                                                                                                                    |
| ECMO / BBT / HD references  | Existing BBT workspace journeys and ECMO layout/focus regressions exercise their retained scroll owners. Six HD reference checks cover every section at five viewports and all eight Practice briefs. Legacy HD progression assumptions remain excluded and classified below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| All nine public entries     | All nine routes render anonymously with HTTP 200, an entry heading and Learn/Start/Continue navigation. The supplemental six-variant entry matrix covers 54 route/viewport combinations, with zero document horizontal overflow and no page exceptions; actual entry-link navigation is exercised at 1440.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Scope / Device Intelligence | PR #243 has no Device Intelligence, model/engine or runtime-asset changes in the inspected paths. Device Intelligence contains neither marker targeted by the shared scroll selector. The later PR #244 remains part of the integrated baseline; this report changes no Device Intelligence file or feature flag. This is source/selector isolation evidence, not a full Device Atlas functional certification.                                                                                                                                                                                                                                                                                                                                                                      |

Public entry routes exercised:

```text
/en/bronchoscopy-foundations
/en/peripheral-imaging
/en/learn/anatomy/branch-tracing
/en/ebus-guided
/en/cardiohelp-ecmo
/en/baxter-crrt
/en/icu-hemodynamics
/en/mechanical-ventilation
/en/mechanical-circulatory-support
```

The matrix's representative control/output spans reproduce the original handoff closely.
Values are rounded CSS pixels; desktop/laptop assertions also check the uncovered viewport
band. Compact/enlarged-text values establish adjacency and reachable reflow, not that every
panel fits on one screen. PI includes the C-arm on ordinary desktop/laptop widths.

| Pair                          | 1600 | 1440 | 1024 | 390 | 320 | 200% text |
| ----------------------------- | ---: | ---: | ---: | --: | --: | --------: |
| PI projection / obliquity     |  292 |  292 |  249 | 581 | 600 |       534 |
| EBUS recording / depth        |  281 |  250 |  266 | 436 | 382 |       519 |
| BF bench / Advance            |  421 |  421 |  358 | 486 | 451 |       500 |
| CRRT modality circuit / CVVHD |  516 |  516 |  588 | 588 | 640 |       696 |
| MV live readings / rate       |  162 |  162 |  174 | 441 | 562 |       534 |

### Validation results

| Check                                          | Result / evidence                                                                                                                                                                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Full production build                          | PASS, including both embedded training apps, content generation, asset validation, Next production compilation and standalone preparation; `production-build.log`.                                                                                                             |
| Root TypeScript                                | PASS, `NODE_OPTIONS=--max-old-space-size=8192 npm run type-check`; `root-typecheck.log`.                                                                                                                                                                                       |
| Relevant root Jest                             | 319 suites pass, one suite fails on the known BBT access assertion. 5,745 tests pass, one fails, one existing BF TODO; `jest-results.json`, `jest.log`.                                                                                                                        |
| Embedded EBUS TypeScript / Vitest              | PASS; 35 files / 254 tests pass; `ebus-typecheck.log`, `ebus-vitest.log`.                                                                                                                                                                                                      |
| Systemic production Chromium matrix            | PASS, 39/39; `systemic-results.json`, `systemic.log`. This file samples the CRRT modality workbench; it does not test the mechanism/inset wrapping relationship.                                                                                                               |
| Existing PI/BF/CRRT/BBT/ECMO/MCS Chromium      | PASS, 122/122: PI 31, BF 21, CRRT 9, BBT 23, ECMO 30 and MCS 8; `existing-results.json`, `existing.log`.                                                                                                                                                                       |
| Targeted HD reference Chromium                 | PASS, 6/6; `hd-reference-results.json`. The eleven known obsolete progression journeys were not rerun.                                                                                                                                                                         |
| Supplemental all-five CRRT matrix              | 14/15 pass at 1440/1024/390; the mechanism workbench at 1024 fails full circuit/control co-visibility. `supplemental/results-crrt.json`, `crrt-verified.log`.                                                                                                                  |
| Supplemental entries / scroll / other controls | PASS for the six entry variants, 15 native scroll-owner checks, six PI field/signal checks, six PI rapid native-focus checks, EBUS recorded pixels/resize and an actual held-image journey, and MV/MCS restart/reload. Raw evidence distinguishes assertions from screenshots. |
| Merged-path ESLint / Prettier                  | Root changed-path ESLint passes without warnings. Prettier passes over all 22 PR #243 paths, including normally ignored embedded files. Forced embedded lint has zero errors and six independently reproduced baseline warnings.                                               |
| Report-only quality                            | PASS, report Prettier and `git diff --check`; final staged path is this report only.                                                                                                                                                                                           |

Screenshots were visually inspected in the six module contact sheets and the CRRT reproduction
captures, alongside measured geometry. Temporary supplemental probes initially had harness
errors: an unwaited client navigation, an MV selector it does not render, BBT wheel input on
the slice-viewer surface, a CRRT exact label invalidated by its checkmark, EBUS End input while
already at maximum gain, an incorrect assumption that MV reload resets its saved reading
step, and an EBUS hold attempted before selecting the instructed 3/4 cm views. The corrected
probes preserve real behavior and keep their original diagnostic output; no committed test or
application code was edited to obtain a pass.

## 2. NEW REGRESSION FROM SYSTEMIC-UX-01

### P2 — CRRT mechanism inset separates active controls from the canonical circuit at laptop width

**Route:** `/en/baxter-crrt/learn?lesson=crrt-solute-transport`.
**Task:** first guided exercise, “At the membrane: solute and water.”
**Viewport:** 1024×768, ordinary text, real production Chromium.

Reproduction:

1. Open the route in a clean browser context at 1024×768.
2. Focus Convection, then use the normal document wheel to place the controls immediately below
   the 81px site header.
3. Observe that the full-width Filter inset sits between the three mechanism buttons and the
   canonical circuit. The circuit extends below the viewport while the buttons are visible.
4. Activate Convection with Space. The inset and circuit really change; the circuit overlay is
   `cvvh-post`, but seeing the entire circuit requires scrolling away from the active controls.
5. Reload and repeat. The same separation recurs; no answers or stored completion are required.

The usable band is 81–768px (687px). After an ordinary orientation scroll, the initial control
is at y93.58–137.58 and the canonical SVG at y598.17–1068.17: a **974.59px union**. Selecting
Convection shortens the inset's prose slightly, but the union remains **952.91px**. There is no
document horizontal overflow or unexpected scroll on manipulation; this is a vertical
control/result regression. The inset itself remains visible and useful. Navigation, native
document scrolling and model behavior remain available, so validation was not stopped early.

A separate production comparison used the actual pre-change parent
`00e66fa88cb2cb8a8909fcd7f98159c38dd03459`, served at port 3169 from a detached temporary
checkout. The primary audit remained on integrated main. No baseline or merged application
file was patched to produce the comparison.

| Version at 1024×768                  | Rendered order after the controls    | Control-to-circuit union |
| ------------------------------------ | ------------------------------------ | -----------------------: |
| Pre-change parent                    | Canonical circuit, then Filter inset |                 654.39px |
| Integrated main, initial state       | Filter inset, then canonical circuit |                 974.59px |
| Integrated main, Convection selected | Filter inset, then canonical circuit |                 952.91px |
| Integrated main after reload         | Same order and measurements          |               Reproduced |

The parent retains the separately documented old document lock/sticky heading; this comparison
does **not** claim its entire CRRT layout was correct. It isolates the newly interposed inset
and the approximately 320px increase in intrinsic control/circuit separation, despite the
canonical SVG becoming smaller. The source diff confirms ownership: PR #243 moved
`FilterInset` from after `Circuit` into `CircuitWorkbench.controls`.

**Owner:** `src/features/baxter-crrt/components/CrrtFoundationTools.tsx:355–376` and
`src/features/baxter-crrt/components/crrt-foundations.module.css:117–135`.
The wrapping flex layout uses a 13rem control basis and an 800px circuit basis. At this width,
the controls plus inset form the first row and the circuit wraps below them.

**Smallest repair direction, not implemented:** adjust only the mechanisms workbench's wrapped
composition so the mechanism controls remain adjacent to the canonical circuit and the inset
follows that pair at the wrapping breakpoint, while preserving the useful wider-screen
arrangement. Retain the global document-flow fix, all teaching, circuit state, input provenance
and progression. Add a focused 1024 mechanism-specific browser assertion in the repair task;
the existing modality-only systemic assertion cannot detect this relationship.

**Evidence:** `crrt-causality.json`, `crrt-causality.cjs`,
`supplemental/crrt-mechanisms-1024-failure.png`, `crrt-baseline-1024-after.png`,
`crrt-merged-1024-after.png`, `crrt-merged-1024-circuit.png`, and the matching reload captures.

## 3. PRE-EXISTING / UNRELATED DEBT

- **BBT public-path contract:** `contracts.test.ts:198` still expects
  `/airway-anatomy/case-001/case_manifest.json` to be private while `isPublicPath` returns true.
  This is the sole Jest failure. The relevant access code, test and locale dependencies are
  unchanged from the documented parent. No access policy or test was repaired.
- **BF larynx geometry:** the existing continuous larynx/trachea join TODO remains. Passing
  approach/crossing/return pixels establishes regression preservation, not geometry closure.
- **HD legacy browser progression:** the eleven obsolete progression/gating journeys remain
  known debt from the handoff. HD and that spec are byte-identical to the parent. This run
  exercises six relevant reference checks and does not rerun or rewrite the eleven obsolete
  journeys. Their historical failures are not counted as new failures or current passes.
- **Embedded lint:** the forced EBUS check reports three effect-state warnings and three
  Next image-rule warnings, zero errors. The parent independently produces the same six
  warnings. No embedded lint suppression was added.
- **Build/tooling warnings:** existing large embedded bundles and Mermaid/Langium dependency
  analysis warnings recur, along with Node/toolchain deprecation/cache warnings. Build and
  type-check complete successfully; no dependency or build configuration changed.

## 4. HUMAN / CLINICAL REVIEW HOLDS

**EBUS remains NOT clinically/content ready.** No clinical or content judgment was made about
its images, questions or teaching sequence. Recorded-pixel and interaction checks establish
engineering behavior only.

All existing human, clinical, content, source, media and device-review holds remain unchanged.
This includes MCS AF/model holds, CRRT protocol/device/source restrictions, BF anatomy/media
review, and the separate faculty candidates in `SYSTEMIC-UX-01-content-review.md`. Passing an
interaction check does not approve a model, device setting, clinical claim or source. Historical
PI G02 and ECMO technical closure are neither reopened nor replaced by this report.

## 5. NOT RUN

- A new PI G02 or ECMO G02 gate, broad defect mining, module redesign or automated repair.
- The eleven obsolete HD progression journeys; see the debt classification above.
- Clinical/faculty/content/source/media/device review, real-device validation, patient care or
  changes to review/release status.
- Authenticated progress synchronization, cloud writes, uploads, local Supabase lifecycle
  commands, production/CDN delivery, deployment or a separate standalone-server deployment test.
- Full Device Atlas functional testing. Its production feature gate was not changed; the
  scoped shared-selector and unchanged-path checks are the evidence for isolation here.
- Every activity/control at every size, all locales, screen readers or browser engines beyond
  Chromium. Compact stacking is not represented as full simultaneous visibility of every panel.

### Reproduction commands

Run from the integrated checkout; start the local production server separately. These commands
do not deploy or change stored learner state outside their isolated browser contexts.

```sh
npm run build
NEXT_PUBLIC_SUPABASE_URL=https://preview.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=preview-only node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3168
NODE_OPTIONS=--max-old-space-size=8192 npm run type-check
npm --prefix EBUS-course/apps/web run typecheck
npm --prefix EBUS-course/apps/web test
NODE_OPTIONS=--max-old-space-size=8192 npx jest --runInBand src/features/peripheral-imaging/__tests__ src/features/bronchoscopy-foundations/__tests__ src/features/ebus-guided/__tests__ src/features/baxter-crrt/__tests__ src/features/learning-module src/features/mechanical-ventilation/__tests__ src/features/mechanical-circulatory-support/__tests__ src/features/cardiohelp-ecmo/__tests__ src/features/icu-hemodynamics/__tests__ src/features/bronchial-branch-tracing/__tests__
SYSTEMIC_UX_BASE_URL=http://127.0.0.1:3168 PERIPHERAL_IMAGING_BASE_URL=http://127.0.0.1:3168 BRONCH_FOUNDATIONS_BASE_URL=http://127.0.0.1:3168 npx playwright test --config playwright.systemic-ux.config.ts e2e/systemic-ux.spec.ts e2e/peripheral-imaging.spec.ts e2e/bronchoscopy-foundations.spec.ts e2e/baxter-crrt-foundations.spec.ts e2e/baxter-crrt-self-paced.spec.ts e2e/branch-tracing.spec.ts e2e/ecmo-layout.spec.ts e2e/ecmo-focus.spec.ts e2e/mcs-unloading.spec.ts
SYSTEMIC_UX_BASE_URL=http://127.0.0.1:3168 npx playwright test --config playwright.systemic-ux.config.ts e2e/icu-hemodynamics-flow.spec.ts --grep 'every section opens|all eight existing Practice'
npx prettier --check docs/gap-remediation/systemic-ux/SYSTEMIC-UX-01-postmerge-regression.md
git diff --check
```
