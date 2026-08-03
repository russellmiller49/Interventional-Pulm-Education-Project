# Expert-curated literature collection audit

## Purpose and safety boundary

`expert-curated-ip-v1` is a source collection, not a relevance label. Presence in the collection
must not automatically include, publish, exclude, landmark, or assign a topic to an article. The
audit is a read-only comparison against the existing literature corpus and gold-set metadata. It
writes deterministic local reports but does not write to Supabase.

The command must run with the current literature schema and server-side credentials for the
selected read target. It has no `--commit` option and issues only table reads. Starting, resetting,
seeding, importing, or otherwise changing the local Supabase stack remains a primary-checkout-only
operation and is outside this audit.

## Frozen inputs

The command validates all three ignored inputs before connecting to the database:

- `local-data/literature/expert-curated-ip-v1/expert-curated-ip-v1-pmids.txt`
- `local-data/literature/expert-curated-ip-v1/expert-curated-ip-v1-external-resources.txt`
- `local-data/literature/expert-curated-ip-v1/expert-curated-ip-v1-audit.json`

The PMID file must contain exactly 281 unique numeric PMIDs, and the external-resource file must
contain exactly seven unique HTTP(S) URLs. Blank lines, surrounding whitespace, duplicates,
malformed values, count drift, collection-ID drift, or disagreement with the ordered lists in the
source audit stop the command. The SHA-256 recorded in the report is computed from the same bytes
that are parsed.

## Run

After the package script is registered, run:

```bash
npm run literature:audit-curated-collection -- --target local
```

The canonical report paths are:

- `local-data/literature/expert-curated-ip-v1/expert-curated-ip-v1-curated-collection-audit.json`
- `local-data/literature/expert-curated-ip-v1/expert-curated-ip-v1-pmid-audit.csv`
- `local-data/literature/expert-curated-ip-v1/expert-curated-ip-v1-external-resources-audit.csv`

`--output-directory` may select another directory only within the repository's ignored
`local-data/` subtree. The command rejects escapes from that subtree, existing symlink components,
symlink output files, and any output that collides with or aliases an input. It checks the paths
before database access and again after creating the output directory.

Identical input bytes, normalized repository-relative input paths, selected target label, and
database state produce identical output bytes. Paths are therefore part of the deterministic input
contract. Reports omit wall-clock timestamps, preserve canonical input order, sort database-derived
arrays, canonicalize nested JSON object keys, and overwrite the same ignored output paths.

## PMID fields and count semantics

Each PMID row reports corpus presence; title, DOI, journal, publication year, and abstract
availability; every source/import provenance record; current general curation and visibility;
landmark status; all topic assignments; every pilot, gold-standard, landmark-regression, and
hard-negative-regression membership; legitimately accessible current physician decisions; review
revision counts; and conflict status.

Every linked import-batch snapshot includes all current `literature_import_batches` provenance
columns: source identity and hashes, manifest/query versions, source/query IDs, date bounds, status,
all import counts, record limit, start/completion timestamps, structured report, and `created_by`.
The report also records only the selected database target label (`local` or `remote`) so a local
audit is evident. It does not record a database hostname, URL, credential, or key.

Summary counts have these meanings:

- `alreadyIncludeCore` and `alreadyIncludeAdjacent`: at least one accessible authoritative current
  physician decision has that label.
- `alreadyExcluded`: general curation is `excluded` or an accessible authoritative current
  physician decision is `exclude`.
- `candidate` and `unreviewed`: the current general-curation state.
- `alreadyInPilotOrAnotherBatch`: at least one gold-set batch membership of any kind.
- `missingAbstract`: a corpus-present article has a null, empty, or whitespace-only abstract.
- `conflictingExistingPhysicianDecision`: an accessible authoritative physician decision is
  `exclude`, or accessible authoritative decisions disagree across memberships.
- `manualConflictQueue`: the general-curation state is excluded or the preceding physician
  conflict condition is true.

Counts are not mutually exclusive. A prior decision is reported but never changed.

## Held-out test protection

A gold-standard test item is locked while its batch has no `test_unlocked_at`. The command first
loads item and batch metadata, identifies locked item IDs, and excludes them before querying the
review table. Locked labels and revision counts are not fetched. Their output fields remain null,
`labelAccess` is `withheld_locked_test`, and conflict assessment is explicitly incomplete. The pure
report builder also rejects a snapshot containing any locked-item review row, preventing a future
adapter regression from silently redacting a label only after access.

## External-resource resolution

External resolution is offline and exact-only. The command recognizes only a literal PMID in a
canonical PubMed URL or a literal DOI in a DOI URL, DOI query parameter, or URL path. It then
requires exactly one matching `literature_articles` row. It never fetches a page, matches a title
slug, treats a publisher PII as a DOI, or infers a relationship from source-list adjacency.

An exact unique corpus match is `resolved_pubmed_duplicate`. Missing or ambiguous matches are
`unresolved`. `distinct_non_pubmed_resource` is reserved for explicit trusted metadata that proves
that classification; it is not guessed from domain or file extension. Because the supplied seven
URLs contain no literal PMID or DOI and the frozen source audit supplies no such metadata, they are
reported as unresolved until a separately reviewed exact-metadata manifest is available.

Non-PubMed resources are never inserted into `literature_articles` by this command.

## Recommended later write plan

Any later write operation requires separate physician/editor approval and a separate change:

- currently unreviewed articles: move to `candidate` plus `draft`;
- existing physician decisions: preserve unchanged;
- existing exclusions: send to a manual conflict queue;
- confirmed positive articles: use only in a development-only positive regression collection; and
- external resources: maintain in a separate resource collection.

Do not create `gold-set-v1`, import missing articles, bulk-curate, publish, or dispatch a screening
worker as part of the audit.
