# SOCRATES private workbook import

This bounded operator utility preserves Steve's original workbook text in existing
saved v2 cases. It does not create cases or images, draw regions, approve content,
publish, change testing eligibility, or activate studies. Use the author guide for
normal editing. All examples below require a separately authorized environment;
this PR exercised apply only against synthetic cases in disposable PostgreSQL.

## Inspect and reconcile without database access

Keep the workbook, mapping, snapshots, plans and receipts outside every checkout
and public directory. Outputs are created with owner-only permissions and refuse
to overwrite an existing file. The utility prints counts, never source paragraphs
or notes. Set `pack` and `review` to private absolute directories; create `review`
before running these commands.

```sh
npx tsx scripts/socrates/workbook-import.ts inspect \
  --workbook "$pack/SOCRATES Case Descriptions.xlsx" \
  --output "$review/inspection_PRIVATE.json"
npx tsx scripts/socrates/workbook-import.ts map-template \
  --workbook "$pack/SOCRATES Case Descriptions.xlsx" \
  --output "$review/mapping_PRIVATE.json"
npx tsx scripts/socrates/workbook-import.ts plan \
  --workbook "$pack/SOCRATES Case Descriptions.xlsx" \
  --mapping "$review/mapping_PRIVATE.json" \
  --output "$review/unmapped-plan_PRIVATE.json"
```

The default expected workbook SHA-256 is
`f4a06fb8ccb06f7993fcfca156c4138df0bc4368e100a0444366c68e7ff2f279`.
Only an intentionally reviewed replacement should use `--expected-sha256`.
Python 3's standard library reads the XLSX directly; `--python` selects another
interpreter. Ingestion validates all three sheets, exact duplicate-sheet agreement,
59 unique case-series keys, 55 case numbers, consecutive overall and module order,
and module counts 20/5/8/14/6/6. Formulas and external references are rejected.

The supplied review CSV is an unresolved checklist, not an apply file. All 59
target UUIDs/revisions were blank. The JSON template adds explicit image evidence,
current-draft review and replacement approvals.

## Capture and review current saved drafts

After the two forward migrations have been authorized and applied in the intended
environment, supply `SOCRATES_IMPORT_URL`, `SOCRATES_IMPORT_API_KEY` and
`SOCRATES_IMPORT_ACCESS_TOKEN` through a private environment. The token must belong
to a verified, authorized editor; a service key is not a substitute for identity.
Never paste tokens into commands or reports. Remote HTTP operations require the
additional explicit `--remote` option and HTTPS; the examples omit it for local use.

```sh
npx tsx scripts/socrates/workbook-import.ts snapshot \
  --output "$review/current-drafts_PRIVATE.json"
```

Snapshot retrieval is read-only. It refuses a potentially truncated collection at
the API's 1,000-row cap. Inspect the full current draft, especially the recent
Case 041 / Series 4 work, before completing each mapping:

| Field                  | Required evidence                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `sourceKey`            | Normalized case number **and** series, such as `case-41-series-4`; original labels stay intact in source metadata. |
| `targetCaseUuid`       | Existing saved v2 case's stable database UUID.                                                                     |
| `expectedRevision`     | Revision read from the reviewed current draft.                                                                     |
| `expectedImageUrl`     | Exact existing original image descriptor URL, independently checked against the actual source/image.               |
| `identityVerified`     | Set true only after that identity check.                                                                           |
| `reviewedCurrentDraft` | Set true only after comparing current author work.                                                                 |
| `approvedFields`       | Exact field paths for reviewed replacements, or an empty array.                                                    |

The utility requires the approved provider URL pattern with matching case **and**
series; it never constructs a URL from a case number. A different legitimate source
requires deliberate reconciliation, not guessed matching. Multiple matching cases
are reported until an owner chooses and verifies one stable target. One case number
with different series remains separate.

```sh
npx tsx scripts/socrates/workbook-import.ts plan \
  --workbook "$pack/SOCRATES Case Descriptions.xlsx" \
  --snapshot "$review/current-drafts_PRIVATE.json" \
  --mapping "$review/mapping_PRIVATE.json" \
  --output "$review/reviewed-plan_PRIVATE.json"
```

