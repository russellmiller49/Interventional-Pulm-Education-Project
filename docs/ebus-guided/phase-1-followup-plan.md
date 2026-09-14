# Linked orientation and anatomical windows — follow-up

Assignment: `EBUS_GUIDED_CODEX_PHASE_1_PROMPT.md`, September 13, 2026. Current base is `83998e78`; preserve its four additional model packages and all existing lesson IDs. Work remains local: no push, merge or release changes.

## Bounded implementation

- Preserve teaching, worked demonstrations, calibrated geometry and the real acoustic renderer in the five Phase 1 lessons.
- Replace first-visibility credit with a gradual sequence of matching rendered planes. Require explicit landmark identification with feedback and retry, including both main bronchi for station 7 and azygos/SVC for 4R.
- Add a separate changed-position acquisition in the station 7 and 4R transfer steps. Use the same model and existing pose authority, with a tested longitudinal offset; do not move anatomy or relabel an unreviewed contrasting node.
- Retain the last actual ultrasound for image-dependent questions, using explicit question policies. Store bounded versioned task evidence with the source session, case/model revision, actual frame pose/settings and frame identity. Historical completion and first responses stay intact and do not create new skill evidence.
- Add an initial/current contact close-up sampled from the same anatomy volume, beside initial/current actual ultrasound. No pressure, force or inflation-volume target.
- Remove draft station boundary aids and the unreviewed 4R/10R contrast from the learner view; keep source assets available for instructor review. Preserve discovery only where naming does not solve the current task.

## Evidence and limits

Reuse the `guided-v1` anatomy, example nodes and scope; its geometry equivalence and coordinate proof remain applicable because no anatomy is displaced. The presentation anatomy and historical CT are not registered. Model sections remain explicitly labeled as model sections. Native Blender/Slicer files remain outside Git.

The named `Text.zip`, `Handbook of Endobronchial Ultrasound.pdf`, and `EBUS_GUIDED_SOURCE_MAP_AND_REVIEW_FLAGS.md` were not found in the supplied task files or the scoped Downloads, Documents, Desktop and mapped reference searches. Do not infer their contents. Existing cited anatomy and EBUS references support the limited teaching; targeted faculty review of the authored geometry remains pending.

## Acceptance

Run root/embedded type checks, guided and affected acoustic/simulator/knobology tests; verify the real five lesson routes, frame correspondence, observer isolation, wrong-landmark retry, gradual sweep, changed-window transfer, hidden annotations, retained frames, versioned records, stale/failure gates, restart/review, keyboard and compact/reduced-motion behavior. Preserve any failures in the final review record. Existing additional-model behavior receives regression checks, not redesign.
