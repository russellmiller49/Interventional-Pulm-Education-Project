# Rigid Bronchoscopy 3D Lab v2 release checklist

This checklist is a production gate, not a record of approval. Do not replace the current
production asset prefix or remove the v1 scene until every required reviewer has signed and the
production hash audit is complete.

## Candidate

- Asset manifest: `public/models/rigid-bronchoscopy/v2/asset-manifest.json`
- Candidate build ID: `f768081bdbeed4a3`
- Upload scope: `/models/rigid-bronchoscopy/v2/` only
- Required review environments: Learn and Practice, desktop, mobile, and 544 × 318 scene

## Clinical sign-off

- [ ] Module owner reviewed all four EFER interfaces and every instrument/cap configuration.
  - Reviewer:
  - Date:
  - Notes:
- [ ] Anesthesia subject-matter reviewer approved the four respiratory storyboards.
  - [ ] Controlled ventilation: anesthesia-circuit inlet and return, sealed proximal interfaces.
  - [ ] Spontaneous-assisted: patient effort and separate assist events through the anesthesia
        circuit.
  - [ ] Low-frequency jet: fixed jet inlet, ambient entrainment, passive open-system egress.
  - [ ] High-frequency jet: fixed jet inlet, faster qualitative cadence, passive open-system egress.
  - Reviewer:
  - Date:
  - Notes:
- [ ] Reviewers approved open, fixed-complete, and expiratory/ball-valve obstruction storyboards.
- [ ] Reviewers confirmed that no instrument is shown entering either ventilation port.

## Geometry and asset gate

- [ ] `python3 scripts/rigid-bronchoscopy/validate-v2-assets.py`
- [ ] `python3 scripts/rigid-bronchoscopy/validate-v2-blender-import.py`
- [ ] All supported tube/pose/tool combinations retain at least 0.5 mm radial clearance.
- [ ] Bevel, safety-stop, telescope-objective, port, fenestration, cap, and tool endpoint anchors are
      present.
- [ ] Every manifest path is content-hashed and resolves locally with no WebGL or asset error.
- [ ] Golden renders in `artifacts/rigid-bronchoscopy-v2/` were reviewed at all required sizes.

## Application gate

- [ ] Focused rigid-bronchoscopy and localization tests
- [ ] Full `npm test -- --runInBand --silent`
- [ ] `npm run type-check`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Authenticated real-browser Learn and Practice QA
- [ ] Prediction remains hidden until the learner commits and explicitly reveals the answer.
- [ ] Reduced-motion mode has equivalent phase text and static route arrows.
- [ ] English, Spanish, and Simplified Chinese render without missing-message errors.

## Production publication

- [ ] Upload only the versioned `public/models/rigid-bronchoscopy/v2/` prefix.
- [ ] Fetch the production manifest and compare its build ID with `f768081bdbeed4a3`.
- [ ] Fetch every production asset URL and verify its bytes against the manifest hash.
- [ ] Run production Learn and Practice smoke tests with the browser cache enabled and disabled.
- [ ] Switch the shared Learn/Practice component only after the clinical and production gates pass.
- [ ] Remove obsolete pathway/pose code only after the v2 rollback window closes.
