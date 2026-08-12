# D2A institutional-overlay contract foundation

> INSTITUTIONAL CONTRACT FOUNDATION
>
> FICTIONAL DATA ONLY
>
> NOT A DEPLOYED INSTITUTION MODEL

Status: pure TypeScript/Zod architecture checkpoint. This document does not claim that an
institutional product, database, authorization system, ingestion pipeline, or readiness
model exists.

## 1. Checkpoint boundary

D2A adds only:

- strict domain schemas and inferred TypeScript types;
- pure scope, access, and lookup helpers;
- invented fixtures;
- a frozen in-memory adapter with one read operation;
- validation and isolation tests; and
- requirements for a later, separately authorized migration and row-level-security phase.

D2A does **not** add database tables, migrations, Supabase policies, APIs, routes,
navigation, feature flags, persistence, ingestion, write paths, real institution records,
real capability/formulary/inventory facts, public indexing, or institutional readiness
claims. It does not alter the D1 demo-readiness resolver or project these fixtures into any
existing public-unlisted Device Intelligence output.

Every name, identifier, statement, source, decision, and jurisdiction in the fixtures is
invented. The fictional adapter rejects any fixture source whose provenance class is
not **fictional_fixture**.

## 2. Context and scope contract

The context is a strict discriminated union:

| Context       | Required identity                 | Allowed projection classification                  |
| ------------- | --------------------------------- | -------------------------------------------------- |
| demo          | demoContextId                     | public_unlisted only                               |
| institutional | tenantId + institutionId + siteId | institution_restricted or institution_confidential |

An institutional dataset, every institutional record, every institutional source, and
every institutional diagnostic repeat the complete scope tuple. Validation rejects a row
or source when any part of its tuple differs from its enclosing dataset. A tuple is matched
exactly; matching only a tenant, institution, or site never selects a dataset.

Demo and institutional shapes are separate strict schemas. A demo object cannot carry a
scope or an institutional access classification. An institutional object cannot carry a
demo identity or a public-unlisted access classification.

An institutional projection request has no user or authentication-metadata field. The
schema rejects unknown keys, including **authUserMetadata**. Consequently, the adapter has
no code path that can infer tenant, institution, or site from authenticated-user metadata.

## 3. Evidence and state semantics

Capability, formulary, and inventory records each carry:

- a source ID and typed source kind;
- an explicit source revision;
- provenance ID, label, locator, jurisdiction, and provenance class;
- last-verified timestamp;
- exact context and access classification; and
- a record-specific state.

The source collection state is separately represented as available, unknown, or
unavailable. An unknown or unavailable source is forbidden from carrying asserted
records.

The record state preserves distinctions that downstream code must not collapse:

- capability: available, explicitly unavailable, or unknown;
- inventory: present, explicitly absent, or unknown;
- formulary evidence: listed, explicitly not_listed, or unknown; and
- institution approval: approved, not_approved, pending_review, or unknown. Demo formulary
  rows instead carry the explicit state not_applicable_demo and can never claim an
  institutional approval.

A missing capability lookup returns unknown; it never synthesizes unavailable. A missing
inventory lookup returns unknown; it never synthesizes absent.

Formulary evidence and institutional approval are independent fields. A listed record is
valid with approval unknown. An approved or not_approved state requires a distinct
institutional_approval decision source; a formulary source cannot double as approval
evidence.

Every projection carries the requested projection timestamp. Validation refuses sources
verified after that timestamp and diagnostics observed after it. Data-quality diagnostics
are typed, scoped, access-classified records rather than unstructured log strings.
A non-null diagnostic related-record ID must resolve inside the same exact dataset/context,
and the diagnostic must be at least as access-restrictive as that record.

## 4. Fictional read adapter

The **createFictionalInstitutionalOverlayReadAdapter** function validates and freezes the
complete bundle when constructed. Its public surface contains only **project**.

Projection behavior is fail-closed:

1. A demo request searches demo datasets only.
2. An institutional request searches institutional datasets by the complete scope tuple
   only.
3. An unknown institutional tuple produces empty, explicitly unknown collections plus a
   scope_not_configured diagnostic. It never falls back to demo.
4. A public-unlisted request cannot be institutional.
5. Restricted projections omit confidential rows. Confidential projections still remain
   within the exact requested tuple.
