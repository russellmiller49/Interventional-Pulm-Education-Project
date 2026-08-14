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
- a sealed, deep-frozen canonical fictional corpus checked into this repository;
- a frozen in-memory adapter with one read operation and no runtime dataset input;
- validation and isolation tests; and
- requirements for a later, separately authorized migration and row-level-security phase.

D2A does **not** add database tables, migrations, Supabase policies, APIs, routes,
navigation, feature flags, persistence, ingestion, write paths, real institution records,
real capability/formulary/inventory facts, public indexing, or institutional readiness
claims. It does not alter the D1 demo-readiness resolver or project these fixtures into any
existing public-unlisted Device Intelligence output.

Every name, identifier, source, decision, and jurisdiction in the fixtures is invented.
The fictional adapter constructs only from the canonical in-repository corpus, and the
corpus schema rejects any fixture source whose provenance class is not
**fictional_fixture**. Fictionality is structural, not self-asserted: there is no public
API through which a caller can supply a bundle at all (section 6).

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
- a provenance ID and provenance class, with label, locator, and jurisdiction prose held
  in an internal-only authoring block that never enters a returned projection;
- last-verified timestamp;
- exact context and access classification; and
- a record-specific state whose explanatory content is a controlled code, never free
  text.

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

Timestamps must resolve to a real instant, not merely match a datetime pattern. Zod's
`datetime({ offset: true })` accepts offsets it does not range-check, so a value such as
`2026-08-12T12:00:00+99:99` validates while `Date.parse` returns NaN. Because each
projection-time rule is a `>` against a parsed instant, and every comparison with NaN is
false, one unreadable timestamp would have switched the whole evidence-time guard off
instead of failing closed. The instant schema now rejects any value `Date.parse` cannot
resolve, and the comparison treats an unreadable instant as a failure in its own right.

## 4. Fictional read adapter

The **createFictionalInstitutionalOverlayReadAdapter** function takes **no arguments**: it
parses, deep-freezes, and projection-safety-checks the canonical in-repository corpus at
construction and rejects any runtime argument loudly. Its public surface contains only
**project**, and every request passes a plain own-property boundary before Zod parses it.

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

**accessAllows** is the exported access gate, so it denies on its own rather than assuming
its arguments were already parsed. Both arguments are re-parsed through the classification
schema before any comparison, so a coercible object — an array, a boxed string, a
`toString`/`Symbol.toPrimitive` carrier, a proxy — is denied outright rather than being
used as a property key, where key coercion would have invoked its conversion methods and a
name inherited from `Object.prototype` would have compared two functions and read as
allowed.

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
- deterministic, deeply frozen output;
- absence of write operations;
- the exact cross-reference leak shape, asserted end to end against the serialized
  projection rather than a display component, in both its cross-site and cross-tier forms;
- serialization scans proving no tenant, institution, site, record, source, provenance,
  entry, or decision identifier crosses a scope boundary, with the shared tenant and
  institution left present so the scan cannot pass vacuously;
- refusal errors and unconfigured-scope projections naming no other scope;
- projection-time refusal for an instant that cannot resolve, alongside the honest stale
  timestamp it already refused;
- access-gate denial for an unrecognized classification and for every coercible
  non-string;
- the preserved 27 × 6 forbidden-identifier matrix, refused 162/162;
- the sealed zero-input factory, its export surface, and module-isolation construction
  refusals;
- the closed identifier grammar and the bundle-wide identifier registry;
- own-property request and nested-scope boundaries, including polluted prototypes;
- `__proto__` carriers at the request boundary — a top-level JSON carrier, a nested-scope
  JSON carrier, and a null-prototype object with `__proto__` defined as an own enumerable
  data property — refused through both the parser and the sealed adapter, alongside
  controls proving valid null-prototype requests and scopes are still accepted;
- the free-text boundary: no internal authoring text in any reachable projection; and
- the static runtime import boundary.

## 6. Codex correction pass (2026-08-13): D2A-C1 through D2A-C4

An independent Codex review of the initial D2A commits confirmed four MEDIUM findings.
Each was reproduced at head `f6b725e9` before correction; the corrections below are
structural, and every reproduction now fails closed.

