# InterventionalPulm.com

InterventionalPulm.com is a Next.js educational platform for interventional pulmonology and
critical-care simulation. The repository contains learner-facing modules, deterministic synthetic
patient engines, device-training facsimiles, content and evidence registries, and the supporting
authentication, analytics, and editorial release boundaries.

The software is for professional education only. It is not a medical device, clinical decision
support system, patient-specific calculator, device operator manual, certification program, or
substitute for manufacturer instructions, institutional policy, supervised training, and clinical
judgment. Do not enter protected health information or real-patient clinical text.

## Requirements

- Node.js 20.19 or newer
- npm (the repository records `npm@10.8.2` as its package manager)

## Local development

```bash
npm ci
npm run dev
```

The development server runs on [http://localhost:3001](http://localhost:3001). Environment values
belong in `.env.local` and must not be committed.

Protected routes can be opened for local browser testing only when the local-development auth
settings are enabled. Use `/api/local-dev-auth?token=<LOCAL_DEV_AUTH_TOKEN>&next=/` on localhost,
with the token read from `.env.local`; never hard-code, print, or commit it.

## Validation commands

```bash
npm run build:content
npm run type-check
npm run lint
npm test
npm run storybook
npm run storybook:build
npm run build
```

Focused Jest runs use the existing test runner, for example:

```bash
npx jest src/features/critical-care src/features/learning-module --runInBand
```

Do not add a second test or state-management framework without a demonstrated gap in the current
Jest, React Testing Library, Storybook, and reducer-based architecture.

## Repository map

- `src/app/[locale]/` — localized Next.js App Router routes.
- `src/features/` — feature-owned content, components, deterministic engines, and tests.
- `src/features/learning-module/` — backward-compatible shared learning primitives and the V2
  activity contract.
- `src/features/critical-care/` — cross-module catalogs, progress adapters, dashboard, pathways,
  reference, notebook, and bounded analytics.
- `src/lib/` — site auth, release visibility, analytics, search, and shared infrastructure.
- `docs/` — evidence, clinical review, risk, architecture, and release documentation.
- `stories/` — Storybook states for shared UI contracts.
- `supabase/` — reviewed database migrations and server-side infrastructure.

## Critical-care architecture

The critical-care learning system has one dashboard at `/[locale]/critical-care`, while the five
focused laboratories and the integrated ICU Simulator retain their canonical routes. Focused
modules keep independent clinical engines and progress stores. The integrated ICU Simulator alone
owns a cross-system synthetic patient, canonical clock, semantic replay, and therapy adapters.

Every migrated module uses `Overview | Learn | Practice | Assess`. Interactive activities present
`Recognize → Predict → Act → Observe → Explain → Transfer` without renaming or rewriting engine
actions. Existing routes, clinical calculations, scoring rules, evidence, release gates, and legacy
storage keys remain compatible throughout migration.

Start with:

- [Rebuild architecture](docs/critical-care/rebuild-architecture.md)
- [Activity contract](docs/critical-care/activity-contract.md)
- [Migration map](docs/critical-care/migration-map.md)
- [Testing and release](docs/critical-care/testing-and-release.md)

## Clinical and editorial boundaries

- Preserve cited clinical content, simulation mathematics, device ranges, scoring, critical-error
  rules, and review status unless a separately reviewed clinical-change scope authorizes changes.
- Keep device-specific statements source-bound and versioned.
- Keep draft, SME-review, unlisted-preview, noindex, search, sitemap, and authentication boundaries
  intact.
- Store only bounded educational progress and semantic resume data. Never synchronize waveform
  arrays, synthetic patient truth, detailed command histories, PHI, or free-text notes.
- Use visible education-only and model-limitation notices anywhere compatibility, reach, procedural
  technique, device operation, or simulated patient response is discussed.
