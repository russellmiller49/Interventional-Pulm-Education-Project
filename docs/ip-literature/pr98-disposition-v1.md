# PR #98 disposition — autonomous shadow-classifier R&D framework

> Status: read-only audit record, 2026-08-16. The branch
> `codex/ip-literature-autonomous-shadow-rd-v1` was not edited, rebased, merged, or updated.
> This document changes nothing but future planning.

## Summary

PR #98 (+9,765 lines, 29 files, all additions) is a self-contained, zero-network,
zero-database R&D nucleus: its only database contact is one read-only rolled-back psql
transaction against the **local** stack, every artifact lands gitignored under `local-data/`,
and no external API is referenced anywhere. It was written before the dedicated-project
bring-up and before the reviewed-overlay operator, so its corpus target, truth authority, and
several pins are stale. A rebase onto main would be textually clean (zero file overlap with
the 333 files main changed since the merge base), but merging it as-is would (a) red the test
suite on every machine except the author's — one test reads a machine-local absolute path at
import time — and (b) install a second, parallel packet/validator/evaluator lane beside the
existing `ultra-screening` modules for the same four labels.

**Disposition: extract a small set of high-value components into a narrower, reimplemented
classifier package; retire the rest; do not continue the branch.**

## 1. What remains reusable

- **`shadow-classifier/model-packet.ts` — the highest-value file.** A real leakage firewall:
  a strict article-field allowlist plus ~50 forbidden input keys and `physician*` / `gold*` /
  `coordinator*` / `heldout*` prefix bans, enforced recursively over the model-facing payload.
  Nothing equivalent exists in the ultra-screening lane. Port it to protect the Batch API
  payload.
- **`shadow-classifier/evaluation.ts` — the denominator discipline.** Every cohort record is
  accounted into exactly one of eight denominators (selected / attempted / accepted prediction
  / accepted abstention / accepted refusal / rejected-invalid / rejected-missing / no-attempt),
  false-exclusion is the primary metric, and subgroup metrics suppress below n=20. This is the
  "validated distinct PMIDs are the only coverage count" rule, already engineered. Parameterize
  the hard-coded cohort size.
- **`shadow-classifier/held-out-guard.ts` — the capability pattern** (module-private
  `unique symbol` + `WeakMap`, so a spread copy of a scope object is rejected). Reuse the
  pattern; rewrite the membership pin, which derives from the local gold DB and cannot be
  re-derived from the dedicated read-only project.
- **`corpus-inventory-contract.ts` lines ~691-718 — the SQL boundary assertion** (mutation-verb
  denylist, exactly-one positive development predicate, complement-split regex). Fold into the
  classifier lane's own guard tests.
- **`result-validation.ts` — the abstention state machine** (`prediction | abstention |
refusal`, eleven abstention reasons, verbatim-evidence containment, probability simplex +
  unique-argmax checks). Keep the machinery; see the schema decision below.
- **The prepare → operator-executes → ingest shape** of the development-experiment contract:
  content-addressed per-record model inputs (`custom_id = modelInputSha256` is a natural Batch
  key), byte-exact recomputation on ingest, and tolerant accounting (missing → rejected-missing,
  malformed → rejected-invalid, never a silent drop). A Batch API JSONL round trip needs only a
  thin shim: one `.jsonl` instead of one file per record, and batch-id/custom-id in place of the
  operator-attested agent identity.

## 2. What is obsolete after the dedicated bring-up and the reviewed overlay

- **`collect-corpus-inventory.ts`** — targets the local Docker stack, not `itcttmkxdxvwmwcmzmey`,
  and is hard-gated to its own branch name, so it can never execute after any merge.
- **`development-truth-authority.ts`** — pins the same finalized artifact (`961c19f4…`) that
  `scripts/literature-reviewed-overlay/` now consumes through the protected parser with wider
  cross-checks. Two implementations of one authority; the overlay operator supersedes it.