### D2A-C1 — arbitrary projection strings

**Pre-correction reproduction (27 fields × 6 forbidden identifiers):** 153/162 injection
cases validated, projected, and serialized the forbidden identifier into a permitted
projection; the other 9 were refused only by incidental pre-existing rules (3
intra-dataset recordId duplicates, 6 dataset-context echoes), not by any identifier
defense. The six forbidden identifiers are a sibling-site siteId, a sibling-site recordId,
a sibling-site sourceId, a cross-tenant tenantId, a confidential-tier recordId, and a
confidential-tier sourceId.

**Correction — a controlled projection DTO.** The returned projection is a separate set
of `projected*` schemas; the authoring bundle and the projection no longer share a shape.
Every formerly projection-visible string field now has exactly one classification:

| Field                                                       | Classification                                                 |
| ----------------------------------------------------------- | -------------------------------------------------------------- |
| diagnostic message                                          | internal-only; projection carries a controlled template key    |
| source label / source locator / jurisdiction                | internal-only authoring block, omitted from projection         |
| source-state reason                                         | controlled code (`sourceStateReasonSchema`)                    |
| capability statement                                        | removed; unavailable carries a controlled reason code          |
| inventory absent statement                                  | controlled reason code (`inventoryAbsentReasonSchema`)         |
| formulary not-listed statement                              | controlled reason code (`formularyNotListedReasonSchema`)      |
| quantity unit                                               | closed vocabulary (`each`, `box`, `kit`, `case`)               |
| pending-review reference                                    | scope-validated identifier                                     |
| record / source / provenance / decision / entry / diag. IDs | scope-validated identifiers (bundle registry)                  |
| capability code / subject ID / source revision              | global governed codes (may not embed any scope identity or ID) |
| tenant / institution / site / demo IDs                      | scope components (closed grammar, cross-position rules)        |

**Scope-validated identifiers.** Every scope-local identifier registers at bundle
validation to exactly one scope, access tier, and identifier kind. The registry refuses
duplicates across the bundle, identifiers equal to any scope component, identifiers
containing another scope's distinctive component or identifier, lower-tier identifiers
containing same-scope higher-tier identifiers, governed codes containing any scope
component or identifier, and internal authoring text containing another scope's — or a
higher tier's — component or identifier. All identifiers use a closed lowercase grammar
(ASCII letters/digits with single hyphen/underscore separators, bounded length) that
explicitly refuses every `Object.prototype` name plus `prototype` and `__proto__`.

**Defense in depth.** Because the corpus is finite and sealed, adapter construction also
enumerates every projection any caller could receive (each demo context at public tier;
each institutional scope at both tiers), serializes it, and refuses to construct if any
identifier forbidden for that scope and tier appears anywhere in the output. This backs up
the DTO and registry; it substitutes for neither.

**Post-correction matrix result: 162/162 refused at the schema or sealing layer, 0/162
serialized** (`institutional-projection-matrix.test.ts`).

### D2A-C2 — self-asserted fictionality

**Pre-correction reproduction:** a generic real-shaped bundle with arbitrary source
labels, locators, jurisdiction, statements, and identifiers was accepted and served merely
because it supplied `provenanceClass: 'fictional_fixture'`.

**Correction — a sealed corpus.** The public factory is now zero-argument: it imports the
canonical in-repository fixture directly, parses and deep-freezes it, runs the
projection-safety validator, and rejects unexpected runtime arguments loudly. No
production adapter or adapter factory accepts an arbitrary institutional bundle, there is
no self-asserted fixture policy or foundation label, and no path by which caller-supplied
provenance proves fictionality.

`assertFictionalCorpusProjectionSafe(bundle)` is exported and does take a bundle
parameter, but it is **validation-only**: it inspects the bundle it is handed and either
returns or throws. It cannot supply, replace, construct, or mutate the sealed corpus the
adapter serves, and the adapter never consults a caller-provided bundle, so passing a
real-shaped bundle to the validator cannot cause that bundle to be projected. Tests that
need malformed bundles substitute the canonical fixture module through Jest module
isolation; no production factory exists for that purpose, and a static import-boundary
test pins that no route, component, API, action, or analytics surface imports the
institutional modules and that only the sealed adapter imports the fixture.

