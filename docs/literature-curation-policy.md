# IP Literature Explorer curation policy

## Purpose

The IP Literature Explorer is an educational, curated discovery aid for interventional
pulmonology literature. It is not medical advice, a clinical decision aid, an evidence-quality
rating, or a substitute for a comprehensive systematic-review search and expert appraisal.

Phase 1 separates machine-derived discovery signals from durable human editorial decisions.

## Record workflow

### Relevance

- `unreviewed`: imported but not assessed by a curator.
- `candidate`: plausibly in scope and awaiting a final decision.
- `included`: explicitly accepted into the curated collection.
- `excluded`: explicitly out of scope; an exclusion reason is required.

### Visibility

- `draft`: retained for review and hidden from public-mode search.
- `published`: eligible for public-mode search only when relevance is also `included`.
- `hidden`: intentionally withheld from normal results while remaining auditable.

The database rejects a `published` state unless the same transaction leaves the article
`included`. Imported records default to `unreviewed` plus `draft`.

All Phase 1 pages and APIs are additionally restricted to users with an active `site_admin`
entitlement. The included/published rule is implemented now so later public release does not
require redefining search semantics.

## Topic assignments

Topic IDs are stable, language-independent taxonomy identifiers. An article can have multiple
topics.

- Query-derived and deterministic rule-derived assignments are `suggested`.
- Suggestions must preserve the query or matched terms, matched fields, confidence, and version.
- A suggestion never becomes a confirmed category automatically.
- A curator may confirm or reject a topic. That decision is stored as a separate human assignment.
- A human confirmation or rejection suppresses automated suggestions for the same article/topic
  in search and filtering. The underlying automated rows remain available for audit.
- Later rule, model, or metadata versions must not overwrite a human assignment.

Ambiguous phrases require context. In particular, valves must distinguish emphysema/BLVR from
persistent air leak, and cryobiopsy must distinguish ILD, peripheral-lesion, mediastinal, and
endobronchial use.

## Landmark status

`is_landmark` is a manual editorial flag, not a claim that an article is high quality or that its
findings should guide a particular patient’s care. Curators should document unusual decisions in
the reason field.

## Abstract display

Abstracts are stored for indexing and curation when supplied in NBIB metadata. Default display
policy is `snippet_only`: at most a short plain-text excerpt is shown. Full abstract display
remains disabled by default until redistribution policy is settled. The system does not fabricate
missing abstracts or generate AI summaries.

## Publication warnings

Retraction, correction/erratum, and conference-abstract flags are derived conservatively from
explicit PubMed publication types and related-record tags. They are warnings, not substitutes for
checking the current primary record. Curators and users should verify publication status directly
in PubMed and with the publisher.

## Audit requirements

Manual relevance, visibility, landmark, and topic changes go through
`curate_literature_article_v1`. The function:

- locks the article for the transaction;
- enforces workflow invariants;
- writes before/after values and the actor to `literature_curation_events`;
- stores human topic decisions separately from suggestions; and
- marks the article as manually overridden.

`literature_curation_events` is append-only. Update and delete attempts are rejected, including
through the service role. Bibliographic re-imports intentionally omit all manual curation columns.

Reasons must not contain patient names, medical-record numbers, dates of birth, or other protected
health information. The literature corpus is publication metadata, not a patient-data system.

## Provenance and coverage

Every import batch is identified by source checksum, manifest and query-registry versions,
retrieval identity, and optional record limit. Every PMID keeps each batch/source that retrieved
it. Duplicate discovery is expected and must not be collapsed into a single undocumented source.

Files marked `needs_mapping` are usable for validation and bounded local testing, but their source
or query must not be presented as known. Editorial mapping must rely on export history, not topic
inference from article content.

## Decisions still requiring physician/editorial review

- Confirm that the supplied `Full Journals`, `Expanded-journal`, and `All-PubMed discovery`
  folder names are the intended source-tier provenance. Individual discovery-query/date mappings
  remain unknown unless they are documented separately.
- Review the large set of expected non-registry journals from broad PubMed discovery.
- Establish inclusion/exclusion guidance and adjudicate the initial corpus.
- Decide abstract redistribution policy.
- Clinically review Spanish and Simplified Chinese topic labels before adding them to the taxonomy.
- Define and label a Phase 2 validation set before approving AI thresholds.
- Audit false negatives before any future automatic exclusion behavior.
- Approve public release only after an adequate set of included/published records exists.
