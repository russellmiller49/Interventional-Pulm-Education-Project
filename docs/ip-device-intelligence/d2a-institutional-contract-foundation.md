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
**projectJson**, which admits a serialized JSON **string** request and refuses every object
input; the request is decoded and validated by **parseOverlayProjectionRequestJson** before
any projection is built (see §6d for why object admission was removed).

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

**accessAllows** is the exported access gate. It accepts `unknown` and promises a boolean, so
it is **total**: it denies on its own rather than assuming its arguments were already parsed,
and it never throws for any caller-supplied value.

A non-string argument is rejected by `typeof` **before Zod, before any property of it is read,
and before any coercion**. Only primitive strings reach the classification schema, so no
`Proxy` trap, getter, or conversion hook (`toString`/`valueOf`/`Symbol.toPrimitive`) can run
inside the gate. Arrays, boxed strings, `Date`s, numbers, booleans, `null`, `undefined`,
symbols, null-prototype objects, and every carrier shape are denied on that one line. Strings
are then schema-parsed before comparison, so an unrecognized string — including a name
inherited from `Object.prototype` such as `toString` or `__proto__` — is denied rather than
used as a rank-lookup key, where the inherited value would otherwise have compared as allowed.
Invalid input yields exactly `false`, never an error carrying a caller value.

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
- access-gate totality (§6e): the complete invalid-input matrix — array, boxed `String`,
  `Date`, number, boolean, `null`, `undefined`, symbol, empty/unknown/case-variant/
  whitespace-padded strings, every `Object.prototype` property name (derived, not
  hand-listed), `toString`/`valueOf`/`Symbol.toPrimitive` carriers, non-throwing and
  throwing `Proxy`s, throwing-getter and throwing-conversion carriers, and null-prototype
  objects — each asserted `false` and non-throwing in both argument positions against the
  real `accessAllows` export, with trap, getter, and conversion-hook counters proving no
  caller-controlled code ran; plus all nine ordered pairs of the valid 3 × 3 matrix;
- the preserved 27 × 6 forbidden-identifier matrix, refused 162/162;
- the sealed zero-input factory, its export surface, and module-isolation construction
  refusals;
- the closed identifier grammar and the bundle-wide identifier registry;
- the serialized-JSON request boundary (§6d): valid demo, restricted, and confidential
  request JSON accepted through the parser and `projectJson`, and every non-string object
  input refused before any caller code runs — transparent and descriptor-synthesizing
  Proxies, revoked and throwing-trap Proxies, coercion carriers (`toString`, `valueOf`,
  `Symbol.toPrimitive`), getter carriers, boxed `String`, `Date`, array, `Map`, `Set`,
  function, class instance, prototype-derived objects, and genuine `Object.create(null)`
  requests and scopes — with Proxy trap counters proving no trap fired, `__proto__` members
  in decoded JSON rejected as unrecognized keys, malformed and non-object JSON refused,
  governed reserved names refused, and a module-lifetime `JSON.parse` capture that a later
  global replacement cannot supplant;
- the R4 cross-call vectors: the stage-one poison carriers that defeated the object boundary
  are refused before any trap runs, leaving `structuredClone`, `Array.isArray`,
  `Object.getPrototypeOf`, `Reflect.ownKeys`, `Object.getOwnPropertyDescriptor`, and
  `JSON.parse` unchanged, so a later valid request is still accepted and a later exotic still
  refused;
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

**Superseded by §6e.** This correction relied on `safeParse` alone. That was insufficient for
an input that throws while being examined; see §6e for the totality correction.

### D2A-C4 — inherited request properties and reserved identifiers

**Pre-correction reproduction:** `Object.create(validRequest)` — owning no property at
all — was accepted, as were nested scopes with inherited fields and reserved names
(`toString`, `constructor`, `valueOf`, `__proto__`, `hasOwnProperty`) as identifiers, which
the projection then echoed.

