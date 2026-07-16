# Baxter CRRT simulator design record

Status: Phase 2 pure engine and schemas implemented; review pending; no functional interface or cases exist  
Current base commit: 0d488175 on origin/ebus_update  
Feature branch: feature/baxter-crrt-simulator  
Canonical route: /[locale]/baxter-crrt  
Canonical module ID: baxter-crrt  
Initial release device: PrisMax AW8035 Rev B, program 2.XX  
Deferred device adapter: Prismaflex G5036003 Revision 05.2011, program 6.xx

This directory is the design and governance record for an authenticated, unlisted, draft CRRT
Learn & Practice simulator. Phase 2 adds a disconnected, deterministic TypeScript engine and strict
content boundaries beneath the Phase 1 route. The functional device interface, learning workflows,
and cases remain outside the implementation boundary.

## Phase 2 outcome

The Phase 2 implementation adds only pure domain and persistence infrastructure:

- Serializable patient, access, circuit, prescription, delivery, alarm, event, and trend types.
- Strict authored/runtime Zod boundaries with fail-closed protocol and fixture validation.
- An unconfigured, idle initial state with no clinical values, active protocol, or case.
- An exhaustive pure reducer and one shared readiness gate for direct and scheduled starts.
- Explicit unit helpers and source-mapped dose, fluid, pressure, filtration, and bag calculations.
- A 60-second canonical integration step, deterministic seeded events, five-minute trend sampling,
  and a 288-sample cap.
- Coupled bag/effluent conservation, prescribed-versus-delivered dose, downtime, whole-patient fluid
  balance, filter progression, and bounded educational patient/solute responses.
- Cause-derived generic alarms whose priority and pump/clamp consequences remain pending the device
  adapter; acknowledgement never clears the underlying cause.
- A versioned, local-only progress DTO with a strict non-PHI allowlist and current-version reset.
- Unit, invariant, lifecycle, replay, time-equivalence, schema, provenance, and privacy tests.

All model coefficients in test fixtures are synthetic, source-labeled, and review-pending. The
engine does not provide clinical targets or patient-specific recommendations. Prismaflex execution,
regional citrate-calcium behavior, both disputed AW8035 expressions, and every clinical case remain
disabled.

## Phase 1 outcome

The localized `/[locale]/baxter-crrt` route now supplies the draft shell defined by this record:

- Fail-closed draft access layered on top of normal site authentication.
- Noindex, nofollow, and noarchive metadata with no navigation, search, or sitemap entry.
- Immutable PrisMax draft profile and deferred Prismaflex source/profile boundary.
- Persistent education/non-endorsement disclaimer and reviewed-English fallback.
- Orientation, Learn, and Practice pathway scaffold with Mastery unavailable.
- Responsive three-domain workbench placeholders without clinical values or controls.
- Claim-level device-source panel and explicit pending review states.

Phase 1 intentionally added no clinical calculations, prescriptions, alarm behavior, executable
patient model, case state, progress persistence, or new analytics events. Phase 2 does not connect
its pure engine to React and adds no analytics events.

## Phase 0 outcome

The repository and all three supplied PDF sources were audited before implementation. The smallest
coherent product milestone remains a three-case PrisMax vertical slice:

- CRRT-04: build a CVVHD prescription.
- CRRT-10: distinguish machine patient-fluid removal from whole-patient balance.
- CRRT-13: localize and correct a worsening access-pressure pattern.

The pilot will use a shared deterministic CRRT engine, an explicit PrisMax adapter, original
CSS/SVG artwork, Learn and Practice pathways, prediction commitment, immediate versus delayed
responses, clean-state isolation, source-mapped synthetic values, and draft review gates.

No citrate dosing pathway, Prismaflex learner interface, full 18-case curriculum, or Mastery
capstone is authorized by Phase 0.

## Repository audit

### Current implementation locations

The implementation path named in the coding brief for HAMILTON-C6 is stale. The current canonical
ventilation feature is src/features/mechanical-ventilation. The localized
/[locale]/hamilton-c6-ventilation route is a legacy redirect to /[locale]/mechanical-ventilation.

The two primary architecture references are:

- src/features/mechanical-ventilation
- src/features/cardiohelp-ecmo

The audit also covered:

- src/app/[locale]/mechanical-ventilation
- src/app/[locale]/hamilton-c6-ventilation
- src/app/[locale]/cardiohelp-ecmo
- src/lib/draft-modules.ts
- src/lib/draft-module-guard.ts
- src/lib/site-auth/access.ts
- src/lib/analytics.ts
- src/lib/site-search.ts
- docs/mechanical-ventilation-release-checklist.md
- docs/cardiohelp-ecmo-clinical-device-review-checklist.md

