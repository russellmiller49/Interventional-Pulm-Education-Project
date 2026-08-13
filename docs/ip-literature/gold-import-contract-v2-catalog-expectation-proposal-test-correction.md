# Protected V2 catalog-expectation proposal-test correction

This document records a test-infrastructure correction to
`scripts/literature/generate-gold-import-contract-v2-catalog-expectations.test.ts`. It is
implementation evidence only. It does not authorize a real capture, package, import, migration, or
compensation operation, and it changes no runtime, generator, or catalog-contract semantics.

## Inherited defect

`runs exactly two independent captures per profile and writes exact committed proposals` drives one
complete `generateProtectedV2CatalogExpectationProposals` pass — the intentionally atomic maintainer
operation over both authorized profiles — against Jest's implicit 5-second default. The
[protected-bundle matrix correction](gold-import-contract-v2-protected-bundle-test-matrix-correction.md)
recorded this file as the same latent defect class, measured at 3.7–4.7 s with one contended
timeout at 5,581 ms, and left it untouched under that change's strict diff boundary.

Reproduced and profiled on base `40a07db3` (newest `main`, containing the PR #101 and PR #99
reviewed heads) with the `.nvmrc` runtime (Node 20.20.2):

| Condition                                          | Affected test                                                                  | `rejects nondeterministic` |
| -------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------- |
| Alone, `--runInBand`, ~5–6 load (6 runs)           | 2,013–2,114 ms                                                                 | 627–668 ms                 |
| Alone under 16 synthetic CPU spinners (3 runs)     | 2,545–2,665 ms                                                                 | 816–902 ms                 |
| Inside all-Literature, default workers             | 2,628 ms                                                                       | 823 ms                     |
| Alone while the full repository suite ran (3 runs) | 4,784–5,538 ms; **2 of 3 exceeded 5,000 ms**                                   | 1,360–1,604 ms             |
| Full repository suite itself, default workers      | **failed: `Exceeded timeout of 5000 ms`** — the only failure among 8,072 tests | passed                     |

Uncommitted stage instrumentation attributed the cost to the real production path, not to waste:
four complete `buildProtectedV2CatalogExpectedArtifact` constructions (canonical clone, level-9
deflate, exact self-reparse) at ~230–250 ms each, plus two committed-artifact comparisons at
~245–250 ms each, over the two ~540 KB committed inventories; captures, canonical determinism
compares, output writes, and cleanup total under 60 ms. Unlike the PR #101 monolith there is no
duplicated work to remove: one generator pass is exactly the four-observation contract
(`freshDisposableRunCount=4`), and the CLI help text pins that atomicity. Splitting the test would
either run the atomic production operation twice for no coverage gain or replace the production
generator path with a mock, both prohibited. The correct narrow fix is a measured local budget.

The test also leaked its temporary output root on every run — success or failure — as did the two
neighbouring temp-root tests: 195 accumulated `protected-v2-catalog-{generator,drift,pins}-*`
directories were present in the OS temp directory before this correction, the oldest predating this
branch.

## Correction

- `CATALOG_GENERATOR_TEST_TIMEOUT_MS = 20_000` applies to exactly the two tests that execute real
  generator proposal work: the affected test (four builds and two committed comparisons) and
  `rejects nondeterministic repeated observations` (two builds up to the determinism rejection).
  The worst recorded contended evidence is a truncated 5,538–5,581 ms — a lower bound, because the
  5 s budget killed the run — so the natural contended worst is estimated at ~6.5 s; the ceiling is
  about three times that estimate, ~3.6× the truncated observation, and ~9.8× the unloaded
  duration, consistent with the sibling file's reviewed 30 s ceiling for five-build tests. It is a
  hung-operation guard, not a performance guarantee. The fast sentinel, rejection, environment, and
  source-inspection tests stay on the implicit default, and the global Jest timeout, worker policy,
  `jest.config.cjs`, and dependencies are untouched.
- Every temp-root test now runs inside `withGeneratorOutputRoot`, which removes its root in a
  `finally` that can only run after the test's generator promise has settled (all generator output
  writes are synchronous), registers cleanup completion even when a timed-out case settles late,
  and an `afterAll` regression guard waits for every registered cleanup and proves no root
  survived. Ten consecutive suite runs leave zero temp directories; `--detectOpenHandles` reports
  none.
- Independence and coverage assertions were strengthened without inventing observation fields: the
  four captured observations must be four distinct objects; the returned per-profile identities
  must equal the committed artifacts' exact `artifactContentSha256`/`fullAuditIdentitySha256`; the
  three proposal files must exist before cleanup; and a fast structural test pins
  `PROTECTED_V2_EXPECTED_CATALOG_PROFILE_IDS` — the production declaration the generator iterates —
  to exactly the two authorized profiles with no omission, duplication, or reordering.