**Correction (superseded by §6d — historical):** `parseOverlayProjectionRequest` verified the
original runtime value before Zod saw it: a request had to be a plain data object (prototype
exactly `Object.prototype`, or `null`, which cannot inherit anything), with no symbol keys, no
accessor properties, and no non-enumerable properties; its own enumerable data properties were
copied exactly once into a fresh object, and the nested scope was independently checked the
same way. This object-admission path — and the exported `parseOverlayProjectionRequest` itself
— **no longer exists**; §6d replaced it with the serialized JSON-text boundary
(`parseOverlayProjectionRequestJson` / `projectJson`), which refuses every object input.
Reserved property names are still refused as identifiers by the closed grammar itself, at the
request boundary and in the corpus.

## 6a. Second Codex review (2026-08-13): D2A-R2-C4-001

> **Historical — superseded behavior.** Sections 6a, 6b, and 6c record the object-accepting
> request boundary and its corrections. That boundary no longer exists: `§6d` replaced it
> with a serialized JSON-text boundary. Every mention below of `parseOverlayProjectionRequest`
> or the adapter's `project` method describes the **superseded** surface as it behaved at the
> head named in that section. The current surface is `parseOverlayProjectionRequestJson` and
> `projectJson`; neither `parseOverlayProjectionRequest` nor `project` is exported today.

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

## 6b. Third Codex review (2026-08-13): D2A-R3-C4-001

The third independent review confirmed the `__proto__` correction as fixed and found one
remaining medium request-boundary bypass: an actual `Proxy` can synthesize a request the
reflection-only snapshot accepts as plain data.

**Reproduction.** A `Proxy` over an empty target can trap `getPrototypeOf`, `ownKeys`, and
`getOwnPropertyDescriptor` to report `Object.prototype`, report the four keys of a valid
confidential East request, and return enumerable data descriptors carrying the
corresponding values:

```js
const target = {}
const proxy = new Proxy(target, {
  getPrototypeOf: () => Object.prototype,
  ownKeys: () => Reflect.ownKeys(validInstitutionalRequest),
  getOwnPropertyDescriptor: (_t, key) => ({
    value: Reflect.get(validInstitutionalRequest, key),
    enumerable: true,
    configurable: true,
    writable: true,
  }),
})
// Reflect.ownKeys(target) === []   — the underlying target owns nothing
```

The snapshot builder inspected the request only through `Object.getPrototypeOf`,
`Reflect.ownKeys`, and `Object.getOwnPropertyDescriptor`, and every one of those operations
is controlled by the Proxy's traps. The Proxy therefore passed the snapshot and the strict
schema while owning no data, and both `parseOverlayProjectionRequest` and the sealed
adapter's `project` returned the confidential East projection with two capability records.
Measured pre-fix, the bypass reproduced for a descriptor-synthesizing top-level Proxy, a
transparent Proxy around a valid request, a descriptor-synthesizing nested-`scope` Proxy, a
transparent nested-`scope` Proxy, and a descriptor-synthesizing Proxy over a null-prototype
target — through both entry points.

**Why reflection-only validation was insufficient.** A coherent Proxy can satisfy any
finite reflection-only interrogation and return a self-consistent result no matter how many
times, or in what order, its prototype, keys, and descriptors are read. No sequence of
`Object.getPrototypeOf` / `Reflect.ownKeys` / `Object.getOwnPropertyDescriptor` calls, and
no comparison between two such sequences, can distinguish a Proxy from the plain object it
impersonates, because the Proxy controls every answer. The boundary needed a structural
check the request cannot influence.

**Correction — a structural non-Proxy admission gate.** After the descriptor snapshot and
the strict schema have accepted a candidate, and before the parsed request is returned, the
request boundary submits the original input to the host `structuredClone`. The
structured-clone algorithm walks the whole input graph and refuses Proxy exotic objects
with a `DataCloneError` that no trap can intercept, at the top level or nested anywhere
inside. A clone failure becomes a generic request-boundary refusal that names no field
value, and the clone result is discarded — the authoritative parsed request is still the
snapshot, so this adds no dependency on structured cloning's field semantics.

