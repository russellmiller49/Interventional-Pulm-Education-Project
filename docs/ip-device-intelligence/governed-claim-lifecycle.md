# Device Intelligence governed-claim lifecycle foundation

Status: D5A architecture foundation, 2026-08-12. This document and its domain code define
governance infrastructure only. They do not contain a real product approval, adopt research
evidence, change governed preference-card data, publish a release, or connect a claim to runtime.

Implementation:

- `src/features/device-intelligence/domain/governed-claims.ts`
- `src/features/device-intelligence/__fixtures__/governed-claims.ts`
- `src/features/device-intelligence/__tests__/governed-claims.test.ts`

## 1. Repository boundary

This contract extends, rather than replaces, the repository's existing distinctions:

- Release state and clinical governance state remain separate axes. A frozen release can still
  contain draft clinical content; `published_in_forward_release` here means that this exact claim
  has passed the claim gates and has a named forward-release record. It does not move a release
  pointer or rewrite a release bundle.
- Reviewed product families remain exact, versioned identities. A family-scoped claim names a
  `productFamilyVersionId` and complete member-product list; it never persists an Atlas discovery
  key or recomputes membership from labels.
- Historical records remain reconstructable. Supersession appends a named relationship and the
  prior claim stays in the ledger.
- Impact reports are descriptive. Like the existing release impact report, they expose what is
  affected without deciding that a release should advance.

There is deliberately no database schema, migration, Supabase call, route, UI, feature-flag
change, release generator, governed-data edit, or runtime ingestion adapter in D5A.

## 2. Lifecycle

The only forward path is:

```text
research_candidate
        ↓
physician_review_required
        ↓
approved_for_governed_authoring
        ↓
published_in_forward_release
        ↓
superseded
        ↓
historical_retained
```

Every step appends a numbered transition with actor, instant, rationale, exact claim-content hash,
and exact evidence-set hash. Publication additionally names the forward release. Supersession
additionally names the successor. No skip, reversal, repeated state, or transition beyond
`historical_retained` is valid.

`approved_for_governed_authoring` is permission to use the signed claim in a later, separately
reviewed authoring change. It is not publication. `published_in_forward_release` requires a
matching release-impact assessment and verified implementation history, but this module cannot
perform either action.

## 3. Claim record

| Concern                 | Contract                                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identity                | `claimId`, format version, content hash, evidence-set hash                                                                                                               |
| Content                 | exact `claimStatement` and a narrow allowlisted `claimType`                                                                                                              |
| Affected graph          | explicit product ids, role codes, and procedure codes; at least one required                                                                                             |
| Product scope           | one exact model, one reviewed-family version with complete frozen membership, or an explicit non-product rationale                                                       |
| Evidence                | stable evidence id; source identity; revision and dates; jurisdiction; exact locator; source type; primary/secondary/contextual class; decision use; applicability scope |
| Clinical accountability | named physician owner; append-only reviewer records; review date, decision, and rationale                                                                                |
| Evidence disagreement   | explicit conflict records with source ids, unresolved/resolved status, rationale, and resolving review id                                                                |
| Staleness               | repository-configured positive day threshold, explicit basis, and rationale                                                                                              |
| Release impact          | append-only assessments naming exact release bundles and descriptive impact                                                                                              |
| Implementation          | append-only progression from `not_started` through verified forward release and historical-only state                                                                    |
| Supersession            | old record names the successor; successor names every claim it replaces; ledger validation checks both directions and cycles                                             |
| Retention               | `append_only_indefinite`, with retention actor/instant recorded at the final state                                                                                       |

Claim types are intentionally narrow: identity, manufacturer specification, regulatory status,
compatibility, clinical-role mapping, procedure requirement, setup instruction, and evidence
limitation. Generic equivalence, substitution, interchangeability, or "alternative product"
types are rejected. D5A does not define the stronger governed contract those decisions would
need.

## 4. Exact signoff binding

Two independent SHA-256 identities use the repository's canonical `stableSnapshotHash`:

1. The claim-content hash binds the claim id, statement, type, explicit targets, exact scope,
   predecessor claims, staleness policy, and retention policy/rationale.
2. The evidence-set hash binds sorted evidence records, every source identity and revision,
   applicability/qualification, and evidence-conflict disposition.

An approving review records both hashes, the claim id, and the physician-owner id. Promotion
requires an `approved` review whose reviewer role is `physician` and whose four bindings match the
current record exactly. Better or newer evidence therefore does not edit an approval in place: it
creates a new review-bound claim record and, when appropriate, an explicit supersession chain.

Lifecycle fields such as publication instant, release-impact history, and implementation history
remain outside the content hash. They are append-only acts, mirroring the release-bundle rule that
retirement must not look like content mutation.

## 5. Fail-closed gates

Cross-field validation rejects:

- an approved-or-later state without a named physician owner;
- an approved-or-later state without retained evidence or an exact physician signoff;
- unresolved evidence conflicts at approval;
- exact-model approval whose primary-support evidence is neither exact-model evidence nor family
  evidence with an explicit reviewer-qualified member list containing that model;
- compatibility approval without applicable, explicit primary evidence used as primary claim
  support;
- a generic equivalence/substitution/interchangeability claim type;
- absent source revision, in-place source revision changes, or removal of retained source identity;
- rewritten transition, review, release-impact, or implementation history;
- publication without the exact forward release, matching release assessment, and verified
  implementation record;
