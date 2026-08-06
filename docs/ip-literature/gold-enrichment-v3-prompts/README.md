# Gold-set V3 enrichment prompt pack

This pack supports the manual, file-based `gold-set-v1-enrichment-v3` workflow. It does not run a
model, merge a result, modify a database, import a review, or expose held-out records.

## Frozen versions

| Contract                        | Version |
| ------------------------------- | ------- |
| Workflow                        | `3.0.0` |
| Prompt template                 | `3.0.0` |
| Result schema                   | `3.0.0` |
| Taxonomy                        | `2.0.0` |
| Enrichment label schema         | `2.0.0` |
| Enrichment artifact schema      | `2.0.0` |
| Historical relevance definition | `1.0.0` |

V2 enrichment is opt-in. The historical gold-set review taxonomy and label schema remain `1.1.0`
and are not upgraded by this workflow. Physician relevance labels, confidence, identifiers,
membership, split, stratum, display order, and review provenance are immutable inputs.

## Prompt selection

- Use [included-metadata-only.md](./included-metadata-only.md) for an included packet whose rows do
  not have verified complete full text.
- Use [included-full-text.md](./included-full-text.md) only for an included packet accompanied by
  every exact, checksum-bound complete-full-text file named in its manifest.
- Use [excluded-metadata-sufficiency.md](./excluded-metadata-sufficiency.md) for final exclusions.
  It assesses metadata sufficiency only and never requests taxonomy.
- Use [result-merge-prompt.md](./result-merge-prompt.md) only to create a local-command handoff file.
  A model must never repair, normalize, reconcile, or merge returned enrichment rows.

## Manual batch procedure

1. Prepare packets locally with `npm run literature:prepare-gold-enrichment-v3` and retain the
   packet CSV, packet receipt, prompt, and any separate full-text files together.
2. Confirm the packet receipt identifies prompt template `3.0.0`, result schema `3.0.0`, and the
   expected output filename. Do not alter a packet or prompt after preparation.
3. Start a new ChatGPT conversation for one packet. Upload only the packet CSV and the matching
   complete-full-text files when using the full-text prompt. Do not upload prior enrichment,
   external-QA artifacts, taxonomy upgrade candidates, sampling data, or held-out data.
4. Paste the matching prompt. Replace any `{{PLACEHOLDER}}` only with the exact value from the
   packet receipt. The response must be one downloadable CSV and no chat prose.
5. Save the returned file unchanged under the run's raw-results directory using the receipt's exact
   expected filename. Never edit a raw result in place.
6. Validate locally with `npm run literature:validate-gold-enrichment-v3-results`. Invalid files
   remain raw evidence; request a fresh result file rather than silently correcting them.
7. After every packet validates and coverage is complete, run
   `npm run literature:merge-gold-enrichment-v3`. QA and taxonomy-upgrade evidence is overlaid only
   after the independent V3 proposals have been merged.
8. Build the physician artifact with all required paths:

   ```bash
   npm run literature:build-gold-enrichment-v3-review -- \
     --run-dir /absolute/path/to/prepared-run \
     --merge-dir /absolute/path/to/merge-output \
     --output-dir /absolute/path/to/fresh-review-output
   ```

9. Complete `required-review.csv` and `qc-sample-50.csv`. For every row, choose
   `physician_action=accept` or `physician_action=modify`, confirm or edit every applicable
   `physician_*` field, and set `physician_reviewed=true`. A modified row requires nonblank
   `physician_notes`; relevance fields and every non-physician column remain fixed.
10. Finalize both decision CSVs before considering protocol acceptance. If the protocol cohort is
    nonempty, create an explicit post-QC authorization whose hashes bind the merged CSV, review
    receipt, final required-review CSV, final QC CSV, and protocol membership:

    ```json
    {
      "workflow_id": "gold-set-v1-enrichment-v3",
      "merged_sha256": "<merged CSV SHA-256>",
      "review_cohorts_receipt_sha256": "<review receipt SHA-256>",
      "required_review_sha256": "<final required-review CSV SHA-256>",
      "qc_review_sha256": "<final QC CSV SHA-256>",
      "protocol_candidate_membership_sha256": "<receipt membership SHA-256>",
      "authorized": true,
      "authorized_after_qc": true,
      "authorized_by": "<reviewer identity>",
      "authorization_note": "<explicit rationale>"
    }
    ```

11. Run the separate readiness audit:

    ```bash
    npm run literature:audit-gold-enrichment-v3-readiness -- \
      --merge-dir /absolute/path/to/merge-output \
      --review-dir /absolute/path/to/review-output \
      --required-review /absolute/path/to/final-required-review.csv \
      --qc-review /absolute/path/to/final-qc-review.csv \
      --protocol-authorization /absolute/path/to/protocol-authorization.json \
      --output-dir /absolute/path/to/fresh-readiness-output
    ```

12. Inspect `readiness-audit.json`. Even a passing audit creates no import rows, performs no
    database write, and does not itself import or authorize any enrichment. Omit the authorization
    option only when the protocol-acceptance cohort is empty.

## Physician companion CSV boundary

In the required-review and QC companion CSVs, `physician_metadata_sufficiency` is an editable
controlled field, prefilled from the independent V3 `metadata_sufficiency` proposal. It is reviewed
with the other `physician_*` enrichment fields and counts toward whether `physician_action=accept`
or `physician_action=modify` is valid.

Fixed source, proposal, and post-proposal concern cells are checksum- and reconstruction-bound.
Readiness recreates those values from the merged candidate, physician-review candidate report, and
overlay artifacts and rejects any change. Only `physician_action`, the editable `physician_*`
decision fields, and `physician_notes` may be changed in a decision CSV; `physician_reviewed` must
be set to `true` for a completed required-review or QC decision.

## File-only response rule

Each model-facing prompt requires exactly one downloadable UTF-8 CSV file. Chat prose, Markdown
tables, JSON, code fences, previews, article lists, explanations, and multiple attachments are
invalid responses. The CSV must reopen successfully, retain the exact header and row order, and
contain exactly one output row per input row.

## Evidence boundary

The model may use only text supplied in the packet and, for a full-text packet, the exact matching
complete-full-text files. It must not browse the web, retrieve citations, use outside knowledge,
infer missing text, or use old enrichment, QA suggestions, or taxonomy-upgrade candidates. A title
page, abstract page, citation page, first-page preview, or truncated publisher preview is not
complete full text.

The local validator binds each complete-full-text result to the exact filename and SHA-256 and
requires a located excerpt. Because scanned and font-encoded PDFs cannot be reliably quote-checked
from CSV text alone, all 56 manifest records remain in Required Review and the physician verifies
each claimed verbatim quotation against the checksum-bound file.

## Controlled-value authority

The complete V2 catalog is embedded in both included prompts and in
[the workflow document](../gold-enrichment-v3-workflow.md). Values are case-sensitive stable IDs.
Aliases and free text are invalid. `legacy_unspecified` is compatibility-only and cannot be emitted
by a V3 result.

## Expected preparation scope

| Packet family                 | Records | Recommended maximum rows per packet |
| ----------------------------- | ------: | ----------------------------------: |
| Included metadata-only        |     308 |                                  50 |
| Included complete full text   |      50 |                                   5 |
| Excluded metadata sufficiency |     272 |                                 100 |

Preparation covers 630 development records: 358 physician-included and 272 physician-excluded.
It must report zero held-out access, database writes, network requests, model calls, worker runs,
real enrichment results, and import rows.