The gate runs only after the descriptor and schema checks, which is essential:
structured cloning silently resolves an ordinary getter into a data value, so accessor,
symbol, non-enumerable, unknown-key, and type failures must still be caught first by the
snapshot and the schema, exactly as before. The gate's sole job is to establish that the
original graph is composed of serializable ordinary data rather than Proxy exotic objects.
It introduces no import: `structuredClone` is a host global provided by the repository's
supported production runtimes, so the module still imports only `zod` and its own relative
files and remains valid in both browser and Node environments. If the host lacks
`structuredClone` the gate fails closed, because an input whose Proxy-freeness cannot be
proven must not be admitted.

**Results (as measured at this superseded head; both entry points named here were later
removed by §6d).** Every Proxy carrier above was refused through both
`parseOverlayProjectionRequest` and `adapter.project` — 0 accepted, 0 projections returned,
and no confidential, sibling-site, or cross-tenant identifier in any refusal error. A
descriptor-synthesizing valid Proxy and a transparent Proxy both reach and are refused by
the gate; a Proxy at an unrecognized position is refused earlier by the strict schema; and
a Proxy's fields cannot occupy a primitive request position, so no Proxy placement in the
input graph both survives the schema and escapes the gate. Ordinary valid demo and
institutional requests, and genuine `Object.create(null)` requests and scopes, remain
accepted; the one-read snapshot semantics, deep-frozen deterministic projections, and
no-mutation-after-failure behavior are unchanged. Revoked Proxies and Proxies whose traps
throw or violate Proxy invariants are refused, as are Proxies returning accessor,
non-enumerable, or symbol-keyed descriptors — the last three by the existing snapshot
checks, ahead of the gate.

Because the third-correction request boundary depended on the host `structuredClone`, which
the jsdom test sandbox does not provide, the four D2A suites that exercised `project` or
`parseOverlayProjectionRequest` (`institutional-request-boundary`,
`institutional-serialization`, `institutional-isolation`, `institutional-fixture-seal`) were
moved to the Node test environment at this point, where the pinned Node 20 runtime supplies
it. (These pragmas were removed again in §6d, once the serialized boundary reduced the
dependency to `JSON.parse`, which jsdom provides.) None of the four asserts on DOM behavior —
they exercise the pure contract, adapter, and serialization layers only — so neither the
addition nor the later removal of the pragma changes coverage. The production module target is
unchanged and type-checks and builds for both browser and Node.

## 6c. Pre-independent-review inspection (2026-08-14): D2A-C4-GLOBAL-001

A code-inspection pass before independent review found that the gate added in 6b, while
structurally correct in principle, resolved its clone operation too late to be trusted.

**The defect.** `assertNonProxyStructuredData` read the global twice — `typeof
structuredClone !== 'function'`, then `structuredClone(value)` — and both reads happened
_after_ `plainOwnDataCopy` had already called `Object.getPrototypeOf`, `Reflect.ownKeys`,
and `Object.getOwnPropertyDescriptor` on the request. Each of those is a Proxy trap, and
`structuredClone` is a writable, configurable property of the global object. A trap could
therefore overwrite `globalThis.structuredClone` while the snapshot was being built, and the
gate would then dynamically resolve and call the attacker's replacement instead of the host
intrinsic. The gate was checking a function the request itself had installed.

Making the replacement restore the genuine intrinsic as it returned defeated any
after-the-fact detection as well: once parsing finished, the global was byte-identical to
what it had been before the call, so no before/after comparison of global state could have
caught the substitution.

**Reproduction.** A descriptor-synthesizing Proxy over an empty target, synthesizing the
confidential East request, with the substitution performed inside a trap:

