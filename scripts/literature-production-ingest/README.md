# Literature production ingestion operator

This package is the production operator for moving bibliography-only records from the fixed local
`IP_Literature` source into the dedicated remote `IP_Literature` project. It never reads cohort,
review, label, taxonomy-decision, held-out, or V2-content relations. It never publishes an article.

Run it directly until the integration lead adds the package scripts:

```sh
node --import tsx scripts/literature-production-ingest/cli.ts --help
```

## Environment contract

The destination binding is all-or-nothing and accepts no legacy, generic, CLI-supplied, JWT,
publishable, or anonymous credentials:

```text
LITERATURE_SUPABASE_URL=https://itcttmkxdxvwmwcmzmey.supabase.co/
LITERATURE_SUPABASE_EXPECTED_PROJECT_REF=itcttmkxdxvwmwcmzmey
LITERATURE_SUPABASE_SECRET_KEY=sb_secret_...
```

The opaque secret is sent only in the `apikey` header and is never logged or persisted. The URL is
byte-exact; arbitrary hosts and the Endoreels project are refused.

Every canary manifest read requires its owner-approved manifest pin. Full mutation, resume,
reconciliation, and verification require both owner-approved full-source pins; full validation and
dry-run may run without them so an owner can review the resulting count and digest:

```text
# Canary operations
LITERATURE_CANARY_MANIFEST_SHA256=<64 lowercase hex characters>

# Full operations
LITERATURE_FULL_EXPECTED_RECORD_COUNT=<owner-approved exact integer>
LITERATURE_FULL_EXPECTED_SOURCE_SHA256=<owner-approved 64-character projection digest>
```

Optional local-only settings are:

```text
LITERATURE_CANARY_MANIFEST_PATH=/absolute/path/to/authorized-canary-manifest.json
LITERATURE_INGEST_STATE_DIR=/absolute/path/to/durable/operator-state
```

The state directory defaults to `local-data/literature-production-ingest`. Use one durable state
directory for the operation lifetime. Never pass credentials or destination identifiers in process
arguments.

## Commands

```sh
# Validate a frozen, authority-pinned canary without destination writes.
node --import tsx scripts/literature-production-ingest/cli.ts \
  validate --mode canary --manifest /secure/authorized-canary-manifest.json

# Inspect the full source projection without destination writes. The output count and digest are
# the values an owner reviews before setting the two full authority pins.
node --import tsx scripts/literature-production-ingest/cli.ts validate --mode full

# Build a proposed manifest from an owner-provided, bibliography-only 630-row candidate file.
# This does not query any cohort relation. Owner review and the checksum environment pin are still
# required before the manifest is accepted by a canary operation.
node --import tsx scripts/literature-production-ingest/cli.ts \
  validate --candidate-file /secure/development-candidates.json \
  --manifest-out /secure/authorized-canary-manifest.json --seed aabip-monday-v1

# Produce an immutable local dry-run receipt; no destination request is made.
node --import tsx scripts/literature-production-ingest/cli.ts \
  dry-run --mode canary --manifest /secure/authorized-canary-manifest.json
node --import tsx scripts/literature-production-ingest/cli.ts dry-run --mode full

# Mutating commands require an explicit confirmation flag.
node --import tsx scripts/literature-production-ingest/cli.ts \
  canary --manifest /secure/authorized-canary-manifest.json --confirm-production-write
node --import tsx scripts/literature-production-ingest/cli.ts \
  full --confirm-production-write

# Observe every submitted/ambiguous stage with GET/HEAD requests only.
node --import tsx scripts/literature-production-ingest/cli.ts \
  reconcile --checkpoint /state/full-<operation-id>.checkpoint.json

# Continue only after an exact reconciliation receipt, or omit --reconciliation when retrying a
# transport-confirmed rejection.
node --import tsx scripts/literature-production-ingest/cli.ts \
  full --resume --checkpoint /state/full-<operation-id>.checkpoint.json \
  --reconciliation /state/full-<operation-id>.reconciliation-<digest>.json \
  --confirm-production-write

# Re-stream the fixed source and verify exact articles, journals, operation provenance, import
# report, state, counts, and populated search vectors using reads only.
node --import tsx scripts/literature-production-ingest/cli.ts \
  verify --checkpoint /state/full-<operation-id>.checkpoint.json \
  --receipt /state/full-<operation-id>.receipt.json
```

