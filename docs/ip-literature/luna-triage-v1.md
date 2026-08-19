# Luna universal triage platform V1

> **Scope of PR #114 — offline preparation only.** This platform prepares Stage-A triage; it
> does not execute it. It does not call OpenAI, does not submit or retrieve a Batch job, does
> not run the locked 200, and does not declare qualification. There is no credential read, no
> transport, and no remote host anywhere in its executable module graph. Remote execution and
> the locked/qualification coordinator return as separate PRs with their own review and their
> own owner spend authorization.
>
> Status: implemented 2026-08-17, narrowed to the offline core 2026-08-18, on
> `claude/literature-luna-universal-triage-v1`. No API call, no Batch submission, no Supabase
> write, no migration, no deployment, and no prediction load occurred in any session on this
> branch, and nothing here grants authority for any.

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
future qualification test and by physician review; it is not clinical validation.

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
  with exclusively negative-only reasons and a **schema-valid, record-bound risk-analysis
  result reporting zero flags** enters `deprioritization_candidate`. Invalid, malformed,
  missing, duplicate, refused, quarantined, and unattempted records advance by default and are
  never treated as negative.
- Independent risk analysis is _mandatory evidence_, not optional metadata:
  `stageARiskAnalysisResultSchema` validates the stored result, and a record whose risk result
  is missing, duplicated, foreign, or malformed can never be read as zero risk. The
  coordinator asserts exact set equality between selected record ids and risk-analysis record
  ids (`assertExactRiskAnalysisCoverage`) before routing, and `routeStageARecord` re-validates
  the individual result and advances the record if it is unusable.

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
the committable manifest carries aggregate strata plus digests only.

The locked 200 remain a **future** evaluation authority: this release constructs them
deterministically and locally and then refuses them everywhere else. There is no locked-run
command, no freeze receipt, and no locked-sanity packet set. `packets --cohort
locked-sanity-200` is refused outright; every preparation command additionally refuses actual
membership, so an operation relabelled `development-430` while carrying one locked identity is
refused before any request bytes exist (`locked.ts`, `assertGenericCommandNotLocked` +
`assertNoLockedMembership`). `full-corpus` is the one documented exception to the membership
check: it is the entire 132,350-record corpus rather than a selection of it, and nothing in
this release can send it.

## Evaluation (descriptive), and the qualification boundary

- `evaluation.ts` implements denominator discipline (PR #98's evaluation concept,
  reimplemented): selected / attempted / valid predictions / valid abstentions / refusals /
  invalid-quarantined / missing / duplicate / no-attempt, arithmetic reconciliation asserted;
  metric names carry denominators; zero denominators yield null; subgroups below n=20
  suppress rates but report support; a relevant record predicted `insufficient_evidence` is
  an abstention, never a false exclusion.
- The report is **descriptive only**. It carries no aggregate verdict, no pass flag, and no
  field a caller could read as a release decision. `evaluationReportSha256` records what was
  reported; it does not endorse it.
- The shadow-routing qualification gate is **not in this release**. Deciding that a model
  qualified is a release decision that requires the locked 200, a frozen execution surface,
  and a once-per-freeze run marker — none of which exist here. It returns with the locked
  coordinator, in its own reviewed PR. `qualify` and `freeze` are withheld commands that
  refuse by name with that explanation.

## Request preparation, Batch preparation, filesystem

- `request.ts` is pure: packet + parameters in, exact Responses request bytes and their digest
  out. It holds no credential, no endpoint host, no transport, and no capability. `runner.ts`
  is likewise pure preparation — packets sorted by record id, one deterministic body each, and
  a manifest digest over the ordered body digests.
- **There is no network module.** The former `openai.ts` — spend capability, endpoint URL
  construction, key provider, and the single socket — is deleted from this PR rather than
  left exported-but-unreachable, because an unreachable transport in the package is still a
  transport in the package. `offline-surface.test.ts` walks the CLI's transitive relative
  import closure and asserts no lane source names a credential, a remote host, or a client
  transport construct, reachable or not.
- `estimate.ts` is the versioned deterministic cost estimator. `--max-records` and
  `--max-estimated-cost-usd` still bite: they gate the prepared plan, which is how a plan is
  judged before anyone is asked to authorize sending it.
