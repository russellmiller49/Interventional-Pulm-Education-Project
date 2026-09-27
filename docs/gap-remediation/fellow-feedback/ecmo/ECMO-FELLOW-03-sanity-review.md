# ECMO-FELLOW-03 — independent adversarial sanity review

Review date: 2026-09-24–25. PR: [#277](https://github.com/russellmiller49/Interventional-Pulm-Education-Project/pull/277).

This report supersedes the implementation handoff's readiness, geometry, label-placement and disposition claims. It distinguishes a bounded software merge from clinical approval or release. No PR merge, deployment, database change, or Prompt-04 work was performed.

## Merge tree and evidence provenance

- Submitted head independently verified: `0a7b3699c8fdd47b8034ee80e293d054674e5daf`.
- First fetched main: `c908fe475806a8be3edcc736b60b136666830270`, beyond handoff `553bd0a1`. The intervening MV/MCS/CRRT documentation, bronchoscopy-foundations and EBUS paths did not change ECMO or its shared layout/runtime. True merge: `72ff7ba0533f26a82d09fc329943ee38782bb2bb`.
- Main advanced during review to `d26446f23b3ed98d7ecd978349eb25c0a33f0689` (#283). Inspected all 17 intervening paths. Shared `next.config.mjs`, module-beta and site-auth changes retire therapeutic bronchoscopy from beta and enforce server feedback in production; the migration expands feedback catalog acceptance. No ECMO physiology, lesson layout, or public ECMO route changed. The migration was not run. True merge: `c8832c25cb09b884b513ad0b20bdd1e2dcf44bb0`.
- Engineering repair commits: `62b8ca21` (19 reviewed paths) and `8ff74d3c` (console screen-change focus, local phone gate containment, and browser regression corrections). Final executable validation is against `8ff74d3cd19475deb99efb4b83e72f6fad7305b3`; the following handoff commit changes documentation only.
- Independently read the PR diff, repository instructions, Prompt-03 plan and handoff, feedback ledger, source/code notes, coordination and owner-decision files, Prompt-01/02 handoffs, original fellow walkthrough and cited local IFU. Prior screenshots were leads, not acceptance evidence.
- Raw inputs remain outside Git. Review scripts, JSON, screenshots and logs are in local authoring storage: `renders/output/ecmo-fellow-03-sanity-2026-09-24` under `Interventional-Pulm-Local-Data`. No environment file was created.

## Defects found and repaired

1. **Run/Repeat/Reset moved focus away from its action.** At enlarged phone text, scrolling the entire result table could leave Repeat above the viewport. Keep one mounted Run/Repeat button ahead of the result, return Reset focus to it, and reveal only that control when necessary. Saved results remain deterministic. Completion has a status announcement.
2. **Emergency status could cover the entire usable phone viewport.** An oversized urgent strip now returns to normal document flow. The later two-clamp alarm also forced a 383 px document at 320 px; its grid child and wrapping alarm/badge now stay within their container. ECMO respects reduced-motion scrolling, including long pages.
3. **Phone controls existed but became extremely tall, narrow word columns.** A further console container breakpoint keeps physical controls and screen tabs readable at their actual smallest containing width. Safety, zero flow, dial, plus/minus, lock, mode, audio and toolbar are retained. Power remains the existing disabled educational facsimile, not a newly implemented power function.
4. **Header breakpoint changes remounted focused controls.** One stable disclosure now owns the track/restart controls across widths; it stays open around a focused child, and widening a focused summary moves focus into the retained controls.
5. **S8 put measurements far below its prediction options.** The same read-only circuit readings component now appears inside the prediction fieldset, before the options. It consumes the same state; it creates no second patient, circuit or clock.
6. **Show all disappeared when activated.** Keep the control mounted with an explained `aria-disabled` no-op when already showing everything. Filtering also remeasures after root-font changes.
7. **FitWidthSurface missed a one/two-pixel child-width change.** Observe the actual content/children and measure when children change, even if the fixed wrapper does not resize. Remove the obsolete fixed-820-px console explanation.
8. **3D labels clipped and collided after camera movement.** Move HUD/buttons into document flow. Keep whole optional pills and their leaders within the canvas, reject label/leader intersections, and suppress a label when no truthful placement fits. All structures remain in the named keyboard finder. Selecting one restores the overview camera and isolates its label; clearing restores teaching emphasis. Step/support changes clear a stale manual selection.
9. **pAux copy overgeneralized the IFU's “only.”** Narrow it to alarms for measured pAux values outside warning/alarm limits. Do not assert that every possible pAux alarm is MECC-only.
10. **Launch-gate containment clipped its Continue action.** The submitted local horizontal wrapper could hide part of the 320 px/root-32 button. Narrow ECMO-only wrapper styles reduce inherited padding and stack the facts, preserving whole words and the full action. No shared component changed.
11. **VA caveat was too remote from the graphic.** Add an adjacent pre-graphic statement that positions are hand placed, no mixing location or coronary oxygenation/perfusion is computed, and clinical review is pending. This does not approve the illustration.

## Console, measurements and scrolling

The production matrix includes 1280×961, 1280×800, 1440×900, 1920×1080, 1024×768, 390×844, 320×740, 1280×961/root 32 px, and 320×740/root 32 px. It measures actual console/fit containers, document and pane widths, controls, focus, and bottom reachability for S2, S3, S4, S7, S8, VV and VA capstones, VA6, VA11, C5 Practice, and VV/VA air Practice. **108/108 route/viewport combinations pass**: no document horizontal overflow, no reported console clipping, forward/reverse focus visible, and bottom controls reachable. Actual S7 console/fit widths (client width equals scroll width) were 751, 751, 852, 852, 938, 346, 276, 728 and 236 px respectively. The flowing shell had no horizontal overflow; separate task/teaching scroll panes are absent in this layout, rather than falsely recorded as zero-width panes. `matrix-final.json` retains exact boxes and scroll offsets.

The S4 console is explicitly observation-only; real actions are its guided pump/sweep/oxygen-fraction comparisons. All three were activated by keyboard and produced retained comparisons. S7 is the live console control check: plus/minus, dial arrows, RPM/LPM, keyboard lock/hold-to-unlock, Safety+Z/G, audio and all six screen tabs were exercised. Disabled zero-flow/override controls become available through Safety, rather than being hidden. The existing Power-on button is visible and disabled by design. No new power behavior is claimed. Changing a console screen also retains its active tab after the differently sized screen reflows, using the existing reveal-if-needed helper.

FitWidthSurface was separately challenged using a small harness of the real production component: first render, actual/fit modes, container/window changes, root 16→32 px, exact fit, +1/+2 px overflow, and 30 settled frames. The threshold test initially failed and passes after repair. Actual mode has a named keyboard scroll region only when overflow exists. Fit mode remeasures without oscillation or phantom scroll. This is component/harness evidence, not a learner journey.

S2 pArt and patient MAP share a measurement pair while retaining distinct circuit/post-oxygenator versus independent patient/site labels. Neither is represented as the other's sensor. S3 retains action identity and stable Run/Repeat/Reset geometry: across all nine matrix sizes, Run changed neither its Y position nor document/shell scroll offsets (0 px delta), and the result begins 24 px below the action area (48 px at root-32). Repeated execution produces identical saved values. S8 has its question, current readings, answer choices and reveal path in one task fieldset. At normal phone text the readings occupy 327–343 px; at 320/root-32 they occupy 1,058 px. Enlarged text requires sequential reading, not simultaneous visibility of every observation/option. Likewise the S2 pair is 335 px tall at 320/root-16 and 1,675 px at root-32; no claim of 200%-text simultaneous co-visibility is made. C5/VAC5 Manage opens the independent monitor first, using the same simulation as the other surfaces.

The normal wide flowing lesson uses the ECMO shell as its scroll owner; phone layouts use the document. The fixed fallback retains task/teaching pane ownership. Step changes reset the relevant reading position; target reveal only moves the current owner as necessary. Wide-document `scrollY`, task and teaching offsets are recorded alongside geometry. Native forward/reverse focus, step, answer/reveal, Run/Repeat/Reset and disclosures are checked rather than inferred from screenshots.

[Stale PR #134](https://github.com/russellmiller49/Interventional-Pulm-Education-Project/pull/134) was read as coordination evidence only. Its useful intent—step/teaching reset and target-focused scrolling—is preserved. Its assumption that old shared layout should replace host scroll handling no longer matches the current flowing shell/fixed fallback. Rebuild or close #134 separately; do not cherry-pick it or delete the current helper to make it apply.

## Matrix/card semantics and focus

All hypotheses are shown initially, without a prediction gate. Filtering preserves every signal, unit, case value, predicted value and explanation/limitation for the selected hypotheses. Arbitrary order, last-visible no-op and Show all were exercised with keyboard; restore controls remain outside the hidden table cells. Actual Chromium accessibility snapshots retain table, row, header and cell relationships in VV and VA at phone/enlarged text. Reason details remain explicit disclosures, not inaccessible hidden content.

Correction to the original handoff: the narrow capstone representation is **one card per signal row**, with labeled hypothesis values and explanations. It is not one card per hypothesis. Layout depends on measured available width, not a guarantee that all 1280 px viewports show a table. The last hypothesis is focusable with `aria-disabled=true`; activation is a coherent no-op that leaves it selected. Show all similarly remains mounted. The single polite filter count announcement does not announce each cell separately.

Header controls have one accessible copy. Native disclosure Escape does not close details; the Help dialog does close on Escape and returns focus. Track, context, Sections, restart and Save & exit remain reachable. The bounded repair preserves focus crossing 600 px in both directions rather than using a visually correct remount.

All three phone header configurations passed track switching, restart, Help/Escape focus return, Sections/Escape and Save & exit to the ECMO hub; breakpoint focus passed both directions. In both actual outer themes, Continue contrast was **10.95:1 normal, 13.03:1 hover, 10.95:1 keyboard focus, 8.21:1 pointer-active and 8.21:1 Space-active**. The cyan 3 px/3 px-offset focus ring is 9.04:1 against the adjacent card. Disabled primary opacity 0.48 yields approximately 3.62:1 after compositing and is not treated as an enabled-text pass. See `header-contrast-gate-final.json`. Continue is measured in normal, hover, keyboard-focus, actual pointer-active and actual Space-active states. The ECMO shell remains dark in both outer-site themes. Disabled opacity is reported separately from enabled-text acceptance.

## Enlarged text and launch gate

The missing 26 emergency states are identified explicitly: eight each in VV/VA bubble-stop (interpret, return clamp, drainage clamp, clear source, resume, reassess, explain, transfer), and five each in VV/VA power-loss (interpret, restore AC, reassess, explain, transfer). They are reached through event advancement, the offered optional-question skip, real clamps/de-air/resume or AC-restoration controls, and normal Next/reassess actions. No React state was injected.

**26/26 states pass at 320×740/root 32 px**: document width 320 px, readable 185 px-wide screen tabs, normal forward/reverse focus and bottom reachability. Final tab activation is also covered by the production regression. `emergency-final.json` lists each reached stage and its geometry. This closes that specific gap; it does not relabel the implementer's earlier 214-step sweep as an independently repeated 240-step test. Independent coverage additionally includes the requested 12-route matrix and all-section layout tests.

Root-font enlargement: tested. CSS zoom: not tested. Native browser zoom: attempted with the available Chromium keyboard shortcut, but viewport, DPR and visualViewport stayed unchanged; therefore **not tested reliably**. DPR/high-DPI: not tested (contexts use DPR 1).

The shared 320 px/root-32 launch gate is tested against a detached production build of current main. Words must remain whole, the internal overflow must reach the Continue control, and the ECMO document must stay 320 px. The earlier handoff describes under-100-px **text width** after nested padding, not a measured under-100-px height. This review did not reproduce that height claim. It did reproduce a 576 px baseline document and a clipped button after the submitted containment, then repaired that local wrapper; the shared launch-gate component is unchanged. Baseline main expands the document to 576 px. The reviewed gate keeps it at 320 px; its internal panel is 224 px wide (226 px scroll extent), and its 172 px action is wholly inside it with visible keyboard focus. The Continue action launches the bedside view. The 2,035 px gate height is reachable by ordinary vertical scrolling; whole words are preserved.

## 2D and 3D truth

The VV legend explicitly says oxygenated red does not mean arterial cannulation; vessel/cannula anatomy establishes the location. Map fine print remains partial: independently measured smallest label about 7.02 px beside the task at 1280, 11.01 px at full width, and 12.47 px at 1920 full width. Phone overview labels can be only 3.37 px at 390 and 2.49 px at 320/root-32. These are not readable fine-detail views. Required task information is also in adjacent prose, named readouts and labeled circuit-answer controls; it cannot depend on this tiny print. The wide full-width toggle is keyboard accessible. A generally readable/zoomable phone map remains a Prompt-03 design remainder.

VA right-arm placement is verified through the transform chain: the schematic declares anterior view, patient right is screen left, circle `cx=72` is left of the patient's x≈164 midline, and measured SVG screen matrices have positive equal `a/d`, zero `b/c` and no reflection. The conceptual aorta likewise places its right-radial circle at x=88 with a positive unreflected transform. The 3D scene does not carry this right-radial marker, so an orbit claim about that 2D marker would be false.

The femoral-side discrepancy predates this PR: 2D drainage is on patient right, while unchanged 3D layout uses `GROIN_VEIN_LEFT`; patient placement uses a positive scale and no mirroring rotation. Both are available as tabs in the same S2 learning path. The new explicit anterior/right legend makes the conflict easier to notice, increasing confusion risk. **ECMO-OWNER-12 must reconcile it. Neither side was chosen or silently corrected.**

The final 15 scene states have **zero measured pill overlaps, leader/pill or leader/leader crossings, and off-canvas visible labels**. Dense views suppress up to three optional labels; each of four finder selections isolates its correct visible label, retains keyboard focus and clears on second activation. Hide labels removes all overlays; changing the circuit-walk emphasis or support mode leaves no stale manual selection. No uncaught page errors. Evidence: `three-verified.json`, `finder-verified.json`, screenshots. Real renderer evidence is recorded separately from fallback: Chromium WebGL2 reports ANGLE Metal / Apple M5 Max. Camera orbit left/right/up/down, zoom in/out, 1280→1024→390→1280, root-32 text, label toggle and four finder structures are tested. On narrow viewports the existing textual equivalents replace decorative labels/finder; this is reported as the narrow presentation, not a successful overlaid-label test. Finder group, pressed state, focus, clear and restored native emphasis are checked. Label/leader geometry is measured, not just screenshot appearance.

With WebGL deliberately disabled, the fallback explicitly states that fact, provides the diagnostic map and retained accessible clamps, and keyboard clamp activation interrupts modeled flow. No fallback screenshot counts as a WebGL pass.

## Source and clinical boundaries

**pAux:** independently inspected the local CARDIOHELP System IFU, Revision 2.3 (January 2025), CARDIOHELP-i software 03.04.10.00 or higher. Page 45 describes the additional external pressure input; page 110 shows the external sensor connection; page 91 restricts alarms for measured pAux values outside warning/alarm limits to MECC. The repaired wording follows that narrower statement, cites those pages, and explicitly says this simulation does not model a pAux sensor. This is source verification, not manufacturer endorsement or closure of any owner decision.

**VV diagram:** its seven nodes/order come from the existing `VvSeriesPhysiologyPanel` stages; the dashed recirculation return-to-drainage path adapts the existing lesson explanation. Circuit/patient colors distinguish roles; they do not encode saturation or pressure magnitude. Arrows convey authored order, not measured flow. It takes no simulation props, displays no numerical physiology/sensors, and says schematic/not to scale. The layout omits the native venous bypass fraction and simplifies a loop; those teaching adaptations still need human review. S6-1 is partial.

**VA diagram:** native antegrade ejection, retrograde femoral return, arch branches, coronary origins and right-radial sampling adapt the existing VA section's text. Exact SVG paths, branch stream assignments and both mixing-band positions are hand-drawn teaching choices, not source-derived patient predictions. The component has no simulation input: local radio state selects two fixed illustrations, never a ratio, SpO₂, hypothesis or modeled mixing variable. Switching illustrations leaves simulation state unchanged. The new pre-graphic caveat is adjacent and readable; the longer caption also limits interpretation. Nevertheless, the fixed coronary paths and branch colors can convey a stronger anatomical/territorial claim than the model supports. **ECMO-OWNER-12/human review is required; VA6-1 and VA7-3 are partial, VA11-1 remains partial.** No coronary oxygenation, perfusion, exact mixing point or stream proportion was approved.

All owner decisions remain unclosed. Clinical/device readiness is separate from this engineering review. A bounded merge does not authorize clinical release.

## Audited source-ID dispositions

R = repaired in the bounded software scope; P = partial, with remainder. **17 R / 7 P**, replacing 20 R / 4 P.

| ID     | Disposition | Independent conclusion / remainder                                                                               |
| ------ | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| S1-2   | R           | Explicit readable Continue ink and real interaction-state contrast; focus ring retained.                         |
| S2-2   | P           | VV anatomy/color legend improved; tiny compact/phone labels and readable-map design remain.                      |
| S2-3   | R           | Real-camera label/leader containment and keyboard isolation repaired; anatomical side approval remains separate. |
| S2-4   | R           | Circuit pArt and independent MAP share a labeled pair from one state.                                            |
| S2-5   | R           | Compact model/held-clock reference; detailed boundary retained in disclosure.                                    |
| S2-8   | P           | Pressure pressed states and task labels fixed; ΔP/Δp-trend teaching vocabulary is Prompt 04.                     |
| S3-1   | R           | Stable Run/Repeat/Reset node and nearby retained results; no result-sized focus jump.                            |
| S4-1   | R           | Actual-container console reflow, including smallest enlarged-text layout; controls retained.                     |
| S5-2   | R           | Narrow labeled cards preserve table relationships, rows and units.                                               |
| S5-5   | R           | Sentence disclosure, percent units and joined-word correction retained.                                          |
| S6-1   | P           | VV conceptual loop exists, but its simplifying teaching adaptation awaits human review.                          |
| S7-1   | R           | Signal register reflows; source-verified, narrowed pAux copy distinguishes unmodeled input.                      |
| S7-2   | P           | Reachable dial/plus/minus; requested ramp behavior and pre-response teaching remain owner/01/02/04 work.         |
| S8-2   | R           | Question/readings/options/reveal colocated; readings consume the same state.                                     |
| S17-1  | R           | All four VV hypotheses initially available; real AX relationships and restore controls retained.                 |
| S17-2  | R           | Discriminators visible; reasoning available without deleting rows or requiring an answer.                        |
| VA5-2  | R           | Percent/percentage-point units, sentence disclosure and joined-word correction retained.                         |
| VA6-1  | P           | Explicitly manual aortic illustration; clinical stream/coronary semantics await OWNER-12.                        |
| VA7-2  | R           | Actual unreflected anterior transform places the right-radial marker on patient right.                           |
| VA7-3  | P           | Diagram appears at its introduction, but reuse does not confer clinical approval.                                |
| VA11-1 | P           | Two manual comparisons; no modeled mixing marker/binding. OWNER-12 held.                                         |
| VA17-1 | R           | All five VA hypotheses initially available and restorable with semantic cards.                                   |
| C1-5   | R           | Pre-support sweep/request wording and explicit action/debrief labels retained.                                   |
| C5-2   | R           | C5/VAC5 monitor first; disclosure toggles preserve time, values and interventions.                               |

## State preservation and test quality

Prompt-01: VV/VA premature Resume refusal, normal isolation/de-air/resume, reducer bypass refusal, idempotence, restart clearing, safety explanation and requested setpoint versus stopped pump remain covered. The unstubbed legacy browser script reports 29/31: its two failures are console-resource checks, not failed recovery behavior. The same failed analytics and prefetched protected routes occur on detached main with the same missing project URL/key server error and no uncaught page exceptions. Stubbed focused journeys test the local module independently of those unavailable services.

Prompt-02: t=0 presentation values, no hidden loading second, same-second circuit-only recomputation, held reveal, untreated C5/VAC5/VAC2 persistence, C3 protective-stop chronology, treatment followed by later fault, immutable action observations and the untreated-from-presentation comparator remain covered. Surface toggles were exercised on C5, VAC5 and hemorrhage with identical before/after time, patient/circuit values and action records; explicit restart is still the reset action.

Inspected all 28 Prompt-03 tests and existing-test changes. Their strongest assertions cover control semantics, retained data/units, comparison behavior, accessible restore and label geometry. Source/class assertions alone are not accepted as visual proof. Four representative learner-contract probes fail on detached main and pass here (console hints outside physical controls, paired pressure sites, hypothesis filtering, right-arm placement); the preservation probe passes both. This review does **not** claim to have independently reproduced every one of the implementer's 27/28 baseline failures. New focused assertions cover persistent action identity/focus, local S8 readings, same-key +1/+2 px remeasurement, label/leader collisions and breakpoint focus. Browser regressions cover the failures unit tests missed.

Final executable tree: `8ff74d3cd19475deb99efb4b83e72f6fad7305b3`. Current main was fetched again after production checks began and remained `d26446f23b3ed98d7ecd978349eb25c0a33f0689`.

| Check                                                    | Final result / evidence                                                                                                                                                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full production build                                    | PASS, `build-complete.log`; no environment file.                                                                                                                                                                                |
| Full ECMO Jest                                           | **78 suites / 2,499 tests pass**, `jest-complete.json`.                                                                                                                                                                         |
| Prompt-01 focused contract                               | **43 pass**, included above.                                                                                                                                                                                                    |
| Prompt-02 engine + surfaces                              | **70 + 33 pass**, included above.                                                                                                                                                                                               |
| Prompt-03 contract                                       | **28 pass**, included above.                                                                                                                                                                                                    |
| Current-main shared integration                          | **3 suites / 61 tests pass**, `main-integration.log`.                                                                                                                                                                           |
| TypeScript                                               | PASS with 8-GB heap, `tsc-complete.log`.                                                                                                                                                                                        |
| Changed-path ESLint / Prettier / diff check              | PASS; zero lint warnings/errors, `lint-complete.log`, `prettier-complete.log`.                                                                                                                                                  |
| Production Chromium layout/focus                         | **35/35 pass**, 5.3 minutes, `e2e-complete.log`; includes five new regressions.                                                                                                                                                 |
| Required 12 journeys × nine sizes                        | **108/108 pass**, `matrix-final.json`.                                                                                                                                                                                          |
| Omitted emergency states, 320/root-32                    | **26/26 pass**, `emergency-final.json`.                                                                                                                                                                                         |
| Extra live controls, disclosures, AX, diagrams, fallback | **10/10 supplemental journeys pass**, `supplemental-final.json`.                                                                                                                                                                |
| Real WebGL / finder                                      | **15 scene states pass**; four keyboard selections, clear, toggle and scope reset pass.                                                                                                                                         |
| Prompt-02 production journeys                            | **29/29 pass**, `browser-complete/results.json`.                                                                                                                                                                                |
| Unstubbed Prompt-01 browser                              | **29/31**; only the two resource-error checks fail. The same missing-credentials resources fail on detached current main; recovery/keyboard checks pass. `prompt01-complete.log`, `environment-compare.json`, both server logs. |
| FitWidthSurface                                          | Exact/+1/+2 px, resize, mode, root-font and stable-frame harness passes; `fit-harness-results.json`.                                                                                                                            |

Intermediate runs that exposed defects, a stopped build superseded by newer main, and cancelled browser runs are retained locally as investigation evidence. They are not substituted for the completed final checks above. No unresolved product failure is hidden by a test retry; the corrected header test uses the actual radio role, and asynchronous UI checks wait for the committed presentation.

## Decision

**Software/runtime merge readiness: READY** for the bounded Prompt-03 remediation, with the seven partial source findings explicitly retained.

**Clinical/device content readiness: BLOCKED ON OWNER DECISION.** The new teaching adaptations have not received human clinical/device approval; OWNER-12 includes the unresolved visual semantics/laterality decisions. Source verification of pAux does not close those holds.

**Release readiness: NOT ESTABLISHED.** Signed-in/backend-dependent deployment behavior, native zoom/high-DPI and the content approvals are outside what this local review demonstrates.

The bounded software merge can proceed without representing these partials as complete or authorizing release. PR #134 must be rebuilt or closed separately. No PR merge, deployment or Prompt-04 work was performed.

SANITY REVIEW: READY TO MERGE