- supersession without a named successor, a missing successor, a missing reverse link, or a cycle;
- deletion of a prior claim from a baseline ledger or clearing a historical-retention record; and
- direct runtime use of a research candidate.

Runtime eligibility is a pure future-adapter guard. It returns true only for a currently valid,
non-stale `published_in_forward_release` record whose latest implementation status is
`verified_in_forward_release`. Superseded and historical records remain available for
reconstruction, never for a new runtime selection. No runtime code calls this guard in D5A.

## 6. Staleness is an explicit repository policy

Staleness evaluation accepts an explicit `asOf` instant; it never reads the system clock. The
policy selects either the latest primary-evidence revision or latest approving physician review
as its anchor, adds the configured number of days, and returns `current`, `stale`, or `unknown`.
At the exact threshold instant the claim is stale. `unknown` fails runtime eligibility closed.

No reviewed external source below established a universal clinical-claim staleness interval,
required a physician-owner role for this repository, or supplied a universal retention duration.
Those are repository governance choices and must remain configurable/reviewable rather than be
presented as FDA or NIST requirements. The fictional fixture uses 365 days solely to exercise the
contract.

## 7. Deterministic impact report

`buildGovernedClaimImpactReport(claim, asOf)` projects only its arguments. It canonicalizes all
set-like target/evidence/supersession fields, preserves append-only histories, includes staleness
and blocking validation codes, and hashes the complete report payload. It contains no generated
timestamp, severity score, recommendation, pointer movement, or write action. Equal inputs are
byte-identical.

The report exposes:

- exact claim/evidence hashes and lifecycle state;
- affected product/role/procedure identities and exact scope;
- primary-support evidence and unresolved conflict ids;
- every affected-release assessment;
- latest implementation status;
- predecessor/successor identities and historical-retention state; and
- all blocking validation codes.

## 8. Contextual primary-source precedents, not automatic obligations

Applicability of electronic-record regulations to a future deployment has not been established in
this phase. The sources below informed conservative contract shape only:

- **21 CFR 11.10(e)**, eCFR current through 2026-08-10, requires secure time-stamped audit trails
  for covered systems and says record changes must not obscure prior information. This is a
  contextual precedent for append-only transitions, not a determination that Part 11 applies.
  Locator: [21 CFR 11.10(e)](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11/subpart-B/section-11.10).
- **21 CFR 11.50, 11.70, and 11.100** describe, for covered records, signer name/time/meaning,
  signature linkage to the exact record, and signature uniqueness to one individual. They are
  contextual precedents for named reviewers and hash-bound signoff, not a legal-compliance claim.
  Locators: [11.50](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11/subpart-B/section-11.50),
  [11.70](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11/subpart-B/section-11.70),
  and [11.100](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11/subpart-C/section-11.100).
- **NIST SP 800-53 Rev. 5, Release 5.2.0**, AU-10(3)/(4) and AU-11 (pp. 76–77), provides guidance
  on reviewer identity/chain of custody and organization-defined audit-record retention. CM-3 and
  CM-4 (pp. 98–101) provide guidance on reviewed/approved changes, retained change history, and
  pre-change impact analysis. NIST is guidance here, not a clinical rule or asserted mandate.
  Locator: [NIST SP 800-53 Rev. 5](https://doi.org/10.6028/NIST.SP.800-53r5).
- **FDA Global Unique Device Identification Database (GUDID) Guidance for Industry and FDA
  Staff**, final December 2024, §III.A.2(a), pp. 17–20, distinguishes draft, unpublished, and
  published DI-record lifecycle states and describes retention of published identity/history.
  That official data-submission lifecycle is a useful identity/retention pattern; it does not
  approve repository product claims. Locator: [GUDID guidance PDF](https://www.fda.gov/media/86569/download).
- **FDA Deciding When to Submit a 510(k) for a Change to an Existing Device**, final
  2017-10-25, §IV pp. 8–10 and Appendix B pp. 62–63, gives nonbinding change-documentation examples
  including product, date, description, reason, history, comparison, analysis, references,
  signatures, and re-evaluation. It is a contextual precedent for impact-record completeness, not
  an assertion that a repository content change is a device change. Locator:
  [FDA guidance PDF](https://www.fda.gov/media/99812/download).
- FDA's official 510(k) overview and content pages, accessed 2026-08-12, reinforce that evidence
  and submission scope are specific to the device and claim under review. They do not establish
  product equivalence for this repository. Locators: [Premarket Notification 510(k)](https://www.fda.gov/medical-devices/premarket-submissions-selecting-and-preparing-correct-submission/premarket-notification-510k)
  and [Content of a 510(k)](https://www.fda.gov/medical-devices/premarket-notification-510k/content-510k).

## 9. Fictional proof and future integration

The fixture uses only `FICT-*` identities, a fictional manufacturer, fictional source, fictional
procedure, fictional release, and fictional people. Its approval and publication states exist only
inside tests. Nothing in the fixture may be copied into governed data.

A later persistence or authoring checkpoint must independently define authorization, durable
identity proof, concurrency, storage constraints, audit export, and release integration. At that
boundary it must:

1. validate unknown input with `governedClaimSchema` and cross-field validation;
2. compare writes against the retained prior ledger with `validateGovernedClaimMutation` or
   `validateGovernedClaimLedger`;
3. keep candidates in a non-runtime store/namespace;
4. require a separate authorized action for every appended review or transition;
5. feed only exact published claims into a future release authoring proposal, never directly into
   live data; and
6. run the existing release generator, impact review, publication baseline, and owner approval
   process before any forward release.
