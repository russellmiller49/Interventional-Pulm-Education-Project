# Baxter CRRT completion audit

Status: `engineering work remains in progress; no frozen candidate, activation, competency, or publication approval`

Audit date: 2026-07-17  
Repository state at audit: dirty `main`; therefore not an exact review candidate  
Learner route: `/[locale]/baxter-crrt`  
Reviewer route: `/[locale]/baxter-crrt/review`

## 1. Purpose and status vocabulary

This is the controlling gap summary against the supplied CRRT implementation brief. It separates
implemented engineering from evidence and decisions that must come from named people or trusted
external systems. A green test does not mean that clinical content, device behavior, accessibility,
pilot use, activation, competency, or publication is approved.

| Status               | Meaning                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `PROVEN-ENGINEERING` | Implemented and supported by repository tests or deterministic inspection within the stated boundary.  |
| `PARTIAL`            | Some implementation exists, but the requested phase or product surface is materially incomplete.       |
| `EXTERNALLY-BLOCKED` | Completion requires evidence, identity, review, configuration, protocol, or authorization not in code. |
| `NOT-STARTED`        | No operational implementation exists; a manifest or non-runnable planning record does not count.       |

No phase is classified as formally complete while the repository lacks a clean frozen candidate
and the required candidate-bound dispositions.

## 2. Phase-by-phase decision

|   Phase | Engineering status                             | What is proven                                                                                                                                                 | What prevents formal completion                                                                                                                                                         |
| ------: | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|       0 | `PROVEN-ENGINEERING`                           | Repository-pattern audit, requirements, source policy/matrix, engine design, reuse plan, and risk register.                                                    | Named owners and review dispositions remain pending.                                                                                                                                    |
|       1 | `PROVEN-ENGINEERING`                           | Authenticated draft route, unlisted/search/sitemap exclusion, robots metadata, disclaimer, sources, fallback.                                                  | Exact-candidate entitlement, privacy, localization, product, and publication review.                                                                                                    |
|       2 | `PROVEN-ENGINEERING`                           | Strict schemas, pure reducer, deterministic seeded engine, explicit units, calculations, persistence boundaries, and tests.                                    | Independent clinical/device validation of consequential assumptions and exact candidate.                                                                                                |
|       3 | `PROVEN-ENGINEERING` for the pilot boundary    | Original CVVHD pilot facsimile, ordered setup gates, operations surface, circuit/scales/pressure nodes, stop/end, and clean reload.                            | Full PrisMax configuration and device workflows were intentionally excluded.                                                                                                            |
|       4 | `PROVEN-ENGINEERING` for the three pilot cases | Canonical reasoning loop, prediction lock, Learn/Practice isolation, hints, debrief, progress, and allowlisted analytics.                                      | Manual accessibility and exact-candidate product/privacy review.                                                                                                                        |
|       5 | `PARTIAL`                                      | `CRRT-04`, `CRRT-10`, and `CRRT-13` have deterministic safe, accepted-alternative, unsafe, critical, reassessment, and debrief paths.                          | Every clinical/device source disposition and critical-error adjudication remains pending.                                                                                               |
|       6 | `EXTERNALLY-BLOCKED`                           | Automated accessibility engineering, validation records, review templates, pilot plan, and fail-closed gates exist.                                            | Frozen candidate; clinical/device review; complete keyboard/AT/200% zoom/contrast/reduced-motion matrix; pilot acceptance; all findings closed.                                         |
|       7 | `PARTIAL`                                      | Canonical 18-case catalog, seven reviewer case candidates, five drill previews, six reviewer tool surfaces, locked Mastery boundary, and activation contracts. | Fifteen nonpilot learner cases, seven runnable drills, six approved/complete tools, full PrisMax curriculum, real Mastery capstone, all reviews, and authorization.                     |
|       8 | `PARTIAL` reviewer scaffold only               | Separate Prismaflex profile, source records, calculation candidate, non-runnable adapter, review console, and transfer plan.                                   | Stable accepted PrisMax v1, exact Prismaflex configuration, operational adapter/workflows, trained-device review, equivalence protocol/tolerance, transfer capstone, and authorization. |
| Release | `EXTERNALLY-BLOCKED`                           | Exact-composition and fail-closed publication contracts exist.                                                                                                 | Clean deployable artifact, trusted review receipts, publication authorization, release-owner decision, and production verification.                                                     |

