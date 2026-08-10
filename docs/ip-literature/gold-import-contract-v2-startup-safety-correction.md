# Draft PR #90 protected-V2 startup safety correction

## Confirmed defect

Starting HEAD `014359f8fe0b32046d137ecc027996cd2f6cb6f4` placed
`20260809231651_add_literature_gold_import_compensation_contract_v2.sql` in the unconditional
`MIGRATIONS` array in `scripts/literature/local-supabase.ts`. `prepareWorkdir()` copied every array
entry into `local-data/literature/supabase-local/supabase/migrations`; ordinary start then invoked
`supabase start` followed by `supabase migration up --local`. With real-local V2 ledger occurrence
zero, both first-start initialization and migration-up could therefore see and apply the protected
migration without the separately authorized operator sequence.

The hermetic regression test `scripts/literature/local-supabase-protected-v2.test.ts` reproduces that
starting behavior using temporary directories and a fake command list. It proves the protected file
was present and ordinary migration-up was scheduled while the modeled ledger occurrence was zero.
It does not contact Docker or a database.

## Correction

The changed lifecycle implementation separates:

- `ORDINARY_LITERATURE_MIGRATIONS`, ending at exact V1;
- `PROTECTED_FORWARD_LITERATURE_MIGRATIONS`, containing exact V2; and
- the protected V2 identity tuple—filename, ID, ledger version/name, and SHA-256—in
  `scripts/literature/protected-gold-import-contract-v2.ts`.

Routine preparation excludes V2 and disarms an exact ignored generated copy. Start exposes only the
ordinary inventory to first-start, reads the protected ledger through a repeatable-read/read-only
local-container query, and exposes V2 to later migration-up only when the exact ledger row already
exists. Status is observational. Stop does not prepare. Reset stays at V1 and is refused after V2.
Duplicates, wrong version/name pairs, source/generated checksum drift, and unexpected generated SQL
fail closed.

The dedicated command `literature:apply-protected-gold-import-contract-v2` is dry-run/read-only by
default. Commit mode requires primary clean main at exact origin/main, exact local target, V1 once,
V2 absent, accepted hashes, two fresh checksum-verified redundant backup captures,
exact confirmation, and a checksum-bound migration-only authorization. The corrected contract calls
these two separately executed redundant captures under trust model
`trusted-local-operator-redundant-captures/1.0.0`; commit mode requires the exact operator
attestation `I ATTEST THESE ARE TWO SEPARATE READ-ONLY BACKUP CAPTURES`. Local unkeyed receipts and
duplicate markers protect against accidental mistakes and stale/incomplete captures, but are not a
separate trust root against the trusted filesystem/Docker-owning operator.

Before staging the command persists an immutable application-intent package with a deterministic
transitive protected-operator bundle. It reuses the project-pinned Supabase migration-up path
exactly once and finalizes only after exact schema/state and a complete read-only catalog audit of
columns, constraints, indexes, triggers, RLS/policies, table privileges, functions/RPCs/ACLs, and
dependencies. The verifier source remains pinned but is not executed real-locally; the receipt says
`verifierExecuted=false`. Lost-ack reconciliation makes zero migration calls and may run from a
later clean current-main descendant only if the intent commit remains an ancestor and the sealed
operator bundle is unchanged. It cannot authorize import or compensation.

See
[`gold-import-contract-v2-protected-application-runbook.md`](./gold-import-contract-v2-protected-application-runbook.md)
for the state matrix and exact future operator sequence.

## Preserved boundaries

- V1 migration bytes are unchanged and V1 is not rerun by this correction.
- V2 migration and verifier bytes are unchanged.
- V2 remains unapplied to real local.
- No real import or compensation is authorized or executed.
- No review, pointer, reveal timestamp, or effective decision is changed.
- No held-out identity or remote database is accessed.
- The generated-workdir hygiene manages only ignored copies, never repository migrations.
