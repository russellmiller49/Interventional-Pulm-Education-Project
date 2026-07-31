# IP Literature pilot-v1 readiness review

## Decision

The completed `pilot-v1` export is technically ready to seed the next gold-standard stage, with
targeted follow-up preserved as regression and editorial review work. Do not use the pilot as a
population accuracy estimate and do not start Phase 2 classification from it alone.

The source CSV remains outside Git. The analyzed input contained 100 completed decisions and had
SHA-256:

```text
f92e8fe4bf3abc02e76371acdb25d941b6cafcaf0949aff9273731b91c13ee08
```

The source CSV does not embed its batch's historical contract versions. This readiness analysis
validated its decisions against taxonomy `1.1.0`, label schema `1.1.0`, relevance definitions
`1.0.0`, and the `stratified-v2` comparison bands below. Before importing or freezing the legacy
pilot, verify its stored batch versions separately; the new versions are the lock for the next
gold-standard batch, not a retroactive restamp of `pilot-v1`.

The no-database analysis command was:

```bash
npm run literature:analyze-gold-set -- \
  --input /absolute/path/pilot-v1-all.csv \
  --batch pilot-v1 \
  --expected-count 100
```

## Completion and review integrity

- 100/100 unique items have completed decisions.
- All records are development-only and all current decisions are marked blinded.
- Relevance: 54 core IP, 14 adjacent, 32 exclude, and 0 uncertain.
- Confidence: 83 high, 15 moderate, and 2 low.
- Eight current decisions are revisions: seven revision 2 and one revision 3.
- Five decisions used supplemental metadata and seven required full-text categorization.
- All 17 broad topics are represented.

The CSV is a current-state export. It identifies revised decisions but does not contain the
superseded labels or change reasons; retain a JSON export with full history before freezing the
pilot batch.

## Sampling defect found

`stratified-v1` intended to sample a boundary stratum but produced none:

| Original sample stratum | Records | Included | Excluded |
| ----------------------- | ------: | -------: | -------: |
| Strong likely IP        |      29 |       29 |        0 |
| Likely non-IP           |      29 |       14 |       15 |
| Discovery only          |      24 |       13 |       11 |
| Challenging metadata    |      18 |       12 |        6 |
| Ambiguous boundary      |       0 |        0 |        0 |

Production suggestion scores clustered into low or high bands. The sampler silently redistributed
all missing boundary slots, so the pilot could not directly test the intended decision boundary.

`stratified-v2` uses the pilot-calibrated sampling thresholds:

- low: score below `0.10`;
- intermediate: score from `0.10` up to, but not including, `0.75`; and
- high: score at least `0.75`.

| Calibrated band | Records | Included | Excluded |
| --------------- | ------: | -------: | -------: |
| High            |      36 |       36 |        0 |
| Intermediate    |      30 |       23 |        7 |
| Low             |      34 |        9 |       25 |

This yields a real mixed boundary band. The values are sampling diagnostics from an enriched
development pilot, not sensitivity, specificity, prevalence, or deployable classifier thresholds.

## Follow-up collections

Preserve the original-high exclusions as hard-negative regression candidates:

```text
42252704
41965808
32196790
```

Preserve the calibrated-low inclusions as hard-positive regression candidates:

```text
24142789
16921138
24758919
42327556
23796143
37261786
28323723
33153516
30429733
```

Recheck the two low-confidence decisions before freezing:

```text
17890073
28726536
```

The full set should deliberately improve coverage of the seven unused technology tags, two unused
clinical-purpose labels, five unused study-design labels, and four unused publication-status
labels. Coverage quotas should remain sampling goals rather than inferred clinical judgments.

## Gold-standard safeguards added

- The CSV restore contract now requires the exact versioned export shape and rejects truncated,
  malformed, mixed-batch, duplicate, or state-inconsistent rows.
- Automatic pilot and gold-standard sampling excludes PMIDs already used in earlier automatic
  batches. This prevents a reviewed pilot article from leaking into the held-out test split.
- Sampling reports warn when any requested stratum lacks enough eligible candidates before slots
  are redistributed.
- Revised taxonomy and label contracts are versioned as `1.1.0`; relevance definitions remain
  `1.0.0`; the sampling algorithm is `stratified-v2`.
- The admin application blocks gold-standard test reads and test/all exports, while database
  triggers block mutation and composition changes, until the development split is complete and an
  administrator records an explicit, irreversible audit reason to unlock the test.

## Operational sequence

Database mutations remain primary-checkout-only:

1. Dry-run and import the completed CSV into `pilot-v1`.
2. Export JSON with `--include-history`.
3. Recheck the listed low-confidence decisions and freeze the pilot.
4. Generate the 900-item `gold-set-v1` report. Prior pilot PMIDs are excluded automatically.
5. Inspect the stratum warnings and controlled-label coverage, then create the batch.
6. Complete only the development split.
7. Unlock the held-out test through the audited UI action and perform one final evaluation.