The original brief required Prismaflex implementation to wait until PrisMax v1 was accepted and
stable. Reviewer-only Prismaflex scaffolding was created before that prerequisite. It remains
non-runnable and fail-closed, but it does not satisfy the sequence requirement. No operational
Prismaflex runtime may proceed until the stable-PrisMax prerequisite is independently verified.

## 3. Exact runnable inventory

### Learner-active boundary

- Cases: `CRRT-04`, `CRRT-10`, and `CRRT-13` only.
- Device: `prismax-aw8035-2xx` only.
- Pathways: Learn and Practice; Mastery remains locked.
- Release composition: those three cases plus that one device profile only.
- Protocols: no active local anticoagulation or citrate/calcium protocol.

### Reviewer-only Phase 7 inventory

- Runtime case candidates: `CRRT-01`, `CRRT-02`, `CRRT-05`, `CRRT-06`, `CRRT-07`, `CRRT-11`, and
  `CRRT-15`.
- Manifest-only cases: `CRRT-03`, `CRRT-08`, `CRRT-12`, `CRRT-14`, `CRRT-16`, and `CRRT-18`.
- Protocol-blocked cases: `CRRT-09` and `CRRT-17`.
- Rapid drills: seven manifests; five non-actionable previews; none runnable or learner-active.
- Instructional tools: six stable IDs and six reviewer surfaces; citrate/calcium is a
  non-actionable domain scaffold and remains protocol-blocked.
- Mastery: manifest and composition planner only; no activated runtime case, result, progress, or
  competency behavior.

### Reviewer-only Phase 8 inventory

- `prismaflex-g5036003-6xx` has zero enabled therapies, sets, configured ranges, or learner runtime.
- The adapter rejects configuration and throws for runtime actions.
- The softkey console is an inspection surface, not a device workflow.
- The transfer plan has no runtime case, score, result, approved tolerance, progress, analytics, or
  equivalence claim.

## 4. Safe engineering work versus external inputs

### Engineering gaps closed during this audit

- Ephemeral results now carry deterministic replay identity without expanding analytics or local
  progress storage.
- The workflow has source-independent 1-, 5-, 15-, and 30-minute plus 1- and 6-hour controls and an
  exact seeded-queue next-event action.
- Accepted paths declare visible prediction controls; primary-plan/alternative-action mismatches no
  longer receive full prediction-domain credit.
- Debrief now renders actual plan, actions, omissions, reassessment, matched path, critical
  candidates, ordered timeline, and sampled pressure/dose/fluid/laboratory evidence.
- Prismaflex and cross-device authored scaffolds have strict fail-closed Zod boundaries and negative
  tests, while their runtime and equivalence fields remain unavailable.
- Access/return disconnection lifecycle tests, canonical-JSON rejection tests, and a production
  unsafe-cast cleanup were added.
- The learner registry now has a code-owned Phase 7 registration boundary that rejects ID/version
  mismatches, duplicates, and any record that fails exact-candidate activation; its live list is
  empty.
- The citrate/calcium reviewer surface now shows the linked domains and missing prerequisites while
  exposing no parameter, target, dose, adjustment, action, alarm, or escalation control.
- The learner workbench now has a collapsed, read-only reference drawer for the current synthetic
  prescription, attempt history, realized events, and recent trends. Future queued events remain
  hidden, equations fail closed as unavailable, and the drawer is absent from masked Mastery.
- Case validation now rejects duplicate source mappings at a claim location and any source-basis
  record that is never mapped to a concrete authored claim.

### Safe engineering work that may still continue without inventing facts

- Add other disabled device/UI shells using approved pilot data only.
- Expand negative tests for progress, analytics, activation, publication, and protocol boundaries.
- Improve reviewer-facing provenance inspection without assigning clinical relevance in code.

These changes do not authorize learner activation and must be included in a newly frozen candidate
before review.

### Inputs code cannot safely manufacture

