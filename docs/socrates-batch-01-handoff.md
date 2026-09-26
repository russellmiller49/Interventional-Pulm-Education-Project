# SOCRATES Batch 01 owner handoff

**BATCH 01 CASE PACKAGES READY FOR OWNER/SME REVIEW**

Nine offline candidate packages are prepared. **Case 041 / Series 4 remains on
hold and has no package**, because its known prior author work could not be
reconciled without a current authenticated author-case snapshot. No saved case
absence is claimed for any row. All ten database creation actions remain held.

## Repository and scope

- Starting `origin/main`: `553bd0a1820ca178074947b84cb7e94df0938b1e`.
- Branch: `codex/socrates-batch-01`, created from the fetched main in the supplied
  dedicated checkout. Final HEAD is recorded in the PR/owner delivery.
- The intervening commits after the prompt's `41a34608ec556a59270b4c3b2b5bbb1c924653be`
  affect mechanical ventilation only. No intervening SOCRATES changes were found.
- The existing protected importer, runtime UI, schemas, RLS, revision checks,
  publication/readiness gates and testing projections are unchanged. No migration.

The [operator guide](socrates-case-bootstrap.md) describes the separate
`inspect`, `plan`, and `package` commands, private output policy and later owner
reconciliation. Packages reuse existing schemas, empty author defaults,
`narrativeTeaching()`, the provider pair helper and DZI parser. Exact saved
cases receive hypothetical field differences from the existing import planner;
no apply payload, approval digest or owner verification is exported.

## Private artifacts and source validation

Workbook: `/Users/russellmiller/Downloads/SOCRATES Case Descriptions.xlsx`.
SHA-256: `f4a06fb8ccb06f7993fcfca156c4138df0bc4368e100a0444366c68e7ff2f279`.
The three sheets, 59 source entries, 55 case numbers, duplicate-sheet agreement,
module counts 20/5/8/14/6/6, and the exact first-ten sequence passed inspection.
Cases 11–59 received no bootstrap/image/narrative processing after the existing
reader's workbook-wide structural validation.

Private review directory:
`/Users/russellmiller/Projects/Interventional-Pulm-Local-Data/SOCRATES_Steve_Followup_Pack/batch-01/`.

- `inspection_PRIVATE.json`: first live preflight, ten rows.
- `packages-20260924/plan_PRIVATE.json`: fresh live provider checks used to package.
- `packages-20260924/manifest_PRIVATE.json`: nine filenames/digests and holds.
- `packages-20260924/socrates-core-{01,02,03,04,05,07,08,09,10}_PRIVATE.json`:
  validated schemaVersion 2 draft candidates. No `socrates-core-06` file exists.

All eight original source values and the canonical narrative were independently
compared after serialization with the original workbook and match exactly.
Directories are 0700; generated files are 0600. The workbook, source paragraphs,
internal notes, snapshots and generated private packages are **not in Git**, nor
under any public asset directory. No source image tiles are committed.

## Batch reconciliation

Provider identity and both descriptor dimensions were verified live. `Unverified`
means no authenticated saved-case snapshot was available, not that no saved case
exists. The neutral title is the proposed title for a new draft; a discovered
saved case keeps its current title/slug. Source row is order + 1; module is
CORE SRH ORIENTATION and module position equals order for every row below.

| Order | Source key          | Neutral title | Provider slide ID                  | Dimensions  | Saved UUID | Action | Conflict / hold                               |
| ----- | ------------------- | ------------- | ---------------------------------- | ----------- | ---------- | ------ | --------------------------------------------- |
| 1     | `case-272-series-2` | Core case 01  | `nio-272-series-2-barcode-ax03216` | 3600 × 3900 | Unverified | hold   | Snapshot unavailable; offline candidate only. |
| 2     | `case-443-series-1` | Core case 02  | `nio-443-series-1-barcode-ax08995` | 3600 × 3900 | Unverified | hold   | Snapshot unavailable; offline candidate only. |
| 3     | `case-171-series-1` | Core case 03  | `nio-171-series-1-barcode-au00781` | 5400 × 5700 | Unverified | hold   | Snapshot unavailable; offline candidate only. |
| 4     | `case-88-series-4`  | Core case 04  | `nio-088-series-4-barcode-ag01218` | 1800 × 1800 | Unverified | hold   | Snapshot unavailable; offline candidate only. |
| 5     | `case-327-series-2` | Core case 05  | `nio-327-series-2-barcode-ag01217` | 3600 × 3900 | Unverified | hold   | Snapshot unavailable; offline candidate only. |
| 6     | `case-41-series-4`  | Core case 06  | `nio-041-series-4-barcode-ax08984` | 1800 × 1800 | Unverified | hold   | Prior author work unresolved; no package.     |
| 7     | `case-440-series-2` | Core case 07  | `nio-440-series-2-barcode-ax03699` | 3600 × 3900 | Unverified | hold   | Snapshot unavailable; offline candidate only. |
| 8     | `case-281-series-2` | Core case 08  | `nio-281-series-2-barcode-ax09153` | 3600 × 3900 | Unverified | hold   | Snapshot unavailable; offline candidate only. |
| 9     | `case-233-series-2` | Core case 09  | `nio-233-series-2-barcode-ax00607` | 3600 × 3900 | Unverified | hold   | Snapshot unavailable; offline candidate only. |
| 10    | `case-6-series-4`   | Core case 10  | `nio-006-series-4-barcode-ax00631` | 9000 × 9900 | Unverified | hold   | Snapshot unavailable; offline candidate only. |

