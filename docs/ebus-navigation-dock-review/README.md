# EBUS navigation dock review

The floating navigation pad covered the external anatomy in the reported three-view layout. Navigation now occupies a separate row below the imaging workspace. Airway choice, advance/withdraw, tip flexion, and scope roll remain together. The flexion control also displays its angle.

On desktop, the same dock stays below the three-view grid and each enlarged layout. At widths of 1080 pixels or less, view buttons switch between anatomy, bronchoscopy, and ultrasound above the dock. Ultrasound retains its depth/gain controls. Panes stay mounted when switching, preserving the live pose and imaging settings. The obsolete draggable position is ignored when reading saved sessions.

The ultrasound image now fits the available pane height with its controls in their own rows; its square canvas retains its aspect ratio. The scope motion, station calibration, ultrasound synthesis, hardware input, and assessment rules are unchanged.

## Visual evidence

The supplied before image shows the overlap. After images demonstrate the layout at different poses, so these are interface comparisons, not matched-pose imaging comparisons.

- [Reported overlapping controls](before.png)
- [Desktop, 1354 × 850](desktop.png)
- [Tablet, 820 × 900](tablet.png)
- [Phone, 390 × 844](phone.png)

## Verification

- Browser geometry checks: no navigation/pane overlap or horizontal page overflow in the desktop grid, all three enlarged layouts, or all three tablet view selections.
- Phone: no overlap or horizontal overflow; keyboard withdrawal and tip flexion update the shared scope state. Tablet keyboard advancement and desktop roll/reset controls also work.
- Desktop dock: 137 px high, with a 12 px gap beneath each image pane. Tablet dock: 207 px. Phone dock: 349 px; the page remains scrollable.
- No browser console errors during the standalone layout checks.
- EBUS TypeScript check passes. All 240 EBUS tests pass. Embedded production build passes, retaining the existing large-chunk warning.
- The embedded application on port 3130 is also checked after rebuilding.
- EBUS does not configure its own lint command; the repository ESLint configuration excludes this app. `git diff --check` passes.

The learning-interface review confirms that the current position and primary Advance action stay visible in the dock, tabs have selected-state labels, keyboard controls work, and no new clinical claims or assessment hints are introduced.
