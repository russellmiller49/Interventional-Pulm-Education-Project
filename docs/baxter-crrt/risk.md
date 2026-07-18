# Baxter CRRT v1 risk register

This register guides private development and the final SME feedback pass. It does not create runtime
approval gates. Public release remains controlled only by the explicit release-stage change.

| ID   | Risk                                                                  | Mitigation and verification                                                                                                           |
| ---- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| R-01 | A manual-reference profile is mistaken for an installed configuration | Show manual/revision and “no local override”; make no institutional claim; validate optional extensions separately                    |
| R-02 | Device generations are presented as interchangeable                   | Separate adapters, navigation, displays, scale topology, alarms, and stop/end; transfer capstone explicitly denies interchangeability |
| R-03 | An ambiguous manual formula is silently repaired                      | Keep named conflicts and affected outputs unavailable; test transparent supported calculations only                                   |
| R-04 | A device value is mistaken for whole-patient fluid balance            | Preserve separate machine and patient ledgers; conservation and bag/scale tests                                                       |
| R-05 | Alarm acknowledgement is mistaken for cause correction                | Cause-first state, separate acknowledgement/correction, required reassessment, unsafe-path tests                                      |
| R-06 | Synthetic precision appears patient-specific                          | Persistent educational notice, source overlays, synthetic calibration records, no real-patient input                                  |
| R-07 | Critical-error scoring rejects an accepted alternative                | Per-case required/alternative/unsafe tests and deterministic replay                                                                   |
| R-08 | Citrate or anticoagulation content becomes actionable                 | Structural no-dose/no-target/no-adjustment schemas; UI/progress/analytics scans; verification/escalation only                         |
| R-09 | Wrong-solution or blood-disposition content invents local policy      | Stop, verify, preserve safe state, escalate; no substitutions or universal return/discard rule                                        |
| R-10 | Time stepping or bag depletion violates conservation                  | Fixed internal substep, coupled delivery fraction, large-vs-small-step and depletion invariants                                       |
| R-11 | Learn help leaks into Practice or Mastery                             | Fresh session construction, separate progress keys, no Mastery hints, isolation tests                                                 |
| R-12 | Progress or analytics stores sensitive/free-text data                 | Strict v3 DTO and telemetry allowlists; preview suppression; rejection tests                                                          |
| R-13 | Private content becomes discoverable                                  | Release-derived route guard, robots, navigation, search, and sitemap tests                                                            |
| R-14 | Mobile layout hides alarms or state                                   | Persistent global alarm summary, five semantic tabs, focus and reflow tests                                                           |
| R-15 | Non-English routes imply unreviewed clinical translation              | Reviewed-English fallback and no automatic handoff translation                                                                        |
| R-16 | Accessibility barriers block controls or summaries                    | Keyboard, focus, screen-reader text, 44px targets, reduced motion, 200% zoom, 320px, tablet checks                                    |
| R-17 | Review metadata is accidentally reused as an activation switch        | Unified runtime registry and tests proving pending metadata remains runnable in private stages                                        |
| R-18 | Publication occurs before feedback is incorporated                    | Current code constant remains `sme-review`; publication is a later explicit user-directed change                                      |

## Public-release readiness questions

Before a later change to `published`, resolve material SME findings, verify device/source limitations
are clear, repeat the full automated and authenticated browser checks, confirm privacy/accessibility
behavior, and deliberately review the public disclaimer and discovery metadata. These are release
quality checks, not prerequisites for running the private build.
