# Luna universal triage platform V1

> Status: implemented 2026-08-17 on `claude/literature-luna-universal-triage-v1`. Local,
> calibration-ready Stage-A platform. No API call, no Batch submission, no production write
> occurred in the implementing session, and nothing here grants authority for any.

## Staged architecture

- **Stage A (this platform):** universal evidence-adaptive _negative triage_ over the whole
  fixed 132,350-record corpus. Its only power is to nominate low-risk
  `deprioritization_candidate`s; everything else advances.
- **Stage B (contract prepared, not run):** four-way relevance classification —
  `include_core | include_adjacent | exclude | insufficient_evidence` — over every record not
  safely routed by Stage A, every risk-flagged negative, every physician rescue, and every
  invalid/missing/quarantined Stage-A record
  (`src/features/literature/classifier/stage-b-contract.ts`).
- **Stage C (out of scope):** detailed IP technology/disease/study-design enrichment over
  likely-relevant or unresolved records.

AI output never modifies `relevance_state`, `reviewed_relevance`, visibility, searchability,
article existence, or physician truth. Stage A is a router between machine stages, gated by a
qualification test and physician review; it is not clinical validation.

## Authorities (imported, never re-declared)

| Authority            | Source                                                                                                                                                                                                 | Pin                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Physician truth      | operator-supplied finalized 630-row artifact through `scripts/literature-reviewed-overlay/artifact.ts` (protected parser underneath)                                                                   | SHA-256 `961c19f4…0f59`; census 630 = 283/75/272; relevant 358; provenance 192/133/305 (`truth.ts` re-asserts all of it)                                         |
| Bibliographic corpus | `streamGuardedReadOnlyQuery` + the committed `buildSourceSql('full')` read from `scripts/literature-production-ingest/source.ts` (pinned Docker container, read-only repeatable-read, framed protocol) | exactly 132,350 distinct records in C-collation PMID order, plus an ordered-PMID identity digest recorded on first read and compared forever after (`corpus.ts`) |
| Reviewed projection  | `docs/ip-literature/reviewed-overlay-v1.md`                                                                                                                                                            | digest `6bdc086a…8ff7` identifies the merged reviewed set; this lane consumes the same constants module                                                          |

Any count or identity drift stops the lane. All reporting is aggregate-only: no PMID, title,
or note ever reaches stdout, logs, errors, or committed artifacts.

## The universal evidence-adaptive packet

`src/features/literature/classifier/packet-contract.ts` — exactly ten fields:
`record_id` (opaque), `title`, `abstract` (string or explicit null), `journal`,
`publication_year`, `publication_types`, `mesh_terms`, `keywords`, `language`,
`evidence_profile` (`metadata_with_abstract | metadata_without_abstract`, derived from
blank-after-trim abstract presence — abstracts are never hidden when available).

