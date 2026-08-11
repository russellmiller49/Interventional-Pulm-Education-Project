# Device Intelligence production-readiness evidence tooling

> **NON-GOVERNED RESEARCH CANDIDATES**
> **NOT CONSUMED BY RUNTIME**
> **PHYSICIAN REVIEW REQUIRED BEFORE ADOPTION**

This isolated tooling validates research-candidate metadata and generates deterministic review
reports. It does not import, promote, approve, or write governed Device Intelligence data. It has
no database, Supabase, application-runtime, feature-flag, navigation, or network behavior.

## Contract

[`evidence-manifest.schema.v1.json`](./evidence-manifest.schema.v1.json) is the structural JSON
Schema for `ip-device-intelligence-evidence-manifest/1.0.0`.
[`evidence-manifest.ts`](./evidence-manifest.ts) applies the additional cross-record and safety
rules that JSON Schema cannot express.

Every candidate has:

- stable candidate, claim, coverage-target, and physician-decision identifiers;
- a product and/or role identity plus procedure and research-tier scope;
- declared required claim types so an absent intended-use or compatibility record is detectable;
- claim type, classification, scope, outcome, and bounded factual summary;
- exact source title, URL, publisher, type, access date, locator, jurisdiction, model/family scope,
  evidence tier/basis, and accessibility;
- nullable-but-present document identifier, revision, and date fields so undated sources are
  reportable rather than silently omitted;
- evidence, conflict, physician-adjudication, non-adoption candidate, and launch-readiness states.

The semantic validator rejects prohibited claim types and assertions across researcher-authored
fields, unsupported sources, malformed URLs and dates, missing locators, duplicate identifiers,
undeclared or nonreciprocal evidence conflicts, contradictory final states, supported exact-identity
claims that lack a matching model/order code, compatibility assertions without explicit accessible
Tier A/B primary evidence, and final states without matching physician review. Every candidate's
claim type must also appear in its coverage target's declared requirements. `ADOPTED` is not a valid
research-manifest state.

An unresolved compatibility gap is representable only as `claimOutcome: "UNRESOLVED"` with an
unresolved/unsupported evidence state. That records the production-readiness gap without asserting
compatibility.

## Validate

From the repository root:

```sh
npx tsx scripts/ip-device-intelligence/production-readiness/validate-evidence-manifest.ts \
  <manifest.json>
```

Validation is read-only and exits nonzero with stable, path-specific issue codes on failure.

## Generate reports

```sh
npx tsx scripts/ip-device-intelligence/production-readiness/generate-reports.ts \
  --manifest <manifest.json> \
  --output-dir <review-output-directory> \
  --as-of-date YYYY-MM-DD \
  --stale-after-days 365
```

The report date is mandatory input. The process clock is never consulted. The generator writes
only these known files inside the requested directory:

- `source-coverage-report.md` — procedure, role, product, research-tier, and evidence-tier coverage,
  including distinct URL/document counts; missing intended-use/compatibility evidence; stale,
  undated, and inaccessible sources. Tier D evidence never closes a declared requirement, and
  safety/compatibility requirements require Tier A/B evidence.
- `evidence-conflicts.md` — conflicting claims and family-versus-model risks.
- `physician-adjudication-queue.md` — still-open physician decisions with consequences and explicit
  researcher-recommendation labeling.
- `launch-blocker-matrix.md` — evidence, affected surface, frozen-main/active-PR context, and owner
  and implementation actions.
- `owner-supplied-missing-products.md` — evidence completeness and a conservative, explicitly
  non-approval “safe to propose” assessment. A positive result requires Tier A/B evidence,
  review-ready states, and no launch-blocking or BLOCKER/HIGH disposition.

The generator overwrites those five files if they already exist in the output directory; use a
temporary directory when reviewing output alongside separately authored documentation.

## Focused tests

```sh
npx jest --runInBand \
  scripts/ip-device-intelligence/production-readiness/__tests__/production-readiness-tooling.test.ts
```

The fixture is intentionally non-production and lives under `fixtures/`. Tests cover the rejection
matrix, report coverage, required warning banners, explicit report dates, input-order independence,
and byte determinism.
