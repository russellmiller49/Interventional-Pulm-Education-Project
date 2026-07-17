# Baxter CRRT exact-candidate freeze procedure

Status: `implemented tooling; no formal candidate frozen`

## Purpose

Every mandatory and applicable conditional disposition must identify the same immutable CRRT
candidate. The mandatory domains are `nephrology`, `critical-care`, `crrt-nurse-education`,
`prismax-device`, `accessibility`, `localization`, `privacy-data-governance`,
`entitlement-security`, `product-owner`, and `publication-approval`. A reviewer role or general
statement of approval is not an exact-version disposition. This procedure creates a deterministic
CRRT candidate identity without treating an uncommitted working tree as approved.

The manifest covers the CRRT feature, routes, reviewer workspace, CRRT analytics integration,
draft-access boundary, source and review documents, release tooling, and build/test configuration.
It also records the expected SHA-256 identity of the three supplied device artifacts and the coding
instructions. The candidate ID changes if any scoped file, version, profile, or expected source
identity changes.

The schema-v2 identity also binds the full committed Git tree OID and Git object format. This makes
the exact repository snapshot explicit even though the detailed SHA-256 file inventory stays scoped
to CRRT. The commit ID remains a separate immutable locator; branch names and timestamps are context,
not candidate-identity inputs.

## Commands

Generate a provisional manifest while work is still in progress:

```bash
npm run crrt:review-candidate -- \
  --source-dir /path/to/supplied/source-artifacts \
  --output /tmp/baxter-crrt-review-candidate.json
```

Verify a recorded manifest against the current checkout:

```bash
npm run crrt:review-candidate -- \
  --source-dir /path/to/supplied/source-artifacts \
  --verify /tmp/baxter-crrt-review-candidate.json
```

Verification first rebuilds the recorded manifest from its own inputs. It rejects noncanonical or
internally inconsistent JSON, provisional/dirty records, and recorded source entries that were not
verified, before comparing candidate, commit, tree, and current clean/source state.

Create a formal freeze-eligible manifest only after the exact candidate is committed and the entire
repository is clean:

```bash
npm run crrt:review-candidate -- \
  --source-dir /path/to/supplied/source-artifacts \
  --require-clean \
  --output /secure/review-packet/baxter-crrt-review-candidate.json
```

Do not store the manifest anywhere inside the repository. The CLI rejects repository-internal
output, including an outside-looking path whose parent symlink resolves back into the repository.
The manifest is an attestation artifact about the candidate, not part of the content used to
compute its own identity, and writing it must not dirty a checkout after the clean-state check.

The command only reads Git and the requested source files and writes the requested manifest. It does
not stage files, create a commit, update a branch/tag/ref, create a temporary index, or make a dirty
working tree eligible.

## Deterministic identity contract

The formal clean-commit path reads each included file directly from the `HEAD` Git tree and blob
objects. It does not hash checkout bytes, so line-ending filters, filesystem permissions, or a later
working-tree edit cannot silently alter the recorded candidate. Every file record contains:

- a safe, POSIX, repository-relative path;
- committed Git mode `100644` or `100755`;
- exact byte length; and
- SHA-256 of the exact committed blob bytes.

Files and source artifacts are sorted by unsigned UTF-8 bytes, not host-locale collation. Manifest
object keys use the same bytewise order before compact UTF-8 JSON serialization. The candidate ID is
`baxter-crrt-rc-v2-sha256-` plus SHA-256 of that canonical identity payload. Generation time,
branch label, dirty-state details, absolute paths, and observed source-file attestations are not
identity inputs.

Strict candidate-file path checks reject absolute paths, traversal, repeated separators,
backslashes, control
characters, non-portable filenames, `.git`, symlinks, submodules, devices, sockets, directories in
the file inventory, and Git modes other than regular or executable files. Manifest output must be
outside the repository. `.env*`, `.next`, `node_modules`, coverage, test results, logs, caches,
and deploy outputs are not candidate inputs.

While development remains dirty, the same command intentionally produces
`provisional-dirty-working-tree`. That mode hashes the scoped regular working-tree files and records
their current executable mode, while recording `HEAD`'s tree OID only as the base-tree context. It
is useful for comparing engineering snapshots but can never satisfy a review disposition.

## Hashed scope

The generator expands every directory below into an explicit per-file inventory:

- all `src/features/baxter-crrt`, `src/app/[locale]/baxter-crrt`, `docs/baxter-crrt`, and
  `scripts/baxter-crrt` files;
- the CRRT analytics API, site tracker, analytics schema, draft guard/policy, access resolver,
  sitemap, site-search, proxy, and their CRRT-relevant tests;
- the reviewed-English handoff boundary, locale request/routing/path support, and English, Spanish,
  and Simplified Chinese message catalogs; and
- `package.json`, `package-lock.json`, TypeScript/Jest/ESLint/Next/PostCSS/Tailwind/Contentlayer
  configuration, standalone preparation, and the production server entry point.

The manifest records external source artifact IDs, portable basenames, expected SHA-256 values, and,
when `--source-dir` is supplied, observed byte lengths and matching hashes. It never records the
user's absolute source-directory path or copies the supplied PDFs into the repository.

## Guarded reviewer-build identity banner

The guarded `/[locale]/baxter-crrt/review` route displays an unfrozen warning unless the review
environment supplies both of these exact values:

```text
BAXTER_CRRT_REVIEW_CANDIDATE_ID=baxter-crrt-rc-v2-sha256-<64 lowercase hex>
BAXTER_CRRT_REVIEW_MANIFEST_SHA256=<64 lowercase hex>
```

An optional bounded deployment label may be supplied as
`BAXTER_CRRT_REVIEW_BUILD_ID`. The route validates the two digest formats, displays them for manual
comparison, and otherwise discards malformed values. Even a valid banner remains labeled “verify
manifest” and sets no approval or formal-review-eligibility flag. Reviewers must compare it with the
independently controlled manifest and build/deployment evidence before recording findings.

## Formal freeze sequence

1. Resolve all changes and create the exact review commit. The formal command requires the complete
   repository—not merely the CRRT scope—to be clean. Do not collect dispositions from a dirty
   working tree.
2. Run the complete type-check, lint, test, build, formatting, and patch-integrity stack.
3. Generate the manifest with `--require-clean` and `--source-dir`. The CLI rejects
   `--require-clean` without all four supplied source files and verifies their SHA-256 values before
   writing anything.
4. Calculate and record the generated manifest file's SHA-256. Configure the guarded review
   environment with the candidate ID, manifest SHA-256, and controlled build ID; record the exact
   deployment/build artifact digest separately.
5. Copy the full candidate ID, Git commit/tree, versions, profile IDs, source hashes, manifest
   digest, and validation evidence reference into the packet and domain-specific review records.
6. Give every reviewer the same build and manifest. Each reviewer records identity, qualifications,
   scope, findings, disposition, date/timezone, and an authenticated attestation reference.
7. Verify the manifest again from the same clean commit before any pilot, activation, or publication
   decision. A detached checkout is acceptable because the candidate is anchored by commit and tree,
   not by a mutable branch label.

## Invalidation rule

Any consequential change to a hashed file, version, source identity, profile, protocol, validation
record, route guard, progress/analytics boundary, or review document creates a different candidate
ID. Reset every affected disposition to `pending`, rerun the applicable validation, and issue a new
manifest. A provisional manifest with `provisional-dirty-working-tree` is engineering evidence only
and cannot satisfy a clinical or release sign-off gate.