Admission is a structural **allowlist** (strict schema, unknown fields rejected) plus a
recursive normalized forbidden-key firewall (PR #98's model-packet concept, reimplemented):
~60 normalized keys (identity, physician truth, review state, membership, counts,
credentials, SQL, paths) and the prefixes `physician* gold* coordinator* heldout* review*
enrichment* provenance* supabase* truth* sanity*` are rejected at every depth, with the
offending path — never the value — in the error.

`record_id = sha256(recordIdVersion ∥ operationSalt ∥ pmid ∥ contentSha256)`: opaque,
operation-scoped, and content-bound (changed bibliography ⇒ different id). The
PMID ↔ record-id mapping is coordinator-owned, mode 0600, inside the operation directory, and
never model-facing.

## Stage-A output, reason codes, routing

`src/features/literature/classifier/stage-a-contract.ts`:

- Strict output: `{record_id, triage_decision, confidence_band, reason_codes}` — no
  free-text rationale. Confidence is ordinal self-report, not a calibrated probability.
- Closed reason vocabulary: 5 negative-only codes (usable only with `obvious_irrelevant`)
  and 13 protective/escalation codes (usable only with `potentially_relevant` /
  `insufficient_evidence`). Any protective code makes `obvious_irrelevant` schema-invalid.
- Routing: only a schema-valid, identity-bound, **high**-confidence `obvious_irrelevant`
  with exclusively negative-only reasons and **zero coordinator risk flags** enters
  `deprioritization_candidate`. Invalid, malformed, missing, duplicate, refused, quarantined,
  and unattempted records advance by default and are never treated as negative.

## Coordinator risk layer

`src/features/literature/classifier/risk-lexicon.ts` — a deterministic, versioned lexicon
(17 flags: pulmonary, thoracic, airway, pleural, lung cancer, mediastinal, bronchoscopy,
pulmonary procedure, thoracic oncology, respiratory failure, critical care, anesthesia,
pathology, imaging, procedural complication, legacy terminology, title/abstract mismatch)
scanned over title/abstract/journal/MeSH/keywords. It never reads Luna's reasons. Any flag
bars the automatic pool and makes the record mandatory physician review.

## Deterministic 430/200 split

`split.ts`: strata = physician class × abstract presence (six), largest-remainder
apportionment of the 200 locked-sanity quota, SHA-256 rank order under seed
`literature-luna-split-v1` (the repository's NUL-joined convention via
`deterministicPmidOrder`). All 630 appear exactly once; identity lists are local 0600 files;
the committable manifest carries aggregate strata plus digests only. The locked 200 is never
used for prompt iteration; `run-locked` demands a freeze receipt and consumes a create-once
per-calibration-version marker — one locked run per frozen calibration, failures included.

## Freeze, evaluation, qualification

- `freeze.ts` pins model, alias, reasoning effort, prompt hash, output-schema hash, reason
  vocabulary hash, packet schema version, risk-lexicon version, split-manifest hash,
  evaluation version, and cost-estimator version into one self-checksummed receipt;
  `assertFreezeReceiptCurrent` names every drifted field.
- `evaluation.ts` implements denominator discipline (PR #98's evaluation concept,
  reimplemented): selected / attempted / valid predictions / valid abstentions / refusals /
  invalid-quarantined / missing / duplicate / no-attempt, arithmetic reconciliation asserted;
  metric names carry denominators; zero denominators yield null; subgroups below n=20
  suppress rates but report support; a relevant record predicted `insufficient_evidence` is
  an abstention, never a false exclusion.
- `qualify.ts` encodes the eight-criterion shadow-routing gate (zero core / zero adjacent in
  the high-confidence bucket, zero relevant routing errors in both evidence profiles, 100%
  bucket precision, ≥40% exclude yield, no systematic category miss, complete denominators,
  full review-interface coverage of the bucket).

## Runner, Batch, filesystem

- `openai.ts` is the only network module. Spend requires `--confirm-api-spend` **and** an
  interactively typed `SPEND <operation-id>` phrase, minted into a module-private
  symbol+WeakMap capability (PR #98's held-out-guard pattern, repurposed): copies and
  serialized imitations fail. The API key exists only as `process.env.OPENAI_API_KEY` inside
  the request function; errors pass through redaction; there is no retry and no semantic
  repair anywhere.
- `estimate.ts` is the versioned deterministic cost estimator; `--max-records` and
  `--max-estimated-cost-usd` are enforced before any socket opens.
- `batch.ts` prepares deterministic content-addressed JSONL shards under record and
  estimated-token ceilings (the corpus is never assumed to fit one job), and wraps
  submission/status/retrieval/parse behind the same gated socket.
- `results.ts` is strict ingestion: byte-preserving quarantine wrappers, identity binding of
  outputs to request custom ids, duplicates as their own advancing terminal state, exhaustive
  exactly-one accounting re-asserted arithmetically.
- `state.ts`: every real artifact is gitignored under `local-data/literature-luna-triage/`,
  directories 0700 (chmod-hardened), files 0600, create-once (`wx`) or content-addressed,
  symlinked parents refused, containment enforced.

## Physician review

`review-app.ts` + `review-page.ts`: a loopback-only (`127.0.0.1`, Host-checked) node server
with an embedded single page. No Supabase, no API key, reads operation artifacts only, writes
create-once 0600 decision revisions and exports (`physician_override_manifest`,
`physician_confirmed_deprioritization`, `physician_rescued_for_stage_b`,
`systematic_miss_flags`, audit receipt). Cards show the full packet fields, Luna decision,
band, reasons, and risk flags; keys R/D/U/F decide, J/K/arrows navigate; filters cover review
state, confidence, decision, reason, profile, journal, year band, publication type, and risk
flag; the full negative queue stays browsable for continuous skim. `audit.ts` draws the
deterministic stratified audit sample of low-risk candidates (risk-enriched negatives are
mandatory review, never sampled), and an AI routing proposal does not wait for every low-risk
negative to be reviewed.

## Rollout (commands in `scripts/literature-luna-triage/README.md`)

1. corpus inventory → 2. split → 3. smoke-30 packets/requests/sync run → 4. development-430
   run → 5. freeze → 6. one locked-200 run → 7. evaluate + qualify → 8. pilot-1000 →
2. full-corpus Batch preparation → 10. separately authorized Batch submission → 11. physician
   review + audit → 12. Stage-B routing manifests. Every spending step needs its own explicit
   owner confirmation; this document authorizes none of them.