- `reconcile.ts` recomputes every count from the prepared bytes themselves rather than from
  plan metadata that travelled beside them, and both `prepare-requests` and `batch-prepare`
  refuse to record a plan whose metadata and bytes disagree.
- `batch.ts` prepares deterministic content-addressed JSONL shards under record and
  estimated-token ceilings (the corpus is never assumed to fit one job), and parses Batch
  output/error JSONL that reaches the machine some other way into accounted raw records. A
  request whose own estimate exceeds the per-shard token ceiling is refused before any
  rollover decision — it cannot fit any shard, so rolling it into a fresh one would only mint
  an oversized shard; equality with the ceiling fits, and invalid token estimates are refused
  outright. Upload, Batch creation, status polling, and result retrieval are **not present**;
  Batch submission is documented as a future separately reviewed adapter.
- `results.ts` is strict ingestion: byte-preserving quarantine wrappers, identity binding of
  outputs to request custom ids, duplicates as their own advancing terminal state, exhaustive
  exactly-one accounting re-asserted arithmetically.
- `state.ts`: every real artifact is gitignored under `local-data/literature-luna-triage/`,
  directories 0700 (chmod-hardened), files 0600, create-once (`wx`) or content-addressed,
  symlinked parents refused, containment enforced.

## Physician review

`review-app.ts` + `review-page.ts`: a loopback-only node server bound to `127.0.0.1`, with an
embedded single page. `parseLoopbackHostHeader` parses the Host header as an authority and
accepts only the exact hostnames `localhost`, `127.0.0.1`, and `::1` (bracketed when ported),
with a valid optional port — whole-authority equality, never a prefix test, so
`localhost.evil.example` and `127.0.0.1.evil.example` are refused along with userinfo forms,
comma-joined authorities, whitespace or control characters, malformed IPv6, out-of-range ports,
wildcards, `0.0.0.0`, `[::]`, and every non-loopback address. No DNS resolution happens. No Supabase, no API key, reads operation artifacts only, writes
create-once 0600 decision revisions and exports (`physician_override_manifest`,
`physician_confirmed_deprioritization`, `physician_rescued_for_stage_b`,
`systematic_miss_flags`, audit receipt). Cards show the full packet fields, Luna decision,
band, reasons, and risk flags; keys R/D/U/F decide, J/K/arrows navigate; filters cover review
state, confidence, decision, reason, profile, journal, year band, publication type, and risk
flag; the full negative queue stays browsable for continuous skim. `audit.ts` draws the
deterministic stratified audit sample of low-risk candidates (risk-enriched negatives are
mandatory review, never sampled), and an AI routing proposal does not wait for every low-risk
negative to be reviewed.

## The executable command inventory

Exactly twelve commands, all offline: `audit-sample`, `batch-prepare`, `estimate`, `evaluate`,
`ingest`, `inventory`, `packets`, `prepare-requests`, `review-app`, `review-queue`, `route`,
`split`. The list is a closed object literal in `cli.ts`, exported as `LUNA_CLI_COMMANDS` and
pinned by test against both the source literal and the runtime dispatch table.

Seven names are **withheld** rather than merely absent — `run-sync`, `run-locked`,
`batch-submit`, `batch-status`, `batch-fetch`, `qualify`, `freeze`. Each refuses by name with
its reason before any flag is parsed, any state directory is resolved, or any file is opened.
Naming them is deliberate: a capability that vanished without explanation invites someone to
reimplement it, while one that refuses with its reason states that it was removed on purpose
and names what has to happen before it returns.

## Rollout (commands in `scripts/literature-luna-triage/README.md`)

What this release can do, in order: 1. corpus inventory → 2. split → 3. packets for a
permitted cohort → 4. `prepare-requests` + `estimate` → 5. `batch-prepare`. Then, once Stage-A
result files exist on the machine by some other route: 6. `ingest` → 7. `route` → 8. `evaluate` (descriptive) → 9. `review-queue` + `audit-sample` → 10. `review-app` for
physician review and export → 11. Stage-B routing manifests.

What this release cannot do, and which future PR owns it:

| Deferred capability                      | Owner                                                                   |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| Synchronous `/responses` execution       | Remote transport adapter PR (own threat model, own spend authorization) |
| Batch upload / create / status / fetch   | Same transport adapter PR, or a dedicated Batch adapter PR              |
| The one locked 200-record run            | Locked coordinator PR (freeze receipt, once-per-freeze marker)          |
| The shadow-routing qualification verdict | Locked coordinator PR                                                   |
| Loading predictions into production      | Separate production-write PR                                            |

Every one of those needs its own explicit owner confirmation; this document authorizes none
of them.

## Independent review and correction (2026-08-18)

The first independent review of PR #114 returned **BLOCKED** with five concrete offline
reproductions. All five are corrected on the same branch, each with load-bearing regressions
that fail against the original implementation:

- **LUNA-ROUTE-001** — a selected record with no independent risk result became `riskFlags: []`
  and could reach `deprioritization_candidate` at high confidence. Independent risk analysis is
  now mandatory evidence with exact one-to-one coverage asserted at the coordinator and
  re-validated per record; there is no missing-means-no-risk fallback anywhere.
- **LUNA-SPEND-001** — negative and NaN costs and record counts could mint spend authority, and
  one capability could be reused without bound. The envelope is now numerically validated,
  bound to an exact action / operation / plan / request set, and consumed through a bounded
  at-most-once ledger; every refusal opens zero sockets.
- **LUNA-BATCH-001** — an individually oversized first request was accepted as a one-record
  shard. Oversized and invalid per-request estimates are now refused before rollover.
- **LUNA-QUALIFY-001** — a one-record `development-430` evaluation could report qualified.
  Qualification was first hardened to require checksum-bound evidence of the exact frozen
  locked-sanity-200 run, and is now removed from this PR entirely: no code path here can claim
  that a model qualified.
- **LUNA-REVIEW-001** — Host validation used a prefix check, so `localhost.evil.example`
  passed. Host authorities are now parsed and matched exactly.

No API call, Batch submission, Supabase write, migration, deployment, or prediction load
occurred in the correction pass, and none is authorized by it.

## Narrowing to the offline core (2026-08-18)

The owner-defined final closure review reproduced further failures in the **remote execution**
and **locked-run authority** surfaces specifically: mandatory network steps could be skipped,
byte-derived cost could be understated, uploaded-file identity was caller-substitutable,
cross-Batch file retrieval remained caller-bindable, and generic execution could proceed
without authority to determine actual locked membership.

Rather than redesign those protocols again inside this PR, the owner invoked the previously
defined fallback: **narrow PR #114 to the offline classifier preparation, evaluation, routing,
and physician-review platform**, and remove or source-disable every remote-execution and
authoritative locked-run/qualification surface.

Removed from this PR: `openai.ts` (the entire spend-capability, endpoint, key-provider, and
socket module), `qualify.ts`, `freeze.ts`, the synchronous executor in `runner.ts`, and the
upload/create/status/fetch half of `batch.ts` — together with the `run-sync`, `run-locked`,
`batch-submit`, `batch-status`, `batch-fetch`, `qualify`, and `freeze` commands, the
`OPENAI_API_KEY` environment name, and the OpenAI base URL.

Retained, and still fully tested: the 132,350 corpus authority, the checksum-bound 630
physician truth and its 283/75/272 and 192/133/305 contracts, the ten-field packet schema and
its structural leakage firewall, opaque record ids with 0700/0600 storage, the deterministic
430/200 split, the Stage-A decision/reason schema, the independent risk lexicon, fail-closed
routing with refusal dominance, offline token and cost estimation, deterministic Responses
request preparation, deterministic Batch JSONL preparation and sharding, strict result parsing
and quarantine, exact set-equality accounting, descriptive evaluation, the loopback review app
with its review decisions/audit sampling/exports/routing manifests, the Stage-B contract, and
production/static isolation.

The narrowing is enforced by regression, not by convention: the CLI inventory is pinned
exactly, each withheld command is proven unavailable and side-effect-free, and the transitive
import closure of the CLI is proven to contain no credential name, no remote host, and no
client transport construct.