### Architecture comparison

The structural audit began at 8c051a2f. The access/publication row below was refreshed against the
current 0d488175 tester-preview change; that public-unlisted behavior is explicitly not a CRRT
pattern.

| Concern                    | Mechanical ventilation                                                                       | CARDIOHELP ECMO                                                        | CRRT decision                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Clinical/device separation | Canonical clinical state with multiple revision-locked device profiles and device vocabulary | One device profile tightly integrated with one shared clinical engine  | Use the ventilation separation, but formalize a small adapter interface            |
| Authored content           | JSON source, Zod validation, typed normalization, provenance registries                      | Typed registries plus hand-written integrity checks                    | Use JSON or typed source data through strict Zod schemas                           |
| State transitions          | Pure reducer with prediction gates, clean reloads, and fixed-step simulation                 | Pure reducer with strong Learn/Practice and reassessment workflow      | Keep all clinical correctness and gating in the reducer/engine                     |
| Time and physiology        | Deterministic fixed-step simulation with immediate and delayed effects                       | Deterministic second-by-second circuit and patient response            | Use deterministic substeps and explicit time-equivalence tolerances                |
| Progress                   | Versioned local storage with migration and device/case attempts                              | Versioned local non-PHI progress with mastery                          | Use a strict allowlisted DTO keyed by device, role, pathway, and case              |
| Sources                    | Separate device-source and evidence/provenance registries                                    | Strong visible evidence limitations and review checklist               | Use claim-level source records and separate device/clinical review                 |
| Localization               | Locale route with explicit reviewed-English fallback                                         | HandoffContent wrapper and reviewed-English fallback                   | Follow current handoff infrastructure without translating unreviewed clinical text |
| UI and access              | Current tester-preview state is public-unlisted; draft state is production-admin-gated       | Public-unlisted direct-link route with noindex metadata                | CRRT stays authenticated and unlisted; do not copy either public exception         |
| Tests                      | Schema, device profiles, simulation, paths, progress, components, privacy                    | Fault directionality, mode isolation, walkthroughs, progress, evidence | Combine both matrices and add unit/invariant/time-equivalence tests                |

### Reusable implementation patterns

Phase 1 and later phases should reuse:

- A locale-aware server page that calls setRequestLocale and passes locale into one client lab.
- A sibling layout that enforces draft access while publication status is not approved.
- Explicit noindex, nofollow, and noarchive metadata for every prepublication state.
- A self-contained feature package under src/features/baxter-crrt.
- Immutable revision-locked device profiles.
- A shared clinical/circuit engine with device-specific adapters.
- Strict Zod validation at authored-content boundaries.
- A pure reducer and memoized selectors.
- Deterministic time advancement without direct Math.random use.
- Versioned local progress with failure-safe parsing and no PHI or free text.
- recordSiteModuleEvent through typed CRRT event builders plus server-side CRRT payload validation.
- Explicit baxter-crrt registration in resolveSiteModuleId with locale-aware route tests.
- A persistent professional-education and non-endorsement disclaimer.
- Reviewed-English fallback on non-English routes.
- Original CSS/SVG artwork, text equivalents, visible focus, 44-pixel controls, and reduced motion.
- A development-only calibration panel that is absent from production.
- Separate clinical, PrisMax-device, Prismaflex-device, accessibility, localization, and publication
  approvals.

Patterns should be reused as contracts, not copied as monolithic files. The existing simulator CSS
and orchestration components are large; CRRT should retain the decomposed feature shape in the
coding brief.

## Naming and boundary decisions

| Item                      | Decision                                                                      |
| ------------------------- | ----------------------------------------------------------------------------- |
| Feature root              | src/features/baxter-crrt                                                      |
| Route                     | src/app/[locale]/baxter-crrt                                                  |
| Module analytics ID       | baxter-crrt                                                                   |
| Local progress key        | baxter-crrt-progress-v1                                                       |
| PrisMax device ID         | prismax-aw8035-2xx                                                            |
| Prismaflex device ID      | prismaflex-g5036003-6xx                                                       |
| Initial population        | Adult ICU CRRT; synthetic cases only                                          |
| Initial pathways          | Orientation shell, Learn, and Practice; Mastery unavailable                   |
| Initial active modalities | SCUF, CVVH, CVVHD, and CVVHDF only where source and review status permit      |
| Citrate                   | Types and disabled scaffold only until a versioned local protocol is approved |
| Prismaflex                | Profile/source scaffold only until the PrisMax pilot is accepted              |
| Publication               | Authenticated, unlisted, draft, noindex                                       |

