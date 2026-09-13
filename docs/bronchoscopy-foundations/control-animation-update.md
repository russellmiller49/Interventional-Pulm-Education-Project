# Section 5: bronchoscope control animations

Owner-requested visual update, 2026-09-13. Continues the teaching-first pilot in PR #184.

## Delivered behavior

The Five controls outside view now shows a detailed, unbranded bronchoscope control head and an
enlarged distal bending section. The contoured black housing includes a thumb paddle, U/D
markings, suction valve, working-channel entrance, insertion-tube strain relief, and universal
cord. Rotation turns the control head about the insertion-tube axis. Deflection moves the
thumb lever and bends the distal section; suction depresses its own valve. Advance/withdraw
moves the instrument presentation while the existing optical view changes depth.

The deflection example now demonstrates up, neutral, down, and neutral. Each movement remains
learner-triggered and captioned. The same visualization responds to real learner input.
Ordinary movements interpolate over 220 ms, using one presentation state for the handle,
distal direction, and optical view. Reduced motion immediately shows each final state.
Hidden panes and background documents stop interpolating. None of this dispatches simulation
commands or creates elapsed time, completion, input provenance, or attempt records.

At wide pane widths the scope image and outside view are adjacent; in a narrow pane the scope
image sits above two instrument close-ups. The close-ups retain the visible Outside view
landmark. Cameras use the aspect ratio updated from the live scissor rectangle, with a finite
fallback. The portal's stored size can remain zero after a compact pane reopens; using that
size had placed the close-up camera infinitely far away. A short redraw burst after scroll,
resize, and state changes also lets the views repaint after their offscreen-state update and
clear. Pixel assertions now cover this previously blank phone view.

## Fidelity and scope

- The owner-supplied handle/lever/tip photographs informed the silhouette and U/D presentation.
  No source pixels, manufacturer branding, private videos, or source photographs are added to
  the repository. The generated model is a teaching illustration, not a scanned product.
- Existing course provenance remains S1 PDF 89–99; S2 PDF 44–47 and 106–107. The U/D mapping is
  stated as belonging to the illustrated teaching control head. Actual device controls and
  limits remain subject to its instructions. Manufacturer product information also documents
  variations such as a separate rotation ring; this update does not introduce that feature or
  imply universal hardware ([Olympus rotary function](https://medical.olympusamerica.com/technology/rotary-function)).
- The distal inset uses a constant-length presentation curve and the existing `scopeFrame`
  directions. Its terminal tangent and roll match the optical engine across positive/negative
  bends and rotations. The separately enlarged ends are not two world-space cameras or a
  measurement of the full instrument's shape. The middle tube is explicitly omitted.
- Original bench camera position, target coordinates, aiming/scoring calculations, engine
  travel/deflection limits, records, assessment keys, and other sections' device assets remain
  intact. The close-up does not model hand grip, torque transmission, or tissue interaction.
- This is a scoped visual repair under the structured-medical-modules contract. H1/H2/H4/H6/H7/H9
  retain their existing pilot behavior and are covered by the regression journeys; H3/H5/H8/H10
  are satisfied by the existing shared stage, rendered close-ups, common direction model, and
  captions; H11 preserves the unlisted release state. H12 includes rendered desktop/phone
  checks, fallback, keyboard/touch, and record/retry regression coverage.
- Clinical/media approval and novice usability review remain pending. Technical verification
  does not replace either review.

## Files and reproducibility

- `scripts/bronchoscopy-foundations/build-control-head.py` builds the housing and movable parts
  with Blender; pivots and presentation limits are exported in `devices/control-head.json`.
- `compress-scope-assets.mjs control-head` produces the 216,088-byte runtime GLB. The anatomy
  manifest includes provenance, hash, payload budget, and pending review status. No new npm
  dependency was added.
- `BronchoscopeCloseup.tsx` renders the two ends with local studio illumination and printed
  faceplate markings; `benchPresentation.ts` supplies the constant-length curve and wrap-safe
  interpolation; `useBenchPresentation.ts` manages cancellable, presentation-only transitions.
- `ScopeScene.tsx`, `scopeSceneAssets.ts`, and feature-scoped CSS integrate the close-ups only
  for section 5. `ScopeOpticalView.tsx` uses the live aspect for the pilot bench camera;
  `fiveControlsLearn.ts` supplies the expanded example and matching captions.

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python scripts/bronchoscopy-foundations/build-control-head.py
node scripts/bronchoscopy-foundations/compress-scope-assets.mjs control-head
node scripts/bronchoscopy-foundations/build-scope-manifest.mjs
```

## Verification

```sh
npx --no-install jest src/features/bronchoscopy-foundations src/features/learning-module/stage \
  src/features/learning-module/curriculum/__tests__/resizable-teaching-workspace.test.tsx --runInBand
npm run type-check
npx --no-install eslint src/features/bronchoscopy-foundations e2e/bronchoscopy-foundations.spec.ts
BRONCH_FOUNDATIONS_BASE_URL=http://localhost:3140 npx --no-install playwright test \
  --config playwright.bronchoscopy-foundations.config.ts
```

The 24 Jest suites pass: 313 tests and one existing todo. Type-check and scoped ESLint pass.
The full 12-test browser suite passes, covering the pilot at 1440×900 and 390×844, fallback,
progress/first-answer retention, assessment safety, and other lesson surfaces down to 320 px.
The pilot checks both the light studio background and the dark instrument in rendered pixels,
so a loaded but blank close-up cannot pass merely from its DOM attributes. Desktop runs with
ordinary animation; the phone runs with reduced motion. Hook tests verify intermediate motion,
hidden-pane cancellation, and unchanged learner state; curve tests verify optical agreement.

Browser evidence and logs are saved outside Git under Local-Data:
`renders/output/bronchoscopy-foundations-control-animation-2026-09-13/`.
