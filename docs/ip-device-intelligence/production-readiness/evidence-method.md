# Evidence method

> **NON-GOVERNED RESEARCH CANDIDATES**
> **NOT CONSUMED BY RUNTIME**
> **PHYSICIAN REVIEW REQUIRED BEFORE ADOPTION**

Research cutoff: `2026-08-10`. Frozen repository:
`2f26cb7632fe4e8f6835a8528458b672e8f360c2`.

## Evidence units

The manifest stores one bounded claim or one explicit gap per candidate record. Every record has a
stable candidate ID, coverage target, exact product and/or role identity, claim type and scope,
source metadata, evidence/conflict state, physician decision record, and readiness disposition.

A coverage target is a commercially distinct configuration or a precisely bounded launch surface.
All records for one target must repeat the same identity, procedure, tier, owner ID, repository
classification, and declared evidence requirements. The validator rejects drift.

Repository observations, external source facts, researcher interpretations, and physician decisions
remain separate:

| Layer                                  | Meaning                                                  | May become runtime truth here? |
| -------------------------------------- | -------------------------------------------------------- | ------------------------------ |
| Frozen repository fact                 | What commit `2f26c…` actually stores or exposes          | No                             |
| Active-PR context                      | Read-only observation from open PR #91/#92               | No                             |
| External product-label fact            | Bounded summary from an official source                  | No                             |
| Clinical context                       | Guideline or society context, never model labeling       | No                             |
| Researcher inference or recommendation | Explicitly labeled analysis                              | No                             |
| Physician-owner decision               | Required governance action; none supplied by this sprint | No                             |
| Governed forward release               | Separate future implementation after approval            | Not in scope                   |

## Source hierarchy and closure policy

| Tier       | Evidence                                                                                       | Permitted use                                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| A          | Manufacturer IFU, operator/service manual, official labeling/specification/compatibility guide | Strongest product, safety, and exact relationship evidence                                       |
| B          | FDA or other clearly identified regulatory source                                              | Regulatory identity, labeling, recall, and device-record facts                                   |
| C          | Official manufacturer page, ordering information, or technical brochure                        | Identity, ordering, dimension, packaging, and bounded web facts when stronger evidence is absent |
| D          | Peer-reviewed, society, consensus, or guideline context                                        | Clinical context only                                                                            |
| Unresolved | A primary-source search record after bounded failure                                           | Documents the gap; never closes it                                                               |

Tier D never closes a declared product requirement. Compatibility, working-channel, sterile/reuse,
reprocessing, warning, and contraindication requirements require accessible Tier A/B evidence.
Identity, intended use, device role, dimension, packaging, IFU-verification, and freshness claims may
use Tier C only where the exact source scope supports the bounded statement. Compatibility also
requires an explicit-support flag and a matching strongest-source URL.

A source count is not a quality score. Generated coverage shows both candidate-record counts and
distinct source URL/document counts to prevent duplicated records from inflating coverage.

## Exact-scope policy

For a supported model/configuration claim, at least one exact repository ID, model, or configuration
identity must appear in `source.exactModelOrOrderCodes`, regardless of whether the source declares
family, model, or configuration scope. A family claim can remain family-scoped, but it cannot be
silently inherited by each model.

The manifest rejects any affirmative or negative compatibility claim unless an accessible Tier A/B
source explicitly supports that exact relationship. Records may document that no supporting source
was located; they may not turn that absence into a technical incompatibility claim.

## Prohibited assertions

Research-authored semantic fields are scanned for claims of product equivalence, interchangeability,
replacement, institutional stock status, or hospital formulary status. Those concepts cannot enter
this manifest as facts. Candidate states also cannot auto-adopt a record.

The sprint likewise does not infer:

- model or family inheritance;
- indication or contraindication;
- procedure membership;
- accessory or platform fit;
- local orderability;
- kit child-product identity;
- duplicate suppression;
- local stock or service configuration.

## Search protocol and stop rule

For each high-value gap, research proceeded through the relevant sequence:

1. manufacturer U.S. product page;
2. manufacturer IFU/manual/document library;
3. FDA or another official regulator;
4. manufacturer regional site with jurisdiction recorded;
5. exact model/document-number search;
6. contextual literature only when clinically relevant.

After two materially different primary-source strategies failed, the record is marked
`PRIMARY_SOURCE_NOT_LOCATED` with the domains/strategies checked, likely document, missing evidence,
and next manufacturer-inquiry step. Repeating the same unsuccessful search was not treated as new
evidence.

## Repository classification

Every Tier 0 exact configuration uses exactly one frozen-snapshot classification. The resulting
split is:

- 3 Medtronic targets: `WHOLLY_ABSENT_CANDIDATE`;
- 32 Portex targets: `EXACT_PRODUCT_PRESENT_INCOMPLETE` because exact rows exist only in the frozen
  raw GUDID index, not the governed catalog or proposal set.

Raw source-ingest rows do not count as governed product coverage.

## Conflict treatment

Divergent records sharing a claim key must carry non-`NONE` conflict status and reciprocal
candidate references. This catches nonfinal conflict as well as contradictory final states. The
AERO and AERO DV sterile-status pairs intentionally exercise this path.

An official recall naming affected lots is not rewritten as a whole-code withdrawal. A GUDID
distribution field is not rewritten as local orderability. A code absent from the two reviewed
Portex recall records is not called clear or unaffected.

## Physician adjudication

Every open decision includes the exact question, current/proposed state, evidence, strongest source,
conflict, uncertainty, researcher recommendation, YES/NO consequences, launch effect, post-launch
acceptability, and A–E implementation class. Recommendations remain visibly AI-authored and cannot
be treated as owner decisions.

## Reproducibility and dates

The manifest access date and research cutoff are explicit `YYYY-MM-DD` values. Report generation
requires an explicit as-of date and stale threshold, uses Unicode code-point sorting, validates input
even through programmatic use, and reads no clock. Two independent output directories are compared
byte-for-byte during verification.

A source with no document date is reported as undated. It is never aged from its access date.
Staleness is a review cue, not proof that a claim is false.

## Copyright and clinical boundary

The repository contains metadata, precise locators, and short summaries—not copied manuals, IFUs, or
articles. Users must consult the linked current source.

This packet is educational governance material, not clinical advice. Exact device selection and use
require current jurisdiction-specific labeling, trained clinicians, physician review, local
biomedical validation, and institutional policy.