### D2A-C3 — coercible access-gate inputs

**Pre-correction reproduction:** `accessAllows` allowed arrays, boxed strings, and
`toString`/`Symbol.toPrimitive` carriers that coerced to a valid classification, because
`hasOwnProperty` key coercion invoked their conversion methods.

**Correction:** both arguments are explicitly `safeParse`d against the classification
schema; either failure denies, and only parsed enum strings are compared. The full
coercible matrix (arrays, boxed strings, Date, number, boolean, null, undefined, symbol,
converter objects, proxies, `Object.prototype` keys, empty/unknown/case-variant strings)
is pinned to deny, and the nine-pair valid access matrix is pinned unchanged.

### D2A-C4 — inherited request properties and reserved identifiers

**Pre-correction reproduction:** `Object.create(validRequest)` — owning no property at
all — was accepted, as were nested scopes with inherited fields and reserved names
(`toString`, `constructor`, `valueOf`, `__proto__`, `hasOwnProperty`) as identifiers, which
the projection then echoed.

**Correction:** `parseOverlayProjectionRequest` verifies the original runtime value before
Zod sees it: a request must be a plain data object (prototype exactly `Object.prototype`,
or `null`, which cannot inherit anything), with no symbol keys, no accessor properties,
and no non-enumerable properties; its own enumerable data properties are copied exactly
once into a fresh object, and the nested scope is independently checked the same way.
Reserved property names are refused as identifiers by the closed grammar itself, at the
request boundary and in the corpus.

## 6a. Second Codex review (2026-08-13): D2A-R2-C4-001

The second independent review confirmed C1, C2, and C3 as corrected and found one
remaining medium request-boundary bypass in the C4 correction itself.

**Reproduction.** A JSON payload whose single own key is `__proto__` satisfies the
advertised plain-data contract honestly — its prototype is `Object.prototype`, and the key
is an own, enumerable data property:

```js
const payload = JSON.parse(`{"__proto__":${JSON.stringify(validInstitutionalRequest)}}`)
```

The snapshot was built as a normal `{}` and populated with `copy[key] = descriptor.value`.
For the key `__proto__` that assignment does not create a data property: it invokes the
setter inherited from `Object.prototype` and installs the supplied request as the
snapshot's **prototype**. The snapshot was then left with no own keys, so strict
unknown-key checking saw nothing to reject, while every required field resolved through
the prototype chain. Both `parseOverlayProjectionRequest` and the sealed adapter's public
`project` accepted it and returned a confidential East projection carrying two capability
records. The same bypass reproduced when only the nested `scope` value was such a carrier,
and when the carrier was a null-prototype object with `__proto__` defined as an own
enumerable data property.

**Correction.** The snapshot is now created with `Object.create(null)` and every key is
installed with `Object.defineProperty`. A prototype-less destination inherits no
`__proto__` setter, and defining a property never invokes a setter in any case, so
`__proto__` stays an ordinary own data key in the snapshot. The strict request schema then
rejects it: for a top-level carrier the discriminated union finds no `contextKind` and
refuses, and any surviving `__proto__` key is an unrecognized key under `.strict()`. The
nested scope passes through the same boundary independently, and the scope check uses
`Object.hasOwn` rather than `in`, so it cannot be satisfied by anything inherited.

The one-read snapshot semantics are unchanged — descriptors are still inspected once,
accessors, symbol keys, and non-enumerable properties are still refused, and the copied
value still comes from the descriptor rather than a second property read. Null-prototype
plain data objects remain an accepted input prototype for both the request and its nested
scope; the bypass was not closed by narrowing that contract.

## 7. Requirements for a later migration phase

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

## 8. Epistemic status

Architecture conclusions from source, security, database, and regulatory research are
contextual guidance and design inference until reviewed and adopted through this
repository's governance process. They do not automatically create a binding regulatory,
privacy, security, clinical, or institutional requirement. D2A contains no clinical facts,
no institution facts, and no physician decision.

## 9. Review classification

Proposed checkpoint classification before independent adversarial review:
**SAFE AFTER TARGETED REVIEW**.
