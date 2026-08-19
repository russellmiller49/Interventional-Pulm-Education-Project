# literature-luna-triage

Stage-A universal negative triage for the IP literature corpus — the **offline preparation
platform**. Design and contracts: `docs/ip-literature/luna-triage-v1.md`; API policy:
`docs/ip-literature/classifier-api-policy-v1.md`.

## What this package does, and what it deliberately does not

This package prepares everything a Stage-A triage run needs and stops there. It builds
packets, mints opaque record ids, constructs the deterministic 430/200 split, prepares exact
Responses request bytes and content-addressed Batch shards, prices them, ingests result files,
routes and evaluates them, and serves the loopback physician-review app.

It **cannot call a model**. There is no credential read, no transport, and no remote host
anywhere in its module graph:

- no `process.env` read of any kind, and no API-key name in any source file;
- no `fetch`, HTTP client, socket, or SDK — the only `node:http` import is the review app's
  `createServer`, bound to `127.0.0.1`;
- no upload, no Batch create/status/fetch, no remote receipt.

`offline-surface.test.ts` proves this structurally over the transitive import closure of the
CLI, and `boundary.test.ts` proves it per source file. Both fail if any of it is reintroduced.

### Withheld commands

These names are refused with an explanation before any flag is parsed, any state directory is
resolved, and any file is opened. They are not missing by accident:

| Command        | Why it is withheld                                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `run-sync`     | Remote execution needs a separately reviewed transport adapter and its own owner spend authorization.                               |
| `run-locked`   | The locked-sanity 200 have no executable pathway in this release; running them belongs to a separately reviewed locked coordinator. |
| `batch-submit` | Uploading a shard and creating a Batch is remote execution.                                                                         |
| `batch-status` | Nothing here can create a Batch, so there is nothing to poll.                                                                       |
| `batch-fetch`  | Result files that reach this machine some other way are still ingested strictly by `ingest --source batch`.                         |
| `qualify`      | Deciding that a model qualified is a release decision owned by the future locked coordinator. Nothing in this package may claim it. |
| `freeze`       | A freeze receipt binds a locked run to one execution surface; with no locked run there is nothing to freeze.                        |

### The locked cohort

`split` still constructs the 200 locked identities deterministically and locally — that
manifest remains the future evaluation authority. But in this release the locked cohort has no
executable pathway at all. `packets --cohort locked-sanity-200` is refused outright, and every
preparation command additionally refuses **actual membership**: an operation calling itself
`development-430` while carrying even one locked identity is refused before any request bytes
exist. `full-corpus` is the one documented exception to the membership check, because it is the
entire 132,350-record corpus rather than a selection of it — and nothing here can send it.

### Evaluation is descriptive

`evaluate` reports metrics, denominators, subgroups, and reconciliation identities. It emits no
aggregate verdict, no pass flag, and no field a caller could read as a release decision.

## Running it

Run everything from the repository root with Node 20. There are deliberately no npm scripts
(the overlay package's convention): invoke the CLI directly. `<ARTIFACT>` below is the
absolute path to the finalized 630-row reviewed CSV (operator-supplied, checksum-verified on
every load). All state lands gitignored under `local-data/literature-luna-triage/`.

Tests:

```bash
npx jest --runInBand scripts/literature-luna-triage src/features/literature/classifier
```

The regression suites are the evidence: each corrected finding has load-bearing tests that
fail when its defect is restored. There is no source-mutating harness in this package — one
that edits shipped files in place is a liability under interruption, not a product feature.

### Preparation

```bash
# 1. Corpus authority + aggregate inventory (records the corpus identity digest on first run)
npx tsx scripts/literature-luna-triage/cli.ts inventory

# 2. Deterministic 430/200 calibration split (identities stay local; manifest is aggregate)
npx tsx scripts/literature-luna-triage/cli.ts split --artifact <ARTIFACT>

# 3. Packets + mapping + risk flags for a permitted cohort (one operation per cohort lifecycle)
npx tsx scripts/literature-luna-triage/cli.ts packets --cohort smoke-30        --operation smoke-01
npx tsx scripts/literature-luna-triage/cli.ts packets --cohort development-430 --operation dev-01
npx tsx scripts/literature-luna-triage/cli.ts packets --cohort pilot-1000      --operation pilot-01 --artifact <ARTIFACT>
npx tsx scripts/literature-luna-triage/cli.ts packets --cohort full-corpus     --operation full-01

# 4. Deterministic request bytes, and the cost they would carry
npx tsx scripts/literature-luna-triage/cli.ts prepare-requests --operation smoke-01 --model gpt-5.6-luna --reasoning low
npx tsx scripts/literature-luna-triage/cli.ts estimate         --operation smoke-01 --model gpt-5.6-luna --reasoning low \
  --max-records 30 --max-estimated-cost-usd 2

# 5. Deterministic, content-addressed Batch shards and a priced plan (never submitted)
npx tsx scripts/literature-luna-triage/cli.ts batch-prepare --operation full-01 \
  --max-records 132350 --max-records-per-shard 5000
```

`--max-records` and `--max-estimated-cost-usd` still bite: they are how a plan is judged before
anyone is asked to authorize sending it. They gate the report, not a socket, because there is
no socket.

Every prepared request and every prepared shard is re-read from its own bytes and must yield
back the record id and token contribution the manifest claims. A plan whose metadata and bytes
disagree is refused rather than written.

### After result files exist

Stage-A outputs are produced elsewhere and land under the operation's
`responses/raw/` (one JSON body per record id) or `batch/raw/` (Batch output/error JSONL).
Ingestion is strict: every non-empty line reaches exactly one accounted terminal state, and
anything unusable is content-addressed into quarantine rather than repaired.

```bash
npx tsx scripts/literature-luna-triage/cli.ts ingest        --operation <OP> [--source sync|batch|all]
npx tsx scripts/literature-luna-triage/cli.ts route         --operation <OP>
npx tsx scripts/literature-luna-triage/cli.ts evaluate      --operation <OP> --artifact <ARTIFACT>   # calibration cohorts
npx tsx scripts/literature-luna-triage/cli.ts review-queue  --operation <OP>
npx tsx scripts/literature-luna-triage/cli.ts audit-sample  --operation <OP> --sample-size 50
npx tsx scripts/literature-luna-triage/cli.ts review-app    --operation <OP> --port 4630
```

The review app binds to `127.0.0.1` only and needs neither Supabase nor an API key. Routing
manifests and the Stage-B queue come from `route`; physician exports come from the review
app's Export button.

## Future work (separate PRs)

Remote execution returns as its own reviewed adapter, with its own spend authorization, its own
threat model, and its own regression suite. The locked coordinator and the qualification
verdict return with it. Neither is in this package, and neither should be added to it without
that separate review.
