# Gold import V2 post-migration pre-import capture

Status: implementation contract for `literature-gold-v2-preimport-capture/1.1.0`.

This workflow records the already-applied V2, not-yet-imported real-local boundary. It does not
replace or reinterpret the historical pre-migration collector. It creates evidence; it grants no
import, package-execution, or compensation capability.

## Root cause and correction

The earlier package attempt stopped correctly. Its only available collector,
`diagnose-gold-import-compensation-v2-preapplication.ts`, is intentionally historical: it requires
V1 once, V2 absent, the pre-V2 physical state, and `effectiveStateSha256V2=null`. Real local now has
V1 once, V2 once, and a finalized receipt, so weakening or relabeling that artifact would have
falsified the migration boundary. The correction adds a new post-V2 contract and leaves the
historical collector unchanged; a regression test explicitly proves an applied V2 ledger still
fails its `before_v2` validator.

The production V2 rehearsal also authenticated a literal historical PR branch. The correction
separates a branch-agnostic disposable core from a production wrapper that requires the exact
primary checkout on clean attached `main` with `HEAD == origin/main`, before source/backup reads and
again after rehearsal. There is no production feature-branch override.

A related coupling placed `package.json` in the historical recovery runtime bundle. Adding the new
npm command therefore changes today's runtime even though the finalized historical receipt bytes
must remain immutable. Downstream receipt verification now authenticates the exact committed
incident, amendment, receipt-authority, result, manifest, and execution-receipt bytes without
rebuilding today's recovery bundle. The historical recovery executor itself keeps the strict
current-runtime check and is not rerun.

## Authorization boundaries

The gold-import sequence has ten distinct boundaries. An artifact at one boundary never
substitutes for an artifact or authorization at a later boundary.

1. **Finalized V2 migration receipt.** The reconciled receipt proves V1 and V2 each occurred once and
   records zero migration re-execution, import, and compensation. Migration completion does not
   authorize package execution or import.
2. **Post-V2 capture instance 1.** One fresh command records one independently bracketed
   trusted-operator observation.
3. **Post-V2 capture instance 2.** A separate command records a distinct path, UUID, nonce,
   execution receipt, capture identity, and publication bracket for the same state.
4. **Capture-pair verification.** The verifier requires exactly those two current, distinct,
   agreeing capture instances.
5. **Current package-readiness validation.** The generator independently reobserves the fixed-local
   database and target after loading both captures.
6. **Unsigned package generation.** The generator may consume the verified capture pair and emit a
   deterministic, non-executable authorization template. Package generation does not authorize
   import.
7. **Package rehearsal.** Disposable-only execution proves deterministic package behavior without
   authorizing or mutating real local.
8. **Separately signed import authorization.** A later, explicit, checksum-bound operator authorization is
   required before import. It does not authorize compensation.
9. **Import execution.** The separately authorized importer is the only import mutation boundary.
10. **Separate compensation authorization.** Compensation requires a committed import receipt and
    its own later authorization; no prior artifact grants it.

## Production capture command

After this change is merged, run only from the exact primary checkout on clean attached `main` with
`HEAD == origin/main`:

```bash
npm run literature:capture-gold-import-v2-preimport-state
npm run literature:capture-gold-import-v2-preimport-state
```

The production command has no target, branch, database URL, split, PMID, or output-path override.
It observes Docker context `default` at `unix:///var/run/docker.sock`, the independently reviewed
container continuity ID
`906d62f9e2b5ac7c58742090566e87f8d2a36199ee897b09bb5c1b7727e286a8` and in-container hostname
`906d62f9e2b5`, container name, health/restart/start state, image reference/ID/manifest,
Compose and Supabase project labels, network, and published `55322 -> 5432` bindings before and
after database collection. The database query runs by Unix socket `/var/run/postgresql` on internal
port `5432` inside that exact named container and observes `current_database()`, users, transaction
mode, socket configuration, address/port nullness, configured port, and postmaster start time. The
Docker and database start identities must agree. A remote Docker context, TCP transport, linked
project, wrong container/image/label/network/database/port/socket, replacement, restart, or stale
inspection fails closed.

`local_supabase_postgres_owner_v1` is explicitly classified as expected configuration rather than
an observed server property. It becomes usable only when the combined readiness artifact also
authenticates the exact committed local catalog identity. Expected constants never substitute for
the Docker/database observations, and callers cannot supply any target fact or Docker/psql argument.
Every SQL batch is fixed repeatable-read/read-only and rolled back. The collector never constructs a
Supabase client or another write-capable database client.

Every persisted target identity recomputes its canonical content hash. Nested observations rerun the
same semantic ordering, lifecycle, and identity checks, and downstream boundaries compare complete
derived identity content instead of trusting a supplied identity hash.

Do not create the real captures from a feature branch or implementation PR. The real package must
be generated only after this workflow is merged into clean primary `main` and two new captures have
been created there.

## Shared readiness state

`literature-gold-v2-package-readiness/1.1.0` is the single deterministic state contract shared by
the capture verifier and downstream package workflow. It requires:

- exact primary-main repository evidence;
- exact V1 and V2 filenames, names, versions, hashes, and occurrence `1`;
- the exact finalized receipt and committed receipt authority;
- `receiptReconciled=true`, no migration re-execution, and zero migration staging/application calls;
- the accepted membership, V1/V2 effective, V1/V2 physical, planning, history, event, review,
  pointer, and reveal identities;
- the exact complete local-profile catalog audit and package-source authorities;
- operations/actions/imports/compensations `0/0/0/0` and zero protected/source mutation;
- `importAuthorized=false`, `compensationAuthorized=false`, no held-out access, no remote access,
  and no write-capable client.

The downstream finalized-receipt loader authenticates the committed historical amendment and
receipt-authority bytes as immutable historical authority. It deliberately does not rebuild the
current recovery-tool bundle. The recovery command itself retains its stricter current-runtime
binding. This separation allows the capture/package runtime to evolve without rewriting or
re-sealing the historical migration receipt.

## Redundant trusted-operator captures

The pair contract uses `trusted-local-operator-redundant-captures/1.0.0`. These are redundant local
operator observations, not independent trust roots. Each accepted directory contains exactly
canonical state JSON, a database-publication bracket, its checksum manifest, and an execution
receipt; the capture root also holds an exclusive instance-marker file. A hidden staging directory
is not accepted as a capture.

Pair verification requires exactly two fresh captures with:

- equal canonical database-state and package-readiness identities;
- the current repository HEAD and capture-runtime bundle;
- capture timestamps after finalized-receipt finalization and no more than two hours old;
- distinct canonical realpaths, capture UUIDs, nonces, capture identities, execution-receipt
  identities, receipt byte hashes, bracket identities, and bracket byte hashes;
- exact finalized-receipt authority, local database target/profile, source authorities, catalog,
  zero-mutation assertions, and no-held-out/no-remote assertions.

Symlinks, realpath aliases, copied directories, reserialized/noncanonical JSON, a single capture,
V2-absent or duplicated ledgers, stale receipt/HEAD/runtime, state disagreement, and any
authorization or protected-state drift fail closed.

## Package and rehearsal boundary

The package generator and exact disposable rehearsal have no feature-branch bypass. Their
production orchestration functions, writers, and capability interfaces are private. Exported
surfaces are pure validators/data or the disposable-only package generator. Direct production
entrypoints require the exact primary checkout, attached `main`, clean tracked and
nonignored-untracked state, and `HEAD == origin/main`.

The package generator authenticates the current capture runtime, verified pair, immutable finalized
receipt, and a fresh fixed-target read-only database observation before source reads. It stages all
slow source-derived output, then independently reobserves the database/target and reloads the
repository, receipt, runtime, and both captures before one same-parent rename publishes the package.

The exact rehearsal separately proves the deterministic package/import/lost-ack/idempotency/
compensation paths in owned disposable containers. Its production wrapper first authenticates the
same capture-pair readiness and fresh read-only real-local state, binds their identities into the
rehearsal report, and rechecks them after all disposable runs before output. The rehearsal never
mutates real local; its only real-local access is the fixed repeatable-read/read-only collector.

Generated authorization is explicitly unsigned and non-executable. Its safety fields remain
`importAuthorized=false`, `compensationAuthorized=false`, `packageExecutionAuthorized=false`, and
`databaseMutationCount=0` until a separate later authorization boundary is satisfied.

## Database publication bracket

Capture, production package generation, and production rehearsal use the same protocol: initial
repeatable-read/read-only observation, complete hidden staging, final repeatable-read/read-only
observation, exact state/target/invariant equality, bracket finalization, and one same-filesystem
rename. The bracket binds both full observations, timestamps and ordering, V1/V2 occurrence `1/1`,
finalized receipt authority, all accepted state identities, operation/action/import/compensation
counts `0/0/0/0`, staged-payload identity, and the requirement that every later consumer reobserve
the database. Drift discards the staging directory and leaves no accepted final directory.

The deterministic adversarial suite changes state at eight distinct lifecycle points. Drift after
capture publication and between capture loads is rejected by the later-consumer gate before staging;
construction/staging and pre-final-observation drift is rejected by the final bracket.

There is no claim of impossible cross-system atomicity: a database commit after the final read-only
observation and before the rename cannot be excluded without a database/filesystem lock spanning
both systems. Independent reobservation by the next lifecycle consumer closes that residual window.

## Exact compatibility and backup authority

The reviewed current tuple is capture/capture-pair/readiness/generation-readiness `1.1`, package
generator `2.0`, package `1.0`, exact rehearsal `2.1`, finalized receipt `1.0`, and current delivery
backup `literature-gold-v2-postmigration-delivery-backup/1.0.0`. Version-specific strict parsers
reject arbitrary `2.x`, future, missing, relabeled, field-changed, or unknown-field evidence.

The former `gold-import-contract-v2-forward-repair-backup/2.0.0` and exact rehearsal `2.0` tuple is
preserved only as explicitly historical PR #95 evidence. It cannot satisfy current readiness. The
current backup command is `literature:backup-gold-import-v2-postmigration-delivery`; it binds the PR
#97 branch/base/pushed HEAD, every changed tracked file, the full current runtime closure and source
bytes, exact finalized-receipt authority, target-observation contract, compatibility matrix, and
the complete named review/test evidence inventory. Missing, unexpected, or modified source bytes
fail verification.