```js
const original = globalThis.structuredClone
new Proxy(
  {},
  {
    getPrototypeOf: () => {
      globalThis.structuredClone = () => {
        globalThis.structuredClone = original // self-restoring: leaves no drift
        return {}
      }
      return Object.prototype
    },
    ownKeys: () => Reflect.ownKeys(confidentialEastRequest),
    getOwnPropertyDescriptor: (_t, key) => ({
      value: Reflect.get(confidentialEastRequest, key),
      enumerable: true,
      configurable: true,
      writable: true,
    }),
  },
)
```

Measured at head `82aaaace`, with the global descriptor confirmed `writable: true,
configurable: true` beforehand, this was **accepted** by both `parseOverlayProjectionRequest`
and `adapter.project`, which returned the confidential East projection with two capability
records. The same held for the substitution performed in `ownKeys` and in
`getOwnPropertyDescriptor`, and for a nested-`scope` Proxy performing it in any of the three
trap positions — five carriers, all accepted through both entry points, and in every case the
fake clone restored the original global when called. A correction that only reordered
operations would have left the remaining trap positions exploitable.

**Correction — capture the trusted intrinsic before any reflection.** The boundary now
resolves the clone operation once, on entry, bound to the global object, before the request
is touched:

```ts
function captureCloneIntrinsic(): ((value: unknown) => unknown) | null {
  const candidate = globalThis.structuredClone
  return typeof candidate === 'function' ? candidate.bind(globalThis) : null
}

export function parseOverlayProjectionRequest(input: unknown): OverlayProjectionRequest {
  const cloneIntrinsic = captureCloneIntrinsic()
  if (!cloneIntrinsic) {
    throw new Error('A projection request could not be admitted as plain structured data.')
  }
  const copy = plainOwnDataCopy(input, 'A projection request')
  // …snapshot, nested scope snapshot, strict schema…
  assertNonProxyStructuredData(input, cloneIntrinsic, 'A projection request')
  return parsed
}
```

`assertNonProxyStructuredData` no longer performs any global lookup; it receives the
captured reference as a parameter and calls it directly. Nothing the caller controls executes
between entering the boundary and the capture — receiving a reference to the request runs no
trap — so the reference is the genuine intrinsic even when the request later replaces the
global. Because the gate never rereads the mutable global after traps have run, no trap
position can substitute it, which is why all three positions close together rather than one
at a time.

Per-call capture was chosen over a module-initialization constant. Both satisfy
"captured before reflection", but capturing at module load would couple the boundary to
import order and to any host that installs the primitive after the module is first
evaluated, and it would make the missing-host path testable only through module isolation.
Per-call capture is the smaller architecture and matches the module's runtime contract: the
primitive is needed per request, not per import.

**Other intrinsics were deliberately not captured.** `Object.getPrototypeOf`,
`Reflect.ownKeys`, `Object.getOwnPropertyDescriptor`, `Object.create`,
`Object.defineProperty`, and `Object.hasOwn` were assessed as defense-in-depth candidates and
left as-is. Only a Proxy somewhere in the input graph can execute code during the boundary,
and any graph containing a Proxy is now refused by the trusted gate regardless of what its
traps did to those globals; substituting them also gains an attacker nothing the traps do not
already grant, since the snapshot's contents are attacker-supplied by construction and the
strict schema is the filter. Capturing them would add churn without closing a demonstrable
vector. This assessment is recorded so a future refactor that moves or removes the clone gate
knows the reflection path is only safe because that gate backstops it.

**Threat-model note.** This boundary defends against a _request object_ whose traps execute
during the boundary's own interrogation. It does not, and cannot, defend against an attacker
who already runs arbitrary code in the realm before the call — such an attacker can replace
`parseOverlayProjectionRequest` itself.

**Behavior preserved.** The gate still runs last, after the descriptor snapshot and the
strict schema, so accessors, symbols, non-enumerable properties, and unknown keys are still
refused ahead of it rather than silently resolved by structured cloning. The clone result is
still discarded and the snapshot remains authoritative; one-read caller semantics, accepted
`Object.create(null)` requests and scopes, post-parse caller-mutation harmlessness, and
generic refusals that name no field value or fixture identifier are all unchanged. A host
without `structuredClone` still fails closed, now at the capture instead of inside the gate,
with the identical generic message and no projection produced for even a perfectly valid
request.

