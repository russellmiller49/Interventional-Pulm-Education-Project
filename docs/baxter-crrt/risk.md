# Baxter CRRT risk register

This register guides protected development and final SME review. Public release remains controlled
by an explicit release-stage change.

| ID   | Risk                                                                  | Mitigation and verification                                                                                |
| ---- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| R-01 | A manual-reference profile is mistaken for an installed configuration | Show manual/revision and “no local override”; make no institutional claim                                  |
| R-02 | Archival Prismaflex material is mistaken for an active runtime        | PrisMax-only runtime lists; no selector/adapter/calculation branch; label prior-platform material archival |
| R-03 | An ambiguous manual formula is silently repaired                      | Keep named conflicts and affected outputs unavailable                                                      |
| R-04 | A machine value is mistaken for whole-patient balance                 | Separate machine and patient ledgers; retain conservation tests                                            |
| R-05 | Alarm acknowledgement is mistaken for cause correction                | Cause-first drills, separate acknowledgement/correction, required reassessment                             |
| R-06 | Synthetic precision appears patient-specific                          | Persistent safety notice, source boundaries, no real-patient input                                         |
| R-07 | Scoring rejects an accepted alternative                               | Per-case required/alternative/unsafe tests and deterministic replay                                        |
| R-08 | Citrate content becomes actionable                                    | Structural no-dose/no-target schemas and verification/escalation-only prose                                |
| R-09 | Wrong-solution content invents local policy                           | Stop, preserve safe state, verify, escalate; no substitution recommendation                                |
| R-10 | Time stepping or bag depletion violates conservation                  | Fixed internal step, coupled delivery fraction, equivalence/depletion invariants                           |
| R-11 | CRRT-16 leaks before the capstone                                     | Exclude it from all curated Practice lists, analytics IDs, and progress case IDs                           |
| R-12 | Progress or analytics stores sensitive/free-text data                 | Strict V3 DTO and bounded telemetry allowlist; rejection tests                                             |
| R-13 | Protected content becomes discoverable                                | Release-derived guards, robots, navigation, search, and sitemap tests                                      |
| R-14 | Dense responsive UI hides state                                       | Four semantic case tabs, merged machine/circuit surface, focus and reflow tests                            |
| R-15 | Non-English routes imply unreviewed translation                       | Reviewed-English fallback and no automatic handoff translation                                             |
| R-16 | Accessibility barriers block controls or summaries                    | Keyboard, focus, text alternatives, 44px targets, reduced motion, zoom/reflow checks                       |
| R-17 | Review metadata becomes a runtime switch                              | Unified runtime registry; metadata stays informational                                                     |
| R-18 | Publication occurs before lesson/content review                       | Release remains `sme-review`; publication is a separate explicit task                                      |

Before a later `published` change, resolve material SME findings, verify evidence and device limits,
repeat automated and authenticated browser checks, and review the public disclaimer and discovery
metadata. These are release-quality checks, not prerequisites for running the protected build.
