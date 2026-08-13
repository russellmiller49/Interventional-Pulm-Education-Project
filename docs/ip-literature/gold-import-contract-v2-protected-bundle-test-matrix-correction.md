# Protected V2 operator-bundle mutation-matrix correction

This document records a test-infrastructure correction to
`scripts/literature/protected-gold-import-contract-v2-recovery-bundle.test.ts`. It is implementation
evidence only. It does not authorize a real capture, package, import, migration, or compensation
operation, and it changes no runtime or operator semantics.

## Inherited defect

The test `changes for every protected configuration, package, migration, verifier, and source class`
built one protected repository fixture, built the complete operator bundle once as a baseline, and
then iterated ten protected paths. Each iteration mutated its path, rebuilt the complete bundle,
restored the path, and rebuilt the complete bundle again — twenty-one complete
`buildProtectedV2OperatorBundle` constructions inside a single test carrying a fixed 15-second
budget.

Measured on the reviewed base commit `c0c64eec` with instrumentation that was not committed:

| Step                                 | Measured |
| ------------------------------------ | -------- |
| `copyRepositoryFixture`              | ~0.23 s  |
| One `buildProtectedV2OperatorBundle` | ~0.59 s  |
| Baseline build                       | ~0.69 s  |
| Complete ten-path loop (21 builds)   | ~12.76 s |
| Fixture cleanup                      | ~0.03 s  |

Three consecutive unloaded runs of the unmodified test reported 12,396 ms, 12,870 ms, and 12,997 ms
against the 15,000 ms budget — roughly 14–17 % headroom. Re-running the unmodified test under
bounded synthetic CPU load reproduced the inherited failure exactly:
`Exceeded timeout of 15000 ms for a test` at 15,332 ms. The defect is marginal headroom on a
monolithic loop, not a defect in the bundle builder, and it is independent of any concurrent branch.

## Correction

The loop is now ten independently named, sequential parameterized cases. Each case owns an isolated
fixture, one baseline build, one mutation, one changed build, exact byte restoration, one restored
build, and its own disposal. No mutation path was removed, deduplicated, or weakened; the test is
not skipped, retried, or exempted, and no global Jest timeout, worker count, or dependency changed.

A separate structural test asserts by direct set equality that the parameterized inventory is
exactly the ten expected protected source classes, that no path or class is duplicated, and that
every case path lies inside the declared protected boundary — cross-checked against
`PROTECTED_V2_ORDINARY_MIGRATION_INPUTS`, `PROTECTED_V2_PACKAGE_SCRIPT_DECLARATIONS`, and the pinned
V2 migration and verifier filenames rather than against a second copy of the same literal list.

Each case additionally proves that the mutation actually changed the target bytes, that a JSON
target still parses after mutation, that restoration returned the exact original bytes, and — beyond
the aggregate comparison the predecessor made — that
`assertProtectedV2OperatorBundleUnchanged` accepts the restored bundle against the baseline.

### Per-test budget

`PROTECTED_BUNDLE_TEST_TIMEOUT_MS` is 30,000 ms and applies to every test in the file that copies a
fixture or rebuilds the bundle. Measured worst cases: a mutation case (one fixture, three builds)
2.0 s isolated and 6.1 s under full-suite contention; the heaviest sequence test (one fixture, five
builds) 3.1 s isolated and 9.1 s contended. The ceiling is a little over three times the worst
contended measurement. It is a guard against a hung build, not a performance guarantee, and it is
not a disguised increase of the old budget: the old 15 s covered twenty-one builds in one test,
while 30 s now covers at most five.

Jest's implicit 5-second default was never sized for this work either. The two sequence tests that
build the bundle four and five times sat at 3.6 s and 3.9 s against that default on the unmodified
file — the same marginal-headroom defect as the monolith, and they failed bounded full-suite
execution once the monolith no longer dominated the file's runtime. They keep their exact
assertions; only their budget is now derived from measurement. The global Jest timeout, the worker
policy, and `jest.config.cjs` are untouched.

