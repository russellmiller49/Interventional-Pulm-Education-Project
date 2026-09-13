# Additional EBUS models — implementation brief

The owner requested the remaining models from `EBUS_GUIDED_REVIEW_AND_3D_BUILD_PLAN.md` after completing the anatomy/scope pilot. Implement A3–A6 as four companion lessons beside the related existing lessons. This extends the unlisted development course; it does not replace the existing course, release it, or change previous responses.

## Preservation and teaching flow

Reuse `LessonHost`, `StageLayout`, the seven existing learning phases, iframe origin/session validation, and the existing progress store. Add a typed model workbench to the existing embedded React/Three.js app. Keep the original contact, capture, needle sequence, EUS-B lesson, acoustic worker, clinical media, and all existing IDs unchanged. New IDs are `needle-assembly-model`, `contact-cutaway-model`, `measurement-phantoms`, and `eus-b-route-model`. Historical completions remain complete; the next-incomplete resolver naturally offers the new lessons.

Worked examples use separate sessions. Independent actions alone earn activity completion. Observe retains the actual final model state with controls locked; Explain reveals interpretation labels. Hidden tip geometry, phantom dimensions/border keys, and route answers are not included in concealed hover/accessible labels. Reset clears model evidence. Asset failure cannot complete an activity.

## Packages

- **Needle:** generic conceptual assembly, separate semantic components, linked handle/sheath/needle movement, a local channel/wall/node/vessel cutaway, and a geometric ultrasound-plane intersection. Practice protected assembly, live visible-tip advancement, stopping after lost visualization, resistance reassessment, and protected removal. No device-specific extension range, force, tissue yield, or clinical safety prediction.
- **Contact:** local transducer, wall, fluid balloon, air gap/bubble, cartilage and calcified focus. Qualitative authored echo schematic driven by the same contact state as the model. Compare direct and balloon contact; gain cannot restore absent coupling. Identify a shadow after fixing contact.
- **Measurement:** analytic sphere, ellipsoid, adjacent objects and lobulated union, exported from the same shape definitions used for sections and calipers. Require a complete sweep, intended-axis border placement, and an explicitly labeled phantom record. Dimensions are authored phantom values; no clinical media calibration is implied.
- **EUS-B:** reuse the existing same-frame esophagus, airway, vessels and target meshes; add derived route locators and a clearly authored lower paraesophageal example. Compare fixed anatomical targets at 4L/7 across preset approaches, then examine complementary lower access and explicit unsupported windows. No esophageal collision/navigation or puncture simulation; no universal reachability claim.

Native Blender sources and optimization intermediates stay under Local-Data `raw-assets/ebus-guided-models/additional/`. Track only reproducible scripts, runtime GLBs, manifests and contracts. Preserve Phase 1 geometry and acoustic hashes. New conceptual assets require faculty review; device-specific clinical validation is outside this generic model build.

## Evidence

Validate semantic hierarchy, transforms/units, bounds, GLB hashes, needle geometry/state guards, phantom slice geometry and caliper borders/axis, route target invariance, and stale/invalid observations. Verify real browser interactions, unsafe actions, incomplete tasks, locked/reveal/reset/reload states, compact layout, hover concealment and asset failure. Run relevant existing tests, both type checks, lint and production/embed builds. Record H1–H12 results in the additional-model review. Clinical reference claims use primary guideline/anatomy sources; no unavailable handbook/transcript is treated as a reviewed source.