The phrase Baxter CRRT is a repository feature name, not a claim of sponsorship. Learner-facing
copy must describe an independent educational facsimile and must not display Baxter logos.

## Dependency reuse plan

No new runtime dependency is justified for the planned vertical slice.

| Need                        | Existing dependency or pattern                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Application and components  | Next.js, React, TypeScript                                                                                     |
| Authored-content validation | zod                                                                                                            |
| Locale routing/fallback     | next-intl and the repository handoff layer                                                                     |
| State                       | React useReducer and pure engine modules                                                                       |
| Icons                       | lucide-react where an icon is useful                                                                           |
| Diagrams                    | Original semantic SVG and CSS                                                                                  |
| Trends                      | Prefer lightweight SVG for the pilot; use existing Recharts only if accessibility and bundle review justify it |
| Tests                       | Jest and Testing Library                                                                                       |
| Styling                     | CSS Modules and existing design tokens                                                                         |
| Analytics                   | src/lib/analytics.ts                                                                                           |
| Draft access                | src/lib/draft-module-guard.ts and src/lib/draft-modules.ts                                                     |

## Supplied source inventory

The PDFs remain local inputs and must not be copied into the repository.

| Source ID               | Local filename                          | Identity                                                                               | SHA-256                                                          |
| ----------------------- | --------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| PRISMAX-AW8035-RB       | 708933961-Prismax-Operator-s-Manual.pdf | PrisMax Operator's Manual, AW8035 Rev B JUN2019, program 2.XX, 353 PDF pages           | 204543b8c205e535cb9d45c970b8231362839177f3795b6164edcef3b834f1ff |
| PRISMAFLEX-G5036003-R05 | 141000459-Prismaflex-user-manual.pdf    | Prismaflex Operator's Manual, G5036003 Revision 05.2011, program 6.xx, 287 PDF pages   | 6d311624ec075c86ff539d3a86f3ed77cd2ca467346168ee4985af09f0a9224b |
| PRISMAX-NORDICS-2023    | Prismax_Spec-Sheet-2023-NORDICS.pdf     | PrisMax Specifications and Features, NOR-AT21-230020, printed August 2023, 2 PDF pages | 3265a60a947617a80628549cde84dc9a9d7e10c50d8a8b56be8acb63317b501d |

The Nordic sheet is supporting market-specific material only. Its embedded PDF creation/modification
date is 2018 despite the August 2023 printed footer; both facts must remain visible in provenance.

## Route, authentication, and discoverability

The planned route must not be added to the public-unlisted exceptions used by CARDIOHELP and the
current mechanical-ventilation tester preview. Before publication it should:

1. Remain behind the site's normal authentication boundary.
2. Remain absent from primary navigation, ordinary search, sitemap, and promotional surfaces.
3. Be classified as draft and unlisted in the repository visibility policy.
4. Carry noindex, nofollow, and noarchive page metadata; Phase 1 must test that metadata without
   weakening authentication. A separate authenticated-unlisted X-Robots-Tag policy may be added
   later, but the current proxy applies that header only to public-unlisted paths.
5. Fail closed when publication or access state cannot be resolved.

| Access state        | Default production behavior                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| Draft               | Site administrators only through the existing draft guard; other authenticated users receive not found       |
| Authenticated pilot | Unavailable until a CRRT-specific entitlement/cohort mechanism is approved and tested                        |
| Published           | Access and listing behavior require a separate publication decision; publication must not implicitly list it |

NEXT_PUBLIC_SHOW_DRAFT_MODULES=true bypasses the production draft restriction and must not be relied
on as a pilot entitlement. Phase 1 should preserve the stricter administrator-only behavior.
Whether unlisted status is permanent or publication-state-derived remains a product decision.

The module ID declaration is not sufficient by itself. Phase 1 must add /baxter-crrt to
resolveSiteModuleId and test English, Spanish, and Simplified Chinese paths so global authenticated
session telemetry starts for the route.

## Baseline verification

The following checks were run before CRRT files were created:

| Command                 | Result                                                                    |
| ----------------------- | ------------------------------------------------------------------------- |
| npm ci                  | Passed after network access was allowed for the Supabase CLI post-install |
| npm run type-check      | Passed                                                                    |
| npm run lint            | Passed with 13 pre-existing warnings and no errors                        |
| npm test -- --runInBand | Passed: 171 suites, 1,150 tests                                           |
| npm run build           | Passed with existing Mermaid dynamic-require and metadataBase warnings    |