- **`shadow-classifier-components.v1.json` as shipped** — three of its four components
  (metadata sufficiency, full-text need, study design) are outside a relevance-first scope, and
  all four pin a placeholder model id the packet builder deliberately refuses at runtime.
- **`autonomy.ts`** (160 lines asserting inaction), **`canonical.ts`** (a third copy of
  canonical-JSON/sha256 beside ultra-screening's and the ingest operator's), and
  **`shadow-run.ts`** (~991 lines of self-anchored tamper-evidence whose own doc concedes a
  self-hash is not durable immutability) — cost exceeds value for a bibliography-only local lane.
- **Both CLI scripts' absolute paths** into a specific checkout's `local-data/` — including the
  import-time `readFileSync` in `development-experiment.test.ts` that would fail the suite on
  any other machine. This is the single hard blocker to merging the branch at all.

## 3. Conflicts with a minimal relevance-first schema supporting abstention

- **`insufficient_evidence` does not exist as an output value.** The PR's vocabulary keeps
  `uncertain` as a label and models insufficiency as `state: 'abstention'` with reasons
  (`insufficient_abstract`, `metadata_insufficient`). A relevance-first schema that wants
  `insufficient_evidence` as a first-class outcome must decide explicitly: fifth label, or
  abstention-state mapping. Inheriting the PR silently decides it by accident.
- **Duplication against `ultra-screening`.** Main already ships packet schema, output
  validation, evaluation, deterministic sampling/chunking, and canonical JSON for the same four
  labels. Merging PR #98 unchanged installs a second of each in the same feature directory.
- **Cross-fitted repeated K-fold calibration** does not match a fit-on-development /
  apply-to-frozen design (though its temperature search is fold-agnostic and portable).

## 4. Does it safely support the intended 430/200 split?

**Not as written; safely adaptable.** Folds are assigned `index % K` within seeded,
label-stratified hash order, so no integer K yields a 200-record validation fold. But the
primitive is exactly right: the fold builder demands the full authorized 630-record cohort
(anything else throws), re-checks every record through the per-PMID scope capability, and
partitions strictly _within_ the cohort — it structurally cannot reach outside it, and the
audit confirmed zero complement constructs, zero sampling-arithmetic reads, and zero held-out
identity access anywhere in the PR (every occurrence of the other split's name is a rejection
assertion or a guard regex). Converting `index % K` to a per-stratum rank cut produces a
seeded, stratified 430/200 in a few lines. One cleanup for the port: the corpus-inventory
contract embeds a TypeScript-side constant stating the sealed split's expected size in an
artifact metadata field (never queried — the strict payload schema cannot even accept such a
value from the database). The classifier lane's artifacts should not carry that number at all.

## 5. Continue, extract, reimplement, or retire?

**Extract and reimplement; retire the branch.** Concretely:

- port, with attribution, the five components in §1 into a fresh
  `scripts/literature-classifier-lane/` + a small `src/features/literature/classifier/` core,
  written against the reviewed-overlay truth boundary (the overlay's projection digest is the
  truth identity) and the recorded API policy (`classifier-api-policy-v1.md`);
- reimplement folds (rank cut), calibration (fit/apply), and the result schema (explicit
  `insufficient_evidence` decision) small;
- do not merge PR #98; after extraction, close it with a comment pointing at this disposition
  (owner action — nothing in this session touched the PR).

## 6. Branch and base strategy for the classifier lane

Start `claude/literature-classifier-lane-v1` **from `origin/main` after the reviewed-overlay
PR merges** — the lane consumes the overlay package's constants (artifact pin, cohort identity,
projection digest) and must not duplicate them. Do not base on, rebase, or cherry-pick from
`codex/ip-literature-autonomous-shadow-rd-v1`: everything worth keeping is small enough to
port deliberately, the branch's pins are stale, and its one import-time absolute path makes
its test suite unmergeable as-is. If classifier work must begin before the overlay merges,
base on `claude/literature-reviewed-overlay-v1` and rebase onto main at merge; never fork from
the PR #98 branch.