Add `--record-batch-limit`, `--byte-batch-limit`, and `--concurrency` to a new canary/full or dry-run
command. Defaults are 250 records, 4 MiB, and concurrency 1. Record batches are capped at 500,
concurrency at 8, request bytes have a 16 KiB production minimum, and a source plan may contain at
most 2,048 durable batches. Resume always uses the checkpointed limits and rejects replacements.

## Canary-selection contract

`createCanaryManifest` accepts exactly 630 unique, 1-12 digit PMID candidates and only these five
bibliographic selector fields: PMID, abstract presence, publication year, journal, and publication
types. Selection is input-order independent: candidates are ranked by SHA-256 over selector version,
owner seed, and PMID. Required representatives are selected first, followed by ranked fill to exactly 25. The manifest must contain abstract-present and abstract-absent records, the cohort's oldest and
newest available years, at least two journals, and at least two publication types.

Runtime does not trust the manifest's self-description. It requires its canonical SHA-256 to equal
`LITERATURE_CANARY_MANIFEST_SHA256`, queries only those 25 article IDs, and verifies the mixture from
the same read-only planning pass. Canary PMIDs are persisted only in the authorized manifest and
canary receipt; checkpoints, logs, reconciliation receipts, and full receipts contain no PMID list.

## Full, checkpoint, and resume contract

The source adapter is fixed to the reviewed Docker endpoint, container ID, image ID, project label,
published port, database, and user. Every source pass is `REPEATABLE READ READ ONLY`, explicitly
projects bibliography and matching journal columns, orders by PMID under `C` collation, streams
framed JSON lines, and must end with a read-only completion attestation.

Planning performs no destination request. In one streaming pass it records bounded batch descriptors,
exact UTF-8 request sizes, request digests, and per-batch checksums without retaining article rows or
full-mode PMID identities. The mutating pass must reproduce each durable descriptor before its first
request. A full run is also refused unless its exact record count and projection digest match the two
owner pins.

Before each request the checkpoint is durably updated to `submitted`. Exact returned rows move the
stage to `acknowledged`. A confirmed 4xx rejection is attempted once and may be retried only by an
explicit resume. A timeout, transport exception, 408, 5xx, malformed body, or acknowledgement mismatch
is ambiguous: the shared stop signal prevents any new stage from starting, and resume is blocked until
read-only reconciliation proves either exact application or exact absence. There is no automatic
retry, failed-status write, delete, rollback, or compensating mutation.

Journals are upserted before articles, articles are PMID-keyed, and one operation provenance row is
written per PMID/import batch. This is intentionally operation provenance for the fixed corpus; it
does not claim to reproduce historical source-occurrence multiplicity. Every mapped article is forced
to `draft`, `unreviewed`, `manual_override=false`, `is_landmark=false`, and cleared curation/classifier
fields. The database trigger owns `search_vector` and timestamps.

An exclusive adjacent `.operator-lock` prevents concurrent fresh/resume processes from modifying one
checkpoint. Normal exit removes it. A process crash leaves it fail-closed; inspect the checkpoint,
process state, and remote operation before manually removing the lock. Never automate stale-lock
removal.

The remote final report stores the bounded batch count and aggregate batch-checksum digest. Individual
batch checksums remain in the bounded checkpoint and immutable receipt. A deterministic client UUID
plus the remote import-batch primary key prevents concurrent fresh runs for the same approved source
authority. A completed checkpoint with a missing canonical receipt is recovered only after full
read-only source/destination verification, then the receipt is created immutably.

## Integration entries

The integration lead should add only:

```json
{
  "scripts": {
    "literature:production-ingest": "tsx scripts/literature-production-ingest/cli.ts",
    "literature:production-ingest:test": "jest --runInBand scripts/literature-production-ingest"
  }
}
```
