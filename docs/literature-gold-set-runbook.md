# IP Literature single-reviewer gold-set runbook

## Purpose and limits

This workflow creates a reproducible expert-labeled set for measuring and improving later
literature-retrieval and relevance-classification systems. It intentionally implements one
reviewer: the physician/editor performs every review.

There are no second-review assignments, inter-reviewer agreement statistics, disagreements, or
adjudications. That simplifies operation but removes independent agreement evidence. Preserve the
written definitions, immutable first decisions, later revision history, sampling report, and fixed
seed so the resulting labels remain auditable.

The module is an educational literature-discovery aid. It is not medical advice, an
evidence-quality rating, or a substitute for a systematic-review search and expert appraisal.

## What is stored

Each batch records its label, taxonomy, relevance-definition, and sampling-algorithm versions;
fixed seed; requested size; development/test composition; sampling report; creator; status; and
freeze time.

Each unique PMID records:

- one exclusive sampling stratum and its rationale;
- hidden sampling metadata used only for post-decision analysis;
- a reproducible `development` or `test` assignment;
- review position and state;
- whether supplemental metadata or automated signals were revealed; and
- the current immutable review revision.

Drafts are autosaved and mutable. A completed review is append-only. Correcting a completed
decision creates a new revision linked to the previous revision; it never overwrites the first
blinded decision. Audit events and completed reviews reject updates and deletes.

## Corpus audit completed 2026-07-27

The supplied folders contain 67 NBIB files:

| Source tier          | Files |
| -------------------- | ----: |
| Core journals        |    21 |
| Expanded journals    |     1 |
| All-PubMed discovery |    45 |

The full no-write validation parsed 175,916 record occurrences and found 132,350 unique PMIDs.
There were 43,511 duplicate occurrences, which is expected and is why sampling uses canonical
PMIDs rather than files. It also found 41,323 records without abstracts, 28 records without PMIDs,
27 without titles, 264 malformed-line notices, and one conflicting DOI candidate. Missing-PMID and
otherwise invalid records are quarantined rather than sampled. The detailed ignored report is
written under `local-data/literature/reports/`.

The many non-registry journal titles in broad discovery are expected. Their source filename and
journal text remain stored even when no curated journal-registry ID exists.

## 1. Prepare a database

Install dependencies and apply the literature migrations to the intended existing Supabase
environment:

```bash
npm install
npx supabase migration up --local
```

For a new empty local database, the repository currently has an unrelated legacy migration
blocker: `20260430180000_add_socal_ebus_email_notifications.sql` assumes
`public.learner_profiles` already exists. The literature base and gold-set migrations have been
verified from empty in an isolated PostgreSQL database. Reconcile that legacy baseline before
expecting `npx supabase db reset --local` to work for the entire repository.

Load local CLI credentials without copying a service key into source or browser configuration:

```bash
eval "$(npx supabase status -o env 2>/dev/null)"
export LITERATURE_SUPABASE_URL="$API_URL"
export LITERATURE_SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
```

All database-writing literature commands default to no-write mode. Local writes require
`--commit --target local`. Remote writes additionally require `--confirm-remote`.

## 2. Generate and validate the supplied corpus manifest

```bash
npm run literature:manifest -- \
  --corpus-root "IP_PubMed/nbib files" \
  --output local-data/literature/ip-corpus-manifest.v1.json

npm run literature:validate -- \
  --manifest local-data/literature/ip-corpus-manifest.v1.json
```

The agreed folder names map all 67 files to core, expanded, or discovery source provenance.
Individual search-query IDs remain null unless an exact registered query ID is present; the
original source filename remains available for audit.

## 3. Seed taxonomy, import, and generate preliminary signals

Run each write first without `--commit`, inspect its output, then repeat with the local commit
flags:

```bash
npm run literature:seed-taxonomy
npm run literature:seed-taxonomy -- --commit --target local

npm run literature:import -- \
  --manifest local-data/literature/ip-corpus-manifest.v1.json
npm run literature:import -- \
  --manifest local-data/literature/ip-corpus-manifest.v1.json \
  --commit --target local

npm run literature:suggest-topics -- \
  --state unreviewed --limit 200000 --batch-size 500
npm run literature:suggest-topics -- \
  --state unreviewed --limit 200000 --batch-size 500 \
  --commit --target local
```

Topic suggestions and deterministic scores support stratification only. They are never gold
labels and remain hidden during the first review.

## 4. Create the 100-article pilot

First generate the report without creating a batch:

```bash
npm run literature:create-gold-set -- \
  --kind pilot \
  --size 100 \
  --seed 20260727 \
  --name pilot-v1
```