**Results (as measured at this superseded head; both entry points named here were later
removed by §6d).** All five previously-accepted carriers were refused through both
`parseOverlayProjectionRequest` and `adapter.project`, with no confidential, sibling-site, or
cross-tenant identifier in any refusal. Nine regressions pin this in
`institutional-request-boundary`: the three top-level trap positions, all three nested-`scope`
trap positions, the self-restoring fake, the missing-host fail-closed path, and the valid
controls. The regressions assert both that the trap genuinely installed its replacement and
that the gate never invoked it — so they fail if the correction is reverted rather than
passing vacuously; six of the nine fail against the pre-correction module. The thirteen
existing ordinary-Proxy regressions and the `__proto__` regressions remain green, and the
projection matrix remains 162/162 refused, 0/162 serialized.

**Independent review of this correction is still pending.** PR #102 remains a draft and is
unmerged.

## 6d. Independent review (2026-08-14): D2A-R4-C4-001 and the serialized redesign

The fourth-correction head `2bffe9bf` failed independent Codex review with a BLOCKER,
`D2A-R4-C4-001`: failed calls poison later admission checks. The prior sections corrected
D2A-C1, C2, and C3, which the review confirmed as PASS; only the C4 object boundary failed.

**Reproduced at `2bffe9bf`.** Two cross-call classes were confirmed, a representative subset
of each against this exact head.

