# Literature AI shadow integration

The conference atlas and the newer screening pipeline are preserved in the private
[`interventional-pulm-literature-atlas`](https://github.com/russellmiller49/interventional-pulm-literature-atlas)
repository. The main website consumes them only through an isolated, administrator-only shadow
contract.

## Safety boundary

- Shadow classifications never update `literature_articles`, reviewed-overlay columns, confirmed
  topic assignments, visibility, or public search results.
- The proposed schema has RLS enabled and grants only `SELECT` to `service_role`; `anon` and
  `authenticated` receive no privileges.
- The schema remains outside `supabase/migrations`. Applying it to a hosted project is not part of
  this change.
- The importer prepares and verifies files and emits a rollback-only rehearsal. It has no remote
  apply command.
- Full-text credentials, fetched provider documents, PDFs, and human-review workbooks remain
  outside both repositories and release assets.

Machine labels are research decision-support outputs, not physician review and not clinical
guidance. The public Literature Explorer continues to use only the canonical and reviewed data
paths already authorized in the main application.

## Sources pinned by this repository

`config/literature/shadow-atlas-v1.json` records the exact repository commit, private release, every
release-asset SHA-256, the conference projection identity/counts, and the screening model's
held-out metrics and deploy thresholds. This prevents an unversioned local experiment directory
from becoming an implicit production dependency.

## Operator workflow

1. Download and restore the private release in its standalone repository.
2. Validate the SQLite runtime:

   ```bash
   npm run literature:shadow:validate -- --sqlite /path/to/demo.sqlite
   ```

3. Prepare immutable CSVs and a manifest under an ignored local directory:

   ```bash
   npm run literature:shadow:prepare -- \
     --sqlite /path/to/demo.sqlite \
     --output local-data/literature-shadow/conference-v1
   ```

4. Verify the prepared files and rehearse their uniqueness, foreign keys, counts, and run receipt in
   an ephemeral local database:

   ```bash
   npm run literature:shadow:verify -- \
     --prepared local-data/literature-shadow/conference-v1

   npm run literature:shadow:rehearse -- \
     --prepared local-data/literature-shadow/conference-v1
   ```

5. If database-level compatibility must also be evaluated, use a disposable database that already
   contains the Literature foundation. Apply
   `scripts/literature-shadow-import/schema/shadow-proposal.sql`, then use a separately reviewed
   operator script inside a transaction that is always rolled back. No hosted apply is authorized
   here, and this repository intentionally provides no remote-write command.

Scored output from the scikit-learn pipeline can be normalized with `prepare-ml`. It expects the
columns emitted by `python -m litscreen.predict` (`PMID`, `Title`, `Journal`, `Publication Year`,
`ml_prob_include`, `ml_decision`, `ml_zone`, and the optional category columns).

## Activation

The administrator page is `/[locale]/admin/literature/shadow`. It is protected by the existing
site-admin entitlement, dynamically rendered, non-indexable, and fail-closed. Hosted runtime access
uses the new `shadow_read` capability, which remains withheld until a separate reviewed change
promotes and attests the schema. Local mode may read a disposable rehearsal database.