## Owner review still required

All ten cases (272/2, 443/1, 171/1, 088/4, 327/2, 041/4, 440/2, 281/2,
233/2, 006/4) need a fresh authenticated snapshot and independent image/draft
reconciliation before any separately authorized creation or import. In particular:

- **041/4:** locate and preserve the existing author work. If an exact saved case
  exists, review field differences; do not replace it or create a second case.
- **006/4:** the candidate has zero regions and no illustrative demo UUID,
  labels, summaries, explanations or readiness. It needs actual reviewed teaching
  regions only if separately supplied; the workbook provides no geometry.
- **All ten:** owner/SME review of source teaching, identifiers/de-identification,
  imaging/secondary ROSE, provider key, eligibility, publication and curriculum
  membership remains outstanding. Matching provider metadata is not clinical review.

Future holds for 430/2 (core versus advanced), 357/2 and 436/1 (retention) are
unchanged and outside this batch. No review status was promoted to ready.

## Validation

- Focused SOCRATES Jest: **26 suites, 176 tests passed**, including 17 new bootstrap
  tests and opt-in real-workbook byte/hash validation. Synthetic fixtures do not
  establish clinical correctness.
- Python workbook reader: **6 tests passed**.
- TypeScript with 8 GB heap: passed.
- Focused ESLint: passed without warnings. `git diff --check`: passed.
- Existing disposable PostgreSQL rehearsal: **83 checks passed**.
- Chromium browser rehearsal: **10 journeys passed**, including the new generator-derived
  draft preview. The screenshot `test-results/socrates/bootstrap-preview.png` was
  opened and visually checked: both image panes are painted and the complete
  synthetic canonical narrative is visible after reveal.
- Production build not run: this change adds operator scripts, fixtures, tests
  and documentation; no application/runtime path changed.

The browser check uses the existing isolated PostgreSQL plus synthetic Auth adapter,
real provider tiles, and synthetic teaching. Its generated-draft journey checks
two painted image panes, zero regions, no pre-reveal diagnosis, complete canonical
narrative after reveal, return/reload preservation and zero participant API calls.
It does not verify production Auth or the saved Case 041 draft. No benign/malignant
clinical screenshots are asserted; the application UI is unchanged and browser
teaching fixtures are explicitly synthetic.

Logs are ignored under `test-results/socrates-batch-01/`; browser screenshots are
ignored under `test-results/socrates/`. Existing Node deprecation/experimental and
Webpack cache warnings were observed. The existing admin builder journey selects
a synthetic source without live tiles and logs expected 404s; the generated-draft
journey separately asserts actual paired image paint.

No merge, deployment, remote database mutation, real-case publication, membership
approval or real study activation occurred. Existing rehearsal fixtures exercise
publication and activation only inside the disposable synthetic database; none of
the real Batch 01 packages was saved there or to a remote database.

## Exact changed files

```text
docs/local-authoring-assets.md
docs/socrates-case-bootstrap.md
docs/socrates-batch-01-handoff.md
e2e/socrates-study.spec.ts
scripts/socrates/bootstrap-fixtures.ts
scripts/socrates/bootstrap-io.test.ts
scripts/socrates/bootstrap-io.ts
scripts/socrates/bootstrap-plan.test.ts
scripts/socrates/bootstrap-plan.ts
scripts/socrates/case-bootstrap.ts
```