_Probe A — cross-call `structuredClone` poisoning._ A first `Proxy` call replaces
`globalThis.structuredClone` from inside a trap and then throws before the final clone gate,
so the fake remains installed. A second, independent call captures that fake at entry (the
fourth correction's "capture before reflection" reads the _already-poisoned_ global), a fresh
descriptor-synthesizing `Proxy` passes the reflection snapshot and schema, the fake returns a
permissive result and restores the genuine intrinsic, and both `parseOverlayProjectionRequest`
and `adapter.project` return the confidential East projection with two capability records.
Confirmed from all three stage-one trap positions and with top-level and nested carriers.

_Probe B — cross-call reflection-intrinsic poisoning._ A first call replaces `Array.isArray`,
`Object.getPrototypeOf`, `Reflect.ownKeys`, and `Object.getOwnPropertyDescriptor` and throws,
leaving them modified. A second call presents a genuine `Date`; the poisoned reflection
synthesizes a valid demo request from it, the genuine `structuredClone` accepts the
non-`Proxy` exotic, and the parser and adapter both return the fictional demo projection. The
fourth correction captured only `structuredClone`, not the reflection intrinsics, and read
those fresh on every call.

**Why this was not patched again.** Each of four corrections made the object boundary harder
to fool and each was defeated. The pattern is structural: accepting an arbitrary same-realm
object graph and proving by inspection that it is inert is not achievable, because any request
whose traps run during inspection can mutate the very globals the inspection depends on, for
this call or a later one. Code that already executes in the realm has already won; an
object-inspection helper cannot make it inert.

**Correction — a serialized JSON-text boundary.** The public boundary no longer accepts an
object. `parseOverlayProjectionRequestJson(input: unknown)` admits a primitive `string` and
nothing else, decodes it with a module-captured `JSON.parse`, and validates the decoded plain
object with the strict schema. The sealed adapter's sole method is `projectJson(requestJson:
unknown)`. The supported threat model is **untrusted serialized JSON data**, not arbitrary
hostile same-realm JavaScript; the boundary does not claim to sandbox the latter, and a future
route must hand `projectJson` the raw request text rather than call `request.json()` and pass
the resulting arbitrary object into another parser.

A primitive `typeof input === 'string'` check invokes no coercion hook and no `Proxy` trap: a
string cannot carry a getter, a `toString`/`Symbol.toPrimitive` converter, a symbol key, a
custom prototype, or a trap. Every non-string input is refused before a property is read and
before any caller code runs, so both cross-call poisoning classes are structurally
impossible — the malicious carrier never executes. Decoding then yields ordinary own-property
data by construction; inherited fields, accessors, symbol keys, custom prototypes, and `Proxy`
exotics cannot survive serialization, and a `__proto__` member decodes to an ordinary own data
key (via `[[DefineOwnProperty]]`, not the prototype setter) that the strict schema rejects as
unrecognized. `JSON.parse` is captured once at module load as
`const JSON_PARSE_INTRINSIC = JSON.parse.bind(JSON)` and never re-read, so no request, and no
earlier failed request, can substitute a permissive stand-in. Refusals — non-string input,
malformed JSON, or a schema mismatch — are a single generic message (via `safeParse`, so a
`ZodError`'s embedded values never surface) that carries no caller value or fixture identifier.

**Intentional contract narrowing.** The old object boundary accepted `Object.create(null)`
requests and nested scopes; the serialized boundary refuses all object inputs, including those.
This is deliberate, not a regression: their semantic content is fully representable in JSON,
and JSON decoding produces ordinary own-property data, so nothing legitimate is lost while the
executable-input attack surface is removed entirely. The removed helpers — `plainOwnDataCopy`,
`captureCloneIntrinsic`, `assertNonProxyStructuredData`, and the `structuredClone` gate — are
gone, and the object-reading request schemas are now module-internal rather than exported
admission paths. The exported `OverlayProjectionRequest` type is unchanged.

**Node-environment pragmas removed.** The four suites (`institutional-request-boundary`,
`institutional-serialization`, `institutional-isolation`, `institutional-fixture-seal`) were
moved to `@jest-environment node` in §6b only because the boundary depended on
`structuredClone`, absent in jsdom. The serialized boundary depends only on `JSON.parse`,
which jsdom provides, so all four pragmas were removed and the suites run under the repository
default (jsdom). None asserts on DOM behavior, so no coverage is lost; the production module
target is unchanged and still type-checks and builds for both browser and Node.

**Results.** Both R4 probes are structurally closed: the stage-one carriers are refused before
any trap runs, and `structuredClone`, `Array.isArray`, `Object.getPrototypeOf`,
`Reflect.ownKeys`, `Object.getOwnPropertyDescriptor`, and `JSON.parse` are all verified
unchanged after the attempt, with a later valid request still accepted and a later exotic still
refused. Object inputs — Proxies (transparent, descriptor-synthesizing, revoked,
throwing-trap), coercion and getter carriers, boxed `String`, `Date`, array, `Map`, `Set`,
function, class instance, and genuine null-prototype requests and scopes — are all refused with
Proxy trap counters proving no trap fired. Valid demo and institutional requests, unknown
scopes, decoded `__proto__` carriers, malformed and non-object JSON, and governed reserved
names all behave as specified, and refusals leak no fixture identifier. D2A-C1's matrix remains
162/162 refused, 0/162 serialized; the sealed factory, controlled provenance, deep freeze,
deterministic reads, isolation, timestamp fail-closed behavior, and the runtime/import/exposure
boundaries are unchanged.

**Transport note — duplicate JSON members.** ECMAScript `JSON.parse` resolves a duplicate
object member to its **final** occurrence; the effective decoded object is then strictly
validated, so a duplicate cannot smuggle an extra or conflicting field past the schema. No
duplicate-member bypass was reproduced. Separately, the parser is synchronous and unbounded:
**a future HTTP route must enforce an explicit request-body byte limit before calling it.**
No current route imports D2A, so this is a requirement on a future transport, not a property
of anything that runs today. No parser change and no in-parser size constant were added here.

## 6e. Fifth Codex review (2026-08-14): D2A-R5-C3-001 — access-gate totality

The fifth independent review confirmed **D2A-C1, C2, and C4 as PASS** and returned one
remaining **MEDIUM, merge-blocking** finding against C3, at head `d5ecfed9`.

**Reproduced at `d5ecfed9`.** A `Proxy` whose `get` trap throws escaped the access gate
entirely instead of being denied:

```js
const carrier = new Proxy(
  {},
  {
    get() {
      throw new Error('D2A-C3 trap sentinel')
    },
  },
)