### Fixture lifecycle

Disposal settles every in-flight bundle build for that fixture before unlinking it. A bundle build
spawns Git inside the fixture, so removing the directory underneath a build — which a timed-out or
failed case would otherwise do — races the child process. Disposal is idempotent and forced, runs in
a case-local `finally`, and runs again from the shared `afterEach` if a case is abandoned mid-flight.
Partial fixture setup disposes its own directory before rethrowing.

## Adversarial verification

Each property below was challenged with temporary, uncommitted probes that mirror the committed
lifecycle:

| Probe                                        | Result                                                        |
| -------------------------------------------- | ------------------------------------------------------------- |
| Mutation produces no byte change             | Case fails                                                    |
| Restoration skipped                          | Case fails                                                    |
| Wrong bytes restored                         | Case fails                                                    |
| Target path absent                           | Case fails (`ENOENT`)                                         |
| Bundle build rejects after mutation          | Case fails, fixture removed, later case uncontaminated        |
| Fixture setup fails after partial creation   | Partial directory removed, nothing left in the temp directory |
| Case abandoned mid-build by a 300 ms timeout | Fixture removed, no `ENOTEMPTY`, no open handle               |

Ten consecutive suite runs on the `.nvmrc` runtime left no temporary fixture directory behind, and
`--detectOpenHandles` reported none.

## Observed adjacent risk (not corrected here)

`scripts/literature/generate-gold-import-contract-v2-catalog-expectations.test.ts` carries the same
latent defect class in a file outside this correction's scope: its
`runs exactly two independent captures per profile and writes exact committed proposals` test measures
3.7-4.7 s against Jest's implicit 5-second default. It passed three of three all-Literature runs on
the unmodified base and three of three with this correction applied, but it timed out once at 5,581 ms
during an unrelated contended run. It is not caused by this change and is left untouched under the
strict diff boundary; it is recorded here so the next owner of that file sizes its budget from
measurement rather than rediscovering the failure.

## Protected-boundary consequence

Every tracked file under `scripts/literature` is inside the protected boundary, so changing this
test necessarily changes the operator-bundle identity. That consequence is accepted, not evaded: the
test remains in the protected runtime inventory, no exclusion was added, and no historical authority
or receipt was rewritten.

| Identity                                     | Base `c0c64eec`     | After this change   |
| -------------------------------------------- | ------------------- | ------------------- |
| Operator bundle `aggregateSha256`            | `bd142132…0dab9e57` | `6941cedc…cb75fefa` |
| Operator bundle binding `bindingSha256`      | `a8088bdc…fc236597` | `d05cc0f5…72fb8c6e` |
| Operator bundle `trackedFileInventorySha256` | `519a0abd…d115caaa` | `5ec3acd0…b1cbde54` |
| Operator bundle tracked-file count           | 212                 | 212                 |
| Runtime-input declaration SHA-256            | `0ea0a200…c891b065` | unchanged           |
| Recovery-tool bundle `aggregateSha256`       | `3ac829ae…3da30045` | unchanged           |
| Recovery-tool bundle file count              | 32                  | 32                  |

Only identities derived from protected tracked-file bytes move. The recovery-tool bundle is an
import-closure bundle that contains no test file, so it is byte-identical. The runtime-input
declaration identity is derived from declarations, which are untouched. Package-script declarations,
module resolution, and TypeScript configuration are unchanged.

No additive forward authority is required. `protected-v2-receipt-recovery-amendment-v1.json` and
`protected-v2-finalized-receipt-recovery-authority-v1.json` bind a _historical_ operator bundle
(`967a50a7…`, 167 tracked files) and authenticate it against stored historical intent bytes, never
against the live repository. Current-repository drift is already outside their comparison — the live
bundle had moved from 167 to 212 tracked files before this change — so both artifacts remain
byte-identical and continue to validate. This is the existing, already reviewed forward-compatibility
path, not a new one.
