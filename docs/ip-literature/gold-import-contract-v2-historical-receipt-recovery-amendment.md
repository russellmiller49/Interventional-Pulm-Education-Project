# Protected V2 historical receipt-recovery amendment

## Scope

This amendment authorizes receipt finalization for exactly one sealed historical intent:
`deeedb1e93921d0e0e8a01009a6a1ed5c67114f53f94ea5cac277d99f113d8f4`. It does not
authorize migration staging or application, import, compensation, or clinical-state mutation.

The defect identifier is
`protected_v2_schema_sensitive_physical_equality_finalization_defect_v1`. The only permitted
transition reason is `schema_derived_v1_physical_projection_transition` under shared transition
policy identity exported by the reviewed shared validator. The complete committed amendment records
that exact identity; this specification deliberately does not duplicate a changeable identity.

## Authority split

The recovery runtime binds three separately reviewed authorities:

1. The exact historical intent, authorization, repository tree, two captures, source files,
   expected catalog, and pre/post incident identities copied into the checksum-verified incident
   backup.
2. The shared schema-only transition policy by semantic policy identity and reason code.
3. A narrow current recovery-tool bundle with a sorted per-file SHA-256 inventory.

The current recovery-tool bundle must include every executable recovery-specific file, including
the amendment module, recovery core, CLI entry point, read-only adapter, maintainer finalizer,
shared policy/history modules, and every transitive executable helper added during integration. It
also seals `package.json`, `package-lock.json`, `tsconfig.json`, and
`scripts/require-primary-checkout.mjs`. A static-closure audit rejects an omitted dependency,
untracked shadow, unsafe Git mode, or changed package command.

Two JSON contracts avoid self-reference:

- `protected-v2-receipt-recovery-incident-authority-v1.json` records immutable facts for this one
  incident, but is not itself the amendment.
- `protected-v2-receipt-recovery-amendment-v1.json` is generated only after integration is final
  and contains the policy identity, complete sorted per-file recovery bundle, and its amendment
  identity. The amendment file is excluded from its own bundle and is independently authenticated.

The maintainer first runs the amendment finalizer with `--print-candidate`, reviews the candidate,
then may create the full contract only with `--write --expected-amendment-sha256 <exact-sha>`. It
never overwrites an amendment. The recovery command independently requires the same externally
supplied `--expected-amendment-sha256`; changing any policy or bundle byte invalidates both the
committed amendment comparison and that confirmation.

## Execution boundary

`recoverProtectedV2HistoricalReceipt` accepts one dependency only: `validateSchemaOnlyTransition`.
The outer command accepts one dependency only: `collectReadOnlyEvidence`. Both dependency objects
reject extra properties and expose no migration, import, or compensation callbacks. The command is
fixed to the primary checkout, clean `main` at exact `origin/main`, the one historical intent/output
path, the two exact captures, the checksum-verified incident backup, and the one local container.
It accepts no target or path argument.

Every database query batch must begin `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, contain
only nonlocking `SELECT`/CTE statements, and end `ROLLBACK`. The evidence boundary reports and the
runtime verifies zero migration-stage, migration-application, import, compensation, and database
mutation calls. Remote Docker/database access and held-out identity access are rejected.

The workflow atomically renames a complete four-file `finalized/` subpackage into place. It never
rewrites the original three intent files. A preexisting exact package is verified without a write;
partial or contradictory finalization fails closed. A concurrent rename loser must verify that the
winner wrote byte-identical authorized output. A repeated command reports that finalized evidence
was present, reloads and verifies it, and does not invoke transition validation or rewrite bytes.

The command snapshots the original intent, both captures, and incident evidence before collection
and reauthenticates them in a `finally` boundary after success or failure. Its only permitted write
is the atomic four-file `finalized/` receipt package. Implementation and review sessions must not
execute this command against real-local data.

## Downstream gate

Package/import integration should call `loadProtectedV2FinalizedReceiptRecovery` with the exact
amendment, original-intent, and recovery-bundle identities, then call
`assertProtectedV2FinalizedRecoveryReceiptGate`. The gate returns only:

```text
migrationReceiptComplete=true
importAuthorized=false
compensationAuthorized=false
```

A recovered migration receipt is therefore necessary migration evidence but is never import or
compensation authorization.