accessAllows(carrier, 'institution_restricted')
accessAllows('institution_restricted', carrier)
```

Both calls **threw** `Error: D2A-C3 trap sentinel` rather than returning `false`, from both
argument positions, with the trap fired once per call. Instrumenting the trap identified the
probed key as `then`: Zod's `getParsedType` (`zod/v3/helpers/util.cjs:120`) reads `then` on
the candidate during `ZodEnum.safeParse` to detect a thenable. A plain object with a throwing
`then` getter reproduced identically. Coercion-only carriers (`toString`/`valueOf`/
`Symbol.toPrimitive` throwers), symbols, and null-prototype objects already returned `false`,
so the escape was specific to **property reads**, not coercion.

**Why the fourth correction was insufficient.** `safeParse` converts a _Zod validation
failure_ into `{success: false}`. It does not contain an arbitrary exception thrown by the
value being examined, so a value that attacks the inspection propagates its own error out of a
function whose signature promises a boolean.

**Correction — a primitive-string prefilter, before any inspection.**

```ts
if (typeof projectionAccess !== 'string' || typeof recordAccess !== 'string') {
  return false
}
```

This runs before Zod, before any property read, and before any coercion, so no `Proxy` trap,
getter, or conversion hook executes at all. A catch-only fix would have been insufficient: it
would still have run caller-controlled code inside the gate before catching. The schema parse
that follows is additionally wrapped in a narrow `try/catch` returning `false`, so the
function's totality is explicit at the call site rather than inherited from Zod's internals;
the prefilter, not the catch, is the correction.

**Coverage restored.** The fifth correction's serialized redesign removed the obsolete
object-admission tests wholesale, and in doing so **accidentally removed C3 coverage that was
not obsolete**: the invalid-input table fell from 16 rows to 6 (losing `Date`, number,
boolean, `null`, `undefined`, symbol, `valueOf` carrier, empty string, case variant, and
whitespace-padded value), and the valid matrix fell from all nine ordered pairs to a five-row
sample that was still described as "the exact valid access matrix". Both are restored and
extended here: 20 invalid-input rows plus every `Object.prototype` property name derived from
`Object.getOwnPropertyNames` rather than hand-listed, each asserted `false` **and**
non-throwing in both argument positions; all nine ordered valid pairs pinned individually with
a guard asserting the table holds exactly nine distinct pairs; and three counter-instrumented
carriers (throwing `Proxy` across five traps, throwing getters installed on every inherited
name plus `then`, and a counting conversion carrier) proving zero trap, getter, and hook
invocations. Every assertion calls the real `accessAllows` export, not a copy.

**Results.** The reproduction is closed: both calls return `false`, and the trap counter is
`0` — the escape is not caught, it never fires. The `institutional-request-boundary` suite goes
29 → 67 tests (+38) and the eight D2A suites 163 → 201 (+38); no test was removed. The
serialized JSON boundary of §6d is untouched and re-verified: `parseOverlayProjectionRequestJson`
and `projectJson` remain the only admission path, object inputs (including genuine
`Object.create(null)`) are still refused before any caller code runs, the module-captured
`JSON.parse` is unchanged, and D2A-C4's determinism and post-refusal stability still hold.
D2A-C1's matrix remains 162/162 refused; the sealed factory, controlled provenance, deep
freeze, deterministic reads, isolation, timestamp fail-closed behavior, and the
runtime/import/exposure boundaries are unchanged, with 0 D2A symbols in the production build.

**Independent review of this sixth correction is still pending.** PR #102 remains a draft and
is unmerged. No independent PASS is claimed for the correction described in this section.

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
