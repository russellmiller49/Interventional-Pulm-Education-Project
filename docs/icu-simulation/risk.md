# ICU Simulator risk register

| ID     | Risk                                                              | Required mitigation and verification                                                                                   |
| ------ | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| ICU-01 | Multiple source engines overwrite the same patient value          | One canonical patient; adapters emit effects only; tests forbid last-writer-wins synchronization                       |
| ICU-02 | A synthetic response is mistaken for patient prediction           | Persistent educational notice, bounded models, no real-patient input, and no decision-support language                 |
| ICU-03 | Device deployment teaches an invasive technique                   | Readiness/team-confirmation workflow only; no cannulation, access, intubation, or drainage mechanics                   |
| ICU-04 | Numeric medication controls imply a dosing protocol               | Relative medication tiers only; no dose, titration target, or institution-specific protocol                            |
| ICU-05 | A learner assumes every shock state needs advanced support        | Scenario-specific eligibility and meaningful no-device paths; device escalation can be unsafe                          |
| ICU-06 | VV ECMO is treated as circulatory support                         | Explicit gas-exchange effect boundary and tests showing no direct systemic-flow contribution                           |
| ICU-07 | VA ECMO or MCS flow masks poor native physiology or complications | Native ejection, loading, oxygenation, preload, limb, and congestion reassessment predicates                           |
| ICU-08 | CRRT removal and circuit drainage violate volume conservation     | Shared fluid ledger, compartment-level removal, mass/volume invariants, and time-equivalence tests                     |
| ICU-09 | PEEP changes respiratory displays but not circulation             | Shared pleural-pressure/hemodynamic coupling with cross-system tests                                                   |
| ICU-10 | Unsupported device combinations produce plausible-looking output  | Capability registry fails closed; only reviewed V1 combinations are selectable                                         |
| ICU-11 | Alarm aggregation invents device urgency                          | Preserve native alarm identity and optional reviewed priority; never synthesize CRRT priority                          |
| ICU-12 | Accelerated time changes outcomes                                 | Boundary-aware deterministic stepping and partition/replay equivalence tests through 24 hours                          |
| ICU-13 | One exact treatment sequence is presented as universal            | Predicate-based goals, accepted alternatives, individualized reassessment, and SME review                              |
| ICU-14 | Unsafe paths are missed or benign alternatives are penalized      | Per-case safe/alternative/unsafe tests and two independent critical-care reviewers                                     |
| ICU-15 | Analytics expose detailed clinical simulation state               | Strict bounded summary allowlist; reject physiology, waveforms, arrays, free text, and command history                 |
| ICU-16 | Existing module progress or behavior changes                      | Separate progress/session keys, compatibility adapters, and full source-module regression suites                       |
| ICU-17 | Dense bedside UI becomes inaccessible                             | Keyboard navigation, text equivalents, non-color alarms, focus preservation, 320 px reflow, zoom and reduced-motion QA |
| ICU-18 | Draft dependencies become publicly discoverable                   | Independent private-development release stage, draft guard, noindex, and search/sitemap/navigation tests               |
| ICU-19 | Future VR requires a second clinical engine                       | Stable semantic commands/control descriptors and presentation-independent worker/replay contracts                      |
| ICU-20 | Guideline or device revisions silently change meaning             | Version-locked evidence IDs, review status, source-boundary notes, and explicit content-version migration              |
