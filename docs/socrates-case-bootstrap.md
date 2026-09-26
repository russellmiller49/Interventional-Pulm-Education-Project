# SOCRATES Batch 01 private case bootstrap

This offline authoring workflow prepares the first ten Module 1 cases. It creates
schemaVersion 2 **draft candidate packages**, not database cases. It has no apply,
save, publish, membership, study or database client operation. The existing
`workbook-import.ts` still requires a saved v2 target and independently verified
identity/revision; its behavior is unchanged.

## Run

Use the original workbook, SHA-256
`f4a06fb8ccb06f7993fcfca156c4138df0bc4368e100a0444366c68e7ff2f279`.
No alternate hash override is accepted. The existing Python reader verifies the
three sheets, duplicate-sheet agreement, 59 entries, and module counts
20/5/8/14/6/6. Only the first ten rows proceed to narrative parsing, provider
matching, reconciliation and packaging. Cases 11–59 and their existing membership
holds remain unchanged.

Create a private review parent outside every checkout and `public` directory:

```sh
review="${IP_LOCAL_DATA:-/Users/russellmiller/Projects/Interventional-Pulm-Local-Data}/SOCRATES_Steve_Followup_Pack/batch-01"
mkdir -p "$review"
chmod 700 "$review"

npx tsx scripts/socrates/case-bootstrap.ts inspect \
  --workbook '/absolute/path/SOCRATES Case Descriptions.xlsx' \
  --output "$review/inspection_PRIVATE.json"

npx tsx scripts/socrates/case-bootstrap.ts plan \
  --workbook '/absolute/path/SOCRATES Case Descriptions.xlsx' \
  --snapshot "$review/current-author-snapshot_PRIVATE.json" \
  --output "$review/plan_PRIVATE.json"

npx tsx scripts/socrates/case-bootstrap.ts package \
  --workbook '/absolute/path/SOCRATES Case Descriptions.xlsx' \
  --snapshot "$review/current-author-snapshot_PRIVATE.json" \
  --output "$review/new-package-run"
```

`--snapshot` is optional. Its shape is the existing authenticated
`workbook-import.ts snapshot` output (`cases`, `modules`, `memberships`). Obtain a
fresh complete snapshot from the intended environment through that separate,
authorized read workflow; a browser cache or mapping checklist does not establish
absence. The file is input evidence, not proof of authentication or freshness.
The bootstrap records its digest for owner review. Truncated, duplicate-UUID and
unsaved-document snapshots fail closed. No credentials are needed for bootstrap.
`--python` can select a Python executable for the standard-library workbook reader.

All three commands fetch the current fixed-origin provider catalog and both DZI
descriptors. Plans are never accepted as executable input. The output file must
not already exist; `package` requires a new directory under an existing private
parent. Directories are 0700 and files 0600. Symlink parents are resolved before
checking for checkouts/public directories. Existing files, including prior owner
edits, are never overwritten. A run interrupted during packaging is incomplete
until `manifest_PRIVATE.json` exists. Use a new directory for a rerun.

Normal terminal output contains counts only. Plans contain private field comparisons
and may include source text; keep all plans, snapshots, manifests, and packages
outside Git and never distribute them to participants.

## Identity and holds

Matching requires **case number and series**, exactly one catalog entry, and
agreement between its actual ID, barcode, tissue URL and analysis URL. No barcode
is constructed from the workbook. Both live descriptors must parse as JPEG DZI
and have identical width and height. Fetches omit credentials, reject redirects,
use timeouts and have size/content-type bounds.

| Classification   | Package behavior                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `new-candidate`  | May produce an offline package. `create` in a plan means a proposed future action, never permission or a performed write. |
| `existing-exact` | No new package. Preserve saved title/slug/content and provide protected field differences for owner reconciliation.       |
| `ambiguous`      | Hold: multiple provider entries or saved source candidates.                                                               |
| `missing-image`  | Hold: no exact provider entry or an unavailable/invalid descriptor.                                                       |
| `conflict`       | Hold: identity, dimensions, slug, legacy source, narrative or known prior-work conflict.                                  |

Without a snapshot, nine rows can be `new-candidate`, but their intended database
action remains **hold**: absence has not been established. Case 041 / Series 4
is a stronger hold and gets **no package** until a current snapshot reconciles its
known prior author work. With a snapshot, an exact saved case always reconciles;
it never generates a duplicate. Multiple matches and conflicting source IDs or
barcodes remain held.

The existing import planner computes hypothetical field differences for an exact
saved v2 image. Its temporary identity/review flags enable comparison only. The
bootstrap discards the planner's payload, approval digest and ready status;
it exports no verification approval and always reports `canApply: false`.
Populated field replacements stay explicit conflicts, with no approved fields.
The owner must independently verify case/image identity and compare the current
saved draft before using the separate protected import workflow. Refresh the
snapshot and descriptors before any later, separately authorized creation.

## Package content

- Neutral `Core case 01` through `Core case 10` titles and `socrates-core-01`
  through `socrates-core-10` slugs; no source diagnosis in pre-reveal titles.
- Actual provider tissue ID/URL, descriptor dimensions and full-slide rectangle.
  The existing pair helper derives the color image.
- Verbatim canonical narrative, with classifications derived only through
  `narrativeTeaching()`. All eight original cells plus workbook hash/sheet/row
  remain protected in `authorContent.curriculumSource`.
- Empty categories, vignette, diagnostic-list order 0, no regions, no preliminary
  diagnosis, an empty/unreviewed annotation key, false training/testing eligibility,
  incomplete reviews and false identifier/de-identification verification.
- No record UUID or publication timestamp. In particular, the Case 006 demo
  document and its illustrative regions are never inputs to this generator.

Source order is metadata only; no curriculum membership is written or approved.
Provider matching does not constitute clinical or de-identification review.
The provider key and clinically reviewed region geometry remain owner/SME tasks.

## Verification

Focused tests cover holds, repeated runs against saved snapshots, existing 041
content, byte-preserving serialization, neutral projections and private output
rules. Synthetic text fixtures exercise the same generator without committing
source paragraphs. To additionally verify the supplied workbook's real text:

```sh
SOCRATES_BOOTSTRAP_TEST_WORKBOOK='/absolute/path/SOCRATES Case Descriptions.xlsx' \
  npx jest --runInBand scripts/socrates/bootstrap-plan.test.ts scripts/socrates/bootstrap-io.test.ts
```

Normal CI skips only the private-workbook test. The browser rehearsal adds a
generator-derived zero-region draft with synthetic teaching and real paired
provider images, checking paint, reveal, return/reload and zero participant API
calls. It does not establish clinical correctness. See the
[Batch 01 handoff](socrates-batch-01-handoff.md) for this run's evidence and holds.
