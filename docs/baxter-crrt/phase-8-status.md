# Baxter CRRT Phase 8 Prismaflex reviewer-scaffold status

Status: `source-mapped reviewer scaffold implemented; formal Phase 8 activation prerequisites not met`

Learner runtime: Prismaflex unavailable; only PrisMax `CRRT-04`, `CRRT-10`, and `CRRT-13` remain
learner-runnable

Release state: authenticated, unlisted, draft, noindex; Prismaflex artifacts appear only on the
guarded reviewer route

Cross-device equivalence: `not established`; approved outcome tolerance: `null`

## 1. Scope and claim boundary

The repository contains an isolated Prismaflex engineering candidate so reviewers can inspect the
supplied G5036003 Revision 05.2011, program 6.xx mapping before any learner activation. It includes
a device profile, source records, calculation adapter, setup metadata, alarm-category metadata,
original softkey review console, and cross-device composition plan.

It does not represent a locally installed Prismaflex configuration, perform a prime or connection,
execute therapy, assign an engine alarm to a device category, provide a corrective sequence, select
a set or solution, enable anticoagulation, create a learner case, score a learner, write progress,
emit reviewer analytics, award competency, or establish cross-device outcome equivalence.

The supplied manual identifies Gambro Lundia AB as the manufacturer in its front matter. That
source-specific disclosure is kept separate from any later corporate ownership or branding claim.
No copied screen, machine image, logo, figure, or trade dress is used.

## 2. Exact draft identities

| Artifact                        | Draft identity                                                     | Boundary                                                      |
| ------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| Prismaflex device ID            | `prismaflex-g5036003-6xx`                                          | Never substituted for the PrisMax device ID                   |
| Prismaflex profile              | `prismaflex-g5036003-r05-6xx-review-candidate.1`                   | Learner availability deferred; enabled configuration empty    |
| Phase 8 reviewer content        | `0.8.0-prismaflex-review-draft.1`                                  | No learner content or progress identity                       |
| Source document                 | `PRISMAFLEX-G5036003-R05`                                          | G5036003 Revision 05.2011, program 6.xx                       |
| Source SHA-256                  | `6d311624ec075c86ff539d3a86f3ed77cd2ca467346168ee4985af09f0a9224b` | Supplied 287-page PDF identity                                |
| Formula-context conflict        | `CONFLICT-010`                                                     | Unresolved; pump-target and dose-section `Qeff` stay separate |
| Cross-device transfer candidate | `TRANSFER-PRISMAX-PRISMAFLEX-01`                                   | No runtime case, score, result, or tolerance                  |

The exact target market, installed program version, therapies, sets, accessories, solutions,
anticoagulation options, ranges, increments, and local workflows remain unknown.

## 3. Implemented reviewer foundation

| Foundation                                      | Implementation                                      | Current state                                                                    |
| ----------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------- |
| Immutable reviewer profile                      | `content/deviceProfiles.ts`                         | Source identity present; enabled therapies/sets/ranges empty; review pending     |
| `DEV-PF-001` through `DEV-PF-008`               | `content/provenance.ts`                             | Materialized, pending, configuration-limited                                     |
| Independent display calculations                | `engine/deviceAdapters/prismaflexCalculations.ts`   | Reviewer-only and absent from learner graph; learner resolver still throws       |
| Reviewer adapter contract                       | `engine/deviceAdapters/prismaflex.ts`               | Validation always fail-closed; runtime actions throw                             |
| Seventeen source-mapped setup labels            | Prismaflex adapter metadata                         | Browsable only; no setup completion or patient connection                        |
| Warning/Malfunction/Caution/Advisory vocabulary | Prismaflex adapter metadata                         | Taxonomy only; no engine-alarm assignment                                        |
| Original softkey review console                 | `components/PrismaflexReviewerConsole.tsx`          | Keyboard-operable inspection surface; no device action or persistence            |
| Cross-device transfer composition plan          | `content/crossDeviceTransfer.ts` and reviewer UI    | Five review domains; all prerequisites false; equivalence tolerance null         |
| Learner/runtime exclusion                       | initial state, readiness, resolver, progress, tests | Prismaflex remains unavailable to learner sessions, scoring, progress, analytics |

## 4. Calculation boundary

The reviewer calculation candidate keeps device contexts explicit:

| Quantity                    | Source context            | Implementation boundary                                                        |
| --------------------------- | ------------------------- | ------------------------------------------------------------------------------ |
| Effluent-pump target `Qeff` | G5036003 p5:12 / PDF p106 | Includes patient removal, PBP, replacement, dialysate, and syringe terms       |
| Dose-section `Qeff`         | G5036003 p5:19 / PDF p113 | Omits the syringe term as printed; never silently merged with pump target      |
| Displayed TMP               | G5036003 p5:14 / PDF p108 | Raw pressure expression plus documented display correction; not an alarm limit |
| Raw/displayed filter drop   | G5036003 p3:7 / PDF p51   | `Pfil - Pret` retained separately from the display-corrected value             |

The console uses one clearly labeled synthetic arithmetic fixture to make the contextual difference
inspectable. Its values are not clinical targets, normal ranges, alarm thresholds, delivered-dose
claims, or patient recommendations. The printed total-predilution-percent ambiguity and all
therapy/set-specific range logic remain unavailable pending review.

## 5. Setup, alarms, and interface boundary

The reviewer adapter stores the manual-ordered setup labels from Choose Patient through Start
Treatment. Conditional syringe and anticoagulation steps remain visibly conditional. The metadata
does not model an actual set load, solution connection, prime test, patient connection, Run mode,
stop/end branch, recirculation, blood return, or discard workflow.