6. A projection omits a diagnostic whenever its related record is excluded, even if another
   check would otherwise admit the diagnostic.
7. Parsed projections are deeply frozen before return.

The fixtures intentionally include two sites within one fictional institution and a second
fictional tenant/institution. This supports tests for site, institution, and tenant
isolation without introducing real institutional data.

## 5. Safety proofs in focused tests

The focused suites cover:

- full-scope field requirements;
- strict demo/institution separation;
- public-unlisted exclusion of institutional records;
- rejection of auth metadata as a scope substitute;
- row-to-dataset and source-to-row scope agreement;
- required revision, provenance, and last-verification fields;
- unknown versus unavailable source state;
- missing capability versus explicit unavailable;
- missing inventory versus explicit absent;
- formulary evidence versus separate approval;
- exact-scope reads across tenants and sites;
- confidential-row filtering;
- unknown-scope fail-closed behavior with no demo fallback;
- projection-time consistency;
- deterministic, deeply frozen output; and
- absence of write operations.

## 6. Requirements for a later migration phase

No migration is included here. A later migration requires explicit authorization and an
independent data-model/security review. At minimum, its design must satisfy all of the
following:

### Physical model

- Store tenant_id, institution_id, and site_id as non-null columns on every
  institution-scoped table. Do not fill missing scope from defaults, profiles, or session
  metadata.
- Use composite keys and composite foreign keys that include the full scope tuple so a
  child row cannot reference a source, decision, or diagnostic in another scope.
- Keep demo data physically or logically disjoint from institutional rows. An anonymous or
  public-unlisted view must be sourced exclusively from the demo relation and must not be a
  filtered union over institutional tables.
- Represent source availability and record states with checked/discriminated values.
  Empty result sets must not be rewritten as unavailable, absent, not listed, or not
  approved.
- Preserve source revision, provenance, last verification, projection time, and
  diagnostics as queryable fields. A revision update must create a reconstructable
  successor rather than overwrite historical evidence.
- Store institutional approval decisions separately from formulary observations, with a
  scoped foreign key to the decision evidence.
- Define explicit staleness policy metadata in a later governance decision. D2A does not
  choose a threshold.

### Authorization and RLS

- Enable and force row-level security on every institutional table, relationship table,
  source table, decision table, diagnostic table, and view that can expose those rows.
  Default behavior must be deny.
- Resolve authorized scopes through a server-governed, auditable membership relation.
  Never infer a scope from user-editable authentication metadata, and never treat the mere
  presence of a tenant/institution/site claim as membership proof.
- Require the requested full scope to intersect the authenticated principal's active,
  server-authorized memberships. Authorization and query filtering must use the same exact
  tuple.
- Keep service-role credentials out of browser code. A privileged server path must not
  bypass scope predicates merely because it can bypass RLS.
- Make public-unlisted/anonymous policy incapable of selecting any institutional row,
  source, decision, diagnostic, or count. Aggregate counts can leak existence and need the
  same protection as record identity.
- Review any view or security-definer function for invoker behavior and scope preservation.
  No helper may accept a partial tuple or derive one from user metadata.
- Add an automated RLS matrix covering same-site allow, sibling-site deny, same-tenant
  cross-institution deny, cross-tenant deny, unauthenticated deny, removed-membership deny,
  confidential-tier deny, and public-unlisted deny.

### Migration and operations

- Introduce schema first with no real rows, then run contract and policy tests before a
  separately reviewed ingestion phase.
- Reject partial-scope legacy data instead of backfilling it from guesses.
- Require explicit source revision and provenance at ingestion; do not silently stamp
  defaults that create evidence claims.
- Design write policies, reviewer roles, audit logging, retention, deletion, and incident
  response before permitting any institutional write.
- Complete a threat model, privacy review, institutional owner review, and rollback
  rehearsal before connecting a real source.
- Define a reversible migration and independent rollback that cannot delete retained
  historical evidence.

## 7. Epistemic status

Architecture conclusions from source, security, database, and regulatory research are
contextual guidance and design inference until reviewed and adopted through this
repository's governance process. They do not automatically create a binding regulatory,
privacy, security, clinical, or institutional requirement. D2A contains no clinical facts,
no institution facts, and no physician decision.

## 8. Review classification

Proposed checkpoint classification before independent adversarial review:
**SAFE AFTER TARGETED REVIEW**.