- Exact local PrisMax and Prismaflex market, program, set, accessory, solution, range, increment,
  alarm, bag, syringe, stop/end, blood-return, and escalation configuration.
- Current clinical evidence and decisions for sodium trajectories, electrolyte/temperature effects,
  filtration fraction, recurrent filter loss, liberation, transition, and other unfinished cases.
- Approved anticoagulation and citrate/calcium protocols with version, owner, effective date, and
  review scope.
- Named nephrology, critical-care, CRRT nursing, device, pharmacy, nutrition, accessibility,
  localization, privacy, entitlement, product, and publication reviewers as applicable.
- A supported-browser/assistive-technology matrix with complete keyboard traversal, screen readers,
  200% zoom, 320-pixel reflow, contrast, and OS-level reduced-motion evidence.
- Pilot recruitment authority, acceptance decision, Phase 7 authorization, stable PrisMax v1 proof,
  Phase 8 authorization, cross-device equivalence tolerance, or publication authorization.
- Trusted external identity, signature, receipt, and immutable-record resolution. TypeScript shape
  validation alone cannot authenticate a caller-supplied attestation.

## 5. Candidate and review sequence

The remaining formal sequence is:

1. Finish source-independent engineering and close automated defects.
2. Put the intended CRRT scope on a dedicated branch and clean commit.
3. Generate the schema-v2 candidate manifest outside the repository and verify all four supplied
   source hashes.
4. Bind every finding and domain review to the exact candidate ID, candidate-manifest digest,
   findings-ledger digest, and domain-scope digest.
5. Complete independent clinical, device, accessibility, privacy, localization, entitlement,
   product, and publication reviews, plus conditional specialty reviews.
6. Resolve all blocking findings and freeze a replacement candidate if consequential bytes change.
7. Record trusted pilot acceptance for the exact four-artifact pilot composition.
8. Record a separate trusted Phase 7 authorization before any Phase 7 learner activation.
9. Complete and accept PrisMax v1 before operational Phase 8 work; then complete Prismaflex and
   cross-device reviews and record a separate Phase 8 authorization.
10. Produce the deployable artifact, repeat exact-candidate browser/accessibility/security checks,
    and obtain separate publication authorization.

Any code or content change after freeze invalidates the affected review evidence and requires a new
candidate identity.

## 6. Critical-care reviewer offer

The repository user stated that they are a critical care physician and can sign off. That can
satisfy the `critical-care` domain only after:

- the exact candidate is frozen;
- the reviewer supplies the preferred name and credentials to appear on the record;
- the exact domain scope and open findings are reviewed;
- the disposition is explicit; and
- the attestation is captured through the trusted review-record boundary.

It does not substitute for nephrology, CRRT nurse education, device-trained review, conditional
pharmacy/nutrition/protocol review, accessibility, or product/release authorization.

## 7. Current engineering validation

- CRRT feature and candidate tooling: 48 suites / 342 tests passed.
- Full repository: 228 suites / 1,575 tests passed.
- TypeScript: passed.
- Lint: zero errors; 13 pre-existing non-CRRT warnings.
- Production build: passed; 516 static pages and both CRRT routes emitted.
- Candidate tooling: all four supplied source hashes verified; current manifest remains provisional
  and is rejected for signing because the working tree is dirty and uncommitted.

## 8. Evidence pointers

- Engineering verification: [engine-validation.md](./engine-validation.md)
- Phase 6 review boundary: [phase-6-status.md](./phase-6-status.md)
- Phase 7 inventory and gate: [phase-7-status.md](./phase-7-status.md)
- Phase 8 inventory and gate: [phase-8-status.md](./phase-8-status.md)
- Candidate procedure: [review-candidate-freeze-procedure.md](./review-candidate-freeze-procedure.md)
- Review packet: [review-packet/README.md](./review-packet/README.md)
- Provisional browser evidence: [browser-qa-evidence-2026-07-17.md](./browser-qa-evidence-2026-07-17.md)
- Risk controls: [risk-register.md](./risk-register.md)

This audit may be updated as engineering changes, but its release decision remains fail-closed until
the exact-candidate evidence above exists.
