# Bronchial branch tracing — implementation brief

September 11, 2026 · reference checkout `7da3886e` · unpublished, public by direct URL.

The owner's request is to build the module. The audit-only kickoff inside the supplied planning package is an example, not the task scope. The requested structured-medical-modules skill supersedes the package's proposed three-view layout: use the existing Steps → Teaching → Simulator stage, with explicit 0.26/0.29 opening fractions and 300/280/340 px floors.

## Delivery and teaching flow

Canonical route: `/[locale]/learn/anatomy/branch-tracing`, with Overview, Learn, Practice, Assess subroutes. English preview; no authentication, navigation entry, site-search entry, sitemap entry, or publication. Reuse the shared module navigation, stage, NowCard, LookInLine, StepList, and bounded activity progress store without editing those components.

Audience: PCCM/IP fellows and bronchoscopists with basic lobar anatomy; image interpretation at Miller's knows-how level. Sessions are authored estimates of 5–8 minutes. This preview cannot certify bronchoscopy competence.

Ordered lessons: patient orientation; lumen continuity; vertical; horizontal–horizontal; horizontal–vertical; horizontal–oblique; scope roll and direction reversal; common trunks and uncertainty. Each contains a worked example, an interactive prediction, a submitted branch map and opening arrangement, response-specific explanation, and a changed transfer exercise. Practice mixes patterns and delays correctness until submission. Assess provides a separately authored geometric exercise set, explicitly distinct from held-out clinical-case assessment.

## Asset and content preservation

The site's patient-new FluoroView CT and case-001 source manifest identify the same source CT SHA-256. Their previews differ in resampling. Existing labels are spreadsheet/geometry associations, with no checkpoint-level physician approval record. A public geometric teaching fixture must not silently promote those labels into clinical answer keys.

Use original, explicitly synthetic airway phantoms to teach the four tracing patterns and orientation. Use one public CT preview for ungraded anatomy exploration, with an independently browsed continuous stack and a matched exterior/intraluminal surface only after verifying its transform. Candidate branch labels are excluded. No source inputs, textbook illustrations, generated trainer builds, Slicer scenes, or other modules are changed.

The original CT, native subsegmental review, final browser camera/ostium annotations, B5a/B5b labels, and a distinct approved transfer CT remain clinical authoring gates. The UI and contracts support their later addition; this build does not claim those gates have passed.

## Completion and persistence

The existing shared activity envelope is the only store. Feature/version-prefixed IDs retain first-attempt domain outcomes and hint count. No coordinates, images, camera paths, free text, answer keys, or click histories are persisted. A lesson completes only after a submitted prediction, opening map, explanation and a new transfer action. Incomplete lessons restart on reload; first attempts and completed lessons survive. A new incompatible content/asset/rubric ID restarts current work and preserves historical records. No mastery status or aggregate clinical pass threshold.

## Acceptance

Test one complete lesson before expanding. Verify actual handlers for wrong/correct choices, reference withholding, manual continuation, transfer gating, review/reset, reload, independent-practice masking, and domain denominators. Verify RAS/LPS/display inverse transforms, asymmetric fixtures, direction reversal, trifurcation/common trunks, malformed graph rejection, review eligibility, and unlisted anonymous routes. Capture the actual shared reference and new stage at wide/compact/phone/reflow sizes. Record H1–H12 and clinical review gaps in the QA report.
