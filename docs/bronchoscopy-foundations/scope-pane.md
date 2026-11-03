# Scope pane implementation

All seven modes select `ScopeScenePane`: idle, controls-isolated, guided-walk, free-drive, larynx-entry, tube and accessory. The host remains the only owner of simulation state. A scene action sends a typed command with keyboard, pointer, touch or scripted provenance; the renderer does not integrate motion or change labels.

## Representation

- The optical camera uses `scopeOpticalFrame(state.pose)` and the shared `ScopeCamera`. The nominal 88° field is measured across the wider axis of the 4:3 optical viewport. The round aperture and in-view eligibility agree with the engine.
- `projectScenePins` is used in production and is tested against a Three.js camera under sampled roll and deflection. `BronchLabelOverlay` supplies the shared placement/filter behavior. Narrow captions move only when needed to avoid overlap, with leader lines back to their projected attachment points. Answer pins are labels associated with the tree-answer inputs; align controls, when offered, send disclosed assist commands. Obscured fields hide pins.
- The teaching lumen is loaded once per URL/decoder through the existing geometry cache. The cached stage case uses that same geometry for its BVH. A stage load that cannot construct the collider fails explicitly; it never silently substitutes graph-only wall contact.
- Bench and larynx poses are now authored real frames rather than null. The larynx follows its supplied path, morphs both true folds at weights 0, 0.5 and 1, and hands off at the scripted tracheal boundary.
- Tube walls, their cutaway and the annulus use `devices.json` and the authored scope OD. The readouts remain geometric. Accessory states come from named GLB nodes; only states belonging to the loaded accessory are offered.
- The observer and optical views share one Canvas through drei View ports. The SVG map remains outside WebGL, with leader lines from separated short labels to their anatomical locations.

## Rendering and interaction

The Canvas is fixed to the viewport and clipped to the pane. This matches View's viewport-relative scissor coordinates and prevents displacement when the teaching content expands or a compact tab changes. It uses DPR 1–1.5 and demand rendering after initial drawing; initialization temporarily renders continuously, and an offscreen pane uses `never`. Two invalidated frames let View settle its visibility state after scrolling or a tab switch.

One live canvas/context is retained per pane. Mode changes dispose the old Canvas; context loss remounts it while the host retains its state. Asset errors expose Reload. Renderer creation errors are caught at Fiber's asynchronous factory boundary and expose a labeled schematic alternative. The schematic retains the same command and record contract. It uses explicit one-second steps for scripts.

Keyboard shortcuts are scoped to the focused workspace and do not intercept form input. W/S insert/withdraw, A/D rotate, arrows deflect and Space operates suction; only controls offered by that step are active. Held insertion emits normal step commands capped at 24 authored mm/s. Rotation sliders cover the engine's unique integer range −179° to 180° without a duplicate endpoint that jumps from left to right.

Breathing and hold scripts use wall-clock tick commands only while enabled and visible. Reduced motion, an explicitly offered Step control or schematic mode requires manual ticks. Offscreen and locked scripts accrue no time. Captures and acknowledgments remain engine events; they are not images fabricated into a clinical record.

## Layout, controls and the example (owner feedback, 2026-11-03)

The owner found the brush exchange harder to operate than to learn from: the controls sat below the
fold, under a map the step did not use; loading the brush was an option in a drop-down named
"Accessory position"; the controls stayed dead until "Try with guidance"; and the goal and the tip's
location were printed twice. The pane now follows these rules.

- **Controls under the view.** The dock follows the scope view directly. A step that steers
  (rotation or deflection), names segments or is answered on the map keeps the region strip and the
  airway map; the map sits beside the view and is held to the view's height (size containment on
  its column), so it never pushes the controls down. A step without steering (the brush exchange)
  drops both, and its view is capped at about 44% of the window. At 1440×900 the current goal, the
  view and every control of the brush exchange or the carina task fit in one window. Below a 500 px
  pane the Scope view / Airway map tabs work as before.
- **The tool on buttons** (`AccessoryControls.tsx`). "Where the brush is": Not loaded · In the
  channel · At the tip · Beyond the tip, the current place pressed (the operator's hands).
  "Tell your assistant": Push the brush out / Brush back into its sheath (forceps: Open the cups /
  Close the cups; needle: Needle out / Needle back in), with no pressed state, because the assistant's
  reply can be false. "Check it on the scope view" sends `verify-accessory`. The assistant's latest
  reply, or a refusal, prints under these buttons. Every button sends the command the drop-downs
  sent, so the goals and the record are unchanged.
- **No gate before the example.** The controls are live from the start; the first use of a control
  is the attempt's first move on the step's own state, which the example never touches. "Watch the
  example" is the Now card's secondary button (then "Replay the example"). While the example plays,
  the controls are held and the status line says how to take them ("Try with guidance", which starts
  a fresh scope as before). This reverses the SYSTEMIC-UX-01 inventory's "dock disabled until Try
  with guidance" for BF.
- **One of each.** One current-goal card in the pane and one checklist on the Now card. One line
  says where the tip is: the region strip's caption on a steering step, the goal card's "Where the
  tip is now" line otherwise; the Now card's checklist no longer repeats it. One status line.
- **A goal the attempt can no longer meet.** When a broken `without` clause rules a goal out (an
  unsafe tool request, advancing against closed folds or in a red field, suction in a red field,
  advancing on a smeared lens), the goal card says so unasked and highlights Reset the scope.
- **Words.** "Outside view" without "authored model", "Loading the 3D view…", the rim-tick legend
  without "the teaching model's geometry", no "unaided" line in a rewritten section, the assistant's
  speech as "Your assistant: …", and view lines without "scripted".

## Technical evidence

`review-scope-pane.mjs` bundles an isolated harness and serves existing public files on loopback. It checks rendered pixel signal for all modes, an RUL entry, the complete survey on the loaded lumen, red-field recovery, clearing a smeared lens, tube readouts, bench rotation, native locks, keyboard and touch provenance, manual and automatic time, offscreen/locked pauses, context loss, mobile map switching, failed-asset retry and unavailable-WebGL fallback. The harness uses the existing ScopePilot to exercise the full survey against the real collider; the separate route suite drives native lesson controls.

```sh
node scripts/bronchoscopy-foundations/review-scope-pane.mjs
BRONCH_FOUNDATIONS_BASE_URL=http://localhost:3130 npx playwright test --config playwright.bronchoscopy-foundations.config.ts
```

Captures and `scope-pane-review.json` are written to `artifacts/bronchoscopy-build/`. Selected inspected captures accompany [validation](validation.md). The asset manifest still declares clinical review and publication permission pending. A smooth frame transition is not evidence that the larynx-to-source junction is geometrically continuous.
