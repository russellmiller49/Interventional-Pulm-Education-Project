# Gold import V2 post-migration pre-import capture

Status: implementation contract for `literature-gold-v2-preimport-capture/1.0.0`.

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

The gold-import sequence has eight distinct boundaries. An artifact at one boundary never
substitutes for an artifact or authorization at a later boundary.

1. **Historical pre-migration captures.** The two protected backup captures prove V1 exactly once,
   V2 absent, the pre-V2 physical state, and a null V2 effective identity. They remain immutable
   historical evidence.
2. **Protected migration application captures.** The sealed intent, explicit operator
   authorization, and application evidence authorized only the one-time V2 schema migration.
3. **Finalized migration receipt.** The reconciled receipt proves V1 and V2 each occurred once and
   records zero migration re-execution, import, and compensation. Migration completion does not
   authorize package execution or import.
4. **Post-V2 pre-import captures.** Two fresh executions of the command below independently record
   the same canonical current database content while retaining distinct paths, UUIDs, random
   nonces, execution receipts, and capture identities.
5. **Unsigned package generation.** The generator may consume the verified capture pair and emit a
   deterministic, non-executable authorization template. Package generation does not authorize
   import.
6. **Signed import authorization.** A later, explicit, checksum-bound operator authorization is
   required before import. It does not authorize compensation.
7. **Import execution.** The separately authorized importer is the only import mutation boundary.
8. **Compensation authorization and execution.** Compensation requires its own later authorization
   and command. Neither a complete migration receipt nor import authorization grants it.

## Production capture command

After this change is merged, run only from the exact primary checkout on clean attached `main` with
`HEAD == origin/main`:

```bash
npm run literature:capture-gold-import-v2-preimport-state
npm run literature:capture-gold-import-v2-preimport-state
```

The production command has no target, branch, database URL, split, PMID, or output-path override.
It pins Docker context `default`, container `supabase_db_ip-literature-local`, database `postgres`,
host `127.0.0.1`, port `55322`, project `ip-literature-local`, and profile
`local_supabase_postgres_owner_v1`. Its SQL is a fixed repeatable-read/read-only collector. It never
constructs a Supabase client or another write-capable database client.

Do not create the real captures from a feature branch or implementation PR. The real package must
be generated only after this workflow is merged into clean primary `main` and two new captures have
been created there.

## Shared readiness state

`literature-gold-v2-package-readiness/1.0.0` is the single deterministic state contract shared by
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
operator observations, not independent trust roots. Each directory contains canonical state JSON,
its checksum manifest, and an execution receipt; the capture root also holds an exclusive
instance-marker file.

Pair verification requires exactly two fresh captures with:

- equal canonical database-state and package-readiness identities;
- the current repository HEAD and capture-runtime bundle;
- capture timestamps after finalized-receipt finalization and no more than two hours old;
- distinct canonical realpaths, capture UUIDs, nonces, capture identities, execution-receipt
  identities, and receipt byte hashes;
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
receipt, and a fresh fixed-target read-only database observation before source reads. It repeats
those checks before output.

The exact rehearsal separately proves the deterministic package/import/lost-ack/idempotency/
compensation paths in owned disposable containers. Its production wrapper first authenticates the
same capture-pair readiness and fresh read-only real-local state, binds their identities into the
rehearsal report, and rechecks them after all disposable runs before output. The rehearsal never
mutates real local; its only real-local access is the fixed repeatable-read/read-only collector.

Generated authorization is explicitly unsigned and non-executable. Its safety fields remain
`importAuthorized=false`, `compensationAuthorized=false`, `packageExecutionAuthorized=false`, and
`databaseMutationCount=0` until a separate later authorization boundary is satisfied.