npm reported 40 dependency vulnerabilities: 2 low, 32 moderate, 5 high, and 1 critical. Dependency
remediation is outside Phase 0 and must be handled separately so it is not conflated with CRRT work.

## Phase 1 verification

| Check                                                                                      | Result                                                                                         |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Focused CRRT, route, draft, search, sitemap, and access tests                              | Passed: 8 suites, 47 tests                                                                     |
| `npm run type-check`                                                                       | Passed                                                                                         |
| `npm run lint`                                                                             | Passed with the same 13 pre-existing warnings and no errors                                    |
| `npm test -- --runInBand`                                                                  | Passed: 178 suites, 1,170 tests                                                                |
| `npm run build`                                                                            | Passed; route emitted, with the existing Mermaid dynamic-require and metadata-base warnings    |
| Authenticated local HTTP request to `/en/baxter-crrt`                                      | `200 OK`; heading, draft boundary, and safety disclaimer present                               |
| Unauthenticated local HTTP request to `/en/baxter-crrt`                                    | `307` to `/en/login?next=%2Fen%2Fbaxter-crrt`                                                  |
| Automated in-app browser screenshot and breakpoint pass                                    | Not run; the browser URL policy rejected localhost reload, so no workaround was used           |
| Component DOM, keyboard pathway tabs, CSS breakpoints, reduced motion, and overflow review | Passed within the Phase 1 scaffold scope; formal browser accessibility QA remains a later gate |

## Phase 2 verification

| Check                                                                              | Result                                                                                                   |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Focused CRRT engine, schema, route, access, search, and sitemap tests              | Passed: 22 suites, 138 tests                                                                             |
| `npm run type-check`                                                               | Passed                                                                                                   |
| `npm run lint`                                                                     | Passed with 13 pre-existing warnings outside CRRT and no errors                                          |
| `npm test -- --runInBand`                                                          | Passed: 192 suites, 1,308 tests                                                                          |
| `npm run build`                                                                    | Passed; `/[locale]/baxter-crrt` emitted with existing Mermaid dynamic-require and metadata-base warnings |
| `git diff --check` and scoped Prettier                                             | Passed                                                                                                   |
| Unauthenticated production-build request to `http://localhost:3001/en/baxter-crrt` | `307` to `/en/login?next=%2Fen%2Fbaxter-crrt`, as required                                               |
| Authenticated development request after Phase 2                                    | `200 OK`; Phase 2 gate, pure-engine status, and independent-education copy present                       |

The verified production build is serving the canonical localhost URL on port 3001. A separate
pre-existing development process currently occupies port 3002; its authenticated render was used
to verify the Phase 2 copy because the local development bypass is intentionally not a production
authentication mechanism.

The branch was created while the local ebus_update ref was at 8c051a2f. During the audit, the
HAMILTON tester-preview change 0d488175 became the current origin/ebus_update base and the feature
branch advanced to the same commit. The local ebus_update ref remains stale at 8c051a2f, but the
feature branch is aligned with the current remote base. The Phase 0 files do not modify that
HAMILTON work.

## Human inputs still required

These decisions do not block the Phase 2 pure engine, but they block release of the
affected behavior:

- Exact PrisMax market/configuration and locally installed program version.
- Enabled disposable sets, accessories, Auto Effluent availability, and solution inventory.
- Approved systemic anticoagulation approaches.
- Versioned local citrate/calcium protocol and responsible protocol owner.
- Expected roles and whether any local competency credit is intended.
- Named nephrology, critical care, nurse-educator, PrisMax-device, accessibility, localization, and
  product reviewers.
- Whether detailed CRRT outcome progress remains local-only or later syncs to an authenticated
  learning record. The existing site already stores per-user module percentage, completed sections,
  and time separately from the detailed local CRRT record.
- The entitlement model for authenticated pilot users.
- Whether unlisted status is permanent or changes after publication approval.

Until answered, the profile remains a source-mapped draft, affected options stay disabled, and no
certificate may imply independent clinical competence.

## Phase gate

Phase 2 is complete at the pure-engine/schema boundary. Phase 3 may add only the functional PrisMax
pilot interface described in the coding instructions and requires separate approval before work
begins. No Phase 3 interface, pilot case, Learn/Practice workflow, analytics event, or publication
change is authorized by this record.