Inspect the JSON report under `local-data/literature/gold-sets/`, especially strata, source tiers,
years, abstract availability, journals, deterministic bands, represented broad topics, and
warnings. Then create the local batch:

```bash
npm run literature:create-gold-set -- \
  --kind pilot \
  --size 100 \
  --seed 20260727 \
  --name pilot-v1 \
  --commit --target local
```

Pilot batches are development-only. Use the pilot to validate the relevance definitions,
technology tags, topic names, common boundary cases, and keyboard workflow. Do not treat it as a
locked test set.

## 5. Review in the development server

Start the application:

```bash
npm run dev
```

Sign in with a verified account that has an active `site_admin` entitlement, then open:

```text
http://localhost:3001/en/admin/literature/gold-set
```

The old experimental URL `/en/feat/ip-literature-explorer` is not a route and returns 404.

The page starts on the development split. It never includes source/query matches, sampling
stratum, deterministic scores, AI recommendations, confidence, or suggested topics in the
first-pass response.

Keyboard shortcuts:

| Key     | Action                       |
| ------- | ---------------------------- |
| `1`     | Include: core IP             |
| `2`     | Include: adjacent            |
| `3`     | Exclude                      |
| `4`     | Uncertain                    |
| `H/M/L` | High/moderate/low confidence |
| `Enter` | Complete and advance         |
| `B`     | Previous article             |
| `T/S/N` | Topics/study design/notes    |

Use **Reveal MeSH and author keywords** when needed. The review records that supplemental
metadata was used. Source-query and automated signals remain unavailable until the first
completed review. After completion, **Reveal automated signals** is available for error analysis;
the original review remains immutable and marked blinded.

For included articles, the page requires at least one broad topic, at least one clinical purpose,
one study design, and one publication status. Technology and disease tags are optional. Excluded
or uncertain articles cannot carry categorization labels.

## 6. Create and protect the full gold standard

After the pilot definitions and labels are accepted:

```bash
npm run literature:create-gold-set -- \
  --kind gold_standard \
  --size 900 \
  --test-percent 30 \
  --seed 20260727 \
  --name gold-set-v1
```

Review the sampling report before repeating with `--commit --target local` or the separately
confirmed remote flags.

Review the **development** split first. Use only those labels for prompt, rule, threshold, and
classifier development. Do not inspect or evaluate the **locked test** split during iteration.
When the workflow is finalized, select the test split in the admin page, review it, run the final
evaluation, and avoid further tuning against its errors.

The 70/30 split is deterministic and stratified. Split membership is not shown inside an article
card, but the queue selector controls which partition is being reviewed.

## 7. Add regression collections

Landmark and hard-negative sets require explicit PMID files and remain development-only:

```bash
npm run literature:create-gold-set -- \
  --kind landmark_regression \
  --pmids local-data/literature/landmark-pmids.txt \
  --size 50 --seed 20260727 --name landmark-regression-v1

npm run literature:create-gold-set -- \
  --kind hard_negative_regression \
  --pmids local-data/literature/hard-negative-pmids.txt \
  --size 50 --seed 20260727 --name hard-negative-regression-v1
```

Landmarks test retention of known important papers. Hard negatives test predictable false-positive
patterns. Neither intentionally selected set estimates overall accuracy.

## 8. Backup and restore

The admin page downloads CSV or JSON. The CLI can also export by UUID or name. Sampling strata
and rationale are blank for articles without a completed first decision, so an offline backup does
not reveal automated signals to the reviewer:

```bash
npm run literature:export-gold-set -- \
  --batch gold-set-v1 --split all --format json --include-history

npm run literature:export-gold-set -- \
  --batch gold-set-v1 --split all --format csv
```

Validate an offline file without writes, then explicitly import it:

```bash
npm run literature:import-gold-reviews -- \
  --input local-data/literature/gold-sets/gold-set-v1-all.csv \
  --batch gold-set-v1

npm run literature:import-gold-reviews -- \
  --input local-data/literature/gold-sets/gold-set-v1-all.csv \
  --batch gold-set-v1 --commit --target local
```

Identical current completed reviews are skipped. Changed completed reviews become new immutable
revisions. Draft rows remain drafts. A frozen batch rejects all imports.

## 9. Freeze

When every item in every split is completed and no drafts remain, the page offers **Freeze
completed batch**. Freezing is irreversible in the application and makes the batch, items,
drafts, and reviews read-only. Export JSON with history before freezing and retain the sampling
report alongside classifier evaluation artifacts.
