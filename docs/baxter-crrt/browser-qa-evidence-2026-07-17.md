# Baxter CRRT provisional browser-QA evidence — 2026-07-17

Evidence ID: `CRRT-BROWSER-QA-PROVISIONAL-2026-07-17-01`  
Disposition: `engineering-smoke-observation-only`  
Approval authority: none  
Candidate binding: none — repeat every row against the clean frozen candidate  
Repository base commit: `26949257c7bec11622c9e6c5876dc34f76952929`  
Working-tree state: dirty CRRT candidate scope; not signable  
Module routes: `/en/baxter-crrt` and `/en/baxter-crrt/review`

## 1. Environment

| Field                  | Recorded value                                                                 |
| ---------------------- | ------------------------------------------------------------------------------ |
| Date                   | 2026-07-17                                                                     |
| Host operating system  | macOS 27.0, build 26A5378n, arm64                                              |
| Browser surface        | Authenticated Codex in-app browser                                             |
| Browser engine/version | Not exposed by the browser surface; this prevents a formal browser-matrix pass |
| Local origin           | `http://localhost:3002`                                                        |
| Zoom                   | Browser default only; 200% review was not performed                            |
| Motion preference      | Default only; OS-level reduced-motion review was not performed                 |
| Assistive technology   | None                                                                           |
| Console observation    | No error-level browser logs during the recorded smoke traversal                |
| Retained screenshots   | None; screenshot artifact IDs and SHA-256 digests remain required              |

## 2. Route and state matrix

| Route                        | Viewport   | State exercised                                                                                              | Observation                                                                                                |
| ---------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `/en/baxter-crrt`            | 320 × 800  | Authenticated reviewed-English learner shell                                                                 | No page-level horizontal overflow; bounded learner controls remained contained                             |
| `/en/baxter-crrt`            | 768 × 1024 | Authenticated reviewed-English learner shell                                                                 | No page-level horizontal overflow                                                                          |
| `/en/baxter-crrt/review`     | 320 × 800  | Reviewer registry with case, instructional-tools, Mastery, Prismaflex-console, and transfer-plan disclosures | No page-level horizontal overflow after the rapid-drill selector fix; disclosed content remained contained |
| `/en/baxter-crrt/review`     | 768 × 1024 | Same reviewer surfaces                                                                                       | No page-level horizontal overflow                                                                          |
| Rapid-drill reviewer surface | 320 × 800  | Drill selector and sequence header after `minmax(0, 1fr)` and bounded-select correction                      | Zero observed child overflow                                                                               |
| Both routes                  | Both       | Visible module controls                                                                                      | Observed module buttons met the 44 px target; native reviewer inputs rely on their associated label target |

## 3. Defect found and corrected during the smoke pass

The 320 px reviewer rapid-drill layout initially allowed the selector/header grid to exceed its
container. The correction is recorded in
`src/features/baxter-crrt/components/crrt-rapid-drill-review.module.css`, with a static regression
in `src/features/baxter-crrt/__tests__/accessibility.test.tsx`. The post-fix traversal observed no
remaining child overflow in that surface.

## 4. What this evidence does not establish

This record is not an accessibility review, clinical review, device review, pilot acceptance,
activation authorization, or publication authorization. It does not complete any formal browser
matrix row because the browser engine/version and screenshot artifacts were not retained. It also
does not establish:

- full keyboard tab order and focus visibility across every state;
- VoiceOver plus a second assistive technology;
- 200% zoom and complete reflow traversal;
- computed color contrast or forced-colors behavior;
- OS-level reduced-motion behavior;
- non-English locale review;
- exact-candidate console, screenshot, and artifact-digest evidence.

## 5. Frozen-candidate repeat requirements

After a clean candidate is committed and its v2 candidate ID and manifest SHA-256 are available,
repeat the matrix and record:

1. exact candidate ID, candidate-manifest SHA-256, deployable artifact ID, and artifact SHA-256;
2. browser name, complete version, operating-system version, route, locale, viewport, zoom, motion,
   and assistive-technology state for each row;
3. start and end states, keyboard path, expected result, observed result, console result, and finding
   IDs;
4. retained screenshot or recording artifact IDs and lowercase SHA-256 digests; and
5. named accessibility-review disposition through the authenticated review-ingestion process.

Until that repeat is complete, the formal accessibility and browser-QA disposition remains
`NOT-REVIEWED`.
