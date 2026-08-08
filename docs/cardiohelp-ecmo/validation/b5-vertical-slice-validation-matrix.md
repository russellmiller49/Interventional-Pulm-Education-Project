# B5 vertical-slice validation matrix

The plan the preflight was run against, written before any code was edited. Results are recorded in
[`b5-vertical-slice-validation-summary.md`](./b5-vertical-slice-validation-summary.md).

**This matrix describes automated, expert, and browser review. It is not human novice validation**
— that is [`b5-novice-findings-template.md`](./b5-novice-findings-template.md), and it is empty.

## Scope

Six pilot drills on the guided **Learn** route:

| #   | Scenario id                  | Mode | Panel                           |
| --- | ---------------------------- | ---- | ------------------------------- |
| 1   | `startup-sensor-orientation` | VV   | `StartupSensorOrientationPanel` |
| 2   | `preload-drainage-collapse`  | VV   | `PreloadDrainageCollapsePanel`  |
| 3   | `vv-recirculation`           | VV   | `VvRecirculationPanel`          |
| 4   | `gas-source-interruption`    | VV   | `GasSourceInterruptionPanel`    |
| 5   | `arterial-bubble-stop`       | VV   | `ArterialBubbleStopPanel`       |
| 6   | `va-differential-hypoxemia`  | VA   | `VaDifferentialHypoxemiaPanel`  |

Out of scope: the fourteen drills with no panel, the foundation lessons, Practice, Assess.

## Viewports

| Label | Viewport   | Frame width | Expected arrangement                          |
| ----- | ---------- | ----------- | --------------------------------------------- |
| V1    | 1600 × 900 | ~1576 px    | wide — three panes, both separators draggable |
| V2    | 1440 × 900 | ~1416 px    | laptop — simulator + one context pane         |
| V3    | 1280 × 720 | ~1256 px    | laptop — simulator + one context pane         |
| V4    | 1024 × 768 | ~1000 px    | compact — all three panes as tabs             |

Thresholds under test: compact below 1008 px of frame, wide from 1500 px.

## States exercised per scenario

Every state is exercised; a committed screenshot artifact is not required for each.

| Code | State                                      |
| ---- | ------------------------------------------ |
| S-a  | Initial / precommit                        |
| S-b  | Choice selected, not committed             |
| S-c  | Committed **best** choice                  |
| S-d  | Committed **plausible incorrect** choice   |
| S-e  | Committed **unsafe** choice                |
| S-f  | Action state (the guided control operated) |
| S-g  | Modeled response after the action          |
| S-h  | Reassessment                               |
| S-i  | Transfer state, where the lesson has one   |

## Interaction classes

| Code | Class                                                                                | How checked                                                                                                    |
| ---- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| I-1  | Clipping of task / teaching / simulator content                                      | Browser measurement: pane `scrollWidth` vs `clientWidth`, plus per-element overhang past the pane's right edge |
| I-2  | Panel overlaying the live console                                                    | Browser: element rects vs pane rect                                                                            |
| I-3  | Accidental fourth scrolling column                                                   | Browser: ancestor chain of the frame, `scrollHeight` vs `clientHeight`                                         |
| I-4  | Unusable nested-scroll trap                                                          | Browser: enumerate scrollable boxes inside the frame                                                           |
| I-5  | Meaningful pane labels and landmarks                                                 | jsdom: `role="region"` + `aria-label` per pane                                                                 |
| I-6  | Tab order                                                                            | jsdom: roving tabindex, one tab stop per tablist                                                               |
| I-7  | Keyboard access to choices, Commit, Continue, tabs, separators                       | jsdom: `fireEvent.keyDown`, `toHaveFocus`                                                                      |
| I-8  | Visible focus at each viewport                                                       | Stylesheet assertion (`:focus-visible` outline)                                                                |
| I-9  | Help reveals and focuses the correct live control                                    | jsdom: reveal-then-focus ordering; browser: compact tab switches to the simulator                              |
| I-10 | Reduced motion                                                                       | Stylesheet assertion + `prefers-reduced-motion` branch in the help scroll                                      |
| I-11 | Context-tab change preserves sim state, step, selection, commitment, verdict, scroll | jsdom: DOM identity probes + scroll restore with the browser's `display:none` reset emulated                   |
| I-12 | Compact help reveals the simulator before focus                                      | jsdom ordering assertion                                                                                       |
| I-13 | No remount on tab switch                                                             | jsdom + browser: stamped DOM identity survives                                                                 |
| I-14 | No duplicate control ids                                                             | Browser + jsdom: id uniqueness across the document                                                             |
| I-15 | No `undefined` / `NaN` / stale / false live-state text                               | Browser: full-text token scan per scenario                                                                     |
| I-16 | No precommit answer leakage                                                          | Expert review + widened automated corpus                                                                       |
| I-17 | No universal bedside target language                                                 | Existing resumption-copy contract                                                                              |
| I-18 | No regression of signal-provenance labels                                            | Data-driven two-way kind/site assertion                                                                        |

## Educational review questions

Applied to each of the six scenarios:

1. What is available before the prediction?
2. Does the panel teach how to inspect without giving the answer?
3. Is the prediction genuinely answerable incorrectly?
4. Does the verdict address the chosen reasoning?
5. Does the postcommit panel add mechanism and transfer, or merely repeat the verdict?
6. Does the live simulator response support the same causal claim?
7. Is the harmful reflex distinguished from a defensible-but-incomplete choice?
8. Is the model boundary adjacent to the output it bounds?
9. Can the learner reconnect device, circuit/gas, and patient domains?
10. Is any crucial explanation behind an unexpected scroll or an inactive tab?

Copy is changed **only** for a documented defect: contradiction, leakage, ambiguity, excessive
density, unsupported claim, inaccessible presentation, or mismatch with live state. Not because
another wording is possible.

## Method and its limits

Three independent methods, because none of them covers the matrix alone:

| Method                                                       | Covers                                                       | Cannot cover                                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Rendered browser at all four viewports                       | I-1 … I-4, I-14, I-15, and the arrangement per viewport      | Focus and scroll events — see below                                          |
| jsdom + React Testing Library                                | I-5 … I-13, I-16 … I-18                                      | Layout: jsdom computes none, so widths and clipping are not observable there |
| Read-only expert review (multi-lens, adversarially verified) | The ten educational questions, clinical accuracy, provenance | Anything requiring a learner                                                 |

**Browser environment limits, measured not assumed.** In this Browser pane, programmatic scrolling
fires no `scroll` event — verified against a freshly created control element — and
`document.hasFocus()` is `false`, so `focus()` does not move the active element. Viewport resizes
also do not fire `ResizeObserver` or `window.resize`, so each resize is followed by an explicit
`dispatchEvent(new Event('resize'))`. Scroll restoration (I-11) and focus (I-7, I-9, I-12) are
therefore verified in jsdom, where both are deterministic, and **not** claimed from the browser.

**No human novice validation is included in this matrix.** It is preflight and readiness only.