The four manual alarm categories are exposed as vocabulary only. No generic engine condition is
assigned a Prismaflex category, label, priority, threshold, pump/clamp reaction, correction,
override, restart, or escalation action. Acknowledgement remains distinct from correction throughout
the shared engine and reviewer-drill surfaces.

The softkey console is an independently authored responsive interface. It supports keyboard buttons,
visible focus, 44-pixel controls, text labels in addition to color, reduced-motion behavior, and a
narrow-layout reflow. Formal browser/assistive-technology review remains pending.

## 6. Cross-device transfer boundary

The transfer plan separates five review domains:

1. setup and navigation;
2. prescription and displayed calculations;
3. pressure-pattern translation;
4. fluid-accounting translation; and
5. alarm-language translation.

Each domain identifies a shared clinical/circuit goal, a PrisMax-specific review question, a
Prismaflex-specific review question, and an explicit non-equivalence boundary. It creates no
capstone case or action schedule. The five prerequisites—stable reviewed PrisMax v1, approved target
Prismaflex profile, assigned device reviewers, approved equivalence protocol/tolerance, and reviewed
transfer content—are all `false`.

## 7. Formal activation prerequisites still required

- Freeze and approve the complete PrisMax v1 curriculum, rapid drills, Mastery capstone, and tools.
- Document the exact target Prismaflex market, software, therapies, sets, accessories, solutions,
  anticoagulation options, flow ranges/increments, alarms, and local workflows.
- Assign an independent Prismaflex-trained reviewer and record an exact-version disposition.
- Approve a cross-device canonical-state/action-schedule protocol and numeric outcome tolerances.
- Review every setup, calculation, pressure, alarm, stop/end, and excluded-feature mapping.
- Author and review any intended learner cases, alternatives, unsafe paths, critical errors,
  scoring, reassessment, and debriefs.
- Complete all ten mandatory domains, each bound to the exact candidate ID, candidate-manifest
  SHA-256, canonical findings-ledger SHA-256, and expected domain-specific scope SHA-256:
  `nephrology`, `critical-care`, `crrt-nurse-education`, `prismax-device`, `accessibility`, `localization`,
  `privacy-data-governance`, `entitlement-security`, `product-owner`, and
  `publication-approval`. Phase 8 additionally requires `prismaflex-device` and
  `cross-device-equivalence`.
- Supply a versioned local protocol before any actionable citrate/calcium or anticoagulation path.

The shared Phase 8 conditional-domain set makes the Phase 8-aware activation and publication
resolvers require both `prismaflex-device` and `cross-device-equivalence`. The runtime gate also
requires a separate Phase 8 authorization record bound to the exact candidate/manifest, findings
and scope digests, authenticated receipt metadata, stable PrisMax candidate/manifest, and the
PrisMax activation/publication authorization records. A structurally valid record is not itself
proof that its receipt is authentic; controlled ingestion and independent verification remain
required.

The repository user's self-stated critical-care role can support the critical-care review domain
after a candidate is frozen and their preferred name, credentials, scope, authenticated attestation,
date, and exact-version disposition are recorded. It cannot replace a Prismaflex-trained device
reviewer or any other independent review domain.

## 8. Engineering verification boundary

Focused unit and component tests cover the immutable profile, provenance, distinct calculations,
setup order, alarm taxonomy, fail-closed adapter, console navigation, transfer manifest, transfer
UI, and continued learner exclusion. The latest unfrozen working-tree run on 2026-07-17 recorded:

| Check                                                    | Result                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| CRRT feature plus candidate-manifest tests               | Passed: 48 suites / 342 tests                                                        |
| Focused activation/publication authorization gates       | Passed: 2 suites / 28 tests                                                          |
| Candidate-manifest integrity tooling                     | Passed: 1 suite / 11 tests                                                           |
| Full `npm test -- --runInBand`                           | Passed: 228 suites / 1,575 tests                                                     |
| TypeScript strict check                                  | Passed                                                                               |
| Lint                                                     | Passed with no errors and 13 pre-existing warnings outside CRRT                      |
| Production build                                         | Passed; 516 static pages generated and both CRRT routes emitted                      |
| Scoped Prettier, `git diff --check`, and whitespace scan | Passed                                                                               |
| Authenticated learner/reviewer reflow smoke              | Passed at 320 × 800 and 768 × 1024; full manual accessibility matrix remains pending |

The detailed record is in [engine-validation.md](./engine-validation.md). Manual supported-browser,
full tab-order, assistive-technology, 200% zoom, OS-level reduced-motion, contrast, and
exact-candidate review remain external release gates. The recorded 320 × 800 / 768 × 1024 smoke is
engineering evidence only.

This final run includes the adversarial authorization pass: exact domain-review manifest,
findings-ledger, and per-domain scope bindings; externally resolved stable-PrisMax prerequisites;
distinct authorization references; and exact current learner-release composition. The validators
do not authenticate external receipts or records themselves, so those controlled-system checks
remain mandatory.

The current learner-release composition remains exactly `CRRT-04`, `CRRT-10`, `CRRT-13`, and
`prismax-aw8035-2xx`; no Prismaflex or cross-device artifact is included.

Passing engineering tests does not approve device fidelity, clinical validity, equivalence,
accessibility, learner use, competency, or publication.

## 9. Current disposition

> The Prismaflex source mapping and reviewer interface exist as isolated, non-runnable engineering
> candidates. The learner runtime remains PrisMax-only. Formal Phase 8 activation, cross-device
> equivalence, learner transfer training, competency use, and publication remain unavailable until
> every prerequisite and exact-version review is complete.