Every preexisting assertion is preserved: the exact capture sequence
`[local, local, admin, admin]`, `committedExpectationsExact === true`, sentinel reference handling,
AggregateError cleanup handling, local-owner projection scope, nondeterministic observation
rejection, runtime-byte pinning, production dependency-injection rejection, inherited
target-environment rejection, and readiness never importing the maintainer generator.

## Adversarial verification

Each property was challenged with temporary, uncommitted probes (test-file, production-file, or
runtime-byte mutations), each restored to exact pristine bytes and leaving zero temp roots:

| Probe                                                                                   | Result                                                                              |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Both observations returned as one memoized object                                       | Fails on the distinct-observation set assertion                                     |
| Generator reuses observation 1 as observation 2 (production mutation)                   | Fails on the exact capture sequence                                                 |
| Profile omitted / duplicated / swapped in the production declaration                    | Structural inventory test and affected test both fail                               |
| Local observation substituted when the disposable profile is requested (and vice versa) | Generator rejects `inconsistent profiles`                                           |
| Second local observation drifts                                                         | Generator rejects `were not byte-identical`                                         |
| Both local observations identically drifted (self-consistent target)                    | Fails on committed-expectation exactness — a drifted target cannot authorize itself |
| Migration or verifier bytes changed on disk                                             | Generator refuses unpinned bytes before any capture                                 |
| Output path pre-occupied after temp-root creation                                       | Exclusive creation fails `EEXIST`; root fully removed                               |
| Capture fails after the local profile completes                                         | Rejection surfaces; no partial proposal survives cleanup                            |
| Case abandoned at a 50 ms probe timeout mid-generator                                   | Late cleanup settles, `afterAll` guard passes, zero leaked roots, no open handles   |

A mid-publication `writeExclusiveOutputFiles` spy probe is not constructible — the transpiled module
exports are non-configurable — so that failure class is covered by the pre-occupied-output and
mid-run-capture-failure probes.

## Protected-boundary consequence

Every tracked file under `scripts/literature` is inside the protected boundary, so this test change
necessarily moves the operator-bundle identity. That consequence is accepted, not evaded: the test
remains in the protected runtime inventory, no exclusion was added, and no historical authority or
receipt was rewritten.

| Identity                                     | Base `40a07db3`     | After this change    |
| -------------------------------------------- | ------------------- | -------------------- |
| Operator bundle `aggregateSha256`            | `6941cedc…cb75fefa` | `46158c46…156ba986`  |
| Operator bundle binding `bindingSha256`      | `d05cc0f5…72fb8c6e` | `350c2edf…35d3fb3a`  |
| Operator bundle `trackedFileInventorySha256` | `5ec3acd0…b1cbde54` | `03fb7b73…9645296e`  |
| Operator bundle tracked-file count           | 212                 | 212                  |
| Runtime-input declaration SHA-256            | `0ea0a200…c891b065` | unchanged            |
| Recovery-tool bundle `aggregateSha256`       | `3ac829ae…3da30045` | unchanged (32 files) |

Compatibility outcome: **Outcome A — existing reviewed forward compatibility applies.** The
justification is the committed authority semantics, not the file's test status:
`protected-v2-receipt-recovery-amendment-v1.json` and
`protected-v2-finalized-receipt-recovery-authority-v1.json` bind the historical operator bundle
(`967a50a7…`, 167 tracked files) and authenticate it against stored intent bytes in the
checksum-verified incident backup, never against the live repository, which had already moved to
212 tracked files before this change; the PR #97 release freeze and release verification pin
exact historical branch/base/head and archived runtime bytes in external artifacts; and the
reconciliation path compares a recovery HEAD only against the bundle sealed inside a specific
application intent, of which none is outstanding. With the change applied, the protected battery —
gate, recovery bundle, runtime inputs, receipt-recovery core/runtime/adapters, module resolution,
catalog audit, committed catalog expectations, this generator suite, PR #97 release freeze and
verification, current postmigration-backup authority, and the operator application suite — passes
15 suites, 300/300 tests. No additive forward authority is required and no historical artifact
changed by a byte.

## Existing package status

The previously reviewed unsigned package is historical reference evidence only: `main` has moved
past the state it binds, and this correction moves the operator bundle again. It must not be made
executable. After this repair merges, the future V2 operator workflow must create two new post-V2
captures, a new unsigned package, a new independent package review, and a new one-time operation
authorization; no capture, package, import, compensation, database, or remote operation was
performed in this implementation session.
