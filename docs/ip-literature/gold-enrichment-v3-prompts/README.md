# Gold-set V3 enrichment operator guide

> Artifact category: `operator_only`. Never upload or paste this README, the operator handoff, a
> source prompt template, packet receipt, raw-result schema, run definition, registry, packet index,
> global artifact manifest, model-facing inventory, audit report, merged schema, post-result
> artifact, or any other coordinator artifact into a classification conversation. Upload or paste
> only the exact files marked `model_facing` for one packet in that preparation's checksum-bound
> model-facing inventory.

This pack supports the manual, file-based `gold-set-v1-enrichment-v3` workflow. It does not run a
model, perform the coordinator merge, modify a database, import a review, or expose records outside
the development scope. Its operator handoff may combine already validated raw result values without
coordinator inputs or value changes.

## Frozen versions

| Contract                        | Version |
| ------------------------------- | ------- |
| Workflow schema                 | `3.0.0` |
| Prompt template                 | `3.0.1` |
| Raw result schema               | `3.0.1` |
| Coordinator implementation      | `3.0.1` |
| Raw merge schema                | `1.0.0` |
| Merged artifact schema          | `3.0.2` |
| Validation report schema        | `3.0.2` |
| Readiness schema                | `3.0.2` |
| Taxonomy                        | `2.0.0` |
| Enrichment label schema         | `2.0.0` |
| Enrichment artifact schema      | `2.0.0` |
| Historical relevance definition | `1.0.0` |

Taxonomy V2 enrichment is opt-in. The historical gold-set review taxonomy and label schema remain
`1.1.0` and are not upgraded by this workflow. Physician relevance labels, confidence, identifiers,
membership, split, stratum, display order, and review provenance are immutable inputs.

## Superseded material

Prompt template `3.0.0` is superseded and must never be used for a real classification. Every
preparation created with that prompt version is non-executable historical evidence, including:

- `enrichment-v3-real-prep-a`
- `enrichment-v3-real-prep-b`
- `enrichment-v3-mergecheck-c`
- `enrichment-v3-mergecheck-d`

Do not delete or rewrite those directories. A corrected preparation must use prompt version `3.0.1`,
raw result schema `3.0.1`, and a passing model-input independence audit.

The prepared packet and raw-result contracts remain frozen at `3.0.1`. Coordinator implementation
`3.0.1` and the `3.0.2` post-result schemas add conflict quarantine only after raw structural
validation; they do not authorize editing or rerunning a raw result.

## Classification conversation boundary

Use the generated model-facing inventory as the sole upload authority. Start a new conversation for
exactly one packet and supply only that packet's entries marked `model_facing`:

1. Upload its packet CSV.
2. Paste its fully rendered per-packet prompt. Never paste one of the tracked source templates.
3. For a complete-full-text packet only, upload its packet-scoped full-text manifest and every exact
   checksum-bound external PDF referenced by that packet bundle. Do not substitute, omit, or add a
   file.
4. Do not upload the model-facing inventory itself; it is an operator control file.

The inventory contains exactly 100 logical `model_facing` entries. Fifty are generated artifacts:
20 packet CSVs, 20 rendered prompts, and 10 packet-scoped full-text manifests. The other 50 are
checksum-bound external complete-full-text PDFs marked `external=true` and `generated=false`. Every
packet bundle references each of its authorized generated or external entries by `inventoryPath`.
The preparation does not copy or generate an external PDF; upload one only when its `inventoryPath`
belongs to the current packet bundle and its bytes match the recorded hash.

The rendered prompt already contains the exact packet ID, source projection hash, expected output
filename, and prompt/schema versions. Do not edit it or manually substitute placeholders.

## Manual batch procedure

1. Prepare packets locally with `npm run literature:prepare-gold-enrichment-v3` in a clean tracked
   checkout and a fresh ignored output directory.
2. Confirm the preparation's model-input independence audit passes and that the inventory binds the
   exact hashes of every file marked `model_facing`.
3. Start one new classification conversation and supply only the corresponding model-facing bundle
   described above.
4. Require exactly one downloadable CSV using the inventory's expected filename and no chat prose.
5. Save the returned file unchanged under the run's raw-results directory. Never edit a raw result
   in place.
6. Validate locally with `npm run literature:validate-gold-enrichment-v3-results`. Structurally
   invalid files remain raw evidence; request a fresh result rather than silently correcting them.
   A structurally valid result may instead be retained with
   `valid_with_coordinator_conflicts`; preserve its bytes and route every recorded conflict to
   physician adjudication.
7. After every packet validates and coverage is complete, follow
   [the operator-only raw-result merge handoff](./result-merge-prompt.md). That handoff ends before
   the separate coordinator merge and review stages.

## Model self-assessment boundary

The model-produced `model_requests_physician_enrichment_review` field is only an independent request
based on unresolved ambiguity, internally conflicting supplied evidence, or a processing/evidence
failure. It is not a final coordinator decision. The fixed physician relevance label and confidence
are copy-only audit fields and must not influence any classification, confidence, sufficiency,
processing, or model-request output.

## File-only response rule

Each rendered model-facing prompt requires exactly one downloadable UTF-8 CSV file. Chat prose,
Markdown tables, JSON, code fences, previews, article lists, explanations, and multiple attachments
are invalid responses. The CSV must reopen successfully, retain the exact header and row order, and
contain exactly one output row per input row.

## Evidence boundary

The model may use only canonical article metadata in its packet and, for a complete-full-text packet,
the exact matching files in that packet's manifest. It must not browse the web, retrieve citations,
use outside knowledge, infer missing text, or use information from another workflow or conversation.
A title page, abstract page, citation page, first-page extract, or truncated publisher document is
not complete full text.

## Controlled-value authority

The complete V2 catalog is embedded in both included source templates and in
[the coordinator workflow document](../gold-enrichment-v3-workflow.md). Values are case-sensitive
stable IDs. Aliases and free text are invalid. `legacy_unspecified` is compatibility-only and cannot
be emitted by a V3 result.

## Expected preparation scope

| Packet family                 | Records | Maximum rows per packet |
| ----------------------------- | ------: | ----------------------: |
| Included metadata-only        |     308 |                      50 |
| Included complete full text   |      50 |                       5 |
| Excluded metadata sufficiency |     272 |                     100 |

Preparation covers 630 development records: 358 physician-included and 272 physician-excluded. It
must report zero records outside the development scope, database writes, network requests, model
calls, worker runs, real enrichment results, and import rows.