Review every private plan row: source key/row, candidate count, UUID/revision,
changed and preserved fields, exact before/after values, conflicts and membership
holds. Replacing populated teaching fields requires their individual paths, such
as `caseContent.lowMagnificationObservations` or `caseContent.learnerNarrative`.
Replacing existing source provenance requires `authorContent.curriculumSource`.
Changing a published case to a draft requires `workflowStatus`; it does not
republish it. Rebuild the plan after changing approvals. Never edit the generated
payload to bypass a conflict.

## Text, review and membership behavior

`caseContent.learnerNarrative` keeps the exact full learner text, including headings,
paragraphs, common pitfalls and nonstandard magnification wording. It appears only
after teaching reveal or explicitly configured postsubmission feedback. It is not
a vignette. When present it is the single editable teaching narrative; adequacy and
cancer fields are deterministic projections of their explicit labeled lines.
Missing or ambiguous classification text is flagged, never inferred from a title.
Independent structured observations/learning points/diagnosis cannot conflict with
that canonical narrative. No paragraph is discarded to fit the former form.

`authorContent.curriculumSource` preserves the eight original source cell values,
workbook hash, source sheet and row. Internal Note, Curriculum Role and Teaching
Objective remain private there. Existing private highlight/provenance notes are
unchanged, including when source cells are blank. Images, alignment, regions,
geometry, vignette, category, diagnostic order, eligibility, key and all readiness
flags except content review stay unchanged. Teaching changes clear content review.

Membership references the existing UUID. New membership is pending, or held for
Case 430 / Series 2 (core versus advanced), Case 357 / Series 2 and Case 436 / Series 1
(retention decisions). Import never approves membership, and never re-holds, demotes
or rewrites an administrator-approved one; a source change to an approved membership
is a plan conflict for an administrator. The 59 versus approximately
50 inventory discrepancy remains an owner decision. A later administrator uses
`save_socrates_curriculum_memberships(payload)` with the current module revision and
an explicit decision note to approve or clear a hold. The payload uses
`moduleId`, `expectedRevision` and `memberships` entries with `caseId`, `position`,
`sourceOrder`, `sourceKey`, `state`, `decision`. Approval does not bypass case
publication/readiness. Training curriculum changes never modify study ordering,
pinned revisions, enrollments or answers.

## Explicit atomic apply and retry

Only a completely reconciled plan with every row `ready` or `no-op` can apply.
Membership holds can be stored as holds; they never count as release approval.
Review the generated payload's exact `approvalDigest`, then pass it explicitly:

```sh
npx tsx scripts/socrates/workbook-import.ts apply \
  --plan "$review/reviewed-plan_PRIVATE.json" \
  --approve "$reviewed_digest" \
  --receipt "$review/receipt_PRIVATE.json"
```

The protected RPC locks targets and modules in stable order, checks all expected
revisions, enforces preserved fields and source/image identity again, and uses the
existing save/revision function in one transaction. Any case or membership failure
rolls back the entire batch. Successful receipts contain IDs/revisions/counts, not
author packages. A retry of the identical payload returns its existing receipt;
a fresh unchanged plan makes no writes or duplicate revisions/memberships.

After an uncertain connection result, retry the **identical** plan to obtain the
receipt. After a stale-revision rejection, take a fresh snapshot, compare intervening
edits and rebuild approvals. Never automatically retry a modified payload. Receipt
file creation can fail after a successful database transaction; use a new private
output filename and the identical plan to recover that receipt safely.

## Later authorized release sequence

1. Independently review this PR, back up the intended database and verify its
   existing migration state. Do not infer it from the source audit.
2. Apply `20260923040205_socrates_curriculum_narrative_import.sql`, then
   `20260923042038_socrates_protected_workbook_import.sql` after the prior v2 migration.
   They add metadata/capability only and seed no clinical cases or memberships.
3. Deploy the matching application and verify real Auth, editor/participant access,
   preview and save/reload in staging before an authorized production release.
4. Reconcile all identities and compare current drafts, review a new private plan,
   then obtain authorization for its explicit apply.
5. Review clinical content, provider key, readiness and source membership decisions
   separately. Publication and any study activation remain separate actions.
