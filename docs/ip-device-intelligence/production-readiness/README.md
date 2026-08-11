# Device Intelligence production-readiness evidence packet

> **NON-GOVERNED RESEARCH CANDIDATES**
> **NOT CONSUMED BY RUNTIME**
> **PHYSICIAN REVIEW REQUIRED BEFORE ADOPTION**

Research cutoff: `2026-08-10`.

This directory is a read-only evidence and production-readiness packet for the Device and Procedure
Intelligence Platform. It is grounded in frozen commit
`2f26cb7632fe4e8f6835a8528458b672e8f360c2` and current primary sources reviewed through the cutoff
date. It does not change governed products, roles, procedures, releases, application code, feature
flags, routes, or production systems.

The packet is ready for physician evidence review. It is **not ready for production launch**. Three
gates remain: the AERO/AERO DV sterile-status conflict, the EBUS required video-system gap, and named
clinical-owner signoff for the three D1 exemplars.

## Artifact map

| Artifact                             | Purpose                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| `executive-launch-assessment.md`     | Launch verdict, mission-question answers, and smallest safe AABIP path           |
| `launch-critical-scope.md`           | Frozen Tier 0–3 inventory, counts, identifiers, and runtime QA observations      |
| `evidence-method.md`                 | Source hierarchy, no-inference rules, search stop rule, and validation semantics |
| `device-use-evidence-manifest.json`  | Versioned, non-governed claim and evidence-gap source of truth                   |
| `source-coverage-report.md`          | Generated coverage, missing claims, staleness, dates, and access state           |
| `evidence-conflicts.md`              | Generated conflicts and family/model scope risks                                 |
| `physician-adjudication-queue.md`    | Generated decision queue; no row is an owner decision                            |
| `launch-blocker-matrix.md`           | Generated evidence-linked blocker table                                          |
| `production-hardening-backlog.md`    | Read-only runtime/UX/operations audit and prioritized follow-up                  |
| `owner-supplied-missing-products.md` | Generated exact 35-configuration Tier 0 evidence/action register                 |
| `post-merge-implementation-plan.md`  | Future A–E implementation records; nothing in it is implemented here             |
| `implementation-report.md`           | Frozen-base, workstream, change, test, determinism, and handoff record           |

The five generated Markdown reports are deterministic products of the manifest. Human-authored
assessment documents add repository and runtime-audit context that does not belong in a factual
product-claim manifest.

## Reproduce the evidence reports

From the repository root:

```bash
npx tsx scripts/ip-device-intelligence/production-readiness/validate-evidence-manifest.ts \
  docs/ip-device-intelligence/production-readiness/device-use-evidence-manifest.json

npx tsx scripts/ip-device-intelligence/production-readiness/generate-reports.ts \
  --manifest docs/ip-device-intelligence/production-readiness/device-use-evidence-manifest.json \
  --output-dir docs/ip-device-intelligence/production-readiness \
  --as-of-date 2026-08-10 \
  --stale-after-days 365
```

The generator uses no runtime clock, randomness, database, network request, or governed catalog
input. The explicit as-of date and manifest access dates are the only time inputs.

## Interpretation boundary

- A supported record means its bounded claim is traceable under the source-tier policy.
- A ready-for-review record means a physician can adjudicate it; it does not mean accepted.
- “Safe to propose” in the owner report is a conservative evidence gate, not approval or ingestion.
- An unresolved compatibility record is an evidence gap, not a technical incompatibility finding.
- A family statement does not automatically qualify an exact model.
- Raw GUDID rows are source-ingest context, not governed products.
- Active PR #91/#92 observations are read-only context and are not frozen-main facts.
- Externally researched facts remain outside runtime until physician review and the normal governed
  forward-release process.

This material is for educational product-governance review and is not clinical advice. Device use
requires the current jurisdiction-specific IFU, exact model and configuration, trained clinicians,
local biomedical validation, and institutional governance.
