# Protected V2 historical receipt-recovery amendment

## Scope

This amendment authorizes receipt finalization for exactly one sealed historical intent:
`deeedb1e93921d0e0e8a01009a6a1ed5c67114f53f94ea5cac277d99f113d8f4`. It does not
authorize migration staging or application, import, compensation, or clinical-state mutation.

The defect identifier is
`protected_v2_schema_sensitive_physical_equality_finalization_defect_v1`. The only permitted
transition reason is `schema_derived_v1_physical_projection_transition` under shared transition
policy identity `a9ae3ef19b305a529df08c6acd8e07d9126fc2c3a34d2414c1b8473a248624f5`.

## Authority split

`buildProtectedV2ReceiptRecoveryIncidentAmendment` binds three separately reviewed authorities:

1. The exact historical intent, authorization, repository tree, two captures, source files,
   expected catalog, and pre/post incident identities copied into the checksum-verified incident
   backup.
2. The shared schema-only transition policy by semantic policy identity and reason code.
3. A narrow current recovery-tool bundle with a sorted per-file SHA-256 inventory.

The current recovery-tool bundle must include every executable recovery-specific file, including
the amendment module, recovery core, CLI entry point, and any executable helper added during
integration. The final amendment identity is computed only after that complete inventory is known
and becomes an explicit operator confirmation. Changing any bundle file changes the amendment
identity and cannot reuse the reviewed confirmation.

## Execution boundary

`recoverProtectedV2HistoricalReceipt` accepts one dependency only:
`validateSchemaOnlyTransition`. Its dependency object rejects extra properties and has no migration,
import, or compensation callbacks. It authenticates all historical/current evidence before calling
the shared validator.

The workflow atomically renames a complete four-file `finalized/` subpackage into place. It never
rewrites the original three intent files. A preexisting exact package is verified without a write;
partial or contradictory finalization fails closed. A concurrent rename loser must verify that the
winner wrote byte-identical authorized output.

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
