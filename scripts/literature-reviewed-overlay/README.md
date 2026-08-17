# Literature reviewed-overlay operator

This package prepares the exact physician-reviewed overlay of the 630-record development cohort
onto the dedicated `IP_Literature` production corpus: 283 `include_core`, 75 `include_adjacent`,
272 `exclude` (358 relevant), with enrichment provenance 192 physician-confirmed /
133 physician-modified / 305 QC-accepted, append-only history, and the two checksum-bound note
corrections preserved as lineage.

**Nothing in this package is authorized to mutate production today.** The additive schema
proposal in `schema/reviewed-overlay-proposal.sql` has not been applied to any remote system,
and `apply` fails closed against the current foundation-only production schema even with full
credentials. The representation decision, authority model, production locks, recovery matrix,
and the future owner-authorization template live in
[`docs/ip-literature/reviewed-overlay-v1.md`](../../docs/ip-literature/reviewed-overlay-v1.md).

## Source authorities

- **Cohort membership and persisted heads** — the protected local gold database, read through
  the ingest package's guarded boundary (fixed Docker container, repeatable-read read-only,
  attestation frames, terminal rollback), positively selected as
  `batch.name = 'gold-set-v1' and batch.kind = 'gold_standard' and
item.dataset_split = 'development'`. No complement construct exists in this package.
- **Imported values** — the finalized 630-row V3 artifact, byte-verified against
  `961c19f4…0f59` before parsing, parsed by the protected checksum-then-parse boundary, reduced
  to per-PMID relevance and enrichment provenance. Coordinator-only content never leaves the
  process.

Both authorities must agree exactly; every count must equal its pinned expectation; any
discrepancy stops the operator.

## Commands

Run with the repository's Node 20 toolchain:

```sh
npx tsx scripts/literature-reviewed-overlay/cli.ts validate --artifact /absolute/path/to/final-630.csv
npx tsx scripts/literature-reviewed-overlay/cli.ts dry-run --artifact … [--record-batch-limit 90]
npx tsx scripts/literature-reviewed-overlay/cli.ts apply --artifact … --confirm-production-write
npx tsx scripts/literature-reviewed-overlay/cli.ts apply --artifact … --resume \
  --checkpoint <state>/overlay-<operation>.checkpoint.json \
  [--reconciliation <state>/reconciliation.json] --confirm-production-write
npx tsx scripts/literature-reviewed-overlay/cli.ts reconcile --artifact … --checkpoint …
npx tsx scripts/literature-reviewed-overlay/cli.ts verify --artifact … --checkpoint … [--receipt …]
```

State (checkpoints, receipts, lease) lives in `local-data/literature-reviewed-overlay`
(gitignored; files 0600 inside 0700 directories), overridable with
`LITERATURE_REVIEWED_OVERLAY_STATE_DIR` or `--state-dir`. Terminal output is aggregate-only:
counts, digests, and identities — never a PMID list.

## Environment contract

Destination binding is identical to the ingest operator (all-or-nothing, byte-exact URL,
approved ref only, Endoreels refused, `sb_secret_…` class only, never from argv):

```text
LITERATURE_SUPABASE_URL=https://itcttmkxdxvwmwcmzmey.supabase.co/
LITERATURE_SUPABASE_EXPECTED_PROJECT_REF=itcttmkxdxvwmwcmzmey
LITERATURE_SUPABASE_SECRET_KEY=sb_secret_…
```

A production `apply` additionally requires every one of:

```text
LITERATURE_REVIEWED_OVERLAY_EXPECTED_ARTIFACT_SHA256=<the pinned artifact digest>
LITERATURE_REVIEWED_OVERLAY_EXPECTED_PROJECTION_SHA256=<digest reviewed from validate output>
LITERATURE_REVIEWED_OVERLAY_OWNER_AUTHORIZATION=<the exact authorization sentence>
```

plus `--confirm-production-write`, a remote schema that already carries the reviewed-overlay
proposal, an exclusive checkpoint lease, and the deterministic operation registry row. The
write-ahead checkpoint records `submitted` before every request; an ambiguous acknowledgement
stops the operation until read-only reconciliation proves exact application or exact absence;
there is no automatic retry and no compensating mutation.

## Rehearsal

```sh
npx tsx scripts/literature-reviewed-overlay/rehearse.ts
```

creates a disposable Supabase-image PostgreSQL 17 container (no published port), applies the
foundation migration plus the proposal, seeds a synthetic corpus of exactly 132,350 rows, and
proves the full lifecycle with the real engine: precondition refusals, confirmed-rejection
rollback, lost-acknowledgement reconciliation, completion, corrections lineage, append-only
enforcement, idempotent replay without duplicate history, refusal to resume a completed
operation, and drift detection. The protected real-local database and the real dedicated
project are never contacted.

## Tests

```sh
npx jest --runInBand scripts/literature-reviewed-overlay
```

The suites are self-contained (fixtures are synthetic; no Docker, no network, no protected
source access) and include the adversarial matrix: wrong totals, wrong class or provenance
distributions, duplicate and absent PMIDs, unknown vocabulary, authority disagreement,
correction-lineage loss, checkpoint and receipt integrity, acknowledgement mismatch handling,
credential/PMID redaction guards, and the textual forbidden-construct matrix over every source
file in this package.

## Integration entries

Deliberately not added by this package (adding npm scripts would change the protected bundle's
`package.json` root). The integration lead should add only:

```json
{
  "scripts": {
    "literature:reviewed-overlay": "tsx scripts/literature-reviewed-overlay/cli.ts",
    "literature:reviewed-overlay:rehearse": "tsx scripts/literature-reviewed-overlay/rehearse.ts",
    "literature:reviewed-overlay:test": "jest --runInBand scripts/literature-reviewed-overlay"
  }
}
```
