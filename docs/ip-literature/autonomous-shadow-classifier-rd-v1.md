# Autonomous literature shadow classifier R&D v1

## Status and claims boundary

This is a development-only, evidence-only safety and experiment pipeline. The core connects to no
database or network and dispatches no model. A file-only command can read one fixed, checksum-bound
630-record development source, prepare model inputs, ingest operator-attested result files, and—only
after a run receipt exists—load one fixed finalized truth file for evaluation. It never enumerates
or reads the sealed held-out set, exposes an API/UI route, changes production configuration, or
authorizes a production decision. This implementation has not itself run the 630-record experiment,
so it makes no performance claim.

Development-fold results produced later must say **development-only**. They are not held-out
validation. The synthetic 630-row membership fixture used by tests is permanently marked
`synthetic_fixture`, `experimentEligible: false`, and `fullDevelopmentCohortClaimAuthorized: false`.

## Safety architecture

The nucleus separates coordinator-only authority from model-facing evidence:

1. `held-out-guard.ts` accepts only an exact 630-row, unique, numeric PMID projection bound to one
   approved checksum authority. It rejects `test`, `all`, complement selection, held-out identity
   input, and test/all queue inspection before issuing an opaque capability. The private symbol plus
   private `WeakMap` prevents structurally forged or copied descriptors from acting as capabilities.
2. `model-packet.ts` consumes that capability only to authorize one PMID. The capability and its
   descriptor are not serialized into the model packet. The packet has a strict article metadata
   allowlist and recursively rejects physician labels, gold targets, review history, split/queue or
   membership data, coordinator rules, sampling clues, and component target fields.
3. `registry.ts` loads independently versioned, immutable classifier components. Every component
   declares inputs, vocabulary, invalid-output handling, prompt/model provenance requirements,
   evidence fields, confidence semantics, and abstention semantics. It declares no database writer
   or workflow authority.
4. `result-validation.ts` accepts only strict, packet-bound output. Unsupported vocabulary,
   incomplete provenance, invented evidence, malformed state, or missing output produces no
   prediction. Worker probabilities can only be model-supplied and explicitly uncalibrated;
   calibrated claims require the authenticated cross-fitted coordinator artifact and are rejected
   at the raw result boundary.
5. `routing.ts` recomputes mandatory abstention from authenticated packet and validation evidence.
   Missing abstracts, required-but-unavailable full text, invalid/missing output, refusal, all B7
   abstention reasons, and explicit classifier disagreement route to human review regardless of
   self-reported confidence. Routes always have `automaticAction: null` and
   `productionStateChanged: false`.
6. `shadow-run.ts` persists every assigned packet exactly once, including missing and invalid
   results. Packets, raw results, validations, routes, attempts, manifests, and an append-only event
   chain are content-addressed and recomputed during verification. These are tamper-evident only
   after their checksum is anchored outside the artifact; a self-hash is not durable immutability.
   Replay and rollback preserve the complete prior artifact rather than rewriting history. A future
   append-only store or signature is required for durable independent anchoring.
7. `autonomy.ts` describes levels 0–5 for future governance but hard-caps this runtime at level 1.
   Every publish, hide, exclusion, relevance, visibility, gold-label, review-pointer, reveal,
   test-unlock, and database-write effect is hard-coded false.

## Initial four-component minimum slice

The versioned registry contains four replaceable components:

- `ip_relevance`: core, adjacent, exclude, or uncertain scope classification;
- `metadata_sufficiency`: abstract/metadata sufficiency classification;
- `full_text_need`: whether classification requires full text;
- `study_design`: study-design vocabulary classification.

This is a minimum architectural slice, not a complete four-component experiment. The current
file-only experiment prepares `ip_relevance`; it must not be described as a completed combined
four-component workflow or independent adjudicator. Planned extension points are
publication status/type, technology tags, disease tags, clinical purpose, topic assignment,
evidence sufficiency, confidence calibration, disagreement detection, and a separately versioned
adjudicator. Adding one component changes only its registry record, prompt, adapter, focused tests,
and any explicit comparison group; sibling component identities remain unchanged.

Registry model IDs are placeholders only. Packet construction requires a concrete adapter version,
model identity, and reasoning level for every attempted execution and refuses the placeholder.

## Root of trust and future integration

The database inventory command has a fixed Docker context/container/socket/database/user and one
committed aggregate read-only SQL transaction. The experiment command has no database or model
dispatch capability and accepts no source path, PMID, split, queue, candidate list, or held-out
selector. It reads only the fixed `enrichment-source-v2.csv` path with SHA-256 `d2942507…`, proves
the exact 630 projection before any per-PMID operation, and writes hash-named `modelInput` JSON in
21 label-independent chunks of 30. Coordinator packet provenance lives in a separate directory.

Ingestion reauthenticates repository commit, configured registry, source, prepared manifest, every
model-facing input byte, and an exact response-file allowlist. Missing, malformed JSON, invalid
UTF-8, invalid envelope, or invalid chronology becomes an explicit missing/invalid attempt rather
than aborting cohort accounting. Valid worker receipts retain operator-attested (not
cryptographically verified) adapter/model/reasoning, agent/execution ID, timestamps, input hash,
and file hash.

Finalization then reads only the fixed finalized 630 truth file with SHA-256 `961c19f4…`. Raw bytes
mint an opaque coordinator truth capability; copied or rehashed serialized labels cannot authorize
evaluation. It writes exact-real-630 evaluation, deterministic internal folds, cross-fitted
temperature calibration, and a content-addressed receipt. Folds are development-only, never held
out. Brier/ECE use only valid probabilities; no operational threshold is selected.

Commands (after commit, from a clean repository state):

```text
npx tsx scripts/shadow-literature-rd/run-development-experiment.ts prepare --created-at <ISO> --model-id gpt-5.6-sol --reasoning-level ultra
npx tsx scripts/shadow-literature-rd/run-development-experiment.ts ingest --prepared-directory <fixed output> --created-at <ISO after workers> --run-id <id>
npx tsx scripts/shadow-literature-rd/run-development-experiment.ts finalize --prepared-directory <fixed output>
```

## Scientific limitations

- Model self-confidence is uncalibrated and cannot select an operational threshold.
- Shared prompt/model lineage is reported as correlated-failure risk, not treated as independent
  ensemble evidence.
- No prospective study, actual development-fold performance experiment, held-out validation,
  public-beta evaluation, or production threshold was run or selected.
- A classifier output can only create content-addressed shadow evidence and a human-review route. It cannot
  include, exclude, publish, hide, alter visibility, alter review state, or unlock test data.

## Safe extension checklist

Before a future experiment, require a real fixed development collector, exact 630 membership
authority, immutable packet inventory, concrete model/prompt provenance, complete attempted-count
reporting, and development-only labels. Before any level above 1, require a separate reviewed
implementation, sealed held-out validation performed under new authorization, prospective shadow
validation, calibration review, false-exclusion thresholds, rollback proof, and explicit owner
approval.
