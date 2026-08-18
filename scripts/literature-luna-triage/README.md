# literature-luna-triage

Stage-A universal negative triage for the IP literature corpus. Design and contracts:
`docs/ip-literature/luna-triage-v1.md`; API policy: `docs/ip-literature/classifier-api-policy-v1.md`.

Run everything from the repository root with Node 20. There are deliberately no npm scripts
(the overlay package's convention): invoke the CLI directly. `<ARTIFACT>` below is the
absolute path to the finalized 630-row reviewed CSV (operator-supplied, checksum-verified on
every load). All state lands gitignored under `local-data/literature-luna-triage/`.

Tests:

```bash
npx jest --runInBand scripts/literature-luna-triage src/features/literature/classifier
```

## Offline preparation (no API, no spend)

```bash
# 1. Corpus authority + aggregate inventory (records the corpus identity digest on first run)
npx tsx scripts/literature-luna-triage/cli.ts inventory

# 2. Deterministic 430/200 calibration split (identities stay local; manifest is aggregate)
npx tsx scripts/literature-luna-triage/cli.ts split --artifact <ARTIFACT>

# 3. Packets + mapping + risk flags for a cohort (one operation per cohort lifecycle)
npx tsx scripts/literature-luna-triage/cli.ts packets --cohort smoke-30            --operation smoke-01
npx tsx scripts/literature-luna-triage/cli.ts packets --cohort development-430     --operation dev-01
npx tsx scripts/literature-luna-triage/cli.ts packets --cohort locked-sanity-200   --operation locked-cal-v1
npx tsx scripts/literature-luna-triage/cli.ts packets --cohort pilot-1000          --operation pilot-01 --artifact <ARTIFACT>
npx tsx scripts/literature-luna-triage/cli.ts packets --cohort full-corpus         --operation full-01

# 4. Deterministic requests + spend estimate (still offline)
npx tsx scripts/literature-luna-triage/cli.ts prepare-requests --operation smoke-01 --model gpt-5.6-luna --reasoning low
npx tsx scripts/literature-luna-triage/cli.ts estimate         --operation smoke-01 --model gpt-5.6-luna --reasoning low
```

## Spending steps (each needs `--confirm-api-spend` + typing `SPEND <operation-id>` at a TTY)

```bash
# 30-record synchronous smoke (OPENAI_API_KEY must be in the environment, never in argv)
npx tsx scripts/literature-luna-triage/cli.ts run-sync --operation smoke-01 \
  --confirm-api-spend --max-records 30 --max-estimated-cost-usd 2

# 430-record prompt-development run
npx tsx scripts/literature-luna-triage/cli.ts run-sync --operation dev-01 \
  --confirm-api-spend --max-records 430 --max-estimated-cost-usd 20

# Freeze, then the one locked 200-record run per calibration version
npx tsx scripts/literature-luna-triage/cli.ts freeze --calibration-version cal-v1 \
  --model gpt-5.6-luna --reasoning low --model-alias <SNAPSHOT-IF-AVAILABLE>
npx tsx scripts/literature-luna-triage/cli.ts run-locked --operation locked-cal-v1 \
  --calibration-version cal-v1 --confirm-api-spend --max-records 200 --max-estimated-cost-usd 10

# 1,000-record stratified corpus pilot (outside the 630)
npx tsx scripts/literature-luna-triage/cli.ts run-sync --operation pilot-01 \
  --confirm-api-spend --max-records 1000 --max-estimated-cost-usd 40

# Full-corpus Batch: prepare offline, submit only under separate authorization
npx tsx scripts/literature-luna-triage/cli.ts batch-prepare --operation full-01 \
  --max-records 132350 --max-records-per-shard 5000
npx tsx scripts/literature-luna-triage/cli.ts batch-submit --operation full-01 \
  --shard <SHARD-FILENAME> --confirm-api-spend --max-records 5000 --max-estimated-cost-usd 150
npx tsx scripts/literature-luna-triage/cli.ts batch-status --operation full-01 \
  --batch-id <BATCH-ID> --confirm-api-spend --max-records 1 --max-estimated-cost-usd 0.01
npx tsx scripts/literature-luna-triage/cli.ts batch-fetch --operation full-01 \
  --batch-id <BATCH-ID> --confirm-api-spend --max-records 1 --max-estimated-cost-usd 0.01
```

## After outputs exist (offline again)

```bash
npx tsx scripts/literature-luna-triage/cli.ts ingest        --operation <OP> [--source sync|batch|all]
npx tsx scripts/literature-luna-triage/cli.ts route         --operation <OP>
npx tsx scripts/literature-luna-triage/cli.ts evaluate      --operation <OP> --artifact <ARTIFACT>   # calibration cohorts
npx tsx scripts/literature-luna-triage/cli.ts review-queue  --operation <OP>
npx tsx scripts/literature-luna-triage/cli.ts audit-sample  --operation <OP> --sample-size 50
npx tsx scripts/literature-luna-triage/cli.ts qualify       --operation <OP>
npx tsx scripts/literature-luna-triage/cli.ts review-app    --operation <OP> --port 4630
```

The review app binds to `127.0.0.1` only and needs neither Supabase nor an API key. Routing
manifests and the Stage-B queue come from `route`; physician exports come from the review
app's Export button.
